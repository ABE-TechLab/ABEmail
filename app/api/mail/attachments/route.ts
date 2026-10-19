import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKET = "mail-attachments";
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_MESSAGE_BYTES = 20 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

type Permission = "can_read" | "can_send";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function originAllowed(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

async function hasMailboxPermission(admin: ReturnType<typeof createAdminClient>, userId: string, organizationId: string, mailboxId: string, permission: Permission) {
  if (!admin) return false;
  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships").select("role, status")
    .eq("organization_id", organizationId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (membershipError || !membership) return false;
  const { data: organization, error: organizationError } = await admin
    .from("organizations").select("id, status").eq("id", organizationId).maybeSingle();
  const { data: mailbox, error: mailboxError } = await admin
    .from("mailboxes").select("id, organization_id, status")
    .eq("id", mailboxId).eq("organization_id", organizationId).maybeSingle();
  if (organizationError || mailboxError || !organization || organization.status !== "active" || !mailbox || mailbox.status !== "active") return false;
  if (membership.role === "owner" || membership.role === "admin") return true;
  const { data: grant, error: grantError } = await admin
    .from("mailbox_memberships").select("status, can_read, can_send")
    .eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("user_id", userId).maybeSingle();
  if (grantError || !grant || grant.status !== "active") return false;
  return permission === "can_read" ? grant.can_read === true : grant.can_send === true;
}

function safeFilename(value: string) {
  const normalized = value.replace(/[\\/\u0000-\u001f\u007f]/g, "_").replace(/\s+/g, " ").trim();
  const clean = normalized.slice(0, 180);
  return clean && clean !== "." && clean !== ".." ? clean : "attachment";
}

function allowedFilename(value: string) {
  return !/\.(?:exe|msi|bat|cmd|com|scr|ps1|sh|bash|js|mjs|cjs|html?|svg|jar|dll|so|dylib|apk|dmg|iso|hta|vbs|wsf)$/i.test(value);
}

async function uploadPending(admin: NonNullable<ReturnType<typeof createAdminClient>>, args: {
  organizationId: string; mailboxId: string; userId: string; filename: string; contentType: string; bytes: Buffer; draftId?: string | null;
}) {
  const filename = safeFilename(args.filename);
  if (!allowedFilename(filename)) return { error: "This file type is not allowed as an email attachment." } as const;
  if (!args.bytes.length || args.bytes.length > MAX_FILE_BYTES) return { error: "Each attachment must be no larger than 4 MB." } as const;
  const storagePath = [args.organizationId, args.mailboxId, args.userId, randomUUID() + "-" + filename].join("/");
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, args.bytes, {
    contentType: args.contentType, cacheControl: "3600", upsert: false,
  });
  if (uploadError) return { error: "The attachment could not be stored securely." } as const;
  const { data, error } = await admin.from("email_message_attachments").insert({
    organization_id: args.organizationId, mailbox_id: args.mailboxId, user_id: args.userId,
    message_id: null, draft_id: args.draftId ?? null, filename, content_type: args.contentType, size_bytes: args.bytes.length,
    storage_path: storagePath, expires_at: args.draftId ? null : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }).select("id, filename, content_type, size_bytes").single();
  if (error || !data) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return { error: "Attachment metadata could not be saved." } as const;
  }
  return { attachment: data } as const;
}

export async function GET(request: NextRequest) {
  if (!originAllowed(request)) return json({ error: "Cross-origin request rejected." }, 403);
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? "";
  const mailboxId = url.searchParams.get("mailboxId") ?? "";
  const messageId = url.searchParams.get("messageId") ?? "";
  const draftId = url.searchParams.get("draftId") ?? "";
  if (!UUID.test(organizationId) || !UUID.test(mailboxId) ||
      Boolean(messageId) === Boolean(draftId) ||
      (messageId && !UUID.test(messageId)) || (draftId && !UUID.test(draftId))) {
    return json({ error: "Invalid attachment query." }, 400);
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Sign in to view attachments." }, 401);

  if (draftId) {
    const admin = createAdminClient();
    if (!admin) return json({ error: "Mail storage is not configured." }, 503);
    if (!(await hasMailboxPermission(admin, user.id, organizationId, mailboxId, "can_send"))) {
      return json({ error: "You do not have permission to manage this draft." }, 403);
    }
    const { data: draft, error: draftError } = await admin.from("email_drafts").select("id")
      .eq("id", draftId).eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("user_id", user.id).maybeSingle();
    if (draftError) return json({ error: "Draft attachment access could not be checked." }, 503);
    if (!draft) return json({ error: "Draft not found." }, 404);
    const { data, error } = await admin.from("email_message_attachments")
      .select("id, filename, content_type, size_bytes, created_at")
      .eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("draft_id", draftId).eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) return json({ error: "Draft attachments could not be loaded." }, 503);
    return json({ attachments: data ?? [] });
  }

  const { data, error } = await supabase.from("email_message_attachments")
    .select("id, filename, content_type, size_bytes, created_at")
    .eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("message_id", messageId)
    .order("created_at", { ascending: true });
  if (error) return json({ error: "Message attachments could not be loaded." }, 503);
  return json({ attachments: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return json({ error: "Cross-origin request rejected." }, 403);
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Sign in to manage attachments." }, 401);
  const admin = createAdminClient();
  if (!admin) return json({ error: "Mail storage is not configured." }, 503);

  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    let body: unknown;
    try { body = await request.json(); } catch { return json({ error: "Invalid attachment request." }, 400); }
    if (typeof body === "object" && body !== null && !Array.isArray(body) &&
        "action" in body && body.action === "attach-to-draft") {
      const input = body as Record<string, unknown>;
      const draftId = typeof input.draftId === "string" ? input.draftId : "";
      const ids = input.attachmentIds;
      if (!UUID.test(draftId) || !Array.isArray(ids) || ids.length < 1 || ids.length > MAX_ATTACHMENTS ||
          ids.some((id) => typeof id !== "string" || !UUID.test(id)) || new Set(ids).size !== ids.length) {
        return json({ error: "Invalid draft attachment request." }, 400);
      }
      if (!(await hasMailboxPermission(admin, user.id, input.organizationId as string, input.mailboxId as string, "can_send"))) {
        return json({ error: "You do not have permission to save attachments with this draft." }, 403);
      }
      const { data: draft, error: draftError } = await admin.from("email_drafts").select("id")
        .eq("id", draftId).eq("organization_id", input.organizationId).eq("mailbox_id", input.mailboxId)
        .eq("user_id", user.id).maybeSingle();
      if (draftError) return json({ error: "Draft ownership could not be checked." }, 503);
      if (!draft) return json({ error: "Draft not found." }, 404);
      const attachmentIds = ids as string[];
      const { data: rows, error: rowsError } = await admin.from("email_message_attachments")
        .select("id, draft_id, expires_at, message_id")
        .in("id", attachmentIds).eq("organization_id", input.organizationId).eq("mailbox_id", input.mailboxId).eq("user_id", user.id);
      if (rowsError) return json({ error: "Attachment ownership could not be checked." }, 503);
      if (!rows || rows.length !== attachmentIds.length || rows.some((row) =>
        row.message_id !== null ||
        (row.draft_id !== null && row.draft_id !== draftId) ||
        (row.draft_id === null && (!row.expires_at || Date.parse(row.expires_at) <= Date.now()))
      )) return json({ error: "One or more attachments expired or belong to another draft." }, 409);
      const pendingIds = rows.filter((row) => row.draft_id === null).map((row) => row.id);
      if (pendingIds.length) {
        const { data: linked, error: linkError } = await admin.from("email_message_attachments")
          .update({ draft_id: draftId, expires_at: null })
          .in("id", pendingIds).eq("organization_id", input.organizationId).eq("mailbox_id", input.mailboxId)
          .eq("user_id", user.id).is("message_id", null).is("draft_id", null).select("id");
        if (linkError || (linked?.length ?? 0) !== pendingIds.length) return json({ error: "Attachments could not be saved with this draft." }, 503);
      }
      const { data: attached, error: attachedError } = await admin.from("email_message_attachments")
        .select("id, filename, content_type, size_bytes, created_at")
        .eq("organization_id", input.organizationId).eq("mailbox_id", input.mailboxId).eq("draft_id", draftId)
        .eq("user_id", user.id).in("id", attachmentIds).order("created_at", { ascending: true });
      if (attachedError) return json({ error: "Saved draft attachments could not be loaded." }, 503);
      return json({ ok: true, attachments: attached ?? [] });
    }
    if (typeof body !== "object" || body === null || !("action" in body) || body.action !== "copy" ||
        !("organizationId" in body) || typeof body.organizationId !== "string" || !UUID.test(body.organizationId) ||
        !("mailboxId" in body) || typeof body.mailboxId !== "string" || !UUID.test(body.mailboxId) ||
        !("sourceMessageId" in body) || typeof body.sourceMessageId !== "string" || !UUID.test(body.sourceMessageId)) {
      return json({ error: "Invalid attachment-copy request." }, 400);
    }
    const organizationId = body.organizationId, mailboxId = body.mailboxId, sourceMessageId = body.sourceMessageId;
    if (!(await hasMailboxPermission(admin, user.id, organizationId, mailboxId, "can_read")) ||
        !(await hasMailboxPermission(admin, user.id, organizationId, mailboxId, "can_send"))) {
      return json({ error: "You need mailbox read and send permission to forward attachments." }, 403);
    }
    const { data: sourceMessage, error: sourceError } = await admin.from("email_messages").select("id")
      .eq("id", sourceMessageId).eq("organization_id", organizationId).eq("mailbox_id", mailboxId).maybeSingle();
    if (sourceError) return json({ error: "The source message could not be checked." }, 503);
    if (!sourceMessage) return json({ error: "The source message is not available." }, 404);
    const { data: sourceAttachments, error: attachmentsError } = await admin.from("email_message_attachments")
      .select("filename, content_type, size_bytes, storage_path")
      .eq("organization_id", organizationId).eq("mailbox_id", mailboxId).eq("message_id", sourceMessageId)
      .order("created_at", { ascending: true });
    if (attachmentsError) return json({ error: "Source attachments could not be loaded." }, 503);
    if (!sourceAttachments?.length) return json({ attachments: [] });
    const { data: pending, error: pendingError } = await admin.from("email_message_attachments")
      .select("id, size_bytes").eq("organization_id", organizationId).eq("mailbox_id", mailboxId)
      .eq("user_id", user.id).is("message_id", null).gt("expires_at", new Date().toISOString());
    if (pendingError) return json({ error: "Current attachment limits could not be checked." }, 503);
    const pendingRows = pending ?? [];
    const pendingBytes = pendingRows.reduce((sum, item) => sum + Number(item.size_bytes), 0);
    const sourceBytes = sourceAttachments.reduce((sum, item) => sum + Number(item.size_bytes), 0);
    if (pendingRows.length + sourceAttachments.length > MAX_ATTACHMENTS || pendingBytes + sourceBytes > MAX_MESSAGE_BYTES) {
      return json({ error: "Remove other attachments before forwarding this message." }, 413);
    }
    const copied: Array<{ id: string; filename: string; content_type: string; size_bytes: number }> = [];
    for (const source of sourceAttachments) {
      const { data: file, error: downloadError } = await admin.storage.from(BUCKET).download(source.storage_path);
      if (downloadError || !file) {
        await Promise.all(copied.map(async (item) => {
          const { data: row } = await admin.from("email_message_attachments").select("storage_path").eq("id", item.id).maybeSingle();
          if (row?.storage_path) await admin.storage.from(BUCKET).remove([row.storage_path]);
          await admin.from("email_message_attachments").delete().eq("id", item.id);
        }));
        return json({ error: "A source attachment could not be read." }, 503);
      }
      const result = await uploadPending(admin, {
        organizationId, mailboxId, userId: user.id, filename: source.filename,
        contentType: source.content_type || "application/octet-stream", bytes: Buffer.from(await file.arrayBuffer()),
      });
      if ("error" in result) {
        await Promise.all(copied.map(async (item) => {
          const { data: row } = await admin.from("email_message_attachments").select("storage_path").eq("id", item.id).maybeSingle();
          if (row?.storage_path) await admin.storage.from(BUCKET).remove([row.storage_path]);
          await admin.from("email_message_attachments").delete().eq("id", item.id);
        }));
        return json({ error: result.error }, 503);
      }
      copied.push(result.attachment);
    }
    return json({ attachments: copied }, 201);
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 4_500_000) return json({ error: "Each attachment must be no larger than 4 MB." }, 413);
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: "Invalid attachment upload." }, 400); }
  const organizationId = String(form.get("organizationId") ?? "");
  const mailboxId = String(form.get("mailboxId") ?? "");
  const file = form.get("file");
  if (!UUID.test(organizationId) || !UUID.test(mailboxId) || !(file instanceof File)) return json({ error: "Choose a valid file for an active mailbox." }, 400);
  if (!(await hasMailboxPermission(admin, user.id, organizationId, mailboxId, "can_send"))) return json({ error: "You do not have permission to attach files from this mailbox." }, 403);
  const filename = safeFilename(file.name);
  if (!allowedFilename(filename)) return json({ error: "This file type is not allowed as an email attachment." }, 400);
  if (file.size < 1 || file.size > MAX_FILE_BYTES) return json({ error: "Each attachment must be no larger than 4 MB." }, 413);
  const { data: pending, error: pendingError } = await admin.from("email_message_attachments")
    .select("id, size_bytes").eq("organization_id", organizationId).eq("mailbox_id", mailboxId)
    .eq("user_id", user.id).is("message_id", null).gt("expires_at", new Date().toISOString());
  if (pendingError) return json({ error: "Attachment limits could not be checked." }, 503);
  const pendingRows = pending ?? [];
  if (pendingRows.length >= MAX_ATTACHMENTS) return json({ error: "A message can contain up to five attachments." }, 413);
  if (pendingRows.reduce((sum, item) => sum + Number(item.size_bytes), 0) + file.size > MAX_MESSAGE_BYTES) return json({ error: "Attachments for one message cannot exceed 20 MB in total." }, 413);
  const contentType = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(file.type) ? file.type : "application/octet-stream";
  const uploaded = await uploadPending(admin, { organizationId, mailboxId, userId: user.id, filename, contentType, bytes: Buffer.from(await file.arrayBuffer()) });
  if ("error" in uploaded) return json({ error: uploaded.error }, 503);
  return json({ ok: true, attachment: uploaded.attachment }, 201);
}

export async function DELETE(request: NextRequest) {
  if (!originAllowed(request)) return json({ error: "Cross-origin request rejected." }, 403);
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId") ?? "";
  const mailboxId = url.searchParams.get("mailboxId") ?? "";
  const id = url.searchParams.get("id") ?? "";
  if (![organizationId, mailboxId, id].every((value) => UUID.test(value))) return json({ error: "Invalid attachment." }, 400);
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Sign in to remove attachments." }, 401);
  const admin = createAdminClient();
  if (!admin) return json({ error: "Mail storage is not configured." }, 503);
  if (!(await hasMailboxPermission(admin, user.id, organizationId, mailboxId, "can_send"))) return json({ error: "You do not have permission to remove this attachment." }, 403);
  const { data: pending, error } = await admin.from("email_message_attachments")
    .select("id, storage_path").eq("id", id).eq("organization_id", organizationId).eq("mailbox_id", mailboxId)
    .eq("user_id", user.id).is("message_id", null).maybeSingle();
  if (error) return json({ error: "Attachment could not be checked." }, 503);
  if (!pending) return json({ error: "This attachment is no longer pending." }, 404);
  const { error: removeError } = await admin.storage.from(BUCKET).remove([pending.storage_path]);
  if (removeError) return json({ error: "The attachment file could not be removed." }, 503);
  const { error: deleteError } = await admin.from("email_message_attachments").delete().eq("id", id).is("message_id", null);
  if (deleteError) return json({ error: "Attachment metadata could not be removed." }, 503);
  return json({ ok: true });
}
