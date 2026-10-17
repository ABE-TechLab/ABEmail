import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPilotSendApiKey,
  OTTAWA_PILOT_ADDRESS,
  ResendPilotError,
  sendPilotEmail,
} from "@/lib/email/resend-pilot";
import { decryptProviderSecret, ResendProviderError, sendResendEmail } from "@/lib/email/resend-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return json({ error: "Cross-origin request rejected." }, 403);
    } catch {
      return json({ error: "Invalid request origin." }, 403);
    }
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 100000) return json({ error: "Message is too large for this workspace." }, 413);

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Sign in to send email." }, 401);

  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 100000) return json({ error: "Message is too large for this workspace." }, 413);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Enter valid message details." }, 400);
  }

  if (
    typeof payload !== "object" || payload === null ||
    !("organizationId" in payload) || typeof payload.organizationId !== "string" || !UUID_PATTERN.test(payload.organizationId) ||
    !("mailboxId" in payload) || typeof payload.mailboxId !== "string" || !UUID_PATTERN.test(payload.mailboxId) ||
    !("to" in payload) || typeof payload.to !== "string" || !EMAIL_PATTERN.test(payload.to.trim()) || payload.to.length > 320 ||
    !("subject" in payload) || typeof payload.subject !== "string" || payload.subject.trim().length < 1 || payload.subject.length > 998 ||
    !("text" in payload) || typeof payload.text !== "string" || payload.text.trim().length < 1 || payload.text.length > 80000
  ) {
    return json({ error: "Enter one valid recipient, a subject, and a plain-text message under 80 KB." }, 400);
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || "";
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    return json({ error: "A valid Idempotency-Key header is required." }, 400);
  }

  const organizationId = payload.organizationId;
  const mailboxId = payload.mailboxId;
  const to = payload.to.trim().toLowerCase();
  const subject = payload.subject.trim();
  const text = payload.text;
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ organizationId, mailboxId, to, subject, text }), "utf8")
    .digest("hex");

  const admin = createAdminClient();
  if (!admin) return json({ error: "Mail storage is not configured in this environment." }, 503);

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) return json({ error: "Workspace permission could not be checked." }, 503);
  if (!membership) return json({ error: "You do not have access to this workspace." }, 403);

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id, status, slug")
    .eq("id", organizationId)
    .maybeSingle();
  if (organizationError) return json({ error: "Workspace status could not be checked." }, 503);
  if (!organization || organization.status !== "active") return json({ error: "This workspace is not active." }, 403);

  const { data: mailbox, error: mailboxError } = await admin
    .from("mailboxes")
    .select("id, organization_id, domain_id, address, local_part, status")
    .eq("id", mailboxId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (mailboxError) return json({ error: "Mailbox access could not be checked." }, 503);
  if (!mailbox || mailbox.status !== "active") return json({ error: "The selected mailbox is not active." }, 403);

  const { data: domain, error: domainError } = await admin
    .from("organization_domains")
    .select("id, organization_id, domain, status, verified_at, provider_domain_id, sending_enabled")
    .eq("id", mailbox.domain_id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (domainError) return json({ error: "Sender domain status could not be checked." }, 503);
  if (!domain || domain.status !== "verified" || !domain.verified_at) {
    return json({ error: "The sender domain is not verified in ABEmail." }, 403);
  }
  if (mailbox.address !== mailbox.local_part + "@" + domain.domain) {
    return json({ error: "The mailbox address does not match its verified sender domain." }, 403);
  }

  if (membership.role !== "owner" && membership.role !== "admin") {
    const { data: grant, error: grantError } = await admin
      .from("mailbox_memberships")
      .select("can_send, status")
      .eq("organization_id", organizationId)
      .eq("mailbox_id", mailboxId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (grantError) return json({ error: "Mailbox send permission could not be checked." }, 503);
    if (!grant || grant.status !== "active" || !grant.can_send) {
      return json({ error: "You do not have permission to send from this mailbox." }, 403);
    }
  }

  const { data: providerConnection, error: providerConnectionError } = await admin
    .from("organization_provider_connections")
    .select("api_key_ciphertext, status")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (providerConnectionError) return json({ error: "The workspace email provider could not be checked." }, 503);

  const usesWorkspaceKey = providerConnection?.status === "connected";
  if (providerConnection && !usesWorkspaceKey) {
    return json({ error: "The workspace Resend connection needs attention. Reconnect it in Settings before sending." }, 503);
  }
  const sendApiKey = usesWorkspaceKey
    ? (() => { try { return decryptProviderSecret(providerConnection.api_key_ciphertext); } catch { return null; } })()
    : organization.slug === "ottawa-snow-match" ? getPilotSendApiKey() : null;
  if (!sendApiKey) return json({ error: "Connect a Resend API key in workspace Settings before sending." }, 503);
  if (usesWorkspaceKey && (!domain.sending_enabled || !domain.provider_domain_id)) {
    return json({ error: "Resend has not confirmed sending is enabled for this domain. Refresh domain verification in Settings." }, 409);
  }

  const { data: existing, error: existingError } = await admin
    .from("email_messages")
    .select("id, request_fingerprint, status, provider_message_id")
    .eq("organization_id", organizationId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingError) return json({ error: "Message idempotency could not be checked." }, 503);
  let savedMessageId: string;
  if (existing) {
    if (existing.request_fingerprint !== fingerprint) {
      return json({ error: "This idempotency key was already used for different message content." }, 409);
    }
    if (existing.status === "accepted" || existing.status === "delivered" || existing.status === "delayed") {
      return json({ ok: true, duplicate: true, messageId: existing.id, providerMessageId: existing.provider_message_id }, 200);
    }
    if (existing.status !== "processing") {
      return json({ error: "Resend previously rejected this message. Correct the issue and retry as a new message." }, 409);
    }
    // Reuse the same provider idempotency key after an ambiguous network failure.
    // Resend deduplicates the retry, preventing a second delivery.
    savedMessageId = existing.id;
  } else {
    const { count, error: quotaError } = await admin
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("direction", "outbound")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (quotaError) return json({ error: "Pilot sending limits could not be checked." }, 503);
    const configuredDailyLimit = Number(process.env.ABEMAIL_DEFAULT_DAILY_SEND_LIMIT ?? "250");
    const dailyLimit = Number.isSafeInteger(configuredDailyLimit) && configuredDailyLimit > 0 ? configuredDailyLimit : 250;
    if ((count ?? 0) >= dailyLimit) return json({ error: "This workspace has reached its daily sending limit of " + dailyLimit + " messages. Contact the workspace administrator to review its limit." }, 429);

    const { data: savedMessage, error: saveError } = await admin
      .from("email_messages")
      .insert({
        organization_id: organizationId,
        mailbox_id: mailboxId,
        provider: "resend",
        direction: "outbound",
        from_address: mailbox.address,
        to_addresses: [to],
        subject,
        body_text: text,
        status: "processing",
        idempotency_key: idempotencyKey,
        request_fingerprint: fingerprint,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (saveError || !savedMessage) {
      if (saveError?.code === "23505") return json({ error: "A request with this idempotency key is already in progress." }, 409);
      return json({ error: "The message could not be saved before sending." }, 503);
    }
    savedMessageId = savedMessage.id;
  }

  try {
    const sent = usesWorkspaceKey
      ? await sendResendEmail({
          apiKey: sendApiKey,
          from: (mailbox.display_name || organization.slug) + " <" + mailbox.address + ">",
          to,
          subject,
          text,
          idempotencyKey: organizationId + "/" + idempotencyKey,
        })
      : mailbox.address === OTTAWA_PILOT_ADDRESS
        ? await sendPilotEmail({
            apiKey: sendApiKey,
            to,
            subject,
            text,
            idempotencyKey: organizationId + "/" + idempotencyKey,
          })
        : (() => { throw new ResendProviderError("RESEND_WORKSPACE_KEY_REQUIRED"); })();

    const { error: updateError } = await admin
      .from("email_messages")
      .update({ status: "accepted", provider_message_id: sent.id, sent_at: new Date().toISOString() })
      .eq("id", savedMessageId)
      .eq("organization_id", organizationId);

    if (updateError) {
      return json({
        ok: true,
        status: "accepted_by_provider_persistence_pending",
        messageId: savedMessageId,
        note: "Resend accepted the message, but ABEmail could not finish saving its provider reference. Do not resend the same content with a new key until the message is checked.",
      }, 202);
    }

    return json({ ok: true, status: "accepted", messageId: savedMessageId, providerMessageId: sent.id }, 202);
  } catch (error) {
    if ((error instanceof ResendPilotError || error instanceof ResendProviderError) && error.providerStatus !== null && error.providerStatus < 500) {
      await admin.from("email_messages").update({ status: "failed" }).eq("id", savedMessageId);
      if (error.code === "RESEND_RATE_LIMITED") {
        return json({ error: "Resend is rate-limiting this workspace. Wait before submitting a new message." }, 429);
      }
      return json({ error: "Resend rejected the message. Check the workspace provider connection, domain status, and sender settings before retrying." }, 502);
    }
    // Do not mark an ambiguous network/provider failure as failed: Resend may already
    // have accepted the message. A retry with the same key safely reuses provider idempotency.
    return json({ error: "ABEmail could not confirm whether Resend accepted this message. Retry this exact message without changing it; do not start a new message yet." }, 503);
  }
}
