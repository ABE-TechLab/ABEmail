"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const mailboxLinks = [
  { view: "Inbox", href: "/", label: "Inbox", icon: "▤" },
  { view: "Starred", href: "/?view=Starred", label: "Starred", icon: "☆" },
  { view: "Sent", href: "/?view=Sent", label: "Sent", icon: "↗" },
  { view: "Drafts", href: "/?view=Drafts", label: "Drafts", icon: "▧" },
  { view: "Scheduled", href: "/?view=Scheduled", label: "Scheduled", icon: "◷" },
  { view: "Archive", href: "/?view=Archive", label: "Archive", icon: "▱" },
  { view: "Trash", href: "/?view=Trash", label: "Trash", icon: "⌫" },
] as const;

export type MailboxView = (typeof mailboxLinks)[number]["view"];

const workspaceLinks = [
  { href: "/contacts", label: "Contacts", icon: "♙" },
  { href: "/settings", label: "Settings", icon: "⚙" },
] as const;

type WorkspaceSidebarProps = {
  activeView?: string;
  mailboxCounts?: Partial<Record<MailboxView, number>>;
  onMailboxNavigate?: (view: MailboxView) => void;
  onCompose?: () => void;
  profileOpen?: boolean;
  onWorkspaceToggle?: () => void;
  onWorkspaceSettings?: () => void;
  disabledMailFeatures?: boolean;
  disableContacts?: boolean;
  workspaceName?: string;
  workspaceDescription?: string;
  workspaceHref?: string;
};

export default function WorkspaceSidebar({
  activeView,
  mailboxCounts = {},
  onMailboxNavigate,
  onCompose,
  profileOpen = false,
  onWorkspaceToggle,
  onWorkspaceSettings,
  disabledMailFeatures = false,
  disableContacts = false,
  workspaceName = "Acme Studio",
  workspaceDescription = "Sample workspace",
  workspaceHref,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="mail-sidebar">
      <Link className="mail-brand" href="/" aria-label="ABEmail inbox">
        <span className="mail-brand-mark">A</span>
        <span>AB<span>Email</span></span>
      </Link>

      {disabledMailFeatures ? (
        <button className="mail-compose-button workspace-compose-disabled" disabled type="button" aria-label="Compose is unavailable until email is connected">
          <span className="compose-plus">＋</span><span className="mail-compose-label">Compose</span>
        </button>
      ) : onCompose ? (
        <button className="mail-compose-button" onClick={onCompose} type="button">
          <span className="compose-plus">＋</span><span className="mail-compose-label">Compose</span>
        </button>
      ) : (
        <Link className="mail-compose-button workspace-compose-link" href="/">
          <span className="compose-plus">↖</span><span className="mail-compose-label">Open inbox</span>
        </Link>
      )}

      <div className="mail-nav-section">
        <div className="mail-nav-label">MAILBOX</div>
        <nav className="mail-nav" aria-label="Mailbox navigation">
          {mailboxLinks.map((item) => {
            const active = disabledMailFeatures ? item.view === activeView : pathname === "/" && activeView === item.view;
            const count = mailboxCounts[item.view];
            const children = (
              <>
                <span className="mail-nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
                {count !== undefined && count > 0 && <span className="mail-nav-count">{count}</span>}
              </>
            );

            if (disabledMailFeatures) {
              return (
                <button
                  className={active ? "mail-nav-item active workspace-nav-disabled" : "mail-nav-item workspace-nav-disabled"}
                  key={item.view}
                  type="button"
                  disabled
                  aria-disabled="true"
                >
                  {children}
                  <span className="mail-feature-pill">Setup</span>
                </button>
              );
            }

            return onMailboxNavigate ? (
              <button
                className={active ? "mail-nav-item active" : "mail-nav-item"}
                key={item.view}
                onClick={() => onMailboxNavigate(item.view)}
                type="button"
                aria-current={active ? "page" : undefined}
              >
                {children}
              </button>
            ) : (
              <Link
                className={active ? "mail-nav-item active" : "mail-nav-item"}
                href={item.href}
                key={item.view}
                aria-current={active ? "page" : undefined}
              >
                {children}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mail-nav-section">
        <div className="mail-nav-label">WORKSPACE</div>
        <nav className="mail-nav" aria-label="Workspace navigation">
          {workspaceLinks.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            if (disableContacts && item.href === "/contacts") {
              return (
                <div className="mail-nav-item workspace-nav-disabled" key={item.href} aria-disabled="true">
                  <span className="mail-nav-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                  <span className="mail-feature-pill">Setup</span>
                </div>
              );
            }
            return (
              <Link
                className={active ? "mail-nav-item active" : "mail-nav-item"}
                href={item.href}
                key={item.href}
                aria-current={active ? "page" : undefined}
              >
                <span className="mail-nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mail-sidebar-bottom">
        <div className="mail-sidebar-divider" />
        {workspaceHref ? (
          <Link className="mail-workspace-switcher" href={workspaceHref}>
            <span className="mail-workspace-avatar">{workspaceName.slice(0, 1).toUpperCase()}</span>
            <span className="mail-workspace-copy"><strong>{workspaceName}</strong><small>{workspaceDescription}</small></span>
            <span className="mail-chevron">⌄</span>
          </Link>
        ) : onWorkspaceToggle ? (
          <button className="mail-workspace-switcher" onClick={onWorkspaceToggle} type="button" aria-expanded={profileOpen}>
            <span className="mail-workspace-avatar">{workspaceName.slice(0, 1).toUpperCase()}</span>
            <span className="mail-workspace-copy"><strong>{workspaceName}</strong><small>{workspaceDescription}</small></span>
            <span className="mail-chevron">⌄</span>
          </button>
        ) : (
          <div className="mail-workspace-switcher workspace-sample-switcher">
            <span className="mail-workspace-avatar">{workspaceName.slice(0, 1).toUpperCase()}</span>
            <span className="mail-workspace-copy"><strong>{workspaceName}</strong><small>{workspaceDescription}</small></span>
          </div>
        )}
        {profileOpen && onWorkspaceSettings && (
          <div className="mail-profile-menu">
            <strong>Sample workspace</strong>
            <p>This is illustrative data, not a connected account.</p>
            <button type="button" onClick={onWorkspaceSettings}>Workspace settings</button>
          </div>
        )}
        <p className="workspace-sidebar-note">{disabledMailFeatures ? "Email setup required" : "Preview mode · not connected"}</p>
      </div>
    </aside>
  );
}
