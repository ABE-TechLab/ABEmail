-- Shared append-only administrative audit and tenant usage accounting.
-- All writes are server-side; authenticated workspace owners/admins can read only their own tenant's records.

create table public.organization_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid,
  actor_type text not null default 'user' check (actor_type in ('user', 'system', 'provider')),
  action text not null check (action ~ '^[a-z][a-z0-9_.-]{1,99}$'),
  resource_type text not null check (resource_type ~ '^[a-z][a-z0-9_.-]{1,59}$'),
  resource_id text,
  outcome text not null default 'success' check (outcome in ('success', 'denied', 'failure')),
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4096),
  created_at timestamptz not null default now(),
  check (idempotency_key is null or char_length(idempotency_key) between 1 and 180),
  unique (organization_id, idempotency_key)
);

create index organization_audit_events_tenant_recent_idx
  on public.organization_audit_events (organization_id, created_at desc, id desc);
create index organization_audit_events_resource_recent_idx
  on public.organization_audit_events (organization_id, resource_type, resource_id, created_at desc);
create index organization_audit_events_action_recent_idx
  on public.organization_audit_events (organization_id, action, created_at desc);

alter table public.organization_audit_events enable row level security;
revoke all on table public.organization_audit_events from public, anon, authenticated, service_role;
grant select on table public.organization_audit_events to authenticated;
grant select, insert on table public.organization_audit_events to service_role;

create policy organization_audit_events_read_admins
  on public.organization_audit_events for select to authenticated
  using (
    private.is_org_member(organization_id)
    and private.has_org_role(organization_id, array['owner', 'admin']::text[])
  );

create table public.organization_usage_limits (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  outbound_messages_per_utc_day integer not null default 250
    check (outbound_messages_per_utc_day between 1 and 1000000),
  enabled boolean not null default true,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organization_usage_limits_touch_updated_at
  before update on public.organization_usage_limits
  for each row execute function private.touch_updated_at();

alter table public.organization_usage_limits enable row level security;
revoke all on table public.organization_usage_limits from public, anon, authenticated, service_role;
grant select on table public.organization_usage_limits to authenticated;
grant select, insert, update on table public.organization_usage_limits to service_role;

create policy organization_usage_limits_read_admins
  on public.organization_usage_limits for select to authenticated
  using (
    private.is_org_member(organization_id)
    and private.has_org_role(organization_id, array['owner', 'admin']::text[])
  );

create table public.organization_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  mailbox_id uuid,
  metric text not null check (metric in (
    'outbound_message_capacity',
    'outbound_messages_accepted',
    'outbound_recipients_accepted',
    'inbound_messages_received',
    'provider_events_processed'
  )),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.-]{1,99}$'),
  quantity integer not null check (quantity between -1000000 and 1000000 and quantity <> 0),
  period_start date not null default ((now() at time zone 'UTC')::date),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 180),
  provider text,
  provider_event_id text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 2048),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  foreign key (organization_id, mailbox_id)
    references public.mailboxes(organization_id, id) on delete restrict
);

create index organization_usage_events_tenant_metric_period_idx
  on public.organization_usage_events (organization_id, metric, period_start desc);
create index organization_usage_events_tenant_occurred_idx
  on public.organization_usage_events (organization_id, occurred_at desc);
create unique index organization_usage_events_provider_event_idx
  on public.organization_usage_events (organization_id, provider, provider_event_id)
  where provider is not null and provider_event_id is not null;

alter table public.organization_usage_events enable row level security;
revoke all on table public.organization_usage_events from public, anon, authenticated, service_role;
grant select on table public.organization_usage_events to authenticated;
grant select, insert on table public.organization_usage_events to service_role;

create policy organization_usage_events_read_admins
  on public.organization_usage_events for select to authenticated
  using (
    private.is_org_member(organization_id)
    and private.has_org_role(organization_id, array['owner', 'admin']::text[])
  );

create or replace function private.prevent_append_only_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'This table is append-only; % is not permitted', tg_op;
end;
$$;
revoke all on function private.prevent_append_only_mutation() from public, anon, authenticated, service_role;

create trigger organization_audit_events_append_only
  before update or delete on public.organization_audit_events
  for each row execute function private.prevent_append_only_mutation();
create trigger organization_usage_events_append_only
  before update or delete on public.organization_usage_events
  for each row execute function private.prevent_append_only_mutation();

insert into public.organization_usage_limits (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;

create or replace function private.create_default_organization_usage_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_usage_limits (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_default_organization_usage_limit() from public, anon, authenticated, service_role;

create trigger organizations_create_default_usage_limit
  after insert on public.organizations
  for each row execute function private.create_default_organization_usage_limit();

-- Backfill historical usage for all existing workspaces.
insert into public.organization_usage_events (
  organization_id, mailbox_id, metric, event_type, quantity, period_start, idempotency_key
)
select
  message.organization_id, message.mailbox_id, 'outbound_message_capacity',
  'outbound_message_legacy_reservation', 1,
  (coalesce(message.sent_at, message.created_at) at time zone 'UTC')::date,
  'reserve:' || message.id::text || ':' ||
    ((coalesce(message.sent_at, message.created_at) at time zone 'UTC')::date)::text || ':1'
from public.email_messages as message
where message.direction = 'outbound'
  and (message.provider_message_id is not null or message.status = 'processing')
on conflict (organization_id, idempotency_key) do nothing;

insert into public.organization_usage_events (
  organization_id, mailbox_id, metric, event_type, quantity, period_start, idempotency_key
)
select
  message.organization_id, message.mailbox_id, 'outbound_messages_accepted',
  'outbound_message_legacy_accepted', 1,
  (coalesce(message.sent_at, message.created_at) at time zone 'UTC')::date,
  'outbound-accepted:' || message.id::text
from public.email_messages as message
where message.direction = 'outbound' and message.provider_message_id is not null
on conflict (organization_id, idempotency_key) do nothing;

insert into public.organization_usage_events (
  organization_id, mailbox_id, metric, event_type, quantity, period_start, idempotency_key
)
select
  message.organization_id, message.mailbox_id, 'outbound_recipients_accepted',
  'outbound_recipients_legacy_accepted', greatest(1, cardinality(message.to_addresses)),
  (coalesce(message.sent_at, message.created_at) at time zone 'UTC')::date,
  'outbound-recipients-accepted:' || message.id::text
from public.email_messages as message
where message.direction = 'outbound' and message.provider_message_id is not null
on conflict (organization_id, idempotency_key) do nothing;

insert into public.organization_usage_events (
  organization_id, mailbox_id, metric, event_type, quantity, period_start, idempotency_key
)
select
  message.organization_id, message.mailbox_id, 'inbound_messages_received',
  'inbound_message_legacy_received', 1,
  (coalesce(message.received_at, message.created_at) at time zone 'UTC')::date,
  'inbound-message-received:' || message.id::text
from public.email_messages as message
where message.direction = 'inbound'
on conflict (organization_id, idempotency_key) do nothing;

insert into public.organization_usage_events (
  organization_id, metric, event_type, quantity, period_start,
  idempotency_key, provider, provider_event_id
)
select
  event.organization_id, 'provider_events_processed', 'provider_event_legacy_processed', 1,
  (event.processed_at at time zone 'UTC')::date,
  'provider-event-processed:legacy:' || event.provider || ':' || event.provider_event_id,
  event.provider, event.provider_event_id
from public.provider_events as event
where event.status = 'processed'
  and event.organization_id is not null
  and event.processed_at is not null
on conflict (organization_id, idempotency_key) do nothing;

create or replace function public.reserve_organization_outbound_message(
  p_organization_id uuid,
  p_mailbox_id uuid,
  p_idempotency_key text
)
returns table (allowed boolean, used integer, daily_limit integer, already_reserved boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_limit integer;
  v_used integer;
  v_period_start date := (now() at time zone 'UTC')::date;
  v_reservation_key text;
  v_release_key text;
  v_attempt integer;
  v_active_reservation boolean;
begin
  if p_organization_id is null or p_mailbox_id is null
     or p_idempotency_key is null
     or p_idempotency_key !~ '^[a-zA-Z0-9:_-]{1,140}$' then
    raise exception 'Invalid outbound usage reservation input';
  end if;

  perform 1
  from public.organization_usage_limits as usage_limit
  where usage_limit.organization_id = p_organization_id
  for update;

  select usage_limit.outbound_messages_per_utc_day
  into v_limit
  from public.organization_usage_limits as usage_limit
  where usage_limit.organization_id = p_organization_id
    and usage_limit.enabled = true;

  if not found then raise exception 'Organization usage limit is missing or disabled'; end if;

  select coalesce(sum(usage_event.quantity), 0)::integer
  into v_used
  from public.organization_usage_events as usage_event
  where usage_event.organization_id = p_organization_id
    and usage_event.metric = 'outbound_message_capacity'
    and usage_event.period_start = v_period_start;

  select usage_event.idempotency_key
  into v_reservation_key
  from public.organization_usage_events as usage_event
  where usage_event.organization_id = p_organization_id
    and usage_event.metric = 'outbound_message_capacity'
    and usage_event.idempotency_key like 'reserve:' || p_idempotency_key || ':' || v_period_start::text || ':%'
  order by usage_event.created_at desc, usage_event.idempotency_key desc
  limit 1;

  if found then
    v_release_key := replace(v_reservation_key, 'reserve:', 'release:');
    select not exists (
      select 1 from public.organization_usage_events as released
      where released.organization_id = p_organization_id
        and released.idempotency_key = v_release_key
    ) into v_active_reservation;

    if v_active_reservation then
      return query select true, v_used, v_limit, true;
      return;
    end if;
  end if;

  if v_used >= v_limit then
    return query select false, v_used, v_limit, false;
    return;
  end if;

  select (count(*) + 1)::integer
  into v_attempt
  from public.organization_usage_events as usage_event
  where usage_event.organization_id = p_organization_id
    and usage_event.metric = 'outbound_message_capacity'
    and usage_event.idempotency_key like 'reserve:' || p_idempotency_key || ':' || v_period_start::text || ':%';

  v_reservation_key := 'reserve:' || p_idempotency_key || ':' || v_period_start::text || ':' || v_attempt::text;
  insert into public.organization_usage_events (
    organization_id, mailbox_id, metric, event_type, quantity, period_start, idempotency_key
  ) values (
    p_organization_id, p_mailbox_id, 'outbound_message_capacity',
    'outbound_message_reserved', 1, v_period_start, v_reservation_key
  );

  return query select true, v_used + 1, v_limit, false;
end;
$$;

create or replace function public.release_organization_outbound_message(
  p_organization_id uuid,
  p_idempotency_key text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_period_start date;
  v_reservation_key text;
  v_release_key text;
begin
  if p_organization_id is null or p_idempotency_key is null
     or p_idempotency_key !~ '^[a-zA-Z0-9:_-]{1,140}$' then
    raise exception 'Invalid outbound usage release input';
  end if;

  perform 1 from public.organization_usage_limits as usage_limit
  where usage_limit.organization_id = p_organization_id
  for update;

  select usage_event.period_start, usage_event.idempotency_key
  into v_period_start, v_reservation_key
  from public.organization_usage_events as usage_event
  where usage_event.organization_id = p_organization_id
    and usage_event.metric = 'outbound_message_capacity'
    and usage_event.idempotency_key like 'reserve:' || p_idempotency_key || ':%'
    and not exists (
      select 1 from public.organization_usage_events as released
      where released.organization_id = usage_event.organization_id
        and released.idempotency_key = replace(usage_event.idempotency_key, 'reserve:', 'release:')
    )
  order by usage_event.created_at desc, usage_event.idempotency_key desc
  limit 1;

  if not found then return false; end if;

  v_release_key := replace(v_reservation_key, 'reserve:', 'release:');
  insert into public.organization_usage_events (
    organization_id, metric, event_type, quantity, period_start, idempotency_key
  ) values (
    p_organization_id, 'outbound_message_capacity',
    'outbound_message_released', -1, v_period_start, v_release_key
  );

  return true;
end;
$$;

revoke all on function public.reserve_organization_outbound_message(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.release_organization_outbound_message(uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_organization_outbound_message(uuid, uuid, text) to service_role;
grant execute on function public.release_organization_outbound_message(uuid, text) to service_role;

comment on table public.organization_audit_events is
  'Append-only tenant administration audit log. Stores safe metadata only; browser reads are limited to organization owners/admins and writes are service-role only.';
comment on table public.organization_usage_limits is
  'Server-managed tenant usage limits. Initial outbound allowance is 250 messages per UTC calendar day; changes require a reviewed operator action.';
comment on table public.organization_usage_events is
  'Append-only idempotent usage ledger. Outbound capacity is reserved before send; accepted sends/recipients, inbound messages and processed provider events are tracked separately.';
comment on function public.reserve_organization_outbound_message(uuid, uuid, text) is
  'Atomically reserves one outbound message against the tenant UTC-day limit. Execute only with the Supabase service_role.';
comment on function public.release_organization_outbound_message(uuid, text) is
  'Idempotently releases an outbound reservation for a definitively failed message. Execute only with the Supabase service_role.';

