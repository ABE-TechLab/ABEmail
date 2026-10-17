"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PilotSetupButton from "@/components/pilot-setup-button";
import SignOutButton from "@/components/auth/sign-out-button";
import WorkspaceSidebar, { type MailboxView, type WorkspaceChoice } from "@/components/workspace-sidebar";
import styles from "./live-mailbox.module.css";
import workspaceStyles from "./workspace-home.module.css";

const COMPACT_MESSAGE_LIST_KEY = "abemail:compact-message-list";
const WORKSPACE_SETTINGS_KEY = "abemail:workspace-settings:";
type MailPreferences = { timezone: string; language: string; font: string; signature: string; replyStyle: string };
const DEFAULT_MAIL_PREFERENCES: MailPreferences = { timezone: "Africa/Lagos", language: "en", font: "sans", signature: "", replyStyle: "reply" };

type Mailbox = { id: string; address: string; display_name: string | null };
type EmailMessage = {
  id: string;
  mailbox_id: string;
  direction: "inbound" | "outbound";
  from_address: string;
  to_addresses: string[];
  subject: string;
  body_text: string | null;
  body_html: string | null;
  status: string;
  created_at: string;
  received_at: string | null;
  sent_at: string | null;
};
type LiveMailboxProps = {
  organizationId: string;
  organizationName: string;
  mailboxes: Mailbox[];
  messages: EmailMessage[];
  allowPilotSetup: boolean;
  messagesError: boolean;
  activeView?: "Inbox" | "Sent";
  workspaces: WorkspaceChoice[];
};

function plainText(message: EmailMessage): string {
  if (message.body_text) return message.body_text;
  return (message.body_html ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .trim();
}

function messageDate(message: EmailMessage, timezone = "Africa/Lagos", language = "en"): string {
  const value = message.received_at ?? message.sent_at ?? message.created_at;
  const locale = language === "fr" ? "fr-FR" : language === "pt" ? "pt-PT" : "en-GB";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: timezone || undefined }).format(new Date(value));
}

function initials(value: string): string {
  const localPart = value.split("@")[0].replace(/[._+-]+/g, " ").trim();
  return localPart.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "M";
}

function messagePreview(message: EmailMessage): string {
  const value = plainText(message).replace(/\s+/g, " ").trim();
  return value.length > 120 ? value.slice(0, 117) + "…" : value || "No text preview available.";
}

export default function LiveMailbox(props: LiveMailboxProps) {
  const { organizationId, organizationName, mailboxes, messages, allowPilotSetup, messagesError, activeView = "Inbox", workspaces } = props;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [compactMessageList, setCompactMessageList] = useState(false);
  const [mailPreferences, setMailPreferences] = useState<MailPreferences>(DEFAULT_MAIL_PREFERENCES);
  const [mailboxId, setMailboxId] = useState(mailboxes[0]?.id ?? "");
  const composeBodyRef = useRef<HTMLTextAreaElement>(null);
  const composeCursorPosition = useRef<number | null>(null);

  useEffect(() => {
    try {
      setCompactMessageList(window.localStorage.getItem(COMPACT_MESSAGE_LIST_KEY) === "true");
      const stored = window.localStorage.getItem(WORKSPACE_SETTINGS_KEY + organizationId);
      if (stored) setMailPreferences({ ...DEFAULT_MAIL_PREFERENCES, ...(JSON.parse(stored) as Partial<MailPreferences>) });
    } catch {
      // Preferences remain at their defaults when browser storage is unavailable.
    }
  }, [organizationId]);

  useEffect(() => {
    if (!composeOpen || composeCursorPosition.current === null) return;
    const position = composeCursorPosition.current;
    const frame = window.requestAnimationFrame(() => {
      const textarea = composeBodyRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(position, position);
      composeCursorPosition.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [composeOpen, body]);
  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [requestKey, setRequestKey] = useState<string | null>(null);

  const visibleMessages = useMemo(() => {
    const direction = activeView === "Sent" ? "outbound" : "inbound";
    const term = query.trim().toLowerCase();
    return messages.filter((message) => {
      if (message.mailbox_id !== mailboxId || message.direction !== direction) return false;
      if (!term) return true;
      return [
        message.from_address,
        message.to_addresses.join(" "),
        message.subject,
        message.body_text ?? "",
        message.body_html ?? "",
        message.status,
      ].join(" ").toLowerCase().includes(term);
    });
  }, [messages, mailboxId, activeView, query]);
  const selectedMessage = visibleMessages.find((message) => message.id === selectedMessageId) ?? visibleMessages[0];

  function openCompose() {
    setComposeOpen(true);
    setNotice("");
    setTo("");
    setSubject("");
    setBody("");
    setRequestKey(null);
    composeCursorPosition.current = 0;
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice("");
    const stableRequestKey = requestKey ?? crypto.randomUUID();
    setRequestKey(stableRequestKey);
    try {
      const signature = mailPreferences.signature.trim();
      const finalBody = body.trimEnd() + (signature && !body.trimEnd().endsWith(signature) ? "\n\n" + signature : "");
      const response = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": stableRequestKey },
        body: JSON.stringify({ organizationId, mailboxId, to: to.trim(), subject: subject.trim(), text: finalBody }),
      });
      const result = await response.json() as { ok?: boolean; error?: string; note?: string };
      if (!response.ok || !result.ok) {
        setNotice(result.error || "The message was not accepted.");
        // A 503 may mean Resend accepted the message but the response was lost;
        // retain its idempotency key so retrying unchanged content is safe.
        if (response.status !== 503) setRequestKey(null);
        return;
      }
      setNotice(result.note || "Resend accepted the message. Delivery updates will appear after the signed webhook arrives.");
      setComposeOpen(false);
      setTo("");
      setSubject("");
      setBody("");
      setRequestKey(null);
      router.refresh();
    } catch {
      setNotice("The connection was interrupted. Retry the same unchanged message; ABEmail will reuse its idempotency key.");
    } finally {
      setBusy(false);
    }
  }

  function replyTo(message: EmailMessage) {
    if (message.direction !== "inbound") return;
    setTo(message.from_address);
    setSubject(/^re:/i.test(message.subject) ? message.subject : "Re: " + message.subject);
    const quoted = plainText(message).split("\n").map((line) => "> " + line).join("\n");
    const quoteBlock = "—\nOn " + messageDate(message, mailPreferences.timezone, mailPreferences.language) + ", " + message.from_address + " wrote:\n" + quoted;
    const initialBody = mailPreferences.replyStyle === "bottom" ? quoteBlock + "\n\n" : "\n\n" + quoteBlock;
    setRequestKey(null);
    setNotice("");
    setBody(initialBody);
    composeCursorPosition.current = mailPreferences.replyStyle === "bottom" ? initialBody.length : 0;
    setComposeOpen(true);
  }

  return (
    <div className={"mail-app " + workspaceStyles.app + (compactMessageList ? " " + workspaceStyles.compactList : "")}>
      <WorkspaceSidebar
        activeView={activeView}
        mailboxBaseHref={"/dashboard/" + organizationId + "/mail"}
        activeMailboxView={activeView as MailboxView}
        enabledMailboxViews={["Inbox", "Sent"]}
        disabledMailFeatures={!mailboxes.length}
        disableContacts
        onCompose={openCompose}
        homeHref={"/dashboard/" + organizationId + "/mail"}
        workspaceBaseHref={"/dashboard/" + organizationId}
        workspaceName={organizationName}
        workspaceDescription="Live Ottawa pilot"
        workspaces={workspaces}
        activeWorkspaceId={organizationId}
      />
      <main className="mail-main">
        <header className={"mail-topbar " + workspaceStyles.topbar}>
          <div className="mail-breadcrumb">
            <span>Workspace</span><span className="mail-breadcrumb-slash">/</span><strong>{activeView}</strong>
          </div>
          <label className="mail-search">
            <span className="mail-search-icon" aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={activeView === "Inbox" ? "Search inbox" : "Search sent mail"}
              aria-label={activeView === "Inbox" ? "Search inbox" : "Search sent mail"}
            />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>×</button>}
            {!query && <kbd>Search</kbd>}
          </label>
          <div className={"mail-topbar-right " + workspaceStyles.topbarActions}>
            <span className={styles.livePill}><span /> Live pilot</span>
            <Link href={"/dashboard/" + organizationId + "/settings"} className={workspaceStyles.topbarLink}>Settings</Link>
            <Link href={"/dashboard/" + organizationId + "/settings/security"} className={workspaceStyles.topbarLink}>Account</Link>
            <SignOutButton className="auth-signout-control" />
          </div>
        </header>
        {notice && <p className={styles.notice} role="status">{notice}</p>}
        {messagesError && <div className={styles.warning} role="alert">The mail database could not be read in this deployment. Refresh the page or contact an administrator.</div>}
        {!mailboxes.length ? (
          <section className={styles.setupCard}>
            <h2>No active mailbox is assigned</h2>
            <p>An owner or administrator needs to finish pilot setup before this inbox can receive mail.</p>
            {allowPilotSetup && <PilotSetupButton />}
          </section>
        ) : (
          <div className="mail-content-layout">
            <section className="mail-list-pane" aria-label={activeView + " messages"}>
              <div className="mail-list-heading">
                <div>
                  <p className="mail-overline">YOUR MAIL</p>
                  <h1>{activeView}</h1>
                  <p className="mail-list-subtitle">{visibleMessages.length} message{visibleMessages.length === 1 ? "" : "s"} in this view</p>
                </div>
                <label className={styles.mailboxPickerLabel}>
                  <span className="mail-sr-only">Mailbox</span>
                  <select
                    value={mailboxId}
                    onChange={(event) => { setMailboxId(event.target.value); setSelectedMessageId(""); }}
                    aria-label="Select mailbox"
                  >
                    {mailboxes.map((mailbox) => (
                      <option key={mailbox.id} value={mailbox.id}>{mailbox.display_name || mailbox.address}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mail-list-toolbar">
                <span className="mail-toolbar-label">{activeView === "Inbox" ? "Received" : "Sent by this mailbox"}</span>
                <span className="mail-toolbar-spacer" />
                <button type="button" className="mail-toolbar-button" onClick={() => router.refresh()} aria-label="Refresh messages">↻</button>
              </div>
              <div className="mail-message-list">
                {visibleMessages.map((message) => (
                  <article className={selectedMessage?.id === message.id ? "mail-message-row selected" : "mail-message-row"} key={message.id}>
                    <button
                      className="mail-message-open"
                      onClick={() => setSelectedMessageId(message.id)}
                      type="button"
                      aria-label={"Open " + (message.subject || "message")}
                    >
                      <span className="mail-avatar tone-slate">{initials(message.direction === "inbound" ? message.from_address : organizationName)}</span>
                      <span className="mail-message-copy">
                        <span className="mail-message-row-top">
                          <strong>{message.direction === "inbound" ? message.from_address : message.to_addresses.join(", ")}</strong>
                          <time>{messageDate(message, mailPreferences.timezone, mailPreferences.language)}</time>
                        </span>
                        <span className="mail-message-subject">{message.subject || "(no subject)"}</span>
                        <span className="mail-message-preview">{messagePreview(message)}</span>
                      </span>
                    </button>
                    <span className={styles.messageStatus}>{message.status}</span>
                  </article>
                ))}
                {!visibleMessages.length && (
                  <div className="mail-empty-list">
                    <span>{activeView === "Inbox" ? "▤" : "↗"}</span>
                    <strong>{query ? "No matching messages" : "No messages in " + activeView}</strong>
                    <p>{query ? "Try another search term." : activeView === "Inbox" ? "New incoming messages will appear here." : "Messages you send from this mailbox will appear here."}</p>
                    {activeView === "Inbox" && !query && <button type="button" onClick={openCompose}>Compose a message</button>}
                  </div>
                )}
              </div>
            </section>

            <section className="mail-detail-pane" aria-label="Message details">
              {selectedMessage ? (
                <div className="mail-message-detail">
                  <div className="mail-detail-actions">
                    <span className={styles.messageStatus}>{selectedMessage.status}</span>
                    <div className="mail-detail-action-group">
                      <button type="button" className="mail-toolbar-button" onClick={() => router.refresh()} aria-label="Refresh message">↻</button>
                    </div>
                  </div>
                  <div className="mail-detail-scroll">
                    <div className="mail-subject-line"><h2>{selectedMessage.subject || "(no subject)"}</h2></div>
                    <div className="mail-message-meta">
                      <span className="mail-avatar tone-slate">{initials(selectedMessage.from_address)}</span>
                      <div className="mail-sender-info">
                        <strong>{selectedMessage.from_address}</strong>
                        <span>To {selectedMessage.to_addresses.join(", ")}</span>
                      </div>
                      <time>{messageDate(selectedMessage, mailPreferences.timezone, mailPreferences.language)}</time>
                    </div>
                    <div className="mail-message-body">
                      {plainText(selectedMessage).split("\n").map((line, index) => (
                        line
                          ? <p key={index}>{line}</p>
                          : <div key={index} className="mail-body-spacer" />
                      ))}
                    </div>
                    {selectedMessage.direction === "inbound" && (
                      <div className="mail-reply-actions">
                        <button type="button" className="mail-primary-action" onClick={() => replyTo(selectedMessage)}>↶ Reply</button>
                      </div>
                    )}
                    <p className="mail-demo-footnote"><span className="mail-demo-dot" /> Live message · {selectedMessage.status}</p>
                  </div>
                </div>
              ) : (
                <div className="mail-detail-empty">
                  <span>✉</span><h2>Select a message</h2><p>Choose a message from the list to read it here.</p>
                </div>
              )}
            </section>
          </div>
        )}

        {composeOpen && (
          <div className="mail-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setComposeOpen(false); }}>
            <section className="mail-compose-modal" role="dialog" aria-modal="true" aria-labelledby="compose-title">
              <header className="mail-compose-header">
                <h2 id="compose-title">New message</h2>
                <button type="button" onClick={() => setComposeOpen(false)} aria-label="Close compose" disabled={busy}>×</button>
              </header>
              <form onSubmit={submitMessage}>
                <label className="mail-compose-field"><span>To</span><input type="email" required maxLength={320} value={to} onChange={(event) => { setTo(event.target.value); setRequestKey(null); }} placeholder="name@example.com" /></label>
                <label className="mail-compose-field"><span>Subject</span><input required maxLength={998} value={subject} onChange={(event) => { setSubject(event.target.value); setRequestKey(null); }} placeholder="Add a subject" /></label>
                <label className="mail-compose-body-label">
                  <span className="mail-sr-only">Message body</span>
                  <textarea ref={composeBodyRef} required maxLength={80000} rows={8} value={body} style={{ fontFamily: mailPreferences.font === "serif" ? "Georgia, serif" : mailPreferences.font === "mono" ? "ui-monospace, SFMono-Regular, Consolas, monospace" : "inherit" }} onChange={(event) => { setBody(event.target.value); setRequestKey(null); composeCursorPosition.current = null; }} placeholder="Write your message…" />
                </label>
                <p className="mail-compose-warning"><span>i</span> Plain-text pilot sending · One recipient · 25 messages per workspace per 24 hours</p>
                <footer className="mail-compose-footer">
                  <button type="submit" className="mail-primary-action" disabled={busy || !mailboxId}>{busy ? "Sending…" : "Send"} <span>↗</span></button>
                  <button type="button" className="mail-compose-discard" onClick={() => setComposeOpen(false)} disabled={busy}>Discard</button>
                </footer>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
