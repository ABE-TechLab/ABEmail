# Ottawa Snow Match pilot go-live runbook

This runbook applies only to the commercial ABEmail app. Do not copy credentials, database details, or configuration from gODtECH-Ctl-Create/ABEmail-Mail.

## Production configuration

After reviewing and merging the pilot transport pull request, apply the new migration `20261017140000_tenant_mail_transport.sql` to the commercial Supabase project through the project's approved migration workflow. Vercel does not apply database migrations on deploy. Confirm the four existing foundation migrations are present before applying it.

In **Vercel Production only**, configure these server-side variables and redeploy:

- `ABEMAIL_RESEND_OTTAWA_SEND_API_KEY`: a Resend **Sending access** key restricted to `ottawasnowmatch.waste2light.com`. The outbound endpoint uses only this key to send.
- `ABEMAIL_RESEND_OTTAWA_RECEIVE_API_KEY`: a Resend **Full access** key, required by Resend's current domain-status and inbound-message retrieval APIs. This is elevated account-wide access, not a domain-restricted receive-only key. Keep it Production-only and only in this product; do not reuse the Waste2Light key or credentials.
- `ABEMAIL_RESEND_OTTAWA_WEBHOOK_SECRET`: the signing secret for the webhook registered in Resend.
- `ABEMAIL_PILOT_OPERATOR_EMAILS`: comma-separated list of exact, verified ABEmail login email addresses allowed to provision the pilot.
- `SUPABASE_SECRET_KEY`: Supabase server-side secret key used by the app's privileged mail operations.

Never place these in `NEXT_PUBLIC_*` variables. Preview and Development currently share the Production Supabase database; do not add the live Resend key to those environments.

## Provision the pilot workspace

1. Sign in to the commercial ABEmail production app with an email included in `ABEMAIL_PILOT_OPERATOR_EMAILS`.
2. Open any workspace where your account is an owner or administrator.
3. Select **Set up Ottawa pilot**. The server checks Resend's record for `ottawasnowmatch.waste2light.com` and requires the provider to report verified sending and receiving capabilities before it creates or activates the pilot tenant, domain and `info@ottawasnowmatch.waste2light.com` mailbox.
4. On success, use the **Ottawa Snow Match mail** inbox. If setup fails, follow the explicit server message; do not manually mark a domain verified to bypass a failed check.

The setup endpoint does not create DNS records or change root-domain MX records. If the provider reports receiving disabled, check the Resend domain's receiving capability and provider-issued DNS instructions first.

## Configure the Resend webhook

In Resend, register this public URL:

`https://abemail.vercel.app/api/webhooks/resend`

Subscribe to `email.received` and the outbound delivery events `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, and `email.suppressed` where available. Copy that webhook's signing secret into the Production-only `ABEMAIL_RESEND_OTTAWA_WEBHOOK_SECRET` variable, then redeploy. Do not paste the secret into a chat, issue, or source file.

## End-to-end smoke test

1. Open the pilot inbox and send a one-recipient plain-text test to an address you control.
2. Confirm the route reports provider acceptance and the Sent view records the message.
3. Check Resend for the send and delivery event; confirm the message status updates after the signed webhook arrives.
4. From the receiving test address, reply to `info@ottawasnowmatch.waste2light.com`.
5. Confirm `email.received` reaches the deployed handler, that the inbox row appears, and that its sender, recipient, body, and timestamp look correct.
6. Sign in as a different organization member without an assigned mailbox grant; confirm the other tenant's mail is not visible and sending from the Ottawa mailbox is denied.
7. Review `/health`. It reports whether environment variables are present, not whether Resend delivery is healthy.

## Pilot scope and stop conditions

The first slice supports a single recipient, plain text, one approved sender, a 25-message rolling 24-hour workspace cap, provider idempotency, delivery status updates, and text/HTML body retrieval for inbound email. Attachments, scheduling, generic customer domains, generic provider settings, and Model Context Protocol (MCP) tools are not included yet.

Stop the pilot if domain status/capability checks fail, the webhook signature fails, the inbox stores an unrecognized domain, the tenant isolation tests fail, or the provider key is present in Preview/Development. Do not claim live mail is ready until a real outbound **and** inbound test both succeed.
