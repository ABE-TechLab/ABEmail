import Link from "next/link";

const capabilities = [
  {
    number: "01",
    title: "Organization boundaries",
    description:
      "Every customer workspace will have explicit membership and data-access boundaries.",
    status: "Design in progress",
  },
  {
    number: "02",
    title: "Email transport",
    description:
      "A provider adapter will keep sending and receiving integrations independent of business rules.",
    status: "Not connected",
  },
  {
    number: "03",
    title: "Platform operations",
    description:
      "ABE TechLab will manage tenant lifecycle, usage, audit events, and platform health separately.",
    status: "Planned",
  },
];

export default function HomePage() {
  return (
    <main className="site-shell">
      <header className="topbar">
        <Link className="wordmark" href="/" aria-label="ABEmail home">
          <span className="wordmark-mark" aria-hidden="true">A</span>
          <span>AB<span className="wordmark-accent">Email</span></span>
        </Link>
        <div className="environment-tag">
          <span className="environment-dot" aria-hidden="true" />
          Development workspace
        </div>
      </header>

      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <p className="eyebrow">ABE TECHLAB <span>/</span> BUSINESS EMAIL</p>
          <h1 id="hero-heading">A better workspace for business email.</h1>
          <p className="hero-description">
            One place for organizations and their teams to manage business
            communication, with clear access boundaries and platform operations
            built in from the beginning.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/auth/sign-in">
              Sign in to ABEmail <span aria-hidden="true">→</span>
            </Link>
            <Link className="plain-note" href="/auth/sign-up">Create an account</Link>
            <a className="plain-note" href="#foundation">Explore the foundation <span aria-hidden="true">↘</span></a>
            <span className="plain-note">Early development · Email is not connected</span>
          </div>
        </div>

        <aside className="preview-panel" aria-label="Illustrative mailbox preview">
          <div className="preview-topbar">
            <div className="window-dots" aria-hidden="true">
              <span /><span /><span />
            </div>
            <span className="preview-caption">WORKSPACE PREVIEW</span>
          </div>
          <div className="preview-workspace">
            <div className="preview-sidebar">
              <div className="mini-brand"><span className="mini-brand-mark">A</span> ABEmail</div>
              <div className="mini-nav active"><span>▤</span> Inbox <b>8</b></div>
              <div className="mini-nav"><span>↗</span> Sent</div>
              <div className="mini-nav"><span>▧</span> Drafts</div>
              <div className="mini-nav"><span>☆</span> Starred</div>
              <div className="mini-nav"><span>◷</span> Scheduled</div>
              <div className="mini-sidebar-rule" />
              <div className="mini-sidebar-label">WORKSPACE</div>
              <div className="mini-workspace"><span className="workspace-avatar">A</span><span>Acme Studio</span><span className="chevron">⌄</span></div>
            </div>
            <div className="preview-content">
              <div className="mailbox-heading">
                <div>
                  <div className="preview-overline">ACME STUDIO</div>
                  <h2>Inbox</h2>
                </div>
                <span className="demo-badge">Illustration</span>
              </div>
              <div className="search-placeholder"><span>⌕</span> Search messages</div>
              <div className="mail-row unread">
                <span className="mail-avatar avatar-green">M</span>
                <div className="mail-copy"><strong>Maya Chen</strong><span>Project update and next steps</span><small>Sharing the latest notes for our team…</small></div>
                <span className="mail-time">10:42</span>
              </div>
              <div className="mail-row">
                <span className="mail-avatar avatar-amber">J</span>
                <div className="mail-copy"><strong>James Okafor</strong><span>Re: Product review</span><small>Thanks for sending this through.</small></div>
                <span className="mail-time">09:18</span>
              </div>
              <div className="mail-row">
                <span className="mail-avatar avatar-violet">P</span>
                <div className="mail-copy"><strong>People &amp; Culture</strong><span>Weekly team digest</span><small>What is happening across the company…</small></div>
                <span className="mail-time">Yesterday</span>
              </div>
              <div className="preview-disclaimer">Illustrative UI only · No real mail or customer data</div>
            </div>
          </div>
        </aside>
      </section>

      <section className="foundation-section" id="foundation" aria-labelledby="foundation-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">BUILDING BLOCKS</p>
            <h2 id="foundation-heading">The foundation comes first.</h2>
          </div>
          <p>These systems are being established before live mailboxes or customer data are introduced.</p>
        </div>
        <div className="capability-grid">
          {capabilities.map((capability) => (
            <article className="capability-card" key={capability.number}>
              <span className="capability-number">{capability.number}</span>
              <h3>{capability.title}</h3>
              <p>{capability.description}</p>
              <div className="capability-status"><span />{capability.status}</div>
            </article>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <span>ABEmail <span className="footer-divider">/</span> ABE TechLab</span>
        <span>Development foundation · Not a customer-ready service</span>
      </footer>
    </main>
  );
}
