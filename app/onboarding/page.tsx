import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OrganizationOnboardingForm from "@/components/auth/organization-onboarding-form";

export const metadata: Metadata = { title: "Create your organization" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in?next=/onboarding");

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1);

  if (memberships?.length) redirect("/dashboard");

  return <OrganizationOnboardingForm email={user.email ?? ""} />;
}
