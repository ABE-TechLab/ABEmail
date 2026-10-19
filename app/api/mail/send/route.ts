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
    !("to" in payload) || typeof payload.to !== "string" || payload.to.trim().length < 1 || payload.to.length > 4000 ||
    !("subject" in payload) || typeof payload.subject !== "string" || payload.subject.trim().length < 1 || payload.subject.length > 998 ||
    !("text" in payload) || typeof payload.text !== "string" || payload.text.trim().length < 1 || payload.text.length > 80000 ||
    ("attachments" in payload && (!Array.isArray(payload.attachments) || payload.attachments.length > 5 ||
      payload.attachments.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id)) ||
      new Set(payload.attachments).size !== payload.attachments.length))
  ) {
    return json({ error: "Enter one valid recipient, a subject, and a plain-text message under 80 KB." }, 400);
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || "";
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    return json({ error: "A valid Idempotency-Key header is required." }, 400);
  }

  const organizationId = payload.organizationId;
  const mailboxId = payload.mailboxId;
  const subject = payload.subject.trim();
  const text = payload.text;
  const recipients = Array.from(new Set(payload.to.split(/[;,]/).map((value) => value.trim().toLowerCase()).filter(Boolean)));
  const attachmentIds = "attachments" in payload && Array.isArray(payload.attachments) ? payload.attachments as string[] : [];
  if (recipients.length < 1 || recipients.length > 10 || recipients.some((address) => !EMAIL_PATTERN.test(address))) {
    return json({ error: "Enter between one and ten valid email recipients, separated by commas." }, 400);
  }
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ organizationId, mailboxId, recipients, subject, text, attachmentIds }), "utf8")
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
    .select("id, organization_id, domain_id, address, local_part, display_name, status")
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
  const sendApiKey = usesWorkspaceKey && providerConnection
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

    if (quotaError) return json({ error: "Workspace sending limits could not be checked." }, 503);
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
        to_addresses: recipients,
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
    // Attachment IDs can refer to this in-flight message on an idempotent retry,
    // or to unexpired uploads created by this user for this mailbox.
    let attachmentRows: Array<{ id: string; filename: string; content_type: string; size_bytes: number; storage_path: string; user_id: string | null; message_id: string | null; expires_at: string | null }> = [];
    if (attachmentIds.length) {
      const { data: rows, error: attachmentError } = await admin.from("email_message_attachments")
        .select("id, filename, content_type, size_bytes, storage_path, user_id, message_id, expires_at")
        .in("id", attachmentIds).eq("organization_id", organizationId).eq("mailbox_id", mailboxId);
      if (attachmentError || !rows || rows.length !== attachmentIds.length) {
        return json({ error: "One or more attachments are unavailable. Remove and upload them again." }, 400);
      }
      const byId = new Map(rows.map((row) => [row.id, row]));
      attachmentRows = attachmentIds.map((id) => byId.get(id)!).filter(Boolean);
      if (attachmentRows.length !== attachmentIds.length || attachmentRows.some((row) =>
        (row.message_id !== null && row.message_id !== savedMessageId) ||
        (row.message_id === null && (row.user_id !== user.id || !row.expires_at || Date.parse(row.expires_at) <= Date.now()))
      )) {
        return json({ error: "An attachment expired or belongs to a different message." }, 409);
      }
      const attachmentBytes = attachmentRows.reduce((sum, row) => sum + Number(row.size_bytes), 0);
      if (attachmentBytes > 20 * 1024 * 1024 || attachmentRows.some((row) => row.size_bytes > 4 * 1024 * 1024)) {
        return json({ error: "Attachments exceed the allowed message size." }, 413);
      }
    }
    const providerAttachments: Array<{ filename: string; contentType: string; content: string }> = [];
    for (const attachment of attachmentRows) {
      const { data: file, error: fileError } = await admin.storage.from("mail-attachments").download(attachment.storage_path);
      if (fileError || !file) return json({ error: "An attachment could not be read from secure storage. Retry the same message." }, 503);
      const content = Buffer.from(await file.arrayBuffer());
      if (content.length !== attachment.size_bytes || content.length > 4 * 1024 * 1024) {
        return json({ error: "An attachment failed its size check. Remove and upload it again." }, 409);
      }
      providerAttachments.push({ filename: attachment.filename, contentType: attachment.content_type, content: content.toString("base64") });
    }

    const pendingIds = attachmentRows.filter((row) => row.message_id === null).map((row) => row.id);
    if (pendingIds.length) {
      const { data: linked, error: linkError } = await admin.from("email_message_attachments")
        .update({ message_id: savedMessageId, expires_at: null })
        .in("id", pendingIds).eq("organization_id", organizationId).eq("mailbox_id", mailboxId)
        .eq("user_id", user.id).is("message_id", null)
        .select("id");
      if (linkError || (linked?.length ?? 0) !== pendingIds.length) {
        return json({ error: "Attachments could not be linked safely to this message." }, 503);
      }
      attachmentRows = attachmentRows.map((row) => pendingIds.includes(row.id) ? { ...row, message_id: savedMessageId, expires_at: null } : row);
    }

    const sent = usesWorkspaceKey
      ? await sendResendEmail({
          apiKey: sendApiKey,
          from: (mailbox.display_name || organization.slug) + " <" + mailbox.address + ">",
          to: recipients,
          subject,
          text,
          attachments: providerAttachments,
          idempotencyKey: organizationId + "/" + idempotencyKey,
        })
      : mailbox.address === OTTAWA_PILOT_ADDRESS
        ? await sendPilotEmail({
            apiKey: sendApiKey,
            to: recipients,
            subject,
            text,
            attachments: providerAttachments,
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
      if (attachmentIds.length) {
        const { error: detachError } = await admin.from("email_message_attachments")
          .update({ message_id: null, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })
          .eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("message_id", savedMessageId)
          .eq("user_id", user.id).in("id", attachmentIds);
        if (detachError) return json({ error: "The provider rejected this email and attachment cleanup needs attention. Refresh the composer before retrying." }, 503);
      }
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
