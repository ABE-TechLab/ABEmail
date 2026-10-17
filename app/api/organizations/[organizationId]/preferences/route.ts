import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIMEZONES = new Set(["Africa/Lagos", "UTC", "Europe/London", "America/New_York", "America/Toronto"]);
const LANGUAGES = new Set(["en", "fr", "pt"]);
const FONTS = new Set(["sans", "serif", "mono"]);
const REPLY_STYLES = new Set(["reply", "bottom"]);
const NOTIFICATION_KEYS = ["newMail", "mentions", "product", "digest"] as const;
type Preferences = {
  timezone?: string;
  language?: string;
  font?: string;
  signature?: string;
  replyStyle?: string;
  compactMessageList?: boolean;
  notifications?: Partial<Record<(typeof NOTIFICATION_KEYS)[number], boolean>>;
};

type RouteContext = { params: Promise<{ organizationId: string }> };

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function authorize(organizationId: string) {
  if (!UUID_PATTERN.test(organizationId)) return { response: json({ error: "Invalid workspace." }, 400) };
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { response: json({ error: "Sign in to manage preferences." }, 401) };

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, status")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return { response: json({ error: "Workspace membership could not be checked." }, 503) };
  if (!membership) return { response: json({ error: "You do not have access to this workspace." }, 403) };

  const admin = createAdminClient();
  if (!admin) return { response: json({ error: "Server-side database access is not configured." }, 503) };
  return { user, admin };
}

function validPreferences(input: unknown): input is Preferences {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  if (value.timezone !== undefined && (typeof value.timezone !== "string" || !TIMEZONES.has(value.timezone))) return false;
  if (value.language !== undefined && (typeof value.language !== "string" || !LANGUAGES.has(value.language))) return false;
  if (value.font !== undefined && (typeof value.font !== "string" || !FONTS.has(value.font))) return false;
  if (value.signature !== undefined && (typeof value.signature !== "string" || value.signature.length > 10000)) return false;
  if (value.replyStyle !== undefined && (typeof value.replyStyle !== "string" || !REPLY_STYLES.has(value.replyStyle))) return false;
  if (value.compactMessageList !== undefined && typeof value.compactMessageList !== "boolean") return false;
  if (value.notifications !== undefined) {
    if (!value.notifications || typeof value.notifications !== "object" || Array.isArray(value.notifications)) return false;
    for (const [key, entry] of Object.entries(value.notifications as Record<string, unknown>)) {
      if (!(NOTIFICATION_KEYS as readonly string[]).includes(key) || typeof entry !== "boolean") return false;
    }
  }
  return Object.keys(value).every((key) => ["timezone", "language", "font", "signature", "replyStyle", "compactMessageList", "notifications"].includes(key));
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { organizationId } = await context.params;
  const auth = await authorize(organizationId);
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.admin
    .from("organization_user_preferences")
    .select("preferences, updated_at")
    .eq("organization_id", organizationId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) return json({ error: "Workspace preferences could not be loaded." }, 503);
  return json({ ok: true, preferences: data?.preferences ?? {}, updatedAt: data?.updated_at ?? null });
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

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 16000) return json({ error: "The request is too large." }, 413);

  const { organizationId } = await context.params;
  const auth = await authorize(organizationId);
  if ("response" in auth) return auth.response;

  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 16000) return json({ error: "The request is too large." }, 413);
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "Send a valid JSON body." }, 400);
  }

  if (!validPreferences(payload)) return json({ error: "One or more preferences are invalid." }, 400);

  const { data: existing, error: existingError } = await auth.admin
    .from("organization_user_preferences")
    .select("preferences")
    .eq("organization_id", organizationId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (existingError) return json({ error: "Current preferences could not be loaded." }, 503);

  const current = (existing?.preferences && typeof existing.preferences === "object" && !Array.isArray(existing.preferences))
    ? existing.preferences as Preferences
    : {};
  const next: Preferences = {
    ...current,
    ...payload,
    ...(payload.notifications ? { notifications: { ...(current.notifications ?? {}), ...payload.notifications } } : {}),
  };

  const { data: saved, error: saveError } = await auth.admin
    .from("organization_user_preferences")
    .upsert({
      organization_id: organizationId,
      user_id: auth.user.id,
      preferences: next,
    }, { onConflict: "organization_id,user_id" })
    .select("preferences, updated_at")
    .single();

  if (saveError || !saved) return json({ error: "Preferences could not be saved. Retry without changing the workspace." }, 503);
  return json({ ok: true, preferences: saved.preferences, updatedAt: saved.updated_at });
}
