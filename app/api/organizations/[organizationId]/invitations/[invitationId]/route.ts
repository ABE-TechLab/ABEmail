import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ organizationId: string; invitationId: string }> };

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
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

  const { organizationId, invitationId } = await context.params;
  if (!UUID_PATTERN.test(organizationId) || !UUID_PATTERN.test(invitationId)) return json({ error: "Invalid workspace or invitation." }, 400);

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Sign in to revoke invitations." }, 401);

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError) return json({ error: "Workspace permissions could not be checked." }, 503);
  if (!membership || !["owner", "admin"].includes(membership.role)) return json({ error: "Only workspace owners and admins can revoke invitations." }, 403);

  const admin = createAdminClient();
  if (!admin) return json({ error: "Server-side database access is not configured." }, 503);

  const { data: invitation, error: invitationError } = await admin
    .from("organization_invitations")
    .select("id, accepted_at, revoked_at, expires_at")
    .eq("id", invitationId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (invitationError) return json({ error: "Invitation status could not be loaded." }, 503);
  if (!invitation) return json({ error: "That invitation was not found in this workspace." }, 404);
  if (invitation.accepted_at) return json({ error: "An accepted invitation cannot be revoked; change the member's access from membership management." }, 409);
  if (invitation.revoked_at) return json({ ok: true, revoked: true });
  if (new Date(invitation.expires_at).getTime() <= Date.now()) return json({ error: "This invitation has already expired." }, 409);

  const { error: updateError } = await admin
    .from("organization_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("organization_id", organizationId)
    .is("accepted_at", null)
    .is("revoked_at", null);

  if (updateError) return json({ error: "The invitation could not be revoked." }, 503);
  return json({ ok: true, revoked: true });
}
