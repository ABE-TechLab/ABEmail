import WorkspaceSettingsPanel, { type WorkspaceSettingsContext } from "@/components/workspace-settings-panel";

export type SettingsSection = "general" | "appearance" | "mail" | "notifications" | "team" | "domains" | "mailboxes" | "security" | "rules" | "out-of-office" | "branding" | "integrations";

export default function SettingsWorkspace({
  section,
  workspace,
}: {
  section: SettingsSection;
  workspace: WorkspaceSettingsContext;
}) {
  return <WorkspaceSettingsPanel key={workspace.organizationId} {...workspace} section={section} />;
}
