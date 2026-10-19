import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ContactsEntryPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/auth/sign-in?next=" + encodeURIComponent("/contacts"));
  }

  const { data: membership, error } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !membership) redirect("/dashboard");
  redirect("/dashboard/" + membership.organization_id + "/contacts");
}
