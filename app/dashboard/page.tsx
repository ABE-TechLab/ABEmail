import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import styles from "./dashboard.module.css";

export const metadata: Metadata = { title: "Workspace dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard");

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError) {
    return <main className={styles.page}><section className={styles.card}><h1>Workspace access is not ready</h1><p>The organization database migration may not have been applied yet.</p><Link href="/auth/sign-out">Sign out</Link></section></main>;
  }

  if (!memberships?.length) redirect("/onboarding");

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .in("id", memberships.map((membership) => membership.organization_id))
    .eq("status", "active");

  if (error || !organizations?.length) {
    return <main className={styles.page}><section className={styles.card}><h1>No active workspace found</h1><p>Your membership may have been suspended. Contact the organization administrator.</p><Link href="/auth/sign-out">Sign out</Link></section></main>;
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.wordmark} href="/welcome"><span className={styles.mark}>A</span><span>AB<span>Email</span></span></a>
        <nav><Link href="/settings/account">Account</Link><Link href="/settings/team">Team access</Link><Link href="/auth/sign-out">Sign out</Link></nav>
      </header>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>YOUR ABEMAIL</p>
        <h1>Choose your workspace</h1>
        <p>Signed in as <strong>{user.email}</strong>. Each workspace and mailbox is available only through an active membership or explicit mailbox grant.</p>
      </section>
      <div className={styles.organizations}>
        {organizations.map((organization) => {
          const membership = memberships.find((item) => item.organization_id === organization.id);
          return (
            <article className={styles.card} key={organization.id}>
              <div className={styles.orgMark}>{organization.name.slice(0, 1).toUpperCase()}</div>
              <h2>{organization.name}</h2>
              <p className={styles.slug}>{organization.slug}.abemail workspace</p>
              <div className={styles.meta}><span>{membership?.role ?? "member"}</span><span>Active organization</span></div>
              <div className={styles.actions}><Link href="/settings/team">Manage team</Link><Link href="/settings/account">Sign-in methods</Link></div>
            </article>
          );
        })}
      </div>
      <section className={styles.note}>
        <strong>Mailbox services are still being connected.</strong>
        <p>This dashboard confirms authentication and organization access. It does not claim that DNS verification, mailbox hosting, or live sending/receiving is configured yet.</p>
      </section>
    </main>
  );
}
