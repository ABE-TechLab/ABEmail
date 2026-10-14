"use client";

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
};

const setupSteps = [
  {
    number: "01",
    title: "Verify a sending domain",
    detail: "Domain ownership and DNS checks are not connected yet.",
    state: "Preview only",
    href: "/settings/domains",
    action: "Review domains",
  },
  {
    number: "02",
    title: "Provision mailboxes",
    detail: "A workspace address does not yet mean provider mail is active.",
    state: "Not connected",
    href: "/settings/mailboxes",
    action: "Review mailboxes",
  },
  {
    number: "03",
    title: "Connect email delivery",
    detail: "Resend has not been configured for this commercial environment.",
    state: "Not connected",
    href: "/settings/mail",
    action: "Review mail settings",
  },
  {
    number: "04",
    title: "Manage your team",
    detail: "Invitations and mailbox grants have a working account-scoped flow.",
    state: "Available",
    href: "/settings/team",
    action: "Manage team",
  },
];

export default function WorkspaceHome({
  email,
  organizations,
  selectedOrganization,
  mailboxes = [],
  mailboxError = false,
}: WorkspaceHomeProps) {
  const selected = selectedOrganization;
  const currentMailboxes = selected
    ? mailboxes.filter((mailbox) => !mailbox.organization_id || mailbox.organization_id === selected.id)
    : mailboxes;

  return (
    <div className={"mail-app " + styles.app}>
      <WorkspaceSidebar
        activeView="Inbox"
        disabledMailFeatures
        disableContacts
        workspaceName={selected?.name ?? "Your workspaces"}
        workspaceDescription={selected ? "Email setup pending" : "Choose an organization"}
        workspaceHref="/dashboard"
      />

      <main className="mail-main">
        <header className={"mail-topbar " + styles.topbar}>
          <div className="mail-breadcrumb">
            <span>Workspace</span><span className="mail-breadcrumb-slash">/</span>
            <strong>{selected?.name ?? "Organizations"}</strong>
          </div>
          <div className={"mail-search " + styles.search} aria-label="Email search is unavailable until mail is connected">
            <span aria-hidden="true">⌕</span>
            <input type="search" disabled placeholder="Search email · unavailable" aria-label="Search email unavailable" />
          </div>
          <div className={styles.topbarActions}>
            <Link href="/settings" className={styles.topbarLink}>Settings</Link>
            <Link href="/settings/account" className={styles.topbarLink}>Account</Link>
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
                  <span className={styles.pendingStatus}><span aria-hidden="true">●</span> Mail not connected</span>
                  <button className={styles.disabledCompose} type="button" disabled>＋ Compose</button>
                </div>
              </section>

              <section className={styles.setupBanner} aria-labelledby="setup-title">
                <div className={styles.bannerIcon} aria-hidden="true">✉</div>
                <div className={styles.bannerContent}>
                  <p className={styles.eyebrow}>SETUP REQUIRED</p>
                  <h2 id="setup-title">Connect your email provider to activate this inbox</h2>
                  <p>
                    Your account and organization access are working. Messages, search, compose, and delivery actions
                    stay unavailable until domain verification, mailbox provisioning, and the mail provider are connected.
                  </p>
                  <p className={styles.previewDisclaimer}>
                    The domain, mailbox, and mail settings screens are currently previews; they do not save provider or DNS configuration.
                  </p>
                  <Link href="/settings/domains" className={styles.bannerLink}>View setup steps <span aria-hidden="true">→</span></Link>
                </div>
              </section>

              <div className={styles.mainGrid}>
                <section className={styles.inboxPanel} aria-labelledby="inbox-heading">
                  <header className={styles.inboxHeader}>
                    <div><span aria-hidden="true">▤</span><h2 id="inbox-heading">Inbox</h2></div>
                    <span>0 live messages</span>
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
                      <h3>Your inbox is ready for setup</h3>
                      <p>There are no live messages to show yet. ABEmail will not display sample mail in your signed-in workspace.</p>
                    </div>
                  )}
                </section>

                <aside className={styles.setupPanel} aria-labelledby="setup-checklist-heading">
                  <div className={styles.setupPanelHeading}>
                    <div><p className={styles.eyebrow}>GET STARTED</p><h2 id="setup-checklist-heading">Workspace setup</h2></div>
                    <span className={styles.setupCount}>0/3</span>
                  </div>
                  <p className={styles.setupIntro}>These are the remaining steps before the mail features can be activated.</p>
                  <div className={styles.setupList}>
                    {setupSteps.map((step) => (
                      <article className={styles.setupStep} key={step.number}>
                        <span className={styles.stepNumber}>{step.number}</span>
                        <div className={styles.stepCopy}>
                          <div className={styles.stepTitleRow}>
                            <h3>{step.title}</h3>
                            <span className={step.state === "Available" ? styles.readyState : styles.pendingState}>{step.state}</span>
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
                  <Link href="/settings/mailboxes">Open mailbox settings <span aria-hidden="true">→</span></Link>
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
                        <span className={styles.mailboxState}>Provider connection unverified</span>
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
