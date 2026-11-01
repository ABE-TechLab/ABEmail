"use client";

import Link from "next/link";
import Image from "next/image";
import SignOutButton from "@/components/auth/sign-out-button";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const mailboxLinks = [
  { view: "Inbox", href: "/", label: "Inbox", icon: "▤" },
  { view: "Starred", href: "/?view=Starred", label: "Starred", icon: "☆" },
  { view: "Sent", href: "/?view=Sent", label: "Sent", icon: "↗" },
  { view: "Drafts", href: "/?view=Drafts", label: "Drafts", icon: "▧" },
  { view: "Scheduled", href: "/?view=Scheduled", label: "Scheduled", icon: "◷" },
  { view: "Snoozed", href: "/?view=Snoozed", label: "Snoozed", icon: "◴" },
  { view: "Archive", href: "/?view=Archive", label: "Archive", icon: "▱" },
  { view: "Trash", href: "/?view=Trash", label: "Trash", icon: "⌫" },
  { view: "Spam", href: "/?view=Spam", label: "Spam", icon: "⊘" },
] as const;

export type MailboxView = (typeof mailboxLinks)[number]["view"];
export type WorkspaceChoice = { id: string; name: string; slug: string; role: string; logoUrl?: string | null };

function WorkspaceAvatar({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return (
    <span className="mail-workspace-avatar" aria-hidden="true">
      {logoUrl
        ? <Image src={logoUrl} alt="" width={31} height={31} unoptimized />
        : name.trim().slice(0, 1).toUpperCase()}
    </span>
  );
}

const workspaceLinks = [
  { href: "/contacts", label: "Contacts", icon: "♙" },
  { href: "/templates", label: "Templates", icon: "▧" },
  { href: "/reminders", label: "Reminders", icon: "◴" },
  { href: "/labels", label: "Labels", icon: "◇" },
  { href: "/analytics", label: "Analytics", icon: "↗" },
  { href: "/settings", label: "Settings", icon: "⚙" },
] as const;


const SIDEBAR_COLLAPSED_KEY = "abemail:sidebar-collapsed";

type MailboxSidebarCounts = {
  inboxUnread: number;
  spamUnread: number;
  drafts: number;
  scheduled: number;
};

type WorkspaceSidebarProps = {
  organizationId?: string;
  composeHref: string;
  homeHref: string;
  mailboxBaseHref: string;
  workspaceName: string;
  workspaceDescription: string;
  workspaceBaseHref: string;
  workspaces: WorkspaceChoice[];
  activeWorkspaceId: string;
  showWorkspaceLinks?: boolean;
};

export default function WorkspaceSidebar({
  organizationId,
  composeHref,
  homeHref,
  mailboxBaseHref,
  workspaceName,
  workspaceDescription,
  workspaceBaseHref,
  workspaces,
  activeWorkspaceId,
  showWorkspaceLinks = true,
}: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMailboxView = searchParams.get("view");
  const currentMailboxView = mailboxLinks.find((item) => item.view === requestedMailboxView)?.view ?? "Inbox";
  const [collapsed, setCollapsed] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navigationCounts, setMailboxCounts] = useState<MailboxSidebarCounts>({
    inboxUnread: 0,
    spamUnread: 0,
    drafts: 0,
    scheduled: 0,
  });

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    let requestVersion = 0;
    const loadCounts = () => {
      const version = ++requestVersion;
      void fetch("/api/mail/sidebar-counts?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return null;
          return await response.json() as { counts?: Partial<MailboxSidebarCounts> };
        })
        .then((result) => {
          if (!active || !result?.counts || version !== requestVersion) return;
          setMailboxCounts({
            inboxUnread: Math.max(0, Number(result.counts.inboxUnread) || 0),
            spamUnread: Math.max(0, Number(result.counts.spamUnread) || 0),
            drafts: Math.max(0, Number(result.counts.drafts) || 0),
            scheduled: Math.max(0, Number(result.counts.scheduled) || 0),
          });
        })
        .catch(() => {
          // Keep the most recent counts visible if the network is temporarily unavailable.
        });
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") loadCounts();
    };
    loadCounts();
    const interval = window.setInterval(loadCounts, 30_000);
    window.addEventListener("focus", loadCounts);
    window.addEventListener("abemail:mailbox-counts-refresh", loadCounts);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", loadCounts);
      window.removeEventListener("abemail:mailbox-counts-refresh", loadCounts);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [organizationId, pathname, requestedMailboxView]);

  useEffect(() => {
    // Warm the mailbox route while the user is working elsewhere in the
    // workspace. This helps the sidebar Compose action reach its drawer sooner.
    router.prefetch(composeHref);
  }, [router, composeHref]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active) return;
      try {
        setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
      } catch {
        // Keep the sidebar expanded when storage is unavailable.
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // The control remains usable for this session.
      }
      return next;
    });
  }

  useEffect(() => {
    const media = window.matchMedia("(max-width: 850px)");
    const closeForViewport = () => {
      setMobileOpen(false);
      if (media.matches) {
        // Entering a compact viewport should leave navigation closed even
        // when the viewport is later expanded again.
        setCollapsed(true);
        try {
          window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
        } catch {
          // Navigation remains closed for this session.
        }
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setSwitcherOpen(false);
      }
    };
    const initialViewportTimer = window.setTimeout(closeForViewport, 0);
    media.addEventListener("change", closeForViewport);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(initialViewportTimer);
      media.removeEventListener("change", closeForViewport);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!switcherOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const root = switcherRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) setSwitcherOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer, true);
  }, [switcherOpen]);

  const isSwitcherOpen = switcherOpen;

  return (
    <>
      {!mobileOpen && (
        <button
          className="mail-mobile-nav-toggle"
          type="button"
          onClick={() => {
            if (window.matchMedia("(max-width: 850px)").matches) {
              setMobileOpen(true);
            } else {
              toggleCollapsed();
            }
          }}
          aria-label={collapsed ? "Open navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
          title={collapsed ? "Open navigation" : "Collapse navigation"}
        >
          <span aria-hidden="true">{collapsed ? "☰" : "‹"}</span>
        </button>
      )}
      {mobileOpen && (
        <button
          className="mail-sidebar-backdrop"
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          tabIndex={-1}
        />
      )}
      <aside className={"mail-sidebar" + (collapsed ? " is-collapsed" : "") + (mobileOpen ? " mobile-open" : "")} data-collapsed={collapsed}>
      <div className="mail-sidebar-brand-row">
        <Link className="mail-brand" href={homeHref} aria-label="ABEmail inbox" title="ABEmail">
          <span className="mail-brand-mark" aria-hidden="true">
            <svg className="mail-brand-symbol" viewBox="0 0 32 32" role="img" focusable="false">
              <path d="M6.5 23.5 12.2 8.8h2.1l5.6 14.7" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 17.7h7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <rect x="16.2" y="16.2" width="12" height="8.2" rx="1.7" fill="currentColor" stroke="currentColor" strokeWidth="1" />
              <path d="m17.4 17.5 4.8 3.8 4.8-3.8" fill="none" stroke="#26764b" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>AB<span>Email</span></span>
        </Link>
        <button
          className="mail-sidebar-collapse"
          type="button"
          onClick={() => {
            if (window.matchMedia("(max-width: 850px)").matches) {
              setMobileOpen(false);
            } else {
              toggleCollapsed();
            }
          }}
          aria-label={mobileOpen ? "Close navigation" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={mobileOpen ? true : !collapsed}
          title={mobileOpen ? "Close navigation" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span aria-hidden="true">{collapsed ? "›" : "‹"}</span>
        </button>
      </div>

      {collapsed && !mobileOpen ? (
        <button
          className="mail-compose-button mail-sidebar-reopen-button"
          type="button"
          onClick={toggleCollapsed}
          aria-label="Expand navigation"
          title="Expand navigation"
        >
          <span aria-hidden="true">›</span>
        </button>
      ) : (
        <Link
          className="mail-compose-button"
          href={composeHref}
          title="Compose"
          onClick={(event) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            // The mailbox is already mounted in this case: open the drawer directly
            // instead of navigating and waiting for the URL-driven compose effect.
            if (pathname === mailboxBaseHref) {
              event.preventDefault();
              window.dispatchEvent(new Event("abemail:compose"));
              setMobileOpen(false);
            }
          }}
        >
          <span className="compose-plus" aria-hidden="true">＋</span><span className="mail-compose-label">Compose</span>
        </Link>
      )}

      <div className="mail-nav-section">
        <div className="mail-nav-label">MAILBOX</div>
        <nav className="mail-nav" aria-label="Mailbox navigation">
          {mailboxLinks.map((item) => {
            const active = pathname.startsWith(mailboxBaseHref) && item.view === currentMailboxView;
            const itemHref = mailboxBaseHref
              ? `${mailboxBaseHref}?view=${encodeURIComponent(item.view)}`
              : item.href;
            const badgeCount = item.view === "Inbox"
              ? navigationCounts.inboxUnread
              : item.view === "Spam"
                ? navigationCounts.spamUnread
                : item.view === "Drafts"
                  ? navigationCounts.drafts
                  : item.view === "Scheduled"
                    ? navigationCounts.scheduled
                    : 0;
            const badgeText = badgeCount > 99 ? "99+" : String(badgeCount);
            const badgeDescription = item.view === "Inbox" || item.view === "Spam"
              ? "unread"
              : item.view === "Drafts"
                ? "drafts"
                : "scheduled messages";
            return (
              <Link
                className={active ? "mail-nav-item active" : "mail-nav-item"}
                href={itemHref}
                key={item.view}
                aria-current={active ? "page" : undefined}
                title={badgeCount > 0 ? item.label + " · " + badgeCount + " " + badgeDescription : item.label}
                onClick={(event) => {
                  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  router.push(itemHref, { scroll: false });
                  setMobileOpen(false);
                }}
              >
                <span className="mail-nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
                {badgeCount > 0 && <span className="mail-nav-count" aria-label={badgeCount + " " + badgeDescription}>{badgeText}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {showWorkspaceLinks && (
        <div className="mail-nav-section">
          <div className="mail-nav-label">WORKSPACE</div>
          <nav className="mail-nav" aria-label="Workspace navigation">
            {workspaceLinks.map((item) => {
              const scopedHref = workspaceBaseHref
                ? `${workspaceBaseHref}${item.href}`
                : item.href;
              const active = pathname === scopedHref || pathname.startsWith(`${scopedHref}/`);
              return (
                <Link
                  key={item.href}
                  className={active ? "mail-nav-item active" : "mail-nav-item"}
                  href={scopedHref}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                >
                  <span className="mail-nav-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
  
      )}

      <div className="mail-sidebar-bottom">
        <div className="mail-sidebar-divider" />
        <div className="mail-workspace-switcher-wrap" ref={switcherRef}>
          <button
            className="mail-workspace-switcher"
            type="button"
            onClick={() => setSwitcherOpen((current) => !current)}
            aria-expanded={isSwitcherOpen}
            aria-label={"Current workspace: " + workspaceName + ". Switch workspace"}
            aria-haspopup="menu"
            title="Switch workspace"
          >
            <WorkspaceAvatar name={workspaceName} logoUrl={workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.logoUrl} />
            <span className="mail-workspace-copy"><strong>{workspaceName}</strong><small>{workspaceDescription}</small></span>
            <span className="mail-chevron">⌄</span>
          </button>

          {isSwitcherOpen && workspaces.length > 0 && (
            <div className="mail-profile-menu mail-workspace-menu" role="menu" aria-label="Switch workspace">
              <strong>Switch workspace</strong>
              <p>You stay signed in when you switch.</p>
              {workspaces.map((workspace) => {
                const active = workspace.id === activeWorkspaceId;
                return (
                  <Link
                    key={workspace.id}
                    href={"/dashboard/" + workspace.id}
                    className={active ? "mail-workspace-option active" : "mail-workspace-option"}
                    role="menuitem"
                    aria-current={active ? "page" : undefined}
                    onClick={() => setSwitcherOpen(false)}
                  >
                    <WorkspaceAvatar name={workspace.name} logoUrl={workspace.logoUrl} />
                    <span className="mail-workspace-copy"><strong>{workspace.name}</strong><small>{workspace.role}</small></span>
                    {active && <span className="mail-workspace-current">Current</span>}
                  </Link>
                );
              })}
              <div className="mail-workspace-menu-actions">
                <Link className="mail-workspace-all" href="/dashboard" onClick={() => setSwitcherOpen(false)}>View all workspaces</Link>
                <Link className="mail-workspace-all" href={workspaceBaseHref ? workspaceBaseHref + "/settings" : "/settings"} onClick={() => setSwitcherOpen(false)}>Workspace settings</Link>
                <SignOutButton className="mail-workspace-signout" />
              </div>
            </div>
          )}
        </div>

        <p className="workspace-sidebar-note">Workspace mail</p>
      </div>
    </aside>
    </>
  );
}
