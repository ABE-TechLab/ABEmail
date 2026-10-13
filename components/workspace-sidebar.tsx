"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const mainLinks = [
  { href: "/", label: "Inbox", icon: "▤" },
  { href: "/contacts", label: "Contacts", icon: "♙" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export default function WorkspaceSidebar() {
  const pathname = usePathname();

  return (
    <aside className="mail-sidebar">
      <Link className="mail-brand" href="/" aria-label="ABEmail inbox">
        <span className="mail-brand-mark">A</span>
        <span>AB<span>Email</span></span>
      </Link>
      <Link className="mail-compose-button workspace-compose-link" href="/">
        <span className="compose-plus">↖</span><span className="mail-compose-label">Open inbox</span>
      </Link>

      <div className="mail-nav-section">
        <div className="mail-nav-label">WORKSPACE</div>
        <nav className="mail-nav" aria-label="Workspace navigation">
          {mainLinks.map((item) => {
            const active = item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
        <div className="mail-workspace-switcher workspace-sample-switcher">
          <span className="mail-workspace-avatar">A</span>
          <span className="mail-workspace-copy"><strong>Acme Studio</strong><small>Sample workspace</small></span>
        </div>
        <p className="workspace-sidebar-note">Preview mode · not connected</p>
      </div>
    </aside>
  );
}
