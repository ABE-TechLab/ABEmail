-- ABEmail authentication, organization invitations, mailbox grants, and alternate login aliases.
-- Additive only. This migration is intentionally not applied by automation.

create extension if not exists pgcrypto with schema extensions;

create table public.organization_domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain text not null check (
    domain = lower(btrim(domain))
    and domain ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$'
    and position('..' in domain) = 0
  ),
  verification_token text not null default ('abemail-verification=' || encode(extensions.gen_random_bytes(24), 'hex')),
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'verified', 'suspended')),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain),
  unique (organization_id, id),
  check ((status = 'verified') = (verified_at is not null))
);

create index organization_domains_org_status_idx
  on public.organization_domains (organization_id, status);

create table public.mailboxes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain_id uuid not null,
  local_part text not null check (
    local_part = lower(btrim(local_part))
    and local_part ~ '^[a-z0-9!#$%&''*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&''*+/=?^_`{|}~-]+)*$'
  ),
  address text not null check (address = lower(btrim(address))),
  display_name text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended')),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (address),
  unique (organization_id, domain_id, local_part),
  foreign key (organization_id, domain_id)
    references public.organization_domains(organization_id, id) on delete cascade
);

create index mailboxes_org_status_idx on public.mailboxes (organization_id, status);

create table public.mailbox_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mailbox_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  can_read boolean not null default true,
  can_send boolean not null default true,
  can_manage boolean not null default false,
  status text not null default 'active' check (status in ('active', 'suspended', 'removed')),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (mailbox_id, user_id),
  foreign key (organization_id, mailbox_id)
    references public.mailboxes(organization_id, id) on delete cascade
);

create index mailbox_memberships_user_status_idx
  on public.mailbox_memberships (user_id, status, organization_id);

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invite_email text not null check (invite_email = lower(btrim(invite_email))),
  role text not null default 'member' check (role in ('admin', 'member')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (accepted_at is null or revoked_at is null)
);

create index organization_invitations_org_pending_idx
  on public.organization_invitations (organization_id, expires_at)
  where accepted_at is null and revoked_at is null;

create table public.organization_invitation_mailboxes (
  organization_id uuid not null,
  invitation_id uuid not null,
  mailbox_id uuid not null,
  use_as_login_alias boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (invitation_id, mailbox_id),
  foreign key (organization_id, invitation_id)
    references public.organization_invitations(organization_id, id) on delete cascade,
  foreign key (organization_id, mailbox_id)
    references public.mailboxes(organization_id, id) on delete cascade
);

create table private.user_login_aliases (
  login_email text primary key check (login_email = lower(btrim(login_email))),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mailbox_id uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (organization_id, mailbox_id)
    references public.mailboxes(organization_id, id) on delete cascade
);

revoke all on table private.user_login_aliases from public, anon, authenticated, service_role;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create trigger organization_domains_touch_updated_at
  before update on public.organization_domains
  for each row execute function private.touch_updated_at();
create trigger mailboxes_touch_updated_at
  before update on public.mailboxes
  for each row execute function private.touch_updated_at();
create trigger mailbox_memberships_touch_updated_at
  before update on public.mailbox_memberships
  for each row execute function private.touch_updated_at();
create trigger organization_invitations_touch_updated_at
  before update on public.organization_invitations
  for each row execute function private.touch_updated_at();

alter table public.organization_domains enable row level security;
alter table public.mailboxes enable row level security;
alter table public.mailbox_memberships enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.organization_invitation_mailboxes enable row level security;

revoke all on table public.organization_domains from public, anon, authenticated;
revoke all on table public.mailboxes from public, anon, authenticated;
revoke all on table public.mailbox_memberships from public, anon, authenticated;
revoke all on table public.organization_invitations from public, anon, authenticated;
revoke all on table public.organization_invitation_mailboxes from public, anon, authenticated;

grant select, insert, delete on table public.organization_domains to authenticated;
grant select, insert, delete on table public.mailboxes to authenticated;
grant select, insert, update, delete on table public.mailbox_memberships to authenticated;
grant select, insert, update, delete on table public.organization_invitations to authenticated;
grant select, insert, delete on table public.organization_invitation_mailboxes to authenticated;

create policy organization_domains_read_members
  on public.organization_domains for select to authenticated
  using (private.is_org_member(organization_id));

create policy organization_domains_insert_admin
  on public.organization_domains for insert to authenticated
  with check (
    private.has_org_role(organization_id, array['owner', 'admin']::text[])
    and created_by = (select auth.uid())
    and status = 'pending_verification'
    and verified_at is null
  );

create policy organization_domains_delete_admin_pending
  on public.organization_domains for delete to authenticated
  using (
    private.has_org_role(organization_id, array['owner', 'admin']::text[])
    and status = 'pending_verification'
  );

create policy mailboxes_read_authorized
  on public.mailboxes for select to authenticated
  using (
    private.has_org_role(organization_id, array['owner', 'admin']::text[])
    or exists (
      select 1
      from public.mailbox_memberships as grant_row
      where grant_row.organization_id = mailboxes.organization_id
        and grant_row.mailbox_id = mailboxes.id
        and grant_row.user_id = (select auth.uid())
        and grant_row.status = 'active'
        and grant_row.can_read
    )
  );

create policy mailboxes_insert_admin_pending
  on public.mailboxes for insert to authenticated
  with check (
    private.has_org_role(organization_id, array['owner', 'admin']::text[])
    and created_by = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1
      from public.organization_domains as domain_row
      where domain_row.organization_id = mailboxes.organization_id
        and domain_row.id = mailboxes.domain_id
        and domain_row.status = 'verified'
        and domain_row.domain = split_part(mailboxes.address, '@', 2)
        and mailboxes.address = mailboxes.local_part || '@' || domain_row.domain
    )
  );

create policy mailboxes_delete_admin_pending
  on public.mailboxes for delete to authenticated
  using (
    private.has_org_role(organization_id, array['owner', 'admin']::text[])
    and status = 'pending'
  );

create policy mailbox_memberships_read_self_or_admin
  on public.mailbox_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_org_role(organization_id, array['owner', 'admin']::text[])
  );

create policy mailbox_memberships_insert_admin
  on public.mailbox_memberships for insert to authenticated
  with check (
    private.has_org_role(organization_id, array['owner', 'admin']::text[])
    and exists (
      select 1 from public.mailboxes as mailbox_row
      where mailbox_row.organization_id = mailbox_memberships.organization_id
        and mailbox_row.id = mailbox_memberships.mailbox_id
    )
    and exists (
      select 1 from public.organization_memberships as member_row
      where member_row.organization_id = mailbox_memberships.organization_id
        and member_row.user_id = mailbox_memberships.user_id
        and member_row.status = 'active'
    )
    and (granted_by is null or granted_by = (select auth.uid()))
  );

create policy mailbox_memberships_update_admin
  on public.mailbox_memberships for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']::text[]))
  with check (private.has_org_role(organization_id, array['owner', 'admin']::text[]));

create policy mailbox_memberships_delete_admin
  on public.mailbox_memberships for delete to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']::text[]));

create policy organization_invitations_read_admin
  on public.organization_invitations for select to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']::text[]));

create policy organization_invitations_insert_admin
  on public.organization_invitations for insert to authenticated
  with check (
    private.has_org_role(organization_id, array['owner', 'admin']::text[])
    and invited_by = (select auth.uid())
    and accepted_at is null
    and accepted_by is null
    and revoked_at is null
    and expires_at > now()
  );

create policy organization_invitations_update_admin
  on public.organization_invitations for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']::text[]))
  with check (private.has_org_role(organization_id, array['owner', 'admin']::text[]));

create policy organization_invitations_delete_admin
  on public.organization_invitations for delete to authenticated
  using (
    private.has_org_role(organization_id, array['owner', 'admin']::text[])
    and accepted_at is null
  );

create policy invitation_mailboxes_read_admin
  on public.organization_invitation_mailboxes for select to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']::text[]));

create policy invitation_mailboxes_insert_admin
  on public.organization_invitation_mailboxes for insert to authenticated
  with check (
    private.has_org_role(organization_id, array['owner', 'admin']::text[])
    and exists (
      select 1 from public.organization_invitations as invitation_row
      where invitation_row.organization_id = organization_invitation_mailboxes.organization_id
        and invitation_row.id = organization_invitation_mailboxes.invitation_id
        and invitation_row.accepted_at is null
        and invitation_row.revoked_at is null
        and invitation_row.expires_at > now()
    )
    and exists (
      select 1 from public.mailboxes as mailbox_row
      where mailbox_row.organization_id = organization_invitation_mailboxes.organization_id
        and mailbox_row.id = organization_invitation_mailboxes.mailbox_id
    )
  );

create policy invitation_mailboxes_delete_admin
  on public.organization_invitation_mailboxes for delete to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']::text[]));

create or replace function public.create_organization_with_owner(
  p_name text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_organization_id uuid;
  v_user_email_confirmed_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before creating an organization';
  end if;

  select users.email_confirmed_at
    into v_user_email_confirmed_at
  from auth.users as users
  where users.id = (select auth.uid());

  if v_user_email_confirmed_at is null then
    raise exception 'Verify your sign-in email before creating an organization';
  end if;

  insert into public.organizations (name, slug, created_by)
  values (btrim(p_name), lower(btrim(p_slug)), (select auth.uid()))
  returning id into v_organization_id;

  insert into public.organization_memberships (
    organization_id, user_id, role, status, invited_by, joined_at
  )
  values (
    v_organization_id, (select auth.uid()), 'owner', 'active',
    (select auth.uid()), now()
  );

  return v_organization_id;
end;
$function$;

revoke all on function public.create_organization_with_owner(text, text) from public, anon;
grant execute on function public.create_organization_with_owner(text, text) to authenticated;

create or replace function public.get_organization_invitation_details(p_token text)
returns table (
  organization_name text,
  invite_email text,
  invite_role text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select organizations.name, invitations.invite_email, invitations.role, invitations.expires_at
  from public.organization_invitations as invitations
  join public.organizations as organizations
    on organizations.id = invitations.organization_id
  where invitations.token_hash = encode(
      extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex'
    )
    and invitations.accepted_at is null
    and invitations.revoked_at is null
    and invitations.expires_at > now()
    and organizations.status = 'active';
$function$;

revoke all on function public.get_organization_invitation_details(text) from public;
grant execute on function public.get_organization_invitation_details(text) to anon, authenticated;

create or replace function public.accept_organization_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_invitation public.organization_invitations%rowtype;
  v_user_email text;
  v_user_email_confirmed_at timestamptz;
  v_mailbox record;
  v_address text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to accept this invitation';
  end if;

  select users.email, users.email_confirmed_at
    into v_user_email, v_user_email_confirmed_at
  from auth.users as users
  where users.id = (select auth.uid());

  if v_user_email_confirmed_at is null then
    raise exception 'Verify your sign-in email before accepting this invitation';
  end if;

  select invitations.*
    into v_invitation
  from public.organization_invitations as invitations
  where invitations.token_hash = encode(
    extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex'
  )
  for update;

  if not found
    or v_invitation.accepted_at is not null
    or v_invitation.revoked_at is not null
    or v_invitation.expires_at <= now() then
    raise exception 'This invitation is invalid, expired, revoked, or already used';
  end if;

  if lower(v_user_email) <> v_invitation.invite_email then
    raise exception 'Sign in with the verified email address this invitation was sent to';
  end if;

  if exists (
    select 1 from public.organization_memberships as memberships
    where memberships.organization_id = v_invitation.organization_id
      and memberships.user_id = (select auth.uid())
      and memberships.status = 'active'
  ) then
    raise exception 'You are already an active member of this organization';
  end if;

  insert into public.organization_memberships (
    organization_id, user_id, role, status, invited_by, invited_at, joined_at
  )
  values (
    v_invitation.organization_id, (select auth.uid()), v_invitation.role, 'active',
    v_invitation.invited_by, v_invitation.created_at, now()
  )
  on conflict (organization_id, user_id) do update
    set role = excluded.role, status = 'active', joined_at = now(), updated_at = now();

  for v_mailbox in
    select invitation_mailboxes.mailbox_id, invitation_mailboxes.use_as_login_alias
    from public.organization_invitation_mailboxes as invitation_mailboxes
    where invitation_mailboxes.organization_id = v_invitation.organization_id
      and invitation_mailboxes.invitation_id = v_invitation.id
  loop
    insert into public.mailbox_memberships (
      organization_id, mailbox_id, user_id, can_read, can_send, can_manage, status, granted_by
    )
    values (
      v_invitation.organization_id, v_mailbox.mailbox_id, (select auth.uid()),
      true, true, false, 'active', v_invitation.invited_by
    )
    on conflict (mailbox_id, user_id) do update
      set status = 'active', can_read = true, can_send = true, updated_at = now();

    if v_mailbox.use_as_login_alias then
      select mailboxes.address into v_address
      from public.mailboxes as mailboxes
      where mailboxes.organization_id = v_invitation.organization_id
        and mailboxes.id = v_mailbox.mailbox_id
        and mailboxes.status = 'active';

      if v_address is null then
        raise exception 'A login alias must point to an active mailbox';
      end if;

      insert into private.user_login_aliases (
        login_email, user_id, organization_id, mailbox_id, created_by
      )
      values (
        lower(v_address), (select auth.uid()), v_invitation.organization_id,
        v_mailbox.mailbox_id, v_invitation.invited_by
      );
    end if;
  end loop;

  update public.organization_invitations
  set accepted_at = now(), accepted_by = (select auth.uid()), updated_at = now()
  where id = v_invitation.id;

  return v_invitation.organization_id;
end;
$function$;

revoke all on function public.accept_organization_invitation(text) from public, anon;
grant execute on function public.accept_organization_invitation(text) to authenticated;

create or replace function public.resolve_login_email_for_auth(p_login_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select users.email::text
  from private.user_login_aliases as aliases
  join auth.users as users on users.id = aliases.user_id
  where aliases.login_email = lower(btrim(coalesce(p_login_email, '')))
    and aliases.status = 'active'
    and aliases.verified_at is not null
  limit 1;
$function$;

revoke all on function public.resolve_login_email_for_auth(text) from public, anon, authenticated;
grant execute on function public.resolve_login_email_for_auth(text) to service_role;
