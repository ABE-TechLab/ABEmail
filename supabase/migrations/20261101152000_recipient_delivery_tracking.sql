-- Track each Resend recipient independently and derive the outbound message's aggregate delivery state.
-- Browser clients may read only recipient records for mailboxes they can already read.

alter table public.email_messages
  drop constraint if exists email_messages_status_check;

alter table public.email_messages
  add constraint email_messages_status_check
  check (status in (
    'processing', 'accepted', 'received', 'delivered', 'delayed',
    'bounced', 'complained', 'failed', 'suppressed', 'partially_delivered'
  ));

create table public.email_message_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  mailbox_id uuid not null,
  message_id uuid not null,
  recipient_email text not null
    check (
      recipient_email = lower(btrim(recipient_email))
      and char_length(recipient_email) between 3 and 320
      and position('@' in recipient_email) > 1
    ),
  status text not null default 'processing'
    check (status in (
      'processing', 'accepted', 'delayed', 'delivered',
      'bounced', 'complained', 'failed', 'suppressed'
    )),
  last_event_at timestamptz,
  last_provider_event_id text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, message_id, recipient_email),
  foreign key (organization_id, message_id)
    references public.email_messages(organization_id, id) on delete cascade,
  foreign key (organization_id, mailbox_id)
    references public.mailboxes(organization_id, id) on delete cascade
);

create index email_message_recipients_message_idx
  on public.email_message_recipients (organization_id, message_id, status);

create index email_message_recipients_mailbox_recent_idx
  on public.email_message_recipients (organization_id, mailbox_id, created_at desc);

create trigger email_message_recipients_touch_updated_at
  before update on public.email_message_recipients
  for each row execute function private.touch_updated_at();

alter table public.email_message_recipients enable row level security;
revoke all on table public.email_message_recipients from public, anon, authenticated;
grant select on table public.email_message_recipients to authenticated;
grant all on table public.email_message_recipients to service_role;

create policy email_message_recipients_read_authorized_mailboxes
  on public.email_message_recipients for select to authenticated
  using (
    exists (
      select 1
      from public.organizations as organization_row
      join public.mailboxes as mailbox_row
        on mailbox_row.organization_id = organization_row.id
      join public.email_messages as message_row
        on message_row.organization_id = email_message_recipients.organization_id
       and message_row.id = email_message_recipients.message_id
       and message_row.mailbox_id = email_message_recipients.mailbox_id
      where organization_row.id = email_message_recipients.organization_id
        and organization_row.status = 'active'
        and mailbox_row.id = email_message_recipients.mailbox_id
        and mailbox_row.status = 'active'
        and message_row.direction = 'outbound'
        and private.is_org_member(organization_row.id)
        and (
          private.has_org_role(organization_row.id, array['owner', 'admin']::text[])
          or exists (
            select 1
            from public.mailbox_memberships as grant_row
            where grant_row.organization_id = email_message_recipients.organization_id
              and grant_row.mailbox_id = email_message_recipients.mailbox_id
              and grant_row.user_id = (select auth.uid())
              and grant_row.status = 'active'
              and grant_row.can_read
          )
        )
    )
  );

-- Recompute the parent message while holding its row lock. This prevents two
-- concurrent recipient events from calculating an aggregate from stale states.
create or replace function private.refresh_email_message_delivery_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_total integer;
  recipient_processing integer;
  recipient_accepted integer;
  recipient_delayed integer;
  recipient_delivered integer;
  recipient_bounced integer;
  recipient_complained integer;
  recipient_failed integer;
  recipient_suppressed integer;
  recipient_terminal integer;
  recipient_success integer;
  recipient_failure integer;
  aggregate_status text;
begin
  perform 1
  from public.email_messages as message_row
  where message_row.organization_id = new.organization_id
    and message_row.id = new.message_id
    and message_row.direction = 'outbound'
  for update;

  if not found then
    return new;
  end if;

  select
    count(*)::integer,
    count(*) filter (where recipient.status = 'processing')::integer,
    count(*) filter (where recipient.status = 'accepted')::integer,
    count(*) filter (where recipient.status = 'delayed')::integer,
    count(*) filter (where recipient.status = 'delivered')::integer,
    count(*) filter (where recipient.status = 'bounced')::integer,
    count(*) filter (where recipient.status = 'complained')::integer,
    count(*) filter (where recipient.status = 'failed')::integer,
    count(*) filter (where recipient.status = 'suppressed')::integer,
    count(*) filter (where recipient.status in ('delivered', 'bounced', 'complained', 'failed', 'suppressed'))::integer,
    count(*) filter (where recipient.status in ('delivered', 'complained'))::integer,
    count(*) filter (where recipient.status in ('bounced', 'failed', 'suppressed'))::integer
  into
    recipient_total,
    recipient_processing,
    recipient_accepted,
    recipient_delayed,
    recipient_delivered,
    recipient_bounced,
    recipient_complained,
    recipient_failed,
    recipient_suppressed,
    recipient_terminal,
    recipient_success,
    recipient_failure
  from public.email_message_recipients as recipient
  where recipient.organization_id = new.organization_id
    and recipient.message_id = new.message_id;

  if recipient_total = 0 then
    return new;
  end if;

  if recipient_terminal = recipient_total then
    if recipient_success > 0 and recipient_failure > 0 then
      aggregate_status := 'partially_delivered';
    elsif recipient_complained > 0 then
      aggregate_status := 'complained';
    elsif recipient_delivered = recipient_total then
      aggregate_status := 'delivered';
    elsif recipient_bounced = recipient_total then
      aggregate_status := 'bounced';
    elsif recipient_suppressed = recipient_total then
      aggregate_status := 'suppressed';
    else
      aggregate_status := 'failed';
    end if;
  elsif recipient_processing > 0 then
    aggregate_status := 'processing';
  elsif recipient_delayed > 0 then
    aggregate_status := 'delayed';
  elsif recipient_accepted > 0 then
    aggregate_status := 'accepted';
  else
    aggregate_status := 'processing';
  end if;

  update public.email_messages as message_row
  set
    status = aggregate_status,
    delivered_at = case
      when recipient_delivered > 0 then coalesce(message_row.delivered_at, now())
      else message_row.delivered_at
    end
  where message_row.organization_id = new.organization_id
    and message_row.id = new.message_id;

  return new;
end;
$$;

revoke all on function private.refresh_email_message_delivery_status() from public, anon, authenticated;
grant execute on function private.refresh_email_message_delivery_status() to service_role;

create trigger email_message_recipients_refresh_message_status
  after insert or update of status, last_event_at
  on public.email_message_recipients
  for each row
  execute function private.refresh_email_message_delivery_status();

-- Backfill historical outbound messages. The old message-level status is the
-- best available state until newer recipient-specific webhooks arrive.
insert into public.email_message_recipients (
  organization_id,
  mailbox_id,
  message_id,
  recipient_email,
  status,
  delivered_at
)
select
  message_row.organization_id,
  message_row.mailbox_id,
  message_row.id,
  lower(btrim(recipient_address)),
  case message_row.status
    when 'accepted' then 'accepted'
    when 'delayed' then 'delayed'
    when 'delivered' then 'delivered'
    when 'bounced' then 'bounced'
    when 'complained' then 'complained'
    when 'failed' then 'failed'
    when 'suppressed' then 'suppressed'
    else 'processing'
  end,
  case when message_row.status in ('delivered', 'complained') then message_row.delivered_at else null end
from public.email_messages as message_row
cross join lateral unnest(message_row.to_addresses) as recipient_address
where message_row.direction = 'outbound'
  and char_length(btrim(recipient_address)) between 3 and 320
  and position('@' in btrim(recipient_address)) > 1
on conflict (organization_id, message_id, recipient_email) do nothing;

comment on table public.email_message_recipients is
  'Recipient-level outbound delivery state. Reads follow the parent message mailbox RLS; writes are server-only.';
comment on column public.email_messages.status is
  'Aggregate status derived from all recipient delivery states for outbound messages. Mixed terminal outcomes use partially_delivered.';
