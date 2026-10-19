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

## Configure the secret

In the Vercel project that serves `abemail.vercel.app`, add `ABEMAIL_SCHEDULED_MAIL_CRON_SECRET` as a **Sensitive** environment variable targeting **Production** only. Use a randomly generated secret with at least 32 bytes of entropy. Enter the exact same value in cron-job.org's custom `Authorization` header; do not commit it or put it in a URL/query string.

Redeploy Production after creating/changing the environment variable so the worker runtime picks it up. Do not share the value in source control or logs.

## Verify without sending test mail

Use cron-job.org's **Test run** only after the migration for `scheduled_email_messages` has been applied to the intended production database and the required environment variables are present. Before then, the authenticated request may return a storage/configuration error, and no real delivery test should be attempted.

A healthy idle run should return HTTP 200 with JSON similar to `{"ok":true,"processed":0,"results":[]}`. A 401 means the Authorization header and Vercel secret do not match. A 503 indicates storage, database, or queue-claim configuration needs attention.

## Release prerequisites

The scheduled-email migration remains un-applied until the coordinated release window. Do not enable this cron job or test a live scheduled send before that migration and the required production configuration have been verified.
