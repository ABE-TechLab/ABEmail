import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Workspace settings | ABEmail" };
export const dynamic = "force-dynamic";

export default async function SettingsRedirectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/settings");

  const { data: memberships, error } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error || !memberships?.length) redirect("/dashboard");
  if (memberships.length !== 1) redirect("/dashboard");
  redirect("/dashboard/" + memberships[0].organization_id + "/settings");
}
