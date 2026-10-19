import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
async function context(request: NextRequest, organizationId: string, mailboxId: string) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: json({ error: "Sign in to manage drafts." }, 401) } as const;
  const admin = createAdminClient();
  if (!admin) return { response: json({ error: "Draft storage is not configured." }, 503) } as const;
  if (!UUID.test(organizationId) || !UUID.test(mailboxId)) return { response: json({ error: "Invalid workspace or mailbox." }, 400) } as const;
  const { data: membership, error: membershipError } = await supabase.from("organization_memberships")
    .select("role").eq("organization_id", organizationId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (membershipError) return { response: json({ error: "Workspace access could not be checked." }, 503) } as const;
  if (!membership) return { response: json({ error: "Workspace access denied." }, 403) } as const;
  const { data: mailbox, error: mailboxError } = await admin.from("mailboxes")
    .select("id, organization_id, status").eq("id", mailboxId).eq("organization_id", organizationId).maybeSingle();
  if (mailboxError) return { response: json({ error: "Mailbox access could not be checked." }, 503) } as const;
  if (!mailbox || mailbox.status !== "active") return { response: json({ error: "Mailbox is unavailable." }, 403) } as const;
  if (membership.role !== "owner" && membership.role !== "admin") {
    const { data: grant, error: grantError } = await admin.from("mailbox_memberships")
      .select("status, can_read, can_send").eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("user_id", user.id).maybeSingle();
    if (grantError) return { response: json({ error: "Mailbox permissions could not be checked." }, 503) } as const;
    if (!grant || grant.status !== "active" || !grant.can_read || !grant.can_send) return { response: json({ error: "You need read and send access to manage drafts in this mailbox." }, 403) } as const;
  }
  return { user, admin } as const;
}
export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organizationId") || "";
  const mailboxId = request.nextUrl.searchParams.get("mailboxId") || "";
  const ctx = await context(request, organizationId, mailboxId);
  if ("response" in ctx) return ctx.response;
  const { data, error } = await ctx.admin.from("email_drafts")
    .select("id, organization_id, mailbox_id, user_id, to_address, subject, body_text, created_at, updated_at")
    .eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("user_id", ctx.user.id)
    .order("updated_at", { ascending: false }).limit(100);
  if (error) return json({ error: "Drafts could not be loaded. The pending Drafts migration may not be applied in this environment." }, 503);
  return json({ drafts: data ?? [] });
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) { try { if (new URL(origin).origin !== new URL(request.url).origin) return json({ error: "Cross-origin request rejected." }, 403); } catch { return json({ error: "Invalid request origin." }, 403); } }
  let payload: unknown;
  try { const raw = await request.text(); if (raw.length > 100000) return json({ error: "Draft is too large." }, 413); payload = JSON.parse(raw); } catch { return json({ error: "Invalid draft payload." }, 400); }
  if (!payload || typeof payload !== "object") return json({ error: "Invalid draft payload." }, 400);
  const p = payload as Record<string, unknown>;
  const organizationId = typeof p.organizationId === "string" ? p.organizationId : "";
  const mailboxId = typeof p.mailboxId === "string" ? p.mailboxId : "";
  const ctx = await context(request, organizationId, mailboxId);
  if ("response" in ctx) return ctx.response;
  if (typeof p.to !== "string" || typeof p.subject !== "string" || typeof p.text !== "string" ||
      p.to.length > 320 || p.subject.length > 998 || p.text.length > 80000) return json({ error: "Draft fields exceed allowed limits." }, 400);
  const id = typeof p.id === "string" && UUID.test(p.id) ? p.id : null;
  const { data: existing, error: lookupError } = id ? await ctx.admin.from("email_drafts").select("id, updated_at")
    .eq("id", id).eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("user_id", ctx.user.id).maybeSingle() : { data: null, error: null };
  if (lookupError) return json({ error: "Draft could not be checked." }, 503);
  if (id && !existing) return json({ error: "Draft not found." }, 404);
  if (existing && typeof p.expectedUpdatedAt === "string" && existing.updated_at !== p.expectedUpdatedAt) {
    return json({ error: "This draft changed elsewhere. Reload it before saving more edits.", conflict: true }, 409);
  }
  const values = { organization_id: organizationId, mailbox_id: mailboxId, user_id: ctx.user.id,
    to_address: p.to, subject: p.subject, body_text: p.text };
  const result = existing
    ? await ctx.admin.from("email_drafts").update(values).eq("id", existing.id).eq("updated_at", existing.updated_at)
      .select("id, to_address, subject, body_text, created_at, updated_at").maybeSingle()
    : await ctx.admin.from("email_drafts").insert(values).select("id, to_address, subject, body_text, created_at, updated_at").single();
  if (result.error) return json({ error: "Draft could not be saved." }, 503);
  if (!result.data) return json({ error: "This draft changed elsewhere. Reload it before saving more edits.", conflict: true }, 409);
  return json({ ok: true, draft: result.data });
}
export async function DELETE(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) { try { if (new URL(origin).origin !== new URL(request.url).origin) return json({ error: "Cross-origin request rejected." }, 403); } catch { return json({ error: "Invalid request origin." }, 403); } }
  const organizationId = request.nextUrl.searchParams.get("organizationId") || "";
  const mailboxId = request.nextUrl.searchParams.get("mailboxId") || "";
  const id = request.nextUrl.searchParams.get("id") || "";
  const ctx = await context(request, organizationId, mailboxId);
  if ("response" in ctx) return ctx.response;
  if (!UUID.test(id)) return json({ error: "Invalid draft ID." }, 400);
  const { data, error } = await ctx.admin.from("email_drafts").delete().eq("id", id).eq("organization_id", organizationId)
    .eq("mailbox_id", mailboxId).eq("user_id", ctx.user.id).select("id").maybeSingle();
  if (error) return json({ error: "Draft could not be deleted." }, 503);
  if (!data) return json({ error: "Draft not found." }, 404);
  return json({ ok: true });
}
