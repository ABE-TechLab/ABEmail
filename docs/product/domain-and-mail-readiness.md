# Domain and Mail Readiness

## Current state
- Application URL: [https://abemail.vercel.app](https://abemail.vercel.app).
- Commercial Supabase project: `jwtfrmzykevfwmjvratb`; four foundation migrations are applied.
- Vercel Production, Preview, and Development have the public Supabase URL/key, but currently share the same Supabase project.
- Email/password auth and organization/invitation code exist, and tenant isolation is tested in CI.
- Hosted Auth URL and confirmation/reset email are not verified end-to-end. Custom SMTP is not configured.
- Resend is planned but not configured. No domain is verified, mailbox provisioned, or live email sending/receiving proven.
- `/demo` shows static sample mail.

## Three separate domain decisions
1. **Application domain:** `abemail.vercel.app` is sufficient for internal application testing; a branded domain is optional until public launch.
2. **Authentication sender domain:** ABE TechLab needs a controlled verified sender domain and custom SMTP for reliable confirmation/password-reset messages.
3. **Customer mailbox domain:** the customer must own or authorize the domain and the selected provider must provision mail routing.

## Hosted authentication settings to finish
In the hosted commercial Supabase Auth URL configuration:
- Site URL: `https://abemail.vercel.app` until a branded application domain is chosen.
- Allowed callback: `https://abemail.vercel.app/auth/callback`.
- Local redirects if needed: `http://localhost:3000/**` and `http://127.0.0.1:3000/**`.
- Configure custom SMTP and test confirmation, reset, invitation acceptance, expiry, and revocation.
- Keep Google OAuth disabled until a real OAuth client/callback setup exists.

Local `supabase/config.toml` does not update hosted Auth settings. References: [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## DNS safety
Request current DNS values from the selected provider; do not guess or reuse Waste2Light values.
- Verify ownership with provider-issued TXT records.
- Configure provider-specified DKIM (DomainKeys Identified Mail) and SPF (Sender Policy Framework).
- Apply an appropriate DMARC (Domain-based Message Authentication, Reporting, and Conformance) policy after sender alignment is checked.
- Configure MX (Mail Exchange) records only when required for the selected inbound setup and approved by the domain owner.
- Record verification evidence and rollback steps.

**Never overwrite existing customer MX records without an approved migration plan.** Review [Resend domain authentication](https://resend.com/docs/dashboard/domains/introduction) and [Resend inbound](https://resend.com/features/inbound); take actual DNS records from the real provider dashboard.

## Remaining implementation before live mail
- [ ] Choose an ABE TechLab-owned sender domain and provider.
- [ ] Configure hosted Supabase Auth redirects/custom SMTP and test live email.
- [ ] Add authorized organization domain setup and server-side provider/DNS verification.
- [ ] Provision actual mailboxes only after provider verification.
- [ ] Implement server-only send, signed inbound webhooks, idempotency, retries, delivery events, quotas, and abuse controls.
- [ ] Store messages/attachments privately with tenant-bound authorization.
- [ ] Isolate Preview/Development from Production.
- [ ] Test sending and receiving in an isolated tenant before external launch.
