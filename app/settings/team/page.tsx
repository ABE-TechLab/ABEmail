import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Team and mailbox access | ABEmail" };
export const dynamic = "force-dynamic";

// Keep the legacy URL on the same workspace-scoped Settings experience.
// There is one canonical shell for workspace navigation and settings sections.
export default async function LegacyTeamSettingsRedirectPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/auth/sign-in?next=" + encodeURIComponent("/settings/team"));
  }

  const { data: memberships, error } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error || !memberships?.length || memberships.length !== 1) {
    redirect("/dashboard");
  }

  redirect("/dashboard/" + memberships[0].organization_id + "/settings/team");
}
