import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import { domainToASCII } from "node:url";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPilotReceiveApiKey } from "@/lib/email/resend-pilot";
import {
  createResendDomain,
  decryptProviderSecret,
  listResendDomains,
  ResendProviderError,
  type ResendDomain,
} from "@/lib/email/resend-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_OTTAWA_SLUG = "ottawa-snow-match";

type RouteContext = { params: Promise<{ organizationId: string }> };

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function authorize(organizationId: string, requireAdmin = true) {
  if (!UUID_PATTERN.test(organizationId)) return { response: json({ error: "Invalid workspace." }, 400) };
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: json({ error: "Sign in to manage domains." }, 401) };

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return { response: json({ error: "Workspace access could not be checked." }, 503) };
  if (!membership) return { response: json({ error: "You do not have access to this workspace." }, 403) };
  if (requireAdmin && membership.role !== "owner" && membership.role !== "admin") {
    return { response: json({ error: "Only workspace owners and admins can manage domains." }, 403) };
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

  return { user, membership, admin, organization };
}

async function getApiKey(admin: ReturnType<typeof createAdminClient>, organizationId: string, slug: string): Promise<string | null> {
  if (!admin) return null;
  const { data: connection, error } = await admin
    .from("organization_provider_connections")
    .select("api_key_ciphertext, status")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new ResendProviderError("RESEND_CONNECTION_LOOKUP_FAILED");
  if (connection?.status === "connected") return decryptProviderSecret(connection.api_key_ciphertext);
  if (slug === LEGACY_OTTAWA_SLUG) return getPilotReceiveApiKey();
  return null;
}

function normalizeDomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase().replace(/\.$/, "");
  const ascii = domainToASCII(trimmed);
  if (!ascii || ascii.length > 253 || ascii.includes("..") || isIP(ascii)) return null;
  const labels = ascii.split(".");
  if (labels.length < 2 || labels.some((label) => label.length < 1 || label.length > 63 ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null;
  if (!/^[a-z]{2,63}$/.test(labels[labels.length - 1])) return null;
  return ascii;
}

function domainPayload(domain: {
  id: string;
  domain: string;
  status: string;
  verified_at: string | null;
  provider_domain_id: string | null;
  dns_records: unknown;
  sending_enabled: boolean;
  receiving_enabled: boolean;
  last_checked_at: string | null;
  last_error_code: string | null;
}) {
  return {
    id: domain.id,
    domain: domain.domain,
    status: domain.status,
    verifiedAt: domain.verified_at,
    providerDomainId: domain.provider_domain_id,
    dnsRecords: Array.isArray(domain.dns_records) ? domain.dns_records : [],
    sendingEnabled: domain.sending_enabled,
    receivingEnabled: domain.receiving_enabled,
    lastCheckedAt: domain.last_checked_at,
    lastErrorCode: domain.last_error_code,
  };
}

function toLocalStatus(providerDomain: ResendDomain): "verified" | "pending_verification" {
  return providerDomain.status === "verified" ? "verified" : "pending_verification";
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { organizationId } = await context.params;
  const auth = await authorize(organizationId);
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.admin
    .from("organization_domains")
    .select("id, domain, status, verified_at, provider_domain_id, dns_records, sending_enabled, receiving_enabled, last_checked_at, last_error_code")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) return json({ error: "Workspace domains could not be loaded." }, 503);

  return json({ ok: true, domains: (data ?? []).map(domainPayload) });
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

  const requestedDomain = typeof payload === "object" && payload !== null && "domain" in payload && typeof payload.domain === "string"
    ? payload.domain
    : "";
  const domainName = normalizeDomain(requestedDomain);
  if (!domainName) return json({ error: "Enter a valid domain such as example.com. Do not include a URL or email address." }, 400);

  const { data: existing, error: existingError } = await auth.admin
    .from("organization_domains")
    .select("id, organization_id, domain, status, verified_at, provider_domain_id, dns_records, sending_enabled, receiving_enabled, last_checked_at, last_error_code")
    .eq("domain", domainName)
    .maybeSingle();
  if (existingError) return json({ error: "Domain ownership could not be checked." }, 503);
  if (existing && existing.organization_id !== organizationId) {
    return json({ error: "This domain is already registered to another ABEmail workspace. Contact ABEmail support if your business owns it and needs to transfer it." }, 409);
  }

  try {
    const apiKey = await getApiKey(auth.admin, organizationId, auth.organization.slug);
    if (!apiKey) return json({ error: "Connect a Resend Full Access API key in Settings → Mail & compose before adding a domain." }, 409);

    const providerDomains = await listResendDomains(apiKey);
    let providerDomain = providerDomains.find((item) => item.name?.toLowerCase() === domainName);
    if (!providerDomain) providerDomain = await createResendDomain(apiKey, domainName);
    if (!providerDomain.id) return json({ error: "Resend did not return a domain ID. No domain was saved." }, 502);

    const now = new Date().toISOString();
    if (existing) {
      if (existing.status === "suspended") {
        return json({ error: "This domain is suspended in ABEmail and must be reviewed before it can be reused." }, 409);
      }
      const status = toLocalStatus(providerDomain);
      const { data: updated, error: updateError } = await auth.admin
        .from("organization_domains")
        .update({
          provider_domain_id: providerDomain.id,
          dns_records: providerDomain.records ?? [],
          status,
          verified_at: status === "verified" ? (existing.verified_at ?? now) : null,
          sending_enabled: providerDomain.capabilities?.sending === "enabled",
          receiving_enabled: providerDomain.capabilities?.receiving === "enabled",
          last_checked_at: now,
          last_error_code: null,
        })
        .eq("id", existing.id)
        .eq("organization_id", organizationId)
        .select("id, domain, status, verified_at, provider_domain_id, dns_records, sending_enabled, receiving_enabled, last_checked_at, last_error_code")
        .single();
      if (updateError || !updated) return json({ error: "Resend has the domain, but ABEmail could not synchronize its DNS setup." }, 503);
      return json({ ok: true, domain: domainPayload(updated), alreadyAdded: true });
    }

    const localStatus = toLocalStatus(providerDomain);
    const { data: inserted, error: insertError } = await auth.admin
      .from("organization_domains")
      .insert({
        organization_id: organizationId,
        domain: domainName,
        provider_domain_id: providerDomain.id,
        dns_records: providerDomain.records ?? [],
        status: localStatus,
        verified_at: localStatus === "verified" ? now : null,
        sending_enabled: providerDomain.capabilities?.sending === "enabled",
        receiving_enabled: providerDomain.capabilities?.receiving === "enabled",
        last_checked_at: now,
        created_by: auth.user.id,
      })
      .select("id, domain, status, verified_at, provider_domain_id, dns_records, sending_enabled, receiving_enabled, last_checked_at, last_error_code")
      .single();

    if (insertError || !inserted) {
      if (insertError?.code === "23505") return json({ error: "The domain was added elsewhere at the same time. Refresh and try again." }, 409);
      return json({ error: "Resend has the domain, but ABEmail could not save the workspace domain." }, 503);
    }

    return json({ ok: true, domain: domainPayload(inserted) }, 201);
  } catch (error) {
    const code = error instanceof ResendProviderError ? error.code : "RESEND_DOMAIN_SETUP_FAILED";
    const status = error instanceof ResendProviderError && error.providerStatus === 401 ? 401
      : error instanceof ResendProviderError && error.providerStatus === 403 ? 422
        : error instanceof ResendProviderError && error.providerStatus === 429 ? 429
          : 502;
    const message = code === "RESEND_API_KEY_INVALID"
      ? "Resend rejected the saved API key. Reconnect your provider in Settings."
      : code === "RESEND_API_KEY_PERMISSION_DENIED"
        ? "The connected Resend key cannot manage domains. Reconnect with a Full Access API key."
        : code === "RESEND_RESOURCE_CONFLICT"
          ? "Resend already has this domain but did not let ABEmail attach it. Check the Resend account and retry."
          : "ABEmail could not add this domain in Resend. Check the provider connection and retry.";
    return json({ error: message, code }, status);
  }
}
