-- Keep the workspace organization name as the single canonical company name.
update public.organization_brand_profiles brand
set brand_name = organization_row.name
from public.organizations organization_row
where organization_row.id = brand.organization_id
  and brand.brand_name is distinct from organization_row.name;

-- Logo objects are public so recipients' email clients can fetch them.
-- Upload, replacement and deletion are restricted to active workspace owners/admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('organization-brand-logos', 'organization-brand-logos', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp']::text[])
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "workspace_brand_logos_public_read" on storage.objects;
create policy "workspace_brand_logos_public_read" on storage.objects
  for select to public using (bucket_id = 'organization-brand-logos');

drop policy if exists "workspace_brand_logos_admin_insert" on storage.objects;
create policy "workspace_brand_logos_admin_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'organization-brand-logos' and exists (
      select 1 from public.organization_memberships membership
      join public.organizations organization_row on organization_row.id = membership.organization_id
      where membership.organization_id::text = (storage.foldername(name))[1]
        and membership.user_id = (select auth.uid()) and membership.status = 'active'
        and membership.role in ('owner', 'admin') and organization_row.status = 'active'
    )
  );

drop policy if exists "workspace_brand_logos_admin_update" on storage.objects;
create policy "workspace_brand_logos_admin_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'organization-brand-logos' and exists (
      select 1 from public.organization_memberships membership
      join public.organizations organization_row on organization_row.id = membership.organization_id
      where membership.organization_id::text = (storage.foldername(name))[1]
        and membership.user_id = (select auth.uid()) and membership.status = 'active'
        and membership.role in ('owner', 'admin') and organization_row.status = 'active'
    )
  ) with check (
    bucket_id = 'organization-brand-logos' and exists (
      select 1 from public.organization_memberships membership
      join public.organizations organization_row on organization_row.id = membership.organization_id
      where membership.organization_id::text = (storage.foldername(name))[1]
        and membership.user_id = (select auth.uid()) and membership.status = 'active'
        and membership.role in ('owner', 'admin') and organization_row.status = 'active'
    )
  );

drop policy if exists "workspace_brand_logos_admin_delete" on storage.objects;
create policy "workspace_brand_logos_admin_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'organization-brand-logos' and exists (
      select 1 from public.organization_memberships membership
      join public.organizations organization_row on organization_row.id = membership.organization_id
      where membership.organization_id::text = (storage.foldername(name))[1]
        and membership.user_id = (select auth.uid()) and membership.status = 'active'
        and membership.role in ('owner', 'admin') and organization_row.status = 'active'
    )
  );
