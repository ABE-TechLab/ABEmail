# ABEmail Domain and Mail Workflow

Use this procedure for authentication email, domain ownership, DNS, mailbox provisioning, sending, receiving, provider webhooks, and mail routing. Read `docs/product/domain-and-mail-readiness.md` and `docs/architecture/email-provider-adapter.md` first.

## 1. Determine the domain purpose
- **Application domain:** `https://abemail.vercel.app`.
- **Authentication sender domain:** controlled by ABE TechLab and used by custom SMTP for confirmation/reset messages.
- **Customer mailbox domain:** owned or authorized by the customer receiving mailbox addresses.
These are distinct. Do not buy a domain or provision paid infrastructure without approval.

## 2. Verify ownership and provider
- Confirm the domain manager's authority and that the provider account belongs to commercial ABEmail, not the Waste2Light pilot.
- Obtain current TXT, DKIM, SPF, DMARC, and MX records from the chosen provider dashboard.
- Record source, required name/type/value, verification state, propagation expectation, and rollback.
- Review existing MX/TXT records. Never replace existing routing without an approved migration plan.

## 3. Configure authentication email
- Set hosted Supabase Auth Site URL and allow the exact production callback `https://abemail.vercel.app/auth/callback`.
- Configure custom SMTP on a verified ABE TechLab sender domain.
- Keep tokens and provider credentials out of logs and browser-visible variables.
- Test signup, confirmation, password reset/update, sign-in/out, invitation acceptance, expiry, and revocation.

## 4. Verify and provision domains/mailboxes
- Store pending domains under an authorized organization.
- Verify provider-side DNS ownership server-side; never trust a browser-supplied verified flag.
- Provision the domain only after provider verification. Create/activate mailboxes only after provider provisioning and routing checks pass.
- Every lookup, grant, send, schedule, retry, attachment, and inbound event must be authorized for the same organization/mailbox.

## 5. Enable safe live transport
- Resend is planned, not configured. Use a server-only provider adapter.
- Verify raw-body webhook signatures before parsing; process events idempotently.
- Keep bodies and attachments private; enforce authorization at server and database layers.
- Apply sender authorization, quotas, rate limits, retries, and abuse controls to immediate and scheduled mail.
- Test invalid signatures, unknown recipients, cross-tenant input, duplicate events, bounces/complaints, rate limits, outages, and rollback.

## Exit conditions
Do not mark a domain/mailbox live until provider state is verified, authorization tests pass, end-to-end delivery evidence exists, and operations/health documentation is current.
