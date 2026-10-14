# Decision 0003 — Email/password-first launch and delayed live mail

- Date: 2026-10-14
- Status: accepted
- Decision: Keep email/password as the first sign-in method. Keep Google OAuth disabled until credentials/callbacks are deliberate. Keep business mail transport disabled until sender domain, provider, DNS, and end-to-end checks are complete.
- Context: Auth and multi-tenant authorization code exists; four foundation migrations are applied. Hosted Auth URL/SMTP has not been proven end-to-end, and business mail remains disconnected.
- Alternatives: Enable Google immediately; advertise static demo content as live mail; activate mailboxes before provider provisioning; reuse Waste2Light credentials.
- Rationale: Allow internal testing without claiming full service or exposing customer/provider data.
- Consequences: Use `abemail.vercel.app` as interim app URL. Auth sender and customer mailbox domains are separate. Use provider-issued DNS records and never overwrite existing MX records without an approved migration.
