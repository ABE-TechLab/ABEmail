# Tenant Boundaries and Authorization Model

## Principle

The organization is the tenant boundary. A user identity is not a tenant, an email domain is not proof of tenant membership, and a client-supplied `organization_id` is never authorization by itself.

Every request that touches organization data must resolve:
1. the verified signed-in user;
2. the target organization;
3. an active membership or an explicit platform-operator capability;
4. permission for the requested action and, when applicable, mailbox.

Use the same checks in application code and Postgres Row Level Security (RLS). RLS is defense in depth, not a reason to skip server-side validation.

## Core relationships

```text
auth.users
  └── organization_memberships ── organizations
                                   ├── organization_domains
                                   │    └── mailboxes
                                   │         ├── mailbox_memberships
                                   │         ├── email_messages
                                   │         │    └── email_attachments
                                   │         ├── email_drafts
                                   │         └── scheduled_messages
                                   ├── contacts
                                   ├── provider_domains / provider configuration references
                                   ├── usage counters
                                   └── audit events

platform operators ── separate from tenant organization memberships
```

## Proposed tenant-owned tables

- `organizations`: display name, immutable slug, lifecycle state, plan/limit references, and timestamps.
- `organization_memberships`: organization, Auth user ID, role, membership status, invited/accepted timestamps.
- `organization_invitations`: organization, normalized invite email, role, token hash, inviter, expiry, accepted/revoked timestamps. Never store the raw invitation token.
- `organization_domains`: normalized domain, organization, provider-domain reference, verification state, permitted sending/receiving modes, and timestamps.
- `mailboxes`: organization, domain, normalized address, display name, active state, and provider routing reference.
- `mailbox_memberships`: organization, mailbox, user, capability/role, and status.
- `email_messages`: organization, mailbox, provider message reference, direction, normalized envelope/header fields, body, state, and timestamps.
- `email_attachments`: organization, message, private object path, content type, size, and provider metadata. Keep binary content out of ordinary message rows.
- `email_drafts`, `scheduled_messages`, `contacts`: organization-scoped records with explicit creator and mailbox ownership where relevant.
- `provider_events`: provider, provider event ID, event type, processing state, received/processed timestamps, and minimum necessary payload metadata. Unique provider event identity enforces idempotency.
- `organization_usage` or usage-event tables: organization-scoped counts for messages, storage, seats, and provider use.
- `audit_events`: organization where relevant, actor, operation, target type/ID, outcome, request ID, and timestamp. Do not store secrets or message body content in audit metadata.

Every child foreign key should include enough organization context to prevent a row from pointing at a parent belonging to another tenant. Prefer composite unique constraints and composite foreign keys such as (organization_id, mailbox_id) where appropriate.

## Roles and permissions

### Tenant roles
- **Owner:** full authority inside one organization, including membership and domain/mailbox configuration. Must not gain platform-wide access.
- **Administrator:** manages organization settings, teammates, domains, and mailboxes within the product's policy; cannot manage other tenants or platform operators.
- **Member:** uses explicitly assigned mailboxes and normal mail features.
- **Mailbox grant:** optional additional restriction for shared mailboxes; tenant membership alone must not silently grant access to every mailbox if the organization has restricted assignment enabled.

Define permissions as explicit capability checks (for example `can_manage_domains`, `can_manage_members`, `can_send_from_mailbox`) rather than scattered role-string comparisons.

### Platform operators
Platform staff permissions are separate from customer membership. Start with a restricted server-side allowlist or a dedicated internal authorization table whose management is not exposed to tenant users. Do not trust user-editable `user_metadata` as authorization. Require an audit entry for tenant lifecycle changes, support access, provider configuration changes, and suspension.

Routine platform operations should not expose message bodies by default. Any exceptional support access should be explicitly authorized and audited.

## Request authorization flow

1. Verify the Supabase Auth user on the server.
2. Parse the target resource ID; do not accept the ID as proof of permission.
3. Resolve active organization membership in the database.
4. Resolve mailbox/domain ownership within that same organization.
5. Verify the requested capability and active resource state.
6. Perform the operation through a user-scoped client under RLS where practical.
7. Use a privileged service-role client only for justified backend workflows such as verified provider webhooks and system provisioning; validate tenant/resource relationships explicitly because the service role bypasses RLS.
8. Record a minimal audit event for sensitive actions.

## Row Level Security (RLS)

- Enable RLS on every table exposed through the Supabase Data API.
- Revoke grants that are not needed, then grant the minimum database operations required.
- Policies must verify organization membership and resource ownership. `TO authenticated` alone is not authorization.
- INSERT policies validate the new row's organization and creator.
- UPDATE policies require both `USING` and `WITH CHECK`; users must not be able to move a row to another organization.
- DELETE policies are explicit and limited to permitted roles/resources.
- Keep provider routing secrets and platform authorization tables inaccessible to browser clients.
- Review views, database functions, triggers, and storage policies separately. Views must not unintentionally bypass RLS; privileged functions require special review.
- Do not rely on user-editable JWT metadata for roles. Prefer database membership checks for immediate revocation and current membership state.

## Storage

- Attachment bucket is private.
- Object paths include organization and message context for indexing, but the path is not the security boundary.
- A storage policy validates the caller's active organization/mailbox/message access before reading an object.
- Use short-lived signed URLs only after server-side authorization; avoid logging the URL.
- Limit allowed content sizes/types, reject path traversal and unsafe filenames, and scan/handle risky file types according to the release policy.

## Email provider boundary

- A provider-domain ID maps to an organization domain. A provider event must be signature-verified before routing.
- Inbound event recipients are normalized then resolved to a mailbox and organization from the database. Never trust a tenant ID sent in the webhook payload to choose the tenant.
- Persist each provider event idempotently before acknowledging successful processing when feasible.
- For outbound send, resolve the mailbox from authenticated app data, check mailbox access/domain verification/tenant status/limits, then call the provider.
- Provider keys and signing secrets remain server-side. Customer provider credentials, if added later, must use a managed secret-storage design and an explicit rotation/revocation flow.

## Required security tests

For two seeded tenants A and B, tests must prove:
- A cannot SELECT, INSERT into, UPDATE, or DELETE B's records.
- A cannot pass B's mailbox ID, domain ID, message ID, draft ID, attachment path, or schedule ID to an API to access or modify the resource.
- Membership removal blocks subsequent requests; cached organization state cannot authorize a stale member.
- Tenant administrators cannot grant platform operator rights or modify another organization's membership.
- A non-member cannot accept or replay another user's invitation.
- An unverified, disabled, or suspended domain/mailbox/organization cannot send or receive through the normal customer path.
- Webhook retries do not duplicate stored messages or provider events.

## Reference documentation

- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase secure-data guide: https://supabase.com/docs/guides/database/secure-data
- Supabase security guidance: https://supabase.com/docs/guides/security
