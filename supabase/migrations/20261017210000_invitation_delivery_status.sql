-- Track invitation email delivery separately from invitation acceptance.
alter table public.organization_invitations
  add column if not exists delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'delivery_unknown', 'failed')),
  add column if not exists delivery_error_code text,
  add column if not exists sent_at timestamptz;

create index if not exists organization_invitations_pending_delivery_idx
  on public.organization_invitations (organization_id, created_at desc)
  where accepted_at is null and revoked_at is null;
