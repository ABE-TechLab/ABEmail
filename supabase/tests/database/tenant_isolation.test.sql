begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

-- Entirely synthetic fixture. No real users, provider accounts, domains, or mail are used.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@tenant-a.invalid', 'test-only', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@tenant-b.invalid', 'test-only', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@tenant-a.invalid', 'test-only', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dana@tenant-b.invalid', 'test-only', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eve@outside.invalid', 'test-only', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, status, created_by) values
  ('20000000-0000-4000-8000-000000000001', 'Tenant A', 'tenant-a', 'active', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'Tenant B', 'tenant-b', 'active', '10000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000003', 'Eve Workspace', 'eve-owned-workspace', 'active', '10000000-0000-4000-8000-000000000005');

insert into public.organization_memberships (
  organization_id, user_id, role, status, invited_by, joined_at
) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner', 'active', '10000000-0000-4000-8000-000000000001', now()),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'member', 'active', '10000000-0000-4000-8000-000000000002', now()),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'member', 'active', '10000000-0000-4000-8000-000000000001', now()),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'owner', 'active', '10000000-0000-4000-8000-000000000002', now()),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'admin', 'active', '10000000-0000-4000-8000-000000000002', now()),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', 'owner', 'active', '10000000-0000-4000-8000-000000000005', now());

insert into public.contacts (id, organization_id, name, email, company, created_by, tags) values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Tenant A contact', 'contact@tenant-a.invalid', 'Tenant A', '10000000-0000-4000-8000-000000000001', array['client', 'priority']),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'Tenant B contact', 'contact@tenant-b.invalid', 'Tenant B', '10000000-0000-4000-8000-000000000002', array['vendor']);

insert into public.user_preferences (user_id, appearance_mode, language, time_zone) values
  ('10000000-0000-4000-8000-000000000001', 'light', 'en', 'Africa/Lagos'),
  ('10000000-0000-4000-8000-000000000002', 'dark', 'en', 'Africa/Lagos'),
  ('10000000-0000-4000-8000-000000000003', 'system', 'en', 'Africa/Lagos');

insert into public.organization_domains (id, organization_id, domain, status, created_by, verified_at) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'tenant-a.example.com', 'verified', '10000000-0000-4000-8000-000000000001', now()),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'tenant-b.example.com', 'verified', '10000000-0000-4000-8000-000000000002', now());

insert into public.mailboxes (
  id, organization_id, domain_id, local_part, address, display_name, status, created_by
) values
  ('31000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'owner', 'owner@tenant-a.example.com', 'Tenant A owner', 'active', '10000000-0000-4000-8000-000000000001'),
  ('31000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'team', 'team@tenant-a.example.com', 'Tenant A team', 'active', '10000000-0000-4000-8000-000000000001'),
  ('31000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'team', 'team@tenant-b.example.com', 'Tenant B team', 'active', '10000000-0000-4000-8000-000000000002');

insert into public.mailbox_memberships (
  organization_id, mailbox_id, user_id, can_read, can_send, can_manage, status, granted_by
) values
  ('20000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', true, true, false, 'active', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', true, true, false, 'active', '10000000-0000-4000-8000-000000000002');

insert into public.email_messages (
  id, organization_id, mailbox_id, provider, provider_message_id, direction,
  from_address, to_addresses, subject, body_text, status, idempotency_key,
  request_fingerprint, created_by, sent_at, received_at
) values
  ('60000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001',
   'resend', 're_test_tenant_a_owner', 'outbound', 'owner@tenant-a.example.com', ARRAY['recipient@example.net'],
   'Tenant A owner message', 'Test-only owner message', 'accepted', 'test-a-owner-0001', repeat('a', 64),
   '10000000-0000-4000-8000-000000000001', now(), null),
  ('60000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002',
   'resend', 're_test_tenant_a_team', 'inbound', 'sender@example.net', ARRAY['team@tenant-a.example.com'],
   'Tenant A team message', 'Test-only team message', 'received', null, null,
   null, null, now()),
  ('60000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000003',
   'resend', 're_test_tenant_b_team', 'outbound', 'team@tenant-b.example.com', ARRAY['recipient@example.net'],
   'Tenant B message', 'Test-only tenant B message', 'accepted', 'test-b-team-0001', repeat('b', 64),
   '10000000-0000-4000-8000-000000000002', now(), null);

insert into public.email_message_reminders (
  id, organization_id, mailbox_id, message_id, user_id, reminder_at, note
) values
  ('80000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   '31000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001', now() + interval '1 day', 'Alice follow-up'),
  ('80000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001',
   '31000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000003', now() + interval '2 days', 'Carol follow-up'),
  ('80000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002',
   '31000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000002', now() + interval '3 days', 'Bob follow-up');

insert into public.email_templates (id, organization_id, user_id, name, subject, body_text) values
  ('70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Alice payment reminder', 'Payment reminder', 'Hello, please see the attached payment reminder.'),
  ('70000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Carol follow-up', 'Following up', 'Hello, checking in on this.'),
  ('70000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Bob introduction', '', 'Thank you for reaching out.');

insert into public.organization_invitations (
  id, organization_id, invite_email, role, token_hash, invited_by, expires_at
) values
  ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'eve@outside.invalid', 'member',
    encode(extensions.digest(convert_to('tenant-test-token-a', 'UTF8'), 'sha256'), 'hex'),
    '10000000-0000-4000-8000-000000000001', now() + interval '7 days'),
  ('50000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'someone@tenant-b.invalid', 'member',
    encode(extensions.digest(convert_to('tenant-test-token-b', 'UTF8'), 'sha256'), 'hex'),
    '10000000-0000-4000-8000-000000000002', now() + interval '7 days'),
  ('50000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'admin-invite@tenant-b.invalid', 'admin',
    encode(extensions.digest(convert_to('tenant-test-token-c', 'UTF8'), 'sha256'), 'hex'),
    '10000000-0000-4000-8000-000000000002', now() + interval '7 days');

insert into public.organization_invitation_mailboxes (organization_id, invitation_id, mailbox_id, use_as_login_alias)
values ('20000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002', false);

-- Alice owns Tenant A and is a member of Tenant B with one explicit mailbox grant.
-- Carol is only a member of Tenant A and has just one mailbox assignment.
set local role authenticated;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","email":"alice@tenant-a.invalid"}', true);

select is((select count(*)::integer from public.organizations), 2, 'one identity can access two organizations');
select is((select role from public.organization_memberships where organization_id = '20000000-0000-4000-8000-000000000001' and user_id = '10000000-0000-4000-8000-000000000001'), 'owner', 'role is owner in the first organization');
select is((select role from public.organization_memberships where organization_id = '20000000-0000-4000-8000-000000000002' and user_id = '10000000-0000-4000-8000-000000000001'), 'member', 'the same identity can be a member in the second organization');
select is((select count(*)::integer from public.mailboxes), 3, 'owner sees all own organization mailboxes and only assigned mailboxes in the second');
select is((select count(*)::integer from public.email_messages), 3, 'mail reads include own organization and explicitly granted cross-organization mailbox only');
select is((select count(*)::integer from public.email_message_reminders), 1, 'user sees only their own reminder records across accessible workspaces');
select is((select count(*)::integer from public.email_message_reminders where id = '80000000-0000-4000-8000-000000000002'), 0, 'user cannot read another members reminder in the same workspace');
select is((select count(*)::integer from public.email_message_reminders where organization_id = '20000000-0000-4000-8000-000000000002'), 0, 'user cannot read another members reminder in a second workspace');
with changed_reminders as (
  update public.email_message_reminders set note = 'Cross-user modification'
  where id = '80000000-0000-4000-8000-000000000002'
  returning id
)
select is((select count(*)::integer from changed_reminders), 0, 'user cannot update another members reminder');
with deleted_reminders as (
  delete from public.email_message_reminders where id = '80000000-0000-4000-8000-000000000002'
  returning id
)
select is((select count(*)::integer from deleted_reminders), 0, 'user cannot delete another members reminder');
select throws_ok(
  $reminder_insert$ insert into public.email_message_reminders (organization_id, mailbox_id, message_id, user_id, reminder_at, note)
    values ('20000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003',
      now() + interval '1 day', 'Impersonated reminder')$reminder_insert$,
  '42501',
  null,
  'user cannot create a reminder owned by another member'
);
select throws_ok(
  $reminder_insert$ insert into public.email_message_reminders (organization_id, mailbox_id, message_id, user_id, reminder_at, note)
    values ('20000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
      now() - interval '1 minute', 'Past reminder')$reminder_insert$,
  '22023',
  'Choose a future reminder time within one year',
  'database rejects a reminder set in the past'
);
select throws_ok(
  $reminder_insert$ insert into public.email_message_reminders (organization_id, mailbox_id, message_id, user_id, reminder_at, note)
    values ('20000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
      now() + interval '366 days', 'Reminder too far away')$reminder_insert$,
  '22023',
  'Choose a future reminder time within one year',
  'database rejects a reminder more than one year away'
);
with completed_reminder as (
  update public.email_message_reminders
  set status = 'completed', completed_at = now(), dismissed_at = null
  where id = '80000000-0000-4000-8000-000000000001'
  returning id
)
select is(
  (select id from completed_reminder),
  '80000000-0000-4000-8000-000000000001'::uuid,
  'owner can mark their own reminder complete'
);

select is((select count(*)::integer from public.email_messages where organization_id = '20000000-0000-4000-8000-000000000002'), 1, 'mailbox grant exposes only the assigned mailbox messages in the second organization');
select ok(not has_table_privilege('authenticated', 'public.provider_events', 'select'), 'provider event ledger cannot be read directly by authenticated clients');
select is((select count(*)::integer from public.organization_domains), 1, 'domain metadata is restricted to organizations the user administers');
select is((select count(*)::integer from public.organization_invitations where organization_id = '20000000-0000-4000-8000-000000000002'), 0, 'membership alone does not expose another organization invitations');
select is((select count(*)::integer from public.contacts where organization_id = '20000000-0000-4000-8000-000000000002'), 1, 'member can access tenant contacts in their second organization but only within that tenant');
select is((select tags from public.contacts where id = '40000000-0000-4000-8000-000000000001'), array['client', 'priority']::text[], 'contact tags persist as normalized labels');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'contacts_organization_tags_gin_idx'), 'contact tags have a GIN index for lookup');
select throws_ok(
  $tag_update$ update public.contacts
    set tags = array['a','b','c','d','e','f','g','h','i','j','k','l','m']
    where id = '40000000-0000-4000-8000-000000000001' $tag_update$,
  '23514',
  null,
  'a contact cannot have more than twelve tags'
);
select is((select count(*)::integer from public.email_templates where organization_id = '20000000-0000-4000-8000-000000000001'), 1, 'user can read their own templates but not another member templates');
select is((select count(*)::integer from public.email_templates where organization_id = '20000000-0000-4000-8000-000000000002'), 0, 'workspace membership does not reveal another users private templates');
select is((select name from public.email_templates where id = '70000000-0000-4000-8000-000000000001'), 'Alice payment reminder', 'template content is readable by its owner');
select ok(not has_table_privilege('anon', 'public.email_templates', 'select'), 'anonymous users cannot read saved templates');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'email_templates_owner_updated_idx'), 'saved templates have an owner/workspace listing index');
select throws_ok(
  $$update public.email_templates set user_id = '10000000-0000-4000-8000-000000000003' where id = '70000000-0000-4000-8000-000000000001'$$,
  'P0001',
  null,
  'template owner cannot be reassigned'
);

select ok(not has_table_privilege('authenticated', 'private.user_login_aliases', 'select'), 'login aliases are not directly readable through the Data API');

-- A member can see only their assigned mailbox and cannot inspect a different tenant.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","email":"carol@tenant-a.invalid"}', true);

select is((select count(*)::integer from public.organizations), 1, 'member cannot discover an organization they do not belong to');
select is((select count(*)::integer from public.organization_memberships), 1, 'member sees only their own membership row');
select is((select count(*)::integer from public.organization_memberships where organization_id = '20000000-0000-4000-8000-000000000002'), 0, 'membership rows from another tenant are hidden');
select is((select count(*)::integer from public.contacts where organization_id = '20000000-0000-4000-8000-000000000001'), 1, 'member can read contacts in their organization');
select is((select count(*)::integer from public.contacts where organization_id = '20000000-0000-4000-8000-000000000002'), 0, 'member cannot read another tenant contacts');
select is((select count(*)::integer from public.email_templates where organization_id = '20000000-0000-4000-8000-000000000001'), 1, 'member can read only their own templates in their workspace');
select is((select count(*)::integer from public.email_templates where id = '70000000-0000-4000-8000-000000000001'), 0, 'one member cannot read another members templates');
with changed_templates as (
  update public.email_templates set body_text = 'Cross-user modification'
  where id = '70000000-0000-4000-8000-000000000001'
  returning id
)
select is((select count(*)::integer from changed_templates), 0, 'member cannot update another users template');
with deleted_templates as (
  delete from public.email_templates where id = '70000000-0000-4000-8000-000000000001'
  returning id
)
select is((select count(*)::integer from deleted_templates), 0, 'member cannot delete another users template');
select throws_ok(
  $$insert into public.email_templates (organization_id, user_id, name, subject, body_text)
    values ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'Injected template', '', 'not allowed')$$,
  '42501',
  null,
  'member cannot save a template outside their workspace'
);
with changed as (
  update public.contacts set name = 'Cross-tenant modification'
  where id = '40000000-0000-4000-8000-000000000002'
  returning id
)
select is((select count(*)::integer from changed), 0, 'member cannot update another tenant contact');
with deleted as (
  delete from public.contacts where id = '40000000-0000-4000-8000-000000000002'
  returning id
)
select is((select count(*)::integer from deleted), 0, 'member cannot delete another tenant contact');
select is((select count(*)::integer from public.mailboxes), 1, 'member sees only their assigned mailbox');
select is((select count(*)::integer from public.email_messages), 1, 'member sees only messages in their assigned mailbox');
select is((select count(*)::integer from public.email_message_reminders), 1, 'member sees their own reminder on their assigned mailbox');
select is((select count(*)::integer from public.email_message_reminders where id = '80000000-0000-4000-8000-000000000001'), 0, 'member cannot read the workspace owner reminder');
select is((select count(*)::integer from public.email_message_reminders where organization_id = '20000000-0000-4000-8000-000000000002'), 0, 'member cannot read reminders from another tenant');

select is((select subject from public.email_messages), 'Tenant A team message', 'member cannot infer the other mailbox messages');
select is((select address from public.mailboxes), 'team@tenant-a.example.com', 'assigned mailbox address is the one shown to the member');
select is((select count(*)::integer from public.organization_domains), 0, 'regular members cannot read DNS verification details');
select is((select count(*)::integer from public.organization_invitations), 0, 'regular members cannot read organization invitations');
select is((select count(*)::integer from public.user_preferences where user_id = '10000000-0000-4000-8000-000000000002'), 0, 'users cannot read another user preferences');
select throws_ok(
  $$insert into public.contacts (organization_id, name, email, created_by)
    values ('20000000-0000-4000-8000-000000000002', 'Injected', 'injected@tenant-b.invalid', '10000000-0000-4000-8000-000000000003')$$,
  '42501',
  null,
  'member cannot insert a record into a different tenant'
);
select throws_ok(
  $$insert into public.organization_domains (organization_id, domain, status, created_by)
    values ('20000000-0000-4000-8000-000000000002', 'unauthorized.example.com', 'pending_verification', '10000000-0000-4000-8000-000000000003')$$,
  '42501',
  null,
  'member cannot create a domain outside their organization'
);

-- An organization administrator can invite members, but cannot grant admin role.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","email":"dana@tenant-b.invalid"}', true);

select lives_ok(
  $$insert into public.organization_invitations (
      organization_id, invite_email, role, token_hash, invited_by, expires_at
    ) values (
      '20000000-0000-4000-8000-000000000002', 'new-member@tenant-b.invalid', 'member',
      repeat('4', 64), '10000000-0000-4000-8000-000000000004', now() + interval '7 days'
    )$$,
  'admin can invite a member inside their organization'
);
select throws_ok(
  $$insert into public.organization_invitations (
      organization_id, invite_email, role, token_hash, invited_by, expires_at
    ) values (
      '20000000-0000-4000-8000-000000000002', 'unauthorized-admin@tenant-b.invalid', 'admin',
      repeat('5', 64), '10000000-0000-4000-8000-000000000004', now() + interval '7 days'
    )$$,
  '42501',
  null,
  'organization administrator cannot grant administrator role'
);
with changed as (
  update public.organization_invitations
  set revoked_at = now()
  where id = '50000000-0000-4000-8000-000000000003'
  returning id
)
select is((select count(*)::integer from changed), 0, 'administrator cannot revoke an owner-created administrator invitation');

-- Owners can still assign administrators in their own organization.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","email":"alice@tenant-a.invalid"}', true);

select lives_ok(
  $$insert into public.organization_invitations (
      organization_id, invite_email, role, token_hash, invited_by, expires_at
    ) values (
      '20000000-0000-4000-8000-000000000001', 'new-admin@tenant-a.invalid', 'admin',
      repeat('6', 64), '10000000-0000-4000-8000-000000000001', now() + interval '7 days'
    )$$,
  'organization owner can invite an administrator in their own organization'
);

-- Accepting a valid invitation preserves the user identity across their new tenant.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated","email":"eve@outside.invalid"}', true);

select is(
  public.accept_organization_invitation('tenant-test-token-a'),
  '20000000-0000-4000-8000-000000000001'::uuid,
  'invitation acceptance joins the invited organization'
);
select is((select count(*)::integer from public.organizations), 2, 'one account can own one organization and join another');
select is((select role from public.organization_memberships where organization_id = '20000000-0000-4000-8000-000000000001' and user_id = '10000000-0000-4000-8000-000000000005'), 'member', 'invitation membership role is limited to the invited organization');
select is((select role from public.organization_memberships where organization_id = (select id from public.organizations where slug = 'eve-owned-workspace') and user_id = '10000000-0000-4000-8000-000000000005'), 'owner', 'the same account retains ownership of its own organization');
select is((select role from public.organization_memberships where organization_id = '20000000-0000-4000-8000-000000000001' and user_id = '10000000-0000-4000-8000-000000000005'), 'member', 'invitation grants only the invited role');
select is((select count(*)::integer from public.mailboxes), 1, 'invitation grants only the explicitly assigned mailbox');
select is((select address from public.mailboxes), 'team@tenant-a.example.com', 'the invited user sees the mailbox assigned by the invitation');

select * from finish();
rollback;
