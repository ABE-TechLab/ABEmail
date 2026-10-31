import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MESSAGE_STATE_RELATION = "email_message_user_state_organization_id_mailbox_id_messag_fkey";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET(request: NextRequest) {
  const organizationId = request.nextUrl.searchParams.get("organizationId") || "";
  if (!UUID.test(organizationId)) return json({ error: "Invalid workspace." }, 400);

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Sign in to view mailbox counts." }, 401);

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) return json({ error: "Workspace access could not be checked." }, 503);
  if (!membership) return json({ error: "Workspace access denied." }, 403);

  const admin = createAdminClient();
  if (!admin) return json({ error: "Mailbox counts are not configured." }, 503);

  const { data: mailboxes, error: mailboxError } = await admin
    .from("mailboxes")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (mailboxError) return json({ error: "Mailbox access could not be checked." }, 503);
  const activeMailboxIds = (mailboxes ?? []).map((mailbox) => mailbox.id);
  if (!activeMailboxIds.length) {
    return json({ counts: { inboxUnread: 0, spamUnread: 0, drafts: 0, scheduled: 0 } });
  }

  let readableMailboxIds = activeMailboxIds;
  let writableMailboxIds = activeMailboxIds;

  if (membership.role !== "owner" && membership.role !== "admin") {
    const { data: grants, error: grantsError } = await admin
      .from("mailbox_memberships")
      .select("mailbox_id, can_read, can_send")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("can_read", true)
      .in("mailbox_id", activeMailboxIds);

    if (grantsError) return json({ error: "Mailbox permissions could not be checked." }, 503);
    readableMailboxIds = (grants ?? []).map((grant) => grant.mailbox_id);
    writableMailboxIds = (grants ?? []).filter((grant) => grant.can_send).map((grant) => grant.mailbox_id);
  }

  const now = new Date().toISOString();
  const emptyCount = { count: 0, error: null };

  const [unreadState, missingState, spamUnread, drafts, scheduled] = await Promise.all([
    readableMailboxIds.length
      ? admin.from("email_message_user_state")
          .select("message_id, email_messages!" + MESSAGE_STATE_RELATION + "!inner(id)", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("user_id", user.id)
          .in("mailbox_id", readableMailboxIds)
          .eq("email_messages.direction", "inbound")
          .eq("is_read", false)
          .is("archived_at", null)
          .is("trashed_at", null)
          .is("spam_at", null)
          .or("snoozed_until.is.null,snoozed_until.lte." + now)
      : Promise.resolve(emptyCount),
    readableMailboxIds.length
      ? admin.from("email_messages")
          .select("id, email_message_user_state!" + MESSAGE_STATE_RELATION + "(message_id,user_id)", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .in("mailbox_id", readableMailboxIds)
          .eq("direction", "inbound")
          .eq("email_message_user_state.user_id", user.id)
          .is("email_message_user_state.message_id", null)
      : Promise.resolve(emptyCount),
    readableMailboxIds.length
      ? admin.from("email_message_user_state")
          .select("message_id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("user_id", user.id)
          .in("mailbox_id", readableMailboxIds)
          .eq("is_read", false)
          .not("spam_at", "is", null)
          .is("trashed_at", null)
      : Promise.resolve(emptyCount),
    writableMailboxIds.length
      ? admin.from("email_drafts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("user_id", user.id)
          .in("mailbox_id", writableMailboxIds)
      : Promise.resolve(emptyCount),
    writableMailboxIds.length
      ? admin.from("scheduled_email_messages")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("user_id", user.id)
          .in("mailbox_id", writableMailboxIds)
          .in("status", ["scheduled", "processing", "failed"])
      : Promise.resolve(emptyCount),
  ]);

  const results = [unreadState, missingState, spamUnread, drafts, scheduled];
  if (results.some((result) => result.error)) {
    return json({ error: "Mailbox counts could not be loaded." }, 503);
  }

  return json({
    counts: {
      inboxUnread: Number(unreadState.count ?? 0) + Number(missingState.count ?? 0),
      spamUnread: Number(spamUnread.count ?? 0),
      drafts: Number(drafts.count ?? 0),
      scheduled: Number(scheduled.count ?? 0),
    },
  });
}
