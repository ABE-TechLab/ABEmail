-- Controlled pilot mail transport. Provider writes are server-only; tenant reads use RLS.
create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  mailbox_id uuid not null,
  provider text not null default 'resend' check (provider = 'resend'),
  provider_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_address text not null check (from_address = lower(btrim(from_address))),
  to_addresses text[] not null check (cardinality(to_addresses) between 1 and 10),
  subject text not null default '' check (char_length(subject) <= 998),
  body_text text,
  body_html text,
  status text not null check (status in (
    'processing', 'accepted', 'received', 'delivered', 'delayed',
    'bounced', 'complained', 'failed', 'suppressed'
  )),
  idempotency_key text,
  request_fingerprint text,
  created_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz,
  received_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, mailbox_id)
    references public.mailboxes(organization_id, id) on delete cascade,
  check (
    (direction = 'outbound' and idempotency_key is not null and request_fingerprint is not null)
    or direction = 'inbound'
  ),
  check (
    (direction = 'inbound' and received_at is not null)
    or direction = 'outbound'
  )
);

create index email_messages_mailbox_recent_idx
  on public.email_messages (organization_id, mailbox_id, created_at desc);
create index email_messages_provider_message_idx
  on public.email_messages (provider, provider_message_id)
  where provider_message_id is not null;
create unique index email_messages_outbound_idempotency_idx
  on public.email_messages (organization_id, idempotency_key)
  where direction = 'outbound' and idempotency_key is not null;
create unique index email_messages_provider_mailbox_unique_idx
  on public.email_messages (provider, provider_message_id, mailbox_id)
  where provider_message_id is not null;

create trigger email_messages_touch_updated_at
  before update on public.email_messages
  for each row execute function private.touch_updated_at();

alter table public.email_messages enable row level security;
revoke all on table public.email_messages from public, anon, authenticated;
grant select on table public.email_messages to authenticated;
grant all on table public.email_messages to service_role;

create policy email_messages_read_authorized_mailboxes
  on public.email_messages for select to authenticated
  using (
    exists (
      select 1
      from public.organizations as organization_row
      join public.mailboxes as mailbox_row
        on mailbox_row.organization_id = organization_row.id
      where organization_row.id = email_messages.organization_id
        and organization_row.status = 'active'
        and mailbox_row.id = email_messages.mailbox_id
        and mailbox_row.status = 'active'
        and private.is_org_member(organization_row.id)
        and (
          private.has_org_role(organization_row.id, array['owner', 'admin']::text[])
          or exists (
            select 1
            from public.mailbox_memberships as grant_row
            where grant_row.organization_id = email_messages.organization_id
              and grant_row.mailbox_id = email_messages.mailbox_id
              and grant_row.user_id = (select auth.uid())
              and grant_row.status = 'active'
              and grant_row.can_read
          )
        )
    )
  );

create table public.provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'resend'),
  provider_event_id text not null,
  event_type text not null,
  organization_id uuid,
  mailbox_id uuid,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  metadata jsonb not null default '{}'::jsonb,
  last_error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id),
  foreign key (organization_id, mailbox_id)
    references public.mailboxes(organization_id, id) on delete set null
);

create index provider_events_status_received_idx
  on public.provider_events (status, received_at desc);

alter table public.provider_events enable row level security;
revoke all on table public.provider_events from public, anon, authenticated;
grant all on table public.provider_events to service_role;

comment on table public.email_messages is
  'Tenant-owned mail metadata and bodies; authenticated clients can only read authorized active mailboxes. Provider writes are server-only.';
comment on table public.provider_events is
  'Idempotent provider callback ledger. No direct access from browser-authenticated roles.';
