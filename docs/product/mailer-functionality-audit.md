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

## Implementation order

1. Add lifecycle state with an additive migration: read/unread, starred, archived, trash, and spam state. Preserve transport delivery status as a separate concern.
2. Add authorized server-side lifecycle actions and mailbox queries for Inbox, Sent, Starred, Archive, Trash, and Spam. Validate organization membership and mailbox-level permissions for every operation; implement restore and permanent-delete semantics explicitly.
3. Add tests for cross-tenant access, mailbox grants, invalid transitions, bulk actions, and ensuring delete/archive never triggers sending.
4. Replace loaded-page-only search with server-side search/pagination and connect refresh/read status to persisted data.
5. Audit and finish contacts, drafts, replies, forwarding, attachments, and settings.
6. Implement scheduled sending only with a durable queue/worker, time-zone-safe scheduling, cancellation guarantees, and idempotent delivery.
7. Verify lint, type checks, production build, authorization tests, and end-to-end sending/receiving in an isolated non-production environment, then verify desktop and mobile layouts.

## Release constraints

Do not merge this branch or change Production during this work. The readiness notes indicate Preview and Development share the Production Supabase project; avoid applying migrations or running destructive tests against that shared project. Do not mark a feature complete until its persisted behavior and authorization have been verified.
