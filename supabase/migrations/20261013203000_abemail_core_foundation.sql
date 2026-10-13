-- Commercial ABEmail core foundation.
-- Additive migration: the initial project contains no application tables.
-- No customer-facing routes use these tables until authentication/membership is wired.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique
    check (slug = lower(slug) and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'invited'
    check (status in ('invited', 'active', 'suspended', 'removed')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_memberships_user_status_idx
  on public.organization_memberships (user_id, status, organization_id);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  email text not null check (email = lower(btrim(email))),
  company text,
  role text,
  phone text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index contacts_organization_normalized_email_idx
  on public.contacts (organization_id, lower(email));
create index contacts_organization_name_idx
  on public.contacts (organization_id, lower(name));

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  appearance_mode text not null default 'system'
    check (appearance_mode in ('light', 'dark', 'system')),
  design_theme text not null default 'supabase'
    check (design_theme in (
      'claude', 'discord', 'supabase', 'vercel', 'mono',
      'notebook', 'light-green', 'zen', 'astro-vista', 'whatsapp'
    )),
  language text not null default 'en',
  time_zone text not null default 'Africa/Lagos',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- These narrowly scoped helpers avoid recursive membership policies. They live
-- in a non-exposed schema, use a fixed empty search_path, and only read membership.
create or replace function private.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$function$;

create or replace function private.has_org_role(
  target_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role = any (allowed_roles)
  );
$function$;

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

create or replace function private.prevent_contact_tenant_reassignment()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.organization_id is distinct from old.organization_id
     or new.created_by is distinct from old.created_by then
    raise exception 'Contact tenant and creator are immutable';
  end if;
  return new;
end;
$function$;

revoke all on function private.is_org_member(uuid) from public, anon, authenticated;
revoke all on function private.has_org_role(uuid, text[]) from public, anon, authenticated;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.prevent_contact_tenant_reassignment() from public, anon, authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;

create trigger organizations_touch_updated_at
  before update on public.organizations
  for each row execute function private.touch_updated_at();

create trigger memberships_touch_updated_at
  before update on public.organization_memberships
  for each row execute function private.touch_updated_at();

create trigger contacts_touch_updated_at
  before update on public.contacts
  for each row execute function private.touch_updated_at();

create trigger contacts_prevent_tenant_reassignment
  before update of organization_id, created_by on public.contacts
  for each row execute function private.prevent_contact_tenant_reassignment();

create trigger user_preferences_touch_updated_at
  before update on public.user_preferences
  for each row execute function private.touch_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.contacts enable row level security;
alter table public.user_preferences enable row level security;

revoke all on table public.organizations from public, anon, authenticated;
revoke all on table public.organization_memberships from public, anon, authenticated;
revoke all on table public.contacts from public, anon, authenticated;
revoke all on table public.user_preferences from public, anon, authenticated;

grant select on table public.organizations to authenticated;
grant select on table public.organization_memberships to authenticated;
grant select, insert, update, delete on table public.contacts to authenticated;
grant select, insert, update, delete on table public.user_preferences to authenticated;

create policy organizations_read_for_members
  on public.organizations
  for select to authenticated
  using (private.is_org_member(id));

create policy memberships_read_self_or_org_admin
  on public.organization_memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_org_role(organization_id, array['owner', 'admin']::text[])
  );

create policy contacts_read_for_members
  on public.contacts
  for select to authenticated
  using (private.is_org_member(organization_id));

create policy contacts_insert_for_members
  on public.contacts
  for insert to authenticated
  with check (
    private.is_org_member(organization_id)
    and created_by = (select auth.uid())
  );

create policy contacts_update_for_members
  on public.contacts
  for update to authenticated
  using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

create policy contacts_delete_for_members
  on public.contacts
  for delete to authenticated
  using (private.is_org_member(organization_id));

create policy user_preferences_read_own
  on public.user_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_preferences_insert_own
  on public.user_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy user_preferences_update_own
  on public.user_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy user_preferences_delete_own
  on public.user_preferences
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- The existing event-trigger function is callable only by PostgreSQL event
-- triggers. Remove unnecessary direct API grants that caused Supabase warnings.
do $block$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$block$;
