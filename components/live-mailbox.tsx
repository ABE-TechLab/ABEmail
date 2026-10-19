"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import WorkspaceSidebar, { type MailboxView, type WorkspaceChoice } from "@/components/workspace-sidebar";
import AppearanceToggle from "@/components/appearance-toggle";
import styles from "./live-mailbox.module.css";
import workspaceStyles from "./workspace-home.module.css";

const COMPACT_MESSAGE_LIST_KEY = "abemail:compact-message-list";
const WORKSPACE_SETTINGS_KEY = "abemail:workspace-settings:";
type MailPreferences = { timezone: string; language: string; font: string; signature: string; replyStyle: string; compactMessageList: boolean };
const DEFAULT_MAIL_PREFERENCES: MailPreferences = { timezone: "Africa/Lagos", language: "en", font: "sans", signature: "", replyStyle: "reply", compactMessageList: false };

type Mailbox = { id: string; address: string; display_name: string | null; canManage: boolean };
type ActiveMailboxView = "Inbox" | "Sent" | "Starred" | "Drafts" | "Archive" | "Trash" | "Spam";
type LifecycleAction = "mark_read" | "mark_unread" | "star" | "unstar" | "archive" | "unarchive" | "trash" | "restore" | "spam" | "not_spam" | "permanent_delete";
type EmailDraft = { id: string; to_address: string; subject: string; body_text: string; created_at: string; updated_at: string };
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
  is_read: boolean;
  is_starred: boolean;
  archived_at: string | null;
  trashed_at: string | null;
  spam_at: string | null;
};
type LiveMailboxProps = {
  organizationId: string;
  organizationName: string;
  userEmail: string;
  mailboxes: Mailbox[];
  messages: EmailMessage[];
  messagesError: boolean;
  activeView?: ActiveMailboxView;
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
  const { organizationId, organizationName, userEmail, mailboxes, messages, messagesError, activeView = "Inbox", workspaces } = props;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [compactMessageList, setCompactMessageList] = useState(false);
  const [mailPreferences, setMailPreferences] = useState<MailPreferences>(DEFAULT_MAIL_PREFERENCES);
  const [emailConnectionState, setEmailConnectionState] = useState<"checking" | "connected" | "not_connected" | "unavailable">("checking");
  const [mailboxId, setMailboxId] = useState(mailboxes[0]?.id ?? "");
  const composeBodyRef = useRef<HTMLTextAreaElement>(null);
  const composeCursorPosition = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void fetch("/api/organizations/" + organizationId + "/resend", { cache: "no-store" })
        .then(async (response) => {
          const result = await response.json() as { connected?: boolean; environmentManaged?: boolean };
          if (!active) return;
          setEmailConnectionState(response.ok && (result.connected || result.environmentManaged) ? "connected" : response.ok ? "not_connected" : "unavailable");
        })
        .catch(() => {
          if (active) setEmailConnectionState("unavailable");
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [organizationId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      let localPreferences: Partial<MailPreferences> = {};
      try {
        const stored = window.localStorage.getItem(WORKSPACE_SETTINGS_KEY + organizationId);
        if (stored) localPreferences = JSON.parse(stored) as Partial<MailPreferences>;
      } catch {
        // Browser storage is a fallback only.
      }

      let loaded: MailPreferences = { ...DEFAULT_MAIL_PREFERENCES, ...localPreferences };
      try {
        const response = await fetch("/api/organizations/" + organizationId + "/preferences", { cache: "no-store" });
        if (response.ok) {
          const result = await response.json() as { preferences?: Partial<MailPreferences> };
          const saved = result.preferences ?? {};
          if (Object.keys(saved).length > 0) {
            loaded = { ...DEFAULT_MAIL_PREFERENCES, ...saved };
          } else if (Object.keys(localPreferences).length > 0) {
            await fetch("/api/organizations/" + organizationId + "/preferences", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(loaded),
            });
          }
        }
      } catch {
        // Keep local preferences if the backend is briefly unavailable.
      }

      if (!active) return;
      setMailPreferences(loaded);
      setCompactMessageList(loaded.compactMessageList);
      try {
        window.localStorage.setItem(WORKSPACE_SETTINGS_KEY + organizationId, JSON.stringify(loaded));
        window.localStorage.setItem(COMPACT_MESSAGE_LIST_KEY, String(loaded.compactMessageList));
      } catch {
        // The preferences are already in React state.
      }
    })();

    return () => { active = false; };
  }, [organizationId]);

  const [selectedMessageId, setSelectedMessageId] = useState("");
  const [selection, setSelection] = useState<{ context: string; ids: string[] }>({
    context: activeView + ":" + (mailboxes[0]?.id ?? ""),
    ids: [],
  });
  const selectionContext = activeView + ":" + mailboxId;
  const selectedMessageIds = selection.context === selectionContext ? selection.ids : [];
  function setSelectedMessageIds(next: string[] | ((current: string[]) => string[])) {
    setSelection((current) => ({
      context: selectionContext,
      ids: typeof next === "function"
        ? next(current.context === selectionContext ? current.ids : [])
        : next,
    }));
  }
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const draftSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const draftSaveTimer = useRef<number | null>(null);
  const draftMutationVersion = useRef(0);
  const draftIdRef = useRef<string | null>(null);
  const draftUpdatedAtRef = useRef<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const returnToListOnMobile = () => {
      if (media.matches) setMobileDetailOpen(false);
    };
    media.addEventListener("change", returnToListOnMobile);
    return () => media.removeEventListener("change", returnToListOnMobile);
  }, []);

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

  useEffect(() => {
    if (activeView !== "Drafts" || !mailboxId) return;
    let active = true;
    void fetch("/api/mail/drafts?organizationId=" + encodeURIComponent(organizationId) + "&mailboxId=" + encodeURIComponent(mailboxId), { cache: "no-store" })
      .then(async (response) => { const result = await response.json() as { drafts?: EmailDraft[]; error?: string }; if (!response.ok) throw new Error(result.error || "Drafts could not be loaded."); if (active) setDrafts(result.drafts ?? []); })
      .catch((error: unknown) => { if (active) setNotice(error instanceof Error ? error.message : "Drafts could not be loaded."); });
    return () => { active = false; };
  }, [activeView, mailboxId, organizationId]);



  const visibleMessages = useMemo(() => {
    const term = query.trim().toLowerCase();
    return messages.filter((message) => {
      if (message.mailbox_id !== mailboxId) return false;
      const inTrash = Boolean(message.trashed_at);
      const inSpam = Boolean(message.spam_at);
      const inArchive = Boolean(message.archived_at);
      const inFolder = activeView === "Inbox"
        ? message.direction === "inbound" && !inTrash && !inSpam && !inArchive
        : activeView === "Sent"
          ? message.direction === "outbound" && !inTrash && !inSpam
          : activeView === "Starred"
            ? message.is_starred && !inTrash && !inSpam
            : activeView === "Archive"
              ? inArchive && !inTrash && !inSpam
              : activeView === "Trash"
                ? inTrash
                : inSpam && !inTrash;
      if (!inFolder) return false;
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
  const selectedMessage = visibleMessages.find((message) => message.id === selectedMessageId);
  const selectedMailbox = mailboxes.find((mailbox) => mailbox.id === mailboxId);
  const sentFromSelectedMailbox = messages.some((message) => message.mailbox_id === mailboxId && message.direction === "outbound");
  const receivedBySelectedMailbox = messages.some((message) => message.mailbox_id === mailboxId && message.direction === "inbound");
  const firstEmailChecksComplete = sentFromSelectedMailbox && receivedBySelectedMailbox;

  async function runLifecycle(messageIds: string[], action: LifecycleAction) {
    const ids = [...new Set(messageIds)];
    if (!ids.length || ids.length > 100 || lifecycleBusy || !mailboxId) return;
    setLifecycleBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/mail/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, mailboxId, messageIds: ids, action }),
      });
      const result = await response.json() as { ok?: boolean; affected?: number; error?: string };
      if (!response.ok || !result.ok) {
        setNotice(result.error || "The message state could not be updated.");
        return;
      }
      setSelectedMessageIds((current) => current.filter((id) => !ids.includes(id)));
      const affected = Number.isFinite(result.affected) ? Number(result.affected) : ids.length;
      setNotice(affected + " message" + (affected === 1 ? "" : "s") + " updated.");
      router.refresh();
    } catch {
      setNotice("The connection was interrupted. Refresh the mailbox to confirm the saved message state.");
    } finally {
      setLifecycleBusy(false);
    }
  }

  const persistDraftSnapshot = useCallback(async (toValue: string, subjectValue: string, bodyValue: string, version: number): Promise<boolean> => {
    const payload = {
      organizationId,
      mailboxId,
      id: draftIdRef.current,
      expectedUpdatedAt: draftUpdatedAtRef.current,
      to: toValue,
      subject: subjectValue,
      text: bodyValue,
    };
    const response = await fetch("/api/mail/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json() as { ok?: boolean; draft?: EmailDraft; error?: string; conflict?: boolean };
    if (!response.ok || !result.ok || !result.draft) {
      if (version === draftMutationVersion.current) setNotice(result.error || "Draft could not be saved.");
      return false;
    }
    draftIdRef.current = result.draft.id;
    draftUpdatedAtRef.current = result.draft.updated_at;
    if (version === draftMutationVersion.current) {
      setDraftId(result.draft.id);
      setDrafts((current) => [result.draft!, ...current.filter((item) => item.id !== result.draft!.id)]);
    }
    return true;
  }, [organizationId, mailboxId]);

  const queueDraftSnapshot = useCallback((toValue: string, subjectValue: string, bodyValue: string, version: number): Promise<boolean> => {
    let saved = false;
    draftSaveQueue.current = draftSaveQueue.current
      .then(async () => {
        saved = await persistDraftSnapshot(toValue, subjectValue, bodyValue, version);
      })
      .catch(() => {
        if (version === draftMutationVersion.current) setNotice("Draft save failed. Keep this window open and try again.");
        saved = false;
      });
    return draftSaveQueue.current.then(() => saved);
  }, [persistDraftSnapshot]);

  useEffect(() => {
    if (!composeOpen || !mailboxId || (!draftIdRef.current && !to.trim() && !subject.trim() && !body.trim())) return;
    const version = ++draftMutationVersion.current;
    const timer = window.setTimeout(() => {
      draftSaveTimer.current = null;
      setDraftSaving(true);
      void queueDraftSnapshot(to, subject, body, version).finally(() => {
        if (version === draftMutationVersion.current) setDraftSaving(false);
      });
    }, 650);
    draftSaveTimer.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (draftSaveTimer.current === timer) draftSaveTimer.current = null;
    };
  }, [composeOpen, organizationId, mailboxId, to, subject, body]);

  

  function resetComposerAfterClose() {
    setComposeOpen(false);
    setTo("");
    setSubject("");
    setBody("");
    draftIdRef.current = null;
    draftUpdatedAtRef.current = null;
    setDraftId(null);
    setRequestKey(null);
  }

  async function closeComposer() {
    if (busy) return;
    if (draftSaveTimer.current !== null) {
      window.clearTimeout(draftSaveTimer.current);
      draftSaveTimer.current = null;
    }

    const shouldSave = Boolean(mailboxId && (draftIdRef.current || to.trim() || subject.trim() || body.trim()));
    if (shouldSave) {
      const version = ++draftMutationVersion.current;
      setDraftSaving(true);
      const saved = await queueDraftSnapshot(to, subject, body, version);
      setDraftSaving(false);
      // Draft persistence is best-effort for dismissal: a failed or unavailable
      // drafts table must never trap the user inside the compose modal.
      if (!saved || version !== draftMutationVersion.current) {
        setNotice("Composer closed, but this draft could not be saved. Your latest changes may not be stored.");
      }
    } else {
      draftMutationVersion.current += 1;
    }
    resetComposerAfterClose();
  }

  function openCompose() {
    draftIdRef.current = null;
    draftUpdatedAtRef.current = null;
    setDraftId(null);
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

      // Stop the debounce and wait for an already-started save before deleting this draft.
      // A successful send must not leave a stale draft behind.
      draftMutationVersion.current += 1;
      if (draftSaveTimer.current !== null) {
        window.clearTimeout(draftSaveTimer.current);
        draftSaveTimer.current = null;
      }
      await draftSaveQueue.current;
      let finalNotice = result.note || "Resend accepted the message. Delivery updates will appear after the signed webhook arrives.";
      const savedDraftId = draftIdRef.current;
      if (savedDraftId) {
        try {
          const deleteResponse = await fetch("/api/mail/drafts?organizationId=" + encodeURIComponent(organizationId) + "&mailboxId=" + encodeURIComponent(mailboxId) + "&id=" + encodeURIComponent(savedDraftId), { method: "DELETE" });
          const deleteResult = await deleteResponse.json() as { ok?: boolean; error?: string };
          if (deleteResponse.ok && deleteResult.ok) {
            setDrafts((current) => current.filter((item) => item.id !== savedDraftId));
          } else {
            finalNotice += " The message was sent, but its saved draft could not be removed; delete it from Drafts.";
          }
        } catch {
          finalNotice += " The message was sent, but its saved draft could not be removed; delete it from Drafts.";
        }
      }
      setNotice(finalNotice);
      resetComposerAfterClose();
      setDraftSaving(false);
      router.refresh();
    } catch {
      setNotice("The connection was interrupted. Retry the same unchanged message; ABEmail will reuse its idempotency key.");
    } finally {
      setBusy(false);
    }
  }

  function openDraft(draft: EmailDraft) {
    draftIdRef.current = draft.id;
    draftUpdatedAtRef.current = draft.updated_at;
    setDraftId(draft.id);
    setTo(draft.to_address);
    setSubject(draft.subject);
    setBody(draft.body_text);
    setRequestKey(null);
    setNotice("");
    setComposeOpen(true);
    composeCursorPosition.current = draft.body_text.length;
  }

  async function deleteDraft(draft: EmailDraft) {
    const response = await fetch("/api/mail/drafts?organizationId=" + encodeURIComponent(organizationId) + "&mailboxId=" + encodeURIComponent(mailboxId) + "&id=" + encodeURIComponent(draft.id), { method: "DELETE" });
    const result = await response.json() as { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) { setNotice(result.error || "Draft could not be deleted."); return; }
    setDrafts((current) => current.filter((item) => item.id !== draft.id));
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
    <div className={"mail-app mailbox-live-app " + workspaceStyles.app + (compactMessageList ? " " + workspaceStyles.compactList : "")}>
      <WorkspaceSidebar
        activeView={activeView}
        mailboxBaseHref={"/dashboard/" + organizationId + "/mail"}
        activeMailboxView={activeView as MailboxView}
        enabledMailboxViews={["Inbox", "Sent", "Starred", "Drafts", "Archive", "Trash", "Spam"]}
        disabledMailFeatures={!mailboxes.length}
        disableContacts
        onCompose={openCompose}
        homeHref={"/dashboard/" + organizationId + "/mail"}
        workspaceBaseHref={"/dashboard/" + organizationId}
        workspaceName={organizationName}
        workspaceDescription="Business workspace"
        workspaces={workspaces}
        activeWorkspaceId={organizationId}
      />
      <button type="button" className="mail-mobile-compose-fab" onClick={openCompose} aria-label="Compose a new message" title="Compose a new message">+</button>
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
              placeholder={activeView === "Sent" ? "Search sent mail" : "Search " + activeView.toLowerCase()}
              aria-label={"Search " + activeView.toLowerCase()}
            />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>×</button>}
            {!query && <kbd>Search</kbd>}
          </label>
          <div className={"mail-topbar-right " + workspaceStyles.topbarActions}>
            <AppearanceToggle />
            <span className={styles.livePill + (emailConnectionState === "connected" ? "" : " " + styles.livePillUnavailable)} role="status" aria-live="polite">
              <span />
              {emailConnectionState === "connected" ? "Live email" : emailConnectionState === "checking" ? "Checking email" : emailConnectionState === "not_connected" ? "Email not connected" : "Email status unavailable"}
            </span>
            <Link href={"/dashboard/" + organizationId + "/settings"} className="mail-topbar-profile-link" aria-label="Open profile and general settings" title={userEmail + " · General settings"}>
              <span className="mail-user-avatar">{userEmail.split("@")[0].slice(0, 2).toUpperCase() || "U"}</span>
            </Link>
          </div>
        </header>
        {!mailboxes.length ? (
          <section className={styles.setupCard}>
            <h2>Finish email setup for this workspace</h2>
            <p>Connect a Resend account, add a domain, publish the requested DNS records and verify both sending and receiving before creating a mailbox.</p>
            <div className={styles.headerActions}>
              <Link className={styles.primaryButton} href={"/dashboard/" + organizationId + "/settings/mail"}>Connect Resend</Link>
              <Link className={styles.secondaryButton} href={"/dashboard/" + organizationId + "/settings/domains"}>Set up a domain</Link>
            </div>
          </section>
        ) : (
          <div className={"mail-content-layout" + (selectedMessage ? " message-selected" : "") + (mobileDetailOpen ? " mobile-detail-open" : "")}>
            <section className="mail-list-pane" aria-label={activeView + " messages"}>
              {notice && <p className={styles.notice} role="status">{notice}</p>}
              {messagesError && <div className={styles.warning} role="alert">The mail database could not be read in this deployment. Refresh the page or contact an administrator.</div>}
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
                    onChange={(event) => { setMailboxId(event.target.value); setSelectedMessageId(""); setMobileDetailOpen(false); }}
                    aria-label="Select mailbox"
                  >
                    {mailboxes.map((mailbox) => (
                      <option key={mailbox.id} value={mailbox.id}>{mailbox.display_name || mailbox.address}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mail-list-toolbar">
                <span className="mail-toolbar-label">{activeView === "Inbox" ? "Received" : activeView === "Sent" ? "Sent by this mailbox" : "Personal " + activeView.toLowerCase() + " view"}</span>
                {visibleMessages.length > 0 && (
                  <label className={styles.selectVisibleLabel}>
                    <input
                      type="checkbox"
                      checked={visibleMessages.length > 0 && visibleMessages.every((message) => selectedMessageIds.includes(message.id))}
                      onChange={(event) => setSelectedMessageIds(event.target.checked ? visibleMessages.map((message) => message.id) : [])}
                      aria-label="Select all visible messages"
                    />
                    <span>Select visible</span>
                  </label>
                )}
                <span className="mail-toolbar-spacer" />
                <button type="button" className="mail-toolbar-button" onClick={() => router.refresh()} aria-label="Refresh messages">↻</button>
              </div>
              {selectedMessageIds.length > 0 && (
                <div className={styles.bulkActions} role="group" aria-label="Bulk message actions">
                  <strong>{selectedMessageIds.length} selected</strong>
                  <button type="button" className={styles.secondaryButton} disabled={lifecycleBusy} onClick={() => void runLifecycle(selectedMessageIds, "mark_read")}>Mark read</button>
                  <button type="button" className={styles.secondaryButton} disabled={lifecycleBusy} onClick={() => void runLifecycle(selectedMessageIds, "mark_unread")}>Mark unread</button>
                  {activeView === "Trash" ? (
                    <>
                      <button type="button" className={styles.secondaryButton} disabled={lifecycleBusy} onClick={() => void runLifecycle(selectedMessageIds, "restore")}>Restore</button>
                      {selectedMailbox?.canManage && <button type="button" className={styles.dangerButton} disabled={lifecycleBusy} onClick={() => void runLifecycle(selectedMessageIds, "permanent_delete")}>Delete permanently</button>}
                    </>
                  ) : activeView === "Spam" ? (
                    <button type="button" className={styles.secondaryButton} disabled={lifecycleBusy} onClick={() => void runLifecycle(selectedMessageIds, "not_spam")}>Not spam</button>
                  ) : (
                    <>
                      {activeView === "Archive"
                        ? <button type="button" className={styles.secondaryButton} disabled={lifecycleBusy} onClick={() => void runLifecycle(selectedMessageIds, "unarchive")}>Unarchive</button>
                        : <button type="button" className={styles.secondaryButton} disabled={lifecycleBusy} onClick={() => void runLifecycle(selectedMessageIds, "archive")}>Archive</button>}
                      {activeView === "Inbox" && <button type="button" className={styles.secondaryButton} disabled={lifecycleBusy} onClick={() => void runLifecycle(selectedMessageIds, "spam")}>Mark spam</button>}
                      <button type="button" className={styles.secondaryButton} disabled={lifecycleBusy} onClick={() => void runLifecycle(selectedMessageIds, "trash")}>Trash</button>
                    </>
                  )}
                </div>
              )}
              <div className="mail-message-list">
                {selectedMailbox && !firstEmailChecksComplete && (activeView === "Inbox" || activeView === "Sent") && (
                  <section className={styles.firstEmailChecklist} aria-labelledby="first-email-heading">
            <div className={styles.firstEmailHeading}>
              <div>
                <p className="mail-overline">DELIVERY CHECK</p>
                <h2 id="first-email-heading">Test your business email</h2>
                <p>Confirm both directions work from <strong>{selectedMailbox.address}</strong>.</p>
              </div>
              <span className={styles.firstEmailProgress}>{Number(sentFromSelectedMailbox) + Number(receivedBySelectedMailbox)} of 2 checks complete</span>
            </div>
            <div className={styles.firstEmailSteps}>
              <div className={styles.firstEmailStep}>
                <span className={sentFromSelectedMailbox ? styles.firstEmailStepNumber + " " + styles.firstEmailDone : styles.firstEmailStepNumber}>{sentFromSelectedMailbox ? "✓" : "1"}</span>
                <div className={styles.firstEmailStepCopy}>
                  <strong>{sentFromSelectedMailbox ? "Test email sent" : "Send your first test email"}</strong>
                  <p>{sentFromSelectedMailbox ? "An outbound message is recorded for this mailbox." : "Send a message to an inbox you can check, such as your personal Gmail or Outlook."}</p>
                </div>
                {!sentFromSelectedMailbox && <button type="button" className={styles.primaryButton} onClick={openCompose}>Compose test email</button>}
              </div>
              <div className={styles.firstEmailStep}>
                <span className={receivedBySelectedMailbox ? styles.firstEmailStepNumber + " " + styles.firstEmailDone : styles.firstEmailStepNumber}>{receivedBySelectedMailbox ? "✓" : "2"}</span>
                <div className={styles.firstEmailStepCopy}>
                  <strong>{receivedBySelectedMailbox ? "Incoming email received" : "Receive a test email"}</strong>
                  <p>{receivedBySelectedMailbox ? "An inbound message is recorded for this mailbox." : "From a separate email account, send a message to " + selectedMailbox.address + ". Then refresh this inbox to confirm it arrives."}</p>
                </div>
                {!receivedBySelectedMailbox && <button type="button" className={styles.secondaryButton} onClick={() => router.refresh()}>Refresh inbox</button>}
              </div>
            </div>
            <p className={styles.firstEmailFootnote}>A sent status confirms Resend accepted a message; delivery events update its status separately. Check the recipient inbox and send a reply to verify both directions.</p>
                  </section>
                )}
                {activeView === "Drafts" && drafts.map((draft) => (
                  <article className="mail-message-row" key={draft.id}>
                    <button className="mail-message-open" type="button" onClick={() => openDraft(draft)} aria-label={"Edit draft " + (draft.subject || "no subject")}>
                      <span className="mail-avatar tone-slate">✎</span><span className="mail-message-copy"><span className="mail-message-row-top"><strong>{draft.to_address || "Draft recipient"}</strong><time>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(draft.updated_at))}</time></span><span className="mail-message-subject">{draft.subject || "(no subject)"}</span><span className="mail-message-preview">{draft.body_text.replace(/\s+/g, " ").slice(0, 120) || "No message text yet."}</span></span>
                    </button><div className={styles.rowActions}><button type="button" className="mail-toolbar-button" onClick={() => void deleteDraft(draft)} aria-label="Delete draft" title="Delete draft">⌫</button></div>
                  </article>
                ))}
                {visibleMessages.map((message) => (
                  <article className={selectedMessage?.id === message.id ? "mail-message-row selected" : "mail-message-row"} key={message.id}>
                    <input
                      className={styles.messageSelect}
                      type="checkbox"
                      checked={selectedMessageIds.includes(message.id)}
                      onChange={(event) => setSelectedMessageIds((current) => event.target.checked ? [...new Set([...current, message.id])] : current.filter((id) => id !== message.id))}
                      aria-label={"Select " + (message.subject || "message")}
                    />
                    <button
                      className="mail-message-open"
                      onClick={() => {
                        setSelectedMessageId(message.id);
                        setMobileDetailOpen(true);
                        if (!message.is_read) void runLifecycle([message.id], "mark_read");
                      }}
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
                    <div className={styles.rowActions} role="group" aria-label="Message actions">
                      <button type="button" className="mail-toolbar-button" disabled={lifecycleBusy} onClick={() => void runLifecycle([message.id], message.is_starred ? "unstar" : "star")} aria-label={message.is_starred ? "Remove star" : "Star message"} title={message.is_starred ? "Remove star" : "Star message"}>{message.is_starred ? "★" : "☆"}</button>
                      {activeView === "Trash" ? (
                        <>
                          <button type="button" className="mail-toolbar-button" disabled={lifecycleBusy} onClick={() => void runLifecycle([message.id], "restore")} aria-label="Restore message" title="Restore">↶</button>
                          {selectedMailbox?.canManage && <button type="button" className="mail-toolbar-button" disabled={lifecycleBusy} onClick={() => void runLifecycle([message.id], "permanent_delete")} aria-label="Delete permanently" title="Delete permanently">×</button>}
                        </>
                      ) : activeView === "Spam" ? (
                        <button type="button" className="mail-toolbar-button" disabled={lifecycleBusy} onClick={() => void runLifecycle([message.id], "not_spam")} aria-label="Mark as not spam" title="Not spam">✓</button>
                      ) : (
                        <>
                          <button type="button" className="mail-toolbar-button" disabled={lifecycleBusy} onClick={() => void runLifecycle([message.id], activeView === "Archive" ? "unarchive" : "archive")} aria-label={activeView === "Archive" ? "Unarchive message" : "Archive message"} title={activeView === "Archive" ? "Unarchive" : "Archive"}>{activeView === "Archive" ? "↩" : "▱"}</button>
                          {activeView === "Inbox" && message.direction === "inbound" && <button type="button" className="mail-toolbar-button" disabled={lifecycleBusy} onClick={() => void runLifecycle([message.id], "spam")} aria-label="Mark as spam" title="Mark spam">⊘</button>}
                          <button type="button" className="mail-toolbar-button" disabled={lifecycleBusy} onClick={() => void runLifecycle([message.id], "trash")} aria-label="Move to Trash" title="Trash">⌫</button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
                {activeView === "Drafts" && !drafts.length && (
                  <div className="mail-empty-list"><span>▧</span><strong>No drafts yet</strong><p>Unfinished messages are saved here automatically while you compose.</p><button type="button" onClick={openCompose}>Compose a draft</button></div>
                )}
                {activeView !== "Drafts" && !visibleMessages.length && (
                  <div className="mail-empty-list">
                    <span>{activeView === "Inbox" ? "▤" : activeView === "Sent" ? "↗" : activeView === "Starred" ? "☆" : activeView === "Archive" ? "▱" : activeView === "Trash" ? "⌫" : "⊘"}</span>
                    <strong>{query ? "No matching messages" : "No messages in " + activeView}</strong>
                    <p>{query ? "Try another search term." : activeView === "Inbox" ? "New incoming messages will appear here." : activeView === "Sent" ? "Messages you send from this mailbox will appear here." : "Messages in this personal " + activeView.toLowerCase() + " view will appear here."}</p>
                    {activeView === "Inbox" && !query && <button type="button" onClick={openCompose}>Compose a message</button>}
                  </div>
                )}
              </div>
            </section>

            <section className="mail-detail-pane" aria-label="Message details">
              {selectedMessage ? (
                <div className="mail-message-detail">
                  <div className="mail-detail-actions">
                    <button type="button" className="mail-mobile-back" onClick={() => setMobileDetailOpen(false)}>← Inbox</button>
                    <span className={styles.messageStatus}>{selectedMessage.status}</span>
                    <div className="mail-detail-action-group">
                      {selectedMessage.direction === "inbound" && <button type="button" className="mail-reader-reply" onClick={() => replyTo(selectedMessage)}>Reply <span aria-hidden="true">↶</span></button>}
                      <button type="button" className="mail-toolbar-button" onClick={() => router.refresh()} aria-label="Refresh message">↻</button>
                    </div>
                  </div>
                  <div className="mail-detail-scroll">
                    <div className="mail-reader-heading">
                      <p className="mail-overline">{selectedMessage.direction === "inbound" ? "INCOMING MESSAGE" : "SENT MESSAGE"}</p>
                      <div className="mail-subject-line">
                        <h2>{selectedMessage.subject || "(no subject)"}</h2>
                        <span className="mail-direction-pill">{selectedMessage.direction === "inbound" ? "Inbox" : "Sent"}</span>
                      </div>
                    </div>
                    <div className="mail-message-meta mail-reader-meta">
                      <span className="mail-avatar mail-reader-avatar tone-slate">{initials(selectedMessage.direction === "inbound" ? selectedMessage.from_address : organizationName)}</span>
                      <div className="mail-sender-info">
                        <strong>{selectedMessage.direction === "inbound" ? selectedMessage.from_address : organizationName}</strong>
                        <span>To {selectedMessage.to_addresses.join(", ")}</span>
                        <small>{selectedMessage.direction === "inbound" ? "Received by" : "Sent from"} {selectedMailbox?.address ?? ""}</small>
                      </div>
                      <time>{messageDate(selectedMessage, mailPreferences.timezone, mailPreferences.language)}</time>
                    </div>
                    <div className="mail-message-body-card">
                      <div className="mail-message-body">
                        {plainText(selectedMessage).split("\n").map((line, index) => (
                          line
                            ? <p key={index}>{line}</p>
                            : <div key={index} className="mail-body-spacer" />
                        ))}
                      </div>
                    </div>
                    {selectedMessage.direction === "inbound" && (
                      <div className="mail-reply-actions">
                        <button type="button" className="mail-primary-action" onClick={() => replyTo(selectedMessage)}>↶ Reply</button>
                      </div>
                    )}
                    <p className="mail-demo-footnote"><span className="mail-demo-dot" /> Message status: {selectedMessage.status} · {selectedMessage.direction === "inbound" ? "Received" : "Sent"} {messageDate(selectedMessage, mailPreferences.timezone, mailPreferences.language)}</p>
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
          <div className="mail-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) void closeComposer(); }}>
            <section className="mail-compose-modal" role="dialog" aria-modal="true" aria-labelledby="compose-title">
              <header className="mail-compose-header">
                <h2 id="compose-title">{draftId ? "Edit draft" : "New message"}</h2>
                <button type="button" onClick={() => void closeComposer()} aria-label="Close compose" disabled={busy}>×</button>
              </header>
              <form onSubmit={submitMessage}>
                <label className="mail-compose-field"><span>To</span><input type="email" required maxLength={320} disabled={busy} value={to} onChange={(event) => { setTo(event.target.value); setRequestKey(null); }} placeholder="name@example.com" /></label>
                <label className="mail-compose-field"><span>Subject</span><input required maxLength={998} disabled={busy} value={subject} onChange={(event) => { setSubject(event.target.value); setRequestKey(null); }} placeholder="Add a subject" /></label>
                <label className="mail-compose-body-label">
                  <span className="mail-sr-only">Message body</span>
                  <textarea ref={composeBodyRef} required maxLength={80000} rows={8} disabled={busy} value={body} style={{ fontFamily: mailPreferences.font === "serif" ? "Georgia, serif" : mailPreferences.font === "mono" ? "ui-monospace, SFMono-Regular, Consolas, monospace" : "inherit" }} onChange={(event) => { setBody(event.target.value); setRequestKey(null); composeCursorPosition.current = null; }} placeholder="Write your message…" />
                </label>
                <p className="mail-compose-warning"><span>i</span> Plain-text email · One recipient · Workspace sending limits apply · {draftSaving ? "Saving draft…" : draftId ? "Draft saved" : "Changes save automatically"}</p>
                <footer className="mail-compose-footer">
                  <button type="submit" className="mail-primary-action" disabled={busy || !mailboxId}>{busy ? "Sending…" : "Send"} <span>↗</span></button>
                  <button type="button" className="mail-compose-discard" onClick={() => void closeComposer()} disabled={busy}>Close</button>
                </footer>
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
