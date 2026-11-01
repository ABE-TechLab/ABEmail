import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderEmailDesign, validateEmailDesignContent, type EmailDesignBrandProfile, type EmailDesignContent } from "@/lib/email-design/render.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function originAllowed(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
async function context(organizationId: string, mailboxId: string) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: json({ error: "Sign in to manage scheduled email." }, 401) } as const;
  const admin = createAdminClient();
  if (!admin) return { response: json({ error: "Mail storage is not configured." }, 503) } as const;
  if (!UUID.test(organizationId) || !UUID.test(mailboxId)) return { response: json({ error: "Invalid workspace or mailbox." }, 400) } as const;
  const { data: membership, error: membershipError } = await supabase.from("organization_memberships")
    .select("role").eq("organization_id", organizationId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (membershipError) return { response: json({ error: "Workspace access could not be checked." }, 503) } as const;
  if (!membership) return { response: json({ error: "Workspace access denied." }, 403) } as const;
  const { data: mailbox, error: mailboxError } = await admin.from("mailboxes")
    .select("id, organization_id, domain_id, address, local_part, display_name, status")
    .eq("id", mailboxId).eq("organization_id", organizationId).maybeSingle();
  if (mailboxError) return { response: json({ error: "Mailbox access could not be checked." }, 503) } as const;
  if (!mailbox || mailbox.status !== "active") return { response: json({ error: "Mailbox is unavailable." }, 403) } as const;
  if (membership.role !== "owner" && membership.role !== "admin") {
    const { data: grant, error: grantError } = await admin.from("mailbox_memberships")
      .select("status, can_read, can_send").eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("user_id", user.id).maybeSingle();
    if (grantError) return { response: json({ error: "Mailbox permissions could not be checked." }, 503) } as const;
    if (!grant || grant.status !== "active" || !grant.can_read || !grant.can_send) return { response: json({ error: "Read and send access is required." }, 403) } as const;
  }
  return { user, admin, mailbox } as const;
}
export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organizationId") || "";
  const mailboxId = request.nextUrl.searchParams.get("mailboxId") || "";
  const ctx = await context(organizationId, mailboxId);
  if ("response" in ctx) return ctx.response;
  const { data, error } = await ctx.admin.from("scheduled_email_messages")
    .select("id, organization_id, mailbox_id, user_id, to_address, subject, body_text, design_content_json, scheduled_at, status, attempt_count, last_error_code, created_at, updated_at")
    .eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("user_id", ctx.user.id)
    .in("status", ["scheduled", "processing", "failed"]).order("scheduled_at", { ascending: true }).limit(100);
  if (error) return json({ error: "Scheduled messages could not be loaded. The Scheduled migration may not be applied in this environment." }, 503);
  return json({ scheduled: (data ?? []).map(({ design_content_json, ...item }) => ({ ...item, is_designed: Boolean(design_content_json) })) });
}
export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return json({ error: "Cross-origin request rejected." }, 403);
  let p: unknown;
  try { const raw = await request.text(); if (raw.length > 350000) return json({ error: "Message is too large." }, 413); p = JSON.parse(raw); }
  catch { return json({ error: "Invalid scheduled message payload." }, 400); }
  if (!p || typeof p !== "object") return json({ error: "Invalid scheduled message payload." }, 400);
  const body = p as Record<string, unknown>;
  const rawRequestId = request.headers.get("Idempotency-Key");
  const clientRequestId = rawRequestId ? rawRequestId.trim() : null;
  if (clientRequestId && !UUID.test(clientRequestId)) return json({ error: "Invalid scheduled-message request key." }, 400);
  const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";
  const mailboxId = typeof body.mailboxId === "string" ? body.mailboxId : "";
  const ctx = await context(organizationId, mailboxId);
  if ("response" in ctx) return ctx.response;
  let designContent: EmailDesignContent | null = null;
  if (body.designContent !== undefined && body.designContent !== null) {
    const parsed = validateEmailDesignContent(body.designContent);
    if (parsed.error || !parsed.data || parsed.data.blocks.length === 0) {
      return json({ error: parsed.error || "Add at least one content block before scheduling a designed email." }, 400);
    }
    designContent = parsed.data;
  }
  if (typeof body.to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to.trim()) || body.to.length > 320 ||
      typeof body.subject !== "string" || !body.subject.trim() || body.subject.length > 998 ||
      typeof body.text !== "string" || body.text.length > 80000 || (!body.text.trim() && !designContent) ||
      typeof body.scheduledAt !== "string" || !Number.isFinite(Date.parse(body.scheduledAt))) {
    return json({ error: "Enter a valid recipient, subject, message, and scheduled time." }, 400);
  }
  const scheduledAt = new Date(body.scheduledAt);
  const now = Date.now();
  if (scheduledAt.getTime() < now + 60_000) return json({ error: "Choose a time at least one minute in the future." }, 400);
  if (scheduledAt.getTime() > now + 366 * 24 * 60 * 60 * 1000) return json({ error: "Scheduled messages must be within the next year." }, 400);
  const { data: domain, error: domainError } = await ctx.admin.from("organization_domains")
    .select("status, verified_at, sending_enabled, provider_domain_id, domain")
    .eq("id", ctx.mailbox.domain_id).eq("organization_id", organizationId).maybeSingle();
  if (domainError) return json({ error: "Sender domain status could not be checked." }, 503);
  if (!domain || domain.status !== "verified" || !domain.verified_at ||
      ctx.mailbox.address !== ctx.mailbox.local_part + "@" + domain.domain) {
    return json({ error: "The selected sender domain must be verified before scheduling." }, 403);
  }
  const { data: provider, error: providerError } = await ctx.admin.from("organization_provider_connections")
    .select("status").eq("organization_id", organizationId).maybeSingle();
  if (providerError) return json({ error: "The workspace email provider could not be checked." }, 503);
  if (provider && provider.status !== "connected") return json({ error: "Reconnect the workspace Resend connection before scheduling." }, 409);
  if (provider && (!domain.sending_enabled || !domain.provider_domain_id)) return json({ error: "Resend has not confirmed sending is enabled for this domain. Refresh domain verification before scheduling." }, 409);
  if (!provider && ctx.mailbox.address !== "info@ottawasnowmatch.waste2light.com") {
    return json({ error: "Connect Resend in workspace Settings before scheduling." }, 503);
  }

  const requestFingerprint = createHash("sha256").update(JSON.stringify({
    organizationId,
    mailboxId,
    to: body.to.trim().toLowerCase(),
    subject: body.subject.trim(),
    text: body.text,
    scheduledAt: scheduledAt.toISOString(),
    designContent,
  }), "utf8").digest("hex");
  if (clientRequestId) {
    const { data: existing, error: existingError } = await ctx.admin.from("scheduled_email_messages")
      .select("id, to_address, subject, body_text, design_content_json, scheduled_at, status, created_at, updated_at, request_fingerprint")
      .eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("user_id", ctx.user.id)
      .eq("client_request_id", clientRequestId).maybeSingle();
    if (existingError) return json({ error: "The previous schedule request could not be checked safely." }, 503);
    if (existing) {
      if (existing.request_fingerprint !== requestFingerprint) return json({ error: "This request key was already used for different scheduled email content." }, 409);
      const { design_content_json, request_fingerprint: _requestFingerprint, ...scheduled } = existing;
      return json({ ok: true, duplicate: true, scheduled: { ...scheduled, is_designed: Boolean(design_content_json) } });
    }
  }

  let designBrandProfile: EmailDesignBrandProfile | null = null;
  let scheduledText = body.text as string;
  if (designContent) {
    if (!provider || provider.status !== "connected" || !domain.sending_enabled || !domain.provider_domain_id) {
      return json({ error: "Designed emails require a connected workspace Resend account and a verified sending-enabled domain." }, 409);
    }
    const { data: brandRow, error: brandError } = await ctx.admin.from("organization_brand_profiles")
      .select("brand_name, logo_url, primary_color, accent_color, background_color, text_color, font_family, website_url, phone, address, default_footer_text, social_links")
      .eq("organization_id", organizationId).maybeSingle();
    if (brandError) return json({ error: "The workspace brand profile could not be loaded." }, 503);
    designBrandProfile = brandRow ? {
      brandName: brandRow.brand_name,
      logoUrl: brandRow.logo_url,
      primaryColor: brandRow.primary_color,
      accentColor: brandRow.accent_color,
      backgroundColor: brandRow.background_color,
      textColor: brandRow.text_color,
      fontFamily: brandRow.font_family,
      websiteUrl: brandRow.website_url,
      phone: brandRow.phone,
      address: brandRow.address,
      footerText: brandRow.default_footer_text,
      socialLinks: brandRow.social_links,
    } as EmailDesignBrandProfile : {};
    const rendered = renderEmailDesign(designContent, designBrandProfile);
    if (!rendered.text.trim() || rendered.text.length > 80000) {
      return json({ error: "The designed email needs a useful plain-text alternative under 80 KB." }, 400);
    }
    if (rendered.html.length > 1000000) {
      return json({ error: "The generated designed email is too large. Reduce its text or imagery before scheduling." }, 413);
    }
    scheduledText = rendered.text;
  }

  const { data, error } = await ctx.admin.from("scheduled_email_messages").insert({
    organization_id: organizationId, mailbox_id: mailboxId, user_id: ctx.user.id,
    to_address: body.to.trim().toLowerCase(), subject: body.subject.trim(), body_text: scheduledText,
    design_content_json: designContent, design_brand_profile_json: designBrandProfile,
    client_request_id: clientRequestId, request_fingerprint: clientRequestId ? requestFingerprint : null,
    scheduled_at: scheduledAt.toISOString(), status: "scheduled",
  }).select("id, to_address, subject, body_text, design_content_json, scheduled_at, status, created_at, updated_at").single();
  if (error || !data) {
    if (error?.code === "23505" && clientRequestId) {
      const { data: existing } = await ctx.admin.from("scheduled_email_messages")
        .select("id, to_address, subject, body_text, design_content_json, scheduled_at, status, created_at, updated_at, request_fingerprint")
        .eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("user_id", ctx.user.id)
        .eq("client_request_id", clientRequestId).maybeSingle();
      if (existing?.request_fingerprint === requestFingerprint) {
        const { design_content_json, request_fingerprint: _requestFingerprint, ...scheduled } = existing;
        return json({ ok: true, duplicate: true, scheduled: { ...scheduled, is_designed: Boolean(design_content_json) } });
      }
      if (existing) return json({ error: "This request key was already used for different scheduled email content." }, 409);
    }
    return json({ error: "The message could not be scheduled. Confirm the Scheduled migration is available." }, 503);
  }
  const { design_content_json, ...scheduled } = data;
  return json({ ok: true, scheduled: { ...scheduled, is_designed: Boolean(design_content_json) } }, 201);
}
export async function PATCH(request: NextRequest) {
  if (!originAllowed(request)) return json({ error: "Cross-origin request rejected." }, 403);
  let p: unknown;
  try { p = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
  if (!p || typeof p !== "object") return json({ error: "Invalid request." }, 400);
  const body = p as Record<string, unknown>;
  const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";
  const mailboxId = typeof body.mailboxId === "string" ? body.mailboxId : "";
  const id = typeof body.id === "string" ? body.id : "";
  const ctx = await context(organizationId, mailboxId);
  if ("response" in ctx) return ctx.response;
  if (!UUID.test(id)) return json({ error: "Invalid scheduled message ID." }, 400);
  if (body.action === "send_now") {
    const { data, error } = await ctx.admin.from("scheduled_email_messages")
      .update({ scheduled_at: new Date().toISOString(), last_error_code: null })
      .eq("id", id).eq("organization_id", organizationId).eq("mailbox_id", mailboxId)
      .eq("user_id", ctx.user.id).eq("status", "scheduled")
      .select("id, scheduled_at, status").maybeSingle();
    if (error) return json({ error: "The scheduled email could not be queued for immediate delivery." }, 503);
    if (!data) return json({ error: "This message is no longer pending; refresh Scheduled." }, 409);
    return json({ ok: true, scheduled: data });
  }
  if (body.action === "claim_send_now") {
    const { data, error } = await ctx.admin.from("scheduled_email_messages").update({ status: "processing", locked_at: new Date().toISOString(), last_error_code: null })
      .eq("id", id).eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("user_id", ctx.user.id).eq("status", "scheduled")
      .select("id, to_address, subject, body_text").maybeSingle();
    if (error) return json({ error: "Scheduled message could not be claimed." }, 503);
    if (!data) return json({ error: "This message is no longer pending; refresh Scheduled." }, 409);
    return json({ ok: true, scheduled: data });
  }
  if (body.action === "complete_send_now") {
    const messageId = typeof body.messageId === "string" && UUID.test(body.messageId) ? body.messageId : "";
    if (!messageId) return json({ error: "Invalid sent message reference." }, 400);
    const { data: sentMessage, error: sentError } = await ctx.admin.from("email_messages").select("id, status, provider_message_id, idempotency_key")
      .eq("id", messageId).eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("direction", "outbound").maybeSingle();
    if (sentError) return json({ error: "Sent message could not be verified." }, 503);
    if (!sentMessage || sentMessage.idempotency_key !== "scheduled-" + id || !["accepted", "delivered", "delayed"].includes(sentMessage.status)) return json({ error: "The email has not been confirmed as accepted for this scheduled item." }, 409);
    const { data, error } = await ctx.admin.from("scheduled_email_messages").update({
      status: "accepted", locked_at: null, sent_message_id: sentMessage.id, provider_message_id: sentMessage.provider_message_id, last_error_code: null,
    }).eq("id", id).eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("user_id", ctx.user.id).eq("status", "processing")
      .select("id").maybeSingle();
    if (error) return json({ error: "Email was accepted, but its scheduled status could not be updated. Refresh Scheduled before retrying." }, 503);
    if (!data) return json({ error: "Email was accepted; refresh Scheduled to confirm its final status." }, 409);
    return json({ ok: true });
  }
  if (body.action === "release_send_now") {
    const { error } = await ctx.admin.from("scheduled_email_messages").update({ status: "scheduled", locked_at: null, last_error_code: null })
      .eq("id", id).eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("user_id", ctx.user.id).eq("status", "processing");
    if (error) return json({ error: "The scheduled message remains processing; refresh before retrying." }, 503);
    return json({ ok: true });
  }
  if (body.action === "cancel") {
    const { data, error } = await ctx.admin.from("scheduled_email_messages").update({ status: "cancelled", locked_at: null })
      .eq("id", id).eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("user_id", ctx.user.id).eq("status", "scheduled")
      .select("id").maybeSingle();
    if (error) return json({ error: "Scheduled message could not be cancelled." }, 503);
    if (!data) return json({ error: "This message is no longer scheduled or has already started processing." }, 409);
    return json({ ok: true });
  }
  if (body.action === "reschedule") {
    if (typeof body.scheduledAt !== "string" || !Number.isFinite(Date.parse(body.scheduledAt))) return json({ error: "Choose a valid scheduled time." }, 400);
    const time = Date.parse(body.scheduledAt);
    if (time < Date.now() + 60_000 || time > Date.now() + 366 * 24 * 60 * 60 * 1000) return json({ error: "Choose a time between one minute and one year from now." }, 400);
    const { data, error } = await ctx.admin.from("scheduled_email_messages").update({ scheduled_at: new Date(time).toISOString(), status: "scheduled", last_error_code: null, locked_at: null })
      .eq("id", id).eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("user_id", ctx.user.id).in("status", ["scheduled", "failed"])
      .select("id, scheduled_at, status").maybeSingle();
    if (error) return json({ error: "Scheduled message could not be rescheduled." }, 503);
    if (!data) return json({ error: "This message cannot be rescheduled because it is already processing or sent." }, 409);
    return json({ ok: true, scheduled: data });
  }
  return json({ error: "Unsupported scheduled message action." }, 400);
}
export async function DELETE(request: NextRequest) {
  if (!originAllowed(request)) return json({ error: "Cross-origin request rejected." }, 403);
  const organizationId = request.nextUrl.searchParams.get("organizationId") || "";
  const mailboxId = request.nextUrl.searchParams.get("mailboxId") || "";
  const id = request.nextUrl.searchParams.get("id") || "";
  const ctx = await context(organizationId, mailboxId);
  if ("response" in ctx) return ctx.response;
  if (!UUID.test(id)) return json({ error: "Invalid scheduled message ID." }, 400);
  const { data, error } = await ctx.admin.from("scheduled_email_messages").delete().eq("id", id).eq("organization_id", organizationId)
    .eq("mailbox_id", mailboxId).eq("user_id", ctx.user.id).in("status", ["scheduled", "failed"]).select("id").maybeSingle();
  if (error) return json({ error: "Scheduled message could not be deleted." }, 503);
  if (!data) return json({ error: "Only pending or failed scheduled messages can be deleted." }, 409);
  return json({ ok: true });
}
