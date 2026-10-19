-- Durable scheduled outbound email. Commit this migration; do not apply it to shared Production.
create table public.scheduled_email_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mailbox_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  to_address text not null check (char_length(to_address) between 3 and 320),
  subject text not null check (char_length(subject) between 1 and 998),
  body_text text not null check (char_length(body_text) between 1 and 80000),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'processing', 'accepted', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  locked_at timestamptz,
  provider_message_id text,
  last_error_code text,
  sent_message_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, mailbox_id)
    references public.mailboxes(organization_id, id) on delete cascade,
  check ((status = 'processing' and locked_at is not null) or status <> 'processing')
);
create index scheduled_email_due_idx on public.scheduled_email_messages (scheduled_at)
  where status = 'scheduled';
create index scheduled_email_user_mailbox_idx on public.scheduled_email_messages
  (organization_id, mailbox_id, user_id, scheduled_at desc);
create trigger scheduled_email_touch_updated_at before update on public.scheduled_email_messages
  for each row execute function private.touch_updated_at();
alter table public.scheduled_email_messages enable row level security;
revoke all on table public.scheduled_email_messages from public, anon, authenticated;
grant select on table public.scheduled_email_messages to authenticated;
grant all on table public.scheduled_email_messages to service_role;
create policy scheduled_email_read_authorized on public.scheduled_email_messages
  for select to authenticated using (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
    and exists (
      select 1 from public.mailboxes m
      where m.id = scheduled_email_messages.mailbox_id
        and m.organization_id = scheduled_email_messages.organization_id
        and m.status = 'active'
        and (
          private.has_org_role(m.organization_id, array['owner', 'admin']::text[])
          or exists (
            select 1 from public.mailbox_memberships mm
            where mm.organization_id = m.organization_id
              and mm.mailbox_id = m.id
              and mm.user_id = (select auth.uid())
              and mm.status = 'active' and mm.can_read and mm.can_send
          )
        )
    )
  );

-- Claim with SKIP LOCKED so overlapping cron invocations cannot claim the same row.
create or replace function public.claim_due_scheduled_email_messages(p_limit integer default 25)
returns setof public.scheduled_email_messages
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select s.id
    from public.scheduled_email_messages s
    where (s.status = 'scheduled' and s.scheduled_at <= now())
       or (s.status = 'processing' and s.locked_at < now() - interval '10 minutes' and s.attempt_count < 5)
    order by s.scheduled_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 50))
  )
  update public.scheduled_email_messages s
  set status = 'processing', locked_at = now(), attempt_count = s.attempt_count + 1,
      last_error_code = null
  from candidates c
  where s.id = c.id
  returning s.*;
end;
$$;
revoke all on function public.claim_due_scheduled_email_messages(integer) from public, anon, authenticated;
grant execute on function public.claim_due_scheduled_email_messages(integer) to service_role;
comment on table public.scheduled_email_messages is
  'Durable, tenant-scoped scheduled outbound messages. Sending occurs only from authenticated server worker.';
