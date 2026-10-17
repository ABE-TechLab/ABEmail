"use client";

import Link from "next/link";
import { useAppearanceMode, type AppearanceMode } from "@/components/appearance-provider";
import WorkspaceSidebar from "@/components/workspace-sidebar";
import WorkspaceSettingsPanel, { type WorkspaceSettingsContext } from "@/components/workspace-settings-panel";
import { useDesignTheme } from "@/components/design-theme-provider";
import { DESIGN_THEMES, type DesignThemeId } from "@/lib/design-system";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

export type SettingsSection = "general" | "appearance" | "mail" | "notifications" | "team" | "domains" | "mailboxes" | "security";

const sections: { id: SettingsSection; label: string; icon: string; group: string }[] = [
  { id: "general", label: "General", icon: "⚙", group: "PREFERENCES" },
  { id: "appearance", label: "Appearance", icon: "◐", group: "PREFERENCES" },
  { id: "mail", label: "Mail & compose", icon: "✉", group: "PREFERENCES" },
  { id: "notifications", label: "Notifications", icon: "♧", group: "PREFERENCES" },
  { id: "team", label: "Team & access", icon: "♙", group: "WORKSPACE" },
  { id: "domains", label: "Domains", icon: "◎", group: "WORKSPACE" },
  { id: "mailboxes", label: "Mailboxes", icon: "▤", group: "WORKSPACE" },
  { id: "security", label: "Security", icon: "◇", group: "ACCESS" },
];

const sectionInfo: Record<SettingsSection, { title: string; description: string }> = {
  general: { title: "General", description: "Manage your workspace identity and regional preferences." },
  appearance: { title: "Appearance", description: "Choose how ABEmail looks and feels for you." },
  mail: { title: "Mail & compose", description: "Set defaults for writing and reading messages." },
  notifications: { title: "Notifications", description: "Choose which updates you want to see." },
  team: { title: "Team & access", description: "Manage who belongs to your workspace and what access they need." },
  domains: { title: "Domains", description: "Manage the sending domains associated with your organization." },
  mailboxes: { title: "Mailboxes", description: "See mailbox addresses and their current connection status." },
  security: { title: "Security", description: "Account security and organization access controls." },
};

type LocalMember = { name: string; email: string; role: string; status: "Active" | "Invitation pending" };

const COMPACT_MESSAGE_LIST_KEY = "abemail:compact-message-list";

const APPEARANCE_MODES: { id: AppearanceMode; label: string; glyph: string }[] = [
  { id: "light", label: "Light", glyph: "☼" },
  { id: "dark", label: "Dark", glyph: "☾" },
  { id: "system", label: "System", glyph: "◐" },
];

function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="settings-row"><div className="settings-row-copy"><strong>{title}</strong><p>{description}</p></div><div className="settings-row-control">{children}</div></div>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className={checked ? "settings-toggle checked" : "settings-toggle"} onClick={() => onChange(!checked)}><span /></button>;
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="settings-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function LegacySettingsWorkspace({ section }: { section: SettingsSection }) {
  const [displayName, setDisplayName] = useState("Acme Studio");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [language, setLanguage] = useState("en");
  const { mode, setMode } = useAppearanceMode();
  const { theme: activeDesignTheme, setTheme: setDesignTheme } = useDesignTheme();
  const [compactMessageList, setCompactMessageList] = useState(false);
  const [font, setFont] = useState("sans");
  const [signature, setSignature] = useState("Best regards,\nAyo");
  const [replyStyle, setReplyStyle] = useState("reply");
  const [notifications, setNotifications] = useState({ newMail: true, mentions: true, product: false, digest: false });
  const [members, setMembers] = useState<LocalMember[]>([
    { name: "Ayo Richard Abe", email: "ayo@acmestudio.example", role: "Owner", status: "Active" },
    { name: "Maya Chen", email: "maya@acmestudio.example", role: "Admin", status: "Active" },
    { name: "James Okafor", email: "james@acmestudio.example", role: "Member", status: "Active" },
  ]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("Member");
  const [domains, setDomains] = useState(["acmestudio.example"]);
  const [domainInput, setDomainInput] = useState("");
  const [toast, setToast] = useState("");

  const info = sectionInfo[section];

  useEffect(() => {
    try {
      setCompactMessageList(window.localStorage.getItem(COMPACT_MESSAGE_LIST_KEY) === "true");
    } catch {
      // If browser storage is unavailable, keep the in-session preference.
    }
  }, []);

  function updateCompactMessageList(next: boolean) {
    setCompactMessageList(next);
    try {
      window.localStorage.setItem(COMPACT_MESSAGE_LIST_KEY, String(next));
    } catch {
      // The setting remains usable until the page is closed.
    }
    notify(next ? "Compact message list enabled." : "Compact message list disabled.");
  }

  function notify(message: string) {
    setToast(message);
  }

  function savePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    notify("Updated in this demo screen only. Settings are not connected to an account yet.");
  }

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      notify("Enter a valid email address.");
      return;
    }
    if (members.some((member) => member.email.toLowerCase() === email)) {
      notify("That email is already in the sample member list.");
      return;
    }
    setMembers((current) => [...current, { name: email.split("@")[0].replace(/[._-]/g, " "), email, role: inviteRole, status: "Invitation pending" }]);
    setInviteEmail("");
    notify("Sample invitation added locally. No email was sent.");
  }

  function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = domainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!value || !value.includes(".") || value.includes(" ")) {
      notify("Enter a valid domain, such as example.com.");
      return;
    }
    if (domains.includes(value)) {
      notify("This domain is already listed.");
      return;
    }
    setDomains((current) => [...current, value]);
    setDomainInput("");
    notify("Domain added to the local preview. DNS has not been checked.");
  }

  return (
    <main className="mail-app">
      <WorkspaceSidebar />

      <section className="mail-main">
        <header className="mail-topbar">
          <div className="mail-breadcrumb"><span>Workspace</span><span className="mail-breadcrumb-slash">/</span><strong>Settings</strong></div>
          <div className="settings-topbar-title">{info.title}</div>
          <div className="mail-topbar-right"><span className="mail-development-pill"><span /> Demo mode</span><span className="mail-user-avatar" aria-label="Sample user">AR</span></div>
        </header>

        <div className="settings-page-scroll">
          <div className="settings-page-heading"><div><p className="mail-overline">WORKSPACE SETTINGS</p><h1>Settings</h1><p>Set up your workspace, team and email preferences.</p></div><span className="settings-preview-chip"><span /> Preview only</span></div>
          <div className="settings-layout">
            <nav className="settings-navigation" aria-label="Settings sections">
              {(["PREFERENCES", "WORKSPACE", "ACCESS"] as const).map((group) => <div className="settings-nav-group" key={group}><p>{group}</p>{sections.filter((item) => item.group === group).map((item) => <Link className={section === item.id ? "settings-nav-link active" : "settings-nav-link"} key={item.id} href={item.id === "general" ? "/settings" : `/settings/${item.id}`} aria-current={section === item.id ? "page" : undefined}><span aria-hidden="true">{item.icon}</span>{item.label}</Link>)}</div>)}
            </nav>

            <section className="settings-panel" aria-labelledby="settings-heading">
              <header className="settings-panel-heading"><div><h2 id="settings-heading">{info.title}</h2><p>{info.description}</p></div></header>

              {section === "general" && <form onSubmit={savePreview}>
                <div className="settings-form-grid">
                  <Field label="Workspace name"><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></Field>
                  <Field label="Language"><select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="en">English</option><option value="fr">French</option><option value="pt">Portuguese</option></select></Field>
                  <Field label="Time zone" hint="Used for message timestamps and scheduled mail."><select value={timezone} onChange={(event) => setTimezone(event.target.value)}><option value="Africa/Lagos">Africa/Lagos (WAT)</option><option value="UTC">UTC</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New York</option></select></Field>
                </div>
                <div className="settings-info-banner"><span>i</span><p>This is a sample workspace. The values above are local preview values and are not saved to a server.</p></div>
                <div className="settings-form-footer"><span>Changes apply to this screen only.</span><button className="mail-primary-action" type="submit">Save changes</button></div>
              </form>}

              {section === "appearance" && <form onSubmit={savePreview}>
                <div className="settings-choice-group"><p className="settings-subheading">Light and dark mode</p><p className="settings-muted">Choose whether ABEmail follows your preference or your device setting.</p><div className="settings-theme-options">{APPEARANCE_MODES.map((item) => <button key={item.id} type="button" aria-pressed={mode === item.id} className={mode === item.id ? "settings-theme-choice selected" : "settings-theme-choice"} onClick={() => { setMode(item.id); notify(`${item.label} mode selected.`); }}><span className="settings-theme-preview">{item.glyph}</span><span>{item.label}</span>{mode === item.id && <b>✓</b>}</button>)}</div></div>
                <div className="settings-divider" />
                <div className="settings-choice-group"><p className="settings-subheading">Design system palette</p><p className="settings-muted">Choose one of the shared ABE TechLab Design System palettes. Your choice is saved in this browser.</p><label className="settings-field settings-palette-field"><span>Color palette</span><select className="settings-palette-select" value={activeDesignTheme} onChange={(event) => { const nextTheme = event.target.value as DesignThemeId; setDesignTheme(nextTheme); notify(`${DESIGN_THEMES.find((option) => option.value === nextTheme)?.name ?? "Selected"} palette applied.`); }}>{DESIGN_THEMES.map((option) => <option key={option.value} value={option.value}>{option.name}</option>)}</select></label></div>
                <div className="settings-divider" />
                <SettingRow title="Compact message list" description="Show more message rows in the mailbox list."><Toggle checked={compactMessageList} onChange={updateCompactMessageList} label="Compact message list" /></SettingRow>
                <div className="settings-form-footer"><span>Appearance and compact-list preferences are stored in this browser.</span><button className="mail-primary-action" type="submit">Save preferences</button></div>
              </form>}

              {section === "mail" && <form onSubmit={savePreview}>
                <Field label="Default writing font"><select value={font} onChange={(event) => setFont(event.target.value)}><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="mono">Monospace</option></select></Field>
                <div className="settings-divider" />
                <div className="settings-choice-group"><p className="settings-subheading">When replying</p><label className="settings-radio-row"><input type="radio" name="reply-style" value="reply" checked={replyStyle === "reply"} onChange={() => setReplyStyle("reply")} /><span><strong>Reply inline</strong><small>Write your reply above the quoted message.</small></span></label><label className="settings-radio-row"><input type="radio" name="reply-style" value="bottom" checked={replyStyle === "bottom"} onChange={() => setReplyStyle("bottom")} /><span><strong>Reply below the message</strong><small>Place your response after the quoted content.</small></span></label></div>
                <Field label="Email signature" hint="This sample signature is only stored in this screen while it remains open."><textarea rows={4} value={signature} onChange={(event) => setSignature(event.target.value)} /></Field>
                <div className="settings-form-footer"><span>Mail preferences are preview-only.</span><button className="mail-primary-action" type="submit">Save changes</button></div>
              </form>}

              {section === "notifications" && <div className="settings-notification-list">
                <SettingRow title="New messages" description="Get notified when new email arrives."><Toggle checked={notifications.newMail} onChange={(next) => setNotifications((current) => ({ ...current, newMail: next }))} label="New messages" /></SettingRow>
                <SettingRow title="Workspace mentions" description="Get notified when someone mentions you in a workspace event."><Toggle checked={notifications.mentions} onChange={(next) => setNotifications((current) => ({ ...current, mentions: next }))} label="Workspace mentions" /></SettingRow>
                <SettingRow title="Product updates" description="Occasional updates about improvements and new features."><Toggle checked={notifications.product} onChange={(next) => setNotifications((current) => ({ ...current, product: next }))} label="Product updates" /></SettingRow>
                <SettingRow title="Weekly digest" description="A summary of workspace activity in your inbox."><Toggle checked={notifications.digest} onChange={(next) => setNotifications((current) => ({ ...current, digest: next }))} label="Weekly digest" /></SettingRow>
                <div className="settings-form-footer"><span>Notification choices are local preview state only.</span><button className="mail-primary-action" type="button" onClick={() => notify("Notification preferences updated in this preview only.")}>Save preferences</button></div>
              </div>}

              {section === "team" && <div>
                <div className="settings-section-summary"><div><strong>Members</strong><p>{members.length} sample users in this workspace</p></div><span className="settings-summary-chip">No live access</span></div>
                <div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>Member</th><th>Role</th><th>Status</th></tr></thead><tbody>{members.map((member) => <tr key={member.email}><td><strong>{member.name}</strong><small>{member.email}</small></td><td><span className="settings-role-pill">{member.role}</span></td><td><span className={member.status === "Active" ? "settings-status active" : "settings-status pending"}><span />{member.status}</span></td></tr>)}</tbody></table></div>
                <form className="settings-invite-form" onSubmit={submitInvite}><p className="settings-subheading">Invite a teammate (demo)</p><div className="settings-invite-controls"><Field label="Email address"><input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@company.com" /></Field><Field label="Role"><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option>Member</option><option>Admin</option></select></Field><button type="submit" className="mail-primary-action">Add preview member</button></div><p className="settings-muted">This only adds a local sample row. It does not create an account or send an invitation.</p></form>
              </div>}

              {section === "domains" && <div>
                <div className="settings-info-banner"><span>i</span><p>Domain verification and email routing require backend and provider setup. No DNS records have been checked.</p></div>
                <form className="settings-domain-form" onSubmit={addDomain}><Field label="Add a domain"><input value={domainInput} onChange={(event) => setDomainInput(event.target.value)} placeholder="yourcompany.com" required /></Field><button className="mail-primary-action" type="submit">Add to preview</button></form>
                <div className="settings-domain-list">{domains.map((domain) => <div className="settings-domain-row" key={domain}><span className="settings-domain-icon">◎</span><span className="settings-domain-name"><strong>{domain}</strong><small>DNS verification not checked</small></span><span className="settings-status pending"><span />Not verified</span><button className="mail-secondary-action" type="button" onClick={() => notify("DNS verification is not connected. No DNS lookup was performed.")}>Check DNS</button></div>)}</div>
              </div>}

              {section === "mailboxes" && <div>
                <div className="settings-info-banner"><span>i</span><p>Mailbox provisioning becomes available after organization authorization, domain verification and email provider integration are implemented.</p></div>
                <div className="settings-table-wrap"><table className="settings-table"><thead><tr><th>Mailbox</th><th>Owner</th><th>Status</th></tr></thead><tbody><tr><td><strong>you@acmestudio.example</strong><small>Primary sample mailbox</small></td><td>Ayo Richard Abe</td><td><span className="settings-status pending"><span />Demo only</span></td></tr><tr><td><strong>team@acmestudio.example</strong><small>Shared sample address</small></td><td>Acme Studio</td><td><span className="settings-status pending"><span />Demo only</span></td></tr></tbody></table></div>
                <button className="mail-secondary-action settings-request-button" type="button" onClick={() => notify("Mailbox creation will be enabled after domains and provider transport are connected.")}>＋ Add mailbox</button>
              </div>}

              {section === "security" && <div>
                <div className="settings-security-card"><span className="settings-security-icon">◇</span><div><strong>Authentication is not connected</strong><p>There is no live user identity or session protection in this demo. Do not use real accounts or customer data.</p></div><span className="settings-summary-chip">Not configured</span></div>
                <SettingRow title="Multi-factor authentication" description="Require a second verification step during sign-in."><button className="mail-secondary-action" type="button" onClick={() => notify("Multi-factor authentication requires the identity backend and is not available in demo mode.")}>Not configured</button></SettingRow>
                <SettingRow title="Active sessions" description="Review and revoke devices connected to your account."><button className="mail-secondary-action" type="button" onClick={() => notify("Session management will be available after authentication is implemented.")}>Unavailable</button></SettingRow>
                <SettingRow title="Audit log" description="Review sensitive workspace and access-control events."><button className="mail-secondary-action" type="button" onClick={() => notify("Audit logging will be implemented with the backend and access controls.")}>Not available yet</button></SettingRow>
              </div>}
            </section>
          </div>
          {toast && <div className="mail-toast settings-toast" role="status"><span>i</span>{toast}<button type="button" aria-label="Dismiss notice" onClick={() => setToast("")}>×</button></div>}
        </div>
      </section>
    </main>
  );
}


export default function SettingsWorkspace({
  section,
  workspace,
}: {
  section: SettingsSection;
  workspace?: WorkspaceSettingsContext;
}) {
  if (workspace) {
    return <WorkspaceSettingsPanel {...workspace} section={section} />;
  }
  return <LegacySettingsWorkspace section={section} />;
}
