import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = new Set([
  "mark_read", "mark_unread", "star", "unstar",
  "archive", "unarchive", "trash", "restore",
  "spam", "not_spam", "snooze", "unsnooze", "permanent_delete",
]);

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return json({ error: "Cross-origin request rejected." }, 403);
      }
    } catch {
      return json({ error: "Invalid request origin." }, 403);
    }
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 20000) return json({ error: "Lifecycle request is too large." }, 413);

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Sign in to manage messages." }, 401);

  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 20000) return json({ error: "Lifecycle request is too large." }, 413);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Enter valid lifecycle details." }, 400);
  }

  if (typeof payload !== "object" || payload === null) {
    return json({ error: "Enter valid lifecycle details." }, 400);
  }
  const input = payload as Record<string, unknown>;
  if (
    typeof input.organizationId !== "string" || !UUID_PATTERN.test(input.organizationId) ||
    typeof input.mailboxId !== "string" || !UUID_PATTERN.test(input.mailboxId) ||
    typeof input.action !== "string" || !ACTIONS.has(input.action) ||
    !Array.isArray(input.messageIds) ||
    input.messageIds.length < 1 || input.messageIds.length > 100 ||
    !input.messageIds.every((id) => typeof id === "string" && UUID_PATTERN.test(id)) ||
    new Set(input.messageIds).size !== input.messageIds.length
  ) {
    return json({ error: "Select between 1 and 100 unique messages and a supported action." }, 400);
  }

  let snoozedUntil: string | null = null;
  if (input.action === "snooze") {
    if (typeof input.snoozedUntil !== "string") {
      return json({ error: "Choose when the message should return to your Inbox." }, 400);
    }
    const snoozeTime = Date.parse(input.snoozedUntil);
    const now = Date.now();
    if (!Number.isFinite(snoozeTime) || snoozeTime <= now || snoozeTime > now + 365 * 24 * 60 * 60 * 1000) {
      return json({ error: "Choose a future time within the next year." }, 400);
    }
    snoozedUntil = new Date(snoozeTime).toISOString();
  } else if (input.snoozedUntil !== undefined && input.snoozedUntil !== null) {
    return json({ error: "A snooze time is only valid for the snooze action." }, 400);
  }

  const { data: affected, error } = await supabase.rpc("update_email_message_lifecycle", {
    target_organization_id: input.organizationId,
    target_mailbox_id: input.mailboxId,
    target_message_ids: input.messageIds,
    lifecycle_action: input.action,
    target_snoozed_until: snoozedUntil,
  });

  if (error) {
    if (error.code === "42501") return json({ error: "You do not have permission to perform this action on those messages." }, 403);
    if (error.code === "22023") return json({ error: error.message || "The lifecycle action is invalid for the selected messages." }, 400);
    return json({ error: "Message state could not be saved. Confirm the lifecycle migration is installed in this environment." }, 503);
  }

  return json({ ok: true, affected: Number(affected) });
}
