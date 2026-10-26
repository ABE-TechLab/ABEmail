begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('91000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'design-owner@tenant-a.invalid', 'test-only', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('91000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'design-member@tenant-a.invalid', 'test-only', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('91000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'design-outsider@tenant-b.invalid', 'test-only', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, status, created_by) values
  ('92000000-0000-4000-8000-000000000001', 'Design Tenant A', 'design-tenant-a', 'active', '91000000-0000-4000-8000-000000000001'),
  ('92000000-0000-4000-8000-000000000002', 'Design Tenant B', 'design-tenant-b', 'active', '91000000-0000-4000-8000-000000000003');

insert into public.organization_memberships (organization_id, user_id, role, status, invited_by, joined_at) values
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'owner', 'active', '91000000-0000-4000-8000-000000000001', now()),
  ('92000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'member', 'active', '91000000-0000-4000-8000-000000000001', now()),
  ('92000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000003', 'owner', 'active', '91000000-0000-4000-8000-000000000003', now());

insert into public.email_design_templates (
  id, organization_id, created_by, updated_by, name, subject, content_json
) values (
  '93000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001',
  'Tenant A welcome', 'Welcome',
  '{"version":1,"blocks":[{"id":"heading","type":"heading","level":1,"text":"Welcome"}]}'::jsonb
), (
  '93000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000003',
  'Tenant B private template', 'Private',
  '{"version":1,"blocks":[]}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","email":"design-owner@tenant-a.invalid"}', true);

select lives_ok(
  $profile_insert$ insert into public.organization_brand_profiles (organization_id, brand_name, logo_url)
    values ('92000000-0000-4000-8000-000000000001', 'Tenant A Brand', 'https://assets.example.com/logo.png')$profile_insert$,
  'organization owner can create a brand profile'
);
select is((select count(*)::integer from public.organization_brand_profiles where organization_id = '92000000-0000-4000-8000-000000000001'), 1, 'owner can read the new profile');
select is((select count(*)::integer from public.email_design_templates where organization_id = '92000000-0000-4000-8000-000000000001'), 1, 'owner sees designs in the active tenant');
select is((select count(*)::integer from public.email_design_templates where organization_id = '92000000-0000-4000-8000-000000000002'), 0, 'owner cannot read another tenant designs');

with updated as (
  update public.organization_brand_profiles
  set primary_color = '#123456'
  where organization_id = '92000000-0000-4000-8000-000000000001'
  returning organization_id
)
select is((select count(*)::integer from updated), 1, 'organization owner can update brand defaults');

select throws_ok(
  $unsafe_logo$ update public.organization_brand_profiles
    set logo_url = 'http://assets.example.com/logo.png'
    where organization_id = '92000000-0000-4000-8000-000000000001'$unsafe_logo$,
  '23514',
  null,
  'brand profile rejects non-HTTPS logo URLs'
);

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated","email":"design-member@tenant-a.invalid"}', true);

select is((select count(*)::integer from public.organization_brand_profiles where organization_id = '92000000-0000-4000-8000-000000000001'), 1, 'active workspace members can read brand defaults');
with changed as (
  update public.organization_brand_profiles
  set primary_color = '#654321'
  where organization_id = '92000000-0000-4000-8000-000000000001'
  returning organization_id
)
select is((select count(*)::integer from changed), 0, 'non-admin members cannot change organization brand defaults');

with changed as (
  update public.email_design_templates
  set name = 'Member cannot edit owner template'
  where id = '93000000-0000-4000-8000-000000000001'
  returning id
)
select is((select count(*)::integer from changed), 0, 'members cannot edit another member design');

select throws_ok(
  $malformed_design$ insert into public.email_design_templates (organization_id, name, content_json)
    values ('92000000-0000-4000-8000-000000000001', 'Missing block list', '{"version":1}'::jsonb)$malformed_design$,
  '23514',
  null,
  'database rejects a design without a block list'
);

select lives_ok(
  $design_insert$ insert into public.email_design_templates (id, organization_id, name, subject, content_json)
    values ('93000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000001',
      'Member design', 'Hello', '{"version":1,"blocks":[]}'::jsonb)$design_insert$,
  'active member can create an organization-scoped designed email'
);

with changed as (
  update public.email_design_templates set name = 'Member design updated'
  where id = '93000000-0000-4000-8000-000000000003'
  returning id
)
select is((select count(*)::integer from changed), 1, 'creator can update their own design');

select throws_ok(
  $reassign_design$ update public.email_design_templates
    set organization_id = '92000000-0000-4000-8000-000000000002'
    where id = '93000000-0000-4000-8000-000000000003'$reassign_design$,
  'P0001',
  'Email design tenant is immutable',
  'creator cannot reassign a design to another tenant'
);

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated","email":"design-outsider@tenant-b.invalid"}', true);

select is((select count(*)::integer from public.organization_brand_profiles where organization_id = '92000000-0000-4000-8000-000000000001'), 0, 'outside user cannot read another tenant brand profile');
select is((select count(*)::integer from public.email_design_templates where organization_id = '92000000-0000-4000-8000-000000000001'), 0, 'outside user cannot read another tenant designs');
select is((select count(*)::integer from public.email_design_templates where organization_id = '92000000-0000-4000-8000-000000000002'), 1, 'user can read designs only from their own tenant');

select * from finish();
rollback;
