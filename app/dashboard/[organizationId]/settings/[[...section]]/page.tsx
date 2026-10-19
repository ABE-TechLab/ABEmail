import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import SettingsWorkspace, { type SettingsSection } from "@/components/settings-workspace";
import type { WorkspaceSettingsContext } from "@/components/workspace-settings-panel";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Workspace settings | ABEmail" };
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SETTINGS_SECTIONS: SettingsSection[] = [
  "general",
  "appearance",
  "mail",
  "notifications",
  "team",
  "domains",
  "mailboxes",
  "security",
];

type WorkspaceSettingsPageProps = {
  params: Promise<{ organizationId: string; section?: string[] }>;
};

export default async function WorkspaceSettingsPage({ params }: WorkspaceSettingsPageProps) {
  const { organizationId, section: sectionSegments } = await params;
  if (!UUID_PATTERN.test(organizationId)) notFound();

  const requestedSection = sectionSegments?.[0] ?? "general";
  if (!SETTINGS_SECTIONS.includes(requestedSection as SettingsSection) || (sectionSegments?.length ?? 0) > 1) notFound();
  const section = requestedSection as SettingsSection;
  const nextPath = "/dashboard/" + organizationId + "/settings" + (section === "general" ? "" : "/" + section);

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/auth/sign-in?next=" + encodeURIComponent(nextPath));

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) notFound();

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .eq("id", organizationId)
    .eq("status", "active")
    .maybeSingle();

  if (organizationError || !organization) notFound();



  const { data: mailboxRows } = await supabase
    .from("mailboxes")
    .select("id, address, display_name")
    .eq("organization_id", organization.id)
    .eq("status", "active")
    .order("address");

  const { data: memberRows } = await supabase
    .from("organization_memberships")
    .select("user_id, role, status")
    .eq("organization_id", organization.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const workspaceContext: WorkspaceSettingsContext = {
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    organizationRole: membership.role,
    email: user.email ?? "",
    userId: user.id,
    mailboxes: (mailboxRows ?? []).map((mailbox) => ({
      id: mailbox.id,
      address: mailbox.address,
      display_name: mailbox.display_name,
    })),
    members: (memberRows ?? []).map((member) => ({
      user_id: member.user_id,
      role: member.role,
      status: member.status,
    })),
  };

  return <SettingsWorkspace section={section} workspace={workspaceContext} />;
}
