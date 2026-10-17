import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptProviderSecret, ResendProviderError, sendResendEmail } from "@/lib/email/resend-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RouteContext = { params: Promise<{ organizationId: string }> };

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function checkOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function authorize(organizationId: string) {
  if (!UUID_PATTERN.test(organizationId)) return { response: json({ error: "Invalid workspace." }, 400) };
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: json({ error: "Sign in to manage invitations." }, 401) };

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) return { response: json({ error: "Workspace permissions could not be checked." }, 503) };
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { response: json({ error: "Only workspace owners and admins can invite team members." }, 403) };
  }

  const admin = createAdminClient();
  if (!admin) return { response: json({ error: "Server-side database access is not configured." }, 503) };

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id, name, slug, status")
    .eq("id", organizationId)
    .maybeSingle();
  if (organizationError) return { response: json({ error: "Workspace status could not be checked." }, 503) };
  if (!organization || organization.status !== "active") return { response: json({ error: "This workspace is not active." }, 403) };

  return { user, membership, admin, organization };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { organizationId } = await context.params;
  const auth = await authorize(organizationId);
  if ("response" in auth) return auth.response;

  const { data: invitations, error } = await auth.admin
    .from("organization_invitations")
    .select("id, invite_email, role, expires_at, accepted_at, accepted_by, revoked_at, created_at, delivery_status, delivery_error_code, sent_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return json({ error: "Workspace invitations could not be loaded." }, 503);

  return json({
    ok: true,
    invitations: (invitations ?? []).map((invitation) => ({
      id: invitation.id,
      email: invitation.invite_email,
      role: invitation.role,
      expiresAt: invitation.expires_at,
      acceptedAt: invitation.accepted_at,
      revokedAt: invitation.revoked_at,
      createdAt: invitation.created_at,
      deliveryStatus: invitation.delivery_status ?? (invitation.sent_at ? "sent" : "pending"),
      deliveryErrorCode: invitation.delivery_error_code,
      sentAt: invitation.sent_at,
      state: invitation.accepted_at ? "accepted"
        : invitation.revoked_at ? "revoked"
          : new Date(invitation.expires_at).getTime() <= Date.now() ? "expired" : "pending",
    })),
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!checkOrigin(request)) return json({ error: "Cross-origin request rejected." }, 403);
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 8000) return json({ error: "The request is too large." }, 413);

  const { organizationId } = await context.params;
  const auth = await authorize(organizationId);
  if ("response" in auth) return auth.response;

  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 8000) return json({ error: "The request is too large." }, 413);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Send a valid JSON body." }, 400);
  }

  const email = typeof payload === "object" && payload !== null && "email" in payload && typeof payload.email === "string"
    ? payload.email.trim().toLowerCase()
    : "";
  const role = typeof payload === "object" && payload !== null && "role" in payload && typeof payload.role === "string"
    ? payload.role
    : "member";
  const mailboxIds = typeof payload === "object" && payload !== null && "mailboxIds" in payload && Array.isArray(payload.mailboxIds)
    ? payload.mailboxIds
    : [];
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (role !== "admin" && role !== "member") return json({ error: "Choose either the Admin or Member role." }, 400);
  if (!mailboxIds.length || mailboxIds.length > 50 || mailboxIds.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id)) || new Set(mailboxIds).size !== mailboxIds.length) {
    return json({ error: "Choose at least one active mailbox for this teammate." }, 400);
  }

  const { data: chosenMailboxes, error: chosenMailboxError } = await auth.admin
    .from("mailboxes")
    .select("id, address, status")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .in("id", mailboxIds);
  if (chosenMailboxError) return json({ error: "Mailbox access could not be checked." }, 503);
  if ((chosenMailboxes ?? []).length !== mailboxIds.length) {
    return json({ error: "One or more selected mailboxes are no longer active in this workspace. Refresh and try again." }, 409);
  }
  if (email === (auth.user.email ?? "").toLowerCase()) return json({ error: "You are already signed in to this workspace." }, 409);

  const now = new Date();
  const { data: duplicate, error: duplicateError } = await auth.admin
    .from("organization_invitations")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("invite_email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", now.toISOString())
    .limit(1)
    .maybeSingle();
  if (duplicateError) return json({ error: "Existing invitations could not be checked." }, 503);
  if (duplicate) return json({ error: "There is already an active invitation for this email. Revoke it before sending another." }, 409);

  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: rateError } = await auth.admin
    .from("organization_invitations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", hourAgo);
  if (rateError) return json({ error: "Invitation rate limit could not be checked." }, 503);
  if ((recentCount ?? 0) >= 10) return json({ error: "This workspace has reached the limit of 10 invitations per hour. Try again later." }, 429);

  const { data: providerConnection, error: connectionError } = await auth.admin
    .from("organization_provider_connections")
    .select("api_key_ciphertext, status")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (connectionError) return json({ error: "The workspace email connection could not be checked." }, 503);
  if (!providerConnection || providerConnection.status !== "connected") {
    return json({ error: "Connect Resend in Settings before sending team invitations." }, 409);
  }

  let apiKey: string;
  try {
    apiKey = decryptProviderSecret(providerConnection.api_key_ciphertext);
  } catch {
    return json({ error: "The workspace Resend credentials could not be decrypted. Reconnect Resend in Settings." }, 503);
  }

  const { data: domains, error: domainError } = await auth.admin
    .from("organization_domains")
    .select("id, domain, provider_domain_id, status, verified_at, sending_enabled")
    .eq("organization_id", organizationId)
    .eq("status", "verified")
    .not("provider_domain_id", "is", null);
  if (domainError) return json({ error: "A verified sender domain could not be checked." }, 503);
  const senderDomains = (domains ?? []).filter((domain) => domain.verified_at && domain.sending_enabled);
  if (!senderDomains.length) return json({ error: "Verify a domain with sending enabled before sending team invitations." }, 409);

  const { data: mailboxes, error: mailboxError } = await auth.admin
    .from("mailboxes")
    .select("id, address, display_name, domain_id, status")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .in("domain_id", senderDomains.map((domain) => domain.id))
    .order("created_at", { ascending: true })
    .limit(1);
  const mailbox = mailboxes?.[0];
  if (mailboxError) return json({ error: "An active sender mailbox could not be checked." }, 503);
  if (!mailbox) return json({ error: "Create an active mailbox on a verified sending domain before sending team invitations." }, 409);

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  const { data: invitation, error: insertError } = await auth.admin
    .from("organization_invitations")
    .insert({
      organization_id: organizationId,
      invite_email: email,
      role,
      token_hash: tokenHash,
      invited_by: auth.user.id,
      delivery_status: "pending",
    })
    .select("id, expires_at, created_at")
    .single();

  if (insertError || !invitation) {
    if (insertError?.code === "23505") return json({ error: "An identical invitation was just created. Refresh the invitation list." }, 409);
    return json({ error: "The invitation could not be saved." }, 503);
  }

  const { error: grantError } = await auth.admin
    .from("organization_invitation_mailboxes")
    .insert(mailboxIds.map((mailboxId) => ({
      organization_id: organizationId,
      invitation_id: invitation.id,
      mailbox_id: mailboxId,
      use_as_login_alias: false,
    })));
  if (grantError) {
    await auth.admin.from("organization_invitations").delete().eq("id", invitation.id).eq("organization_id", organizationId);
    return json({ error: "Mailbox access could not be attached to the invitation. No invitation was sent; check workspace access settings and retry." }, 503);
  }

  const publicOrigin = process.env.ABEMAIL_PUBLIC_APP_URL?.trim() || new URL(request.url).origin;
  let inviteUrl: string;
  try {
    const url = new URL("/auth/accept-invitation", publicOrigin);
    url.searchParams.set("token", token);
    inviteUrl = url.toString();
    if (url.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("HTTPS is required");
  } catch {
    await auth.admin.from("organization_invitations").update({ revoked_at: new Date().toISOString(), delivery_status: "failed", delivery_error_code: "INVITE_URL_INVALID" }).eq("id", invitation.id);
    return json({ error: "The ABEmail public URL is not configured correctly." }, 503);
  }

  const roleLabel = role === "admin" ? "an administrator" : "a member";
  const textBody = [
    "You've been invited to join " + auth.organization.name + " on ABEmail as " + roleLabel + ".",
    "",
    "Accept your invitation using this secure link:",
    inviteUrl,
    "",
    "This invitation gives access to: " + chosenMailboxes.map((mailbox) => mailbox.address).join(", "),
    "",
    "This invitation expires on " + new Date(invitation.expires_at).toLocaleString("en-GB", { timeZone: "UTC", timeZoneName: "short" }) + ".",
    "If you weren't expecting this invitation, you can ignore this email.",
  ].join("\n");

  try {
    await sendResendEmail({
      apiKey,
      from: (mailbox.display_name || auth.organization.name) + " <" + mailbox.address + ">",
      to: email,
      subject: "Invitation to join " + auth.organization.name + " on ABEmail",
      text: textBody,
      idempotencyKey: "invite/" + invitation.id,
    });

    const { error: updateError } = await auth.admin
      .from("organization_invitations")
      .update({ delivery_status: "sent", sent_at: new Date().toISOString(), delivery_error_code: null })
      .eq("id", invitation.id)
      .eq("organization_id", organizationId);
    if (updateError) return json({ ok: true, invitation: { id: invitation.id, email, role, expiresAt: invitation.expires_at, mailboxIds }, inviteUrl, emailStatus: "sent", note: "The invite email was accepted by Resend, but the send state could not be saved. Keep this link available until the invitation appears as Sent." }, 201);

    return json({
      ok: true,
      invitation: { id: invitation.id, email, role, expiresAt: invitation.expires_at, mailboxIds },
      emailStatus: "sent",
      note: "Invitation email accepted by Resend. The recipient still needs to accept it and verify their invited email.",
    }, 201);
  } catch (error) {
    const deliveryUnknown = error instanceof ResendProviderError && error.code === "RESEND_SEND_OUTCOME_UNKNOWN";
    const deliveryStatus = deliveryUnknown ? "delivery_unknown" : "failed";
    const errorCode = error instanceof ResendProviderError ? error.code : "INVITATION_EMAIL_SEND_FAILED";
    await auth.admin
      .from("organization_invitations")
      .update({ delivery_status: deliveryStatus, delivery_error_code: errorCode })
      .eq("id", invitation.id)
      .eq("organization_id", organizationId);

    return json({
      ok: true,
      invitation: { id: invitation.id, email, role, expiresAt: invitation.expires_at, mailboxIds },
      inviteUrl,
      emailStatus: deliveryStatus,
      note: deliveryUnknown
        ? "Resend's acceptance response was not confirmed. The invitation remains active; check the Resend logs before sending another email. You can copy the invitation link below."
        : "The invitation link was created, but the email could not be sent. You can copy the active link below or retry after fixing the provider connection.",
    }, 201);
  }
}
