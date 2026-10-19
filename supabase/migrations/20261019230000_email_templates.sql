-- Private reusable plain-text message templates owned by each workspace user.
create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  subject text not null default '' check (char_length(subject) <= 998),
  body_text text not null default '' check (char_length(body_text) <= 80000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(subject)) > 0 or char_length(btrim(body_text)) > 0)
);

create index email_templates_owner_updated_idx
  on public.email_templates (organization_id, user_id, updated_at desc);

create or replace function private.prevent_email_template_tenant_reassignment()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.organization_id is distinct from old.organization_id
     or new.user_id is distinct from old.user_id then
    raise exception 'Template tenant and owner are immutable';
  end if;
  return new;
end;
$function$;

revoke all on function private.prevent_email_template_tenant_reassignment() from public, anon, authenticated;

create trigger email_templates_touch_updated_at
  before update on public.email_templates
  for each row execute function private.touch_updated_at();

create trigger email_templates_prevent_tenant_reassignment
  before update of organization_id, user_id on public.email_templates
  for each row execute function private.prevent_email_template_tenant_reassignment();

alter table public.email_templates enable row level security;
revoke all on table public.email_templates from public, anon, authenticated;
grant select, insert, update, delete on table public.email_templates to authenticated;

create policy email_templates_read_own_active_workspace
  on public.email_templates for select to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
    and exists (
      select 1 from public.organizations o
      where o.id = email_templates.organization_id and o.status = 'active'
    )
  );

create policy email_templates_insert_own_active_workspace
  on public.email_templates for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
    and exists (
      select 1 from public.organizations o
      where o.id = email_templates.organization_id and o.status = 'active'
    )
  );

create policy email_templates_update_own_active_workspace
  on public.email_templates for update to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
    and exists (
      select 1 from public.organizations o
      where o.id = email_templates.organization_id and o.status = 'active'
    )
  )
  with check (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
    and exists (
      select 1 from public.organizations o
      where o.id = email_templates.organization_id and o.status = 'active'
    )
  );

create policy email_templates_delete_own_active_workspace
  on public.email_templates for delete to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
    and exists (
      select 1 from public.organizations o
      where o.id = email_templates.organization_id and o.status = 'active'
    )
  );

comment on table public.email_templates is
  'Plain-text reusable templates owned by a user within an active workspace; accessible only to that owner.';
