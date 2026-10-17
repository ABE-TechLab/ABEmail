import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_PART_PATTERN = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;

type RouteContext = { params: Promise<{ organizationId: string; mailboxId: string }> };

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
    return { response: json({ error: "Only workspace owners and admins can edit mailboxes." }, 403) };
  }

  const admin = createAdminClient();
  if (!admin) return { response: json({ error: "Server-side database access is not configured." }, 503) };
  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id, status")
    .eq("id", organizationId)
    .maybeSingle();
  if (organizationError) return { response: json({ error: "Workspace status could not be checked." }, 503) };
  if (!organization || organization.status !== "active") return { response: json({ error: "This workspace is not active." }, 403) };

  return { user, admin };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return json({ error: "Cross-origin request rejected." }, 403);
    } catch {
      return json({ error: "Invalid request origin." }, 403);
    }
  }

  const { organizationId, mailboxId } = await context.params;
  if (!UUID_PATTERN.test(mailboxId)) return json({ error: "Invalid mailbox." }, 400);
  const auth = await authorize(organizationId);
  if ("response" in auth) return auth.response;

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 10000) return json({ error: "The request is too large." }, 413);

  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 10000) return json({ error: "The request is too large." }, 413);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Send a valid JSON body." }, 400);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json({ error: "Send the mailbox fields you want to change." }, 400);
  }
  const input = payload as Record<string, unknown>;
  const allowedKeys = new Set(["localPart", "domainId", "displayName"]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    return json({ error: "Only the address name, domain, and display name can be edited here." }, 400);
  }
  if (!Object.keys(input).length) return json({ error: "Choose at least one mailbox field to update." }, 400);

  const { data: current, error: currentError } = await auth.admin
    .from("mailboxes")
    .select("id, organization_id, address, local_part, display_name, domain_id, status")
    .eq("id", mailboxId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (currentError) return json({ error: "The mailbox could not be loaded." }, 503);
  if (!current) return json({ error: "This mailbox does not belong to the active workspace." }, 404);
  if (current.status !== "active") return json({ error: "Only active mailboxes can be edited. Review the mailbox status before trying again." }, 409);

  const localPart = input.localPart === undefined
    ? current.local_part
    : typeof input.localPart === "string" ? input.localPart.trim().toLowerCase() : null;
  const domainId = input.domainId === undefined
    ? current.domain_id
    : typeof input.domainId === "string" ? input.domainId : null;
  const displayName = input.displayName === undefined
    ? current.display_name ?? ""
    : typeof input.displayName === "string" ? input.displayName.trim() : null;

  if (localPart === null || !LOCAL_PART_PATTERN.test(localPart) || localPart.length > 64) {
    return json({ error: "Enter a valid address name before the @ sign. Use letters, numbers, dots, or standard email symbols." }, 400);
  }
  if (domainId === null || !UUID_PATTERN.test(domainId)) return json({ error: "Choose a valid domain from this workspace." }, 400);
  if (displayName === null || displayName.length > 120) return json({ error: "Display name must be 120 characters or fewer." }, 400);

  const addressChanged = localPart !== current.local_part || domainId !== current.domain_id;
  let nextAddress = current.address;
  if (addressChanged) {
    const { data: domain, error: domainError } = await auth.admin
      .from("organization_domains")
      .select("id, domain, status, verified_at, sending_enabled, receiving_enabled")
      .eq("id", domainId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (domainError) return json({ error: "The destination domain could not be checked." }, 503);
    if (!domain) return json({ error: "The destination domain does not belong to this workspace." }, 404);
    if (domain.status !== "verified" || !domain.verified_at || !domain.sending_enabled || !domain.receiving_enabled) {
      return json({ error: "Address changes require a domain that Resend has verified with both sending and receiving enabled." }, 409);
    }

    nextAddress = localPart + "@" + domain.domain;
    if (nextAddress !== current.address) {
      const { data: addressConflict, error: conflictError } = await auth.admin
        .from("mailboxes")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("address", nextAddress)
        .neq("id", mailboxId)
        .maybeSingle();
      if (conflictError) return json({ error: "Address availability could not be checked." }, 503);
      if (addressConflict) return json({ error: "That email address is already in use in this workspace." }, 409);
    }
  }

  const { data: updated, error: updateError } = await auth.admin
    .from("mailboxes")
    .update({
      local_part: localPart,
      domain_id: domainId,
      address: nextAddress,
      display_name: displayName,
    })
    .eq("id", mailboxId)
    .eq("organization_id", organizationId)
    .select("id, address, display_name, status, domain_id, created_at")
    .single();

  if (updateError || !updated) {
    if (updateError?.code === "23505") return json({ error: "That address is already in use. Choose another email address." }, 409);
    return json({ error: "The mailbox changes could not be saved." }, 503);
  }

  return json({ ok: true, mailbox: updated, note: addressChanged
    ? "Mailbox updated. The previous address is no longer assigned to this mailbox; notify contacts that use it."
    : "Mailbox details updated." });
}
