import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccountMethods from "@/components/auth/account-methods";

export const metadata: Metadata = { title: "Account and sign-in methods" };

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/settings/account");
  return <AccountMethods primaryEmail={user.email ?? ""} />;
}
