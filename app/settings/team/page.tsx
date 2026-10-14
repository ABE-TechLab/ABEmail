import type { Metadata } from "next";
import Link from "next/link";
import SignOutButton from "@/components/auth/sign-out-button";
import TeamAccessManager from "@/components/auth/team-access-manager";
import WorkspaceSidebar from "@/components/workspace-sidebar";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import styles from "./team-access-page.module.css";

export const metadata: Metadata = { title: "Team and mailbox access" };
export const dynamic = "force-dynamic";

const settingGroups = [
  {
    group: "PREFERENCES",
    items: [
      { id: "general", label: "General", icon: "⚙", href: "/settings" },
      { id: "appearance", label: "Appearance", icon: "◐", href: "/settings/appearance" },
      { id: "mail", label: "Mail & compose", icon: "✉", href: "/settings/mail" },
      { id: "notifications", label: "Notifications", icon: "♧", href: "/settings/notifications" },
    ],
  },
  {
    group: "WORKSPACE",
    items: [
      { id: "team", label: "Team & access", icon: "♙", href: "/settings/team" },
      { id: "domains", label: "Domains", icon: "◎", href: "/settings/domains" },
      { id: "mailboxes", label: "Mailboxes", icon: "▤", href: "/settings/mailboxes" },
    ],
  },
  {
    group: "ACCESS",
    items: [{ id: "security", label: "Security", icon: "◇", href: "/settings/security" }],
  },
];

export default async function TeamAccessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/settings/team");

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  let workspaceName = "Your workspaces";
  let workspaceDescription = "Switch organization";
  if (memberships?.length === 1) {
    const { data: organization } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", memberships[0].organization_id)
      .eq("status", "active")
      .maybeSingle();

    if (organization?.name) workspaceName = organization.name;
    workspaceDescription = "Team and access";
  } else if (!memberships?.length) {
    workspaceName = "ABEmail";
    workspaceDescription = "Workspace setup";
  }

  return (
    <div className="mail-app">
      <WorkspaceSidebar
        activeView=""
        disabledMailFeatures
        disableContacts
        workspaceName={workspaceName}
        workspaceDescription={workspaceDescription}
        workspaceHref="/dashboard"
      />

      <section className="mail-main">
        <header className={"mail-topbar " + styles.topbar}>
          <div className="mail-breadcrumb">
            <Link href="/dashboard">Workspace</Link>
            <span className="mail-breadcrumb-slash">/</span>
            <strong>Settings</strong>
          </div>
          <div className={styles.topbarTitle}>Team &amp; Access</div>
          <div className={styles.topbarActions}>
            <Link href="/settings/account">Account</Link>
            <SignOutButton className="auth-signout-control" />
          </div>
        </header>

        <div className="settings-page-scroll">
          <div className="settings-page-heading">
            <div>
              <p className="mail-overline">WORKSPACE SETTINGS</p>
              <h1>Settings</h1>
              <p>Set up your workspace, team and email preferences.</p>
            </div>
          </div>

          <div className="settings-layout">
            <nav className="settings-navigation" aria-label="Settings sections">
              {settingGroups.map((group) => (
                <div className="settings-nav-group" key={group.group}>
                  <p>{group.group}</p>
                  {group.items.map((item) => (
                    <Link
                      className={item.id === "team" ? "settings-nav-link active" : "settings-nav-link"}
                      key={item.id}
                      href={item.href}
                      aria-current={item.id === "team" ? "page" : undefined}
                    >
                      <span aria-hidden="true">{item.icon}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
            <div className={styles.manager}>
              <TeamAccessManager embedded />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
