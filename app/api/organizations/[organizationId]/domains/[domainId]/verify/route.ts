import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPilotReceiveApiKey } from "@/lib/email/resend-pilot";
import {
  decryptProviderSecret,
  getResendDomain,
  listResendDomains,
  ResendProviderError,
  verifyResendDomain,
} from "@/lib/email/resend-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_OTTAWA_SLUG = "ottawa-snow-match";

type RouteContext = { params: Promise<{ organizationId: string; domainId: string }> };

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function authorize(organizationId: string) {
  if (!UUID_PATTERN.test(organizationId)) return { response: json({ error: "Invalid workspace." }, 400) };
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: json({ error: "Sign in to verify this domain." }, 401) };

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return { response: json({ error: "Workspace permissions could not be checked." }, 503) };
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return { response: json({ error: "Only workspace owners and admins can verify domains." }, 403) };
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

export async function POST(request: NextRequest, context: RouteContext) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return json({ error: "Cross-origin request rejected." }, 403);
    } catch {
      return json({ error: "Invalid request origin." }, 403);
    }
  }

  const { organizationId, domainId } = await context.params;
  if (!UUID_PATTERN.test(domainId)) return json({ error: "Invalid domain." }, 400);
  const auth = await authorize(organizationId);
  if ("response" in auth) return auth.response;

  const { data: localDomain, error: localDomainError } = await auth.admin
    .from("organization_domains")
    .select("id, domain, status, verified_at, provider_domain_id")
    .eq("id", domainId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (localDomainError) return json({ error: "Domain status could not be loaded." }, 503);
  if (!localDomain) return json({ error: "This domain does not belong to this workspace." }, 404);
  if (localDomain.status === "suspended") return json({ error: "This domain is suspended and cannot be verified." }, 409);

  try {
    const { data: connection, error: connectionError } = await auth.admin
      .from("organization_provider_connections")
      .select("api_key_ciphertext, status")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (connectionError) throw new ResendProviderError("RESEND_CONNECTION_LOOKUP_FAILED");
    const apiKey = connection?.status === "connected"
      ? decryptProviderSecret(connection.api_key_ciphertext)
      : auth.organization.slug === LEGACY_OTTAWA_SLUG ? getPilotReceiveApiKey() : null;
    if (!apiKey) return json({ error: "Connect a Resend Full Access API key before verifying this domain." }, 409);

    let providerDomainId = localDomain.provider_domain_id;
    if (!providerDomainId) {
      const domains = await listResendDomains(apiKey);
      const matching = domains.find((item) => item.name?.toLowerCase() === localDomain.domain.toLowerCase());
      if (!matching?.id) {
        return json({ error: "Resend does not list this domain for the connected account. Add the domain through Settings first." }, 409);
      }
      providerDomainId = matching.id;
    }

    await verifyResendDomain(apiKey, providerDomainId);
    const providerDomain = await getResendDomain(apiKey, providerDomainId);
    const now = new Date().toISOString();
    const verified = providerDomain.status === "verified";
    const { data: updated, error: updateError } = await auth.admin
      .from("organization_domains")
      .update({
        provider_domain_id: providerDomainId,
        dns_records: providerDomain.records ?? [],
        status: verified ? "verified" : "pending_verification",
        verified_at: verified ? (localDomain.verified_at ?? now) : null,
        sending_enabled: providerDomain.capabilities?.sending === "enabled",
        receiving_enabled: providerDomain.capabilities?.receiving === "enabled",
        last_checked_at: now,
        last_error_code: !verified && (providerDomain.status === "failed" || providerDomain.status === "partially_failed")
          ? "RESEND_DNS_RECORDS_FAILED"
          : null,
      })
      .eq("id", domainId)
      .eq("organization_id", organizationId)
      .select("id, domain, status, verified_at, provider_domain_id, dns_records, sending_enabled, receiving_enabled, last_checked_at, last_error_code")
      .single();

    if (updateError || !updated) return json({ error: "Resend returned a status, but ABEmail could not save it." }, 503);

    return json({
      ok: true,
      verified,
      domain: {
        id: updated.id,
        domain: updated.domain,
        status: updated.status,
        verifiedAt: updated.verified_at,
        providerDomainId: updated.provider_domain_id,
        dnsRecords: Array.isArray(updated.dns_records) ? updated.dns_records : [],
        sendingEnabled: updated.sending_enabled,
        receivingEnabled: updated.receiving_enabled,
        lastCheckedAt: updated.last_checked_at,
        lastErrorCode: updated.last_error_code,
      },
      note: verified
        ? "Resend has verified this domain. Create an address under Mailboxes and confirm that receiving is enabled."
        : "Verification has been requested. DNS changes can take time to propagate; check the record statuses below and retry.",
    });
  } catch (error) {
    const code = error instanceof ResendProviderError ? error.code : "RESEND_DOMAIN_VERIFY_FAILED";
    const status = error instanceof ResendProviderError && error.providerStatus === 401 ? 401
      : error instanceof ResendProviderError && error.providerStatus === 403 ? 422
        : error instanceof ResendProviderError && error.providerStatus === 429 ? 429
          : 502;
    const message = code === "RESEND_API_KEY_INVALID"
      ? "Resend rejected the saved key. Reconnect the provider and retry."
      : code === "RESEND_API_KEY_PERMISSION_DENIED"
        ? "This API key cannot verify domains. Connect a Full Access API key."
        : "ABEmail could not complete the DNS verification check. Review the DNS records and try again.";
    return json({ error: message, code }, status);
  }
}
