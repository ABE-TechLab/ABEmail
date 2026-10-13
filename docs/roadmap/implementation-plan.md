# Commercial ABEmail Implementation Plan

## Phase 0 — Repository and architecture foundation
- [x] Initialize the dedicated commercial repository under `ABE-TechLab`; repository visibility is public and the source remains proprietary under `LICENSE`.
- [x] Establish strict separation from the Waste2Light reference deployment.
- [x] Define commercial product scope and tenant-boundary principles.
- [x] Define the email provider adapter boundary.
- [ ] Confirm the commercial Supabase/Vercel resources and environment plan before provisioning.
- [x] Create a runnable Next.js application scaffold with pinned direct dependencies, readiness endpoint, and automated lint/type-check/build workflow; CI passed.

## Phase 1 — Secure multi-tenant foundation
- [x] Start the application at the mailbox workspace instead of the landing page; preserve the landing page at `/welcome`.
- [x] Add separately routed, responsive Contacts and Settings pages.
- [x] Add initial Settings sections for general preferences, appearance, mail, notifications, team/access, domains, mailboxes, and security (preview interactions only).
- [x] Integrate the shared ABE TechLab Design System package, theme tokens, palette selector, and persistent light/dark/system mode.
- [x] Validate the current multi-page work with lint, type-check, and production build before merge; GitHub Actions passed on this branch.
- [ ] Implement Supabase Auth session handling with server-side identity verification.
- [ ] Create organizations, memberships, invitations, and mailbox access schema.
- [ ] Implement organization context selection backed by an active membership check.
- [ ] Add RLS policies and automated allow/deny tests.
- [ ] Add separate platform-operator authorization and audit events.
- [ ] Create a two-tenant test fixture and prove isolation.

**Exit gate:** no mailbox or message UI is enabled until tenant isolation tests pass.

## Phase 2 — Provisioning and domains
- [ ] Platform operator can create, suspend, and reactivate a tenant.
- [ ] Owner invitation is time-limited, one-use, and revocable.
- [ ] Organization owner can add a domain and follow DNS verification instructions.
- [ ] Mailbox provisioning and member assignment validate same-tenant ownership.
- [ ] Unverified/suspended resources cannot receive normal send requests.

## Phase 3 — Email transport and core workflows
- [ ] Add the server-only provider interface and a separate Resend driver.
- [ ] Implement signature-verified inbound webhooks, recipient-to-mailbox routing, and idempotent event handling.
- [ ] Implement outbound send with sender authorization, quotas, rate limits, and delivery tracking.
- [ ] Add private attachments and authorization checks.
- [ ] Port core inbox, drafts, search, contacts, and scheduled-message workflows with organization and mailbox ownership.
- [ ] Add integration tests for send/receive in an isolated test tenant.

## Phase 4 — Operations and controlled pilot
- [ ] Tenant overview, domain/provider health, usage, incidents, and audit views.
- [ ] Per-tenant limits, suspension, and safe platform support workflow.
- [ ] Logs redact bodies, attachments, credentials, and sensitive provider payloads.
- [ ] Confirm authentication, webhook, tenant isolation, and abuse-control tests.
- [ ] Create separate Preview and Production configuration.
- [ ] Roll out to one test tenant first; then invite a small, known customer cohort.

## Phase 5 — Commercial readiness
- [ ] Subscription, billing, limits, and customer-facing usage information.
- [ ] Self-service onboarding only after abuse controls and recovery procedures are operational.
- [ ] Written support, incident-response, backup/restore, data export/deletion, and provider outage runbooks.
- [ ] Decide whether to add customer-managed provider credentials or additional email providers based on validated demand.

## Execution rules

- Make each phase a reviewable pull request with build/test evidence.
- Do not merge this feature branch or deploy a commercial production environment without approval.
- Do not provision paid cloud services until the cost and target organization are presented and accepted.
- The reference app may inform implementation, but commercial code must remove single-tenant hard-coded domains and query assumptions from day one.
