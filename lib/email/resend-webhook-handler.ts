import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchReceivedAttachment,
  fetchReceivedEmail,
  getPilotReceiveApiKey,
  getPilotWebhookSecret,
  OTTAWA_PILOT_ADDRESS,
  OTTAWA_PILOT_DOMAIN,
  ResendPilotError,
  verifyResendWebhookSignature,
} from "@/lib/email/resend-pilot";
import { decryptProviderSecret, ResendProviderError } from "@/lib/email/resend-provider";


type ProviderEvent = {
  type?: string;
  data?: {
    email_id?: string;
    id?: string;
    from?: string;
    to?: string[] | string;
    subject?: string;
  };
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function normalizeAddress(value: string): string {
  const angle = value.match(/<([^<>]+)>/);
  return (angle?.[1] ?? value).trim().toLowerCase();
}

function isPilotAddress(value: string): boolean {
  const address = normalizeAddress(value);
  const at = address.lastIndexOf("@");
  return at > 0 && address.slice(at + 1) === OTTAWA_PILOT_DOMAIN;
}

function toAddressList(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").map(normalizeAddress);
  if (typeof value === "string") return [normalizeAddress(value)];
  return [];
}


async function persistReceivedAttachments(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  apiKey: string,
  emailId: string,
  attachments: Array<{ id: string; filename: string; contentType: string; sizeBytes: number }>,
  organizationId: string,
  mailboxId: string,
  messageId: string,
) {
  let totalBytes = 0;
  let storedCount = 0;
  for (const item of attachments.slice(0, 5)) {
    if (item.sizeBytes > 4 * 1024 * 1024) continue;
    const { data: existing } = await admin.from("email_message_attachments").select("id")
      .eq("organization_id", organizationId).eq("mailbox_id", mailboxId)
      .eq("message_id", messageId).eq("provider_attachment_id", item.id).maybeSingle();
    if (existing) continue;
    const downloaded = await fetchReceivedAttachment(apiKey, emailId, item.id);
    if (downloaded.bytes.length > 4 * 1024 * 1024 || totalBytes + downloaded.bytes.length > 20 * 1024 * 1024) continue;
    const filename = downloaded.filename.replace(/[\\/\u0000-\u001f\u007f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 180) || "attachment";
    const contentType = /^[a-z0-9!#export async function handleResendWebhook(request: NextRequest, tenantOrganizationId?: string) {^_.+-]+\/[a-z0-9!#export async function handleResendWebhook(request: NextRequest, tenantOrganizationId?: string) {^_.+-]+$/i.test(downloaded.contentType)
      ? downloaded.contentType : "application/octet-stream";
    const storagePath = [organizationId, mailboxId, messageId, randomUUID() + "-" + filename].join("/");
    const { error: uploadError } = await admin.storage.from("mail-attachments").upload(storagePath, downloaded.bytes, {
      contentType, cacheControl: "3600", upsert: false,
    });
    if (uploadError) throw new ResendPilotError("INBOUND_ATTACHMENT_STORE_FAILED");
    const { error: insertError } = await admin.from("email_message_attachments").insert({
      organization_id: organizationId,
      mailbox_id: mailboxId,
      user_id: null,
      message_id: messageId,
      provider_attachment_id: item.id,
      filename,
      content_type: contentType,
      size_bytes: downloaded.bytes.length,
      storage_path: storagePath,
      expires_at: null,
    });
    if (insertError) {
      await admin.storage.from("mail-attachments").remove([storagePath]);
      if (insertError.code === "23505") continue;
      throw new ResendPilotError("INBOUND_ATTACHMENT_METADATA_FAILED");
    }
    totalBytes += downloaded.bytes.length;
    storedCount += 1;
  }
  return storedCount;
}

export async function handleResendWebhook(request: NextRequest, tenantOrganizationId?: string) {
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) return json({ error: "Webhook payload is too large." }, 413);

  const admin = createAdminClient();
  if (!admin) return json({ error: "Mail storage is not configured." }, 503);

  let secret = getPilotWebhookSecret();
  let tenantApiKey: string | null = null;
  if (tenantOrganizationId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantOrganizationId)) {
      return json({ error: "Invalid workspace webhook endpoint." }, 400);
    }
    const { data: connection, error: connectionError } = await admin
      .from("organization_provider_connections")
      .select("api_key_ciphertext, webhook_secret_ciphertext, status")
      .eq("organization_id", tenantOrganizationId)
      .maybeSingle();
    if (connectionError) return json({ error: "Workspace webhook configuration could not be loaded." }, 503);
    if (!connection || connection.status !== "connected" || !connection.webhook_secret_ciphertext) {
      return json({ error: "Workspace webhook is not configured." }, 503);
    }
    try {
      tenantApiKey = decryptProviderSecret(connection.api_key_ciphertext);
      secret = decryptProviderSecret(connection.webhook_secret_ciphertext);
    } catch {
      return json({ error: "Workspace webhook credentials could not be decrypted." }, 503);
    }
  }
  if (!secret) return json({ error: "Webhook is not configured." }, 503);

  const verified = verifyResendWebhookSignature({
    rawBody,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    secret,
  });
  if (!verified) return json({ error: "Invalid webhook signature." }, 401);

  let event: ProviderEvent;
  try {
    event = JSON.parse(rawBody) as ProviderEvent;
  } catch {
    return json({ error: "Invalid webhook payload." }, 400);
  }

  const eventId = request.headers.get("svix-id");
  if (!eventId || eventId.length > 255 || !event.type || event.type.length > 120) {
    return json({ error: "Webhook event identity is invalid." }, 400);
  }

  const { data: insertedEvent, error: insertError } = await admin
    .from("provider_events")
    .insert({
      provider: "resend",
      provider_event_id: eventId,
      organization_id: tenantOrganizationId ?? null,
      event_type: event.type,
      metadata: { email_id: event.data?.email_id ?? event.data?.id ?? null },
      status: "processing",
    })
    .select("id")
    .single();

  let providerEventRowId = insertedEvent?.id as string | undefined;
  if (insertError?.code === "23505") {
    const duplicateLookup = tenantOrganizationId
      ? admin.from("provider_events").select("id, status, attempt_count").eq("provider", "resend").eq("organization_id", tenantOrganizationId).eq("provider_event_id", eventId).maybeSingle()
      : admin.from("provider_events").select("id, status, attempt_count").eq("provider", "resend").is("organization_id", null).eq("provider_event_id", eventId).maybeSingle();
    const { data: existing, error: lookupError } = await duplicateLookup;

    if (lookupError) return json({ error: "Webhook deduplication could not be checked." }, 503);
    if (!existing) return json({ error: "Webhook event could not be loaded." }, 503);
    if (existing.status === "processed") {
      return json({ ok: true, duplicate: true });
    }
    if (existing.status === "processing") {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: stale, error: staleError } = await admin
        .from("provider_events")
        .update({ status: "failed", last_error_code: "STALE_PROCESSING_RETRY" })
        .eq("id", existing.id)
        .eq("status", "processing")
        .lt("received_at", cutoff)
        .select("id")
        .maybeSingle();
      if (staleError) return json({ error: "Stalled webhook status could not be checked." }, 503);
      if (stale) return json({ error: "A prior processing attempt stalled. Resend should retry this event." }, 500);
      return json({ ok: true, duplicate: true });
    }

    const { data: claimed, error: claimError } = await admin
      .from("provider_events")
      .update({ status: "processing", attempt_count: (existing.attempt_count ?? 1) + 1, last_error_code: null, received_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    if (claimError) return json({ error: "Webhook retry could not be claimed." }, 503);
    if (!claimed) return json({ ok: true, duplicate: true });
    providerEventRowId = claimed.id;
  } else if (insertError || !insertedEvent) {
    return json({ error: "Webhook event could not be recorded." }, 503);
  }

  if (!providerEventRowId) return json({ error: "Webhook event could not be tracked." }, 503);

  let resolvedOrganizationId: string | null = null;
  let resolvedMailboxId: string | null = null;

  try {
    if (event.type === "email.received") {
      const apiKey = tenantApiKey ?? getPilotReceiveApiKey();
      if (!apiKey) throw new ResendPilotError("RESEND_PILOT_RECEIVE_KEY_MISSING");
      const emailId = event.data?.email_id ?? event.data?.id;
      if (!emailId) throw new ResendPilotError("RESEND_INBOUND_ID_MISSING");

      const envelopeRecipients = toAddressList(event.data?.to);
      const received = await fetchReceivedEmail(apiKey, emailId);
      const recipientCandidates = Array.from(new Set([
        ...envelopeRecipients,
        ...toAddressList(received.to),
      ])).filter((address) => tenantOrganizationId
        ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
        : isPilotAddress(address));

      if (recipientCandidates.length) {
        const mailboxQuery = tenantOrganizationId
          ? admin.from("mailboxes").select("id, organization_id, domain_id, address, status").in("address", recipientCandidates).eq("organization_id", tenantOrganizationId).eq("status", "active")
          : admin.from("mailboxes").select("id, organization_id, domain_id, address, status").in("address", recipientCandidates).eq("status", "active");
        const { data: mailboxes, error: mailboxError } = await mailboxQuery;
        if (mailboxError) throw new ResendPilotError("INBOUND_MAILBOX_LOOKUP_FAILED");
        const recipients = Array.from(new Set((mailboxes ?? []).map((mailbox) => mailbox.address)));

        for (const mailbox of mailboxes ?? []) {
          const toAddresses = Array.from(new Set([...toAddressList(received.to), mailbox.address])).slice(0, 10);
          const ccAddresses = Array.from(new Set(toAddressList(received.cc))).slice(0, 10);
          const replyToAddresses = Array.from(new Set(toAddressList(received.replyTo))).slice(0, 10);
          const { data: domain, error: domainError } = await admin
            .from("organization_domains")
            .select("*")
            .eq("id", mailbox.domain_id)
            .eq("organization_id", mailbox.organization_id)
            .maybeSingle();

          const { data: organization, error: organizationError } = await admin
            .from("organizations")
            .select("id, status")
            .eq("id", mailbox.organization_id)
            .maybeSingle();

          if (domainError || organizationError) throw new ResendPilotError("INBOUND_TENANT_LOOKUP_FAILED");
          if (
            !domain || domain.status !== "verified" || !domain.verified_at ||
            (tenantOrganizationId ? domain.receiving_enabled !== true : domain.domain !== OTTAWA_PILOT_DOMAIN) ||
            !organization || organization.status !== "active"
          ) continue;

          const { data: existingMessage, error: existingMessageError } = await admin
            .from("email_messages")
            .select("id")
            .eq("provider", "resend")
            .eq("provider_message_id", received.id ?? emailId)
            .eq("mailbox_id", mailbox.id)
            .maybeSingle();

          if (existingMessageError) throw new ResendPilotError("INBOUND_DEDUPLICATION_FAILED");
          let storedMessageId: string | null = existingMessage?.id ?? null;
          if (!existingMessage) {
            const { data: savedMessage, error: messageError } = await admin.from("email_messages").insert({
              organization_id: mailbox.organization_id,
              mailbox_id: mailbox.id,
              provider: "resend",
              provider_message_id: received.id ?? emailId,
              direction: "inbound",
              from_address: normalizeAddress(received.from ?? event.data?.from ?? "unknown@invalid"),
              to_addresses: toAddresses.length ? toAddresses : recipients,
              cc_addresses: ccAddresses,
              reply_to_addresses: replyToAddresses,
              subject: (received.subject ?? event.data?.subject ?? "").slice(0, 998),
              body_text: received.text,
              body_html: received.html,
              status: "received",
              received_at: new Date().toISOString(),
            }).select("id").single();

            if (messageError && messageError.code !== "23505") {
              throw new ResendPilotError("INBOUND_MESSAGE_STORE_FAILED");
            }
            storedMessageId = savedMessage?.id ?? null;
            if (!storedMessageId && messageError?.code === "23505") {
              const { data: racedMessage, error: racedError } = await admin.from("email_messages").select("id")
                .eq("provider", "resend").eq("provider_message_id", received.id ?? emailId)
                .eq("mailbox_id", mailbox.id).maybeSingle();
              if (racedError || !racedMessage) throw new ResendPilotError("INBOUND_DEDUPLICATION_FAILED");
              storedMessageId = racedMessage.id;
            }
          }

          if (!storedMessageId) throw new ResendPilotError("INBOUND_MESSAGE_STORE_FAILED");
          if (received.attachments.length) {
            await persistReceivedAttachments(admin, apiKey, emailId, received.attachments, mailbox.organization_id, mailbox.id, storedMessageId);
          }

          if (!resolvedOrganizationId) {
            resolvedOrganizationId = mailbox.organization_id;
            resolvedMailboxId = mailbox.id;
          }
        }
      }
    } else if (
      event.type === "email.sent" ||
      event.type === "email.delivered" ||
      event.type === "email.delivery_delayed" ||
      event.type === "email.bounced" ||
      event.type === "email.complained" ||
      event.type === "email.failed" ||
      event.type === "email.suppressed"
    ) {
      const providerMessageId = event.data?.email_id ?? event.data?.id;
      if (providerMessageId) {
        const statusByType: Record<string, string> = {
          "email.sent": "accepted",
          "email.delivered": "delivered",
          "email.delivery_delayed": "delayed",
          "email.bounced": "bounced",
          "email.complained": "complained",
          "email.failed": "failed",
          "email.suppressed": "suppressed",
        };
        const deliveryUpdate: { status: string; delivered_at?: string } = {
          status: statusByType[event.type],
        };
        if (event.type === "email.delivered") deliveryUpdate.delivered_at = new Date().toISOString();

        const deliveryQuery = tenantOrganizationId
          ? admin.from("email_messages").update(deliveryUpdate)
              .eq("provider", "resend").eq("provider_message_id", providerMessageId)
              .eq("organization_id", tenantOrganizationId).eq("direction", "outbound")
              .select("organization_id, mailbox_id").limit(1)
          : admin.from("email_messages").update(deliveryUpdate)
              .eq("provider", "resend").eq("provider_message_id", providerMessageId)
              .eq("from_address", OTTAWA_PILOT_ADDRESS).eq("direction", "outbound")
              .select("organization_id, mailbox_id").limit(1);
        const { data: affected, error: updateError } = await deliveryQuery;

        if (updateError) throw new ResendPilotError("DELIVERY_STATUS_UPDATE_FAILED");
        if (affected?.[0]) {
          resolvedOrganizationId = affected[0].organization_id;
          resolvedMailboxId = affected[0].mailbox_id;
        }

        if (tenantOrganizationId) {
          const invitationStatusByType: Record<string, string> = {
            "email.sent": "sent",
            "email.delivered": "delivered",
            "email.delivery_delayed": "delayed",
            "email.bounced": "bounced",
            "email.complained": "complained",
            "email.failed": "failed",
            "email.suppressed": "suppressed",
          };
          const invitationStatus = invitationStatusByType[event.type];
          if (invitationStatus) {
            const { data: affectedInvitations, error: invitationUpdateError } = await admin
              .from("organization_invitations")
              .update({
                delivery_status: invitationStatus,
                delivery_error_code: ["failed", "bounced", "complained", "suppressed"].includes(invitationStatus)
                  ? "INVITATION_EMAIL_" + invitationStatus.toUpperCase()
                  : null,
              })
              .eq("organization_id", tenantOrganizationId)
              .eq("provider_message_id", providerMessageId)
              .select("id")
              .limit(1);
            if (invitationUpdateError) throw new ResendPilotError("INVITATION_DELIVERY_STATUS_UPDATE_FAILED");
            if (affectedInvitations?.[0]) resolvedOrganizationId = tenantOrganizationId;
          }
        }
      }
    }

    const { error: completeError } = await admin
      .from("provider_events")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
        organization_id: tenantOrganizationId ? (resolvedOrganizationId ?? tenantOrganizationId) : null,
        mailbox_id: resolvedMailboxId,
        last_error_code: null,
      })
      .eq("id", providerEventRowId);
    if (completeError) throw new ResendPilotError("WEBHOOK_COMPLETION_FAILED");

    return json({ ok: true });
  } catch (error) {
    await admin
      .from("provider_events")
      .update({
        status: "failed",
        last_error_code: error instanceof ResendPilotError || error instanceof ResendProviderError ? error.code : "WEBHOOK_PROCESSING_FAILED",
      })
      .eq("id", providerEventRowId);
    return json({ error: "Webhook processing failed. Resend may retry this event." }, 500);
  }
}


export async function POST(request: NextRequest) {
  return handleResendWebhook(request);
}
