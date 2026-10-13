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

The root route opens directly into a mailbox-first development workspace with sample messages. The original landing screen is preserved at `/welcome`. A dedicated responsive contacts directory is available at `/contacts`. Workspace settings are available at `/settings`, with General, Appearance, Mail & Compose, Notifications, Team & Access, Domains, Mailboxes, and Security sections. Search, message actions, contact editing, and preview settings are local browser interactions only. Authentication, database connectivity, tenant authorization, persistent storage, and email transport are intentionally not configured yet. No real invitations, DNS checks, or email sends are performed. Do not use this build with customer data or live email credentials.

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
