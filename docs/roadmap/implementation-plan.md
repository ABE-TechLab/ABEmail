# Commercial ABEmail Implementation Plan

## Verified baseline — 2026-10-14

- Commercial Supabase project `jwtfrmzykevfwmjvratb`; migrations `20261013203000`, `20261013213000`, `20261013223000`, and `20261014100000` are applied.
- PR #13 hardens invitation-role authorization and adds two-tenant SQL tests; baseline CI passed.
- PR #14 routes configured visits through sign-in/workspace selection and moves static sample messages to `/demo`.
- Last checked Vercel production deployment was Ready at `https://abemail.vercel.app`; re-check current state.
- Vercel Production, Preview, and Development have the public Supabase URL/key but share one Supabase project. Preview/Development are not isolated.
- Full gODtECH FORGE 0.7.0 integration is in progress under issue #15 and branch `feat/forge-orchestration-issue-15`; mark complete only after strict validation and CI pass and the PR is merged.

## Phase 0 — Repository and architecture foundation

- [x] Establish the commercial repository and proprietary application license.
- [x] Separate the commercial product from the Waste2Light reference deployment.
- [x] Define product scope, provider boundary, and tenant-boundary principles.
- [x] Create the runnable Next.js application and lint/type-check/build CI.
- [x] Provision commercial Supabase/Vercel and configure the public Supabase values.
- [ ] Separate Preview/Development data from Production; targets currently use the same Supabase project.
- [ ] Vendor and strictly validate the full gODtECH FORGE framework, agent contract, MCP entry, handover, and context-aware CI.

## Phase 1 — Authentication and secure multi-tenant foundation

- [x] Implement email/password sign-in/sign-up, callbacks, reset/update, sign-out, and account settings.
- [x] Implement organizations, memberships, invitations, domain metadata, mailboxes, and mailbox grants.
- [x] Apply the four foundation migrations to commercial Supabase.
- [x] Implement onboarding, workspace selection, membership checks, invitations, and mailbox assignment.
- [x] Add Row Level Security (RLS) and allow/deny tests across two tenants.
- [x] Prevent organization administrators from granting administrator privileges through invitations.
- [x] Route the root to sign-in/dashboard and isolate static demo at `/demo`.
- [ ] Verify hosted Auth redirects and deployed confirmation/reset/invitation email flows.
- [ ] Configure custom SMTP for external Auth email.
- [ ] Implement platform-operator permissions, tenant lifecycle, and audit events.
- [ ] Review Supabase advisor warnings for executable SECURITY DEFINER invitation functions.

**Exit gate:** tenant-isolation tests pass, but Auth email, operator controls, and the security-advisor review remain blockers before public launch.

## Phase 2 — Domain and mailbox provisioning

- [x] Store organization-bound domain metadata and mailbox-grant structures.
- [x] Create time-limited one-use invitation links for manual sharing.
- [ ] Choose an ABE TechLab sender domain and provider account; Resend is planned, not configured.
- [ ] Add domain setup UI and server-side DNS/provider verification.
- [ ] Configure provider-issued ownership and sender-authentication DNS records.
- [ ] Provision actual mailboxes only after domain verification.
- [ ] Add automated invitation delivery after a safe sender service exists.
- [ ] Enforce verified/suspended domain/mailbox state across sends, schedules, and retries.

## Phase 3 — Live email transport and core workflows

- [ ] Implement a server-only provider interface and selected driver.
- [ ] Add signed inbound webhooks, raw-body verification, idempotency, retries, and delivery events.
- [ ] Add outbound sending with verified-sender authorization, quotas, rate limits, and abuse controls.
- [ ] Store messages/attachments privately and tenant-scope every read/write and scheduled action.
- [ ] Connect inbox, sent, drafts, search, contacts, and scheduled messages to tenant data, not sample arrays.
- [ ] Test invalid signatures, unknown recipients, cross-tenant requests, duplicates, bounces/complaints, limits, outages, and rollback.
- [ ] Pass end-to-end send/receive tests in an isolated tenant.

## Phase 4 — Operations and controlled pilot

- [ ] Isolate Preview/Development from Production and prove it.
- [ ] Add operator tenant lifecycle, domain/provider health, usage, incident, and audit views.
- [ ] Add redacted logs, delivery tracing, alerts, limits, suspension controls, and operational ownership.
- [ ] Document backup/restore, incident response, provider outages, data export/deletion, migrations, and rollback.
- [ ] Complete Auth, webhook, tenant-isolation, abuse-control, and recovery verification.
- [ ] Pilot with one isolated tenant before inviting external customers.

## Phase 5 — Commercial readiness

- [ ] Review domain ownership, sender reputation, support, retention, and customer-data handling.
- [ ] Add billing/plans/usage only when validated demand requires them.
- [ ] Enable self-service only after identity/domain verification, abuse controls, monitoring, and recovery are ready.
- [ ] Add more providers only when justified by customer needs.

## Execution rules

- Follow `.forge/workflows/GIT.md` for material work: issue, branch, implementation, verification, PR, CI/review, merge, then state/tracker sync.
- Do not merge or deploy production capabilities without approval and passing checks.
- Do not buy domains, create paid resources, change live DNS, or apply hosted migrations without explicit approval.
- Never reuse Waste2Light data, secrets, domains, provider accounts, database, or deployment.
- Database records do not prove provider provisioning. Do not claim live email until end-to-end tests pass.
