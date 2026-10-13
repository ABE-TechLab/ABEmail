# Commercial ABEmail — Minimum Viable Product

## Purpose

Commercial ABEmail is a hosted business-email workspace for multiple customer organizations, operated by ABE TechLab. It must support many unrelated customers inside one product while keeping their people, mailboxes, messages, files, provider configuration, and operational data isolated.

The Waste2Light ABEmail-Mail deployment is a single-organization reference implementation. It is not the commercial tenant model and must remain separately deployed and configured.

## Target users

### ABE TechLab platform operator
Onboards and suspends customer organizations; monitors delivery, health, usage, incidents, abuse, domains, and audit events; helps resolve configuration issues across tenants.

### Organization owner / administrator
Configures the organization, verifies domains, creates mailboxes, invites teammates, assigns mailbox access, and manages organization settings and usage.

### Organization member
Uses only the mailboxes and records to which they have been granted access. Members cannot change billing, manage unrelated tenants, or use platform-operator tools.

## Core customer journeys

1. **Organization onboarding:** ABE TechLab creates an organization, designates an owner, and sends a time-limited invitation. The owner accepts, completes organization setup, and invites team members.
2. **Domain setup:** An owner adds a domain and receives the required Domain Name System (DNS) records. Sending/receiving stays disabled until the server verifies the necessary records and provider status.
3. **Mailbox setup:** An authorized organization admin creates mailboxes on a verified domain and assigns member access. Mailboxes and domains cannot be attached to another organization by changing a client-supplied identifier.
4. **Daily email:** Authorized members read and search their permitted inboxes, compose and send messages, reply, reply-all, forward, attach files, manage drafts, schedule sends, and manage contacts.
5. **Operations and recovery:** ABE TechLab can diagnose provider delivery and webhook failures, track usage, inspect audit events, and suspend an unsafe or misconfigured tenant without accessing unrelated message bodies by default.

## MVP scope

### Identity and organization membership
- Supabase Auth as the initial identity service.
- Multiple organization memberships for one user.
- Invitation acceptance with expiry, one-time use, and role assignment.
- Explicit organization context and membership validation on every server operation.
- Roles: Owner, Administrator, Member. Platform operator is a separate capability, not a tenant role.
- Optional mailbox-level grants so not every member must see every shared mailbox.

### Mail workspace
- Inbox, message detail, sent, drafts, starred, trash, search, contacts, and scheduled messages.
- Compose, reply, reply-all, forward, and attachments.
- Read/unread, star/unstar, spam, trash/restore, and delete operations.
- Responsive interface using the ABE TechLab Design System tokens.
- User-facing report/feedback flow that sends minimal, safe diagnostic context.

### Email infrastructure
- Start with Resend behind an internal provider interface.
- Support verified customer sending/receiving domains and tenant-specific mailbox routing.
- Validate sender identity and mailbox permissions before accepting a send request.
- Verify provider webhooks, process events idempotently, and track delivery/bounce/failure states.
- Use a private attachment bucket with tenant-aware access rules.
- Rate limits, per-organization usage counters, sending limits, abuse controls, and suspension controls are required before any open signup.

### Platform operations
- Tenant list, organization state, domain/provider health, usage, incidents, and audit history.
- Privileged actions require explicit authorization and audit records.
- Platform views must show the minimum data needed for operations; message bodies are excluded from routine logs.
- Feature flags and account limits can disable risky capabilities per organization.

## Not in the first milestone

- Public, self-service signup without review.
- Automated subscription checkout, invoicing, and payment collection.
- Google Workspace or Microsoft 365 inbox synchronization.
- Full IMAP/SMTP compatibility, calendar, contacts sync, mobile apps, and advanced compliance retention.
- Multiple outbound/inbound providers before the first provider path is secure and stable.

The first release is a managed business-email workspace. It is not advertised as a full replacement for every external mail host or as an IMAP/SMTP service unless those capabilities are separately designed and implemented.

## Acceptance criteria

- Two test organizations exist with separate owners, members, domains, mailboxes, messages, attachments, drafts, contacts, and scheduled messages.
- A user in Organization A cannot read, write, change, delete, search, or infer records owned by Organization B by altering a URL, request body, message ID, mailbox ID, domain ID, storage path, or query filter.
- Role and mailbox grants are checked on the server and by Row Level Security (RLS).
- A verified mailbox can send and receive a test message end-to-end in a non-production environment.
- Duplicate provider webhook deliveries do not create duplicate messages or delivery events.
- The CI pipeline runs type checks, a production build, and database authorization tests.
- No Waste2Light production resource, data, secret, domain, or deployment is reused.
- Platform operator actions can be traced to actor, tenant, operation, timestamp, and outcome.

## Success measures for a controlled pilot

- Zero observed cross-tenant authorization leaks in automated tests.
- All tenant setup and sender-domain verification steps are visible and diagnosable.
- Outbound attempts, accepted sends, provider failures, bounces, and inbound events are attributable to an organization/mailbox.
- Operators can disable one tenant without interrupting unrelated tenants.
- A customer can onboard a small team and use core mail workflows without ABE TechLab manually changing application code.
