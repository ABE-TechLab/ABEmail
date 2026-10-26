-- Organization-level brand identity and a separate, versioned designed-email library.
-- Existing plain-text email_templates and its user-facing contract remain unchanged.

create table public.organization_brand_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  brand_name text not null default '' check (char_length(brand_name) <= 120),
  logo_url text check (logo_url is null or (char_length(logo_url) <= 2048 and logo_url ~ '^https://[^[:space:]]+$')),
  primary_color text not null default '#2B2B2B' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#D7F36A' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  background_color text not null default '#F3F4F6' check (background_color ~ '^#[0-9A-Fa-f]{6}$'),
  text_color text not null default '#242424' check (text_color ~ '^#[0-9A-Fa-f]{6}$'),
  font_family text not null default 'Arial'
    check (font_family in ('Arial', 'Helvetica', 'Georgia', 'Tahoma', 'Verdana', 'Trebuchet MS')),
  website_url text check (website_url is null or (char_length(website_url) <= 2048 and website_url ~ '^https://[^[:space:]]+$')),
  phone text check (phone is null or char_length(phone) <= 80),
  address text check (address is null or char_length(address) <= 1000),
  social_links jsonb not null default '[]'::jsonb
    check (case when jsonb_typeof(social_links) = 'array' then jsonb_array_length(social_links) <= 8 else false end),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_design_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  subject text not null default '' check (char_length(subject) <= 998),
  description text not null default '' check (char_length(description) <= 500),
  schema_version smallint not null default 1 check (schema_version = 1),
  content_json jsonb not null default '{"version":1,"blocks":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    jsonb_typeof(content_json) = 'object'
    and content_json ? 'version'
    and content_json ? 'blocks'
    and content_json ->> 'version' = schema_version::text
    and case when jsonb_typeof(content_json -> 'blocks') = 'array'
      then jsonb_array_length(content_json -> 'blocks') <= 100
      else false
    end
    and pg_column_size(content_json) <= 262144
  )
);

create index email_design_templates_org_updated_idx
  on public.email_design_templates (organization_id, updated_at desc);
create index email_design_templates_creator_idx
  on public.email_design_templates (created_by);

create or replace function private.prevent_email_design_tenant_reassignment()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Email design tenant is immutable';
  end if;
  return new;
end;
$function$;

create or replace function private.prevent_email_design_creator_reassignment()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Email design creator is immutable';
  end if;
  return new;
end;
$function$;

create or replace function private.touch_email_design_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  if (select auth.uid()) is not null then
    new.updated_by := (select auth.uid());
  end if;
  return new;
end;
$function$;

revoke all on function private.prevent_email_design_tenant_reassignment() from public, anon, authenticated;
revoke all on function private.prevent_email_design_creator_reassignment() from public, anon, authenticated;
revoke all on function private.touch_email_design_updated_at() from public, anon, authenticated;

create trigger organization_brand_profiles_touch_updated_at
  before insert or update on public.organization_brand_profiles
  for each row execute function private.touch_email_design_updated_at();
create trigger organization_brand_profiles_prevent_tenant_reassignment
  before update of organization_id on public.organization_brand_profiles
  for each row execute function private.prevent_email_design_tenant_reassignment();
create trigger email_design_templates_touch_updated_at
  before insert or update on public.email_design_templates
  for each row execute function private.touch_email_design_updated_at();
create trigger email_design_templates_prevent_tenant_reassignment
  before update of organization_id on public.email_design_templates
  for each row execute function private.prevent_email_design_tenant_reassignment();
create trigger email_design_templates_prevent_creator_reassignment
  before update of created_by on public.email_design_templates
  for each row execute function private.prevent_email_design_creator_reassignment();

alter table public.organization_brand_profiles enable row level security;
revoke all on table public.organization_brand_profiles from public, anon, authenticated;
grant select, insert, update on table public.organization_brand_profiles to authenticated;

create policy organization_brand_profiles_read_active_members
  on public.organization_brand_profiles for select to authenticated
  using (
    private.is_org_member(organization_id)
    and exists (
      select 1 from public.organizations as organization_row
      where organization_row.id = organization_brand_profiles.organization_id
        and organization_row.status = 'active'
    )
  );

create policy organization_brand_profiles_insert_org_admins
  on public.organization_brand_profiles for insert to authenticated
  with check (
    private.has_org_role(organization_id, array['owner', 'admin'])
    and exists (
      select 1 from public.organizations as organization_row
      where organization_row.id = organization_brand_profiles.organization_id
        and organization_row.status = 'active'
    )
  );

create policy organization_brand_profiles_update_org_admins
  on public.organization_brand_profiles for update to authenticated
  using (
    private.has_org_role(organization_id, array['owner', 'admin'])
    and exists (
      select 1 from public.organizations as organization_row
      where organization_row.id = organization_brand_profiles.organization_id
        and organization_row.status = 'active'
    )
  )
  with check (
    private.has_org_role(organization_id, array['owner', 'admin'])
    and exists (
      select 1 from public.organizations as organization_row
      where organization_row.id = organization_brand_profiles.organization_id
        and organization_row.status = 'active'
    )
  );

alter table public.email_design_templates enable row level security;
revoke all on table public.email_design_templates from public, anon, authenticated;
grant select, insert, update, delete on table public.email_design_templates to authenticated;

create policy email_design_templates_read_active_members
  on public.email_design_templates for select to authenticated
  using (
    private.is_org_member(organization_id)
    and exists (
      select 1 from public.organizations as organization_row
      where organization_row.id = email_design_templates.organization_id
        and organization_row.status = 'active'
    )
  );

create policy email_design_templates_insert_active_members
  on public.email_design_templates for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.is_org_member(organization_id)
    and exists (
      select 1 from public.organizations as organization_row
      where organization_row.id = email_design_templates.organization_id
        and organization_row.status = 'active'
    )
  );

create policy email_design_templates_update_creator_or_admin
  on public.email_design_templates for update to authenticated
  using (
    private.is_org_member(organization_id)
    and (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner', 'admin']))
    and exists (
      select 1 from public.organizations as organization_row
      where organization_row.id = email_design_templates.organization_id
        and organization_row.status = 'active'
    )
  )
  with check (
    private.is_org_member(organization_id)
    and (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner', 'admin']))
    and exists (
      select 1 from public.organizations as organization_row
      where organization_row.id = email_design_templates.organization_id
        and organization_row.status = 'active'
    )
  );

create policy email_design_templates_delete_creator_or_admin
  on public.email_design_templates for delete to authenticated
  using (
    private.is_org_member(organization_id)
    and (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner', 'admin']))
    and exists (
      select 1 from public.organizations as organization_row
      where organization_row.id = email_design_templates.organization_id
        and organization_row.status = 'active'
    )
  );

comment on table public.organization_brand_profiles is
  'Shared visual identity defaults for outbound designed email in an active organization.';
comment on table public.email_design_templates is
  'Organization-scoped, versioned block-based email designs; distinct from plain-text email_templates.';
