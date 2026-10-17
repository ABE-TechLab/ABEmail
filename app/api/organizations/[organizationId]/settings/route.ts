import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ organizationId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { organizationId } = await params;
  if (!UUID_PATTERN.test(organizationId)) {
    return NextResponse.json({ ok: false, error: "Invalid workspace." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "Sign in to update this workspace." }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    return NextResponse.json({ ok: false, error: "Workspace membership could not be verified." }, { status: 503 });
  }
  if (!membership) {
    return NextResponse.json({ ok: false, error: "You do not have access to this workspace." }, { status: 403 });
  }
  if (membership.role !== "owner" && membership.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Only workspace owners and admins can change the workspace name." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Send a valid JSON request." }, { status: 400 });
  }

  const name = typeof body === "object" && body !== null && "name" in body
    ? String((body as { name?: unknown }).name ?? "").trim()
    : "";
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json({ ok: false, error: "Workspace name must contain between 2 and 80 characters." }, { status: 400 });
  }

  const { data: organization, error: updateError } = await supabase
    .from("organizations")
    .update({ name })
    .eq("id", organizationId)
    .eq("status", "active")
    .select("id, name")
    .maybeSingle();

  if (updateError || !organization) {
    return NextResponse.json({
      ok: false,
      error: "The workspace name could not be saved. Verify organization update permissions and try again.",
    }, { status: 403 });
  }

  return NextResponse.json({ ok: true, organization });
}
