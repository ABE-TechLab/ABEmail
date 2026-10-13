import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TeamAccessManager from "@/components/auth/team-access-manager";

export const metadata: Metadata = { title: "Team and mailbox access" };

export default async function TeamAccessPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/settings/team");
  return <TeamAccessManager />;
}
