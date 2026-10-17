import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPilotReceiveApiKey, getPilotSendApiKey } from "@/lib/email/resend-pilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_PART_PATTERN = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;

type RouteContext = { params: Promise<{ organizationId: string }> };

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function authorize(organizationId: string) {
  if (!UUID_PATTERN.test(organizationId)) return { response: json({ error: "Invalid workspace." }, 400) };
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: json({ error: "Sign in to manage mailboxes." }, 401) };

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return { response: json({ error: "Workspace permissions could not be checked." }, 503) };
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return { response: json({ error: "Only workspace owners and admins can manage mailboxes." }, 403) };
  }

  const admin = createAdminClient();
  if (!admin) return { response: json({ error: "Server-side database access is not configured." }, 503) };
  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id, slug, status")
    .eq("id", organizationId)
    .maybeSingle();
  if (organizationError) return { response: json({ error: "Workspace status could not be checked." }, 503) };
  if (!organization || organization.status !== "active") return { response: json({ error: "This workspace is not active." }, 403) };

  return { user, admin, organization };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { organizationId } = await context.params;
  const auth = await authorize(organizationId);
  if ("response" in auth) return auth.response;
  const { data, error } = await auth.admin
    .from("mailboxes")
    .select("id, address, display_name, status, domain_id, created_at")
    .eq("organization_id", organizationId)
    .order("address");
  if (error) return json({ error: "Workspace mailboxes could not be loaded." }, 503);
  return json({ ok: true, mailboxes: data ?? [] });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return json({ error: "Cross-origin request rejected." }, 403);
    } catch {
      return json({ error: "Invalid request origin." }, 403);
    }
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 10000) return json({ error: "The request is too large." }, 413);

  const { organizationId } = await context.params;
  const auth = await authorize(organizationId);
  if ("response" in auth) return auth.response;

  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 10000) return json({ error: "The request is too large." }, 413);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Send a valid JSON request." }, 400);
  }

  const localPart = typeof payload === "object" && payload !== null && "localPart" in payload && typeof payload.localPart === "string"
    ? payload.localPart.trim().toLowerCase()
    : "";
  const domainId = typeof payload === "object" && payload !== null && "domainId" in payload && typeof payload.domainId === "string"
    ? payload.domainId
    : "";
  const displayName = typeof payload === "object" && payload !== null && "displayName" in payload && typeof payload.displayName === "string"
    ? payload.displayName.trim()
    : "";

  if (!LOCAL_PART_PATTERN.test(localPart) || localPart.length > 64) {
    return json({ error: "Enter a valid mailbox name before the @ sign, using letters, numbers, dots, or standard email symbols." }, 400);
  }
  if (!UUID_PATTERN.test(domainId)) return json({ error: "Choose a valid domain from this workspace." }, 400);
  if (displayName.length > 120) return json({ error: "Display name must be 120 characters or fewer." }, 400);

  const { data: domain, error: domainError } = await auth.admin
    .from("organization_domains")
    .select("id, domain, status, sending_enabled, receiving_enabled, verified_at")
    .eq("id", domainId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (domainError) return json({ error: "The domain status could not be checked." }, 503);
  if (!domain) return json({ error: "That domain is not attached to this workspace." }, 404);
  if (domain.status !== "verified" || !domain.verified_at) {
    return json({ error: "Verify the domain in Resend before creating an active mailbox." }, 409);
  }
  if (!domain.sending_enabled || !domain.receiving_enabled) {
    return json({ error: "Resend must report sending and receiving as enabled for this domain before ABEmail can activate a mailbox." }, 409);
  }

  const { data: connection, error: connectionError } = await auth.admin
    .from("organization_provider_connections")
    .select("status")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (connectionError) return json({ error: "The Resend connection could not be checked." }, 503);

  const legacyEnvironmentReady = auth.organization.slug === "ottawa-snow-match" &&
    Boolean(getPilotSendApiKey() && getPilotReceiveApiKey());
  if (connection?.status !== "connected" && !legacyEnvironmentReady) {
    return json({ error: "Connect Resend and configure the inbound webhook before creating a mailbox." }, 409);
  }

  const address = localPart + "@" + domain.domain;
  const { data: inserted, error: insertError } = await auth.admin
    .from("mailboxes")
    .insert({
      organization_id: organizationId,
      domain_id: domainId,
      local_part: localPart,
      address,
      display_name: displayName,
      status: "active",
      created_by: auth.user.id,
    })
    .select("id, address, display_name, status, domain_id, created_at")
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") return json({ error: "That address already exists. Choose another mailbox name." }, 409);
    return json({ error: "ABEmail could not create the mailbox." }, 503);
  }

  const { error: grantError } = await auth.admin
    .from("mailbox_memberships")
    .upsert({
      organization_id: organizationId,
      mailbox_id: inserted.id,
      user_id: auth.user.id,
      can_read: true,
      can_send: true,
      can_manage: true,
      status: "active",
      granted_by: auth.user.id,
    }, { onConflict: "mailbox_id,user_id" });

  if (grantError) {
    await auth.admin.from("mailboxes").delete().eq("id", inserted.id).eq("organization_id", organizationId);
    return json({ error: "The mailbox was created, but owner access could not be assigned. The mailbox has been rolled back; retry once access is reviewed." }, 503);
  }

  return json({ ok: true, mailbox: inserted, note: "Mailbox created. Resend will route incoming mail through the configured webhook once DNS receiving records are active." }, 201);
}
