import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    errors.push("Required workspace navigation file is missing: " + relativePath);
    return "";
  }
  return readFileSync(absolutePath, "utf8");
}

function walk(relativeDirectory) {
  const absoluteDirectory = path.join(root, relativeDirectory);
  if (!existsSync(absoluteDirectory)) return [];
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return walk(relativePath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [relativePath] : [];
  });
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}

const sidebarPath = "components/workspace-sidebar.tsx";
const layoutPath = "app/dashboard/[organizationId]/layout.tsx";
const demoPath = "app/demo/page.tsx";
const sidebar = read(sidebarPath);
const layout = read(layoutPath);
read(demoPath);
const featureRoute = read("app/dashboard/[organizationId]/[workspacePage]/page.tsx");
const mailRoute = read("app/dashboard/[organizationId]/mail/page.tsx");
const liveMailbox = read("components/live-mailbox.tsx");
const settings = read("components/workspace-settings-panel.tsx");
const settingsRoute = read("app/dashboard/[organizationId]/settings/[[...section]]/page.tsx");
const contactManager = read("components/contact-manager.tsx");
const inboxStyles = read("components/workspace-home.module.css");
const globalStyles = read("app/globals.css");
const navigationContract = read("docs/workspace-navigation.md");
const mailboxCountsRoute = read("app/api/mail/sidebar-counts/route.ts");

const sidebarSourceFiles = walk("app").concat(walk("components")).filter((relativePath) => {
  const source = readFileSync(path.join(root, relativePath), "utf8");
  return /import\s+.*WorkspaceSidebar.*from\s+["']@\/components\/workspace-sidebar["']|<WorkspaceSidebar\b/.test(source);
});
const allowedSidebarOwners = new Set([layoutPath, demoPath, sidebarPath]);
for (const relativePath of sidebarSourceFiles) {
  if (!allowedSidebarOwners.has(relativePath)) {
    errors.push("A page/component is creating its own sidebar: " + relativePath + ". Workspace routes must use the persistent organization layout.");
  }
}

const mountedSidebarCount = (layout.match(/<WorkspaceSidebar\b/g) ?? []).length;
assert(mountedSidebarCount === 1, "The organization layout must mount exactly one WorkspaceSidebar (found " + mountedSidebarCount + ").");
assert(layout.includes('<div className="mail-app workspace-app-shell">'), "The universal workspace shell wrapper is missing.");
assert(layout.includes('<main className="mail-main workspace-main-content">{children}</main>'), "Workspace pages must render inside the shell's single main content region.");
assert(layout.includes('.eq("status", "active")'), "The universal shell must verify active workspace membership.");
assert(layout.includes('from("organizations")'), "The universal shell must validate the active organization.");

const requiredSidebarLabels = [
  "Inbox", "Starred", "Sent", "Drafts", "Scheduled", "Snoozed",
  "Archive", "Trash", "Spam", "Contacts", "Templates", "Reminders",
  "Labels", "Analytics", "Settings",
];
for (const label of requiredSidebarLabels) {
  assert(sidebar.includes('label: "' + label + '"'), "Missing locked navigation destination: " + label + ".");
}
assert(!/\bSoon\b|Coming soon|mail-feature-pill/.test(sidebar), "The global sidebar must not bring back disabled/Soon placeholder labels.");
assert(sidebar.includes("const currentMailboxView = mailboxLinks.find"), "Mailbox active state must derive from the current route query.");
assert(sidebar.includes("href={composeHref}"), "Compose must remain a route-driven control in the shared sidebar.");
assert(sidebar.includes("router.push(itemHref, { scroll: false })"),
  "Mailbox navigation must use the App Router so workspace pages transition to the mounted mailbox route.");
assert(!sidebar.includes("window.history.pushState("),
  "Mailbox navigation must not update only the browser URL while leaving the current workspace page mounted.");
assert(sidebar.includes('if (pathname === mailboxBaseHref)') &&
  sidebar.includes('window.dispatchEvent(new Event("abemail:compose"))'),
  "Compose may use the direct drawer event only while the mailbox route is already mounted; workspace clicks must navigate to Mail.");
assert(!/mailboxCounts|onMailboxNavigate|disabledMailFeatures|enabledMailboxViews|activeMailboxView/.test(sidebar), "The global sidebar must not accept page-specific props that alter its appearance or behavior.");

for (const [relativePath, source] of [
  ["components/live-mailbox.tsx", liveMailbox],
  ["components/contact-manager.tsx", contactManager],
  ["components/workspace-settings-panel.tsx", settings],
]) {
  assert(!source.includes("WorkspaceSidebar"), relativePath + " must render content only, not a sidebar.");
}
assert(!/\.app\s+:global\(\.mail-(?:sidebar|nav(?:-section|-item|-icon|-label)?|brand|compose-button|workspace-copy|workspace-switcher)/.test(inboxStyles),
  "Inbox CSS must not override the universal sidebar's styles.");
assert(globalStyles.includes("/* Workspace sidebar visual contract: preserve the Inbox baseline on every workspace route. */"),
  "The shared stylesheet must own the locked Inbox sidebar baseline.");
assert(globalStyles.includes(".mail-app.workspace-app-shell .mail-nav {") &&
  globalStyles.includes(".mail-app.workspace-app-shell .mail-nav-item {") &&
  globalStyles.includes(".mail-app.workspace-app-shell .mail-nav-icon {"),
  "Sidebar spacing, item size, and icon sizing must be defined centrally for the universal workspace shell.");
assert(/@media \(max-width: 560px\)[\s\S]*?\.mail-app\.workspace-app-shell \.mail-sidebar\s*\{[^}]*width:\s*68px;/.test(globalStyles),
  "The universal sidebar must preserve the Inbox mobile-width baseline.");

for (const section of ["templates", "reminders", "labels", "analytics"]) {
  assert(featureRoute.includes(section + ":"), "The locked workspace destination /" + section + " needs a canonical content route.");
}
for (const section of ["rules", "out-of-office", "branding", "integrations"]) {
  assert(settings.includes('section === "' + section + '"'), "Settings content is missing its roadmap section: " + section + ".");
  assert(settingsRoute.includes('"' + section + '"'), "Settings route allowlist is missing its roadmap section: " + section + ".");
}
assert(mailRoute.includes('"Snoozed"') && liveMailbox.includes('activeView === "Snoozed"'), "Snoozed must remain a known mailbox destination, even while its lifecycle is unimplemented.");
assert(navigationContract.includes("Non-negotiable shell rule"), "The workspace navigation contract document is missing or incomplete.");
assert(liveMailbox.includes('+ (!message.is_read ? " unread" : "")') &&
  liveMailbox.includes('className="mail-unread-dot"'),
  "Unread messages must be visually distinguished in the message list.");
assert(liveMailbox.includes('aria-label={"Open " + (message.subject || "message") + (message.is_read ? "" : ", unread")}'),
  "Unread status must also be announced when a message is opened with assistive technology.");
assert(liveMailbox.includes('<span className="mail-message-sender">') &&
  liveMailbox.includes('<strong>{message.direction === "inbound" ? message.from_address : message.to_addresses.join(", ")}</strong>'),
  "The unread marker and sender must be grouped together so the indicator cannot push the sender away.");
assert(globalStyles.includes(".mail-message-sender {") &&
  globalStyles.includes("flex: 1 1 auto;") &&
  globalStyles.includes("gap: 6px;"),
  "The sender group must keep a small fixed gap between the unread dot and sender text.");
assert(sidebar.includes("/api/mail/sidebar-counts?organizationId=") && sidebar.includes("mail-nav-count"),
  "The shared mailbox navigation must display live unread and folder-count badges.");
assert(mailboxCountsRoute.includes('auth.getUser()') &&
  mailboxCountsRoute.includes('from("organization_memberships")') &&
  mailboxCountsRoute.includes('from("mailbox_memberships")'),
  "Mailbox count endpoints must authenticate the user and enforce workspace/mailbox access.");
assert(mailboxCountsRoute.includes('from("email_message_user_state")') &&
  mailboxCountsRoute.includes('from("email_drafts")') &&
  mailboxCountsRoute.includes('from("scheduled_email_messages")'),
  "Inbox, spam, draft, and scheduled navigation counts must come from their persisted records.");
assert(mailboxCountsRoute.includes('inboxUnread:') && mailboxCountsRoute.includes('spamUnread:') &&
  mailboxCountsRoute.includes('drafts:') && mailboxCountsRoute.includes('scheduled:'),
  "The mailbox count response must include the supported folder counters.");

if (errors.length) {
  console.error("Workspace navigation regression check failed:");
  for (const error of errors) console.error("- " + error);
  process.exitCode = 1;
} else {
  console.log("Workspace navigation contract passed: one persistent sidebar, fixed destinations, canonical routes, and no page-specific sidebar styles.");
}
