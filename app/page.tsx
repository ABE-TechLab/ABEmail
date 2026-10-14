import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // A local or unconfigured deployment should still have a useful public entry.
  if (!isSupabaseConfigured()) redirect("/welcome");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");
  redirect("/auth/sign-in");
}
