-- Use the existing unique message key index instead of keeping a duplicate.
drop index if exists public.email_messages_org_mailbox_id_attachment_fk_idx;

-- Index referencing columns to support draft foreign-key checks and deletes.
create index if not exists email_message_attachments_draft_fk_idx
  on public.email_message_attachments (organization_id, mailbox_id, draft_id);
