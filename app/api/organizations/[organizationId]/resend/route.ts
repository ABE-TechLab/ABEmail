import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decryptProviderSecret,
  encryptProviderSecret,
  ensureResendWebhook,
  fingerprintProviderKey,
  listResendDomains,
  ResendProviderError,
  validateResendApiKey,
} from "@/lib/email/resend-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_OTTAWA_SLUG = "ottawa-snow-match";
const LEGACY_PUBLIC_URL = "https://abemail.vercel.app";

type RouteContext = { params: Promise<{ organizationId: string }> };

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function providerErrorStatus(error: unknown): number {
  if (error instanceof ResendProviderError) {
    if (error.code === "RESEND_API_KEY_FORMAT_INVALID" || error.code === "RESEND_API_KEY_INVALID") return 400;
    if (error.code === "RESEND_API_KEY_PERMISSION_DENIED") return 422;
    if (error.code === "CREDENTIAL_ENCRYPTION_NOT_CONFIGURED" || error.code === "CREDENTIAL_ENCRYPTION_KEY_INVALID") return 503;
    if (error.code === "RESEND_RATE_LIMITED") return 429;
    return 502;
  }
  return 502;
}

async function authorizedWorkspace(organizationId: string) {
  if (!UUID_PATTERN.test(organizationId)) return { response: json({ error: "Invalid workspace." }, 400) };
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: json({ error: "Sign in to manage this workspace's email provider." }, 401) };

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) return { response: json({ error: "Workspace permissions could not be checked." }, 503) };
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return { response: json({ error: "Only workspace owners and admins can manage Resend." }, 403) };
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

export async function GET(_request: NextRequest, context: RouteContext) {
  const { organizationId } = await context.params;
  const auth = await authorizedWorkspace(organizationId);
  if ("response" in auth) return auth.response;

  const { data: connection, error } = await auth.admin
    .from("organization_provider_connections")
    .select("provider, api_key_last_four, webhook_id, status, connected_at, last_checked_at, last_error_code")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) return json({ error: "The provider connection status could not be loaded." }, 503);

  const legacyAvailable = auth.organization.slug === LEGACY_OTTAWA_SLUG &&
    Boolean(process.env.ABEMAIL_RESEND_OTTAWA_RECEIVE_API_KEY && process.env.ABEMAIL_RESEND_OTTAWA_SEND_API_KEY);

  return json({
    ok: true,
    connected: connection?.status === "connected",
    provider: "resend",
    keyLastFour: connection?.api_key_last_four ?? null,
    webhookConfigured: Boolean(connection?.webhook_id),
    status: connection?.status ?? (legacyAvailable ? "environment_managed" : "not_connected"),
    connectedAt: connection?.connected_at ?? null,
    lastCheckedAt: connection?.last_checked_at ?? null,
    lastErrorCode: connection?.last_error_code ?? null,
    environmentManaged: legacyAvailable && !connection,
  });
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
  if (length > 20000) return json({ error: "The request is too large." }, 413);

  const { organizationId } = await context.params;
  const auth = await authorizedWorkspace(organizationId);
  if ("response" in auth) return auth.response;

  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 20000) return json({ error: "The request is too large." }, 413);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Send a valid JSON body." }, 400);
  }

  const apiKey = typeof payload === "object" && payload !== null && "apiKey" in payload && typeof payload.apiKey === "string"
    ? payload.apiKey.trim()
    : "";
  if (!apiKey) return json({ error: "Enter the Resend API key you created for ABEmail." }, 400);

  let fingerprint: string;
  try {
    fingerprint = fingerprintProviderKey(apiKey);
  } catch (error) {
    return json({ error: "Encrypted credential storage is not configured. Contact the ABEmail administrator." }, providerErrorStatus(error));
  }

  const { data: existingFingerprint, error: fingerprintError } = await auth.admin
    .from("organization_provider_connections")
    .select("organization_id")
    .eq("api_key_fingerprint", fingerprint)
    .maybeSingle();
  if (fingerprintError) return json({ error: "The provider key assignment could not be checked." }, 503);
  if (existingFingerprint && existingFingerprint.organization_id !== organizationId) {
    return json({ error: "This Resend API key is already connected to another ABEmail workspace. Use a separate Resend account/API key for each customer workspace." }, 409);
  }

  try {
    await validateResendApiKey(apiKey);
    const publicOrigin = process.env.ABEMAIL_PUBLIC_APP_URL?.trim() || LEGACY_PUBLIC_URL;
    let webhookOrigin: string;
    try {
      webhookOrigin = new URL(publicOrigin).origin;
      if (!webhookOrigin.startsWith("https://")) return json({ error: "ABEMAIL_PUBLIC_APP_URL must use HTTPS." }, 503);
    } catch {
      return json({ error: "ABEMAIL_PUBLIC_APP_URL is invalid." }, 503);
    }
    const endpoint = webhookOrigin + "/api/webhooks/resend/" + organizationId;
    // Validate encrypted storage before registering a webhook to avoid leaving
    // an unusable provider webhook behind when the app has no master key.
    const encryptedKey = encryptProviderSecret(apiKey);
    const providerDomains = await listResendDomains(apiKey);
    const webhook = await ensureResendWebhook(apiKey, endpoint);
    const encryptedWebhookSecret = encryptProviderSecret(webhook.signingSecret);
    const now = new Date().toISOString();

    const { error: saveError } = await auth.admin
      .from("organization_provider_connections")
      .upsert({
        organization_id: organizationId,
        provider: "resend",
        api_key_ciphertext: encryptedKey,
        api_key_fingerprint: fingerprint,
        api_key_last_four: apiKey.slice(-4),
        webhook_id: webhook.id,
        webhook_secret_ciphertext: encryptedWebhookSecret,
        status: "connected",
        last_error_code: null,
        connected_by: auth.user.id,
        connected_at: now,
        last_checked_at: now,
      }, { onConflict: "organization_id" });

    if (saveError) {
      return json({ error: saveError.code === "23505"
        ? "This Resend API key is already assigned to another workspace."
        : "The provider responded successfully, but ABEmail could not safely save the encrypted connection." }, saveError.code === "23505" ? 409 : 503);
    }

    // The Ottawa workspace already has a verified domain entry from the original
    // environment-backed transport. Attach its Resend domain ID and current DNS
    // records so it can use the same settings flow as future workspaces.
    const { data: localDomains } = await auth.admin
      .from("organization_domains")
      .select("id, domain, status")
      .eq("organization_id", organizationId);
    for (const localDomain of localDomains ?? []) {
      if (localDomain.status === "suspended") continue;
      const providerDomain = providerDomains.find((item) => item.name?.toLowerCase() === localDomain.domain.toLowerCase());
      if (!providerDomain?.id) continue;
      await auth.admin
        .from("organization_domains")
        .update({
          provider_domain_id: providerDomain.id,
          dns_records: providerDomain.records ?? [],
          sending_enabled: providerDomain.capabilities?.sending === "enabled",
          receiving_enabled: providerDomain.capabilities?.receiving === "enabled",
          status: providerDomain.status === "verified" ? "verified" : "pending_verification",
          verified_at: providerDomain.status === "verified" ? now : null,
          last_checked_at: now,
          last_error_code: null,
        })
        .eq("id", localDomain.id)
        .eq("organization_id", organizationId);
    }

    return json({
      ok: true,
      connected: true,
      provider: "resend",
      keyLastFour: apiKey.slice(-4),
      webhookConfigured: true,
      status: "connected",
      note: "Resend is connected. Domains can now be added and verified from workspace settings.",
    });
  } catch (error) {
    const status = providerErrorStatus(error);
    const code = error instanceof ResendProviderError ? error.code : "RESEND_CONNECTION_FAILED";
    const message = code === "RESEND_API_KEY_PERMISSION_DENIED"
      ? "This key does not have enough access to manage domains and webhooks. Connect a Resend Full Access API key dedicated to ABEmail; sending-only keys are not enough for inbound mail setup."
      : code === "RESEND_API_KEY_INVALID"
        ? "Resend rejected this API key. Check it in Resend and try again."
        : code === "RESEND_API_KEY_FORMAT_INVALID"
          ? "That does not look like a Resend API key."
          : code === "CREDENTIAL_ENCRYPTION_NOT_CONFIGURED" || code === "CREDENTIAL_ENCRYPTION_KEY_INVALID"
            ? "Encrypted credential storage is not ready. The ABEmail administrator must configure ABEMAIL_CREDENTIALS_ENCRYPTION_KEY before any provider secret can be saved."
            : code === "RESEND_WEBHOOK_SECRET_UNAVAILABLE"
              ? "Resend did not return a webhook signing secret. No connection was saved; check the Resend webhook settings and try again."
              : "ABEmail could not complete the Resend connection. Check the Resend API permissions and retry.";
    return json({ error: message, code }, status);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) return json({ error: "Cross-origin request rejected." }, 403);
    } catch {
      return json({ error: "Invalid request origin." }, 403);
    }
  }

  const { organizationId } = await context.params;
  const auth = await authorizedWorkspace(organizationId);
  if ("response" in auth) return auth.response;

  const { data: domains, error: domainsError } = await auth.admin
    .from("organization_domains")
    .select("id, provider_domain_id, status")
    .eq("organization_id", organizationId)
    .eq("status", "verified");
  if (domainsError) return json({ error: "The workspace domains could not be checked." }, 503);

  const { data: connection, error: connectionError } = await auth.admin
    .from("organization_provider_connections")
    .select("organization_id, webhook_id, api_key_ciphertext")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (connectionError) return json({ error: "The provider connection could not be checked." }, 503);
  if (!connection) return json({ ok: true, disconnected: true });

  if (domains?.length) {
    return json({ error: "Disconnecting Resend is blocked while verified domains exist. Remove or suspend the workspace's sending domains first so mail is not silently interrupted." }, 409);
  }

  try {
    const apiKey = decryptProviderSecret(connection.api_key_ciphertext);
    if (connection.webhook_id) {
      // Do not remove a customer's provider account or API key. Only disable the webhook ABEmail registered.
      await fetch("https://api.resend.com/webhooks/" + encodeURIComponent(connection.webhook_id), {
        method: "DELETE",
        headers: { Authorization: "Bearer " + apiKey, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }).catch(() => undefined);
    }
  } catch {
    // If the provider key was revoked, allow the workspace to detach its stored copy.
  }

  const { error: deleteError } = await auth.admin
    .from("organization_provider_connections")
    .delete()
    .eq("organization_id", organizationId);
  if (deleteError) return json({ error: "Resend could not be disconnected from ABEmail." }, 503);
  return json({ ok: true, disconnected: true });
}
