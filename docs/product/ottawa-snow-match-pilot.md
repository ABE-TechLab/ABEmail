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

The operator reports that Resend has verified `ottawasnowmatch.waste2light.com` after the provider-issued records were added in Cloudflare. This is provider-dashboard evidence reported by the operator, not evidence that commercial ABEmail currently verifies or uses the domain.

The records supplied by Resend were for the subdomain only: DKIM TXT, two sending CNAME records, and an MX record for inbound delivery. Do not change the root `waste2light.com` MX records or copy the subdomain's DNS records into another tenant.

## Important status distinction

**Provider domain verification is complete; ABEmail email transport is not.**

The commercial repository currently has the multi-organization identity, organization-domain, mailbox, and mailbox-grant foundation. Its real email provider adapter and live send/receive flow are not yet end-to-end implemented. A verified provider domain does not automatically create an application mailbox, enable sending from the ABEmail UI, or connect incoming messages to the ABEmail database.

Do not describe the pilot mailbox as live until a test message has been sent and its delivery event has been recorded by the commercial application.

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
