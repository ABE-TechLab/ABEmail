# Domain and Mail Readiness

## Current state
- Application URL: [https://abemail.vercel.app](https://abemail.vercel.app).
- Commercial Supabase project: `jwtfrmzykevfwmjvratb`; four foundation migrations are applied.
- Vercel Production, Preview, and Development have the public Supabase URL/key, but currently share the same Supabase project.
- Email/password auth and organization/invitation code exist, and tenant isolation is tested in CI.
- Hosted Auth URL and confirmation/reset email are not verified end-to-end. Custom SMTP is not configured.
- The operator reports Resend domain verification completed for the Ottawa Snow Match subdomain `ottawasnowmatch.waste2light.com`. Commercial ABEmail has not yet been configured to use that domain; no commercial-app mailbox has been provisioned, and live send/receive is not proven.
- `/demo` shows static sample mail.

## Controlled Ottawa Snow Match pilot

Ottawa Snow Match is the first proposed test organization for the commercial ABEmail platform, with planned sender `info@ottawasnowmatch.waste2light.com`. Resend's dashboard reports the domain verified after its provider-issued DKIM TXT, sending CNAME, and receiving MX records were added under the existing `waste2light.com` zone in Cloudflare. The verification status is operator-reported and does not prove that the commercial application can send or receive mail. The root `waste2light.com` MX records must remain unchanged. See [Ottawa Snow Match Controlled Mail Pilot](ottawa-snow-match-pilot.md) for the implementation sequence and acceptance criteria.

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
