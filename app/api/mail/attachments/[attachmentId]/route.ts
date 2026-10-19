import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function attachmentHeaders(filename: string, contentType: string, size: number) {
  const ascii = filename.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_").slice(0, 180) || "attachment";
  return {
    "Content-Type": contentType || "application/octet-stream",
    "Content-Disposition": "attachment; filename=\"" + ascii + "\"; filename*=UTF-8''" + encodeURIComponent(filename),
    "Content-Length": String(size),
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };
}

export async function GET(request: NextRequest, context: { params: Promise<{ attachmentId: string }> }) {
  const { attachmentId } = await context.params;
  if (!UUID.test(attachmentId)) return json({ error: "Invalid attachment." }, 400);
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Sign in to download this attachment." }, 401);
  const { data: attachment, error } = await supabase.from("email_message_attachments")
    .select("id, organization_id, mailbox_id, message_id, filename, content_type, size_bytes, storage_path")
    .eq("id", attachmentId).not("message_id", "is", null).maybeSingle();
  if (error) return json({ error: "Attachment access could not be checked." }, 503);
  if (!attachment) return json({ error: "Attachment not found." }, 404);
  const admin = createAdminClient();
  if (!admin) return json({ error: "Mail storage is not configured." }, 503);
  const { data: file, error: downloadError } = await admin.storage.from("mail-attachments").download(attachment.storage_path);
  if (downloadError || !file) return json({ error: "Attachment content could not be downloaded." }, 503);
  const bytes = await file.arrayBuffer();
  return new Response(bytes, { status: 200, headers: attachmentHeaders(attachment.filename, attachment.content_type, attachment.size_bytes) });
}
