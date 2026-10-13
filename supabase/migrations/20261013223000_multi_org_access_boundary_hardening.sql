-- Require an active organization membership for mailbox access, even if an
-- older mailbox grant remains. Role helpers also honor organization suspension.
-- Apply only after the core and auth/invitation migrations have been reviewed.

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
    join public.organizations as organization
      on organization.id = membership.organization_id
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and organization.status = 'active'
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
    join public.organizations as organization
      on organization.id = membership.organization_id
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role = any (allowed_roles)
      and organization.status = 'active'
  );
$function$;

drop policy if exists mailboxes_read_authorized on public.mailboxes;
create policy mailboxes_read_authorized
  on public.mailboxes for select to authenticated
  using (
    status = 'active'
    and private.is_org_member(organization_id)
    and (
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
    )
  );

drop policy if exists mailbox_memberships_read_self_or_admin on public.mailbox_memberships;
create policy mailbox_memberships_read_self_or_admin
  on public.mailbox_memberships for select to authenticated
  using (
    private.is_org_member(organization_id)
    and (
      user_id = (select auth.uid())
      or private.has_org_role(organization_id, array['owner', 'admin']::text[])
    )
  );

revoke all on function private.is_org_member(uuid) from public, anon;
revoke all on function private.has_org_role(uuid, text[]) from public, anon;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;
