import WorkspaceSettingsPanel, { type WorkspaceSettingsContext } from "@/components/workspace-settings-panel";

export type SettingsSection = "general" | "appearance" | "mail" | "notifications" | "team" | "domains" | "mailboxes" | "security";

export default function SettingsWorkspace({
  section,
  workspace,
}: {
  section: SettingsSection;
  workspace: WorkspaceSettingsContext;
}) {
  return <WorkspaceSettingsPanel key={workspace.organizationId} {...workspace} section={section} />;
}
