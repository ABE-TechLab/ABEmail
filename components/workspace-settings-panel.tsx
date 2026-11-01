"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useAppearanceMode, type AppearanceMode } from "@/components/appearance-provider";
import { useDesignTheme } from "@/components/design-theme-provider";
import { DESIGN_THEMES, type DesignThemeId } from "@/lib/design-system";
import BrandProfileEditor from "@/components/brand-profile-editor";
import { useTransientNotice } from "@/lib/use-transient-notice";

export type WorkspaceSettingsContext = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationRole: string;
  email: string;
  userId: string;
  mailboxes: { id: string; address: string; display_name: string | null }[];
  members: { user_id: string; role: string; status: string }[];
};

export type SavedSignature = { id: string; name: string; content: string };
export type MailboxSignaturePreference = {
  enabled: boolean;
  defaultSignatureId: string | null;
  signatures: SavedSignature[];
};

export type WorkspacePreferenceValues = {
  timezone: string;
  language: string;
  font: string;
  signature: string;
  mailboxSignatures: Record<string, MailboxSignaturePreference>;
  replyStyle: "reply" | "bottom";
  compactMessageList: boolean;
  notifications: { newMail: boolean; mentions: boolean; product: boolean; digest: boolean };
};

type ProviderStatus = {
  connected: boolean;
  provider: string;
  keyLastFour: string | null;
  webhookConfigured: boolean;
  status: string;
  connectedAt: string | null;
  lastCheckedAt: string | null;
  lastErrorCode: string | null;
  environmentManaged: boolean;
  canDisconnect: boolean;
  activeVerifiedDomainCount: number;
  activeMailboxCount: number;
};

type DnsRecord = {
  record?: string;
  name?: string;
  type?: string;
  ttl?: string;
  value?: string;
  priority?: number;
  status?: string;
};

type WorkspaceDomain = {
  id: string;
  domain: string;
  status: string;
  verifiedAt: string | null;
  providerDomainId: string | null;
  dnsRecords: DnsRecord[];
  sendingEnabled: boolean;
  receivingEnabled: boolean;
  lastCheckedAt: string | null;
  lastErrorCode: string | null;
};

type WorkspaceMailbox = {
  id: string;
  address: string;
  display_name: string | null;
  status: string;
  domain_id: string;
  created_at: string;
};

type WorkspaceInvitation = {
  id: string;
  email: string;
  role: "admin" | "member";
  mailboxIds: string[];
  mailboxAddresses: string[];
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  deliveryStatus: "pending" | "sent" | "delivery_unknown" | "failed" | "delivered" | "delayed" | "bounced" | "complained" | "suppressed";
  deliveryErrorCode: string | null;
  sentAt: string | null;
  state: "pending" | "accepted" | "revoked" | "expired";
};

const SETTINGS_KEY = "abemail:workspace-settings:";
const COMPACT_KEY = "abemail:compact-message-list";

const DEFAULT_PREFERENCES: WorkspacePreferenceValues = {
  timezone: "Africa/Lagos",
  language: "en",
  font: "sans",
  signature: "",
  mailboxSignatures: {},
  replyStyle: "reply",
  compactMessageList: false,
  notifications: { newMail: true, mentions: true, product: false, digest: false },
};

const SECTION_INFO: Record<string, { title: string; description: string }> = {
  general: { title: "Workspace profile", description: "Manage your business identity and workspace-wide regional preferences." },
  appearance: { title: "Appearance", description: "Personalize the workspace shell and message list." },
  mail: { title: "Mail & compose", description: "Connect your mail provider and configure writing preferences." },
  notifications: { title: "Notifications", description: "Save your notification preferences for this workspace." },
  team: { title: "Team & access", description: "Review the active membership grants for this workspace." },
  domains: { title: "Domains", description: "Connect a custom domain, add its DNS records, and verify it with Resend." },
  mailboxes: { title: "Mailboxes & aliases", description: "Manage workspace mailboxes and future alias routing." },
  security: { title: "Security", description: "Review your current access and account-session controls." },
  rules: { title: "Rules & filters", description: "Define deterministic actions for incoming messages." },
  "out-of-office": { title: "Out-of-office", description: "Configure automatic replies while you are away." },
  branding: { title: "Workspace profile", description: "Manage your business identity and workspace-wide regional preferences." },
  integrations: { title: "Integrations", description: "Manage external services connected to this workspace." },
};

const SETTINGS_NAV_GROUPS = [
  {
    heading: "WORKSPACE",
    items: [
      { id: "general", label: "Workspace profile", icon: "◎" },
      { id: "appearance", label: "Appearance", icon: "◐" },
      { id: "notifications", label: "Notifications", icon: "♧" },
      { id: "team", label: "Team & access", icon: "♙" },
      { id: "security", label: "Security", icon: "◇" },
    ],
  },
  {
    heading: "EMAIL",
    items: [
      { id: "mail", label: "Mail & compose", icon: "✉" },
      { id: "domains", label: "Domains", icon: "◎" },
      { id: "mailboxes", label: "Mailboxes & aliases", icon: "▤" },
    ],
  },
  {
    heading: "AUTOMATION",
    items: [
      { id: "rules", label: "Rules & filters", icon: "⇄" },
      { id: "out-of-office", label: "Out-of-office", icon: "◷" },
    ],
  },
  {
    heading: "CONNECTIONS",
    items: [
      { id: "integrations", label: "Integrations", icon: "⛭" },
    ],
  },
] as const;


const APPEARANCE_MODES: { id: AppearanceMode; label: string; glyph: string }[] = [
  { id: "light", label: "Light", glyph: "☼" },
  { id: "dark", label: "Dark", glyph: "☾" },
  { id: "system", label: "System", glyph: "◐" },
];

function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="settings-row"><div className="settings-row-copy"><strong>{title}</strong><p>{description}</p></div><div className="settings-row-control">{children}</div></div>;
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="settings-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={checked ? "settings-toggle checked" : "settings-toggle"} onClick={() => onChange(!checked)}><span /></button>;
}

function statusLabel(status: string) {
  if (status === "verified") return "Verified";
  if (status === "pending_verification" || status === "pending") return "Needs DNS verification";
  if (status === "failed" || status === "partially_failed") return "Verification failed";
  if (status === "partially_verified") return "Partially verified";
  if (status === "suspended") return "Suspended";
  return status.replaceAll("_", " ");
}

export default function WorkspaceSettingsPanel({
  section: initialSection,
  organizationId,
  organizationName,
  organizationSlug,
  organizationRole,
  email,
  userId,
  mailboxes,
  members,
}: WorkspaceSettingsContext & { section: string }) {
  const router = useRouter();
  const { mode, setMode } = useAppearanceMode();
  const { theme: activeDesignTheme, setTheme: setDesignTheme } = useDesignTheme();
  const [displayName, setDisplayName] = useState(organizationName);
  const [preferences, setPreferences] = useState<WorkspacePreferenceValues>(DEFAULT_PREFERENCES);
  const [compactMessageList, setCompactMessageList] = useState(false);
  const [toast, setToast] = useTransientNotice();
  const [saving, setSaving] = useState(false);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [providerKey, setProviderKey] = useState("");
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerBusy, setProviderBusy] = useState(false);
  const [domains, setDomains] = useState<WorkspaceDomain[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [domainBusy, setDomainBusy] = useState(false);
  const [verifyingDomainId, setVerifyingDomainId] = useState("");
  const [mailboxRows, setMailboxRows] = useState<WorkspaceMailbox[]>([]);
  const [mailboxesLoading, setMailboxesLoading] = useState(false);
  const [mailboxName, setMailboxName] = useState("");
  const [mailboxLocalPart, setMailboxLocalPart] = useState("info");
  const [mailboxDomainId, setMailboxDomainId] = useState("");
  const [mailboxBusy, setMailboxBusy] = useState(false);
  const [editingMailboxId, setEditingMailboxId] = useState("");
  const [disconnectBusy, setDisconnectBusy] = useState(false);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteMailboxIds, setInviteMailboxIds] = useState<string[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [invitationLink, setInvitationLink] = useState("");
  const [invitationLinkId, setInvitationLinkId] = useState("");
  const [revokingInvitationId, setRevokingInvitationId] = useState("");

  const base = "/dashboard/" + organizationId;
  const settingsBase = base + "/settings";
  const pathname = usePathname();
  const requestedSection = pathname.startsWith(settingsBase)
    ? pathname.slice(settingsBase.length).split("/").filter(Boolean)[0] ?? "general"
    : initialSection;
  const section = Object.prototype.hasOwnProperty.call(SECTION_INFO, requestedSection) ? requestedSection : initialSection;
  const info = SECTION_INFO[section] ?? SECTION_INFO.general;
  const canManageWorkspace = organizationRole === "owner" || organizationRole === "admin";
  const verifiedReceivingDomains = domains.filter((domain) => domain.status === "verified" && domain.sendingEnabled && domain.receivingEnabled);
  const editingMailbox = mailboxRows.find((mailbox) => mailbox.id === editingMailboxId) ?? null;
  const editingMailboxDomain = editingMailbox ? domains.find((domain) => domain.id === editingMailbox.domain_id) : undefined;
  const mailboxFormDomains = editingMailboxDomain && !verifiedReceivingDomains.some((domain) => domain.id === editingMailboxDomain.id)
    ? [...verifiedReceivingDomains, editingMailboxDomain]
    : verifiedReceivingDomains;

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void (async () => {
        let localPreferences: Partial<WorkspacePreferenceValues> = {};
        try {
          const stored = window.localStorage.getItem(SETTINGS_KEY + organizationId);
          if (stored) localPreferences = JSON.parse(stored) as Partial<WorkspacePreferenceValues>;
        } catch {
          // Local preferences are optional; continue with the backend.
        }

        try {
          const response = await fetch("/api/organizations/" + organizationId + "/preferences", { cache: "no-store" });
          if (!active) return;
          const result = response.ok
            ? await response.json() as { preferences?: Partial<WorkspacePreferenceValues> }
            : { preferences: undefined };
          const saved = result.preferences ?? {};
          const hasServerPreferences = Object.keys(saved).length > 0;
          const base = hasServerPreferences ? saved : localPreferences;
          const loaded: WorkspacePreferenceValues = {
            ...DEFAULT_PREFERENCES,
            ...base,
            notifications: { ...DEFAULT_PREFERENCES.notifications, ...(base.notifications ?? {}) },
          };

          setPreferences(loaded);
          setCompactMessageList(loaded.compactMessageList);
          try {
            window.localStorage.setItem(SETTINGS_KEY + organizationId, JSON.stringify(loaded));
            window.localStorage.setItem(COMPACT_KEY, String(loaded.compactMessageList));
          } catch {
            // Server preferences are still loaded even if browser storage is blocked.
          }
          if (response.ok && !hasServerPreferences && Object.keys(localPreferences).length > 0) {
            await fetch("/api/organizations/" + organizationId + "/preferences", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(loaded),
            });
          }
        } catch {
          if (!active) return;
          const loaded: WorkspacePreferenceValues = {
            ...DEFAULT_PREFERENCES,
            ...localPreferences,
            notifications: { ...DEFAULT_PREFERENCES.notifications, ...(localPreferences.notifications ?? {}) },
          };
          setPreferences(loaded);
          setCompactMessageList(loaded.compactMessageList);
        }
      })();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [organizationId]);

  async function refreshProviderStatus(showError = true) {
    setProviderLoading(true);
    try {
      const response = await fetch("/api/organizations/" + organizationId + "/resend", { cache: "no-store" });
      const result = await response.json() as ProviderStatus & { error?: string };
      if (!response.ok || !("connected" in result)) {
        if (showError) notify(result.error || "Resend connection status could not be loaded.");
        return;
      }
      setProviderStatus(result);
    } catch {
      if (showError) notify("Resend connection status could not be loaded. Check your connection and retry.");
    } finally {
      setProviderLoading(false);
    }
  }

  async function refreshDomains(showError = true) {
    setDomainsLoading(true);
    try {
      const response = await fetch("/api/organizations/" + organizationId + "/domains", { cache: "no-store" });
      const result = await response.json() as { ok?: boolean; domains?: WorkspaceDomain[]; error?: string };
      if (!response.ok || !result.ok) {
        if (showError) notify(result.error || "Domain list could not be loaded.");
        return;
      }
      setDomains(result.domains ?? []);
      setMailboxDomainId((current) => current || result.domains?.find((item) => item.status === "verified" && item.sendingEnabled && item.receivingEnabled)?.id || "");
    } catch {
      if (showError) notify("Domain list could not be loaded. Check your connection and retry.");
    } finally {
      setDomainsLoading(false);
    }
  }

  async function refreshMailboxes(showError = true) {
    setMailboxesLoading(true);
    try {
      const response = await fetch("/api/organizations/" + organizationId + "/mailboxes", { cache: "no-store" });
      const result = await response.json() as { ok?: boolean; mailboxes?: WorkspaceMailbox[]; error?: string };
      if (!response.ok || !result.ok) {
        if (showError) notify(result.error || "Mailbox list could not be loaded.");
        return;
      }
      setMailboxRows(result.mailboxes ?? []);
    } catch {
      if (showError) notify("Mailbox list could not be loaded. Check your connection and retry.");
    } finally {
      setMailboxesLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      // The header status must reflect the real provider state on every Settings section.
      void refreshProviderStatus(false);
      if (section === "domains") void refreshDomains(false);
      if (section === "mailboxes") {
        void refreshDomains(false);
        void refreshMailboxes(false);
      }
      if (section === "team") void refreshInvitations(false);
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, section]);

  function notify(message: string) {
    setToast(message);
  }

  async function storePreferences(next = preferences): Promise<boolean> {
    setPreferences(next);
    setCompactMessageList(next.compactMessageList);
    try {
      window.localStorage.setItem(SETTINGS_KEY + organizationId, JSON.stringify(next));
      window.localStorage.setItem(COMPACT_KEY, String(next.compactMessageList));
    } catch {
      // Continue and try saving through the authenticated backend.
    }

    try {
      const response = await fetch("/api/organizations/" + organizationId + "/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const result = await response.json() as { ok?: boolean; preferences?: Partial<WorkspacePreferenceValues>; error?: string };
      if (!response.ok || !result.ok) {
        notify(result.error || "Preferences could not be synced to this workspace. Retry saving them.");
        return false;
      }
      const merged = result.preferences ?? next;
      const saved: WorkspacePreferenceValues = {
        ...DEFAULT_PREFERENCES,
        ...merged,
        notifications: { ...DEFAULT_PREFERENCES.notifications, ...(merged.notifications ?? {}) },
      };
      setPreferences(saved);
      setCompactMessageList(saved.compactMessageList);
      try {
        window.localStorage.setItem(SETTINGS_KEY + organizationId, JSON.stringify(saved));
        window.localStorage.setItem(COMPACT_KEY, String(saved.compactMessageList));
      } catch {
        // Server-side preference save succeeded.
      }
      return true;
    } catch {
      notify("Preferences were changed locally but could not be synced to this workspace. Check the connection and save again.");
      return false;
    }
  }

  async function updateCompact(next: boolean) {
    const saved = await storePreferences({ ...preferences, compactMessageList: next });
    if (saved) notify(next ? "Compact message list enabled in the mailbox." : "Standard message list enabled in the mailbox.");
  }

  async function saveGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = displayName.trim();
    if (nextName.length < 2 || nextName.length > 80) {
      notify("Workspace name must contain between 2 and 80 characters.");
      return;
    }
    setSaving(true);
    setToast("");
    if (!(await storePreferences())) {
      setSaving(false);
      return;
    }
    if (nextName !== organizationName) {
      try {
        const response = await fetch("/api/organizations/" + organizationId + "/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nextName }),
        });
        const result = await response.json() as { ok?: boolean; error?: string };
        if (!response.ok || !result.ok) {
          notify(result.error || "Workspace name could not be saved. Check your workspace permissions.");
          setSaving(false);
          return;
        }
        router.refresh();
        notify("Workspace name updated. Regional preferences are saved to this workspace.");
      } catch {
        notify("The workspace name could not be saved because the connection failed.");
      } finally {
        setSaving(false);
      }
      return;
    }
    notify("Regional preferences saved for this workspace.");
    setSaving(false);
  }

  function updateMailboxSignatureConfig(
    mailboxId: string,
    update: (config: MailboxSignaturePreference) => MailboxSignaturePreference,
  ) {
    setPreferences((current) => {
      const config = current.mailboxSignatures[mailboxId] ?? {
        enabled: true,
        defaultSignatureId: current.signature.trim() ? "workspace-default" : null,
        signatures: [],
      };
      return {
        ...current,
        mailboxSignatures: {
          ...current.mailboxSignatures,
          [mailboxId]: update(config),
        },
      };
    });
  }

  function addMailboxSignature(mailboxId: string) {
    const signature: SavedSignature = { id: crypto.randomUUID(), name: "New signature", content: "" };
    updateMailboxSignatureConfig(mailboxId, (config) => ({
      ...config,
      signatures: [...config.signatures, signature],
      defaultSignatureId: config.defaultSignatureId ?? signature.id,
    }));
  }

  function removeMailboxSignature(mailboxId: string, signatureId: string) {
    updateMailboxSignatureConfig(mailboxId, (config) => ({
      ...config,
      signatures: config.signatures.filter((signature) => signature.id !== signatureId),
      defaultSignatureId: config.defaultSignatureId === signatureId
        ? (preferences.signature.trim() ? "workspace-default" : null)
        : config.defaultSignatureId,
    }));
  }

  async function saveMailPreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await storePreferences()) notify("Mail and compose preferences saved for this workspace.");
  }

  async function updateNotification(key: keyof WorkspacePreferenceValues["notifications"], value: boolean) {
    const next = { ...preferences, notifications: { ...preferences.notifications, [key]: value } };
    if (await storePreferences(next)) notify("Notification preference saved for this workspace.");
  }

  async function connectResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageWorkspace) return notify("Only workspace owners and admins can connect Resend.");
    const value = providerKey.trim();
    if (!value) return notify("Paste your Resend API key first.");
    setProviderBusy(true);
    setToast("");
    try {
      const response = await fetch("/api/organizations/" + organizationId + "/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: value }),
      });
      const result = await response.json() as { ok?: boolean; connected?: boolean; note?: string; error?: string };
      if (!response.ok || !result.ok) {
        notify(result.error || "Resend could not be connected.");
        return;
      }
      setProviderKey("");
      await refreshProviderStatus(false);
      await refreshDomains(false);
      notify(result.note || "Resend connected securely to this workspace.");
    } catch {
      notify("Resend could not be connected. Check your network and retry.");
    } finally {
      setProviderBusy(false);
    }
  }

  async function disconnectResend() {
    if (!canManageWorkspace) return notify("Only workspace owners and admins can disconnect Resend.");
    if (!window.confirm("Disconnect Resend from this workspace? Existing verified domains will prevent this until they are removed or suspended.")) return;
    setDisconnectBusy(true);
    try {
      const response = await fetch("/api/organizations/" + organizationId + "/resend", { method: "DELETE" });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) return notify(result.error || "Resend could not be disconnected.");
      await refreshProviderStatus(false);
      notify("Resend disconnected from this workspace.");
    } catch {
      notify("Resend could not be disconnected. Check your network and retry.");
    } finally {
      setDisconnectBusy(false);
    }
  }

  async function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageWorkspace) return notify("Only workspace owners and admins can add domains.");
    setDomainBusy(true);
    setToast("");
    try {
      const response = await fetch("/api/organizations/" + organizationId + "/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainInput }),
      });
      const result = await response.json() as { ok?: boolean; domain?: WorkspaceDomain; error?: string };
      if (!response.ok || !result.ok) {
        notify(result.error || "Domain could not be added.");
        return;
      }
      setDomainInput("");
      await refreshDomains(false);
      notify(result.domain?.status === "verified"
        ? "Domain is already verified in Resend."
        : "Domain added. Copy the DNS records into your domain registrar, then verify it here.");
    } catch {
      notify("Domain could not be added. Check your connection and retry.");
    } finally {
      setDomainBusy(false);
    }
  }

  async function verifyDomain(domain: WorkspaceDomain) {
    if (!canManageWorkspace) return notify("Only workspace owners and admins can verify domains.");
    setVerifyingDomainId(domain.id);
    setToast("");
    try {
      const response = await fetch("/api/organizations/" + organizationId + "/domains/" + domain.id + "/verify", { method: "POST" });
      const result = await response.json() as { ok?: boolean; verified?: boolean; note?: string; error?: string };
      if (!response.ok || !result.ok) {
        notify(result.error || "Domain verification could not be checked.");
        return;
      }
      await refreshDomains(false);
      notify(result.note || (result.verified ? "Domain verified." : "Verification is pending. Review the DNS records and retry after they propagate."));
    } catch {
      notify("Domain verification could not be checked. Retry in a moment.");
    } finally {
      setVerifyingDomainId("");
    }
  }

  async function copyDnsRecord(record: DnsRecord) {
    const text = [record.type, record.name, record.value, record.priority === undefined ? "" : "priority " + record.priority]
      .filter(Boolean).join("\t");
    try {
      await navigator.clipboard.writeText(text);
      notify("DNS record copied.");
    } catch {
      notify("Copy is not available in this browser. Select and copy the DNS record manually.");
    }
  }

  async function refreshInvitations(showError = true) {
    setInvitationsLoading(true);
    try {
      const response = await fetch("/api/organizations/" + organizationId + "/invitations", { cache: "no-store" });
      const result = await response.json() as { ok?: boolean; invitations?: WorkspaceInvitation[]; error?: string };
      if (!response.ok || !result.ok) {
        if (showError) notify(result.error || "Workspace invitations could not be loaded.");
        return;
      }
      setInvitations(result.invitations ?? []);
    } catch {
      if (showError) notify("Workspace invitations could not be loaded. Check your connection and retry.");
    } finally {
      setInvitationsLoading(false);
    }
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageWorkspace) return notify("Only workspace owners and admins can invite teammates.");
    const emailAddress = inviteEmail.trim().toLowerCase();
    if (!emailAddress || !emailAddress.includes("@")) return notify("Enter a valid email address.");
    if (inviteRole === "member" && !inviteMailboxIds.length) return notify("Choose at least one mailbox for this teammate.");
    setInviteBusy(true);
    setToast("");
    setInvitationLink("");
    setInvitationLinkId("");
    try {
      const response = await fetch("/api/organizations/" + organizationId + "/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailAddress, role: inviteRole, mailboxIds: inviteMailboxIds }),
      });
      const result = await response.json() as {
        ok?: boolean;
        invitation?: { id: string; email: string; role: string; expiresAt: string; mailboxIds?: string[]; mailboxAddresses?: string[] };
        inviteUrl?: string;
        emailStatus?: string;
        note?: string;
        error?: string;
      };
      if (!response.ok || !result.ok) {
        notify(result.error || "Invitation could not be created.");
        return;
      }
      setInviteEmail("");
      await refreshInvitations(false);
      if (result.inviteUrl) {
        setInvitationLink(result.inviteUrl);
        setInvitationLinkId(result.invitation?.id ?? "");
      }
      notify(result.note || "Invitation created.");
    } catch {
      notify("Invitation could not be created. Check your connection and retry.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function revokeInvitation(invitation: WorkspaceInvitation) {
    if (!canManageWorkspace) return notify("Only workspace owners and admins can revoke invitations.");
    if (!window.confirm("Revoke the invitation for " + invitation.email + "? The existing link will stop working.")) return;
    setRevokingInvitationId(invitation.id);
    try {
      const response = await fetch("/api/organizations/" + organizationId + "/invitations/" + invitation.id, { method: "DELETE" });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        notify(result.error || "Invitation could not be revoked.");
        return;
      }
      if (invitationLinkId === invitation.id) {
        setInvitationLink("");
        setInvitationLinkId("");
      }
      await refreshInvitations(false);
      notify("Invitation revoked.");
    } catch {
      notify("Invitation could not be revoked. Check your connection and retry.");
    } finally {
      setRevokingInvitationId("");
    }
  }

  async function copyInvitationLink() {
    if (!invitationLink) return;
    try {
      await navigator.clipboard.writeText(invitationLink);
      notify("Invitation link copied. Share it only with the invited person.");
    } catch {
      notify("Copy is not available in this browser. Select the invitation link and copy it manually.");
    }
  }

  function startEditMailbox(mailbox: WorkspaceMailbox) {
    setEditingMailboxId(mailbox.id);
    setMailboxLocalPart(mailbox.address.split("@")[0] ?? "");
    setMailboxDomainId(mailbox.domain_id);
    setMailboxName(mailbox.display_name ?? "");
    setToast("");
  }

  function cancelMailboxEdit() {
    setEditingMailboxId("");
    setMailboxLocalPart("info");
    setMailboxName("");
    setMailboxDomainId(verifiedReceivingDomains[0]?.id ?? "");
    setToast("");
  }

  async function saveMailbox(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageWorkspace) return notify("Only workspace owners and admins can manage mailboxes.");
    const editingId = editingMailboxId;
    setMailboxBusy(true);
    setToast("");
    try {
      const response = await fetch(
        "/api/organizations/" + organizationId + "/mailboxes" + (editingId ? "/" + editingId : ""),
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ localPart: mailboxLocalPart, domainId: mailboxDomainId, displayName: mailboxName }),
        },
      );
      const result = await response.json() as { ok?: boolean; mailbox?: WorkspaceMailbox; error?: string; note?: string };
      if (!response.ok || !result.ok) {
        notify(result.error || (editingId ? "Mailbox changes could not be saved." : "Mailbox could not be created."));
        return;
      }
      setEditingMailboxId("");
      setMailboxLocalPart("info");
      setMailboxName("");
      await refreshMailboxes(false);
      router.refresh();
      notify(result.note || (editingId ? "Mailbox updated." : "Mailbox created."));
    } catch {
      notify(editingId ? "Mailbox changes could not be saved. Check your connection and retry." : "Mailbox could not be created. Check your connection and retry.");
    } finally {
      setMailboxBusy(false);
    }
  }

  return (
    <div className="workspace-settings-app">
        <header className="mail-topbar">
          <div className="mail-breadcrumb"><Link href={base}>Workspace</Link><span className="mail-breadcrumb-slash">/</span><strong>{info.title}</strong></div>
          <div className="settings-topbar-title">{organizationName}</div>
          <div className="mail-topbar-right">
            <Link href={settingsBase} className="mail-topbar-profile-link" aria-label="Open profile and general settings" title={email + " · General settings"}>
              <span className="mail-user-avatar">{email.split("@")[0].slice(0, 2).toUpperCase() || "U"}</span>
            </Link>
          </div>
        </header>

        <div className="settings-page-scroll">
          <div className="settings-page-heading"><div><p className="mail-overline">WORKSPACE SETTINGS</p><h1>Settings</h1><p>Changes are scoped to {organizationName}; workspace switching does not sign you out.</p></div><span className={"settings-preview-chip " + ((providerStatus?.connected || providerStatus?.environmentManaged) ? "connected" : providerLoading ? "checking" : "not-connected")}>
            <span />{providerLoading ? "Checking connection" : providerStatus?.connected || providerStatus?.environmentManaged ? "Workspace connected" : providerStatus ? "Workspace not connected" : "Connection status unavailable"}
          </span></div>
          <div className="settings-layout">
            <nav className="settings-navigation" aria-label="Settings sections">
              {SETTINGS_NAV_GROUPS.map((group) => (
                <div className="settings-nav-group" key={group.heading}>
                  <p>{group.heading}</p>
                  {group.items.map((item) => {
                    const href = settingsBase + (item.id === "general" ? "" : "/" + item.id);
                    const active = section === item.id;
                    return (
                      <Link
                        key={item.id}
                        href={href}
                        className={active ? "settings-nav-link active" : "settings-nav-link"}
                        aria-current={active ? "page" : undefined}
                        title={item.label}
                        onClick={(event) => {
                          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                          event.preventDefault();
                          window.history.pushState(null, "", href);
                        }}
                      >
                        <span aria-hidden="true">{item.icon}</span>{item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
            <section className="settings-panel" aria-labelledby="settings-heading">
              <header className="settings-panel-heading"><div><h2 id="settings-heading">{info.title}</h2><p>{info.description}</p></div></header>

              {section === "general" && <div className="workspace-profile-settings">
                <section aria-labelledby="workspace-profile-details-heading">
                  <div className="settings-section-summary"><div><strong id="workspace-profile-details-heading">Workspace details</strong><p>The name and regional preferences shared across this business workspace.</p></div></div>
                  <form onSubmit={saveGeneral}>
                    <div className="settings-form-grid">
                      <Field label="Workspace name" hint="This is the company name used by the workspace and its branded emails."><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={80} required disabled={!canManageWorkspace} /></Field>
                      <Field label="Language"><select value={preferences.language} onChange={(event) => setPreferences((current) => ({ ...current, language: event.target.value }))}><option value="en">English</option><option value="fr">French</option><option value="pt">Portuguese</option></select></Field>
                      <Field label="Time zone" hint="Used for message timestamps and scheduled-mail displays in this workspace."><select value={preferences.timezone} onChange={(event) => setPreferences((current) => ({ ...current, timezone: event.target.value }))}><option value="Africa/Lagos">Africa/Lagos (WAT)</option><option value="UTC">UTC</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New York</option><option value="America/Toronto">America/Toronto</option></select></Field>
                    </div>
                    <div className="settings-info-banner"><span>i</span><p>Regional preferences sync to this workspace. Workspace name changes are available to owners and admins.</p></div>
                    <div className="settings-form-footer"><span>Workspace: {organizationSlug}</span><button className="mail-primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : "Save workspace details"}</button></div>
                  </form>
                </section>
                <div className="settings-divider" />
                <section aria-labelledby="workspace-profile-identity-heading">
                  <div className="settings-section-summary"><div><strong id="workspace-profile-identity-heading">Business identity</strong><p>One company logo and brand profile shared by every mailbox in this workspace.</p></div></div>
                  <BrandProfileEditor organizationId={organizationId} organizationName={displayName} canManage={canManageWorkspace} />
                  <div className="settings-form-footer"><span>The workspace logo and brand defaults are reused by designed email templates.</span><Link href={base + "/templates"} className="mail-secondary-action">Open Templates</Link></div>
                </section>
              </div>}

              {section === "appearance" && <div>
                <div className="settings-choice-group"><p className="settings-subheading">Light and dark mode</p><p className="settings-muted">Choose whether ABEmail follows your preference or your device setting.</p><div className="settings-theme-options">{APPEARANCE_MODES.map((item) => <button key={item.id} type="button" aria-pressed={mode === item.id} className={mode === item.id ? "settings-theme-choice selected" : "settings-theme-choice"} onClick={() => { setMode(item.id); notify(item.label + " mode applied."); }}><span className="settings-theme-preview">{item.glyph}</span><span>{item.label}</span>{mode === item.id && <b>✓</b>}</button>)}</div></div>
                <div className="settings-divider" />
                <div className="settings-choice-group"><p className="settings-subheading">Design system palette</p><p className="settings-muted">Apply a shared ABE TechLab palette to the workspace UI.</p><label className="settings-field settings-palette-field"><span>Color palette</span><select className="settings-palette-select" value={activeDesignTheme} onChange={(event) => { const nextTheme = event.target.value as DesignThemeId; setDesignTheme(nextTheme); notify((DESIGN_THEMES.find((option) => option.value === nextTheme)?.name ?? "Selected") + " palette applied."); }}>{DESIGN_THEMES.map((option) => <option key={option.value} value={option.value}>{option.name}</option>)}</select></label></div>
                <div className="settings-divider" />
                <SettingRow title="Compact message list" description="Show more messages in the active mailbox list."><Toggle checked={compactMessageList} onChange={updateCompact} label="Compact message list" /></SettingRow>
                <div className="settings-form-footer"><span>Appearance and palette are user-wide; message density syncs with this workspace.</span><span className="settings-status active"><span />Applied</span></div>
              </div>}

              {section === "mail" && <div className="workspace-provider-settings">
                <div className="settings-section-summary"><div><strong>Resend connection</strong><p>Connect the Resend account that will send from and receive messages for this workspace.</p></div><span className={providerStatus?.connected ? "settings-status active" : "settings-status pending"}><span />{providerStatus?.connected ? "Connected" : providerStatus?.environmentManaged ? "Environment connected" : "Not connected"}</span></div>
                {providerLoading && <p className="settings-muted">Checking provider connection…</p>}
                {providerStatus?.connected && <div className="settings-info-banner"><span>✓</span><p>Resend is connected{providerStatus.keyLastFour ? " with a key ending in " + providerStatus.keyLastFour : ""}. Signed webhook: {providerStatus.webhookConfigured ? "configured" : "not configured"}. Secrets stay on the server and are never shown here again.</p></div>}
                {providerStatus?.environmentManaged && !providerStatus.connected && <div className="settings-info-banner"><span>i</span><p>This workspace currently uses the existing server-managed Resend setup. Connect a dedicated Full Access API key below to move it onto the per-workspace provider connection.</p></div>}
                <form className="settings-domain-form" onSubmit={connectResend}>
                  <Field label="Resend API key" hint="Use a Full Access key dedicated to ABEmail. It is required to manage domain verification and webhooks; sending-only keys cannot complete setup.">
                    <input type="password" autoComplete="new-password" value={providerKey} onChange={(event) => setProviderKey(event.target.value)} placeholder="re_…" minLength={12} maxLength={512} required disabled={!canManageWorkspace || providerBusy || Boolean(providerStatus?.connected && !providerStatus.canDisconnect)} />
                  </Field>
                  <button className="mail-primary-action" type="submit" disabled={!canManageWorkspace || providerBusy || Boolean(providerStatus?.connected && !providerStatus.canDisconnect)}>{providerBusy ? "Connecting…" : providerStatus?.connected ? "Replace connection" : "Connect Resend"}</button>
                </form>
                <p className="settings-muted">The key is validated against Resend and encrypted before it is stored. ABEmail also registers a signed webhook for this workspace so inbound messages and delivery events can be processed.</p>
                {providerStatus?.connected && !providerStatus.canDisconnect && <div className="settings-info-banner"><span>i</span><p>Credential replacement is locked while verified domains or active mailboxes depend on this Resend account. This protects live mail flow from silently breaking. Plan a provider/domain migration before replacing credentials.</p></div>}
                {providerStatus?.lastErrorCode && <p className="settings-muted">Last provider warning: {providerStatus.lastErrorCode.replaceAll("_", " ")}</p>}
                {providerStatus?.connected && <div className="settings-form-footer"><span>Connected {providerStatus.connectedAt ? "on " + new Date(providerStatus.connectedAt).toLocaleDateString() : "to this workspace"}.</span>{providerStatus.canDisconnect ? <button className="mail-secondary-action" type="button" disabled={!canManageWorkspace || disconnectBusy} onClick={disconnectResend}>{disconnectBusy ? "Disconnecting…" : "Disconnect Resend"}</button> : <span className="settings-muted">Disconnect is locked while {providerStatus.activeVerifiedDomainCount > 0 ? providerStatus.activeVerifiedDomainCount + " verified domain(s)" : "active mailboxes"} depend on this connection. Replace keys only after planning a migration.</span>}</div>}
                <div className="settings-divider" />
                <form onSubmit={saveMailPreferences}>
                  <p className="settings-subheading">Mail & compose preferences</p>
                  <Field label="Default writing font"><select value={preferences.font} onChange={(event) => setPreferences((current) => ({ ...current, font: event.target.value }))}><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="mono">Monospace</option></select></Field>
                  <div className="settings-divider" />
                  <div className="settings-choice-group"><p className="settings-subheading">When replying</p><label className="settings-radio-row"><input type="radio" name="workspace-reply-style" value="reply" checked={preferences.replyStyle === "reply"} onChange={() => setPreferences((current) => ({ ...current, replyStyle: "reply" }))} /><span><strong>Reply above the quoted message</strong><small>Start writing before the original message.</small></span></label><label className="settings-radio-row"><input type="radio" name="workspace-reply-style" value="bottom" checked={preferences.replyStyle === "bottom"} onChange={() => setPreferences((current) => ({ ...current, replyStyle: "bottom" }))} /><span><strong>Reply below the quoted message</strong><small>Place the cursor after the quoted original message.</small></span></label></div>
                  <Field label="Workspace default signature" hint="Legacy fallback used when a mailbox has no custom signature configuration."><textarea rows={4} maxLength={10000} value={preferences.signature} onChange={(event) => setPreferences((current) => ({ ...current, signature: event.target.value }))} /></Field>
                  <div className="settings-divider" />
                  <div className="settings-section-summary">
                    <div><strong>Signatures by mailbox</strong><p>Choose which signatures are available from each address, set a default, and turn signatures off for mailboxes that should not append one.</p></div>
                    <span className="settings-summary-chip">{mailboxes.length} mailbox{mailboxes.length === 1 ? "" : "es"}</span>
                  </div>
                  {mailboxes.length === 0 ? (
                    <div className="settings-empty-state"><strong>No mailboxes yet</strong><p>Create an active mailbox first. You can return here to add signatures for each address.</p></div>
                  ) : (
                    <div className="settings-domain-list">
                      {mailboxes.map((mailbox) => {
                        const config = preferences.mailboxSignatures[mailbox.id] ?? {
                          enabled: true,
                          defaultSignatureId: preferences.signature.trim() ? "workspace-default" : null,
                          signatures: [],
                        };
                        const defaultLabel = config.defaultSignatureId === "workspace-default"
                          ? "Workspace default"
                          : config.signatures.find((signature) => signature.id === config.defaultSignatureId)?.name ?? "No signature";
                        return (
                          <article className="settings-domain-record" key={mailbox.id}>
                            <div className="settings-domain-row">
                              <span className="settings-domain-icon">✉</span>
                              <span className="settings-domain-name"><strong>{mailbox.address}</strong><small>{mailbox.display_name || "Business mailbox"}</small></span>
                              <span className={config.enabled ? "settings-status active" : "settings-status pending"}><span />{config.enabled ? "Signature enabled" : "Signature disabled"}</span>
                            </div>
                            <SettingRow title="Append a signature" description="Automatically add the selected signature when composing or scheduling from this mailbox.">
                              <Toggle checked={config.enabled} onChange={(enabled) => updateMailboxSignatureConfig(mailbox.id, (current) => ({ ...current, enabled }))} label={"Enable signature for " + mailbox.address} />
                            </SettingRow>
                            <Field label="Default signature" hint={"Current default: " + defaultLabel}>
                              <select value={config.defaultSignatureId ?? ""} onChange={(event) => updateMailboxSignatureConfig(mailbox.id, (current) => ({ ...current, defaultSignatureId: event.target.value || null }))} disabled={!config.enabled}>
                                <option value="">No signature</option>
                                {preferences.signature.trim() && <option value="workspace-default">Workspace default</option>}
                                {config.signatures.map((signature) => <option key={signature.id} value={signature.id}>{signature.name}</option>)}
                              </select>
                            </Field>
                            {config.signatures.map((signature, index) => (
                              <div className="settings-domain-record" key={signature.id}>
                                <div className="settings-section-summary">
                                  <div><strong>Custom signature {index + 1}</strong><p>Reusable for sales, support, personal sign-offs, or other common cases.</p></div>
                                  <button className="mail-secondary-action" type="button" onClick={() => removeMailboxSignature(mailbox.id, signature.id)}>Remove</button>
                                </div>
                                <div className="settings-form-grid">
                                  <Field label="Signature name"><input value={signature.name} maxLength={80} required onChange={(event) => updateMailboxSignatureConfig(mailbox.id, (current) => ({ ...current, signatures: current.signatures.map((item) => item.id === signature.id ? { ...item, name: event.target.value } : item) }))} /></Field>
                                  <Field label="Signature text" hint="Plain text appended to the email body."><textarea rows={3} value={signature.content} maxLength={10000} onChange={(event) => updateMailboxSignatureConfig(mailbox.id, (current) => ({ ...current, signatures: current.signatures.map((item) => item.id === signature.id ? { ...item, content: event.target.value } : item) }))} /></Field>
                                </div>
                              </div>
                            ))}
                            <div className="settings-form-footer">
                              <span>{config.signatures.length} custom signature{config.signatures.length === 1 ? "" : "s"} saved in this mailbox&apos;s settings.</span>
                              <button className="mail-secondary-action" type="button" disabled={config.signatures.length >= 8} onClick={() => addMailboxSignature(mailbox.id)}>＋ Add signature</button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                  <div className="settings-form-footer"><span>Workspace preferences and per-mailbox signature choices are saved together for your account.</span><button className="mail-primary-action" type="submit">Save mail preferences</button></div>
                </form>
              </div>}

              {section === "notifications" && <div className="settings-notification-list">
                <SettingRow title="New messages" description="Enable the workspace preference for new-message alerts when alert delivery is available."><Toggle checked={preferences.notifications.newMail} onChange={(next) => updateNotification("newMail", next)} label="New messages" /></SettingRow>
                <SettingRow title="Workspace mentions" description="Save your preference for workspace mention alerts."><Toggle checked={preferences.notifications.mentions} onChange={(next) => updateNotification("mentions", next)} label="Workspace mentions" /></SettingRow>
                <SettingRow title="Product updates" description="Save your preference for ABEmail product updates."><Toggle checked={preferences.notifications.product} onChange={(next) => updateNotification("product", next)} label="Product updates" /></SettingRow>
                <SettingRow title="Weekly digest" description="Save your preference for a weekly activity digest."><Toggle checked={preferences.notifications.digest} onChange={(next) => updateNotification("digest", next)} label="Weekly digest" /></SettingRow>
                <div className="settings-info-banner"><span>i</span><p>These choices sync to this workspace for your account. Browser and weekly-digest notification delivery are not enabled yet.</p></div>
              </div>}

              {section === "team" && <div className="workspace-team-settings">
                <div className="settings-section-summary"><div><strong>Workspace membership</strong><p>{members.length} active member{members.length === 1 ? "" : "s"} in this organization</p></div><span className="settings-summary-chip">Live records</span></div>
                <div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>Member</th><th>Role</th><th>Status</th></tr></thead><tbody>{members.map((member) => <tr key={member.user_id}><td><strong>{member.user_id === userId ? "You" : "Workspace member"}</strong><small>{member.user_id === userId ? email : "Member ID " + member.user_id.slice(0, 8)}</small></td><td><span className="settings-role-pill">{member.role}</span></td><td><span className="settings-status active"><span />Active</span></td></tr>)}</tbody></table></div>

                <div className="settings-divider" />
                <div className="settings-section-summary"><div><strong>Invite a teammate</strong><p>Send an invitation email from this workspace&apos;s verified business address. Invitations expire after seven days.</p></div><span className="settings-summary-chip">{invitations.filter((invitation) => invitation.state === "pending").length} pending</span></div>
                {!providerStatus?.connected && <div className="settings-info-banner"><span>i</span><p>Connect Resend in Settings → Mail & compose, verify a sending domain and create an active mailbox before sending invitations.</p></div>}
                <form className="settings-domain-form" onSubmit={createInvitation}>
                  <Field label="Teammate email address"><input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@company.com" required maxLength={254} autoCapitalize="none" autoCorrect="off" disabled={!canManageWorkspace || inviteBusy} /></Field>
                  <Field label="Workspace role"><select value={inviteRole} onChange={(event) => { const nextRole = event.target.value as "admin" | "member"; setInviteRole(nextRole); if (nextRole === "admin") setInviteMailboxIds([]); }} disabled={!canManageWorkspace || inviteBusy}><option value="member">Member</option><option value="admin">Admin</option></select></Field>
                  {inviteRole === "admin" ? (
                    <div className="settings-info-banner"><span>i</span><p>Workspace admins have access to manage all mailboxes and workspace settings. Mailbox checkboxes apply only to regular Members.</p></div>
                  ) : (
                    <div className="settings-invite-mailbox-scope">
                      <p className="settings-subheading">Mailbox access</p>
                      <p className="settings-muted">Members will be granted access only to the mailboxes selected below.</p>
                      {mailboxes.length ? mailboxes.map((mailbox) => <label className="settings-radio-row" key={mailbox.id}><input type="checkbox" checked={inviteMailboxIds.includes(mailbox.id)} disabled={!canManageWorkspace || inviteBusy} onChange={(event) => setInviteMailboxIds((current) => event.target.checked ? [...current, mailbox.id] : current.filter((id) => id !== mailbox.id))} /><span><strong>{mailbox.address}</strong><small>{mailbox.display_name || "Active workspace mailbox"}</small></span></label>) : <p className="settings-muted">Create an active mailbox before inviting team members.</p>}
                    </div>
                  )}
                  <button className="mail-primary-action" type="submit" disabled={!canManageWorkspace || inviteBusy || mailboxes.length === 0 || (inviteRole === "member" && inviteMailboxIds.length === 0)}>{inviteBusy ? "Sending invitation…" : "Send invitation"}</button>
                </form>
                {invitationLink && <div className="settings-info-banner settings-invitation-link" role="status"><span>↗</span><div><strong>Invitation link available</strong><p>The email was not fully confirmed, or this link was also returned for manual sharing. Share it only with the intended recipient.</p><input value={invitationLink} readOnly aria-label="Invitation link" /><button type="button" className="mail-secondary-action" onClick={copyInvitationLink}>Copy invitation link</button></div></div>}

                <div className="settings-divider" />
                <div className="settings-section-summary"><div><strong>Invitations</strong><p>Sent, pending, accepted and expired invitations for this workspace.</p></div><button type="button" className="mail-secondary-action" onClick={() => { void refreshInvitations(); }}>Refresh</button></div>
                {invitationsLoading && <p className="settings-muted">Loading invitations…</p>}
                {!invitationsLoading && invitations.length === 0 && <div className="settings-empty-state"><strong>No invitations yet</strong><p>When you invite a teammate, its delivery and acceptance status will appear here.</p></div>}
                {invitations.length > 0 && <div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>Email</th><th>Role</th><th>Delivery</th><th>Invitation</th><th>Expires</th><th /></tr></thead><tbody>{invitations.map((invitation) => <tr key={invitation.id}><td><strong>{invitation.email}</strong><small>Mailboxes: {invitation.role === "admin" ? "Workspace-wide admin access" : invitation.mailboxAddresses.join(", ") || "None assigned"}</small>{invitation.deliveryErrorCode && <small>{invitation.deliveryErrorCode.replaceAll("_", " ")}</small>}</td><td><span className="settings-role-pill">{invitation.role}</span></td><td><span className={invitation.deliveryStatus === "sent" || invitation.deliveryStatus === "delivered" ? "settings-status active" : "settings-status pending"}><span />{invitation.deliveryStatus.replaceAll("_", " ")}</span></td><td><span className={invitation.state === "accepted" ? "settings-status active" : invitation.state === "pending" ? "settings-status pending" : "settings-status"}><span />{invitation.state}</span></td><td><time dateTime={invitation.expiresAt}>{new Date(invitation.expiresAt).toLocaleDateString()}</time></td><td>{invitation.state === "pending" && <button type="button" className="mail-secondary-action" onClick={() => { void revokeInvitation(invitation); }} disabled={!canManageWorkspace || revokingInvitationId === invitation.id}>{revokingInvitationId === invitation.id ? "Revoking…" : "Revoke"}</button>}</td></tr>)}</tbody></table></div>}
                <div className="settings-info-banner"><span>i</span><p>Invited users must create or sign into an ABEmail account using the invited email address, verify it, then accept the invitation. Members have access only to the workspace and mailboxes granted to them.</p></div>
              </div>}

              {section === "domains" && <div className="workspace-domains-settings">
                <div className="settings-section-summary"><div><strong>Business domains</strong><p>Add a domain to Resend, publish the requested DNS records at your registrar, then verify it here.</p></div><button className="mail-secondary-action" type="button" onClick={() => { void refreshDomains(); }}>Refresh status</button></div>
                {!providerStatus?.connected && <div className="settings-info-banner"><span>i</span><p>Connect Resend in Settings → Mail & compose before adding a domain. A Full Access key is required for domain setup and receiving webhooks.</p></div>}
                <form className="settings-domain-form" onSubmit={addDomain}>
                  <Field label="Domain name" hint="Enter the host you own, for example company.com. Do not include https:// or an email address."><input value={domainInput} onChange={(event) => setDomainInput(event.target.value)} placeholder="company.com" autoCapitalize="none" autoCorrect="off" required disabled={!canManageWorkspace || domainBusy} /></Field>
                  <button className="mail-primary-action" type="submit" disabled={!canManageWorkspace || domainBusy || !providerStatus?.connected}>{domainBusy ? "Adding…" : "Add domain"}</button>
                </form>
                {domainsLoading && <p className="settings-muted">Loading domain records…</p>}
                {!domainsLoading && domains.length === 0 && <div className="settings-empty-state"><strong>No domains configured</strong><p>Connect Resend and add a domain to start preparing business email.</p></div>}
                <div className="settings-domain-list">
                  {domains.map((domain) => (
                    <article className="settings-domain-record" key={domain.id}>
                      <div className="settings-domain-row">
                        <span className="settings-domain-icon">◎</span>
                        <span className="settings-domain-name"><strong>{domain.domain}</strong><small>{domain.status === "verified" ? "Verification confirmed by Resend" : "DNS setup required"}</small></span>
                        <span className={domain.status === "verified" ? "settings-status active" : "settings-status pending"}><span />{statusLabel(domain.status)}</span>
                        <button className="mail-secondary-action" type="button" onClick={() => { void verifyDomain(domain); }} disabled={!canManageWorkspace || verifyingDomainId === domain.id || (!providerStatus?.connected && !providerStatus?.environmentManaged)}>{verifyingDomainId === domain.id ? "Checking…" : domain.status === "verified" ? "Recheck DNS" : "Verify DNS"}</button>
                      </div>
                      {domain.status === "verified" && <div className="settings-domain-capabilities"><span className={domain.sendingEnabled ? "settings-status active" : "settings-status pending"}><span />Sending {domain.sendingEnabled ? "enabled" : "not enabled"}</span><span className={domain.receivingEnabled ? "settings-status active" : "settings-status pending"}><span />Receiving {domain.receivingEnabled ? "enabled" : "not enabled"}</span></div>}
                      {domain.dnsRecords?.length > 0 && <div className="settings-dns-records">
                        <p className="settings-subheading">DNS records to publish at your domain registrar</p>
                        <div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>Purpose</th><th>Type</th><th>Name / host</th><th>Value</th><th>State</th><th /></tr></thead>
                          <tbody>{domain.dnsRecords.map((record, index) => <tr key={(record.record ?? "dns") + "-" + (record.name ?? "") + "-" + index}>
                            <td>{record.record || "DNS"}</td><td>{record.type || "—"}</td><td><code>{record.name || "@"}</code></td>
                            <td><code className="settings-dns-value">{record.value || "—"}</code>{record.priority !== undefined && <small>Priority {record.priority}</small>}{record.ttl && <small>TTL {record.ttl}</small>}</td>
                            <td><span className={record.status === "verified" ? "settings-status active" : "settings-status pending"}><span />{statusLabel(record.status || "pending")}</span></td>
                            <td><button type="button" className="mail-secondary-action" onClick={() => { void copyDnsRecord(record); }}>Copy</button></td>
                          </tr>)}</tbody>
                        </table></div>
                        <p className="settings-muted">Add these exact records at the DNS provider for {domain.domain}. Leave existing mail records in place unless the DNS provider or your email migration plan says otherwise. DNS propagation may take time.</p>
                      </div>}
                      {domain.lastErrorCode && <p className="settings-muted">Latest check: {domain.lastErrorCode.replaceAll("_", " ")}</p>}
                    </article>
                  ))}
                </div>
              </div>}

              {section === "mailboxes" && <div className="workspace-mailboxes-settings">
                <div className="settings-section-summary mailbox-section-summary">
                  <div><strong>Business email addresses</strong><p>Create and manage addresses after their domain is verified and both send/receive capabilities are enabled.</p></div>
                  <button className="mail-secondary-action" type="button" onClick={() => { void refreshMailboxes(); }} disabled={mailboxesLoading}>{mailboxesLoading ? "Refreshing…" : "Refresh mailboxes"}</button>
                </div>
                {!providerStatus?.connected && !providerStatus?.environmentManaged && <div className="settings-info-banner"><span>i</span><p>Connect Resend first, then add and verify your domain in Settings → Domains.</p></div>}

                <section className="mailbox-editor-card" aria-labelledby="mailbox-editor-heading">
                  <div className="mailbox-editor-heading">
                    <div>
                      <p className="mail-overline">{editingMailboxId ? "EDIT EXISTING ADDRESS" : "NEW BUSINESS ADDRESS"}</p>
                      <h3 id="mailbox-editor-heading">{editingMailboxId ? "Edit mailbox details" : "Create a business email"}</h3>
                      <p>{editingMailboxId ? "Update the email address, domain or sender display name. Changing the address means the old address will stop reaching this mailbox." : "Choose the email address and the name recipients will see when you send a message."}</p>
                    </div>
                    {editingMailboxId && <button className="mail-secondary-action" type="button" onClick={cancelMailboxEdit} disabled={mailboxBusy}>Cancel edit</button>}
                  </div>
                  <form className="mailbox-editor-form" onSubmit={saveMailbox}>
                    <Field label="Address name" hint="The part before @, such as info, sales or hello.">
                      <input value={mailboxLocalPart} onChange={(event) => setMailboxLocalPart(event.target.value)} required maxLength={64} autoCapitalize="none" autoCorrect="off" disabled={!canManageWorkspace || mailboxBusy} />
                    </Field>
                    <Field label="Domain" hint={editingMailboxId ? "Address changes require a verified domain with sending and receiving enabled." : "Only verified domains with sending and receiving enabled can be selected."}>
                      <select value={mailboxDomainId} onChange={(event) => setMailboxDomainId(event.target.value)} required disabled={!canManageWorkspace || mailboxBusy || mailboxFormDomains.length === 0}>
                        <option value="">Select verified domain</option>
                        {mailboxFormDomains.map((domain) => <option key={domain.id} value={domain.id} disabled={domain.status !== "verified" || !domain.sendingEnabled || !domain.receivingEnabled}>{domain.domain}{domain.status === "verified" && domain.sendingEnabled && domain.receivingEnabled ? "" : " — not ready"}</option>)}
                      </select>
                    </Field>
                    <Field label="Display name" hint="The sender name recipients will see in their inbox.">
                      <input value={mailboxName} onChange={(event) => setMailboxName(event.target.value)} placeholder={organizationName} maxLength={120} disabled={!canManageWorkspace || mailboxBusy} />
                    </Field>
                    <div className="mailbox-editor-actions">
                      {editingMailboxId && <button className="mail-secondary-action" type="button" onClick={cancelMailboxEdit} disabled={mailboxBusy}>Cancel</button>}
                      <button className="mail-primary-action" type="submit" disabled={!canManageWorkspace || mailboxBusy || mailboxFormDomains.length === 0 || !providerStatus?.connected}>
                        {mailboxBusy ? (editingMailboxId ? "Saving…" : "Creating…") : editingMailboxId ? "Save changes" : "Create mailbox"}
                      </button>
                    </div>
                  </form>
                </section>

                {verifiedReceivingDomains.length === 0 && <p className="settings-muted">No verified domain with sending and receiving enabled is available. Complete domain verification before creating an address.</p>}
                <div className="mailbox-list-heading">
                  <div><h3>Configured mailboxes</h3><p>{mailboxRows.length} address{mailboxRows.length === 1 ? "" : "es"} in this workspace</p></div>
                </div>
                {mailboxesLoading && <p className="settings-muted">Loading mailbox status…</p>}
                {!mailboxesLoading && mailboxRows.length === 0 && <div className="settings-empty-state"><strong>No mailboxes yet</strong><p>Your active email addresses will appear here. Use the form above to create the first address.</p></div>}
                {mailboxRows.length > 0 && <div className="settings-table-wrap mailbox-table-wrap"><table className="settings-table mailbox-settings-table"><thead><tr><th>Address</th><th>Display name</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{mailboxRows.map((mailbox) => <tr key={mailbox.id} className={editingMailboxId === mailbox.id ? "mailbox-row-editing" : undefined}><td><strong>{mailbox.address}</strong><small>Created {new Date(mailbox.created_at).toLocaleDateString()}</small></td><td>{mailbox.display_name || <span className="settings-table-empty">Not set</span>}</td><td><span className={mailbox.status === "active" ? "settings-status active" : "settings-status pending"}><span />{statusLabel(mailbox.status)}</span></td><td><button className="mail-secondary-action mailbox-edit-action" type="button" onClick={() => startEditMailbox(mailbox)} disabled={!canManageWorkspace || mailboxBusy || mailbox.status !== "active"}>{editingMailboxId === mailbox.id ? "Editing…" : "Edit"}</button></td></tr>)}</tbody></table></div>}
                <div className="settings-info-banner"><span>i</span><p>Incoming email is delivered into ABEmail through the workspace&apos;s signed Resend webhook. If you change an address or domain, the previous address will no longer be assigned to this mailbox.</p></div>
                <div className="settings-divider" />
                <div className="settings-section-summary"><div><strong>Address aliases</strong><p>Alias addresses will route additional addresses such as hello@, sales@, or support@ into the appropriate mailbox.</p></div></div>
                <div className="settings-empty-state"><strong>Alias routing is not configured</strong><p>Alias creation and inbound routing depend on the email transport and DNS routing design. Mailbox management remains available above.</p></div>
              </div>}

              {section === "rules" && <div>
                <div className="settings-section-summary"><div><strong>Incoming rules</strong><p>Rules will run after incoming message ownership and authorization checks.</p></div></div>
                <div className="settings-empty-state"><strong>No rules configured</strong><p>Rule creation, ordering, labels, and deterministic message actions are part of the Phase 2 automation work. No rule is being applied to incoming mail from this screen.</p></div>
              </div>}

              {section === "out-of-office" && <div>
                <div className="settings-section-summary"><div><strong>Automatic replies</strong><p>Set a date range and message for periods when you are away.</p></div></div>
                <div className="settings-empty-state"><strong>Automatic replies are not active</strong><p>Start/end scheduling, repeated-reply protection, and loop prevention must be implemented before this setting can send responses. Nothing is automatically replied to from this screen.</p></div>
              </div>}

              {section === "branding" && <div className="workspace-profile-settings"><p className="settings-muted">Workspace identity now lives in Workspace Profile.</p><Link href={settingsBase} className="mail-secondary-action">Open Workspace Profile</Link></div>}

              {section === "integrations" && <div>
                <div className="settings-section-summary"><div><strong>Connected services</strong><p>Provider setup and future calendar/CRM integrations for this workspace.</p></div></div>
                <div className="settings-domain-list">
                  <article className="settings-domain-record"><div className="settings-domain-row"><span className="settings-domain-icon">✉</span><span className="settings-domain-name"><strong>Resend</strong><small>Current email delivery provider</small></span><Link href={settingsBase + "/mail"} className="mail-secondary-action">Mail & compose</Link></div></article>
                  <div className="settings-info-banner"><span>i</span><p>Calendar, CRM, and cloud-storage connectors require their own secure OAuth/token flows and are tracked in the integrations roadmap. No external account is connected from this page.</p></div>
                </div>
              </div>}

              {section === "security" && <div>
                <div className="settings-security-card"><span className="settings-security-icon">◇</span><div><strong>Signed in to ABEmail</strong><p>{email || "Current authenticated account"} · Workspace role: {organizationRole}</p></div><span className="settings-summary-chip">Authenticated</span></div>
                <SettingRow title="Workspace switching" description="Switching organizations keeps this account session active; access is rechecked for each workspace."><span className="settings-status active"><span />Membership checked</span></SettingRow>
                <SettingRow title="Sign out" description="Sign out from the workspace switcher at the bottom of the left sidebar."><span className="settings-muted">Available in the workspace menu</span></SettingRow>
                <div className="settings-info-banner"><span>i</span><p>Sessions, multi-factor settings, and audit history require identity-provider support and are not separately managed here yet.</p></div>
              </div>}
            </section>
          </div>
          {toast && <div className="mail-toast settings-toast" role="status"><span>i</span>{toast}<button type="button" aria-label="Dismiss notice" onClick={() => setToast("")}>×</button></div>}
        </div>
    </div>
  );
}
