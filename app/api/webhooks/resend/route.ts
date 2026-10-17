import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchReceivedEmail,
  getPilotApiKey,
  getPilotWebhookSecret,
  OTTAWA_PILOT_ADDRESS,
  OTTAWA_PILOT_DOMAIN,
  ResendPilotError,
  verifyResendWebhookSignature,
} from "@/lib/email/resend-pilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) return json({ error: "Webhook payload is too large." }, 413);

  const secret = getPilotWebhookSecret();
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

  const admin = createAdminClient();
  if (!admin) return json({ error: "Mail storage is not configured." }, 503);

  const { data: insertedEvent, error: insertError } = await admin
    .from("provider_events")
    .insert({
      provider: "resend",
      provider_event_id: eventId,
      event_type: event.type,
      metadata: { email_id: event.data?.email_id ?? event.data?.id ?? null },
      status: "processing",
    })
    .select("id")
    .single();

  let providerEventRowId = insertedEvent?.id as string | undefined;
  if (insertError?.code === "23505") {
    const { data: existing, error: lookupError } = await admin
      .from("provider_events")
      .select("id, status, attempt_count")
      .eq("provider", "resend")
      .eq("provider_event_id", eventId)
      .maybeSingle();

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
    const apiKey = getPilotApiKey();
    if (!apiKey) throw new ResendPilotError("RESEND_PILOT_KEY_MISSING");

    if (event.type === "email.received") {
      const emailId = event.data?.email_id ?? event.data?.id;
      if (!emailId) throw new ResendPilotError("RESEND_INBOUND_ID_MISSING");

      const envelopeRecipients = toAddressList(event.data?.to);
      const received = await fetchReceivedEmail(apiKey, emailId);
      const recipients = Array.from(new Set([
        ...envelopeRecipients,
        ...toAddressList(received.to),
      ])).filter(isPilotAddress);

      if (recipients.length) {
        const { data: mailboxes, error: mailboxError } = await admin
          .from("mailboxes")
          .select("id, organization_id, domain_id, address, status")
          .in("address", recipients)
          .eq("status", "active");

        if (mailboxError) throw new ResendPilotError("INBOUND_MAILBOX_LOOKUP_FAILED");

        for (const mailbox of mailboxes ?? []) {
          const { data: domain, error: domainError } = await admin
            .from("organization_domains")
            .select("id, organization_id, domain, status, verified_at")
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
            !domain || domain.domain !== OTTAWA_PILOT_DOMAIN || domain.status !== "verified" || !domain.verified_at ||
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
          if (!existingMessage) {
            const { error: messageError } = await admin.from("email_messages").insert({
              organization_id: mailbox.organization_id,
              mailbox_id: mailbox.id,
              provider: "resend",
              provider_message_id: received.id ?? emailId,
              direction: "inbound",
              from_address: normalizeAddress(received.from ?? event.data?.from ?? "unknown@invalid"),
              to_addresses: recipients,
              subject: (received.subject ?? event.data?.subject ?? "").slice(0, 998),
              body_text: received.text,
              body_html: received.html,
              status: "received",
              received_at: new Date().toISOString(),
            });

            if (messageError && messageError.code !== "23505") {
              throw new ResendPilotError("INBOUND_MESSAGE_STORE_FAILED");
            }
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

        const { data: affected, error: updateError } = await admin
          .from("email_messages")
          .update(deliveryUpdate)
          .eq("provider", "resend")
          .eq("provider_message_id", providerMessageId)
          .eq("from_address", OTTAWA_PILOT_ADDRESS)
          .eq("direction", "outbound")
          .select("organization_id, mailbox_id")
          .limit(1);

        if (updateError) throw new ResendPilotError("DELIVERY_STATUS_UPDATE_FAILED");
        if (affected?.[0]) {
          resolvedOrganizationId = affected[0].organization_id;
          resolvedMailboxId = affected[0].mailbox_id;
        }
      }
    }

    const { error: completeError } = await admin
      .from("provider_events")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
        organization_id: resolvedOrganizationId,
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
        last_error_code: error instanceof ResendPilotError ? error.code : "WEBHOOK_PROCESSING_FAILED",
      })
      .eq("id", providerEventRowId);
    return json({ error: "Webhook processing failed. Resend may retry this event." }, 500);
  }
}
