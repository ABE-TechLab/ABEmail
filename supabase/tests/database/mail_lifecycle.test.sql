begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- Synthetic fixtures only; never use real users, mailboxes, or provider events.
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@lifecycle-a.invalid', 'test-only', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@lifecycle-b.invalid', 'test-only', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000103', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@lifecycle-a.invalid', 'test-only', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, status, created_by) values
  ('20000000-0000-4000-8000-000000000101', 'Lifecycle Tenant A', 'lifecycle-tenant-a', 'active', '10000000-0000-4000-8000-000000000101'),
  ('20000000-0000-4000-8000-000000000102', 'Lifecycle Tenant B', 'lifecycle-tenant-b', 'active', '10000000-0000-4000-8000-000000000102')
on conflict (id) do nothing;

insert into public.organization_memberships (
  organization_id, user_id, role, status, invited_by, joined_at
) values
  ('20000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000101', 'owner', 'active', '10000000-0000-4000-8000-000000000101', now()),
  ('20000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000103', 'member', 'active', '10000000-0000-4000-8000-000000000101', now()),
  ('20000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000102', 'owner', 'active', '10000000-0000-4000-8000-000000000102', now())
on conflict (organization_id, user_id) do nothing;

insert into public.organization_domains (id, organization_id, domain, status, created_by, verified_at) values
  ('30000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000101', 'lifecycle-a.invalid', 'verified', '10000000-0000-4000-8000-000000000101', now()),
  ('30000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000102', 'lifecycle-b.invalid', 'verified', '10000000-0000-4000-8000-000000000102', now())
on conflict (id) do nothing;

insert into public.mailboxes (
  id, organization_id, domain_id, local_part, address, display_name, status, created_by
) values
  ('31000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000101', '30000000-0000-4000-8000-000000000101', 'team', 'team@lifecycle-a.invalid', 'Lifecycle A', 'active', '10000000-0000-4000-8000-000000000101'),
  ('31000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000102', '30000000-0000-4000-8000-000000000102', 'team', 'team@lifecycle-b.invalid', 'Lifecycle B', 'active', '10000000-0000-4000-8000-000000000102')
on conflict (id) do nothing;

insert into public.mailbox_memberships (
  organization_id, mailbox_id, user_id, can_read, can_send, can_manage, status, granted_by
) values (
  '20000000-0000-4000-8000-000000000101',
  '31000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000103',
  true, false, false, 'active', '10000000-0000-4000-8000-000000000101'
) on conflict (mailbox_id, user_id) do nothing;

insert into public.email_messages (
  id, organization_id, mailbox_id, provider, provider_message_id, direction,
  from_address, to_addresses, subject, body_text, status, idempotency_key,
  request_fingerprint, created_by, sent_at, received_at
) values
  ('60000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000101', '31000000-0000-4000-8000-000000000101',
   'resend', 'lifecycle-inbound-a1', 'inbound', 'sender@example.net', array['team@lifecycle-a.invalid'],
   'Lifecycle A inbound one', 'Synthetic inbound body', 'received', null, null, null, null, now()),
  ('60000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000101', '31000000-0000-4000-8000-000000000101',
   'resend', 'lifecycle-inbound-a2', 'inbound', 'sender@example.net', array['team@lifecycle-a.invalid'],
   'Lifecycle A inbound two', 'Synthetic inbound body', 'received', null, null, null, null, now()),
  ('60000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000102', '31000000-0000-4000-8000-000000000102',
   'resend', 'lifecycle-inbound-b1', 'inbound', 'sender@example.net', array['team@lifecycle-b.invalid'],
   'Lifecycle B inbound', 'Synthetic cross-tenant body', 'received', null, null, null, null, now())
on conflict (id) do nothing;

insert into public.scheduled_email_messages (
  id, organization_id, mailbox_id, user_id, to_address, subject, body_text, scheduled_at, status
) values
  ('70000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000101', '31000000-0000-4000-8000-000000000101',
   '10000000-0000-4000-8000-000000000101', 'future@example.net', 'Due scheduled test', 'Synthetic scheduled body', now() - interval '1 minute', 'scheduled'),
  ('70000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000101', '31000000-0000-4000-8000-000000000101',
   '10000000-0000-4000-8000-000000000103', 'member@example.net', 'Member scheduled test', 'Synthetic scheduled body', now() + interval '1 day', 'scheduled'),
  ('70000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000102', '31000000-0000-4000-8000-000000000102',
   '10000000-0000-4000-8000-000000000102', 'other@example.net', 'Other tenant scheduled test', 'Synthetic scheduled body', now() + interval '1 day', 'scheduled')
on conflict (id) do nothing;

-- Owner performs bulk lifecycle actions. Provider status remains unchanged.
set local role authenticated;
-- Scheduled mail remains private to its creator and requires service-side writes.
select is(
  (select count(*)::integer from public.scheduled_email_messages),
  1,
  'owner sees only their own scheduled email'
);
select ok(
  not has_table_privilege('authenticated', 'public.scheduled_email_messages', 'insert')
  and not has_table_privilege('authenticated', 'public.scheduled_email_messages', 'update')
  and not has_table_privilege('authenticated', 'public.scheduled_email_messages', 'delete'),
  'browser role cannot write scheduled email rows directly'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000101","role":"authenticated","email":"alice@lifecycle-a.invalid"}', true);

select is(
  public.update_email_message_lifecycle(
    '20000000-0000-4000-8000-000000000101',
    '31000000-0000-4000-8000-000000000101',
    array['60000000-0000-4000-8000-000000000101'::uuid, '60000000-0000-4000-8000-000000000102'::uuid],
    'archive'
  ),
  2,
  'bulk archive updates both message lifecycle rows'
);
select is(
  (select count(*)::integer from public.email_message_user_state
   where user_id = '10000000-0000-4000-8000-000000000101'
     and archived_at is not null),
  2,
  'archive state is persisted for the acting user'
);
select is(
  (select status from public.email_messages where id = '60000000-0000-4000-8000-000000000102'),
  'received',
  'archiving does not alter provider delivery status'
);

select is(
  public.update_email_message_lifecycle(
    '20000000-0000-4000-8000-000000000101',
    '31000000-0000-4000-8000-000000000101',
    array['60000000-0000-4000-8000-000000000101'::uuid, '60000000-0000-4000-8000-000000000102'::uuid],
    'unarchive'
  ),
  2,
  'bulk unarchive restores both messages to the inbox lifecycle'
);
select is(
  public.update_email_message_lifecycle(
    '20000000-0000-4000-8000-000000000101',
    '31000000-0000-4000-8000-000000000101',
    array['60000000-0000-4000-8000-000000000101'::uuid, '60000000-0000-4000-8000-000000000102'::uuid],
    'trash'
  ),
  2,
  'bulk trash updates both state rows'
);
select is(
  public.update_email_message_lifecycle(
    '20000000-0000-4000-8000-000000000101',
    '31000000-0000-4000-8000-000000000101',
    array['60000000-0000-4000-8000-000000000101'::uuid],
    'restore'
  ),
  1,
  'restore clears trash state for the chosen message'
);
select is(
  (select trashed_at from public.email_message_user_state where user_id = '10000000-0000-4000-8000-000000000101' and message_id = '60000000-0000-4000-8000-000000000101'),
  null::timestamptz,
  'restored message is no longer in Trash'
);
select throws_ok(
  $$select public.update_email_message_lifecycle(
    '20000000-0000-4000-8000-000000000101',
    '31000000-0000-4000-8000-000000000101',
    array['60000000-0000-4000-8000-000000000101'::uuid],
    'permanent_delete'
  )$$,
  '22023',
  'Only messages in Trash can be permanently deleted',
  'permanent delete rejects a message outside Trash'
);

select throws_ok(
  $$select public.update_email_message_lifecycle(
    '20000000-0000-4000-8000-000000000102',
    '31000000-0000-4000-8000-000000000102',
    array['60000000-0000-4000-8000-000000000103'::uuid],
    'star'
  )$$,
  '42501',
  'Message is not available',
  'cross-tenant lifecycle updates are denied'
);

-- A member with an active read grant may manage their personal state only.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000103', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000103","role":"authenticated","email":"carol@lifecycle-a.invalid"}', true);
select is(
  public.update_email_message_lifecycle(
    '20000000-0000-4000-8000-000000000101',
    '31000000-0000-4000-8000-000000000101',
    array['60000000-0000-4000-8000-000000000102'::uuid],
    'star'
  ),
  1,
  'authorized mailbox member can change their own lifecycle state'
);
select is(
  (select count(*)::integer from public.email_message_user_state
   where user_id = '10000000-0000-4000-8000-000000000103'
     and message_id = '60000000-0000-4000-8000-000000000102'
     and is_starred),
  1,
  'star state is scoped to the acting user'
);
select is(
  (select count(*)::integer from public.email_message_user_state
   where user_id = '10000000-0000-4000-8000-000000000101'),
  0,
  'mailbox member cannot read another user lifecycle state'
);
select ok(
  not has_table_privilege('authenticated', 'public.email_message_user_state', 'update')
  and not has_table_privilege('authenticated', 'public.email_message_user_state', 'insert')
  and not has_table_privilege('authenticated', 'public.email_message_user_state', 'delete'),
  'browser role cannot write lifecycle table directly'
);

-- Return to Alice to trash then permanently delete only the already-trashed message.
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000101', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000101","role":"authenticated","email":"alice@lifecycle-a.invalid"}', true);
select is(
  public.update_email_message_lifecycle(
    '20000000-0000-4000-8000-000000000101',
    '31000000-0000-4000-8000-000000000101',
    array['60000000-0000-4000-8000-000000000101'::uuid],
    'trash'
  ),
  1,
  'message can be moved to Trash before permanent deletion'
);
select is(
  public.update_email_message_lifecycle(
    '20000000-0000-4000-8000-000000000101',
    '31000000-0000-4000-8000-000000000101',
    array['60000000-0000-4000-8000-000000000101'::uuid],
    'permanent_delete'
  ),
  1,
  'authorized manager can permanently delete a trashed message'
);
select is(
  (select count(*)::integer from public.email_messages where id = '60000000-0000-4000-8000-000000000101'),
  0,
  'permanent deletion removes only the selected trashed message'
);
select is(
  (select status from public.email_messages where id = '60000000-0000-4000-8000-000000000102'),
  'received',
  'other messages keep their original transport status after deletion'
);

reset role;
select is(
  (select count(*)::integer from public.claim_due_scheduled_email_messages(25)),
  1,
  'worker atomically claims only due scheduled messages'
);
select is(
  (select status from public.scheduled_email_messages where id = '70000000-0000-4000-8000-000000000101'),
  'processing',
  'claimed scheduled message is locked for delivery'
);
select is(
  (select status from public.scheduled_email_messages where id = '70000000-0000-4000-8000-000000000102'),
  'scheduled',
  'future scheduled message is not claimed early'
);

select * from finish();
rollback;
