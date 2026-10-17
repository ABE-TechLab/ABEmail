"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
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
  notifications: { newMail: boolean; mentions: boolean; product: boolean; digest: boolean };
};

const SETTINGS_KEY = "abemail:workspace-settings:";
const COMPACT_KEY = "abemail:compact-message-list";

const DEFAULT_PREFERENCES: WorkspacePreferenceValues = {
  timezone: "Africa/Lagos",
  language: "en",
  font: "sans",
  signature: "",
  replyStyle: "reply",
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
  mail: { title: "Mail & compose", description: "Set the defaults used when writing and replying to email." },
  notifications: { title: "Notifications", description: "Save your notification preferences for this workspace." },
  team: { title: "Team & access", description: "Review the active membership grants for this workspace." },
  domains: { title: "Domains", description: "Review the domains used by active workspace mailboxes." },
  mailboxes: { title: "Mailboxes", description: "Review the active mailboxes returned by the workspace database." },
  security: { title: "Security", description: "Review your current access and account-session controls." },
};

const APPEARANCE_MODES: { id: AppearanceMode; label: string; glyph: string }[] = [
  { id: "light", label: "Light", glyph: "☼" },
  { id: "dark", label: "Dark", glyph: "☾" },
  { id: "system", label: "System", glyph: "◐" },
];

function SettingRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="settings-row"><div className="settings-row-copy"><strong>{title}</strong><p>{description}</p></div><div className="settings-row-control">{children}</div></div>;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="settings-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={checked ? "settings-toggle checked" : "settings-toggle"} onClick={() => onChange(!checked)}><span /></button>;
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

  const base = "/dashboard/" + organizationId;
  const settingsBase = base + "/settings";
  const liveMailAvailable = organizationSlug === "ottawa-snow-match" && mailboxes.length > 0;
  const info = SECTION_INFO[section] ?? SECTION_INFO.general;

  useEffect(() => {
    setDisplayName(organizationName);
  }, [organizationName]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SETTINGS_KEY + organizationId);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<WorkspacePreferenceValues>;
        setPreferences({
          ...DEFAULT_PREFERENCES,
          ...parsed,
          notifications: { ...DEFAULT_PREFERENCES.notifications, ...(parsed.notifications ?? {}) },
        });
      }
      setCompactMessageList(window.localStorage.getItem(COMPACT_KEY) === "true");
    } catch {
      // The workspace remains usable with defaults when browser storage is blocked.
    }
  }, [organizationId]);

  function notify(message: string) {
    setToast(message);
  }

  function storePreferences(next = preferences): boolean {
    try {
      window.localStorage.setItem(SETTINGS_KEY + organizationId, JSON.stringify(next));
      setPreferences(next);
      return true;
    } catch {
      notify("Your browser could not save this preference. Check its storage settings and try again.");
      return false;
    }
  }

  function updateCompact(next: boolean) {
    setCompactMessageList(next);
    try {
      window.localStorage.setItem(COMPACT_KEY, String(next));
      notify(next ? "Compact message list enabled in the mailbox." : "Standard message list enabled in the mailbox.");
    } catch {
      notify("Your browser could not save the message-list preference.");
    }
  }

  async function saveGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setToast("");
    if (!storePreferences()) {
      setSaving(false);
      return;
    }

    const nextName = displayName.trim();
    if (nextName.length < 2 || nextName.length > 80) {
      setSaving(false);
      notify("Workspace name must contain between 2 and 80 characters.");
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
        notify("Workspace name updated. Regional preferences are saved in this browser.");
      } catch {
        notify("The workspace name could not be saved because the connection failed.");
      } finally {
        setSaving(false);
      }
      return;
    }

    notify("Regional preferences saved for this workspace in this browser.");
    setSaving(false);
  }

  function saveMailPreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (storePreferences()) notify("Mail and compose preferences saved. The live mailbox will use them on this browser.");
  }

  function updateNotification(key: keyof WorkspacePreferenceValues["notifications"], value: boolean) {
    const next = { ...preferences, notifications: { ...preferences.notifications, [key]: value } };
    if (storePreferences(next)) notify("Notification preference saved for this workspace in this browser.");
  }

  const usedDomains = [...new Set(mailboxes.map((mailbox) => mailbox.address.split("@")[1]).filter((domain): domain is string => Boolean(domain)))];

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
                <div className="settings-info-banner"><span>i</span><p>Regional preferences are stored per workspace in this browser. Workspace name changes are saved to the organization when authorized by your role.</p></div>
                <div className="settings-form-footer"><span>Workspace: {organizationSlug}</span><button className="mail-primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
              </form>}

              {section === "appearance" && <div>
                <div className="settings-choice-group"><p className="settings-subheading">Light and dark mode</p><p className="settings-muted">Choose whether ABEmail follows your preference or your device setting.</p><div className="settings-theme-options">{APPEARANCE_MODES.map((item) => <button key={item.id} type="button" aria-pressed={mode === item.id} className={mode === item.id ? "settings-theme-choice selected" : "settings-theme-choice"} onClick={() => { setMode(item.id); notify(item.label + " mode applied."); }}><span className="settings-theme-preview">{item.glyph}</span><span>{item.label}</span>{mode === item.id && <b>✓</b>}</button>)}</div></div>
                <div className="settings-divider" />
                <div className="settings-choice-group"><p className="settings-subheading">Design system palette</p><p className="settings-muted">Apply a shared ABE TechLab palette to the workspace UI.</p><label className="settings-field settings-palette-field"><span>Color palette</span><select className="settings-palette-select" value={activeDesignTheme} onChange={(event) => { const nextTheme = event.target.value as DesignThemeId; setDesignTheme(nextTheme); notify((DESIGN_THEMES.find((option) => option.value === nextTheme)?.name ?? "Selected") + " palette applied."); }}>{DESIGN_THEMES.map((option) => <option key={option.value} value={option.value}>{option.name}</option>)}</select></label></div>
                <div className="settings-divider" />
                <SettingRow title="Compact message list" description="Show more messages in the active mailbox list."><Toggle checked={compactMessageList} onChange={updateCompact} label="Compact message list" /></SettingRow>
                <div className="settings-form-footer"><span>Appearance mode and palette are user-wide; message density is saved in this browser.</span><span className="settings-status active"><span />Applied</span></div>
              </div>}

              {section === "mail" && <form onSubmit={saveMailPreferences}>
                <Field label="Default writing font"><select value={preferences.font} onChange={(event) => setPreferences((current) => ({ ...current, font: event.target.value }))}><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="mono">Monospace</option></select></Field>
                <div className="settings-divider" />
                <div className="settings-choice-group"><p className="settings-subheading">When replying</p><label className="settings-radio-row"><input type="radio" name="workspace-reply-style" value="reply" checked={preferences.replyStyle === "reply"} onChange={() => setPreferences((current) => ({ ...current, replyStyle: "reply" }))} /><span><strong>Reply above the quoted message</strong><small>Start writing before the original message.</small></span></label><label className="settings-radio-row"><input type="radio" name="workspace-reply-style" value="bottom" checked={preferences.replyStyle === "bottom"} onChange={() => setPreferences((current) => ({ ...current, replyStyle: "bottom" }))} /><span><strong>Reply below the quoted message</strong><small>Place the cursor after the quoted original message.</small></span></label></div>
                <Field label="Email signature" hint="Added to outgoing messages from this workspace."><textarea rows={4} value={preferences.signature} onChange={(event) => setPreferences((current) => ({ ...current, signature: event.target.value }))} /></Field>
                <div className="settings-form-footer"><span>These preferences are applied to the live compose and reply flow.</span><button className="mail-primary-action" type="submit">Save mail preferences</button></div>
              </form>}

              {section === "notifications" && <div className="settings-notification-list">
                <SettingRow title="New messages" description="Enable the workspace preference for new-message alerts when alert delivery is available."><Toggle checked={preferences.notifications.newMail} onChange={(next) => updateNotification("newMail", next)} label="New messages" /></SettingRow>
                <SettingRow title="Workspace mentions" description="Save your preference for workspace mention alerts."><Toggle checked={preferences.notifications.mentions} onChange={(next) => updateNotification("mentions", next)} label="Workspace mentions" /></SettingRow>
                <SettingRow title="Product updates" description="Save your preference for ABEmail product updates."><Toggle checked={preferences.notifications.product} onChange={(next) => updateNotification("product", next)} label="Product updates" /></SettingRow>
                <SettingRow title="Weekly digest" description="Save your preference for a weekly activity digest."><Toggle checked={preferences.notifications.digest} onChange={(next) => updateNotification("digest", next)} label="Weekly digest" /></SettingRow>
                <div className="settings-info-banner"><span>i</span><p>These choices are saved per workspace in this browser. ABEmail does not yet dispatch browser or weekly-digest notifications.</p></div>
              </div>}

              {section === "team" && <div>
                <div className="settings-section-summary"><div><strong>Workspace membership</strong><p>{members.length} active membership record{members.length === 1 ? "" : "s"} returned for this organization</p></div><span className="settings-summary-chip">Live records</span></div>
                <div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>Member</th><th>Role</th><th>Status</th></tr></thead><tbody>{members.map((member) => <tr key={member.user_id}><td><strong>{member.user_id === userId ? "You" : "Workspace member"}</strong><small>{member.user_id === userId ? email : "Member ID " + member.user_id.slice(0, 8)}</small></td><td><span className="settings-role-pill">{member.role}</span></td><td><span className="settings-status active"><span />Active</span></td></tr>)}</tbody></table></div>
                <div className="settings-info-banner"><span>i</span><p>Memberships above come from the workspace database. Sending invitations and changing another member's role are not enabled from this screen yet.</p></div>
              </div>}

              {section === "domains" && <div>
                {usedDomains.length ? <div className="settings-domain-list">{usedDomains.map((domain) => <div className="settings-domain-row" key={domain}><span className="settings-domain-icon">◎</span><span className="settings-domain-name"><strong>{domain}</strong><small>Used by an active mailbox in this workspace</small></span><span className="settings-status active"><span />In use</span></div>)}</div> : <div className="settings-empty-state"><strong>No active mailbox domain</strong><p>A domain will appear here when this workspace has an active mailbox address.</p></div>}
                <div className="settings-info-banner"><span>i</span><p>This list is derived from active mailbox addresses. DNS checks, domain verification status, and domain provisioning are not exposed by the current settings backend.</p></div>
              </div>}

              {section === "mailboxes" && <div>
                {mailboxes.length ? <div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>Mailbox</th><th>Display name</th><th>Status</th></tr></thead><tbody>{mailboxes.map((mailbox) => <tr key={mailbox.id}><td><strong>{mailbox.address}</strong><small>Mailbox ID {mailbox.id.slice(0, 8)}</small></td><td>{mailbox.display_name || "—"}</td><td><span className="settings-status active"><span />Active</span></td></tr>)}</tbody></table></div> : <div className="settings-empty-state"><strong>No active mailboxes</strong><p>This workspace does not currently return any active mailbox records.</p></div>}
                <div className="settings-info-banner"><span>i</span><p>These addresses are read from the workspace database. Mailbox creation and assignment are not enabled from this settings screen yet.</p></div>
              </div>}

              {section === "security" && <div>
                <div className="settings-security-card"><span className="settings-security-icon">◇</span><div><strong>Signed in to ABEmail</strong><p>{email || "Current authenticated account"} · Workspace role: {organizationRole}</p></div><span className="settings-summary-chip">Authenticated</span></div>
                <SettingRow title="Workspace switching" description="Switching organizations keeps this account session active; access is rechecked for each workspace."><span className="settings-status active"><span />Membership checked</span></SettingRow>
                <SettingRow title="Sign out" description="Sign out of the ABEmail account across all workspaces."><SignOutButton className="mail-secondary-action" /></SettingRow>
                <div className="settings-info-banner"><span>i</span><p>Sessions, multi-factor settings, and audit history are account-wide or require identity-provider support; they are not separately managed per workspace here.</p></div>
              </div>}
            </section>
          </div>
          {toast && <div className="mail-toast settings-toast" role="status"><span>i</span>{toast}<button type="button" aria-label="Dismiss notice" onClick={() => setToast("")}>×</button></div>}
        </div>
      </main>
    </div>
  );
}
