import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const WORKSPACE_PAGES: Record<string, {
  title: string;
  description: string;
  panelTitle: string;
  panelDescription: string;
}> = {
  templates: {
    title: "Templates",
    description: "Reusable messages and branded email designs for consistent customer communication.",
    panelTitle: "Template library",
    panelDescription: "Saved Signatures and the standard composer remain available. Reusable subject/body templates, the Brand Profile, and the visual email designer are tracked in the P1 roadmap.",
  },
  reminders: {
    title: "Reminders",
    description: "Keep important follow-ups and commitments visible alongside your email.",
    panelTitle: "Follow-up reminders",
    panelDescription: "Scheduled email delivery is available under Scheduled. Persisted one-time reminders and follow-up nudges are a separate roadmap feature and are not active in this build.",
  },
  labels: {
    title: "Labels",
    description: "Organize messages around clients, finance, suppliers, and projects.",
    panelTitle: "Message organization",
    panelDescription: "The current mailbox views and contact tags remain available. User-created message labels, custom folders, and label-based filtering are part of the Phase 2 roadmap.",
  },
  analytics: {
    title: "Analytics",
    description: "Understand message delivery and the health of your business communication.",
    panelTitle: "Delivery reporting",
    panelDescription: "Provider transport statuses and delivery events are recorded. The per-message delivery timeline and workspace reporting dashboard remain separate Phase 2 work.",
  },
};

type WorkspaceFeaturePageProps = {
  params: Promise<{ organizationId: string; workspacePage: string }>;
};

export default async function WorkspaceFeaturePage({ params }: WorkspaceFeaturePageProps) {
  const { organizationId, workspacePage } = await params;
  const page = WORKSPACE_PAGES[workspacePage];
  if (!page) notFound();

  const base = "/dashboard/" + organizationId;

  return (
    <div className="workspace-feature-page">
      <header className="mail-topbar">
        <div className="mail-breadcrumb">
          <Link href={base + "/mail"}>Workspace</Link>
          <span className="mail-breadcrumb-slash">/</span>
          <strong>{page.title}</strong>
        </div>
        <div className="mail-topbar-right">
          <Link href={base + "/settings"} className="mail-topbar-profile-link" aria-label="Open workspace settings" title="Workspace settings">
            <span className="mail-user-avatar" aria-hidden="true">⚙</span>
          </Link>
        </div>
      </header>
      <div className="contacts-page">
        <header className="contacts-heading">
          <div>
            <p className="mail-overline">WORKSPACE</p>
            <h1>{page.title}</h1>
            <p>{page.description}</p>
          </div>
        </header>
        <section className="settings-panel workspace-feature-panel" aria-labelledby="workspace-feature-heading">
          <header className="settings-panel-heading">
            <div>
              <h2 id="workspace-feature-heading">{page.panelTitle}</h2>
              <p>{page.panelDescription}</p>
            </div>
          </header>
          <div className="settings-info-banner">
            <span aria-hidden="true">i</span>
            <p>This destination is part of the fixed workspace navigation map. The page body will grow here as its roadmap feature is implemented; it does not replace or modify the shared sidebar.</p>
          </div>
          <div className="settings-form-footer">
            <span>Workspace tools</span>
            <Link className="mail-secondary-action" href={base + "/mail"}>Return to Inbox</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
