import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkPilotDomain,
  getPilotApiKey,
  OTTAWA_PILOT_ADDRESS,
  OTTAWA_PILOT_DOMAIN,
  ResendPilotError,
} from "@/lib/email/resend-pilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return json({ error: "Cross-origin request rejected." }, 403);
    } catch {
      return json({ error: "Invalid request origin." }, 403);
    }
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Sign in to configure the pilot." }, 401);
  if (!user.email || !user.email_confirmed_at) {
    return json({ error: "Verify your account email before configuring the pilot." }, 403);
  }

  const allowedOperators = (process.env.ABEMAIL_PILOT_OPERATOR_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (!allowedOperators.length) {
    return json({ error: "Pilot setup is disabled until ABEMAIL_PILOT_OPERATOR_EMAILS is configured for Production." }, 503);
  }
  if (!allowedOperators.includes(user.email.toLowerCase())) {
    return json({ error: "This account is not authorized to configure the Ottawa pilot." }, 403);
  }

  const apiKey = getPilotApiKey();
  if (!apiKey) return json({ error: "The Ottawa pilot API key is missing from this environment." }, 503);

  let providerDomain;
  try {
    providerDomain = await checkPilotDomain(apiKey);
  } catch (error) {
    if (error instanceof ResendPilotError && error.code === "RESEND_PILOT_DOMAIN_NOT_FOUND") {
      return json({ error: "Resend does not list the configured Ottawa pilot domain." }, 424);
    }
    return json({ error: "Could not verify the Ottawa pilot with Resend. The API key needs permission to read domain status." }, 503);
  }

  if (
    providerDomain.name?.toLowerCase() !== OTTAWA_PILOT_DOMAIN ||
    providerDomain.status !== "verified" ||
    providerDomain.capabilities?.sending !== "enabled" ||
    providerDomain.capabilities?.receiving !== "enabled"
  ) {
    return json({ error: "Resend must report the exact pilot domain as verified with sending and receiving enabled before setup can continue." }, 424);
  }

  const admin = createAdminClient();
  if (!admin) return json({ error: "Server-side Supabase administration is not configured in this environment." }, 503);

  const { data: existingOrganization, error: organizationError } = await admin
    .from("organizations")
    .select("id, name, slug, status")
    .eq("slug", "ottawa-snow-match")
    .maybeSingle();
  let organization = existingOrganization;

  if (organizationError) return json({ error: "The pilot workspace could not be checked." }, 503);

  if (!organization) {
    const { data: createdId, error: createError } = await supabase.rpc("create_organization_with_owner", {
      p_name: "Ottawa Snow Match",
      p_slug: "ottawa-snow-match",
    });
    if (createError || typeof createdId !== "string") {
      const { data: racedOrganization } = await admin
        .from("organizations")
        .select("id, name, slug, status")
        .eq("slug", "ottawa-snow-match")
        .maybeSingle();
      organization = racedOrganization;
      if (!organization) return json({ error: "The Ottawa pilot workspace could not be created. Check account verification and the existing organization." }, 409);
    } else {
      const { data: createdOrganization, error: createdOrganizationError } = await admin
        .from("organizations")
        .select("id, name, slug, status")
        .eq("id", createdId)
        .maybeSingle();
      if (createdOrganizationError || !createdOrganization) return json({ error: "The pilot workspace was created but could not be loaded." }, 503);
      organization = createdOrganization;
    }
  }

  if (organization.status !== "active") return json({ error: "The existing Ottawa pilot workspace is not active." }, 409);

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role, status")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) return json({ error: "Pilot workspace access could not be checked." }, 503);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return json({ error: "An existing pilot workspace can only be configured by its owner or administrator." }, 403);
  }

  const { data: existingDomain, error: existingDomainError } = await admin
    .from("organization_domains")
    .select("id, organization_id, status")
    .eq("domain", OTTAWA_PILOT_DOMAIN)
    .maybeSingle();

  if (existingDomainError) return json({ error: "Pilot domain ownership could not be checked." }, 503);
  if (existingDomain && existingDomain.organization_id !== organization.id) {
    return json({ error: "The pilot domain is already attached to a different workspace. No changes were made." }, 409);
  }
  if (existingDomain?.status === "suspended") {
    return json({ error: "The pilot domain is suspended in ABEmail and must be reviewed by an operator." }, 409);
  }

  let domainId: string;
  if (existingDomain) {
    const { data: updatedDomain, error: updateDomainError } = await admin
      .from("organization_domains")
      .update({ status: "verified", verified_at: new Date().toISOString() })
      .eq("id", existingDomain.id)
      .eq("organization_id", organization.id)
      .select("id")
      .single();
    if (updateDomainError || !updatedDomain) return json({ error: "The verified domain could not be saved in ABEmail." }, 503);
    domainId = updatedDomain.id;
  } else {
    const { data: insertedDomain, error: insertDomainError } = await admin
      .from("organization_domains")
      .insert({
        organization_id: organization.id,
        domain: OTTAWA_PILOT_DOMAIN,
        status: "verified",
        verified_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (insertDomainError || !insertedDomain) return json({ error: "The verified domain could not be added to ABEmail." }, 503);
    domainId = insertedDomain.id;
  }

  const { data: existingMailbox, error: existingMailboxError } = await admin
    .from("mailboxes")
    .select("id, organization_id, domain_id, status")
    .eq("address", OTTAWA_PILOT_ADDRESS)
    .maybeSingle();

  if (existingMailboxError) return json({ error: "Pilot mailbox ownership could not be checked." }, 503);
  if (existingMailbox && (
    existingMailbox.organization_id !== organization.id ||
    existingMailbox.domain_id !== domainId ||
    existingMailbox.status === "suspended"
  )) {
    return json({ error: "The pilot mailbox conflicts with an existing workspace or is suspended. No mailbox changes were made." }, 409);
  }

  let mailboxId: string;
  if (existingMailbox) {
    const { data: updatedMailbox, error: updateMailboxError } = await admin
      .from("mailboxes")
      .update({ status: "active", display_name: "Ottawa Snow Match" })
      .eq("id", existingMailbox.id)
      .eq("organization_id", organization.id)
      .select("id")
      .single();
    if (updateMailboxError || !updatedMailbox) return json({ error: "The pilot mailbox could not be activated." }, 503);
    mailboxId = updatedMailbox.id;
  } else {
    const { data: insertedMailbox, error: insertMailboxError } = await admin
      .from("mailboxes")
      .insert({
        organization_id: organization.id,
        domain_id: domainId,
        local_part: "info",
        address: OTTAWA_PILOT_ADDRESS,
        display_name: "Ottawa Snow Match",
        status: "active",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (insertMailboxError || !insertedMailbox) return json({ error: "The pilot mailbox could not be created." }, 503);
    mailboxId = insertedMailbox.id;
  }

  const { error: grantError } = await admin
    .from("mailbox_memberships")
    .upsert({
      organization_id: organization.id,
      mailbox_id: mailboxId,
      user_id: user.id,
      can_read: true,
      can_send: true,
      can_manage: true,
      status: "active",
      granted_by: user.id,
    }, { onConflict: "mailbox_id,user_id" });

  if (grantError) return json({ error: "The pilot mailbox is ready but access could not be granted. Retry setup or review the workspace grants." }, 503);

  return json({
    ok: true,
    organizationId: organization.id,
    mailboxId,
    address: OTTAWA_PILOT_ADDRESS,
    note: "The pilot workspace and mailbox are configured. Live sending and receiving still require Production credentials, a deployed webhook, and a verified end-to-end test.",
  });
}
