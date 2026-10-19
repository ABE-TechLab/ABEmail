import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getContactRequestContext(organizationId: string) {
  if (!UUID_PATTERN.test(organizationId)) {
    return { response: NextResponse.json({ ok: false, error: "Invalid workspace." }, { status: 400 }) } as const;
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { response: NextResponse.json({ ok: false, error: "Sign in to manage contacts." }, { status: 401 }) } as const;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    return { response: NextResponse.json({ ok: false, error: "Workspace access could not be verified." }, { status: 503 }) } as const;
  }
  if (!membership) {
    return { response: NextResponse.json({ ok: false, error: "You do not have access to this workspace." }, { status: 403 }) } as const;
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .eq("status", "active")
    .maybeSingle();

  if (organizationError) {
    return { response: NextResponse.json({ ok: false, error: "Workspace status could not be verified." }, { status: 503 }) } as const;
  }
  if (!organization) {
    return { response: NextResponse.json({ ok: false, error: "This workspace is not active." }, { status: 404 }) } as const;
  }

  return { supabase, user } as const;
}
