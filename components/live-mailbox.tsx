"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AppearanceToggle from "@/components/appearance-toggle";
import styles from "./live-mailbox.module.css";
import type { Contact } from "@/lib/contacts/types";
import workspaceStyles from "./workspace-home.module.css";
import EmailHtmlViewer from "@/components/email-html-viewer";

const COMPACT_MESSAGE_LIST_KEY = "abemail:compact-message-list";
const WORKSPACE_SETTINGS_KEY = "abemail:workspace-settings:";
type SavedSignature = { id: string; name: string; content: string };
type MailboxSignaturePreference = { enabled: boolean; defaultSignatureId: string | null; signatures: SavedSignature[] };
type SavedTemplate = { id: string; name: string; subject: string; body_text: string };
type MailPreferences = { timezone: string; language: string; font: string; signature: string; mailboxSignatures: Record<string, MailboxSignaturePreference>; replyStyle: string; compactMessageList: boolean };
const DEFAULT_MAIL_PREFERENCES: MailPreferences = { timezone: "Africa/Lagos", language: "en", font: "sans", signature: "", mailboxSignatures: {}, replyStyle: "reply", compactMessageList: false };

function availableMailboxSignatures(preferences: MailPreferences, mailboxId: string) {
  const config = preferences.mailboxSignatures[mailboxId];
  return [
    ...(preferences.signature.trim() ? [{ id: "workspace-default", name: "Workspace default", content: preferences.signature.trim() }] : []),
    ...(config?.signatures ?? []),
  ];
}

function resolveMailboxSignature(preferences: MailPreferences, mailboxId: string, selectedSignatureId: string | null): string {
  const config = preferences.mailboxSignatures[mailboxId];
  if (!config) return preferences.signature.trim();
  if (!config.enabled) return "";
  const id = selectedSignatureId ?? config.defaultSignatureId ?? "";
  if (id === "workspace-default") return preferences.signature.trim();
  if (!id) return "";
  return config.signatures.find((signature) => signature.id === id)?.content.trim() ?? "";
}

function appendSignature(body: string, signature: string): string {
  const trimmedBody = body.trimEnd();
  return signature && !trimmedBody.endsWith(signature) ? trimmedBody + "\n\n" + signature : trimmedBody;
}

type Mailbox = { id: string; address: string; display_name: string | null; canManage: boolean };
type ActiveMailboxView = "Inbox" | "Sent" | "Starred" | "Drafts" | "Scheduled" | "Snoozed" | "Archive" | "Trash" | "Spam";
const MAILBOX_VIEW_OPTIONS: readonly ActiveMailboxView[] = ["Inbox", "Sent", "Starred", "Drafts", "Scheduled", "Snoozed", "Archive", "Trash", "Spam"];
type LifecycleAction = "mark_read" | "mark_unread" | "star" | "unstar" | "archive" | "unarchive" | "trash" | "restore" | "spam" | "not_spam" | "snooze" | "unsnooze" | "permanent_delete";
type EmailDraft = { id: string; to_address: string; subject: string; body_text: string; created_at: string; updated_at: string };
type PendingAttachment = { id: string; filename: string; content_type: string; size_bytes: number };
type MessageAttachment = PendingAttachment & { created_at: string };
type ScheduledEmail = { id: string; to_address: string; subject: string; body_text: string; scheduled_at: string; status: "scheduled" | "processing" | "accepted" | "failed" | "cancelled"; attempt_count: number; last_error_code: string | null; created_at: string; updated_at: string };
type EmailMessage = {
  id: string;
  mailbox_id: string;
  direction: "inbound" | "outbound";
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  reply_to_addresses: string[];
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
  snoozed_until: string | null;
};
type LiveMailboxProps = {
  organizationId: string;
  organizationName: string;
  userEmail: string;
  mailboxes: Mailbox[];
  messages: EmailMessage[];
  messagesError: boolean;
  activeView?: ActiveMailboxView;
  initialRecipient?: string;
  initialCompose?: boolean;
  initialMessageId?: string;
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

function localDateTimeInput(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function messagePreview(message: EmailMessage): string {
  const value = plainText(message).replace(/\s+/g, " ").trim();
  return value.length > 120 ? value.slice(0, 117) + "…" : value || "No text preview available.";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function LiveMailbox(props: LiveMailboxProps) {
  const { organizationId, organizationName, userEmail, mailboxes, messages, messagesError, activeView: initialActiveView = "Inbox", initialRecipient, initialCompose = false, initialMessageId } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMailboxView = searchParams.get("view");
  const activeView = MAILBOX_VIEW_OPTIONS.includes(requestedMailboxView as ActiveMailboxView)
    ? requestedMailboxView as ActiveMailboxView
    : initialActiveView;
  const [query, setQuery] = useState("");
  const [compactMessageList, setCompactMessageList] = useState(false);
  const [mailPreferences, setMailPreferences] = useState<MailPreferences>(DEFAULT_MAIL_PREFERENCES);
  const [emailConnectionState, setEmailConnectionState] = useState<"checking" | "connected" | "not_connected" | "unavailable">("checking");
  const [mailboxId, setMailboxId] = useState(mailboxes[0]?.id ?? "");
  const composeBodyRef = useRef<HTMLTextAreaElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const composeCursorPosition = useRef<number | null>(null);
  const initialRecipientHandledRef = useRef(false);
  const initialComposeHandledRef = useRef(false);

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
  const [snoozeNow, setSnoozeNow] = useState<number>(() => Date.now());
  const [snoozePickerBounds] = useState(() => ({
    min: localDateTimeInput(new Date(Date.now() + 60_000).toISOString()),
    max: localDateTimeInput(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()),
  }));
  const [snoozeUntilInput, setSnoozeUntilInput] = useState(() => localDateTimeInput(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()));
  const [reminderFormOpen, setReminderFormOpen] = useState(false);
  const [reminderAtInput, setReminderAtInput] = useState(() => localDateTimeInput(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()));
  const [reminderNoteInput, setReminderNoteInput] = useState("");
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderPickerBounds] = useState(() => ({
    min: localDateTimeInput(new Date(Date.now() + 60_000).toISOString()),
    max: localDateTimeInput(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()),
  }));
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSignatureId, setComposeSignatureId] = useState<string | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [savedTemplatesLoading, setSavedTemplatesLoading] = useState(false);
  const [savedTemplatesError, setSavedTemplatesError] = useState("");
  const [composeTemplateId, setComposeTemplateId] = useState("");
  const [to, setTo] = useState("");
  const [contactSuggestions, setContactSuggestions] = useState<Contact[]>([]);
  const [contactSuggestionsOpen, setContactSuggestionsOpen] = useState(false);
  const [contactSuggestionsLoading, setContactSuggestionsLoading] = useState(false);
  const [activeContactSuggestionIndex, setActiveContactSuggestionIndex] = useState(0);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);
  const [messageAttachments, setMessageAttachments] = useState<MessageAttachment[]>([]);
  const [messageAttachmentsMessageId, setMessageAttachmentsMessageId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [draftsLoadedKey, setDraftsLoadedKey] = useState<string | null>(null);
  const draftsLoadedKeyRef = useRef<string | null>(null);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledEmail[]>([]);
  const [scheduledLoadedKey, setScheduledLoadedKey] = useState<string | null>(null);
  const scheduledLoadedKeyRef = useRef<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduledBusyId, setScheduledBusyId] = useState("");
  const [scheduledTimeEdits, setScheduledTimeEdits] = useState<Record<string, string>>({});
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const draftSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const draftSaveTimer = useRef<number | null>(null);
  const draftMutationVersion = useRef(0);
  const draftIdRef = useRef<string | null>(null);
  const draftUpdatedAtRef = useRef<string | null>(null);

const recipientQuery = to.split(/[;,]/).pop()?.trim() ?? "";
const mailboxDataKey = organizationId + ":" + mailboxId;
const visibleDrafts = draftsLoadedKey === mailboxDataKey ? drafts : [];
const visibleScheduledMessages = scheduledLoadedKey === mailboxDataKey ? scheduledMessages : [];
const draftsLoading = activeView === "Drafts" && Boolean(mailboxId) && draftsLoadedKey !== mailboxDataKey;
const scheduledLoading = activeView === "Scheduled" && Boolean(mailboxId) && scheduledLoadedKey !== mailboxDataKey;

  function prepareTemplatePicker() {
    setComposeTemplateId("");
    setSavedTemplatesLoading(true);
    setSavedTemplatesError("");
  }

  useEffect(() => {
    if (!initialRecipient || initialRecipientHandledRef.current) return;
    initialRecipientHandledRef.current = true;
    setTo(initialRecipient);
    prepareTemplatePicker();
    setComposeOpen(true);
    setNotice("");
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete("composeTo");
    router.replace(currentUrl.pathname + currentUrl.search, { scroll: false });
  }, [initialRecipient, router]);

  useEffect(() => {
    if (!initialCompose || initialComposeHandledRef.current) return;
    initialComposeHandledRef.current = true;
    prepareTemplatePicker();
    setComposeOpen(true);
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.delete("compose");
    router.replace(currentUrl.pathname + currentUrl.search, { scroll: false });
  }, [initialCompose, router]);

  useEffect(() => {
    if (!composeOpen || !recipientQuery) return;

    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setContactSuggestionsLoading(true);
      setContactSuggestionsOpen(true);
      void fetch("/api/organizations/" + organizationId + "/contacts?q=" + encodeURIComponent(recipientQuery), {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = await response.json() as { ok?: boolean; contacts?: Contact[] };
          if (!response.ok || !payload.ok) throw new Error("Contact lookup failed.");
          if (!active) return;
          setContactSuggestions((payload.contacts ?? []).slice(0, 8));
          setActiveContactSuggestionIndex(0);
        })
        .catch((error: unknown) => {
          if (!active || (error instanceof Error && error.name === "AbortError")) return;
          setContactSuggestions([]);
          setContactSuggestionsOpen(false);
        })
        .finally(() => {
          if (active) setContactSuggestionsLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [composeOpen, organizationId, recipientQuery]);

  useEffect(() => {
    if (!composeOpen) return;

    let active = true;
    const controller = new AbortController();
    void fetch("/api/organizations/" + organizationId + "/templates", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as { ok?: boolean; error?: string; templates?: SavedTemplate[] };
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Templates could not be loaded.");
        if (active) setSavedTemplates(payload.templates ?? []);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof Error && error.name === "AbortError")) return;
        setSavedTemplates([]);
        setSavedTemplatesError(error instanceof Error ? error.message : "Templates could not be loaded.");
      })
      .finally(() => { if (active) setSavedTemplatesLoading(false); });

    return () => {
      active = false;
      controller.abort();
    };
  }, [composeOpen, organizationId]);



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
    const dataKey = organizationId + ":" + mailboxId;
    void fetch("/api/mail/drafts?organizationId=" + encodeURIComponent(organizationId) + "&mailboxId=" + encodeURIComponent(mailboxId), { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { drafts?: EmailDraft[]; error?: string };
        if (!response.ok) throw new Error(result.error || "Drafts could not be loaded.");
        if (active) {
          setDrafts(result.drafts ?? []);
          draftsLoadedKeyRef.current = dataKey;
          setDraftsLoadedKey(dataKey);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (draftsLoadedKeyRef.current !== dataKey) setDrafts([]);
        draftsLoadedKeyRef.current = dataKey;
        setDraftsLoadedKey(dataKey);
        setNotice(error instanceof Error ? error.message : "Drafts could not be loaded.");
      });
    return () => { active = false; };
  }, [activeView, mailboxId, organizationId]);

  useEffect(() => {
    if (activeView !== "Scheduled" || !mailboxId) return;
    let active = true;
    const dataKey = organizationId + ":" + mailboxId;
    const load = () => {
      void fetch("/api/mail/scheduled?organizationId=" + encodeURIComponent(organizationId) + "&mailboxId=" + encodeURIComponent(mailboxId), { cache: "no-store" })
        .then(async (response) => {
          const result = await response.json() as { scheduled?: ScheduledEmail[]; error?: string };
          if (!response.ok) throw new Error(result.error || "Scheduled messages could not be loaded.");
          if (active) {
            setScheduledMessages(result.scheduled ?? []);
            scheduledLoadedKeyRef.current = dataKey;
            setScheduledLoadedKey(dataKey);
          }
        })
        .catch((error: unknown) => {
          if (!active) return;
          if (scheduledLoadedKeyRef.current !== dataKey) setScheduledMessages([]);
          scheduledLoadedKeyRef.current = dataKey;
          setScheduledLoadedKey(dataKey);
          setNotice(error instanceof Error ? error.message : "Scheduled messages could not be loaded.");
        });
    };
    load();
    const timer = window.setInterval(load, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [activeView, mailboxId, organizationId]);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    const scheduleNextDue = () => {
      if (!active) return;
      const now = Date.now();
      const nextDue = messages.reduce<number | null>((next, message) => {
        if (!message.snoozed_until) return next;
        const deadline = Date.parse(message.snoozed_until);
        if (!Number.isFinite(deadline) || deadline <= now) return next;
        return next === null || deadline < next ? deadline : next;
      }, null);
      if (nextDue === null) {
        timer = null;
        return;
      }
      timer = window.setTimeout(() => {
        setSnoozeNow(Date.now());
        scheduleNextDue();
      }, Math.max(0, nextDue - now + 100));
    };

    timer = window.setTimeout(() => {
      setSnoozeNow(Date.now());
      scheduleNextDue();
    }, 0);
    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [messages]);

  const visibleMessages = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (activeView === "Scheduled" || activeView === "Drafts") return [];
    return messages.filter((message) => {
      if (message.mailbox_id !== mailboxId) return false;
      const inTrash = Boolean(message.trashed_at);
      const inSpam = Boolean(message.spam_at);
      const inArchive = Boolean(message.archived_at);
      const isSnoozed = Boolean(message.snoozed_until && Date.parse(message.snoozed_until) > snoozeNow);
      const inFolder = activeView === "Snoozed"
        ? isSnoozed && !inTrash && !inSpam
        : !isSnoozed && (activeView === "Inbox"
          ? message.direction === "inbound" && !inTrash && !inSpam && !inArchive
          : activeView === "Sent"
            ? message.direction === "outbound" && !inTrash && !inSpam
            : activeView === "Starred"
              ? message.is_starred && !inTrash && !inSpam
              : activeView === "Archive"
                ? inArchive && !inTrash && !inSpam
                : activeView === "Trash"
                  ? inTrash
                  : inSpam && !inTrash);
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
  }, [messages, mailboxId, activeView, query, snoozeNow]);
  const selectedMessage = visibleMessages.find((message) => message.id === selectedMessageId);

  useEffect(() => {
    if (!initialMessageId) return;
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      const linkedMessage = messages.find((message) => message.id === initialMessageId);
      if (!linkedMessage) return;
      setMailboxId(linkedMessage.mailbox_id);
      setSelectedMessageId(linkedMessage.id);
      setMobileDetailOpen(true);
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [initialMessageId, messages]);
  const selectedMailbox = mailboxes.find((mailbox) => mailbox.id === mailboxId);

  useEffect(() => {
    const messageId = selectedMessage?.id;
    if (!messageId || !mailboxId || activeView === "Drafts" || activeView === "Scheduled") return;
    let active = true;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ organizationId, mailboxId, messageId });
      void fetch("/api/mail/attachments?" + params.toString(), { cache: "no-store" })
        .then(async (response) => {
          const result = await response.json() as { attachments?: MessageAttachment[]; error?: string };
          if (!response.ok) throw new Error(result.error || "Message attachments could not be loaded.");
          if (active) {
            setMessageAttachments(result.attachments ?? []);
            setMessageAttachmentsMessageId(messageId);
          }
        })
        .catch((error: unknown) => {
          if (active) {
            setMessageAttachments([]);
            setMessageAttachmentsMessageId(messageId);
            setNotice(error instanceof Error ? error.message : "Message attachments could not be loaded.");
          }
        });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [selectedMessage?.id, activeView, mailboxId, organizationId]);

  const messageAttachmentsLoading = Boolean(selectedMessage?.id && messageAttachmentsMessageId !== selectedMessage.id);
  const visibleMessageAttachments = messageAttachmentsMessageId === selectedMessage?.id ? messageAttachments : [];
  const sentFromSelectedMailbox = messages.some((message) => message.mailbox_id === mailboxId && message.direction === "outbound");
  const receivedBySelectedMailbox = messages.some((message) => message.mailbox_id === mailboxId && message.direction === "inbound");
  const firstEmailChecksComplete = sentFromSelectedMailbox && receivedBySelectedMailbox;

  async function saveReminder(message: EmailMessage) {
    if (reminderSaving) return;
    const deadline = Date.parse(reminderAtInput);
    if (!Number.isFinite(deadline) || deadline <= Date.now() + 1000 || deadline > Date.now() + 365 * 24 * 60 * 60 * 1000) {
      setNotice("Choose a future reminder time within the next year.");
      return;
    }

    setReminderSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/organizations/" + organizationId + "/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: message.id,
          mailboxId: message.mailbox_id,
          reminderAt: new Date(deadline).toISOString(),
          note: reminderNoteInput,
        }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setNotice(result.error || "The follow-up reminder could not be saved.");
        return;
      }
      setReminderFormOpen(false);
      setReminderNoteInput("");
      setNotice("Follow-up reminder saved.");
    } catch {
      setNotice("The follow-up reminder could not be saved. Check your connection and try again.");
    } finally {
      setReminderSaving(false);
    }
  }

  async function runLifecycle(messageIds: string[], action: LifecycleAction, snoozeValue?: string) {
    const ids = [...new Set(messageIds)];
    if (!ids.length || ids.length > 100 || lifecycleBusy || !mailboxId) return;

    let snoozedUntil: string | null = null;
    if (action === "snooze") {
      const deadline = Date.parse(snoozeValue ?? "");
      if (!Number.isFinite(deadline) || deadline <= Date.now() + 1000 || deadline > Date.now() + 365 * 24 * 60 * 60 * 1000) {
        setNotice("Choose a future snooze time within the next year.");
        return;
      }
      snoozedUntil = new Date(deadline).toISOString();
    }

    setLifecycleBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/mail/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          mailboxId,
          messageIds: ids,
          action,
          ...(action === "snooze" ? { snoozedUntil } : {}),
        }),
      });
      const result = await response.json() as { ok?: boolean; affected?: number; error?: string };
      if (!response.ok || !result.ok) {
        setNotice(result.error || "The message state could not be updated.");
        return;
      }
      setSelectedMessageIds((current) => current.filter((id) => !ids.includes(id)));
      const affected = Number.isFinite(result.affected) ? Number(result.affected) : ids.length;
      if (action === "snooze" && snoozedUntil) {
        const formatted = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: mailPreferences.timezone || undefined }).format(new Date(snoozedUntil));
        setNotice(affected + " message" + (affected === 1 ? "" : "s") + " snoozed until " + formatted + ".");
      } else if (action === "unsnooze") {
        setNotice(affected + " message" + (affected === 1 ? "" : "s") + " returned to your Inbox.");
      } else {
        setNotice(affected + " message" + (affected === 1 ? "" : "s") + " updated.");
      }
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
    const attachmentIds = pendingAttachmentsRef.current.map((attachment) => attachment.id);
    if (attachmentIds.length) {
      const attachmentResponse = await fetch("/api/mail/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attach-to-draft", organizationId, mailboxId, draftId: result.draft.id, attachmentIds }),
      });
      const attachmentResult = await attachmentResponse.json() as { ok?: boolean; attachments?: PendingAttachment[]; error?: string };
      if (!attachmentResponse.ok || !attachmentResult.ok) {
        if (version === draftMutationVersion.current) setNotice(attachmentResult.error || "Attachments could not be saved with this draft.");
        return false;
      }
      if (version === draftMutationVersion.current) {
        const nextAttachments = attachmentResult.attachments ?? [];
        setPendingAttachments((current) =>
          current.length === nextAttachments.length &&
          current.every((attachment, index) => attachment.id === nextAttachments[index]?.id)
            ? current
            : nextAttachments
        );
      }
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
    if (!composeOpen || !mailboxId || (!draftIdRef.current && !to.trim() && !subject.trim() && !body.trim() && !pendingAttachments.length)) return;
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
  }, [composeOpen, organizationId, mailboxId, to, subject, body, draftId, pendingAttachments.length, queueDraftSnapshot]);

  

  function discardPendingAttachments() {
    const pending = [...pendingAttachments];
    setPendingAttachments([]);
    if (!pending.length || !mailboxId) return;
    void Promise.all(pending.map((attachment) => fetch(
      "/api/mail/attachments?organizationId=" + encodeURIComponent(organizationId) +
      "&mailboxId=" + encodeURIComponent(mailboxId) + "&id=" + encodeURIComponent(attachment.id),
      { method: "DELETE" },
    ).catch(() => null)));
  }

  function resetComposerAfterClose(attachmentsAlreadyLinked = false) {
    setComposeTemplateId("");
    setComposeOpen(false);
    setComposeSignatureId(null);
    setContactSuggestions([]);
    setContactSuggestionsOpen(false);
    setTo("");
    setSubject("");
    setBody("");
    setScheduleMode(false);
    setScheduledAt("");
    if (attachmentsAlreadyLinked) setPendingAttachments([]);
    else discardPendingAttachments();
    draftIdRef.current = null;
    draftUpdatedAtRef.current = null;
    setDraftId(null);
    setRequestKey(null);
  }

  async function uploadSelectedFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    if (!mailboxId) { setNotice("Choose an active mailbox before attaching files."); return; }
    if (scheduleMode) { setNotice("Remove attachments before scheduling. Scheduled attachments are not supported yet."); return; }
    if (uploadingAttachments || busy) return;
    setUploadingAttachments(true);
    setNotice("");
    const existing = [...pendingAttachments];
    const added: PendingAttachment[] = [];
    let totalBytes = existing.reduce((sum, item) => sum + item.size_bytes, 0);
    try {
      if (!draftIdRef.current) {
        if (draftSaveTimer.current !== null) {
          window.clearTimeout(draftSaveTimer.current);
          draftSaveTimer.current = null;
        }
        await draftSaveQueue.current;
        const version = ++draftMutationVersion.current;
        const created = await persistDraftSnapshot(to, subject, body, version);
        if (!created || !draftIdRef.current) throw new Error("A draft could not be created for these attachments.");
        setDraftSaving(false);
      }
      for (const file of files) {
        if (existing.length + added.length >= 5) { setNotice("A message can contain up to five attachments."); break; }
        if (file.size < 1 || file.size > 4 * 1024 * 1024) {
          setNotice(file.name + " was skipped. Each file must be no larger than 4 MB.");
          continue;
        }
        if (totalBytes + file.size > 20 * 1024 * 1024) { setNotice("Attachments for one message cannot exceed 20 MB in total."); break; }
        const form = new FormData();
        form.set("organizationId", organizationId);
        form.set("mailboxId", mailboxId);
        if (draftIdRef.current) form.set("draftId", draftIdRef.current);
        form.set("file", file);
        const response = await fetch("/api/mail/attachments", { method: "POST", body: form });
        const result = await response.json() as { ok?: boolean; attachment?: PendingAttachment; error?: string };
        if (!response.ok || !result.ok || !result.attachment) {
          setNotice(result.error || "A file could not be attached.");
          continue;
        }
        added.push(result.attachment);
        totalBytes += result.attachment.size_bytes;
      }
      if (added.length) {
        setPendingAttachments((current) => [...current, ...added]);
        setRequestKey(null);
      }
    } catch {
      setNotice("The upload connection was interrupted. Check the attachment list before retrying.");
    } finally {
      setUploadingAttachments(false);
      if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    }
  }

  async function removePendingAttachment(attachment: PendingAttachment) {
    if (busy || uploadingAttachments) return;
    const response = await fetch(
      "/api/mail/attachments?organizationId=" + encodeURIComponent(organizationId) +
      "&mailboxId=" + encodeURIComponent(mailboxId) + "&id=" + encodeURIComponent(attachment.id),
      { method: "DELETE" },
    );
    const result = await response.json() as { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) { setNotice(result.error || "Attachment could not be removed."); return; }
    setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id));
    setRequestKey(null);
  }

  async function closeComposer() {
    if (busy) return;
    if (draftSaveTimer.current !== null) {
      window.clearTimeout(draftSaveTimer.current);
      draftSaveTimer.current = null;
    }

    const hadPendingAttachments = pendingAttachments.length > 0;
    const shouldSave = Boolean(mailboxId && (draftIdRef.current || to.trim() || subject.trim() || body.trim() || hadPendingAttachments));
    let attachmentsSavedWithDraft = false;
    if (shouldSave) {
      const version = ++draftMutationVersion.current;
      setDraftSaving(true);
      const saved = await queueDraftSnapshot(to, subject, body, version);
      setDraftSaving(false);
      attachmentsSavedWithDraft = saved && hadPendingAttachments && Boolean(draftIdRef.current);
      // Draft persistence is best-effort for dismissal: a failed or unavailable
      // drafts table must never trap the user inside the compose modal.
      if (!saved || version !== draftMutationVersion.current) {
        setNotice("Composer closed, but this draft or its attachments could not be saved. Your latest changes may not be stored.");
      }
    } else {
      draftMutationVersion.current += 1;
    }
    resetComposerAfterClose(attachmentsSavedWithDraft);
    if (hadPendingAttachments && attachmentsSavedWithDraft) {
      setNotice("Draft saved, including its attachments.");
    } else if (hadPendingAttachments && !shouldSave) {
      setNotice("Uploaded attachments were removed because no draft was saved.");
    }
  }

  function openCompose() {
    discardPendingAttachments();
    setScheduleMode(false);
    setScheduledAt("");
    draftIdRef.current = null;
    draftUpdatedAtRef.current = null;
    setDraftId(null);
    prepareTemplatePicker();
    setComposeOpen(true);
    setComposeSignatureId(null);
    setNotice("");
    setTo("");
    setSubject("");
    setBody("");
    setRequestKey(null);
    composeCursorPosition.current = 0;
  }

  function chooseContactSuggestion(contact: Contact) {
    const delimiterIndex = Math.max(to.lastIndexOf(","), to.lastIndexOf(";"));
    const prefix = delimiterIndex >= 0 ? to.slice(0, delimiterIndex + 1) : "";
    const separator = prefix && !/\\s$/.test(prefix) ? " " : "";
    setTo(prefix + separator + contact.email + ", ");
    setRequestKey(null);
    setContactSuggestions([]);
    setContactSuggestionsOpen(false);
    setActiveContactSuggestionIndex(0);
  }

  async function scheduleMessage() {
    if (busy || !mailboxId) return;
    if (pendingAttachments.length) { setNotice("Remove attachments before scheduling. Scheduled attachments are not supported yet."); return; }
    const scheduleRecipients = to.split(/[;,]/).map((value) => value.trim()).filter(Boolean);
    if (scheduleRecipients.length !== 1) { setNotice("Scheduled messages currently support one recipient at a time."); return; }
    if (!to.trim() || !subject.trim() || !body.trim()) { setNotice("Enter a recipient, subject, and message before scheduling."); return; }
    if (!scheduledAt || !Number.isFinite(Date.parse(scheduledAt))) { setNotice("Choose a date and time for delivery."); return; }
    setBusy(true); setNotice("");
    try {
      const signature = resolveMailboxSignature(mailPreferences, mailboxId, composeSignatureId);
      const finalBody = appendSignature(body, signature);
      const response = await fetch("/api/mail/scheduled", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, mailboxId, to: to.trim(), subject: subject.trim(), text: finalBody, scheduledAt: new Date(scheduledAt).toISOString() }) });
      const result = await response.json() as { ok?: boolean; error?: string; scheduled?: ScheduledEmail };
      if (!response.ok || !result.ok || !result.scheduled) { setNotice(result.error || "The message could not be scheduled."); return; }
      draftMutationVersion.current += 1;
      if (draftSaveTimer.current !== null) { window.clearTimeout(draftSaveTimer.current); draftSaveTimer.current = null; }
      await draftSaveQueue.current;
      const savedDraftId = draftIdRef.current;
      if (savedDraftId) {
        const deleted = await fetch("/api/mail/drafts?organizationId=" + encodeURIComponent(organizationId) + "&mailboxId=" + encodeURIComponent(mailboxId) + "&id=" + encodeURIComponent(savedDraftId), { method: "DELETE" }).catch(() => null);
        if (!deleted?.ok) setNotice("Message scheduled, but its old draft could not be removed.");
      }
      setScheduledMessages((current) => [result.scheduled!, ...current.filter((item) => item.id !== result.scheduled!.id)]);
      resetComposerAfterClose(); setScheduleMode(false); setScheduledAt(""); setDraftSaving(false);
      setNotice("Email scheduled for " + new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: mailPreferences.timezone || undefined }).format(new Date(result.scheduled.scheduled_at)) + ".");
      router.refresh();
    } catch { setNotice("The connection was interrupted. Check Scheduled before trying again."); }
    finally { setBusy(false); }
  }

  async function sendScheduledNow(item: ScheduledEmail) {
    if (scheduledBusyId) return;
    setScheduledBusyId(item.id); setNotice("");
    let claimed = false;
    try {
      const claim = await fetch("/api/mail/scheduled", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, mailboxId, id: item.id, action: "claim_send_now" }) });
      const claimResult = await claim.json() as { ok?: boolean; error?: string; scheduled?: ScheduledEmail };
      if (!claim.ok || !claimResult.ok || !claimResult.scheduled) { setNotice(claimResult.error || "This scheduled email could not be claimed."); return; }
      claimed = true;
      const response = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": "scheduled-" + item.id },
        body: JSON.stringify({ organizationId, mailboxId, to: item.to_address, subject: item.subject, text: item.body_text }),
      });
      const result = await response.json() as { ok?: boolean; error?: string; messageId?: string };
      if (!response.ok || !result.ok || !result.messageId) {
        await fetch("/api/mail/scheduled", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, mailboxId, id: item.id, action: "release_send_now" }) }).catch(() => null);
        claimed = false;
        setNotice(result.error || "The email could not be sent now. It remains scheduled for its original time.");
        return;
      }
      const completed = await fetch("/api/mail/scheduled", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, mailboxId, id: item.id, action: "complete_send_now", messageId: result.messageId }) });
      if (!completed.ok) { setNotice("The email was accepted by the provider. Refresh Scheduled to confirm its final status."); router.refresh(); return; }
      setScheduledMessages((current) => current.filter((message) => message.id !== item.id));
      setNotice("Email accepted by the provider and removed from Scheduled.");
      router.refresh();
    } catch {
      if (claimed) await fetch("/api/mail/scheduled", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, mailboxId, id: item.id, action: "release_send_now" }) }).catch(() => null);
      setNotice("The connection was interrupted. Refresh Scheduled before retrying.");
    } finally { setScheduledBusyId(""); }
  }

  async function updateScheduled(item: ScheduledEmail, action: "cancel" | "reschedule" | "delete", nextTime?: string) {
    if (scheduledBusyId) return;
    setScheduledBusyId(item.id); setNotice("");
    try {
      const response = action === "delete"
        ? await fetch("/api/mail/scheduled?organizationId=" + encodeURIComponent(organizationId) + "&mailboxId=" + encodeURIComponent(mailboxId) + "&id=" + encodeURIComponent(item.id), { method: "DELETE" })
        : await fetch("/api/mail/scheduled", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, mailboxId, id: item.id, action, ...(nextTime ? { scheduledAt: new Date(nextTime).toISOString() } : {}) }) });
      const result = await response.json() as { ok?: boolean; error?: string; scheduled?: { id: string; scheduled_at: string; status: string } };
      if (!response.ok || !result.ok) { setNotice(result.error || "Scheduled message could not be updated."); return; }
      if (action === "cancel" || action === "delete") setScheduledMessages((current) => current.filter((message) => message.id !== item.id));
      else if (result.scheduled) setScheduledMessages((current) => current.map((message) => message.id === item.id ? { ...message, scheduled_at: result.scheduled!.scheduled_at, status: "scheduled", last_error_code: null } : message));
      setNotice(action === "cancel" ? "Scheduled email cancelled." : action === "delete" ? "Failed scheduled email deleted." : "Scheduled email updated.");
    } catch { setNotice("The connection was interrupted. Refresh Scheduled to confirm the change."); }
    finally { setScheduledBusyId(""); }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (scheduleMode) { await scheduleMessage(); return; }
    setBusy(true);
    setNotice("");
    const stableRequestKey = requestKey ?? crypto.randomUUID();
    setRequestKey(stableRequestKey);
    try {
      const signature = resolveMailboxSignature(mailPreferences, mailboxId, composeSignatureId);
      const finalBody = appendSignature(body, signature);
      const response = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": stableRequestKey },
        body: JSON.stringify({ organizationId, mailboxId, draftId: draftIdRef.current, to: to.trim(), subject: subject.trim(), text: finalBody, attachments: pendingAttachments.map((attachment) => attachment.id) }),
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
      resetComposerAfterClose(true);
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
    setPendingAttachments([]);
    setTo(draft.to_address);
    setComposeSignatureId(null);
    setSubject(draft.subject);
    setBody(draft.body_text);
    setRequestKey(null);
    setNotice("");
    prepareTemplatePicker();
    setComposeOpen(true);
    composeCursorPosition.current = draft.body_text.length;
    const params = new URLSearchParams({ organizationId, mailboxId, draftId: draft.id });
    void fetch("/api/mail/attachments?" + params.toString(), { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as { attachments?: PendingAttachment[]; error?: string };
        if (!response.ok) throw new Error(result.error || "Draft attachments could not be loaded.");
        if (draftIdRef.current === draft.id) setPendingAttachments(result.attachments ?? []);
      })
      .catch((error: unknown) => {
        if (draftIdRef.current === draft.id) setNotice(error instanceof Error ? error.message : "Draft attachments could not be loaded.");
      });
  }

  async function deleteDraft(draft: EmailDraft) {
    const response = await fetch("/api/mail/drafts?organizationId=" + encodeURIComponent(organizationId) + "&mailboxId=" + encodeURIComponent(mailboxId) + "&id=" + encodeURIComponent(draft.id), { method: "DELETE" });
    const result = await response.json() as { ok?: boolean; error?: string };
    if (!response.ok || !result.ok) { setNotice(result.error || "Draft could not be deleted."); return; }
    setDrafts((current) => current.filter((item) => item.id !== draft.id));
  }

    function replyTo(message: EmailMessage, replyAll = false) {
    if (message.direction !== "inbound") return;
    const ownAddress = selectedMailbox?.address.toLowerCase();
    const replyTargets = message.reply_to_addresses?.length ? message.reply_to_addresses : [message.from_address];
    const recipients = replyAll
      ? Array.from(new Set([...replyTargets, ...message.to_addresses, ...(message.cc_addresses ?? [])]
        .map((address) => address.trim().toLowerCase())
        .filter((address) => address && address !== ownAddress)))
      : replyTargets;
    setTo(recipients.join(", "));
    setComposeSignatureId(null);
    setSubject(/^re:/i.test(message.subject) ? message.subject : "Re: " + message.subject);
    const quoted = plainText(message).split("\n").map((line) => "> " + line).join("\n");
    const quoteBlock = "—\nOn " + messageDate(message, mailPreferences.timezone, mailPreferences.language) + ", " + message.from_address + " wrote:\n" + quoted;
    const initialBody = mailPreferences.replyStyle === "bottom" ? quoteBlock + "\n\n" : "\n\n" + quoteBlock;
    setRequestKey(null);
    setNotice("");
    setBody(initialBody);
    setScheduleMode(false);
    setScheduledAt("");
    composeCursorPosition.current = mailPreferences.replyStyle === "bottom" ? initialBody.length : 0;
    prepareTemplatePicker();
    setComposeOpen(true);
  }

  async function forwardMessage(message: EmailMessage) {
    discardPendingAttachments();
    setDraftId(null);
    draftIdRef.current = null;
    draftUpdatedAtRef.current = null;
    setTo("");
    setComposeSignatureId(null);
    setSubject(/^fwd:/i.test(message.subject) ? message.subject : "Fwd: " + message.subject);
    setBody("\n\n---------- Forwarded message ----------\nFrom: " + message.from_address +
      "\nDate: " + messageDate(message, mailPreferences.timezone, mailPreferences.language) +
      "\nSubject: " + (message.subject || "(no subject)") +
      "\nTo: " + message.to_addresses.join(", ") + "\n\n" + plainText(message));
    setRequestKey(null);
    setScheduleMode(false);
    setScheduledAt("");
    setNotice("");
    composeCursorPosition.current = 0;
    prepareTemplatePicker();
    setComposeOpen(true);
    try {
      const response = await fetch("/api/mail/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "copy", organizationId, mailboxId, sourceMessageId: message.id }),
      });
      const result = await response.json() as { attachments?: PendingAttachment[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Original attachments could not be copied.");
      if (result.attachments?.length) setPendingAttachments(result.attachments);
    } catch (error) {
      setNotice((error instanceof Error ? error.message : "Original attachments could not be copied.") + " The forwarded message text is ready to send.");
    }
  }

  return (
    <>
      <div className={"mailbox-live-page " + workspaceStyles.app + (compactMessageList ? " " + workspaceStyles.compactList : "")}>
        <button type="button" className="mail-mobile-compose-fab" onClick={openCompose} aria-label="Compose a new message" title="Compose a new message">+</button>
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
                    onChange={(event) => { setMailboxId(event.target.value); setComposeSignatureId(null); setSelectedMessageId(""); setMobileDetailOpen(false); }}
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
                  {activeView === "Snoozed" && (
                    <button type="button" className={styles.secondaryButton} disabled={lifecycleBusy} onClick={() => void runLifecycle(selectedMessageIds, "unsnooze")}>Return to Inbox</button>
                  )}
                  {activeView !== "Trash" && activeView !== "Spam" && activeView !== "Snoozed" && (
                    <>
                      <label className={styles.snoozePicker}>
                        <span>Snooze until</span>
                        <input
                          type="datetime-local"
                          value={snoozeUntilInput}
                          min={snoozePickerBounds.min}
                          max={snoozePickerBounds.max}
                          onChange={(event) => setSnoozeUntilInput(event.target.value)}
                          aria-label="Snooze selected messages until"
                          disabled={lifecycleBusy}
                        />
                      </label>
                      <button type="button" className={styles.secondaryButton} disabled={lifecycleBusy || !snoozeUntilInput} onClick={() => void runLifecycle(selectedMessageIds, "snooze", snoozeUntilInput)}>Snooze</button>
                    </>
                  )}
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
                {activeView === "Scheduled" && visibleScheduledMessages.filter((item) => !query || [item.to_address, item.subject, item.body_text, item.status].join(" ").toLowerCase().includes(query.toLowerCase())).map((item) => (
                  <article className="mail-message-row" key={item.id}>
                    <span className="mail-avatar tone-slate">◷</span>
                    <div className="mail-message-copy">
                      <span className="mail-message-row-top"><strong>{item.to_address}</strong><time>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: mailPreferences.timezone || undefined }).format(new Date(item.scheduled_at))}</time></span>
                      <span className="mail-message-subject">{item.subject}</span>
                      <span className="mail-message-preview">{item.status === "failed" ? "Delivery failed: " + (item.last_error_code || "unknown error") : item.status === "processing" ? "Sending now…" : item.body_text.replace(/\s+/g, " ").slice(0, 120)}</span>
                      <div className={styles.rowActions}>
                        {item.status === "scheduled" && <button type="button" className="mail-toolbar-button" disabled={Boolean(scheduledBusyId)} onClick={() => void sendScheduledNow(item)}>Send now</button>}{item.status === "scheduled" && <><input aria-label={"New send time for " + item.subject} type="datetime-local" value={scheduledTimeEdits[item.id] ?? localDateTimeInput(item.scheduled_at)} onChange={(event) => setScheduledTimeEdits((current) => ({ ...current, [item.id]: event.target.value }))} disabled={Boolean(scheduledBusyId)} /><button type="button" className="mail-toolbar-button" disabled={Boolean(scheduledBusyId) || !(scheduledTimeEdits[item.id] ?? localDateTimeInput(item.scheduled_at))} onClick={() => void updateScheduled(item, "reschedule", scheduledTimeEdits[item.id] ?? localDateTimeInput(item.scheduled_at))} title="Reschedule">Reschedule</button></>}
                        {item.status === "scheduled" && <button type="button" className="mail-toolbar-button" disabled={Boolean(scheduledBusyId)} onClick={() => void updateScheduled(item, "cancel")} title="Cancel scheduled email">Cancel</button>}{item.status === "failed" && <button type="button" className="mail-toolbar-button" disabled={Boolean(scheduledBusyId)} onClick={() => void updateScheduled(item, "delete")} title="Delete failed scheduled email">Delete</button>}
                      </div>
                    </div>
                  </article>
                ))}
                {activeView === "Drafts" && visibleDrafts.map((draft) => (
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
                          <time>{activeView === "Snoozed" && message.snoozed_until
                            ? "Returns " + new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: mailPreferences.timezone || undefined }).format(new Date(message.snoozed_until))
                            : messageDate(message, mailPreferences.timezone, mailPreferences.language)}</time>
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
                {activeView === "Drafts" && draftsLoading && !drafts.length && (
                  <div className="mail-empty-list" role="status"><span>▧</span><strong>Loading drafts…</strong><p>Your saved drafts are being loaded.</p></div>
                )}
                {activeView === "Drafts" && !draftsLoading && !visibleDrafts.length && (
                  <div className="mail-empty-list"><span>▧</span><strong>No drafts yet</strong><p>Unfinished messages are saved here automatically while you compose.</p><button type="button" onClick={openCompose}>Compose a draft</button></div>
                )}
                {activeView === "Scheduled" && scheduledLoading && !scheduledMessages.length && (
                  <div className="mail-empty-list" role="status"><span>◷</span><strong>Loading scheduled emails…</strong><p>Your scheduled messages are being loaded.</p></div>
                )}
                {activeView === "Scheduled" && !scheduledLoading && !visibleScheduledMessages.length && (
                  <div className="mail-empty-list"><span>◷</span><strong>No scheduled emails</strong><p>Emails you schedule for later will appear here.</p><button type="button" onClick={openCompose}>Compose and schedule</button></div>
                )}
                {activeView !== "Drafts" && activeView !== "Scheduled" && !visibleMessages.length && (
                  <div className="mail-empty-list">
                    <span>{activeView === "Inbox" ? "▤" : activeView === "Sent" ? "↗" : activeView === "Starred" ? "☆" : activeView === "Snoozed" ? "◴" : activeView === "Archive" ? "▱" : activeView === "Trash" ? "⌫" : "⊘"}</span>
                    <strong>{query ? "No matching messages" : activeView === "Snoozed" ? "Snooze workflow not enabled" : "No messages in " + activeView}</strong>
                    <p>{query ? "Try another search term." : activeView === "Inbox" ? "New incoming messages will appear here." : activeView === "Sent" ? "Messages you send from this mailbox will appear here." : activeView === "Snoozed" ? "The Snoozed destination is reserved in the workspace navigation. Message snoozing and automatic return scheduling still need to be implemented." : "Messages in this personal " + activeView.toLowerCase() + " view will appear here."}</p>
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
                      {selectedMessage.direction === "inbound" && <button type="button" className="mail-toolbar-button" onClick={() => replyTo(selectedMessage, true)}>Reply all</button>}
                      <button type="button" className="mail-toolbar-button" onClick={() => void forwardMessage(selectedMessage)}>Forward</button>
                      {activeView !== "Trash" && activeView !== "Spam" && (
                        <button
                          type="button"
                          className="mail-toolbar-button"
                          aria-expanded={reminderFormOpen}
                          onClick={() => {
                            setReminderFormOpen((current) => !current);
                            setReminderAtInput(localDateTimeInput(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()));
                            setNotice("");
                          }}
                        >
                          {reminderFormOpen ? "Close reminder" : "Remind me"}
                        </button>
                      )}
                      {activeView === "Snoozed" ? (
                        <button type="button" className="mail-toolbar-button" disabled={lifecycleBusy} onClick={() => void runLifecycle([selectedMessage.id], "unsnooze")}>Return to Inbox</button>
                      ) : activeView !== "Trash" && activeView !== "Spam" ? (
                        <>
                          <label className={styles.snoozePicker}>
                            <span>Snooze until</span>
                            <input
                              type="datetime-local"
                              value={snoozeUntilInput}
                              min={snoozePickerBounds.min}
                              max={snoozePickerBounds.max}
                              onChange={(event) => setSnoozeUntilInput(event.target.value)}
                              aria-label="Snooze this message until"
                              disabled={lifecycleBusy}
                            />
                          </label>
                          <button type="button" className="mail-toolbar-button" disabled={lifecycleBusy || !snoozeUntilInput} onClick={() => void runLifecycle([selectedMessage.id], "snooze", snoozeUntilInput)}>Snooze</button>
                        </>
                      ) : null}
                      <button type="button" className="mail-toolbar-button" onClick={() => router.refresh()} aria-label="Refresh message">↻</button>
                    </div>
                  </div>
                  {reminderFormOpen && activeView !== "Trash" && activeView !== "Spam" && (
                    <form
                      className={styles.reminderInlineForm}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveReminder(selectedMessage);
                      }}
                    >
                      <label className={styles.reminderInlineField}>
                        <span>Remind me at</span>
                        <input
                          type="datetime-local"
                          value={reminderAtInput}
                          min={reminderPickerBounds.min}
                          max={reminderPickerBounds.max}
                          onChange={(event) => setReminderAtInput(event.target.value)}
                          required
                          disabled={reminderSaving}
                        />
                      </label>
                      <label className={styles.reminderInlineField}>
                        <span>Follow-up note <small>Optional · up to 500 characters</small></span>
                        <textarea
                          value={reminderNoteInput}
                          rows={2}
                          maxLength={500}
                          onChange={(event) => setReminderNoteInput(event.target.value)}
                          placeholder="What do you need to follow up on?"
                          disabled={reminderSaving}
                        />
                      </label>
                      <div className={styles.reminderInlineActions}>
                        <button type="submit" className="mail-toolbar-button" disabled={reminderSaving}>{reminderSaving ? "Saving…" : "Save reminder"}</button>
                        <button type="button" className="mail-toolbar-button" disabled={reminderSaving} onClick={() => setReminderFormOpen(false)}>Cancel</button>
                      </div>
                    </form>
                  )}
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
                    {selectedMessage.body_html?.trim() ? (
                      <div className="mail-message-body-card">
                        <EmailHtmlViewer
                          key={selectedMessage.id}
                          html={selectedMessage.body_html}
                          plainTextBody={plainText(selectedMessage)}
                        />
                      </div>
                    ) : (
                      <div className="mail-message-body-card">
                        <div className="mail-message-body">
                          {plainText(selectedMessage).split("\n").map((line, index) => (
                            line
                              ? <p key={index}>{line}</p>
                              : <div key={index} className="mail-body-spacer" />
                          ))}
                        </div>
                      </div>
                    )}
                    {messageAttachmentsLoading && <p className={styles.attachmentStatus}>Loading attachments…</p>}
                    {!messageAttachmentsLoading && visibleMessageAttachments.length > 0 && (
                      <section className={styles.attachmentPanel} aria-label="Message attachments">
                        <h3>Attachments <span>{visibleMessageAttachments.length}</span></h3>
                        <div className={styles.attachmentList}>
                          {visibleMessageAttachments.map((attachment) => (
                            <a key={attachment.id} href={"/api/mail/attachments/" + encodeURIComponent(attachment.id)} className={styles.messageAttachment} download>
                              <span className={styles.attachmentIcon} aria-hidden="true">↧</span>
                              <span className={styles.attachmentFileCopy}><strong>{attachment.filename}</strong><small>{formatFileSize(attachment.size_bytes)}</small></span>
                              <span aria-hidden="true">↓</span>
                            </a>
                          ))}
                        </div>
                      </section>
                    )}
                    {selectedMessage.direction === "inbound" && (
                      <div className="mail-reply-actions">
                        <button type="button" className="mail-primary-action" onClick={() => replyTo(selectedMessage)}>↶ Reply</button>
                        <button type="button" className="mail-secondary-action" onClick={() => replyTo(selectedMessage, true)}>Reply all</button>
                        <button type="button" className="mail-secondary-action" onClick={() => void forwardMessage(selectedMessage)}>Forward</button>
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
                <label className="mail-compose-field">
                  <span>To</span>
                  <div className={styles.recipientField}>
                    <input
                      className={styles.recipientInput}
                      type="text"
                      role="combobox"
                      inputMode="email"
                      required
                      maxLength={4000}
                      disabled={busy}
                      value={to}
                      aria-label="To"
                      aria-autocomplete="list"
                      aria-expanded={Boolean(recipientQuery) && contactSuggestionsOpen && (contactSuggestionsLoading || contactSuggestions.length > 0)}
                      aria-controls="contact-recipient-suggestions"
                      aria-activedescendant={contactSuggestionsOpen && contactSuggestions[activeContactSuggestionIndex] ? "contact-suggestion-" + contactSuggestions[activeContactSuggestionIndex].id : undefined}
                      onChange={(event) => { setTo(event.target.value); setRequestKey(null); setActiveContactSuggestionIndex(0); }}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowDown" && contactSuggestions.length > 0) {
                          event.preventDefault();
                          setContactSuggestionsOpen(true);
                          setActiveContactSuggestionIndex((index) => Math.min(index + 1, contactSuggestions.length - 1));
                        } else if (event.key === "ArrowUp" && contactSuggestions.length > 0) {
                          event.preventDefault();
                          setContactSuggestionsOpen(true);
                          setActiveContactSuggestionIndex((index) => Math.max(index - 1, 0));
                        } else if (event.key === "Enter" && contactSuggestionsOpen && contactSuggestions.length > 0) {
                          event.preventDefault();
                          chooseContactSuggestion(contactSuggestions[activeContactSuggestionIndex] ?? contactSuggestions[0]);
                        } else if (event.key === "Escape") {
                          setContactSuggestionsOpen(false);
                        }
                      }}
                      onBlur={() => { window.setTimeout(() => setContactSuggestionsOpen(false), 100); }}
                      placeholder="name@example.com, another@example.com"
                    />
                    {Boolean(recipientQuery) && contactSuggestionsOpen && (contactSuggestionsLoading || contactSuggestions.length > 0) && (
                      <div className={styles.contactSuggestions} id="contact-recipient-suggestions" role="listbox" aria-label="Saved contacts">
                        {contactSuggestionsLoading && <p className={styles.contactSuggestionsStatus}>Searching saved contacts…</p>}
                        {contactSuggestions.map((contact, index) => (
                          <button
                            type="button"
                            role="option"
                            aria-selected={index === activeContactSuggestionIndex}
                            id={"contact-suggestion-" + contact.id}
                            key={contact.id}
                            className={index === activeContactSuggestionIndex ? styles.contactSuggestionActive : styles.contactSuggestion}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => chooseContactSuggestion(contact)}
                          >
                            <span className={styles.contactSuggestionAvatar}>{initials(contact.name)}</span>
                            <span className={styles.contactSuggestionCopy}><strong>{contact.name}</strong><small>{contact.email}{contact.company ? " · " + contact.company : ""}</small></span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
                <label className="mail-compose-field">
                  <span>Template</span>
                  <select
                    value={composeTemplateId}
                    disabled={busy || savedTemplatesLoading || savedTemplates.length === 0}
                    onChange={(event) => {
                      const templateId = event.target.value;
                      setComposeTemplateId(templateId);
                      const template = savedTemplates.find((item) => item.id === templateId);
                      if (!template) return;
                      setSubject(template.subject);
                      setBody(template.body_text);
                      setRequestKey(null);
                      composeCursorPosition.current = null;
                    }}
                    aria-label="Choose a saved email template"
                  >
                    <option value="">{savedTemplatesLoading ? "Loading templates…" : savedTemplates.length ? "Choose a template…" : "No saved templates"}</option>
                    {savedTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                  </select>
                </label>
                {savedTemplatesError ? (
                  <p className={styles.contactSuggestionsStatus} role="alert">{savedTemplatesError}</p>
                ) : !savedTemplatesLoading && savedTemplates.length === 0 ? (
                  <p className={styles.contactSuggestionsStatus}>No saved templates yet. Create one from Workspace → Templates.</p>
                ) : savedTemplates.length > 0 ? (
                  <p className={styles.contactSuggestionsStatus}>Selecting a template replaces the current subject and message.</p>
                ) : null}
                <label className="mail-compose-field"><span>Subject</span><input required maxLength={998} disabled={busy} value={subject} onChange={(event) => { setSubject(event.target.value); setRequestKey(null); setComposeTemplateId(""); }} placeholder="Add a subject" /></label>
                <label className="mail-compose-body-label">
                  <span className="mail-sr-only">Message body</span>
                  <textarea ref={composeBodyRef} required maxLength={80000} rows={8} disabled={busy} value={body} style={{ fontFamily: mailPreferences.font === "serif" ? "Georgia, serif" : mailPreferences.font === "mono" ? "ui-monospace, SFMono-Regular, Consolas, monospace" : "inherit" }} onChange={(event) => { setBody(event.target.value); setRequestKey(null); composeCursorPosition.current = null; setComposeTemplateId(""); }} placeholder="Write your message…" />
                </label>
                {mailPreferences.mailboxSignatures[mailboxId] && (
                  <label className="mail-compose-field">
                    <span>Signature</span>
                    <select
                      value={composeSignatureId ?? mailPreferences.mailboxSignatures[mailboxId].defaultSignatureId ?? ""}
                      onChange={(event) => setComposeSignatureId(event.target.value)}
                      disabled={busy || !mailPreferences.mailboxSignatures[mailboxId].enabled}
                    >
                      <option value="">No signature</option>
                      {availableMailboxSignatures(mailPreferences, mailboxId).map((signature) => (
                        <option key={signature.id} value={signature.id}>{signature.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="mail-compose-warning"><span>i</span> Plain-text email · Up to 10 recipients separated by commas · Attachments up to 4 MB each / 20 MB total · {draftSaving ? "Saving draft…" : draftId ? "Draft saved" : "Changes save automatically"}</p>
                {!scheduleMode && (
                  <section className={styles.composeAttachments} aria-label="Compose attachments">
                    <input ref={attachmentInputRef} className={styles.fileInput} type="file" multiple disabled={busy || uploadingAttachments || !mailboxId} onChange={(event) => void uploadSelectedFiles(event.currentTarget.files)} aria-label="Choose attachment files" />
                    <button type="button" className="mail-compose-discard" disabled={busy || uploadingAttachments || !mailboxId || pendingAttachments.length >= 5} onClick={() => attachmentInputRef.current?.click()}>
                      {uploadingAttachments ? "Uploading…" : "Attach files"} <span aria-hidden="true">↥</span>
                    </button>
                    {pendingAttachments.length > 0 && (
                      <div className={styles.pendingAttachmentList}>
                        {pendingAttachments.map((attachment) => (
                          <div className={styles.pendingAttachment} key={attachment.id}>
                            <span className={styles.attachmentIcon} aria-hidden="true">↥</span>
                            <span className={styles.attachmentFileCopy}><strong>{attachment.filename}</strong><small>{formatFileSize(attachment.size_bytes)}</small></span>
                            <button type="button" disabled={busy || uploadingAttachments} aria-label={"Remove " + attachment.filename} onClick={() => void removePendingAttachment(attachment)}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
                {scheduleMode && <label className="mail-compose-field"><span>Send at</span><input type="datetime-local" required value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} disabled={busy} /></label>}
                <footer className="mail-compose-footer">
                  {scheduleMode ? <button type="button" className="mail-primary-action" disabled={busy || uploadingAttachments || !mailboxId || !scheduledAt || pendingAttachments.length > 0 || to.split(/[;,]/).map((value) => value.trim()).filter(Boolean).length !== 1} onClick={() => void scheduleMessage()}>{busy ? "Scheduling…" : "Schedule email"} <span>◷</span></button> : <><button type="submit" className="mail-primary-action" disabled={busy || uploadingAttachments || !mailboxId}>{busy ? "Sending…" : "Send"} <span>↗</span></button><button type="button" className="mail-compose-discard" disabled={busy || uploadingAttachments || pendingAttachments.length > 0 || to.split(/[;,]/).map((value) => value.trim()).filter(Boolean).length !== 1} title={pendingAttachments.length > 0 ? "Remove attachments before scheduling" : "Scheduling currently supports one recipient"} onClick={() => { setScheduleMode(true); const date = new Date(Date.now() + 60 * 60 * 1000); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); setScheduledAt(date.toISOString().slice(0, 16)); }}>Schedule</button></>}
                  <button type="button" className="mail-compose-discard" onClick={() => void closeComposer()} disabled={busy}>Close</button>
                </footer>
              </form>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
