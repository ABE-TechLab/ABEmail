import type { Metadata } from "next";
import AuthForm from "@/components/auth/auth-form";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Update password" };

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/auth/update-password");
  return <AuthForm mode="update-password" />;
}
