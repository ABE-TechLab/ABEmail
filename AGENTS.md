# Agent Contract — Commercial ABEmail

## Project purpose

Commercial, multi-organization business email workspace operated by ABE TechLab. It is distinct from the single-organization Waste2Light deployment in `gODtECH-Ctl-Create/ABEmail-Mail`.

## Required boundaries

- Read `README.md` and relevant architecture/product documents before meaningful implementation.
- Never change, redeploy, or migrate the Waste2Light application as part of this repository.
- Never reuse customer data, secrets, provider keys, domains, production databases, or project environment settings from the pilot.
- Keep changes on a feature branch. Do not merge to `main` or activate a production deployment without explicit approval.
- Do not create a paid cloud resource or database project without surfacing its cost and getting approval.

## Multi-tenant security

- Treat every organization as a tenant boundary. Every tenant-owned record must have an organization identifier, and references must be checked against the same tenant.
- Enforce tenant isolation with Postgres Row Level Security and appropriate grants; do not rely on interface hiding or client-side filters.
- Test both allowed access and forbidden cross-tenant reads/writes for every meaningful tenant-owned table.
- Resolve the active organization from the authenticated user's verified membership, never from a user-editable profile field or untrusted request input alone.
- Keep platform-level operator authorization separate from tenant roles and audit privileged actions.
- Keep all service-role, email-provider, webhook-signing, and encryption secrets server-side.
- Verify provider webhook signatures, use idempotency, limit send volume, and do not expose message content in logs.

## Implementation and delivery

- Prefer the smallest complete, reviewable milestone over broad rewrites.
- Pin dependencies and commit lockfiles.
- Keep provider-specific code behind an adapter.
- Add tests for authorization and data isolation before enabling tenant access.
- Run the production build and relevant tests before claiming a milestone is complete.
- Never claim a live provider/domain/mailbox is configured without verifying it.
- Update product/architecture docs when decisions materially change.
