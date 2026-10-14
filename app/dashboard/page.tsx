import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkspaceHome from "@/components/workspace-home";
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
    return <main className={styles.page}><section className={styles.card}><h1>Workspace access is not ready</h1><p>The organization database migration may not have been applied yet.</p></section></main>;
  }

  if (!memberships?.length) redirect("/onboarding");

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .in("id", memberships.map((membership) => membership.organization_id))
    .eq("status", "active");

  if (error || !organizations?.length) {
    return <main className={styles.page}><section className={styles.card}><h1>No active workspace found</h1><p>Your membership may have been suspended. Contact the organization administrator.</p></section></main>;
  }

  // Avoid an unnecessary chooser for a single-organization account. The target
  // route re-checks active membership before rendering organization data.
  if (organizations.length === 1) redirect("/dashboard/" + organizations[0].id);

  const { data: mailboxRows, error: mailboxError } = await supabase
    .from("mailboxes")
    .select("id, organization_id, address, display_name")
    .in("organization_id", organizations.map((organization) => organization.id))
    .eq("status", "active")
    .order("address");

  const workspaceOrganizations = organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    role: memberships.find((membership) => membership.organization_id === organization.id)?.role ?? "member",
  }));

  return (
    <WorkspaceHome
      email={user.email ?? ""}
      organizations={workspaceOrganizations}
      mailboxes={mailboxRows ?? []}
      mailboxError={Boolean(mailboxError)}
    />
  );
}
