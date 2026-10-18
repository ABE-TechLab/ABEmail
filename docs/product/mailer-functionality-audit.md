# Mailer Functionality Audit

Work is being carried out on `feat/mailer-functionality-audit` only. Automation remains out of scope.

## Confirmed current state

- The authenticated mailbox page loads real `email_messages` for active organization mailboxes, but only the newest 60 records.
- The current authenticated page accepts only Inbox and Sent as active views.
- The mailbox sidebar advertises Starred, Drafts, Scheduled, Archive, and Trash, but those views are not implemented as persistent authenticated workflows. Spam is missing from this sidebar.
- `email_messages` currently stores transport state (for example accepted, delivered, bounced, complained, and failed) but has no read/star/archive/trash/spam lifecycle fields.
- Authenticated users have SELECT access to `email_messages`; writes are service-role-only. Lifecycle actions therefore need a carefully scoped server-side operation or database function, not direct browser updates.
- The core migration defines tenant-scoped contacts with row-level security (RLS), so the schema supports persisted contacts; the existing contacts page still needs auditing to confirm it uses that backend rather than sample data.
- Current mailbox search filters only messages already loaded by the page; the page limit is 60.
- The authenticated composer currently supports plain-text sending and reply, but reply-all, forwarding, attachments, and scheduling remain unverified or incomplete.
- The existing outbound send path uses idempotency keys. Preserve that protection when extending message workflows.

## Lifecycle implementation checkpoint

The feature branch now contains an additive migration and application code for per-user read/unread, starred, archive, trash, and spam state. An authenticated RPC validates active organization membership, mailbox read grants, and stronger mailbox-management permission for permanent deletion. The mailbox UI exposes the six implemented folders and supports single-message and bulk actions.

The branch also includes synthetic database tests for bulk operations, restore/permanent-delete restrictions, cross-tenant denial, mailbox grants, direct-write denial, and preservation of provider transport status. GitHub Actions passed lint, TypeScript type-checking, the production build, and `supabase test db` against an isolated local database for commit `bed7c48961f42a4752fdf3c8f487389cd20e50f3` ([CI run](https://github.com/ABE-TechLab/ABEmail/actions/runs/39163546054)). This verifies the repository code in CI; it does not validate or modify the hosted database. The migration has **not** been applied to any Supabase project, and the branch has not been merged or deployed.

## Remaining implementation order

1. Run the lifecycle database tests in an isolated local Supabase/Postgres environment and fix any failures. Do not point this test run at the shared hosted project.
2. Verify lint, type checks, and production build; review authorization, folder behavior, and desktop/mobile UI.
3. Replace loaded-page-only search with server-side search/pagination and complete read-state refresh behavior for more than the latest 60 messages.
4. Audit and finish contacts, drafts, replies, forwarding, attachments, and settings.
5. Implement scheduled sending only with a durable queue/worker, time-zone-safe scheduling, cancellation guarantees, and idempotent delivery.
6. Verify end-to-end sending/receiving in an isolated non-production environment before proposing release.
4. Replace loaded-page-only search with server-side search/pagination and connect refresh/read status to persisted data.
5. Audit and finish contacts, drafts, replies, forwarding, attachments, and settings.
6. Implement scheduled sending only with a durable queue/worker, time-zone-safe scheduling, cancellation guarantees, and idempotent delivery.
7. Verify lint, type checks, production build, authorization tests, and end-to-end sending/receiving in an isolated non-production environment, then verify desktop and mobile layouts.

## Release constraints

Do not merge this branch or change Production during this work. The readiness notes indicate Preview and Development share the Production Supabase project; avoid applying migrations or running destructive tests against that shared project. Do not mark a feature complete until its persisted behavior and authorization have been verified.
