export type ReminderStatus = "pending" | "completed" | "dismissed";

export type CreateReminderInput = {
  messageId: string;
  mailboxId: string;
  reminderAt: string;
  note: string;
};

type ParseResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REMINDER_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_NOTE_LENGTH = 500;

export function isReminderUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function parseReminderTimestamp(value: unknown, now = Date.now()): ParseResult<string> {
  if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    return { data: null, error: "Choose a valid reminder date and time." };
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= now || timestamp > now + MAX_REMINDER_MS) {
    return { data: null, error: "Choose a future reminder time within one year." };
  }

  return { data: new Date(timestamp).toISOString(), error: null };
}

function parseNote(value: unknown): ParseResult<string> {
  if (value === undefined || value === null) return { data: "", error: null };
  if (typeof value !== "string") return { data: null, error: "Reminder note must be text." };
  const note = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (note.length > MAX_NOTE_LENGTH) {
    return { data: null, error: "Reminder notes can be up to 500 characters." };
  }
  return { data: note, error: null };
}

export function parseCreateReminderInput(value: unknown): ParseResult<CreateReminderInput> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { data: null, error: "Send valid reminder details." };
  }
  const input = value as Record<string, unknown>;
  if (!isReminderUuid(input.messageId) || !isReminderUuid(input.mailboxId)) {
    return { data: null, error: "Choose a valid source message." };
  }

  const timestamp = parseReminderTimestamp(input.reminderAt);
  if (timestamp.data === null) return { data: null, error: timestamp.error ?? "Choose a valid reminder time." };
  const note = parseNote(input.note);
  if (note.error) return { data: null, error: note.error };

  return {
    data: {
      messageId: input.messageId,
      mailboxId: input.mailboxId,
      reminderAt: timestamp.data,
      note: note.data,
    },
    error: null,
  };
}

export function parseReminderUpdateInput(value: unknown): ParseResult<
  | { action: "complete" }
  | { action: "dismiss" }
  | { action: "reschedule"; reminderAt: string; note?: string }
> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { data: null, error: "Send a valid reminder action." };
  }
  const input = value as Record<string, unknown>;

  if (input.action === "complete" || input.action === "dismiss") {
    return { data: { action: input.action }, error: null };
  }
  if (input.action !== "reschedule") {
    return { data: null, error: "Choose complete, dismiss, or reschedule." };
  }

  const timestamp = parseReminderTimestamp(input.reminderAt);
  if (timestamp.data === null) return { data: null, error: timestamp.error ?? "Choose a valid reminder time." };
  const parsed: { action: "reschedule"; reminderAt: string; note?: string } = {
    action: "reschedule",
    reminderAt: timestamp.data,
  };
  if (input.note !== undefined) {
    const note = parseNote(input.note);
    if (note.error) return { data: null, error: note.error };
    parsed.note = note.data;
  }

  return { data: parsed, error: null };
}
