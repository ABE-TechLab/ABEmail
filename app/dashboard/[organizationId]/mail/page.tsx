import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LiveMailbox from "@/components/live-mailbox";

export const metadata: Metadata = { title: "Workspace inbox | ABEmail" };
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAILBOX_VIEWS = ["Inbox", "Sent", "Starred", "Drafts", "Scheduled", "Snoozed", "Archive", "Trash", "Spam"] as const;
type ActiveMailboxView = (typeof MAILBOX_VIEWS)[number];
type MailPageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams?: Promise<{ view?: string; composeTo?: string; compose?: string }>;
};

export default async function WorkspaceMailPage({ params, searchParams }: MailPageProps) {
  const { organizationId } = await params;
  const { view, composeTo, compose } = (await searchParams) ?? {};
  const initialCompose = compose === "1";
  const initialRecipient = typeof composeTo === "string" && composeTo.length <= 254 && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(composeTo.trim()) ? composeTo.trim().toLowerCase() : undefined;
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
    return <section className="workspace-route-error"><h1>Mail is not ready</h1><p>Workspace membership could not be checked.</p></section>;
  }
  if (!membership) notFound();

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .eq("id", organizationId)
    .eq("status", "active")
    .maybeSingle();

  if (organizationError || !organization) notFound();
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
    snoozed_until: string | null;
  };
  let messages: (MailRow & {
    is_read: boolean;
    is_starred: boolean;
    archived_at: string | null;
    trashed_at: string | null;
    spam_at: string | null;
    snoozed_until: string | null;
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
      let messageRows = (data ?? []) as MailRow[];

      // Keep active snoozes and recently expired messages available outside the latest-message window.
      // Inbox loads both recently expired items and the soonest upcoming deadlines so either can return visibly.
      if (activeView === "Inbox" || activeView === "Snoozed") {
        const snoozeCutoff = new Date().toISOString();
        const querySnoozedState = () => supabase
          .from("email_message_user_state")
          .select("message_id, snoozed_until")
          .eq("organization_id", organizationId)
          .eq("user_id", user.id)
          .in("mailbox_id", mailboxes.map((mailbox) => mailbox.id));

        const snoozedStateResults = activeView === "Inbox"
          ? await Promise.all([
              querySnoozedState()
                .lte("snoozed_until", snoozeCutoff)
                .order("snoozed_until", { ascending: false })
                .limit(120),
              querySnoozedState()
                .gt("snoozed_until", snoozeCutoff)
                .order("snoozed_until", { ascending: true })
                .limit(120),
            ])
          : [
              await querySnoozedState()
                .gt("snoozed_until", snoozeCutoff)
                .order("snoozed_until", { ascending: true })
                .limit(120),
            ];

        if (snoozedStateResults.some(({ error }) => error)) {
          messagesError = true;
        } else {
          const snoozedStateRows = snoozedStateResults.flatMap(({ data }) => data ?? []);
          const presentIds = new Set(messageRows.map((message) => message.id));
          const extraIds = [...new Set(snoozedStateRows.map((state) => state.message_id))]
            .filter((messageId) => !presentIds.has(messageId));

          if (extraIds.length) {
            const { data: retainedRows, error: retainedError } = await supabase
              .from("email_messages")
              .select("id, mailbox_id, direction, from_address, to_addresses, cc_addresses, reply_to_addresses, subject, body_text, body_html, status, created_at, received_at, sent_at")
              .eq("organization_id", organizationId)
              .in("mailbox_id", mailboxes.map((mailbox) => mailbox.id))
              .in("id", extraIds);

            if (retainedError) {
              messagesError = true;
            } else {
              const combined = new Map<string, MailRow>(messageRows.map((message) => [message.id, message]));
              for (const message of (retainedRows ?? []) as MailRow[]) combined.set(message.id, message);
              messageRows = [...combined.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
            }
          }
        }
      }

      let stateRows: MailStateRow[] = [];
      if (messageRows.length) {
        const { data: persistedState, error: stateError } = await supabase
          .from("email_message_user_state")
          .select("message_id, is_read, is_starred, archived_at, trashed_at, spam_at, snoozed_until")
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
          snoozed_until: state?.snoozed_until ?? null,
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
      initialRecipient={initialRecipient}
      initialCompose={initialCompose}
    />
  );
}
