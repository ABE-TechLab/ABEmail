"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import SignOutButton from "@/components/auth/sign-out-button";
import WorkspaceSidebar, { type WorkspaceChoice } from "@/components/workspace-sidebar";
import { useAppearanceMode, type AppearanceMode } from "@/components/appearance-provider";
import { useDesignTheme } from "@/components/design-theme-provider";
import { DESIGN_THEMES, type DesignThemeId } from "@/lib/design-system";

export type WorkspaceSettingsContext = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationRole: string;
  email: string;
  userId: string;
  workspaces: WorkspaceChoice[];
  mailboxes: { id: string; address: string; display_name: string | null }[];
  members: { user_id: string; role: string; status: string }[];
};

export type WorkspacePreferenceValues = {
  timezone: string;
  language: string;
  font: string;
  signature: string;
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

const SETTINGS_KEY = "abemail:workspace-settings:";
const COMPACT_KEY = "abemail:compact-message-list";

const DEFAULT_PREFERENCES: WorkspacePreferenceValues = {
  timezone: "Africa/Lagos",
  language: "en",
  font: "sans",
  signature: "",
  replyStyle: "reply",
  compactMessageList: false,
  notifications: { newMail: true, mentions: true, product: false, digest: false },
};

const SECTIONS = [
  { id: "general", label: "General", icon: "⚙", group: "PREFERENCES" },
  { id: "appearance", label: "Appearance", icon: "◐", group: "PREFERENCES" },
  { id: "mail", label: "Mail & compose", icon: "✉", group: "PREFERENCES" },
  { id: "notifications", label: "Notifications", icon: "♧", group: "PREFERENCES" },
  { id: "team", label: "Team & access", icon: "♙", group: "WORKSPACE" },
  { id: "domains", label: "Domains", icon: "◎", group: "WORKSPACE" },
  { id: "mailboxes", label: "Mailboxes", icon: "▤", group: "WORKSPACE" },
  { id: "security", label: "Security", icon: "◇", group: "ACCESS" },
] as const;

const SECTION_INFO: Record<string, { title: string; description: string }> = {
  general: { title: "General", description: "Workspace identity and regional preferences." },
  appearance: { title: "Appearance", description: "Personalize the workspace shell and message list." },
  mail: { title: "Mail & compose", description: "Connect your mail provider and configure writing preferences." },
  notifications: { title: "Notifications", description: "Save your notification preferences for this workspace." },
  team: { title: "Team & access", description: "Review the active membership grants for this workspace." },
  domains: { title: "Domains", description: "Connect a custom domain, add its DNS records, and verify it with Resend." },
  mailboxes: { title: "Mailboxes", description: "Create real addresses on verified domains in this workspace." },
  security: { title: "Security", description: "Review your current access and account-session controls." },
};

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
  section,
  organizationId,
  organizationName,
  organizationSlug,
  organizationRole,
  email,
  userId,
  workspaces,
  mailboxes,
  members,
}: WorkspaceSettingsContext & { section: string }) {
  const router = useRouter();
  const { mode, setMode } = useAppearanceMode();
  const { theme: activeDesignTheme, setTheme: setDesignTheme } = useDesignTheme();
  const [displayName, setDisplayName] = useState(organizationName);
  const [preferences, setPreferences] = useState<WorkspacePreferenceValues>(DEFAULT_PREFERENCES);
  const [compactMessageList, setCompactMessageList] = useState(false);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [providerKey, setProviderKey] = useState("");
  const [providerLoading, setProviderLoading] = useState(false);
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
  const [disconnectBusy, setDisconnectBusy] = useState(false);

  const base = "/dashboard/" + organizationId;
  const settingsBase = base + "/settings";
  const liveMailAvailable = mailboxes.length > 0;
  const info = SECTION_INFO[section] ?? SECTION_INFO.general;
  const canManageWorkspace = organizationRole === "owner" || organizationRole === "admin";
  const verifiedReceivingDomains = domains.filter((domain) => domain.status === "verified" && domain.sendingEnabled && domain.receivingEnabled);

  useEffect(() => {
    setDisplayName(organizationName);
  }, [organizationName]);

  useEffect(() => {
    let active = true;
    let localPreferences: Partial<WorkspacePreferenceValues> = {};
    try {
      const stored = window.localStorage.getItem(SETTINGS_KEY + organizationId);
      if (stored) localPreferences = JSON.parse(stored) as Partial<WorkspacePreferenceValues>;
      if (active) {
        const local = {
          ...DEFAULT_PREFERENCES,
          ...localPreferences,
          compactMessageList: localPreferences.compactMessageList ?? window.localStorage.getItem(COMPACT_KEY) === "true",
          notifications: { ...DEFAULT_PREFERENCES.notifications, ...(localPreferences.notifications ?? {}) },
        };
        setPreferences(local);
        setCompactMessageList(local.compactMessageList);
      }
    } catch {
      // Browser storage is only a fallback; the server remains the source of truth.
    }

    void (async () => {
      try {
        const response = await fetch("/api/organizations/" + organizationId + "/preferences", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { preferences?: Partial<WorkspacePreferenceValues> };
        const saved = result.preferences ?? {};
        const hasServerPreferences = Object.keys(saved).length > 0;
        const base = hasServerPreferences ? saved : localPreferences;
        const loaded: WorkspacePreferenceValues = {
          ...DEFAULT_PREFERENCES,
          ...base,
          notifications: { ...DEFAULT_PREFERENCES.notifications, ...(base.notifications ?? {}) },
        };
        if (!active) return;
        setPreferences(loaded);
        setCompactMessageList(loaded.compactMessageList);
        try {
          window.localStorage.setItem(SETTINGS_KEY + organizationId, JSON.stringify(loaded));
          window.localStorage.setItem(COMPACT_KEY, String(loaded.compactMessageList));
        } catch {
          // Server preferences are still loaded even if browser storage is blocked.
        }
        if (!hasServerPreferences && Object.keys(localPreferences).length > 0) {
          await fetch("/api/organizations/" + organizationId + "/preferences", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(loaded),
          });
        }
      } catch {
        // Keep local preferences available if the preference endpoint is temporarily unreachable.
      }
    })();

    return () => { active = false; };
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
    if (section === "mail") void refreshProviderStatus(false);
    if (section === "domains") {
      void refreshProviderStatus(false);
      void refreshDomains(false);
    }
    if (section === "mailboxes") {
      void refreshProviderStatus(false);
      void refreshDomains(false);
      void refreshMailboxes(false);
    }
    // The active section drives only its own remote reads.
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

  async function createMailbox(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageWorkspace) return notify("Only workspace owners and admins can create mailboxes.");
    setMailboxBusy(true);
    setToast("");
    try {
      const response = await fetch("/api/organizations/" + organizationId + "/mailboxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localPart: mailboxLocalPart, domainId: mailboxDomainId, displayName: mailboxName }),
      });
      const result = await response.json() as { ok?: boolean; mailbox?: WorkspaceMailbox; error?: string; note?: string };
      if (!response.ok || !result.ok) {
        notify(result.error || "Mailbox could not be created.");
        return;
      }
      setMailboxName("");
      await refreshMailboxes(false);
      router.refresh();
      notify(result.note || "Mailbox created.");
    } catch {
      notify("Mailbox could not be created. Check your connection and retry.");
    } finally {
      setMailboxBusy(false);
    }
  }

  return (
    <div className="mail-app workspace-settings-app">
      <WorkspaceSidebar
        homeHref={liveMailAvailable ? base + "/mail" : base}
        mailboxBaseHref={base + "/mail"}
        enabledMailboxViews={liveMailAvailable ? ["Inbox", "Sent"] : []}
        disabledMailFeatures={!liveMailAvailable}
        activeView="Inbox"
        workspaceBaseHref={base}
        workspaceName={organizationName}
        workspaceDescription={organizationRole + " workspace"}
        workspaces={workspaces}
        activeWorkspaceId={organizationId}
        disableContacts
      />
      <main className="mail-main">
        <header className="mail-topbar">
          <div className="mail-breadcrumb"><Link href={base}>Workspace</Link><span className="mail-breadcrumb-slash">/</span><strong>{info.title}</strong></div>
          <div className="settings-topbar-title">{organizationName}</div>
          <div className="mail-topbar-right"><span className="settings-role-pill">{organizationRole}</span><span className="mail-user-avatar" title={email}>{email.split("@")[0].slice(0, 2).toUpperCase() || "U"}</span><SignOutButton className="auth-signout-control" /></div>
        </header>

        <div className="settings-page-scroll">
          <div className="settings-page-heading"><div><p className="mail-overline">WORKSPACE SETTINGS</p><h1>Settings</h1><p>Changes are scoped to {organizationName}; workspace switching does not sign you out.</p></div><span className="settings-preview-chip"><span /> Workspace connected</span></div>
          <div className="settings-layout">
            <nav className="settings-navigation" aria-label="Settings sections">
              {(["PREFERENCES", "WORKSPACE", "ACCESS"] as const).map((group) => (
                <div className="settings-nav-group" key={group}>
                  <p>{group}</p>
                  {SECTIONS.filter((item) => item.group === group).map((item) => {
                    const href = item.id === "general" ? settingsBase : settingsBase + "/" + item.id;
                    return <Link className={section === item.id ? "settings-nav-link active" : "settings-nav-link"} key={item.id} href={href} aria-current={section === item.id ? "page" : undefined}><span aria-hidden="true">{item.icon}</span>{item.label}</Link>;
                  })}
                </div>
              ))}
            </nav>

            <section className="settings-panel" aria-labelledby="settings-heading">
              <header className="settings-panel-heading"><div><h2 id="settings-heading">{info.title}</h2><p>{info.description}</p></div></header>

              {section === "general" && <form onSubmit={saveGeneral}>
                <div className="settings-form-grid">
                  <Field label="Workspace name" hint="Saved to the organization when your role permits it."><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={80} required /></Field>
                  <Field label="Language"><select value={preferences.language} onChange={(event) => setPreferences((current) => ({ ...current, language: event.target.value }))}><option value="en">English</option><option value="fr">French</option><option value="pt">Portuguese</option></select></Field>
                  <Field label="Time zone" hint="Used for message timestamps in this workspace."><select value={preferences.timezone} onChange={(event) => setPreferences((current) => ({ ...current, timezone: event.target.value }))}><option value="Africa/Lagos">Africa/Lagos (WAT)</option><option value="UTC">UTC</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New York</option><option value="America/Toronto">America/Toronto</option></select></Field>
                </div>
                <div className="settings-info-banner"><span>i</span><p>Regional preferences sync to this workspace. Workspace name changes are saved to the organization when authorized by your role.</p></div>
                <div className="settings-form-footer"><span>Workspace: {organizationSlug}</span><button className="mail-primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
              </form>}

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
                    <input type="password" autoComplete="new-password" value={providerKey} onChange={(event) => setProviderKey(event.target.value)} placeholder="re_…" minLength={12} maxLength={512} required disabled={!canManageWorkspace || providerBusy} />
                  </Field>
                  <button className="mail-primary-action" type="submit" disabled={!canManageWorkspace || providerBusy}>{providerBusy ? "Connecting…" : providerStatus?.connected ? "Replace connection" : "Connect Resend"}</button>
                </form>
                <p className="settings-muted">The key is validated against Resend and encrypted before it is stored. ABEmail also registers a signed webhook for this workspace so inbound messages and delivery events can be processed.</p>
                {providerStatus?.lastErrorCode && <p className="settings-muted">Last provider warning: {providerStatus.lastErrorCode.replaceAll("_", " ")}</p>}
                {providerStatus?.connected && <div className="settings-form-footer"><span>Connected {providerStatus.connectedAt ? "on " + new Date(providerStatus.connectedAt).toLocaleDateString() : "to this workspace"}.</span><button className="mail-secondary-action" type="button" disabled={!canManageWorkspace || disconnectBusy} onClick={disconnectResend}>{disconnectBusy ? "Disconnecting…" : "Disconnect Resend"}</button></div>}
                <div className="settings-divider" />
                <form onSubmit={saveMailPreferences}>
                  <p className="settings-subheading">Mail & compose preferences</p>
                  <Field label="Default writing font"><select value={preferences.font} onChange={(event) => setPreferences((current) => ({ ...current, font: event.target.value }))}><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="mono">Monospace</option></select></Field>
                  <div className="settings-divider" />
                  <div className="settings-choice-group"><p className="settings-subheading">When replying</p><label className="settings-radio-row"><input type="radio" name="workspace-reply-style" value="reply" checked={preferences.replyStyle === "reply"} onChange={() => setPreferences((current) => ({ ...current, replyStyle: "reply" }))} /><span><strong>Reply above the quoted message</strong><small>Start writing before the original message.</small></span></label><label className="settings-radio-row"><input type="radio" name="workspace-reply-style" value="bottom" checked={preferences.replyStyle === "bottom"} onChange={() => setPreferences((current) => ({ ...current, replyStyle: "bottom" }))} /><span><strong>Reply below the quoted message</strong><small>Place the cursor after the quoted original message.</small></span></label></div>
                  <Field label="Email signature" hint="Added to outgoing messages from this workspace."><textarea rows={4} value={preferences.signature} onChange={(event) => setPreferences((current) => ({ ...current, signature: event.target.value }))} /></Field>
                  <div className="settings-form-footer"><span>Mail preferences sync to your account in this workspace and apply to compose/reply.</span><button className="mail-primary-action" type="submit">Save mail preferences</button></div>
                </form>
              </div>}

              {section === "notifications" && <div className="settings-notification-list">
                <SettingRow title="New messages" description="Enable the workspace preference for new-message alerts when alert delivery is available."><Toggle checked={preferences.notifications.newMail} onChange={(next) => updateNotification("newMail", next)} label="New messages" /></SettingRow>
                <SettingRow title="Workspace mentions" description="Save your preference for workspace mention alerts."><Toggle checked={preferences.notifications.mentions} onChange={(next) => updateNotification("mentions", next)} label="Workspace mentions" /></SettingRow>
                <SettingRow title="Product updates" description="Save your preference for ABEmail product updates."><Toggle checked={preferences.notifications.product} onChange={(next) => updateNotification("product", next)} label="Product updates" /></SettingRow>
                <SettingRow title="Weekly digest" description="Save your preference for a weekly activity digest."><Toggle checked={preferences.notifications.digest} onChange={(next) => updateNotification("digest", next)} label="Weekly digest" /></SettingRow>
                <div className="settings-info-banner"><span>i</span><p>These choices sync to this workspace for your account. Browser and weekly-digest notification delivery are not enabled yet.</p></div>
              </div>}

              {section === "team" && <div>
                <div className="settings-section-summary"><div><strong>Workspace membership</strong><p>{members.length} active membership record{members.length === 1 ? "" : "s"} returned for this organization</p></div><span className="settings-summary-chip">Live records</span></div>
                <div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>Member</th><th>Role</th><th>Status</th></tr></thead><tbody>{members.map((member) => <tr key={member.user_id}><td><strong>{member.user_id === userId ? "You" : "Workspace member"}</strong><small>{member.user_id === userId ? email : "Member ID " + member.user_id.slice(0, 8)}</small></td><td><span className="settings-role-pill">{member.role}</span></td><td><span className="settings-status active"><span />Active</span></td></tr>)}</tbody></table></div>
                <div className="settings-info-banner"><span>i</span><p>Memberships above come from the workspace database. Sending invitations and changing another member's role are not enabled from this screen yet.</p></div>
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
                <div className="settings-section-summary"><div><strong>Business email addresses</strong><p>Create an address after its domain is verified and both send/receive capabilities are enabled.</p></div><button className="mail-secondary-action" type="button" onClick={() => { void refreshMailboxes(); }}>Refresh mailboxes</button></div>
                {!providerStatus?.connected && !providerStatus?.environmentManaged && <div className="settings-info-banner"><span>i</span><p>Connect Resend first, then add and verify your domain in Settings → Domains.</p></div>}
                <form className="settings-domain-form" onSubmit={createMailbox}>
                  <Field label="Address name" hint="This is the part before @, for example info, sales, or hello."><input value={mailboxLocalPart} onChange={(event) => setMailboxLocalPart(event.target.value)} required maxLength={64} autoCapitalize="none" autoCorrect="off" disabled={!canManageWorkspace || mailboxBusy} /></Field>
                  <Field label="Domain"><select value={mailboxDomainId} onChange={(event) => setMailboxDomainId(event.target.value)} required disabled={!canManageWorkspace || mailboxBusy || verifiedReceivingDomains.length === 0}><option value="">Select verified domain</option>{verifiedReceivingDomains.map((domain) => <option key={domain.id} value={domain.id}>{domain.domain}</option>)}</select></Field>
                  <Field label="Display name"><input value={mailboxName} onChange={(event) => setMailboxName(event.target.value)} placeholder={organizationName} maxLength={120} disabled={!canManageWorkspace || mailboxBusy} /></Field>
                  <button className="mail-primary-action" type="submit" disabled={!canManageWorkspace || mailboxBusy || verifiedReceivingDomains.length === 0 || !providerStatus?.connected}>{mailboxBusy ? "Creating…" : "Create mailbox"}</button>
                </form>
                {verifiedReceivingDomains.length === 0 && <p className="settings-muted">No verified domain with sending and receiving enabled is available. Complete domain verification before creating an address.</p>}
                {mailboxesLoading && <p className="settings-muted">Loading mailbox status…</p>}
                {!mailboxesLoading && mailboxRows.length === 0 && <div className="settings-empty-state"><strong>No mailboxes yet</strong><p>Your active email addresses will appear here once created.</p></div>}
                {mailboxRows.length > 0 && <div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>Address</th><th>Display name</th><th>Status</th></tr></thead><tbody>{mailboxRows.map((mailbox) => <tr key={mailbox.id}><td><strong>{mailbox.address}</strong><small>Mailbox ID {mailbox.id.slice(0, 8)}</small></td><td>{mailbox.display_name || "—"}</td><td><span className={mailbox.status === "active" ? "settings-status active" : "settings-status pending"}><span />{statusLabel(mailbox.status)}</span></td></tr>)}</tbody></table></div>}
                <div className="settings-info-banner"><span>i</span><p>Incoming email is delivered into ABEmail through the workspace's signed Resend webhook. Sending and receiving are dependent on the domain capabilities and DNS records shown in Settings → Domains.</p></div>
              </div>}

              {section === "security" && <div>
                <div className="settings-security-card"><span className="settings-security-icon">◇</span><div><strong>Signed in to ABEmail</strong><p>{email || "Current authenticated account"} · Workspace role: {organizationRole}</p></div><span className="settings-summary-chip">Authenticated</span></div>
                <SettingRow title="Workspace switching" description="Switching organizations keeps this account session active; access is rechecked for each workspace."><span className="settings-status active"><span />Membership checked</span></SettingRow>
                <SettingRow title="Sign out" description="Sign out of the ABEmail account across all workspaces."><SignOutButton className="mail-secondary-action" /></SettingRow>
                <div className="settings-info-banner"><span>i</span><p>Sessions, multi-factor settings, and audit history require identity-provider support and are not separately managed here yet.</p></div>
              </div>}
            </section>
          </div>
          {toast && <div className="mail-toast settings-toast" role="status"><span>i</span>{toast}<button type="button" aria-label="Dismiss notice" onClick={() => setToast("")}>×</button></div>}
        </div>
      </main>
    </div>
  );
}
