import type { Metadata } from "next";
import Link from "next/link";
import SignOutButton from "@/components/auth/sign-out-button";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import WorkspaceHome from "@/components/workspace-home";
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
  if (!user) redirect("/auth/sign-in?next=" + encodeURIComponent("/dashboard/" + organizationId));

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

  // Ottawa's current business mailbox opens directly. Other workspaces see
  // a live activation checklist until Resend, a domain and a mailbox are ready.
  if (organization.slug === "ottawa-snow-match") {
    redirect("/dashboard/" + organization.id + "/mail");
  }

  const { data: workspaceMembershipRows } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");
  const workspaceMemberships = workspaceMembershipRows ?? [];
  const workspaceIds = [...new Set([...workspaceMemberships.map((row) => row.organization_id), organization.id])];
  const { data: workspaceRows } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .in("id", workspaceIds)
    .eq("status", "active");

  const workspaceOrganizations = (workspaceRows ?? []).map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    role: workspaceMemberships.find((row) => row.organization_id === workspace.id)?.role
      ?? (workspace.id === organization.id ? membership.role : "member"),
  }));
  const currentOrganization = workspaceOrganizations.find((workspace) => workspace.id === organization.id) ?? {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    role: membership.role,
  };

  // Read mailbox records only for organizations this signed-in user belongs to.
  const { data: mailboxRows, error: mailboxError } = await supabase
    .from("mailboxes")
    .select("id, address, display_name, organization_id")
    .in("organization_id", workspaceIds)
    .eq("status", "active")
    .order("address");

  const admin = createAdminClient();
  let providerConnected = false;
  let workspaceDomains: { id: string; domain: string; status: string; sending_enabled: boolean; receiving_enabled: boolean }[] = [];
  if (admin) {
    const { data: providerConnection } = await admin
      .from("organization_provider_connections")
      .select("status")
      .eq("organization_id", organization.id)
      .maybeSingle();
    providerConnected = providerConnection?.status === "connected";

    const { data: domainRows } = await admin
      .from("organization_domains")
      .select("id, domain, status, sending_enabled, receiving_enabled")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: true });
    workspaceDomains = (domainRows ?? []).map((domain) => ({
      id: domain.id,
      domain: domain.domain,
      status: domain.status,
      sending_enabled: Boolean(domain.sending_enabled),
      receiving_enabled: Boolean(domain.receiving_enabled),
    }));
  }

  const currentMailboxCount = (mailboxRows ?? []).filter((mailbox) => mailbox.organization_id === organization.id).length;
  const verifiedDomainReady = workspaceDomains.some((domain) => domain.status === "verified" && domain.sending_enabled && domain.receiving_enabled);
  if (providerConnected && verifiedDomainReady && currentMailboxCount > 0) {
    redirect("/dashboard/" + organization.id + "/mail");
  }

  return (
    <WorkspaceHome
      email={user.email ?? ""}
      organizations={workspaceOrganizations}
      selectedOrganization={currentOrganization}
      mailboxes={(mailboxRows ?? []).map((mailbox) => ({
        id: mailbox.id,
        organization_id: mailbox.organization_id,
        address: mailbox.address,
        display_name: mailbox.display_name,
      }))}
      mailboxError={Boolean(mailboxError)}
      providerConnected={providerConnected}
      workspaceDomains={workspaceDomains}
    />
  );
}
