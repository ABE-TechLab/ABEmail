import Link from "next/link";
import SignOutButton from "@/components/auth/sign-out-button";
import WorkspaceSidebar from "@/components/workspace-sidebar";
import styles from "./workspace-home.module.css";

type WorkspaceOrganization = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type WorkspaceMailbox = {
  id: string;
  organization_id?: string;
  address: string;
  display_name: string | null;
};

type WorkspaceHomeProps = {
  email: string;
  organizations: WorkspaceOrganization[];
  selectedOrganization?: WorkspaceOrganization;
  mailboxes?: WorkspaceMailbox[];
  mailboxError?: boolean;
  providerConnected?: boolean;
  workspaceDomains?: { id: string; domain: string; status: string; sending_enabled: boolean; receiving_enabled: boolean }[];
};

export default function WorkspaceHome({
  email,
  organizations,
  selectedOrganization,
  mailboxes = [],
  mailboxError = false,
  providerConnected = false,
  workspaceDomains = [],
}: WorkspaceHomeProps) {
  const selected = selectedOrganization;
  const currentMailboxes = selected
    ? mailboxes.filter((mailbox) => !mailbox.organization_id || mailbox.organization_id === selected.id)
    : mailboxes;
  const verifiedDomains = workspaceDomains.filter((domain) => domain.status === "verified" && domain.sending_enabled && domain.receiving_enabled);
  const mailboxReady = currentMailboxes.length > 0;
  const emailReady = Boolean(providerConnected && verifiedDomains.length > 0 && mailboxReady);
  const completedSetupSteps = Number(providerConnected) + Number(verifiedDomains.length > 0) + Number(mailboxReady);
  const workspaceBase = selected ? "/dashboard/" + selected.id : undefined;
  const settingsHref = (section = "general") => selected
    ? section === "general"
      ? "/dashboard/" + selected.id + "/settings"
      : "/dashboard/" + selected.id + "/settings/" + section
    : section === "general" ? "/settings" : "/settings/" + section;

  return (
    <div className={"mail-app " + styles.app}>
      <WorkspaceSidebar
        activeView="Inbox"
        mailboxBaseHref={workspaceBase ? workspaceBase + "/mail" : undefined}
        enabledMailboxViews={emailReady ? ["Inbox", "Sent"] : []}
        disabledMailFeatures={!emailReady}
        disableContacts
        workspaceName={selected?.name ?? "Your workspaces"}
        workspaceDescription={selected ? emailReady ? "Business email ready" : "Email setup required" : "Choose an organization"}
        homeHref={workspaceBase ?? "/dashboard"}
        workspaceBaseHref={workspaceBase}
        workspaces={organizations}
        activeWorkspaceId={selected?.id}
      />

      <main className="mail-main">
        <header className={"mail-topbar " + styles.topbar}>
          <div className="mail-breadcrumb">
            <span>Workspace</span><span className="mail-breadcrumb-slash">/</span>
            <strong>{selected?.name ?? "Organizations"}</strong>
          </div>
          <div className={"mail-search " + styles.search} aria-label="Search is available inside the active inbox">
            <span aria-hidden="true">⌕</span>
            <input type="search" disabled placeholder="Search is available in Inbox" aria-label="Search available in Inbox" />
          </div>
          <div className={styles.topbarActions}>
            <Link href={settingsHref()} className={styles.topbarLink}>Settings</Link>
            <Link href={settingsHref("security")} className={styles.topbarLink}>Account</Link>
            <SignOutButton className="auth-signout-control" />
          </div>
        </header>

        <div className={styles.content}>
          {selected ? (
            <>
              <section className={styles.headingRow}>
                <div>
                  <p className={styles.eyebrow}>YOUR WORKSPACE</p>
                  <h1 className={styles.pageTitle}>Inbox</h1>
                  <p className={styles.pageSubtitle}>
                    {selected.name} · Signed in as {email}
                  </p>
                </div>
                <div className={styles.headingControls}>
                  {emailReady && <Link className={styles.topbarLink} href={"/dashboard/" + selected.id + "/mail"}>Open inbox</Link>}
                  <span className={styles.pendingStatus}><span aria-hidden="true">●</span> {emailReady ? "Business email ready" : "Email setup required"}</span>
                  <Link className={styles.topbarLink} href={settingsHref("mail")}>Connect provider</Link>
                </div>
              </section>

              <section className={styles.setupBanner} aria-labelledby="setup-title">
                <div className={styles.bannerIcon} aria-hidden="true">✉</div>
                <div className={styles.bannerContent}>
                  <p className={styles.eyebrow}>SETUP REQUIRED</p>
                  <h2 id="setup-title">{emailReady ? "Your business email workspace is ready" : "Set up business email for " + selected.name}</h2>
                  <p>
                    {emailReady
                      ? "Your Resend connection, verified domain and active mailbox are ready. Open the inbox to send, receive and track messages."
                      : "Complete these workspace steps in order: connect a Resend account, add your business domain and publish its DNS records, verify sending and receiving, then create an email address."}
                  </p>
                  <p className={styles.previewDisclaimer}>
                    {emailReady
                      ? "This workspace currently supports the enabled mailbox features. Attachments and scheduled sending are not available yet."
                      : "Provider keys are stored encrypted on the server. Domain status is shown only after ABEmail checks it with Resend."}
                  </p>
                  <Link href={emailReady ? "/dashboard/" + selected.id + "/mail" : settingsHref(!providerConnected ? "mail" : verifiedDomains.length === 0 ? "domains" : "mailboxes")} className={styles.bannerLink}>{emailReady ? "Open inbox" : !providerConnected ? "Connect Resend" : verifiedDomains.length === 0 ? "Add and verify domain" : "Create mailbox"} <span aria-hidden="true">→</span></Link>
                </div>
              </section>

              <div className={styles.mainGrid}>
                <section className={styles.inboxPanel} aria-labelledby="inbox-heading">
                  <header className={styles.inboxHeader}>
                    <div><span aria-hidden="true">▤</span><h2 id="inbox-heading">Inbox</h2></div>
                    <span>{mailboxReady ? "Mailbox is configured" : "No active mailbox"}</span>
                  </header>
                  {mailboxError ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon} aria-hidden="true">!</div>
                      <h3>Mailbox access is being checked</h3>
                      <p>Your workspace identity was verified, but mailbox records could not be loaded. Refresh this page or check the workspace settings.</p>
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon} aria-hidden="true">✉</div>
                      <h3>{mailboxReady ? "Open your active inbox" : "Your inbox is ready for setup"}</h3>
                      <p>{mailboxReady ? "Your mailbox has been configured. Open Inbox to view incoming and sent messages." : "Create an email address after connecting Resend and verifying your domain."}</p>
                      {mailboxReady && <Link className={styles.bannerLink} href={"/dashboard/" + selected.id + "/mail"}>Open Inbox <span aria-hidden="true">→</span></Link>}
                      {!mailboxReady && <Link className={styles.bannerLink} href={settingsHref(!providerConnected ? "mail" : "domains")}>Continue setup <span aria-hidden="true">→</span></Link>}
                    </div>
                  )}
                </section>

                <aside className={styles.setupPanel} aria-labelledby="setup-checklist-heading">
                  <div className={styles.setupPanelHeading}>
                    <div><p className={styles.eyebrow}>GET STARTED</p><h2 id="setup-checklist-heading">Workspace setup</h2></div>
                    <span className={styles.setupCount}>{completedSetupSteps}/3</span>
                  </div>
                  <p className={styles.setupIntro}>These are the remaining steps before the mail features can be activated.</p>
                  <div className={styles.setupList}>
                    {[
                      {
                        number: "01",
                        title: "Connect Resend",
                        detail: "Use a dedicated Full Access key so ABEmail can manage domains and signed inbound webhooks.",
                        complete: providerConnected,
                        href: settingsHref("mail"),
                        action: providerConnected ? "Connection settings" : "Connect provider",
                      },
                      {
                        number: "02",
                        title: "Verify your domain",
                        detail: "Publish the requested DNS records and confirm sending and receiving in Resend.",
                        complete: verifiedDomains.length > 0,
                        href: settingsHref("domains"),
                        action: verifiedDomains.length > 0 ? "Manage domains" : "Add domain",
                      },
                      {
                        number: "03",
                        title: "Create a mailbox",
                        detail: "Set up an address such as info@yourdomain.com on a verified domain.",
                        complete: mailboxReady,
                        href: settingsHref("mailboxes"),
                        action: mailboxReady ? "Manage mailboxes" : "Create mailbox",
                      },
                    ].map((step) => (
                      <article className={styles.setupStep} key={step.number}>
                        <span className={styles.stepNumber}>{step.number}</span>
                        <div className={styles.stepCopy}>
                          <div className={styles.stepTitleRow}>
                            <h3>{step.title}</h3>
                            <span className={step.complete ? styles.readyState : styles.pendingState}>{step.complete ? "Complete" : "Next step"}</span>
                          </div>
                          <p>{step.detail}</p>
                          <Link href={step.href}>{step.action} <span aria-hidden="true">→</span></Link>
                        </div>
                      </article>
                    ))}
                  </div>
                </aside>
              </div>

              <section className={styles.mailboxPanel} aria-labelledby="mailboxes-heading">
                <header className={styles.mailboxPanelHeading}>
                  <div><p className={styles.eyebrow}>ORGANIZATION EMAIL</p><h2 id="mailboxes-heading">Mailboxes</h2></div>
                  <Link href={settingsHref("mailboxes")}>Open mailbox settings <span aria-hidden="true">→</span></Link>
                </header>
                {mailboxError ? (
                  <p className={styles.mailboxNotice}>Mailbox data could not be loaded. No configuration has been changed.</p>
                ) : currentMailboxes.length ? (
                  <ul className={styles.mailboxList}>
                    {currentMailboxes.map((mailbox) => (
                      <li key={mailbox.id} className={styles.mailboxRow}>
                        <span className={styles.mailboxAvatar}>{(mailbox.display_name || mailbox.address).slice(0, 1).toUpperCase()}</span>
                        <span className={styles.mailboxIdentity}>
                          <strong>{mailbox.display_name || mailbox.address}</strong>
                          <small>{mailbox.address}</small>
                        </span>
                        <span className={styles.mailboxState}>Active</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.mailboxNotice}>No active mailbox addresses are available to this account in this organization yet. Domain verification and mailbox provisioning must be completed first.</p>
                )}
              </section>
            </>
          ) : (
            <>
              <section className={styles.headingRow}>
                <div>
                  <p className={styles.eyebrow}>ABEMAIL WORKSPACE</p>
                  <h1 className={styles.pageTitle}>Choose your workspace</h1>
                  <p className={styles.pageSubtitle}>Signed in as {email}. Select an organization to continue; workspace permissions remain separate.</p>
                </div>
              </section>
              <div className={styles.organizationGrid}>
                {organizations.map((organization) => {
                  const count = mailboxes.filter((mailbox) => mailbox.organization_id === organization.id).length;
                  return (
                    <article className={styles.organizationCard} key={organization.id}>
                      <div className={styles.organizationCardHeader}>
                        <span className={styles.organizationAvatar}>{organization.name.slice(0, 1).toUpperCase()}</span>
                        <span className={styles.roleTag}>{organization.role}</span>
                      </div>
                      <h2>{organization.name}</h2>
                      <p className={styles.organizationSlug}>{organization.slug}.abemail workspace</p>
                      <div className={styles.organizationMeta}>
                        <span>{count} active mailbox{count === 1 ? "" : "es"}</span>
                        <span>Organization access verified</span>
                      </div>
                      <Link className={styles.openWorkspace} href={"/dashboard/" + organization.id}>Open workspace <span aria-hidden="true">→</span></Link>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
