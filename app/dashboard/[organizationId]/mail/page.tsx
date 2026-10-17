import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LiveMailbox from "@/components/live-mailbox";

export const metadata: Metadata = { title: "Pilot mail | ABEmail" };
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type MailPageProps = { params: Promise<{ organizationId: string }> };

export default async function PilotMailPage({ params }: MailPageProps) {
  const { organizationId } = await params;
  if (!UUID_PATTERN.test(organizationId)) notFound();

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/auth/sign-in?next=" + encodeURIComponent("/dashboard/" + organizationId + "/mail"));
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    return <main style={{ padding: 28 }}><h1>Mail is not ready</h1><p>Workspace membership could not be checked.</p></main>;
  }
  if (!membership) notFound();

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .eq("id", organizationId)
    .eq("status", "active")
    .maybeSingle();

  if (organizationError || !organization) notFound();
  if (organization.slug !== "ottawa-snow-match") {
    return <main style={{ padding: 28 }}><h1>Pilot mailbox only</h1><p>This first live transport release is limited to the Ottawa Snow Match test workspace.</p></main>;
  }

  const { data: mailboxRows, error: mailboxError } = await supabase
    .from("mailboxes")
    .select("id, address, display_name")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("address");

  const mailboxes = (mailboxRows ?? []).map((mailbox) => ({
    id: mailbox.id,
    address: mailbox.address,
    display_name: mailbox.display_name,
  }));

  type MailRow = {
    id: string;
    mailbox_id: string;
    direction: "inbound" | "outbound";
    from_address: string;
    to_addresses: string[];
    subject: string;
    body_text: string | null;
    body_html: string | null;
    status: string;
    created_at: string;
    received_at: string | null;
    sent_at: string | null;
  };
  let messages: MailRow[] = [];
  let messagesError = false;

  if (mailboxes.length) {
    const { data, error } = await supabase
      .from("email_messages")
      .select("id, mailbox_id, direction, from_address, to_addresses, subject, body_text, body_html, status, created_at, received_at, sent_at")
      .eq("organization_id", organizationId)
      .in("mailbox_id", mailboxes.map((mailbox) => mailbox.id))
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) messagesError = true;
    else messages = (data ?? []) as MailRow[];
  }

  return (
    <LiveMailbox
      organizationId={organization.id}
      organizationName={organization.name}
      mailboxes={mailboxes}
      messages={messages}
      allowPilotSetup={membership.role === "owner" || membership.role === "admin"}
      messagesError={messagesError || Boolean(mailboxError)}
    />
  );
}
