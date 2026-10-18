-- Per-user mailbox lifecycle, separate from provider transport/delivery status.
-- Additive only. Do not apply while Preview/Development share the Production project.

create unique index if not exists email_messages_org_mailbox_id_unique_idx
  on public.email_messages (organization_id, mailbox_id, id);

create table public.email_message_user_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null,
  mailbox_id uuid not null,
  message_id uuid not null,
  is_read boolean not null default false,
  is_starred boolean not null default false,
  archived_at timestamptz,
  trashed_at timestamptz,
  spam_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, message_id),
  foreign key (organization_id, mailbox_id)
    references public.mailboxes(organization_id, id) on delete cascade,
  foreign key (organization_id, mailbox_id, message_id)
    references public.email_messages(organization_id, mailbox_id, id) on delete cascade,
  check (not (trashed_at is not null and spam_at is not null))
);

create index email_message_user_state_folder_idx
  on public.email_message_user_state
    (user_id, organization_id, mailbox_id, archived_at, trashed_at, spam_at, is_starred);

create trigger email_message_user_state_touch_updated_at
  before update on public.email_message_user_state
  for each row execute function private.touch_updated_at();

alter table public.email_message_user_state enable row level security;
revoke all on table public.email_message_user_state from public, anon, authenticated;
grant select on table public.email_message_user_state to authenticated;

create policy email_message_user_state_read_own_authorized
  on public.email_message_user_state for select to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
    and exists (
      select 1
      from public.organizations as organization_row
      join public.mailboxes as mailbox_row
        on mailbox_row.organization_id = organization_row.id
      where organization_row.id = email_message_user_state.organization_id
        and organization_row.status = 'active'
        and mailbox_row.id = email_message_user_state.mailbox_id
        and mailbox_row.status = 'active'
        and (
          private.has_org_role(organization_row.id, array['owner', 'admin']::text[])
          or exists (
            select 1
            from public.mailbox_memberships as grant_row
            where grant_row.organization_id = email_message_user_state.organization_id
              and grant_row.mailbox_id = email_message_user_state.mailbox_id
              and grant_row.user_id = (select auth.uid())
              and grant_row.status = 'active'
              and grant_row.can_read
          )
        )
    )
  );

create or replace function public.update_email_message_lifecycle(
  target_organization_id uuid,
  target_mailbox_id uuid,
  target_message_ids uuid[],
  lifecycle_action text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid();
  actor_is_org_admin boolean := false;
  actor_can_manage boolean := false;
  found_count integer := 0;
  affected_count integer := 0;
begin
  if actor_id is null then
    raise exception 'Message is not available' using errcode = '42501';
  end if;

  if target_organization_id is null
     or target_mailbox_id is null
     or target_message_ids is null
     or cardinality(target_message_ids) < 1
     or cardinality(target_message_ids) > 100
     or (select count(distinct message_id) from unnest(target_message_ids) as ids(message_id))
        <> cardinality(target_message_ids) then
    raise exception 'Provide between 1 and 100 unique message IDs' using errcode = '22023';
  end if;

  if lifecycle_action not in (
    'mark_read', 'mark_unread', 'star', 'unstar',
    'archive', 'unarchive', 'trash', 'restore',
    'spam', 'not_spam', 'permanent_delete'
  ) then
    raise exception 'Unsupported lifecycle action' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organization_memberships as membership
    join public.organizations as organization_row
      on organization_row.id = membership.organization_id
    where membership.organization_id = target_organization_id
      and membership.user_id = actor_id
      and membership.status = 'active'
      and organization_row.status = 'active'
  ) then
    raise exception 'Message is not available' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = actor_id
      and membership.status = 'active'
      and membership.role in ('owner', 'admin')
  ) into actor_is_org_admin;

  if not exists (
    select 1
    from public.organizations as organization_row
    join public.mailboxes as mailbox_row
      on mailbox_row.organization_id = organization_row.id
    where organization_row.id = target_organization_id
      and organization_row.status = 'active'
      and mailbox_row.id = target_mailbox_id
      and mailbox_row.status = 'active'
  ) then
    raise exception 'Message is not available' using errcode = '42501';
  end if;

  if not actor_is_org_admin and not exists (
    select 1
    from public.mailbox_memberships as grant_row
    where grant_row.organization_id = target_organization_id
      and grant_row.mailbox_id = target_mailbox_id
      and grant_row.user_id = actor_id
      and grant_row.status = 'active'
      and grant_row.can_read
  ) then
    raise exception 'Message is not available' using errcode = '42501';
  end if;

  select count(*)::integer
    into found_count
    from public.email_messages as message_row
   where message_row.organization_id = target_organization_id
     and message_row.mailbox_id = target_mailbox_id
     and message_row.id = any(target_message_ids);

  if found_count <> cardinality(target_message_ids) then
    raise exception 'Message is not available' using errcode = '42501';
  end if;

  if lifecycle_action = 'permanent_delete' then
    select (
      actor_is_org_admin or exists (
        select 1
        from public.mailbox_memberships as grant_row
        where grant_row.organization_id = target_organization_id
          and grant_row.mailbox_id = target_mailbox_id
          and grant_row.user_id = actor_id
          and grant_row.status = 'active'
          and grant_row.can_manage
      )
    ) into actor_can_manage;

    if not actor_can_manage then
      raise exception 'Mailbox management permission is required' using errcode = '42501';
    end if;

    select count(*)::integer
      into found_count
      from public.email_message_user_state as state_row
     where state_row.user_id = actor_id
       and state_row.organization_id = target_organization_id
       and state_row.mailbox_id = target_mailbox_id
       and state_row.message_id = any(target_message_ids)
       and state_row.trashed_at is not null;

    if found_count <> cardinality(target_message_ids) then
      raise exception 'Only messages in Trash can be permanently deleted' using errcode = '22023';
    end if;

    delete from public.email_messages as message_row
     where message_row.organization_id = target_organization_id
       and message_row.mailbox_id = target_mailbox_id
       and message_row.id = any(target_message_ids);
    get diagnostics affected_count = row_count;
    return affected_count;
  end if;

  -- Create a personal state row only when an action is first used.
  -- Outbound mail is read by default; new inbound mail starts unread.
  insert into public.email_message_user_state (
    user_id, organization_id, mailbox_id, message_id, is_read
  )
  select actor_id, target_organization_id, target_mailbox_id,
         message_row.id, message_row.direction = 'outbound'
    from public.email_messages as message_row
   where message_row.organization_id = target_organization_id
     and message_row.mailbox_id = target_mailbox_id
     and message_row.id = any(target_message_ids)
  on conflict (user_id, message_id) do nothing;

  if lifecycle_action = 'mark_read' then
    update public.email_message_user_state set is_read = true
     where user_id = actor_id and organization_id = target_organization_id
       and mailbox_id = target_mailbox_id and message_id = any(target_message_ids);
  elsif lifecycle_action = 'mark_unread' then
    update public.email_message_user_state set is_read = false
     where user_id = actor_id and organization_id = target_organization_id
       and mailbox_id = target_mailbox_id and message_id = any(target_message_ids);
  elsif lifecycle_action = 'star' then
    update public.email_message_user_state set is_starred = true
     where user_id = actor_id and organization_id = target_organization_id
       and mailbox_id = target_mailbox_id and message_id = any(target_message_ids);
  elsif lifecycle_action = 'unstar' then
    update public.email_message_user_state set is_starred = false
     where user_id = actor_id and organization_id = target_organization_id
       and mailbox_id = target_mailbox_id and message_id = any(target_message_ids);
  elsif lifecycle_action = 'archive' then
    update public.email_message_user_state
       set archived_at = coalesce(archived_at, now()), trashed_at = null, spam_at = null
     where user_id = actor_id and organization_id = target_organization_id
       and mailbox_id = target_mailbox_id and message_id = any(target_message_ids);
  elsif lifecycle_action = 'unarchive' then
    update public.email_message_user_state set archived_at = null
     where user_id = actor_id and organization_id = target_organization_id
       and mailbox_id = target_mailbox_id and message_id = any(target_message_ids);
  elsif lifecycle_action = 'trash' then
    update public.email_message_user_state
       set trashed_at = coalesce(trashed_at, now()), archived_at = null, spam_at = null
     where user_id = actor_id and organization_id = target_organization_id
       and mailbox_id = target_mailbox_id and message_id = any(target_message_ids);
  elsif lifecycle_action = 'restore' then
    update public.email_message_user_state
       set trashed_at = null, spam_at = null, archived_at = null
     where user_id = actor_id and organization_id = target_organization_id
       and mailbox_id = target_mailbox_id and message_id = any(target_message_ids);
  elsif lifecycle_action = 'spam' then
    update public.email_message_user_state
       set spam_at = coalesce(spam_at, now()), trashed_at = null, archived_at = null
     where user_id = actor_id and organization_id = target_organization_id
       and mailbox_id = target_mailbox_id and message_id = any(target_message_ids);
  elsif lifecycle_action = 'not_spam' then
    update public.email_message_user_state
       set spam_at = null, trashed_at = null, archived_at = null
     where user_id = actor_id and organization_id = target_organization_id
       and mailbox_id = target_mailbox_id and message_id = any(target_message_ids);
  end if;

  return cardinality(target_message_ids);
end;
$function$;

revoke all on function public.update_email_message_lifecycle(uuid, uuid, uuid[], text) from public, anon;
grant execute on function public.update_email_message_lifecycle(uuid, uuid, uuid[], text) to authenticated;

comment on table public.email_message_user_state is
  'Per-user mailbox organization state. Never mix these flags with email_messages provider transport status.';
comment on function public.update_email_message_lifecycle(uuid, uuid, uuid[], text) is
  'Authorized lifecycle RPC; keeps browser writes restricted and permanent deletion limited to managed mailboxes and trashed messages.';
