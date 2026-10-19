-- Persist attachments with drafts as well as sent/received messages.
create unique index if not exists email_drafts_org_mailbox_id_attachment_fk_idx
  on public.email_drafts (organization_id, mailbox_id, id);

alter table public.email_message_attachments
  add column draft_id uuid;

alter table public.email_message_attachments
  add constraint email_message_attachments_draft_fk
  foreign key (organization_id, mailbox_id, draft_id)
  references public.email_drafts(organization_id, mailbox_id, id)
  on delete cascade;

alter table public.email_message_attachments
  drop constraint if exists email_message_attachments_check;

alter table public.email_message_attachments
  add constraint email_message_attachments_owner_check
  check (
    (message_id is null and draft_id is null and user_id is not null and expires_at is not null)
    or (message_id is null and draft_id is not null and user_id is not null and expires_at is null)
    or (message_id is not null and draft_id is null and expires_at is null)
  );

create index email_message_attachments_draft_idx
  on public.email_message_attachments (user_id, organization_id, mailbox_id, draft_id, created_at)
  where draft_id is not null;

comment on column public.email_message_attachments.draft_id is
  'Optional owner draft. Draft attachment bytes remain private and are linked to the eventual sent message when sending succeeds.';
