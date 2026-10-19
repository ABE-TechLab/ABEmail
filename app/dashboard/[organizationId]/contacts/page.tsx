import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ContactManager from "@/components/contact-manager";

export const metadata: Metadata = { title: "Contacts | ABEmail" };
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ContactsPageProps = {
  params: Promise<{ organizationId: string }>;
};

export default async function WorkspaceContactsPage({ params }: ContactsPageProps) {
  const { organizationId } = await params;
  if (!UUID_PATTERN.test(organizationId)) notFound();

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/auth/sign-in?next=" + encodeURIComponent("/dashboard/" + organizationId + "/contacts"));
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    return <section className="workspace-route-error"><h1>Contacts are not ready</h1><p>Workspace membership could not be checked. Try refreshing this page.</p></section>;
  }
  if (!membership) notFound();

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .eq("id", organizationId)
    .eq("status", "active")
    .maybeSingle();

  if (organizationError || !organization) notFound();



  return (
    <ContactManager
      organizationId={organization.id}
      organizationName={organization.name}
      userEmail={user.email ?? ""}
    />
  );
}
