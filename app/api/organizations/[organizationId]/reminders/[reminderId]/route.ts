import { NextResponse } from "next/server";
import { getOrganizationRequestContext } from "@/lib/organizations/request-context";
import { isReminderUuid, parseReminderUpdateInput } from "@/lib/reminders/validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ organizationId: string; reminderId: string }> };
const REMINDER_FIELDS = "id, organization_id, mailbox_id, message_id, user_id, reminder_at, note, status, completed_at, dismissed_at, created_at, updated_at";

export async function PATCH(request: Request, { params }: RouteContext) {
  const { organizationId, reminderId } = await params;
  if (!isReminderUuid(reminderId)) {
    return NextResponse.json({ ok: false, error: "Invalid reminder." }, { status: 400 });
  }

  const context = await getOrganizationRequestContext(organizationId, "reminders");
  if ("response" in context) return context.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Send a valid JSON request." }, { status: 400 });
  }

  const parsed = parseReminderUpdateInput(body);
  if (parsed.error || !parsed.data) {
    return NextResponse.json({ ok: false, error: parsed.error ?? "Reminder action is invalid." }, { status: 400 });
  }

  const { data: existing, error: lookupError } = await context.supabase
    .from("email_message_reminders")
    .select("id, status")
    .eq("id", reminderId)
    .eq("organization_id", organizationId)
    .eq("user_id", context.user.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ ok: false, error: "The reminder could not be verified." }, { status: 503 });
  }
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Reminder not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const patch = parsed.data.action === "complete"
    ? { status: "completed", completed_at: now, dismissed_at: null }
    : parsed.data.action === "dismiss"
      ? { status: "dismissed", completed_at: null, dismissed_at: now }
      : {
          status: "pending",
          reminder_at: parsed.data.reminderAt,
          ...(parsed.data.note === undefined ? {} : { note: parsed.data.note }),
          completed_at: null,
          dismissed_at: null,
        };

  const { data: reminder, error } = await context.supabase
    .from("email_message_reminders")
    .update(patch)
    .eq("id", reminderId)
    .eq("organization_id", organizationId)
    .eq("user_id", context.user.id)
    .select(REMINDER_FIELDS)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: "The reminder could not be updated." }, { status: 503 });
  }
  if (!reminder) {
    return NextResponse.json({ ok: false, error: "Reminder not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, reminder });
}
