import type { Metadata } from "next";
import Link from "next/link";
import SignOutButton from "@/components/auth/sign-out-button";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import styles from "../dashboard.module.css";

export const metadata: Metadata = { title: "Organization workspace" };
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type OrganizationWorkspacePageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function OrganizationWorkspacePage({ params }: OrganizationWorkspacePageProps) {
  const { organizationId } = await params;
  if (!UUID_PATTERN.test(organizationId)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(`/dashboard/${organizationId}`)}`);

  // A requested organization ID is never proof of access. Verify the signed-in
  // user's active membership before returning any organization-specific view.
  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    return (
      <main className={styles.page}>
        <section className={styles.card}>
          <h1>Workspace access is not ready</h1>
          <p>The organization database migration may not have been applied yet.</p>
          <Link href="/dashboard">Back to all workspaces</Link>
          <SignOutButton className="auth-signout-control" />
        </section>
      </main>
    );
  }
  if (!membership) notFound();

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .eq("id", organizationId)
    .eq("status", "active")
    .maybeSingle();

  if (organizationError || !organization) notFound();

  // Postgres RLS filters this list to all mailboxes visible to an owner/admin,
  // or only explicitly granted mailboxes for a regular member.
  const { data: mailboxRows, error: mailboxError } = await supabase
    .from("mailboxes")
    .select("id, address, display_name")
    .eq("organization_id", organization.id)
    .eq("status", "active")
    .order("address");
  const mailboxes = mailboxRows ?? [];
  const hasAdministrativeAccess = membership.role === "owner" || membership.role === "admin";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.wordmark} href="/dashboard"><span className={styles.mark}>A</span><span>AB<span>Email</span></span></Link>
        <nav><Link href="/dashboard">Switch workspace</Link><Link href="/settings/account">Account</Link><Link href="/settings/team">Team access</Link><SignOutButton className="auth-signout-control" /></nav>
      </header>

      <section className={styles.intro}>
        <p className={styles.eyebrow}>SELECTED WORKSPACE</p>
        <h1>{organization.name}</h1>
        <p>Signed in as <strong>{user.email}</strong>. Your role here is <strong>{membership.role}</strong>. This selection does not change your permissions in any other organization.</p>
      </section>

      <div className={styles.detailGrid}>
        <section className={styles.card}>
          <span className={styles.selectedLabel}>WORKSPACE SELECTED</span>
          <h2>{hasAdministrativeAccess ? "Mailboxes available to you" : "Your assigned mailboxes"}</h2>
          <p>Mailbox visibility is limited to this organization&apos;s role and mailbox permissions.</p>
          {mailboxError ? (
            <p className={styles.mutedMessage}>Mailbox access is being configured for this environment. Organization membership was verified separately.</p>
          ) : mailboxes.length ? (
            <ul className={styles.mailboxList}>
              {mailboxes.map((mailbox) => (
                <li className={styles.mailboxRow} key={mailbox.id}>
                  <span className={styles.mailboxDisplayName}>{mailbox.display_name || mailbox.address}</span>
                  <span className={styles.mailboxAddress}>{mailbox.address}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.mutedMessage}>There are no active mailbox addresses available to this account in this organization yet.</p>
          )}
        </section>

        <section className={styles.note}>
          <strong>This organization is selected.</strong>
          <p>Organization access and mailbox visibility checks are in place. Inbox messages, sending, and receiving are not yet connected to live mail transport.</p>
          <div className={styles.actions}>
            <Link href="/settings/team">Manage team access</Link>
            <Link href="/dashboard">Switch organization</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
