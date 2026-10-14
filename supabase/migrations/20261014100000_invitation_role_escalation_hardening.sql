-- Prevent organization administrators from inviting or editing invitations
-- that grant the administrator role. Only an organization owner can do that.
-- This also applies through direct Data API writes, not only the team UI.

drop policy if exists organization_invitations_insert_admin
  on public.organization_invitations;

create policy organization_invitations_insert_admin
  on public.organization_invitations for insert to authenticated
  with check (
    private.has_org_role(organization_id, array['owner', 'admin']::text[])
    and (
      role = 'member'
      or private.has_org_role(organization_id, array['owner']::text[])
    )
    and invited_by = (select auth.uid())
    and accepted_at is null
    and accepted_by is null
    and revoked_at is null
    and expires_at > now()
  );

drop policy if exists organization_invitations_update_admin
  on public.organization_invitations;

create policy organization_invitations_update_admin
  on public.organization_invitations for update to authenticated
  using (
    private.has_org_role(organization_id, array['owner', 'admin']::text[])
    and (
      role = 'member'
      or private.has_org_role(organization_id, array['owner']::text[])
    )
  )
  with check (
    private.has_org_role(organization_id, array['owner', 'admin']::text[])
    and (
      role = 'member'
      or private.has_org_role(organization_id, array['owner']::text[])
    )
  );
