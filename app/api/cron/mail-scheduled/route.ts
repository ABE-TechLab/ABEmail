import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptProviderSecret, sendResendEmail, ResendProviderError } from "@/lib/email/resend-provider";
import { getPilotSendApiKey, OTTAWA_PILOT_ADDRESS, sendPilotEmail, ResendPilotError } from "@/lib/email/resend-pilot";
import { createHash } from "node:crypto";
import { renderEmailDesign, validateEmailDesignContent, type EmailDesignBrandProfile, type EmailDesignContent } from "@/lib/email-design/render.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
async function runScheduledWorker(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim() || process.env.ABEMAIL_SCHEDULED_MAIL_CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") || "";
  if (!secret || authorization !== "Bearer " + secret) return json({ error: "Unauthorized." }, 401);
  const admin = createAdminClient();
  if (!admin) return json({ error: "Mail storage is not configured." }, 503);
  const { data: jobs, error } = await admin.rpc("claim_due_scheduled_email_messages", { p_limit: 25 });
  if (error) return json({ error: "Scheduled mail queue could not be claimed." }, 503);
  const results: { id: string; status: string }[] = [];
  for (const job of jobs ?? []) {
    try {
      const { data: org, error: orgError } = await admin.from("organizations").select("slug, status")
        .eq("id", job.organization_id).maybeSingle();
      const { data: mailbox, error: mailboxError } = await admin.from("mailboxes")
        .select("id, address, local_part, display_name, domain_id, status")
        .eq("id", job.mailbox_id).eq("organization_id", job.organization_id).maybeSingle();
      if (orgError || mailboxError || !org || org.status !== "active" || !mailbox || mailbox.status !== "active") {
        await admin.from("scheduled_email_messages").update({ status: "failed", locked_at: null, last_error_code: "SENDER_UNAVAILABLE" }).eq("id", job.id);
        results.push({ id: job.id, status: "failed" }); continue;
      }
      const { data: domain, error: domainError } = await admin.from("organization_domains")
        .select("domain, status, verified_at, provider_domain_id, sending_enabled")
        .eq("id", mailbox.domain_id).eq("organization_id", job.organization_id).maybeSingle();
      if (domainError || !domain || domain.status !== "verified" || !domain.verified_at ||
          mailbox.address !== mailbox.local_part + "@" + domain.domain) {
        await admin.from("scheduled_email_messages").update({ status: "failed", locked_at: null, last_error_code: "SENDER_DOMAIN_NOT_READY" }).eq("id", job.id);
        results.push({ id: job.id, status: "failed" }); continue;
      }
      const { data: connection, error: connectionError } = await admin.from("organization_provider_connections")
        .select("api_key_ciphertext, status").eq("organization_id", job.organization_id).maybeSingle();
      if (connectionError || (connection && connection.status !== "connected")) throw new Error("PROVIDER_CONNECTION_UNAVAILABLE");
      const workspaceKey = Boolean(connection?.status === "connected");
      const apiKey = workspaceKey && connection
        ? decryptProviderSecret(connection.api_key_ciphertext)
        : org.slug === "ottawa-snow-match" ? getPilotSendApiKey() : null;
      if (!apiKey) throw new Error("PROVIDER_CONNECTION_UNAVAILABLE");
      if (workspaceKey && (!domain.sending_enabled || !domain.provider_domain_id)) throw new Error("SENDER_DOMAIN_NOT_READY");

      const idempotencyKey = "scheduled-" + job.id;
      const isDesigned = job.design_content_json !== null && job.design_content_json !== undefined;
      let designContent: EmailDesignContent | null = null;
      let bodyText = job.body_text as string;
      let bodyHtml: string | null = null;
      if (isDesigned) {
        const parsed = validateEmailDesignContent(job.design_content_json);
        if (parsed.error || !parsed.data || parsed.data.blocks.length === 0) throw new Error("SCHEDULED_DESIGN_INVALID");
        if (!job.design_brand_profile_json || typeof job.design_brand_profile_json !== "object" || Array.isArray(job.design_brand_profile_json)) {
          throw new Error("SCHEDULED_BRAND_SNAPSHOT_MISSING");
        }
        if (!workspaceKey) throw new Error("DESIGNED_SCHEDULE_REQUIRES_WORKSPACE_PROVIDER");
        designContent = parsed.data;
        const rendered = renderEmailDesign(designContent, job.design_brand_profile_json as EmailDesignBrandProfile);
        if (!rendered.text.trim() || rendered.text.length > 80000 || rendered.html.length > 1000000) {
          throw new Error("SCHEDULED_DESIGN_RENDER_INVALID");
        }
        bodyText = rendered.text;
        bodyHtml = rendered.html;
      }
      const fingerprintPayload = isDesigned
        ? { organizationId: job.organization_id, mailboxId: job.mailbox_id, recipients: [job.to_address], subject: job.subject, designContent, attachmentIds: [] }
        : { organizationId: job.organization_id, mailboxId: job.mailbox_id, recipients: [job.to_address], subject: job.subject, text: bodyText, attachmentIds: [] };
      const fingerprint = createHash("sha256").update(JSON.stringify(fingerprintPayload), "utf8").digest("hex");
      const legacyFingerprint = !isDesigned ? createHash("sha256").update(JSON.stringify({
        organizationId: job.organization_id, mailboxId: job.mailbox_id, to: job.to_address,
        subject: job.subject, text: job.body_text,
      }), "utf8").digest("hex") : null;
      const { data: existing, error: existingError } = await admin.from("email_messages")
        .select("id, status, provider_message_id, request_fingerprint, body_text, body_html").eq("organization_id", job.organization_id)
        .eq("idempotency_key", idempotencyKey).maybeSingle();
      if (existingError) throw new Error("MESSAGE_LEDGER_UNAVAILABLE");
      let messageId: string;
      if (existing?.status === "accepted" || existing?.status === "delivered" || existing?.status === "delayed") {
        await admin.from("scheduled_email_messages").update({ status: "accepted", locked_at: null, sent_message_id: existing.id, provider_message_id: existing.provider_message_id }).eq("id", job.id);
        results.push({ id: job.id, status: "accepted" }); continue;
      }
      if (existing && existing.request_fingerprint !== fingerprint && existing.request_fingerprint !== legacyFingerprint) throw new Error("IDEMPOTENCY_CONFLICT");
      if (existing) {
        messageId = existing.id;
        if (typeof existing.body_text === "string") bodyText = existing.body_text;
        if (typeof existing.body_html === "string") bodyHtml = existing.body_html;
        if (isDesigned && !bodyHtml) throw new Error("SCHEDULED_DESIGN_RENDER_UNAVAILABLE");
      } else {
        const { count, error: countError } = await admin.from("email_messages").select("id", { count: "exact", head: true })
          .eq("organization_id", job.organization_id).eq("direction", "outbound")
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        const dailyLimitValue = Number(process.env.ABEMAIL_DEFAULT_DAILY_SEND_LIMIT ?? "250");
        const dailyLimit = Number.isSafeInteger(dailyLimitValue) && dailyLimitValue > 0 ? dailyLimitValue : 250;
        if (countError || (count ?? 0) >= dailyLimit) throw new Error(countError ? "QUOTA_CHECK_FAILED" : "DAILY_SEND_LIMIT_REACHED");
        const { data: saved, error: saveError } = await admin.from("email_messages").insert({
          organization_id: job.organization_id, mailbox_id: job.mailbox_id, provider: "resend", direction: "outbound",
          from_address: mailbox.address, to_addresses: [job.to_address], subject: job.subject, body_text: bodyText, body_html: bodyHtml,
          status: "processing", idempotency_key: idempotencyKey, request_fingerprint: fingerprint, created_by: job.user_id,
        }).select("id").single();
        if (saveError || !saved) throw new Error("MESSAGE_LEDGER_WRITE_FAILED");
        messageId = saved.id;
      }
      let sent: { id: string };
      if (workspaceKey) {
        sent = await sendResendEmail({
          apiKey, from: (mailbox.display_name || org.slug) + " <" + mailbox.address + ">",
          to: job.to_address, subject: job.subject, text: bodyText, ...(bodyHtml ? { html: bodyHtml } : {}),
          idempotencyKey: job.organization_id + "/" + idempotencyKey,
        });
      } else if (mailbox.address === OTTAWA_PILOT_ADDRESS) {
        sent = await sendPilotEmail({ apiKey, to: job.to_address, subject: job.subject, text: bodyText, idempotencyKey: job.organization_id + "/" + idempotencyKey });
      } else throw new Error("PROVIDER_CONNECTION_UNAVAILABLE");
      const { error: updateMessageError } = await admin.from("email_messages").update({
        status: "accepted", provider_message_id: sent.id, sent_at: new Date().toISOString(),
      }).eq("id", messageId).eq("organization_id", job.organization_id);
      if (updateMessageError) throw new Error("MESSAGE_LEDGER_UPDATE_FAILED");
      const { error: updateJobError } = await admin.from("scheduled_email_messages").update({
        status: "accepted", locked_at: null, provider_message_id: sent.id, sent_message_id: messageId, last_error_code: null,
      }).eq("id", job.id).eq("status", "processing");
      if (updateJobError) throw new Error("SCHEDULE_STATUS_UPDATE_FAILED");
      results.push({ id: job.id, status: "accepted" });
    } catch (error) {
      const code = error instanceof ResendProviderError || error instanceof ResendPilotError
        ? error.code
        : error instanceof Error ? error.message.slice(0, 100) : "SCHEDULED_SEND_FAILED";
      const retryable = !(error instanceof ResendProviderError || error instanceof ResendPilotError) ||
        error.providerStatus === null || error.providerStatus >= 500 || error.providerStatus === 429;
      const finalFailure = !retryable || Number(job.attempt_count) >= 5;
      await admin.from("scheduled_email_messages").update({
        status: finalFailure ? "failed" : "scheduled", locked_at: null, last_error_code: code,
        scheduled_at: finalFailure ? job.scheduled_at : new Date(Date.now() + Math.min(30, 2 ** Number(job.attempt_count)) * 60_000).toISOString(),
      }).eq("id", job.id).eq("status", "processing");
      results.push({ id: job.id, status: finalFailure ? "failed" : "retry_scheduled" });
    }
  }
  return json({ ok: true, processed: results.length, results });
}

export async function POST(request: NextRequest) { return runScheduledWorker(request); }
export async function GET(request: NextRequest) { return runScheduledWorker(request); }
