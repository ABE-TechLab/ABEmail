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
Snapshot 2026-10-14. PR #13 (tenant/invitation security), PR #14 (auth-first entry route), and PR #17 (full FORGE integration) are merged. Current main includes merge commit `a7a45aa2a88f89ead3fa72b398d3cb7dfb00d321`. FORGE validation passed in [run 38601261300](https://github.com/ABE-TechLab/ABEmail/actions/runs/38601261300); application lint, type-check, production build, isolated database startup, and tenant-isolation tests passed on the PR head in [run 38601261239](https://github.com/ABE-TechLab/ABEmail/actions/runs/38601261239). Re-check live state before acting.

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
