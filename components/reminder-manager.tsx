"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import styles from "./reminder-manager.module.css";

type ReminderStatus = "pending" | "completed" | "dismissed";
type ReminderMessage = {
  id: string;
  mailbox_id: string;
  direction: "inbound" | "outbound";
  subject: string;
  from_address: string;
  to_addresses: string[];
};
type Reminder = {
  id: string;
  organization_id: string;
  mailbox_id: string;
  message_id: string;
  reminder_at: string;
  note: string;
  status: ReminderStatus;
  completed_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
  message: ReminderMessage | null;
  message_view: "Inbox" | "Sent" | "Archive" | "Trash" | "Spam" | "Snoozed";
};
type ApiPayload = { ok?: boolean; error?: string; reminders?: Reminder[]; reminder?: Reminder };
type ReminderTab = ReminderStatus;

function localDateTimeInput(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
    "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function relativeLabel(value: string, now: number): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "Date unavailable";
  const delta = time - now;
  if (delta <= 0) return "Due now";
  const minutes = Math.ceil(delta / 60_000);
  if (minutes < 60) return "Due in " + minutes + (minutes === 1 ? " minute" : " minutes");
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return "Due in " + hours + (hours === 1 ? " hour" : " hours");
  const days = Math.ceil(hours / 24);
  return "Due in " + days + (days === 1 ? " day" : " days");
}

function defaultReminderTime(): string {
  return localDateTimeInput(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
}

export default function ReminderManager({ organizationId }: { organizationId: string }) {
  const endpoint = "/api/organizations/" + organizationId + "/reminders";
  const base = "/dashboard/" + organizationId;
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [tab, setTab] = useState<ReminderTab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState(() => defaultReminderTime());
  const [rescheduleNote, setRescheduleNote] = useState("");
  const [rescheduleBounds] = useState(() => ({
    min: localDateTimeInput(new Date(Date.now() + 60_000).toISOString()),
    max: localDateTimeInput(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()),
  }));
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    void fetch(endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as ApiPayload;
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Reminders could not be loaded.");
        if (active) {
          setReminders(payload.reminders ?? []);
          setLoadError("");
        }
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof Error && error.name === "AbortError")) return;
        setLoadError(error instanceof Error ? error.message : "Reminders could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      controller.abort();
    };
  }, [endpoint, refreshVersion]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function updateReminder(reminder: Reminder, action: "complete" | "dismiss" | "reschedule", details?: { reminderAt: string; note: string }) {
    if (busyId) return;
    setBusyId(reminder.id);
    setFormError("");
    setNotice("");
    try {
      const response = await fetch(endpoint + "/" + reminder.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reschedule"
          ? { action, reminderAt: details?.reminderAt, note: details?.note ?? "" }
          : { action }),
      });
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "The reminder could not be updated.");
      setReschedulingId(null);
      setNotice(action === "complete" ? "Reminder marked complete." : action === "dismiss" ? "Reminder dismissed." : "Reminder rescheduled.");
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The reminder could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

  function startReschedule(reminder: Reminder) {
    setReschedulingId(reminder.id);
    setRescheduleAt(Date.parse(reminder.reminder_at) > Date.now()
      ? localDateTimeInput(reminder.reminder_at)
      : defaultReminderTime());
    setRescheduleNote(reminder.note);
    setFormError("");
    setNotice("");
  }

  function submitReschedule(event: FormEvent<HTMLFormElement>, reminder: Reminder) {
    event.preventDefault();
    const parsedDate = Date.parse(rescheduleAt);
    if (!rescheduleAt || !Number.isFinite(parsedDate) || parsedDate <= Date.now()) {
      setFormError("Choose a future date and time.");
      return;
    }
    void updateReminder(reminder, "reschedule", { reminderAt: new Date(parsedDate).toISOString(), note: rescheduleNote });
  }

  const counts = {
    pending: reminders.filter((reminder) => reminder.status === "pending").length,
    completed: reminders.filter((reminder) => reminder.status === "completed").length,
    dismissed: reminders.filter((reminder) => reminder.status === "dismissed").length,
  };
  const visibleReminders = reminders.filter((reminder) => reminder.status === tab);

  return (
    <div className={styles.page}>
      <header className="mail-topbar">
        <div className="mail-breadcrumb">
          <Link href={base + "/mail"}>Workspace</Link>
          <span className="mail-breadcrumb-slash">/</span>
          <strong>Reminders</strong>
        </div>
        <div className="mail-topbar-right">
          <Link href={base + "/settings"} className="mail-topbar-profile-link" aria-label="Open workspace settings" title="Workspace settings">
            <span className="mail-user-avatar" aria-hidden="true">⚙</span>
          </Link>
        </div>
      </header>

      <div className={styles.content}>
        <header className={styles.heading}>
          <div>
            <p className={styles.kicker}>WORKSPACE · PRODUCTIVITY</p>
            <h1>Follow-up reminders</h1>
            <p className={styles.description}>Set a time to return to an important message, keep your next step attached to the conversation, and mark it done when you have followed up.</p>
          </div>
          <Link className={styles.secondaryButton} href={base + "/mail"}>Open inbox <span aria-hidden="true">↗</span></Link>
        </header>

        <section className={styles.overview} aria-label="Reminder summary">
          <div className={styles.overviewItem}>
            <span>Upcoming and due</span><strong>{counts.pending}</strong>
          </div>
          <div className={styles.overviewItem}>
            <span>Completed</span><strong>{counts.completed}</strong>
          </div>
          <div className={styles.overviewItem}>
            <span>Dismissed</span><strong>{counts.dismissed}</strong>
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="reminder-list-heading">
          <header className={styles.panelHeader}>
            <div>
              <h2 id="reminder-list-heading">Your reminders</h2>
              <p>Personal to you in this workspace; due times follow your device's local time.</p>
            </div>
          </header>

          <nav className={styles.tabs} aria-label="Filter reminders">
            {([
              ["pending", "Upcoming & due"],
              ["completed", "Completed"],
              ["dismissed", "Dismissed"],
            ] as const).map(([value, label]) => (
              <button key={value} type="button" className={tab === value ? styles.tabActive : styles.tab}
                aria-pressed={tab === value} onClick={() => { setTab(value); setFormError(""); }}>
                {label}<span>{counts[value]}</span>
              </button>
            ))}
          </nav>

          {notice && <p className={styles.notice} role="status">{notice}</p>}
          {loadError && <div className={styles.stateError} role="alert"><strong>Reminders could not load.</strong><p>{loadError}</p><button className={styles.secondaryButton} type="button" onClick={() => setRefreshVersion((current) => current + 1)}>Try again</button></div>}
          {formError && <p className={styles.error} role="alert">{formError}</p>}

          {loading ? (
            <p className={styles.stateMessage}>Loading reminders…</p>
          ) : !loadError && visibleReminders.length === 0 ? (
            <div className={styles.emptyState}>
              <span aria-hidden="true">◴</span>
              <strong>{tab === "pending" ? "Nothing to follow up on yet" : tab === "completed" ? "No completed reminders yet" : "No dismissed reminders"}</strong>
              <p>{tab === "pending" ? "Open a message in Inbox or Sent and choose “Remind me” to keep a follow-up attached to it." : "Reminders in this section will appear here."}</p>
              {tab === "pending" && <Link className={styles.primaryButton} href={base + "/mail"}>Open Inbox</Link>}
            </div>
          ) : (
            <div className={styles.list}>
              {visibleReminders.map((reminder) => {
                const due = reminder.status === "pending" && Date.parse(reminder.reminder_at) <= now;
                const busy = busyId === reminder.id;
                return (
                  <article className={styles.reminder} key={reminder.id}>
                    <div className={styles.reminderMain}>
                      <div className={styles.reminderEyebrow}>
                        <span className={due ? styles.dueBadge : styles.statusBadge}>
                          {due ? "Due now" : reminder.status === "pending" ? "Upcoming" : reminder.status === "completed" ? "Completed" : "Dismissed"}
                        </span>
                        <time dateTime={reminder.reminder_at}>{formatDateTime(reminder.reminder_at)}</time>
                      </div>
                      <h3>{reminder.message?.subject?.trim() || "(No subject)"}</h3>
                      <p className={styles.sourceLine}>
                        {reminder.message ? (reminder.message.direction === "outbound" ? "To " + (reminder.message.to_addresses ?? []).join(", ") : "From " + reminder.message.from_address) : "Source message is no longer available"}
                      </p>
                      {reminder.note && <p className={styles.note}>{reminder.note}</p>}
                      {reminder.status === "pending" && <p className={styles.relative}>{relativeLabel(reminder.reminder_at, now)}</p>}
                      {reminder.message && <Link className={styles.messageLink} href={base + "/mail?view=" + encodeURIComponent(reminder.message_view) + "&messageId=" + encodeURIComponent(reminder.message_id)}>Open message <span aria-hidden="true">↗</span></Link>}
                    </div>
                    {reminder.status === "pending" && (
                      <div className={styles.actions}>
                        <button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void updateReminder(reminder, "complete")}>{busy ? "Saving…" : "Mark done"}</button>
                        <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => startReschedule(reminder)}>Reschedule</button>
                        <button className={styles.textButton} type="button" disabled={busy} onClick={() => void updateReminder(reminder, "dismiss")}>Dismiss</button>
                      </div>
                    )}
                    {reschedulingId === reminder.id && (
                      <form className={styles.rescheduleForm} onSubmit={(event) => submitReschedule(event, reminder)}>
                        <label className={styles.field}>
                          <span>Remind me at</span>
                          <input type="datetime-local" value={rescheduleAt} min={rescheduleBounds.min} max={rescheduleBounds.max}
                            onChange={(event) => setRescheduleAt(event.target.value)} required />
                        </label>
                        <label className={styles.field}>
                          <span>Note <small>Optional · up to 500 characters</small></span>
                          <textarea value={rescheduleNote} maxLength={500} rows={2}
                            onChange={(event) => setRescheduleNote(event.target.value)} placeholder="What do you need to follow up on?" />
                        </label>
                        <div className={styles.actions}>
                          <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Saving…" : "Save reminder"}</button>
                          <button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => setReschedulingId(null)}>Cancel</button>
                        </div>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <p className={styles.footnote}>This first version keeps reminders inside ABEmail. It does not send separate reminder emails or check whether someone has replied.</p>
      </div>
    </div>
  );
}
