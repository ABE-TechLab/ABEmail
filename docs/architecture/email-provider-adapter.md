# Email Provider Adapter

## Goal

Keep tenant and mailbox business rules independent from the vendor that sends, receives, or reports email. Resend is the first planned driver because the existing reference app already uses it and its current product supports outbound email, inbound email events, and webhook-based delivery events. This repository still needs its own provider project/configuration and end-to-end validation.

Relevant provider references:
- Resend API: https://resend.com/docs/api-reference/introduction
- Resend inbound email: https://resend.com/features/inbound
- Resend webhooks: https://resend.com/features/webhooks

## Application-facing capability contract

Create an internal server-only interface under a path such as `lib/email/providers/types.ts`. Keep these operations narrow and explicit:

- `sendMessage(input)`: send from an already-authorized, verified mailbox; return normalized provider ID/status or a typed provider error.
- `verifyDomain(input)` / `getDomainStatus(input)`: create/check provider domain configuration and normalize verification state.
- `verifyWebhook(request)`: verify provider-specific signatures using the raw request payload and headers before parsing/processing.
- `normalizeInboundEvent(event)`: return a provider-neutral event with provider/event IDs, normalized recipients/senders, headers, body references, attachment references, timestamps, and metadata that is safe to log.
- `normalizeDeliveryEvent(event)`: map provider statuses into the app's canonical delivery lifecycle.
- `getReceivedMessage` / `getReceivedAttachment` only when required by the provider's receiving API.

Use discriminated result types for transient, rejected, rate-limited, invalid-configuration, and permanent errors. Do not leak vendor SDK types into database or UI contracts.

## Canonical event lifecycle

Normalize provider-specific details to a stable internal vocabulary:
- inbound accepted / processing / stored / rejected;
- outbound queued / accepted / delivered;
- delayed / bounced / complained / suppressed / failed;
- provider event received / verified / duplicate / processed / failed.

Preserve the raw provider identifier and a minimized copy of operational metadata for support. Avoid dumping raw message bodies, attachments, signing secrets, or API credentials into logs.

## Tenancy and routing rules

- The provider callback route validates the provider signature before trusting the event.
- Resolve inbound recipients to an active mailbox and domain in the commercial database. Tenant context comes from that trusted mapping, not an event-supplied organization ID.
- Enforce unique provider event identifiers so retries are idempotent.
- Sending code resolves the authorized mailbox using verified identity and organization/mailbox membership before calling the provider.
- Domain verification and tenant sending limits are checked server-side for every sending path, including scheduled jobs and retry flows.
- All async jobs carry an internal organization/mailbox reference created by the application; do not treat queue payload fields alone as authorization.
- Keep provider keys and webhook secrets outside the repository, browser bundle, client-visible settings, and ordinary application logs.

## Initial Resend driver

Use the Resend driver behind this interface for the first controlled test tenant. Do not copy the Waste2Light API key, webhook secret, domains, Supabase project, or configuration. Create separate commercial provider configuration after the product's environment and resource costs are explicitly approved.

Before activating live sending:
- verify sender domain and DNS routing;
- test signature failure rejection;
- test duplicate, delayed, bounced, and failed event handling;
- test inbound recipients with multiple tenants and unknown/disabled mailbox addresses;
- set per-tenant rate limits and platform safety limits;
- verify attachment paths and tenant authorization;
- prove that provider failures do not leak details to unrelated tenants.

## Ottawa pilot transport (initial implementation)

The pilot-only implementation lives in lib/email/resend-pilot.ts and intentionally rejects any sender domain other than ottawasnowmatch.waste2light.com. The authenticated send route resolves the sender from the selected active mailbox, checks active organization membership and mailbox send permission, checks the app-side verified-domain record on every request, uses only the domain-restricted sending key for delivery, records an idempotency fingerprint, enforces a conservative daily cap, and stores the provider response. The request cannot supply a From address.

The Resend webhook route uses the raw request body and Svix headers (svix-id, svix-timestamp, svix-signature) for signature and replay-window checks before JSON parsing. It deduplicates the provider event, retrieves inbound content from Resend, resolves recipients from active domain/mailbox rows, stores only the pilot's recognized messages, and updates outbound delivery states for the exact pilot sender. The database gives signed-in users read access only to messages in active mailboxes permitted by tenant role or mailbox grant; provider event rows are service-only.

This is deliberately not a general customer-provider-configuration UI. The first route and credential selector are allow-listed for one pilot domain. Do not remove that allow-list or make it dynamic from client input until a reviewed per-tenant provider configuration and secret-reference model exists.

## Future providers

Add a driver only when a concrete customer/product requirement exists. Potential future directions include customer-managed provider credentials, SMTP relays, or integrations with third-party mailbox hosts. Do not promise Gmail/Google Workspace/Microsoft 365 inbox synchronization through the send/receive adapter alone; those integrations have different OAuth, synchronization, folder, and lifecycle requirements.
