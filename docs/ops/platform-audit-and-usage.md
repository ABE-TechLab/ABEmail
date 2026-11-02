# Platform Audit and Organization Usage

## Scope

This is the shared operational record for important workspace administration and mail-platform usage. It is tenant-scoped and separate from message content, provider delivery state, and mailbox read/archive/star state.

## Administrative audit events

The append-only `public.organization_audit_events` table records the organization, actor identity/type, action, resource type and identifier, outcome, timestamp, optional idempotency key, and allow-listed metadata.

Initial application coverage includes workspace rename; sender-domain add/synchronization and verification checks; mailbox creation and updates; invitation creation and revocation; Resend provider connection and disconnection; Brand Profile changes and workspace logo upload/removal; and designed email template create/update/delete.

The metadata sanitizer only retains explicitly approved operational fields. It does not retain email bodies, recipient addresses, invitation addresses/tokens, provider secrets, uploaded logo URLs, or design content. New event metadata should stay to identifiers, state transitions, safe field names, reason codes, counts, and provider labels.

Audit events are append-only: UPDATE and DELETE are rejected by database triggers, including for privileged application roles. Browser-authenticated writes are not granted. Owners and admins can read only their own organization's events through:

```http
GET /api/organizations/{organizationId}/audit-events?limit=50
```

The endpoint is read-only, uncached, and caps page size at 100. Use the `before` parameter with an ISO timestamp to request older events. Service-role writes stay on trusted server code.

## Usage accounting

The append-only `public.organization_usage_events` table records these metrics independently:

| Metric | Counting rule |
| --- | --- |
| `outbound_message_capacity` | One reservation per outbound message. A negative release is recorded only after a definitive pre-send failure. |
| `outbound_messages_accepted` | One when the provider accepts an outbound message. |
| `outbound_recipients_accepted` | Number of recipients accepted for an outbound message; reported separately and does not consume additional quota. |
| `inbound_messages_received` | One per inbound message successfully stored. |
| `provider_events_processed` | One per successfully processed, tenant-associated provider event. |

Writes are idempotent using organization-scoped keys. The migration backfills historical outbound reservations and accepted message/recipient totals, stored inbound messages, and processed provider events so the ledger does not start at zero.

### Initial quota policy

Every organization receives an initial allowance of **250 outbound messages per UTC calendar day**. The value is stored in `public.organization_usage_limits`. It is per organization—not per mailbox, user, or recipient.

The reservation RPC locks the organization's limit row before checking and inserting a reservation, serializing concurrent sends for one organization. Reservation happens before provider submission. A definitive failure before submission (or definitive provider rejection) releases the reservation. An ambiguous timeout or server error keeps the reservation because the provider may already have accepted the message; releasing it could allow an over-limit duplicate. The same message idempotency key can safely receive a new attempt after a previous attempt was definitely released.

Limits are server-managed. Owners/admins can view the value but cannot change it from a browser API. A reviewed operator action is required to change an organization's allowance or disable the limit.

### Usage visibility

Owners and admins can read their own organization's limit, daily aggregates for the last 30 days, and recent usage events through:

```http
GET /api/organizations/{organizationId}/usage
```

The response identifies the reporting timezone as UTC. The endpoint is read-only, uncached, and bounded to 1,000 source events per request; it reports when that source window is truncated. Reads remain subject to the table's tenant Row Level Security policy.

## Operational handling

- Successful provider submission is authoritative even if usage bookkeeping subsequently needs reconciliation. Stable idempotency keys prevent the same message/event from being counted twice.
- `auditRecorded: false` means the underlying mutation succeeded but its audit write needs operator reconciliation.
- If usage reconciliation is needed, resolve it against the message/provider-event ledger before creating a replacement message.
- Do not manually update/delete audit or usage rows. Corrections should be represented with compensating usage entries and additional audit events.
- Do not use Preview/Development for destructive DB tests or customer mail. Replay migrations and run database tests in isolated Supabase CI. Live provider credentials remain Production-only.

## Release verification

1. Replay all migrations from an empty local Supabase database.
2. Run tenant-isolation pgTAP tests, including audit visibility, append-only checks, reservation retry/release and daily limit behavior.
3. Run Application CI lint, unit tests, navigation contract, type-check and production build.
4. Review the final diff and apply the migration through a separately approved Production migration gate.
5. Verify authenticated owner/admin reads and non-admin/cross-tenant denials in a controlled environment.

