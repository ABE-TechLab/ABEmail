# ABEmail

**ABEmail is ABE TechLab's commercial business email workspace.** It is being built as a multi-organization Software as a Service (SaaS) product, not as a deployment dedicated to a single customer.

> **Status:** Foundation work. This repository is public, but the software remains proprietary under the root `LICENSE` file and is not yet a customer-ready service.

## Product direction

Give each customer organization an isolated email workspace where its authorized team can use shared business mail capabilities, while ABE TechLab manages platform operations from a separate control plane.

### First release goals

- Platform-controlled organization onboarding and tenant lifecycle.
- Organization owner, administrator, and member access with invitations.
- Tenant-scoped mailboxes, inbox views, sent mail, drafts, contacts, attachments, and scheduled messages.
- Configurable sender domains and mailbox access.
- An email-provider adapter, with Resend as the first planned provider.
- Organization settings and an ABE TechLab platform-operations console.
- Auditing, health/usage visibility, abuse controls, and reliable provider webhook processing.
- ABE TechLab Design System integration for shared theme tokens and visual consistency.

Billing, self-service signup, advanced retention policies, and additional email providers should follow the secure core rather than delay it.

## Repository boundaries

- **Commercial product:** this repository, `ABE-TechLab/ABEmail`.
- **Single-organization reference/pilot:** `gODtECH-Ctl-Create/ABEmail-Mail`, currently used for Waste2Light.

The Waste2Light deployment is a working reference for product behavior, not the commercial product's production environment. Do not reuse its tenant-specific domain checks, data, secrets, database, provider configuration, deployment, or operational controls as commercial defaults. Do not deploy this repository over the Waste2Light app.

## Initial architecture

- **Application:** Next.js App Router, React, TypeScript.
- **Identity:** Supabase Auth.
- **Data:** Supabase Postgres with Row Level Security (RLS) on all exposed tenant data.
- **Email:** provider adapter with Resend as the first planned driver.
- **Hosting:** Vercel after a separate commercial project/environment is provisioned.
- **Design:** ABE TechLab Design System theme tokens, vendored with license and third-party notices.

The provider, application, and data layers must be independently configurable so that transport, hosting, or user interface choices are not embedded in tenant/business rules.

## Non-negotiable security rules

1. Every customer-owned row is associated with an organization and authorized through an explicit membership check.
2. Tenant isolation is enforced in Postgres with RLS and verified by allow/deny tests; filtering only in the user interface is not sufficient.
3. Platform-operator privileges are separate from customer organization roles and are audited.
4. Service-role keys, Resend keys, webhook signing secrets, and other provider credentials remain server-side. Never place secrets in `NEXT_PUBLIC_*` variables or browser bundles.
5. Customer provider credentials, if introduced, must be stored through a controlled secret-storage mechanism and never in plaintext tenant settings.
6. Inbound webhooks are signature-verified and processed idempotently.
7. Mail sending is rate-limited and guarded by organization/domain authorization, quotas, and abuse controls.
8. Do not point development or preview environments at live customer data or production email credentials.

## Multi-organization access and authentication

One ABEmail identity can belong to multiple organizations. Membership roles are scoped per organization, and each organization can grant access to different mailbox addresses. After sign-in, the dashboard is the organization chooser; it lists active organizations and only the mailboxes visible through the authenticated user's organization role or mailbox grants. Opening an organization verifies active membership server-side, and Postgres RLS remains the authority for data access. Owning one organization does not grant access to another.

The initial rollout uses email and password. Google sign-in and account linking remain available in code but are hidden unless `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true` is explicitly set after Google OAuth and redirect URLs are configured in Supabase Auth. Keep the flag false for the email/password-only launch. Domain verification, mailbox provisioning, and real message transport still require separate implementation and configuration.

## Development

Requirements: Node.js 22 or newer and npm.

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:3000`. The non-sensitive application readiness endpoint is available at `/health`.

Validation commands:

```bash
npm run lint
npm run typecheck
npm run build
```

The root route sends unauthenticated visitors to email/password sign-in. After sign-in, a user with one active organization opens that workspace directly; users with multiple active organizations see a workspace chooser. If Supabase is not configured locally, it falls back to the public landing screen at `/welcome`. The original illustrative mailbox remains available at `/demo`; it contains static sample messages only and is not connected to live mail transport. Authentication routes are available at `/auth/sign-in`, `/auth/sign-up`, `/auth/forgot-password`, and `/auth/update-password`. The authenticated organization dashboard is at `/dashboard`; new owners complete setup at `/onboarding`; owners/admins manage invitations at `/settings/team`; users manage sign-in methods at `/settings/account`. Invitations create one-time links that expire after seven days. Invited users can sign in with the invited email/password or Google if the provider is configured; administrators can assign active mailboxes and optionally allow the mailbox address as an alternate password-login alias. Alias sign-in resolves privately on the server and requires the server-only `SUPABASE_SECRET_KEY`. The four foundation migrations are applied to the current commercial Supabase project; future migrations require review and intentional application. Vercel Production, Preview, and Development currently reference the same commercial Supabase database, so environment isolation remains incomplete. Hosted Auth URL/SMTP delivery, DNS verification, mailbox provisioning, invitation email delivery, and live mail sending/receiving are not configured end to end. Do not use this foundation with real customer data or live email credentials. Vercel does not apply database migrations automatically.

## Authentication and environment setup

The production Vercel project has the commercial Supabase URL and publishable key configured. These values are browser-safe; never put a Supabase secret key, SMTP credential, provider API key, or webhook secret into a `NEXT_PUBLIC_*` variable.

Before relying on confirmation or password-reset email, complete the **hosted** Supabase Auth settings:
1. Site URL: `https://abemail.vercel.app` until a branded application domain is selected.
2. Allowed callback: `https://abemail.vercel.app/auth/callback`.
3. Local redirects when needed: `http://localhost:3000/**` and `http://127.0.0.1:3000/**`.
4. Configure custom SMTP (Simple Mail Transfer Protocol) on an ABE TechLab-controlled sender domain; test sign-up confirmation, password reset, and invitation acceptance against the deployed application.

The local `supabase/config.toml` does not change hosted Auth URL settings. See [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) and [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Google sign-in stays disabled until OAuth credentials and callback configuration exist.

## Domain and live mail readiness

The app domain and customer mailbox domains are separate. `abemail.vercel.app` is enough for application development. Real Auth email needs a verified ABE TechLab-controlled sender domain and custom SMTP. A customer mailbox such as `person@customer-domain.com` also requires the customer to own or authorize that domain and the chosen provider to provision routing. Resend transport is still not active in commercial ABEmail. The operator reports provider-side domain verification for the Ottawa Snow Match pilot, but the commercial app has not yet proven live sending or receiving. Read [Domain and Mail Readiness](docs/product/domain-and-mail-readiness.md) and the [Ottawa Snow Match Controlled Mail Pilot](docs/product/ottawa-snow-match-pilot.md) before DNS changes or live-email claims.

## gODtECH FORGE orchestration

This repository vendors the complete **gODtECH FORGE 0.7.0 portable operating framework**, pinned to [source commit 976a19af7ade19551f464c218e6d5535735f6c29](https://github.com/gODtECH-Ctl-Create/gODtECH-FORGE/commit/976a19af7ade19551f464c218e6d5535735f6c29). The full `.forge/` tree contains upstream intelligence modules, policies, workflows, schemas, templates, and verification guidance. `AGENTS.md` merges the canonical agent contract with ABEmail's tenancy and production rules. `.mcp.json` describes the separate FORGE MCP server; `.github/copilot-instructions.md` gives agents another entry point.

The FORGE CLI/MCP server is installed separately by design. Follow [FORGE setup for ABEmail](docs/engineering/forge-setup.md), then run:

```bash
forge doctor
forge validate --strict
forge prepare --task "Describe the next verified ABEmail task"
forge plan --task "Describe the next verified ABEmail task"
forge run start --task "Describe the next verified ABEmail task"
forge run status
```

Project-specific status, risks, and next work are stored in `.forge/state.md`, `.forge/context/project.yaml`, and `.forge/context/handover.md`. Keep them aligned with the README, roadmap, decisions, and `.godtech/project.yml`.

Built with gODtECH FORGE — Framework for Orchestrated Reasoning, Governance & Engineering.

## Initial delivery milestones

1. Product requirements and tenant/security architecture.
2. Runnable application foundation and environment validation.
3. Organization membership, invitations, onboarding, and tenant authorization.
4. Mail provider abstraction and one end-to-end test tenant.
5. Core mailbox workflows carried over with explicit tenant ownership.
6. Platform operations, domains, usage limits, and auditability.
7. Preview validation, security tests, operational runbooks, and controlled launch.

See `docs/product/commercial-mvp.md` and `docs/architecture/tenant-boundaries.md` for the working specifications.

## Shared design system and themes

ABEmail includes a locally vendored snapshot of the ABE TechLab Design System's ten official CSS theme palettes under `styles/vendor/`. This removes the private GitHub Packages authentication requirement during local setup and CI while preserving the upstream MIT license and third-party notices alongside the stylesheet. Palette IDs are maintained in `lib/design-system.ts` and remain aligned with the upstream catalogue.

The Appearance settings page provides a native palette selector for Claude, Discord, Supabase, Vercel, Mono, Notebook, Light Green, Zen, Astro Vista, and WhatsApp. You can also choose Light, Dark, or System mode. Palette and explicit Light/Dark mode preferences are stored in browser cookies so the root page can render saved choices on the server. System mode follows the device preference after client initialization.

To synchronize palettes after an upstream design-system release, copy the theme CSS from [ABE TechLab Design System](https://github.com/ABE-TechLab/ABE-TechLab-Design-System/tree/main/styles/themes) into the vendored stylesheet and retain its license/notice files. ABEmail-specific layouts and components remain in this repository.
