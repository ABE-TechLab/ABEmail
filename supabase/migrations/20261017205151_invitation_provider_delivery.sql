-- Correlate Resend delivery events to invitation emails so Settings shows real status.
alter table public.organization_invitations
  add column if not exists provider_message_id text;

alter table public.organization_invitations
  drop constraint if exists organization_invitations_delivery_status_check;

alter table public.organization_invitations
  add constraint organization_invitations_delivery_status_check
  check (delivery_status in (
    'pending',
    'sent',
    'delivery_unknown',
    'failed',
    'delivered',
    'delayed',
    'bounced',
    'complained',
    'suppressed'
  ));

create unique index if not exists organization_invitations_provider_message_unique_idx
  on public.organization_invitations (organization_id, provider_message_id)
  where provider_message_id is not null;
