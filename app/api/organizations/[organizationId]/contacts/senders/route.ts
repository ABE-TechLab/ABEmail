import { NextResponse } from "next/server";
import { getContactRequestContext } from "@/lib/contacts/request-context";
import { getGravatarAvatarUrl, isSafeSenderAvatarUrl, normalizeAvatarEmail } from "@/lib/email/sender-avatar.mjs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ organizationId: string }> };
type IncomingMessage = {
  id: string;
  mailbox_id: string;
  from_address: string;
  subject: string;
  received_at: string | null;
  created_at: string;
  sender_avatar_url: string | null;
};

function avatarFor(email: string, stored: string | null) {
  return isSafeSenderAvatarUrl(stored) ?? getGravatarAvatarUrl(email);
}

export async function GET(request: Request, { params }: RouteContext) {
  const { organizationId } = await params;
  const context = await getContactRequestContext(organizationId);
  if ("response" in context) return context.response;

  const url = new URL(request.url);
  const requestedEmail = url.searchParams.get("email");
  if (requestedEmail !== null) {
    const email = normalizeAvatarEmail(requestedEmail);
    if (!email) {
      return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
    }

    const { data, error } = await context.supabase
      .from("email_messages")
      .select("id, mailbox_id, from_address, subject, received_at, created_at, sender_avatar_url")
      .eq("organization_id", organizationId)
      .eq("direction", "inbound")
      .eq("from_address", email)
      .order("received_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ ok: false, error: "Message history could not be loaded." }, { status: 503 });
    }

    const messages = (data ?? []) as IncomingMessage[];
    return NextResponse.json({
      ok: true,
      email,
      avatar_url: avatarFor(email, messages[0]?.sender_avatar_url ?? null),
      messages: messages.map((message) => ({
        id: message.id,
        subject: message.subject || "(no subject)",
        received_at: message.received_at ?? message.created_at,
        mailbox_id: message.mailbox_id,
      })),
    });
  }

  const [messagesResult, contactsResult] = await Promise.all([
    context.supabase
      .from("email_messages")
      .select("id, mailbox_id, from_address, subject, received_at, created_at, sender_avatar_url")
      .eq("organization_id", organizationId)
      .eq("direction", "inbound")
      .order("received_at", { ascending: false })
      .limit(1000),
    context.supabase
      .from("contacts")
      .select("email")
      .eq("organization_id", organizationId),
  ]);

  if (messagesResult.error || contactsResult.error) {
    return NextResponse.json({ ok: false, error: "Recent senders could not be loaded." }, { status: 503 });
  }

  const savedEmails = new Set((contactsResult.data ?? []).map((contact) => contact.email.toLowerCase()));
  const senders = new Map<string, {
    email: string;
    avatar_url: string | null;
    message_count: number;
    last_received_at: string;
    latest_subject: string;
    latest_message_id: string;
  }>();

  for (const rawMessage of (messagesResult.data ?? []) as IncomingMessage[]) {
    const email = normalizeAvatarEmail(rawMessage.from_address);
    if (!email || savedEmails.has(email)) continue;
    const receivedAt = rawMessage.received_at ?? rawMessage.created_at;
    const current = senders.get(email);
    if (current) {
      current.message_count += 1;
      continue;
    }
    senders.set(email, {
      email,
      avatar_url: avatarFor(email, rawMessage.sender_avatar_url),
      message_count: 1,
      last_received_at: receivedAt,
      latest_subject: rawMessage.subject || "(no subject)",
      latest_message_id: rawMessage.id,
    });
  }

  return NextResponse.json({ ok: true, senders: Array.from(senders.values()) });
}
