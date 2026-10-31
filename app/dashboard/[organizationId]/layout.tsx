import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import WorkspaceSidebar, { type WorkspaceChoice } from "@/components/workspace-sidebar";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WorkspaceLayoutProps = {
  children: ReactNode;
  params: Promise<{ organizationId: string }>;
};

/**
 * Single persistent shell for every route inside a workspace.
 * Feature pages render content only; they must not create their own sidebar.
 */
export default async function WorkspaceLayout({ children, params }: WorkspaceLayoutProps) {
  const { organizationId } = await params;
  if (!UUID_PATTERN.test(organizationId)) notFound();

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/auth/sign-in?next=" + encodeURIComponent("/dashboard/" + organizationId));
  }

  const { data: membershipRows, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (membershipError || !membershipRows?.length) redirect("/dashboard");

  const currentMembership = membershipRows.find((membership) => membership.organization_id === organizationId);
  if (!currentMembership) notFound();

  const workspaceIds = [...new Set(membershipRows.map((membership) => membership.organization_id))];
  const { data: workspaceRows, error: workspaceError } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .in("id", workspaceIds)
    .eq("status", "active")
    .order("name");

  if (workspaceError || !workspaceRows?.some((workspace) => workspace.id === organizationId)) notFound();

  const workspaces: WorkspaceChoice[] = workspaceRows.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    role: membershipRows.find((membership) => membership.organization_id === workspace.id)?.role ?? "member",
  }));
  const organization = workspaceRows.find((workspace) => workspace.id === organizationId)!;
  const base = "/dashboard/" + organizationId;
  const mailboxHref = base + "/mail";

  return (
    <div className="mail-app workspace-app-shell">
      <WorkspaceSidebar
        organizationId={organizationId}
        composeHref={mailboxHref + "?compose=1"}
        homeHref={mailboxHref}
        mailboxBaseHref={mailboxHref}
        workspaceBaseHref={base}
        workspaceName={organization.name}
        workspaceDescription="Business workspace"
        workspaces={workspaces}
        activeWorkspaceId={organizationId}
      />
      <main className="mail-main workspace-main-content">{children}</main>
    </div>
  );
}
