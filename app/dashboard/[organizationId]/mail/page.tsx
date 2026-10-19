import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LiveMailbox from "@/components/live-mailbox";

export const metadata: Metadata = { title: "Workspace inbox | ABEmail" };
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAILBOX_VIEWS = ["Inbox", "Sent", "Starred", "Drafts", "Scheduled", "Archive", "Trash", "Spam"] as const;
type ActiveMailboxView = (typeof MAILBOX_VIEWS)[number];
type MailPageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams?: Promise<{ view?: string }>;
};

export default async function WorkspaceMailPage({ params, searchParams }: MailPageProps) {
  const { organizationId } = await params;
  const { view } = (await searchParams) ?? {};
  const activeView: ActiveMailboxView = MAILBOX_VIEWS.includes(view as ActiveMailboxView) ? (view as ActiveMailboxView) : "Inbox";
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
  const workspaces = (workspaceRows ?? []).map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    role: workspaceMemberships.find((row) => row.organization_id === workspace.id)?.role
      ?? (workspace.id === organization.id ? membership.role : "member"),
  }));

  const { data: mailboxRows, error: mailboxError } = await supabase
    .from("mailboxes")
    .select("id, address, display_name")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("address");

  const rawMailboxes = (mailboxRows ?? []).map((mailbox) => ({
    id: mailbox.id,
    address: mailbox.address,
    display_name: mailbox.display_name,
  }));
  const isOrganizationMailAdmin = membership.role === "owner" || membership.role === "admin";
  let manageableMailboxIds = new Set<string>();
  if (!isOrganizationMailAdmin && rawMailboxes.length) {
    const { data: manageRows } = await supabase
      .from("mailbox_memberships")
      .select("mailbox_id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("can_manage", true)
      .in("mailbox_id", rawMailboxes.map((mailbox) => mailbox.id));
    manageableMailboxIds = new Set((manageRows ?? []).map((row) => row.mailbox_id));
  }
  const mailboxes = rawMailboxes.map((mailbox) => ({
    ...mailbox,
    canManage: isOrganizationMailAdmin || manageableMailboxIds.has(mailbox.id),
  }));

  type MailRow = {
    id: string;
    mailbox_id: string;
    direction: "inbound" | "outbound";
    from_address: string;
    to_addresses: string[];
    cc_addresses: string[];
    reply_to_addresses: string[];
    subject: string;
    body_text: string | null;
    body_html: string | null;
    status: string;
    created_at: string;
    received_at: string | null;
    sent_at: string | null;
  };
  type MailStateRow = {
    message_id: string;
    is_read: boolean;
    is_starred: boolean;
    archived_at: string | null;
    trashed_at: string | null;
    spam_at: string | null;
  };
  let messages: (MailRow & {
    is_read: boolean;
    is_starred: boolean;
    archived_at: string | null;
    trashed_at: string | null;
    spam_at: string | null;
  })[] = [];
  let messagesError = false;

  if (mailboxes.length) {
    const { data, error } = await supabase
      .from("email_messages")
      .select("id, mailbox_id, direction, from_address, to_addresses, cc_addresses, reply_to_addresses, subject, body_text, body_html, status, created_at, received_at, sent_at")
      .eq("organization_id", organizationId)
      .in("mailbox_id", mailboxes.map((mailbox) => mailbox.id))
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      messagesError = true;
    } else {
      const messageRows = (data ?? []) as MailRow[];
      let stateRows: MailStateRow[] = [];
      if (messageRows.length) {
        const { data: persistedState, error: stateError } = await supabase
          .from("email_message_user_state")
          .select("message_id, is_read, is_starred, archived_at, trashed_at, spam_at")
          .eq("organization_id", organizationId)
          .eq("user_id", user.id)
          .in("message_id", messageRows.map((message) => message.id));
        if (stateError) messagesError = true;
        else stateRows = (persistedState ?? []) as MailStateRow[];
      }

      const stateByMessage = new Map<string, MailStateRow>(
        stateRows.map((state) => [state.message_id, state])
      );
      messages = messageRows.map((message) => {
        const state = stateByMessage.get(message.id);
        return {
          ...message,
          is_read: state?.is_read ?? message.direction === "outbound",
          is_starred: state?.is_starred ?? false,
          archived_at: state?.archived_at ?? null,
          trashed_at: state?.trashed_at ?? null,
          spam_at: state?.spam_at ?? null,
        };
      });
    }
  }

  return (
    <LiveMailbox
      organizationId={organization.id}
      organizationName={organization.name}
      userEmail={user.email ?? ""}
      mailboxes={mailboxes}
      messages={messages}
      messagesError={messagesError || Boolean(mailboxError)}
      activeView={activeView}
      workspaces={workspaces}
    />
  );
}
