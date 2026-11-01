# Ottawa Snow Match Controlled Mail Pilot

## Purpose

Use Ottawa Snow Match as the first controlled organization for proving the commercial ABEmail platform's domain, mailbox, sending, scheduling, and later Model Context Protocol (MCP) workflows. This is a tenant inside the existing ABEmail product, not a separate Ottawa-specific application, database, or deployment.

Tracking issue: [#21 — Tenant-scoped Resend transport and Ottawa Snow Match pilot](https://github.com/ABE-TechLab/ABEmail/issues/21).

## Pilot sender identity

- Organization/test tenant: Ottawa Snow Match
- Sending and receiving subdomain: `ottawasnowmatch.waste2light.com`
- Planned sender: `info@ottawasnowmatch.waste2light.com`
- Planned display name: `Ottawa Snow Match`
- Provider: Resend
- DNS operator: Cloudflare, under the existing `waste2light.com` zone

The commercial ABEmail production project records the domain as `verified` with both `sending_enabled` and `receiving_enabled` set to true. The application also has an active connected Resend workspace connection and a webhook identifier recorded. The root `waste2light.com` MX records must remain unchanged.

The records supplied by Resend were for the subdomain only: DKIM TXT, two sending CNAME records, and an MX record for inbound delivery. Do not change the root `waste2light.com` MX records or copy the subdomain's DNS records into another tenant.

## Production status — verified 2026-11-01

**The Ottawa pilot is provisioned and has processed live inbound and outbound mail in commercial ABEmail.**

Production records show an active `ottawa-snow-match` organization, the verified domain with sending and receiving enabled, two active mailboxes, a connected Resend provider, and a registered webhook identifier. The message ledger contains 9 inbound messages recorded as received, 11 outbound messages delivered, one outbound message accepted, and 33 provider events.

The application routes the inbox through the authenticated organization workspace. The production-only Resend credentials and webhook secret are present in Vercel's environment inventory; their values are never copied into documentation or source control.

This production evidence does not close the remaining platform-readiness work: Preview and Development still share the Production Supabase database, the hosted Auth SMTP flow is not verified, and reusable platform audit/usage controls need attention. Keep external pilot use controlled until those boundaries are resolved.

## Architecture and safety rules

1. Ottawa Snow Match is represented as an organization in commercial ABEmail and uses the existing tenant boundary. Do not create a second Ottawa mailer project or Supabase project.
2. Store the domain in `organization_domains` and bind mailboxes to its domain record using the existing organization-scoped model. The application must confirm provider verification server-side; a client-supplied `verified` flag is never authoritative.
3. The sender is derived from the active mailbox, its verified domain, and the active organization. Never accept an arbitrary From address from a request body.
4. Sending requires an authenticated active organization member with an explicit mailbox `can_send` grant.
5. Keep the restricted Resend API key server-side. Do not commit it, put it in a `NEXT_PUBLIC_*` variable, store it in ordinary tenant settings, or log it.
6. Provider credentials must be resolved through a controlled server-side provider configuration. The Ottawa domain-restricted key must not replace or be reused as a universal key for unrelated customer domains.
7. Incoming MX routing points mail to Resend, but ABEmail must still configure and verify the `email.received` webhook, validate signatures, retrieve message content as needed, map the recipient to an active tenant mailbox, and store it idempotently.
8. Current Vercel Production, Preview, and Development environments share the commercial Supabase project. Do not put the pilot's live sending key into Preview or Development. Environment isolation and the intended production release path must be reviewed before activating external sends.
9. Apply database migrations intentionally through the existing review workflow; do not run a new hosted migration as part of DNS setup.

## Pilot implementation deployed in commercial ABEmail

The production application includes a guarded operator setup endpoint, authenticated tenant-scoped send API, the shared live mailbox workspace, tenant-filtered message storage, and signed Resend webhook routes at:

- Setup: POST /api/pilot/ottawa-snow-match/setup
- Send: POST /api/mail/send (requires an authenticated browser session and a valid Idempotency-Key header)
- Resend webhook: POST /api/webhooks/resend (verify the exact Production URL in the Resend dashboard)

The setup endpoint creates or reuses the controlled ottawa-snow-match organization and its info@ mailbox only after the server checks the Resend domain status and sending/receiving capabilities. It is restricted to the comma-separated verified account emails in ABEMAIL_PILOT_OPERATOR_EMAILS. It does not create DNS records, reuse Waste2Light application keys, or trust a browser-provided sender domain.

Required server-only Production environment variables:
- ABEMAIL_RESEND_OTTAWA_SEND_API_KEY: Resend Sending access key restricted to the Ottawa pilot domain; used by the send endpoint only.
- ABEMAIL_RESEND_OTTAWA_RECEIVE_API_KEY: Resend Full access key required to read domain status and retrieve received message bodies. This is account-wide elevated access, not a receive-only key; keep it Production-only and do not reuse the reference application's key.
- ABEMAIL_RESEND_OTTAWA_WEBHOOK_SECRET: signing secret for the webhook created in the Resend dashboard.
- ABEMAIL_PILOT_OPERATOR_EMAILS: comma-separated exact email addresses of verified ABEmail accounts allowed to provision the pilot.
- SUPABASE_SECRET_KEY: required for server-only provisioning and provider writes.

Vercel does not apply database migrations automatically. The transport migration `20261017140000_tenant_mail_transport` and subsequent provider-onboarding migrations are already recorded in the Production Supabase history. The required Ottawa provider variables are registered for Production only; do not copy their values into Preview or Development.

The shared platform also supports persisted drafts, attachments, mailbox lifecycle controls, scheduled sends, branded HTML designs, and delivery-state updates. The Ottawa pilot has production inbound/outbound records. MCP tools remain a future integration milestone, not a prerequisite for the current web-mail pilot.

Preview and Development still point at the same Supabase project as Production. That is a data-isolation gap, even though the Resend send/receive credentials are Production-only; do not use Preview/Development for customer mail data until dedicated Supabase environments are configured.

## Delivery sequence

### 1. Provider boundary and sender authorization
- Add a server-only email provider interface and Resend driver.
- Resolve verified domain, mailbox, provider configuration, and user permissions server-side.
- Add audit events, per-organization send limits, and idempotency keys.
- Keep provider configuration isolated by tenant/domain and fail closed when a domain or credential is inactive.

### 2. First outbound test
- Provision the organization/domain/mailbox through the commercial application.
- Configure the domain-restricted Resend key as a server-side secret in the approved environment.
- Send one test message to an explicitly approved recipient.
- Verify the provider acceptance and delivery event, and check that the message record is visible only within the correct tenant.

### 3. Inbound and replies
- Configure the Resend receiving webhook on the commercial app.
- Verify the webhook signature against the raw request body before parsing it.
- Resolve recipients through the active mailbox/domain mapping, reject unknown recipients, and store provider events idempotently.
- Test replies to `info@ottawasnowmatch.waste2light.com` after webhook processing is connected.

### 4. Scheduled email automation
- Add durable tenant-scoped scheduled messages with list, cancel, reschedule, retry, and status features.
- Persist the organization, mailbox, and provider configuration reference on every job.
- Re-authorize the sender and provider configuration at execution time, so a suspended tenant or domain cannot send a queued job.

### 5. MCP connection
- Add a remote authenticated MCP server after the same send and schedule APIs are secured.
- Expose draft, send, schedule, list, cancel, reschedule, and delivery-status tools.
- Reuse the application authorization layer; an MCP call must not bypass tenant or mailbox permissions.
- Require confirmation or other policy controls for external send actions, and maintain actor/audit/idempotency records.

## Pilot acceptance criteria

- One commercial ABEmail application serves the pilot; no Ottawa-specific app/database is created.
- An active Ottawa Snow Match test organization can use only its verified domain and approved mailbox.
- One outbound test email can be sent and traced through provider acceptance and delivery status.
- Incoming email, once enabled, maps to the correct tenant mailbox and cannot be assigned by a client-provided organization ID.
- Cross-tenant access, unverified/suspended domain, missing send grant, invalid webhook signature, duplicate event, and cancelled schedule tests are covered.
- Waste2Light's existing reference app, domain records, database, keys, and deployment remain untouched.
- Real provider keys are not enabled in Preview or Development until environment isolation is demonstrated.
