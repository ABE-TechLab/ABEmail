import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ organizationId: string }> };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { organizationId } = await context.params;
  if (!UUID_PATTERN.test(organizationId)) return json({ error: "Invalid workspace." }, 400);

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Sign in to view workspace audit events." }, 401);

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) return json({ error: "Workspace access could not be checked." }, 503);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return json({ error: "Only workspace owners and admins can view audit events." }, 403);
  }

  const url = new URL(request.url);
  const limitValue = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isSafeInteger(limitValue) ? Math.min(100, Math.max(1, limitValue)) : 50;
  const before = url.searchParams.get("before");

  let query = supabase
    .from("organization_audit_events")
    .select("id, actor_user_id, actor_type, action, resource_type, resource_id, outcome, metadata, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (before && !Number.isNaN(Date.parse(before))) query = query.lt("created_at", new Date(before).toISOString());

  const { data, error } = await query;
  if (error) return json({ error: "Workspace audit events could not be loaded." }, 503);
  return json({ events: data ?? [], limit });
}
