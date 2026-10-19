begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(
  exists (select 1 from storage.buckets where id = 'mail-attachments' and public = false),
  'mail attachment bucket is private'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.email_message_attachments'::regclass),
  'attachment metadata has row level security enabled'
);

select ok(
  not has_table_privilege('authenticated', 'public.email_message_attachments', 'insert')
  and not has_table_privilege('authenticated', 'public.email_message_attachments', 'update')
  and not has_table_privilege('authenticated', 'public.email_message_attachments', 'delete'),
  'browser role cannot write attachment metadata directly'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.email_message_attachments'::regclass
      and conname = 'email_message_attachments_draft_fk'
      and contype = 'f'
  ),
  'draft attachment linkage enforces organization and mailbox ownership'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.email_message_attachments'::regclass
      and conname = 'email_message_attachments_owner_check'
      and contype = 'c'
  ),
  'an attachment has exactly one valid owner state: temporary, draft, or message'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'email_messages'
      and column_name in ('cc_addresses', 'reply_to_addresses')
    group by table_name
    having count(*) = 2
  ),
  'email messages preserve CC and Reply-To headers for Reply All'
);

select * from finish();
rollback;
