# AI Handover — Commercial ABEmail

## Read order
1. `AGENTS.md` for project and security boundaries.
2. `.forge/state.md` for verified progress and blockers.
3. `.forge/context/project.yaml` for structured project facts and risks.
4. `README.md` and `docs/roadmap/implementation-plan.md` for product status.
5. For mail/domain work: `.forge/workflows/DOMAIN-AND-MAIL.md`, `docs/product/domain-and-mail-readiness.md`, and `docs/architecture/email-provider-adapter.md`.
6. For authorization: `.forge/intelligence/SECURITY.md` and `docs/architecture/tenant-boundaries.md`.
7. For delivery: `.forge/workflows/GIT.md` and `.forge/policies/AI-EFFICIENCY.md`.

## Verified baseline
Snapshot 2026-10-14; last observed main baseline before FORGE work was `4f9f5a12ebcd0b067dfa0f0c251fed599d9e30ab`. PR #13 and PR #14 were merged. Baseline CI passed lint, type-check, build, and tenant isolation. Re-check live state.

Commercial Supabase project ref: `jwtfrmzykevfwmjvratb`; four foundation migrations are already applied. Do not reapply them. Vercel `abemail` previously had a Ready deployment at `https://abemail.vercel.app`; re-check first.

## Avoid these assumptions
- Auth routes in code do not prove confirmation/reset messages can reach a real inbox.
- Supabase public environment variables do not prove hosted Auth redirects or SMTP are correct.
- An application status row does not prove provider-side DNS verification.
- A mailbox row is not live until the provider provisions it and inbound/outbound tests succeed.
- `/demo` contains static sample mail only.
- The app domain is not a customer email domain.
- Never import Waste2Light secrets, domains, customer data, database, or provider configuration.

## FORGE procedure
Install the separate CLI according to `docs/engineering/forge-setup.md`, then use `forge doctor`, `forge validate --strict`, `forge prepare --task "..."`, `forge plan --task "..."`, and persistent `forge run` commands. Root `.mcp.json` expects `forge` on `PATH`; it is not the CLI itself. Load task-relevant intelligence/workflows and preserve human approval gates.

After material verified changes, update `.forge/state.md`, `.forge/context/project.yaml`, decisions, README, roadmap, and `.godtech/project.yml`. Keep canonical framework policy separate from project-owned context.
