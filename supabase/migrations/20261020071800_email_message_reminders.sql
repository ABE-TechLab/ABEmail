-- Personal one-time reminders attached to messages a workspace user can read.
create table public.email_message_reminders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  mailbox_id uuid not null,
  message_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reminder_at timestamptz not null,
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'completed', 'dismissed')),
  completed_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_message_reminders_mailbox_fkey
    foreign key (organization_id, mailbox_id)
    references public.mailboxes (organization_id, id) on delete cascade,
  constraint email_message_reminders_message_fkey
    foreign key (organization_id, mailbox_id, message_id)
    references public.email_messages (organization_id, mailbox_id, id) on delete cascade,
  constraint email_message_reminders_completed_at_check
    check ((status = 'completed') = (completed_at is not null)),
  constraint email_message_reminders_dismissed_at_check
    check ((status = 'dismissed') = (dismissed_at is not null))
);

create index email_message_reminders_owner_due_idx
  on public.email_message_reminders (organization_id, user_id, reminder_at asc)
  where status = 'pending';

create index email_message_reminders_source_message_idx
  on public.email_message_reminders (organization_id, mailbox_id, message_id);

create or replace function private.prevent_email_message_reminder_reassignment()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.organization_id is distinct from old.organization_id
     or new.mailbox_id is distinct from old.mailbox_id
     or new.message_id is distinct from old.message_id
     or new.user_id is distinct from old.user_id then
    raise exception 'Reminder ownership and source message are immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

revoke all on function private.prevent_email_message_reminder_reassignment() from public, anon, authenticated;

create or replace function private.validate_email_message_reminder_time()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.status = 'pending'
     and (
       tg_op = 'INSERT'
       or new.status is distinct from old.status
       or new.reminder_at is distinct from old.reminder_at
     )
     and (
       new.reminder_at <= now()
       or new.reminder_at > now() + interval '365 days'
     ) then
    raise exception 'Choose a future reminder time within one year'
      using errcode = '22023';
  end if;
  return new;
end;
$function$;

revoke all on function private.validate_email_message_reminder_time() from public, anon, authenticated;

create trigger email_message_reminders_validate_time
  before insert or update of reminder_at, status on public.email_message_reminders
  for each row execute function private.validate_email_message_reminder_time();

create trigger email_message_reminders_touch_updated_at
  before update on public.email_message_reminders
  for each row execute function private.touch_updated_at();

create trigger email_message_reminders_prevent_reassignment
  before update of organization_id, mailbox_id, message_id, user_id on public.email_message_reminders
  for each row execute function private.prevent_email_message_reminder_reassignment();

alter table public.email_message_reminders enable row level security;
revoke all on table public.email_message_reminders from public, anon, authenticated;
grant select, insert, update, delete on table public.email_message_reminders to authenticated;

create policy email_message_reminders_read_own_active_workspace
  on public.email_message_reminders for select to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
    and exists (
      select 1 from public.organizations o
      where o.id = email_message_reminders.organization_id and o.status = 'active'
    )
    and exists (
      select 1 from public.email_messages m
      where m.id = email_message_reminders.message_id
        and m.organization_id = email_message_reminders.organization_id
        and m.mailbox_id = email_message_reminders.mailbox_id
    )
  );

create policy email_message_reminders_insert_own_active_workspace
  on public.email_message_reminders for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
    and exists (
      select 1 from public.organizations o
      where o.id = email_message_reminders.organization_id and o.status = 'active'
    )
    and exists (
      select 1 from public.email_messages m
      where m.id = email_message_reminders.message_id
        and m.organization_id = email_message_reminders.organization_id
        and m.mailbox_id = email_message_reminders.mailbox_id
    )
  );

create policy email_message_reminders_update_own_active_workspace
  on public.email_message_reminders for update to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
    and exists (
      select 1 from public.organizations o
      where o.id = email_message_reminders.organization_id and o.status = 'active'
    )
    and exists (
      select 1 from public.email_messages m
      where m.id = email_message_reminders.message_id
        and m.organization_id = email_message_reminders.organization_id
        and m.mailbox_id = email_message_reminders.mailbox_id
    )
  )
  with check (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
    and exists (
      select 1 from public.organizations o
      where o.id = email_message_reminders.organization_id and o.status = 'active'
    )
    and exists (
      select 1 from public.email_messages m
      where m.id = email_message_reminders.message_id
        and m.organization_id = email_message_reminders.organization_id
        and m.mailbox_id = email_message_reminders.mailbox_id
    )
  );

create policy email_message_reminders_delete_own_active_workspace
  on public.email_message_reminders for delete to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
    and exists (
      select 1 from public.organizations o
      where o.id = email_message_reminders.organization_id and o.status = 'active'
    )
  );

comment on table public.email_message_reminders is
  'Personal one-time follow-up reminders for messages accessible to a user in an active workspace.';
