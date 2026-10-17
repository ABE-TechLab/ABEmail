"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PilotSetupButton from "@/components/pilot-setup-button";
import SignOutButton from "@/components/auth/sign-out-button";
import WorkspaceSidebar, { type MailboxView } from "@/components/workspace-sidebar";
import styles from "./live-mailbox.module.css";
import workspaceStyles from "./workspace-home.module.css";

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

function messageDate(message: EmailMessage): string {
  const value = message.received_at ?? message.sent_at ?? message.created_at;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function LiveMailbox(props: LiveMailboxProps) {
  const { organizationId, organizationName, mailboxes, messages, allowPilotSetup, messagesError, activeView = "Inbox" } = props;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [mailboxId, setMailboxId] = useState(mailboxes[0]?.id ?? "");
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

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice("");
    const stableRequestKey = requestKey ?? crypto.randomUUID();
    setRequestKey(stableRequestKey);
    try {
      const response = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": stableRequestKey },
        body: JSON.stringify({ organizationId, mailboxId, to: to.trim(), subject: subject.trim(), text: body }),
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

  return (
    <div className={"mail-app " + workspaceStyles.app}>
      <WorkspaceSidebar
        activeView={activeView}
        mailboxBaseHref={"/dashboard/" + organizationId + "/mail"}
        activeMailboxView={activeView as MailboxView}
        enabledMailboxViews={["Inbox", "Sent"]}
        disabledMailFeatures={!mailboxes.length}
        disableContacts
        onCompose={() => { setComposeOpen(true); setNotice(""); }}
        homeHref={"/dashboard/" + organizationId + "/mail"}
        workspaceName={organizationName}
        workspaceDescription="Live Ottawa pilot"
        workspaceHref="/dashboard"
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
            <Link href="/settings" className={workspaceStyles.topbarLink}>Settings</Link>
            <Link href="/settings/account" className={workspaceStyles.topbarLink}>Account</Link>
            <SignOutButton className="auth-signout-control" />
          </div>
        </header>
        <div className={workspaceStyles.content}>
          <div className={styles.page}>
            <header className={styles.header}>
              <div>
                <p className={styles.eyebrow}>OTTAWA SNOW MATCH · LIVE MAIL</p>
                <h1>{activeView}</h1>
                <p className={styles.subtitle}>
                  {organizationName} · {activeView === "Inbox" ? "Received messages" : "Messages sent from the pilot mailbox"}
                </p>
              </div>
              <div className={styles.headerActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => router.refresh()}>Refresh inbox</button>
                <button type="button" className={styles.primaryButton} onClick={() => { setComposeOpen(true); setNotice(""); }} disabled={!mailboxId}>＋ Compose</button>
              </div>
            </header>

      {allowPilotSetup && mailboxes.length === 0 && (
        <section className={styles.setupCard}>
          <h2>Connect the pilot mailbox</h2>
          <p>ABEmail verifies the domain with Resend before creating the pilot mailbox.</p>
          <PilotSetupButton />
        </section>
      )}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {messagesError && <div className={styles.warning} role="alert">The mail database is unavailable in this deployment. Inbox reads are disabled until the pilot migration is applied.</div>}

      {!mailboxes.length ? (
        <section className={styles.emptyState}>
          <h2>No active mailbox is assigned</h2>
          <p>An owner or administrator needs to finish pilot setup before this inbox can receive mail.</p>
          <Link href={"/dashboard/" + organizationId}>Return to workspace</Link>
        </section>
      ) : (
        <div className={styles.layout}>
          <section className={styles.listPanel} aria-label="Message list">
            <div className={styles.listHeader}>
              <label><span>Mailbox</span>
                <select value={mailboxId} onChange={(event) => { setMailboxId(event.target.value); setSelectedMessageId(""); }}>
                  {mailboxes.map((mailbox) => <option key={mailbox.id} value={mailbox.id}>{mailbox.display_name || mailbox.address} · {mailbox.address}</option>)}
                </select>
              </label>
              <span>{visibleMessages.length} messages</span>
            </div>
            <div className={styles.messages}>
              {visibleMessages.map((message) => (
                <button key={message.id} type="button" className={selectedMessage?.id === message.id ? styles.messageRowSelected : styles.messageRow} onClick={() => setSelectedMessageId(message.id)}>
                  <span className={styles.direction}>{message.direction === "inbound" ? "↓ Received" : "↑ Sent"}</span>
                  <strong>{message.subject || "(no subject)"}</strong>
                  <span>{message.direction === "inbound" ? "From: " + message.from_address : "To: " + message.to_addresses.join(", ")}</span>
                  <small>{messageDate(message)}</small><em>{message.status}</em>
                </button>
              ))}
              {!visibleMessages.length && <div className={styles.emptyList}><strong>Your inbox is empty</strong><p>Incoming mail appears after the signed Resend webhook is configured.</p></div>}
            </div>
          </section>

          <section className={styles.detailPanel} aria-label="Message content">
            {selectedMessage ? (
              <>
                <div className={styles.detailHeader}>
                  <span className={styles.status}>{selectedMessage.status}</span>
                  <h2>{selectedMessage.subject || "(no subject)"}</h2>
                  <p><strong>From</strong> {selectedMessage.from_address}</p>
                  <p><strong>To</strong> {selectedMessage.to_addresses.join(", ")}</p>
                  <time>{messageDate(selectedMessage)}</time>
                </div>
                <div className={styles.body}>{plainText(selectedMessage) || "(This message has no text body.)"}</div>
              </>
            ) : <div className={styles.detailEmpty}><span aria-hidden="true">✉</span><h2>Select a message</h2><p>Choose a message or compose a test email.</p></div>}
          </section>
        </div>
      )}

      {composeOpen && (
        <div className={styles.modalBackdrop}>
          <section className={styles.composeModal} role="dialog" aria-modal="true" aria-labelledby="compose-title">
            <header><h2 id="compose-title">New pilot message</h2><button type="button" onClick={() => setComposeOpen(false)} aria-label="Close compose">×</button></header>
            <p className={styles.senderLine}>From {mailboxes.find((mailbox) => mailbox.id === mailboxId)?.address ?? "pilot mailbox"}</p>
            <form onSubmit={submitMessage}>
              <label>To<input type="email" required maxLength={320} value={to} onChange={(event) => { setTo(event.target.value); setRequestKey(null); }} placeholder="Approved test recipient" /></label>
              <label>Subject<input required maxLength={998} value={subject} onChange={(event) => { setSubject(event.target.value); setRequestKey(null); }} placeholder="Test email from ABEmail" /></label>
              <label>Message<textarea required maxLength={80000} rows={8} value={body} onChange={(event) => { setBody(event.target.value); setRequestKey(null); }} placeholder="Write your test message…" /></label>
              <p className={styles.composeHelp}>One recipient, plain text only. Pilot sends are limited to 25 messages per workspace per 24 hours.</p>
              <footer><button type="button" className={styles.secondaryButton} onClick={() => setComposeOpen(false)} disabled={busy}>Cancel</button><button type="submit" className={styles.primaryButton} disabled={busy || !mailboxId}>{busy ? "Sending…" : "Send test email"}</button></footer>
            </form>
          </section>
        </div>
      )}
          </div>
        </div>
      </main>
    </div>
  );
}
