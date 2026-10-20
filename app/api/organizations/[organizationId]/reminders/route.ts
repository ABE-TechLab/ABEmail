import { NextResponse } from "next/server";
import { getOrganizationRequestContext } from "@/lib/organizations/request-context";
import { parseCreateReminderInput } from "@/lib/reminders/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ organizationId: string }> };
const REMINDER_FIELDS = "id, organization_id, mailbox_id, message_id, user_id, reminder_at, note, status, completed_at, dismissed_at, created_at, updated_at";
const MESSAGE_FIELDS = "id, mailbox_id, direction, subject, from_address, to_addresses";

export async function GET(_request: Request, { params }: RouteContext) {
  const { organizationId } = await params;
  const context = await getOrganizationRequestContext(organizationId, "reminders");
  if ("response" in context) return context.response;

  const query = () => context.supabase
    .from("email_message_reminders")
    .select(REMINDER_FIELDS)
    .eq("organization_id", organizationId)
    .eq("user_id", context.user.id);

  const [pendingResult, historyResult] = await Promise.all([
    query().eq("status", "pending").order("reminder_at", { ascending: true }).limit(200),
    query().in("status", ["completed", "dismissed"]).order("updated_at", { ascending: false }).limit(100),
  ]);

  if (pendingResult.error || historyResult.error) {
    return NextResponse.json({ ok: false, error: "Reminders could not be loaded." }, { status: 503 });
  }

  const rows = [...(pendingResult.data ?? []), ...(historyResult.data ?? [])];
  const messageIds = [...new Set(rows.map((reminder) => reminder.message_id))];
  const mailboxIds = [...new Set(rows.map((reminder) => reminder.mailbox_id))];

  const [messageResult, stateResult] = messageIds.length
    ? await Promise.all([
        context.supabase
          .from("email_messages")
          .select(MESSAGE_FIELDS)
          .eq("organization_id", organizationId)
          .in("mailbox_id", mailboxIds)
          .in("id", messageIds),
        context.supabase
          .from("email_message_user_state")
          .select("message_id, is_starred, archived_at, trashed_at, spam_at, snoozed_until")
          .eq("organization_id", organizationId)
          .eq("user_id", context.user.id)
          .in("message_id", messageIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (messageResult.error || stateResult.error) {
    return NextResponse.json({ ok: false, error: "Reminder message details could not be loaded." }, { status: 503 });
  }

  const messages = new Map((messageResult.data ?? []).map((message) => [message.id, message]));
  const states = new Map((stateResult.data ?? []).map((state) => [state.message_id, state]));
  const now = Date.now();
  const reminders = rows.map((reminder) => {
    const message = messages.get(reminder.message_id) ?? null;
    const state = states.get(reminder.message_id);
    const view = state?.trashed_at
      ? "Trash"
      : state?.spam_at
        ? "Spam"
        : state?.snoozed_until && Date.parse(state.snoozed_until) > now
          ? "Snoozed"
          : state?.archived_at
            ? "Archive"
            : message?.direction === "outbound"
              ? "Sent"
              : "Inbox";

    return { ...reminder, message, message_view: view };
  });

  return NextResponse.json({ ok: true, reminders });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { organizationId } = await params;
  const context = await getOrganizationRequestContext(organizationId, "reminders");
  if ("response" in context) return context.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Send a valid JSON request." }, { status: 400 });
  }

  const parsed = parseCreateReminderInput(body);
  if (parsed.error || !parsed.data) {
    return NextResponse.json({ ok: false, error: parsed.error ?? "Reminder details are invalid." }, { status: 400 });
  }

  const { data: message, error: messageError } = await context.supabase
    .from("email_messages")
    .select("id, mailbox_id")
    .eq("organization_id", organizationId)
    .eq("mailbox_id", parsed.data.mailboxId)
    .eq("id", parsed.data.messageId)
    .maybeSingle();

  if (messageError) {
    return NextResponse.json({ ok: false, error: "The source message could not be verified." }, { status: 503 });
  }
  if (!message) {
    return NextResponse.json({ ok: false, error: "That message is not available in your mailbox." }, { status: 404 });
  }

  const { data: reminder, error } = await context.supabase
    .from("email_message_reminders")
    .insert({
      organization_id: organizationId,
      mailbox_id: message.mailbox_id,
      message_id: message.id,
      user_id: context.user.id,
      reminder_at: parsed.data.reminderAt,
      note: parsed.data.note,
    })
    .select(REMINDER_FIELDS)
    .single();

  if (error || !reminder) {
    return NextResponse.json({ ok: false, error: "The reminder could not be saved." }, { status: 503 });
  }

  return NextResponse.json({ ok: true, reminder }, { status: 201 });
}
