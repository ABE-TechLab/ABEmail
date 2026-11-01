# Domain and Mail Readiness

## Current state — verified 2026-11-01

- Production application: [https://abemail.vercel.app](https://abemail.vercel.app). The deployment for merge commit `2b8d437` is READY.
- Commercial Supabase project: `jwtfrmzykevfwmjvratb`. All 22 migration files in `supabase/migrations` match the connected production project's recorded migration history; there are no repository-only or database-only migrations.
- Post-merge Application CI #991 passed lint, renderer tests, navigation contract, TypeScript, production build, isolated migration replay, and tenant/authorization tests.
- The Ottawa Snow Match tenant is active. Its `ottawasnowmatch.waste2light.com` domain is verified with sending and receiving enabled; two mailboxes are active; the workspace Resend connection is connected and has a webhook ID recorded.
- Production data for that tenant contains 9 inbound messages with status `received`, 11 outbound messages with status `delivered`, one outbound message with status `accepted`, and 33 provider events. This confirms the commercial app has processed real inbound and outbound pilot traffic; it is not merely a DNS verification.
- Vercel has the Ottawa send/receive keys, webhook signing secret, pilot operator allow-list, and scheduled-worker secret registered for Production. Their secret values were not read or copied. The Ottawa Resend credentials are not targeted to Preview or Development.
- **Environment isolation is still incomplete:** `NEXT_PUBLIC_SUPABASE_URL` and the publishable key target Production, Preview, and Development, and those environments currently use the same Supabase project. Preview/Development therefore share the Production data plane even though live Resend credentials are Production-only.
- Hosted Supabase Auth redirect/confirmation/reset email and custom SMTP are not yet verified end-to-end.
- `/demo` remains static sample mail; the authenticated workspace mailbox is served separately from production tenant data.

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

## Remaining release and platform work

- [ ] Choose an ABE TechLab-owned sender domain and provider for platform-level/authentication mail; the Ottawa customer subdomain is not a substitute for an ABE TechLab sender identity.
- [ ] Configure hosted Supabase Auth redirects/custom SMTP and test confirmation, password reset, invitation acceptance, expiry, and revocation.
- [x] Provision the Ottawa Snow Match organization, verified domain, and two active mailboxes through the guarded pilot setup flow.
- [x] Deploy tenant-scoped Resend sending, signed inbound/delivery webhooks, idempotency, provider event storage, and verified sender-domain checks.
- [x] Store inbound/outbound messages and attachments through tenant-scoped application storage and authorization paths.
- [ ] Isolate Preview and Development from Production. Create dedicated non-production Supabase targets, migrate schema without copying customer mail, then point Preview/Development at those projects and keep live provider credentials Production-only.
- [ ] Add reusable organization/platform audit events and durable per-organization usage/quotas before broad customer onboarding.
- [ ] Complete authenticated desktop/tablet/mobile smoke tests and periodic production provider/webhook health checks.
