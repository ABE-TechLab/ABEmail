import { notFound } from "next/navigation";
import SettingsWorkspace, { type SettingsSection } from "@/components/settings-workspace";

const sections: SettingsSection[] = [
  "general",
  "appearance",
  "mail",
  "notifications",
  "team",
  "domains",
  "mailboxes",
  "security",
];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section as SettingsSection)) {
    return { title: "Settings not found" };
  }
  return { title: section.charAt(0).toUpperCase() + section.slice(1) + " settings" };
}

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section as SettingsSection)) notFound();
  return <SettingsWorkspace section={section as SettingsSection} />;
}
