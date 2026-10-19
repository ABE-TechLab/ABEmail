-- Per-workspace Resend connection, live domain setup, and tenant-scoped webhooks.
-- Secrets are encrypted in the application before reaching this table and remain service-role only.

create table public.organization_provider_connections (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  provider text not null default 'resend' check (provider = 'resend'),
  api_key_ciphertext text not null,
  api_key_fingerprint text not null unique,
  api_key_last_four text not null check (char_length(api_key_last_four) between 4 and 8),
  webhook_id text,
  webhook_secret_ciphertext text,
  status text not null default 'connected'
    check (status in ('connected', 'webhook_pending', 'error', 'disconnected')),
  last_error_code text,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now(),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'connected' or (webhook_id is not null and webhook_secret_ciphertext is not null))
);

create trigger organization_provider_connections_touch_updated_at
  before update on public.organization_provider_connections
  for each row execute function private.touch_updated_at();

alter table public.organization_provider_connections enable row level security;
revoke all on table public.organization_provider_connections from public, anon, authenticated;
grant all on table public.organization_provider_connections to service_role;

comment on table public.organization_provider_connections is
  'Encrypted customer Resend credentials and per-workspace signed webhook configuration. No browser-role grants.';

alter table public.organization_domains
  add column if not exists provider_domain_id text,
  add column if not exists dns_records jsonb not null default '[]'::jsonb,
  add column if not exists sending_enabled boolean not null default false,
  add column if not exists receiving_enabled boolean not null default false,
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_error_code text;

alter table public.organization_domains
  add constraint organization_domains_dns_records_array_check
  check (jsonb_typeof(dns_records) = 'array');

create unique index if not exists organization_domains_provider_domain_idx
  on public.organization_domains (organization_id, provider_domain_id)
  where provider_domain_id is not null;

-- Resend events are scoped to the sending account/webhook. The same event may be
-- delivered to the legacy Ottawa endpoint and a future tenant endpoint, so dedupe
-- tenant events by organization while preserving the legacy global event ledger.
alter table public.provider_events
  drop constraint if exists provider_events_provider_provider_event_id_key;

create unique index if not exists provider_events_tenant_event_unique_idx
  on public.provider_events (provider, organization_id, provider_event_id)
  where organization_id is not null;

create unique index if not exists provider_events_legacy_event_unique_idx
  on public.provider_events (provider, provider_event_id)
  where organization_id is null;

create index if not exists organization_provider_connections_status_idx
  on public.organization_provider_connections (status, updated_at desc);


-- Workspace-scoped user preferences follow a member across devices without
-- making personal writing defaults visible to other workspace members.
create table public.organization_user_preferences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id),
  check (jsonb_typeof(preferences) = 'object')
);

create trigger organization_user_preferences_touch_updated_at
  before update on public.organization_user_preferences
  for each row execute function private.touch_updated_at();

alter table public.organization_user_preferences enable row level security;
revoke all on table public.organization_user_preferences from public, anon, authenticated;
grant all on table public.organization_user_preferences to service_role;

comment on table public.organization_user_preferences is
  'Personal mail, locale, density, and notification preferences scoped to a workspace. Browser roles never access rows directly.';
