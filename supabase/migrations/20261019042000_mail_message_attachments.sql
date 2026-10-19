alter table public.email_messages
  add column if not exists cc_addresses text[] not null default '{}'::text[],
  add column if not exists reply_to_addresses text[] not null default '{}'::text[];

alter table public.email_drafts drop constraint if exists email_drafts_to_address_check;
alter table public.email_drafts add constraint email_drafts_to_address_check
  check (char_length(to_address) <= 4000);

-- Private, tenant-scoped email attachments for received and sent messages.
-- File bytes live in a private Supabase Storage bucket; browser clients never receive the service key.
insert into storage.buckets (id, name, public, file_size_limit)
values ('mail-attachments', 'mail-attachments', false, 4194304)
on conflict (id) do update
set public = false, file_size_limit = 4194304;

create table public.email_message_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  mailbox_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  message_id uuid,
  provider_attachment_id text,
  filename text not null check (char_length(btrim(filename)) between 1 and 255),
  content_type text not null default 'application/octet-stream'
    check (char_length(content_type) between 1 and 160),
  size_bytes integer not null check (size_bytes between 1 and 4194304),
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  foreign key (organization_id, mailbox_id)
    references public.mailboxes(organization_id, id) on delete cascade,
  foreign key (organization_id, mailbox_id, message_id)
    references public.email_messages(organization_id, mailbox_id, id) on delete cascade,
  check (
    (message_id is null and user_id is not null and expires_at is not null)
    or (message_id is not null and expires_at is null)
  )
);

create unique index email_message_attachments_provider_id_idx
  on public.email_message_attachments (message_id, provider_attachment_id)
  where message_id is not null and provider_attachment_id is not null;

create index email_message_attachments_message_idx
  on public.email_message_attachments (organization_id, mailbox_id, message_id, created_at)
  where message_id is not null;
create index email_message_attachments_pending_idx
  on public.email_message_attachments (user_id, organization_id, mailbox_id, expires_at)
  where message_id is null;

alter table public.email_message_attachments enable row level security;
revoke all on table public.email_message_attachments from public, anon, authenticated;
grant select on table public.email_message_attachments to authenticated;

create policy email_message_attachments_read_authorized_mailboxes
  on public.email_message_attachments for select to authenticated
  using (
    message_id is not null
    and private.is_org_member(organization_id)
    and exists (
      select 1
      from public.organizations as organization_row
      join public.mailboxes as mailbox_row
        on mailbox_row.organization_id = organization_row.id
      where organization_row.id = email_message_attachments.organization_id
        and organization_row.status = 'active'
        and mailbox_row.id = email_message_attachments.mailbox_id
        and mailbox_row.status = 'active'
        and (
          private.has_org_role(organization_row.id, array['owner', 'admin']::text[])
          or exists (
            select 1 from public.mailbox_memberships as grant_row
            where grant_row.organization_id = email_message_attachments.organization_id
              and grant_row.mailbox_id = email_message_attachments.mailbox_id
              and grant_row.user_id = (select auth.uid())
              and grant_row.status = 'active'
              and grant_row.can_read
          )
        )
    )
  );

comment on table public.email_message_attachments is
  'Metadata for private email attachments. Binary files stay in the private mail-attachments Storage bucket; all writes/downloads pass through authorized server routes.';
