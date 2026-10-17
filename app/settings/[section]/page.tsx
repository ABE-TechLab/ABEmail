import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SECTIONS = ["appearance", "mail", "notifications", "team", "domains", "mailboxes", "security", "account"] as const;
type Section = (typeof SECTIONS)[number];

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  if (!SECTIONS.includes(section as Section)) return { title: "Settings not found" };
  return { title: section === "account" ? "Security settings | ABEmail" : section.charAt(0).toUpperCase() + section.slice(1) + " settings" };
}

export default async function LegacySettingsSectionRedirect({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!SECTIONS.includes(section as Section)) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const target = section === "account" ? "security" : section;
  if (!user) redirect("/auth/sign-in?next=" + encodeURIComponent("/settings/" + section));

  const { data: memberships, error } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error || !memberships?.length || memberships.length !== 1) redirect("/dashboard");
  redirect("/dashboard/" + memberships[0].organization_id + "/settings/" + target);
}
