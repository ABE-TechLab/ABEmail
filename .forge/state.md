# Commercial ABEmail — FORGE Project State

> Last updated: 2026-10-17. Re-check live GitHub, Supabase, and Vercel state before relying on this snapshot.

## Current stage
Secure multi-tenant foundation. Authentication and organization access code exists, but this is not yet a live email-hosting service.

## Verified completion
- Commercial repo is `ABE-TechLab/ABEmail`; keep separate from `gODtECH-Ctl-Create/ABEmail-Mail`, the Waste2Light single-organization reference.
- PR #13 merged as `7659b58879cd73ca510472cdf4c74cb4edf2fdbd`: invitation-role escalation fix, disposable two-tenant PostgreSQL tests, and database test CI.
- PR #14 merged as `4f9f5a12ebcd0b067dfa0f0c251fed599d9e30ab`: root routes to sign-in/dashboard, public landing remains at `/welcome`, static demo inbox is at `/demo`.
- Baseline CI passed lint, type-check, production build, isolated Supabase setup, and tenant-isolation tests.
- Commercial Supabase project `jwtfrmzykevfwmjvratb` is active; migrations `20261013203000`, `20261013213000`, `20261013223000`, and `20261014100000` were listed as applied.
- Vercel public Supabase URL and publishable key are configured for Production, Preview, and Development, but all currently point to one Supabase project.
- The last checked deployment was Ready at `https://abemail.vercel.app`; re-check current deployments before calling it latest.
- Email/password auth, callbacks, reset/update, sign-out, onboarding, workspace selection, invitations, roles/membership checks, and mailbox grants exist in code. Google OAuth remains disabled.
- The complete FORGE 0.7.0 portable framework is merged into `main` by [PR #17](https://github.com/ABE-TechLab/ABEmail/pull/17), merge commit `a7a45aa2a88f89ead3fa72b398d3cb7dfb00d321`, pinned to upstream source commit `976a19af7ade19551f464c218e6d5535735f6c29`.
- FORGE validation passed in [run 38601261300](https://github.com/ABE-TechLab/ABEmail/actions/runs/38601261300). Application CI, including isolated tenant authorization SQL tests, passed on the PR head in [run 38601261239](https://github.com/ABE-TechLab/ABEmail/actions/runs/38601261239).

## Product routes
- `/`: directs signed-out users to sign-in and signed-in users to dashboard when Supabase is configured.
- `/welcome`: public development/product landing page.
- `/demo`: static illustrative mail only, not connected to live transport.
- `/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`, `/auth/update-password`, `/auth/callback`: authentication routes.
- `/dashboard`: organization chooser.
- `/dashboard/[organizationId]`: organization view with membership verification.
- `/onboarding`: create an organization for a verified signed-in account.
- `/settings/team`: invitations and mailbox assignment; invite URLs are copied/shared manually.
- `/settings/account`: account sign-in settings.

## Unfinished / release blockers
- Hosted Supabase Site URL/allowed callback settings and real confirmation/reset email have not been proven end-to-end.
- Custom SMTP is not configured; invitation email is not automatic.
- The operator reports that Resend domain verification completed for the Ottawa Snow Match pilot subdomain on 2026-10-17. Commercial ABEmail still has no application-side domain verification, active provider adapter, mailbox provisioning, outbound/inbound delivery, provider webhooks, attachments, or message storage. ABE TechLab's separate authentication-email sender domain remains unselected.
- Platform operator separation, tenant lifecycle control, full audit logging, send limits, and runbooks remain incomplete.
- Supabase advisor warned about executable SECURITY DEFINER invitation functions; review deliberately, preserving safe invitation acceptance.
- Preview and Development use the Production Supabase project. Do not load real customer data there until isolation is established.

## Domain distinction
`abemail.vercel.app` is the app URL; it is not permission to provision email on arbitrary domains. The authentication sender domain and each customer mailbox domain are separate decisions. Use records supplied by the actual provider dashboard, and never overwrite existing MX records without an approved migration plan.

## Next sequence
1. Validate the full FORGE framework, schema, CLI setup, MCP config, and context-aware CI.
2. Complete hosted Auth redirect/custom SMTP configuration; test signup, confirmation, reset, sign-out, invitation expiry, acceptance, and revocation.
3. Keep the ABE TechLab authentication-email sender domain decision separate from customer mailbox domains.
4. Implement tenant-scoped Resend transport and the Ottawa Snow Match controlled pilot tracked in [issue #21](https://github.com/ABE-TechLab/ABEmail/issues/21); provider-side domain verification does not mark the app live.
5. Implement verified domain/mailbox provisioning, signed inbound webhooks, idempotent delivery events, send authorization, quotas, and tenant-safe storage.
6. Separate Preview/Development data from Production and complete operational readiness before customer invitations.

## Rules
- Do not reuse Waste2Light data, secrets, domains, database, provider account, or deployment.
- Do not buy domains, create paid resources, change live DNS, or apply hosted migrations without explicit approval.
- A domain/mailbox database row is not proof of provider provisioning. Do not claim live mail until end-to-end tests pass.
- Keep state, context, README, roadmap, decisions, and `.godtech/project.yml` aligned after material verified changes.
