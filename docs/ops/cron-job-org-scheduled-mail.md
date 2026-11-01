# Scheduled Email Worker: cron-job.org

ABEmail uses an external scheduler for the scheduled-email worker. Do not add this endpoint to `vercel.json` Cron Jobs; the project must be able to run on Vercel Hobby.

## Configure the job

Create a cron job in [cron-job.org](https://cron-job.org/) with these settings:

- **Title:** ABEmail scheduled mail worker
- **URL:** `https://abemail.vercel.app/api/cron/mail-scheduled`
- **Request method:** `POST`
- **Schedule:** every 5 minutes
- **Request header:** `Authorization: Bearer <the exact secret configured in Vercel>`
- **Request body:** empty
- **Failure notifications:** enabled
- **Save responses:** enabled during initial verification; disable later if responses are no longer needed for troubleshooting.

The worker accepts `CRON_SECRET` or `ABEMAIL_SCHEDULED_MAIL_CRON_SECRET`, and checks for an exact `Authorization: Bearer <secret>` header. Prefer the dedicated `ABEMAIL_SCHEDULED_MAIL_CRON_SECRET`.

The same worker handles both plain-text and designed messages. Designed jobs carry validated versioned blocks and a snapshot of the workspace Brand Profile. The worker renders HTML and plain text on the server and stores the rendered payload in the message ledger before provider submission; retries reuse that stored render. The scheduled payload and brand snapshot are immutable after creation. Designed scheduling requires a connected workspace Resend connection and a verified sending-enabled domain.

## Configure the secret

In the Vercel project that serves `abemail.vercel.app`, add `ABEMAIL_SCHEDULED_MAIL_CRON_SECRET` as a **Sensitive** environment variable targeting **Production** only. Use a randomly generated secret with at least 32 bytes of entropy. Enter the exact same value in cron-job.org's custom `Authorization` header; do not commit it or put it in a URL/query string.

Redeploy Production after creating/changing the environment variable so the worker runtime picks it up. Do not share the value in source control or logs.

## Verify without sending test mail

The base scheduled-mail migration (`20261019034340_scheduled_email_messages.sql`) and designed-scheduling migration (`20261101104700_designed_email_scheduling.sql`) are applied to the commercial Production database. The latter version matches Supabase's recorded migration history. Vercel has the dedicated cron secret variable registered for Production only. A scheduled test message was processed and reached provider delivery status; the user-facing Scheduled workflow and the worker were included in the passing post-merge CI run.

A healthy idle run should return HTTP 200 with JSON similar to `{"ok":true,"processed":0,"results":[]}`. A 401 means the Authorization header and Vercel secret do not match. A 503 indicates storage, database, or queue-claim configuration needs attention.

## Operational safeguards

- Keep `ABEMAIL_SCHEDULED_MAIL_CRON_SECRET` scoped to Vercel Production only.
- Do not paste the secret into a URL, repository, issue, or support message.
- The worker rechecks organization, mailbox, domain, and provider status at execution time. Immediately before provider submission it also rechecks that the scheduling user still has active organization membership and either owner/admin authority or an active mailbox `can_send` grant. Revoked access permanently fails the pending job with `SCHEDULED_CREATOR_ACCESS_REVOKED`.
- It claims due jobs through the database RPC, enforces provider idempotency, persists one delivery row per recipient, derives the message-level status from recipient outcomes, and reuses the stored HTML/plain-text render on retries.
- If the worker returns 401, compare the cron-job.org Authorization header against the Production-only Vercel variable without disclosing either value. A 503 indicates the queue, database, or provider setup needs investigation.
- Do not assume that Vercel log absence proves the cron job ran; on the Hobby plan, retained runtime logs are limited. Confirm runs through cron-job.org response history and scheduled-message/provider records.
