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
} from "@/lib/email/resend-pilot";
import { decryptProviderSecret, ResendProviderError } from "@/lib/email/resend-provider";
import { classifyProviderEventDuplicate } from "@/lib/email/resend-webhook-state.mjs";
import { verifyAndParseResendWebhook } from "@/lib/email/resend-webhook-security.mjs";
import { processResendRecipientDeliveryEvent } from "@/lib/email/resend-delivery-state.mjs";


type ProviderEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    id?: string;
    created_at?: string;
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
    const contentType = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(downloaded.contentType)
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

  const verification = verifyAndParseResendWebhook({
    rawBody,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    secret,
  });
  if (!verification.ok) return json({ error: verification.error }, verification.status);

  const event = verification.event as ProviderEvent;
  const eventId = verification.eventId;

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
      ? admin.from("provider_events").select("id, status, attempt_count, received_at").eq("provider", "resend").eq("organization_id", tenantOrganizationId).eq("provider_event_id", eventId).maybeSingle()
      : admin.from("provider_events").select("id, status, attempt_count, received_at").eq("provider", "resend").is("organization_id", null).eq("provider_event_id", eventId).maybeSingle();
    const { data: existing, error: lookupError } = await duplicateLookup;

    if (lookupError) return json({ error: "Webhook deduplication could not be checked." }, 503);
    if (!existing) return json({ error: "Webhook event could not be loaded." }, 503);
    const duplicateDisposition = classifyProviderEventDuplicate(existing.status, existing.received_at);
    if (duplicateDisposition === "acknowledge") {
      return json({ ok: true, duplicate: true });
    }

    if (duplicateDisposition === "recover") {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { error: staleError } = await admin
        .from("provider_events")
        .update({ status: "failed", last_error_code: "STALE_PROCESSING_RETRY" })
        .eq("id", existing.id)
        .eq("status", "processing")
        .lt("received_at", cutoff)
        .select("id")
        .maybeSingle();
      if (staleError) return json({ error: "Stalled webhook status could not be checked." }, 503);
      // Even when another request wins the state transition, do not acknowledge
      // an event that has not been confirmed as processed. Ask Resend to retry.
      return json({ error: "A prior webhook attempt stalled or is changing state. Resend should retry this event." }, 503);
    }

    if (duplicateDisposition !== "claim") {
      // A concurrent delivery may see the unique event row while the first
      // request is still processing. Returning 200 here can lose the event if
      // the first attempt later fails. A retry is safe because event IDs are
      // deduplicated and only a failed row can be atomically reclaimed.
      return json({ error: "This webhook event is still processing. Resend should retry it." }, 503);
    }

    const { data: claimed, error: claimError } = await admin
      .from("provider_events")
      .update({ status: "processing", attempt_count: (existing.attempt_count ?? 1) + 1, last_error_code: null, received_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    if (claimError) return json({ error: "Webhook retry could not be claimed." }, 503);
    if (!claimed) return json({ error: "Webhook retry is already being claimed. Resend should retry it." }, 503);
    providerEventRowId = claimed.id;
  } else if (insertError || !insertedEvent) {
    return json({ error: "Webhook event could not be recorded." }, 503);
  }

  if (!providerEventRowId) return json({ error: "Webhook event could not be tracked." }, 503);

  let resolvedOrganizationId: string | null = null;
  let resolvedMailboxId: string | null = null;
  let resolvedWarningCode: string | null = null;

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
        let deliveryMessageMatched = false;
        let invitationMatched = false;
        const result = await processResendRecipientDeliveryEvent({
          event,
          eventId,
          tenantOrganizationId: tenantOrganizationId ?? null,
          pilotFromAddress: OTTAWA_PILOT_ADDRESS,
          repository: {
            async findOutboundMessage(input: { providerMessageId: string; organizationId: string | null; fromAddress: string | null }) {
              let query = admin.from("email_messages")
                .select("id, organization_id, mailbox_id, to_addresses")
                .eq("provider", "resend")
                .eq("provider_message_id", input.providerMessageId)
                .eq("direction", "outbound");
              query = input.organizationId
                ? query.eq("organization_id", input.organizationId)
                : query.eq("from_address", input.fromAddress);
              const { data, error } = await query.maybeSingle();
              if (error) throw new ResendPilotError("DELIVERY_MESSAGE_LOOKUP_FAILED");
              if (!data) return null;
              return {
                id: data.id,
                organizationId: data.organization_id,
                mailboxId: data.mailbox_id,
                toAddresses: data.to_addresses,
              };
            },
            async ensureRecipient(input: { organizationId: string; mailboxId: string; messageId: string; recipientEmail: string }) {
              const { error } = await admin.from("email_message_recipients").upsert({
                organization_id: input.organizationId,
                mailbox_id: input.mailboxId,
                message_id: input.messageId,
                recipient_email: input.recipientEmail,
                status: "processing",
              }, {
                onConflict: "organization_id,message_id,recipient_email",
                ignoreDuplicates: true,
              });
              if (error) throw new ResendPilotError("DELIVERY_RECIPIENT_SEED_FAILED");
            },
            async applyRecipientEvent(input: {
              organizationId: string;
              mailboxId: string;
              messageId: string;
              recipientEmail: string;
              status: string;
              eventAt: string;
              eventId: string;
              deliveredAt: string | null;
            }) {
              const { data, error } = await admin.from("email_message_recipients")
                .update({
                  status: input.status,
                  last_event_at: input.eventAt,
                  last_provider_event_id: input.eventId,
                  ...(input.deliveredAt ? { delivered_at: input.deliveredAt } : {}),
                })
                .eq("organization_id", input.organizationId)
                .eq("mailbox_id", input.mailboxId)
                .eq("message_id", input.messageId)
                .eq("recipient_email", input.recipientEmail)
                .or("last_event_at.is.null,last_event_at.lt." + input.eventAt)
                .select("id")
                .maybeSingle();
              if (error) throw new ResendPilotError("DELIVERY_RECIPIENT_UPDATE_FAILED");
              return Boolean(data?.id);
            },
          },
        });

        if (result.matched && result.organizationId) {
          deliveryMessageMatched = true;
          resolvedOrganizationId = result.organizationId;
          resolvedMailboxId = result.mailboxId ?? null;
        }
        if (result.reason === "recipient_unresolved") {
          resolvedWarningCode = "DELIVERY_RECIPIENT_UNRESOLVED";
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
            if (affectedInvitations?.[0]) {
              invitationMatched = true;
              resolvedOrganizationId = tenantOrganizationId;
            }
          }
        }

        // A provider webhook can race the send response that persists
        // provider_message_id. Keep this event retryable instead of marking it
        // processed when neither an outbound message nor invitation is linked.
        if (!deliveryMessageMatched && !invitationMatched) {
          throw new ResendPilotError("DELIVERY_MESSAGE_UNRESOLVED");
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
        last_error_code: resolvedWarningCode,
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
