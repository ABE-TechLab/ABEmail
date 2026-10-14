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
            <Link href="/settings">Settings</Link>
            <span className="mail-breadcrumb-slash">/</span>
            <strong>Team &amp; Access</strong>
          </div>
          <div className={styles.topbarTitle}>Team &amp; Access</div>
          <div className={styles.topbarActions}>
            <Link href="/settings">All settings</Link>
            <Link href="/settings/account">Account</Link>
            <SignOutButton className="auth-signout-control" />
          </div>
        </header>

        <div className={styles.content}>
          <TeamAccessManager embedded />
        </div>
      </section>
    </div>
  );
}
