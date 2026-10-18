# Mailer Functionality Audit

Work is being carried out on `feat/mailer-functionality-audit` only.

## Confirmed gaps

- The authenticated mailbox currently supports Inbox and Sent views.
- Drafts, Archive, Starred, Scheduled, Trash, and Spam are not implemented as persistent authenticated mailbox workflows.
- Contacts currently use sample data and additions are browser-session-only.
- Live search filters the messages already loaded by the page; the page currently loads up to 60 messages.
- The authenticated composer supports plain-text sending and reply, but not reply-all, forwarding, attachments, or scheduling.
- Demo interactions are in-memory examples and must not be described as live mail functionality.

## Release requirements

Inspect the existing schema, migrations, Row Level Security policies, and inbound webhook before changing message state. Implement lifecycle operations and contacts with tenant-scoped authorization, persistence, failure handling, and automated tests. Add scheduled sending only with a durable queue/worker and idempotent delivery. Verify lint, type checks, production build, authorization tests, and end-to-end sending/receiving in an isolated non-production environment. Do not merge this branch or change Production during this work.
