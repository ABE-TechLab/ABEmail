-- Persistent, per-user drafts. Additive only; do not apply to the shared Production project before release.
create table public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mailbox_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  to_address text not null default '',
  subject text not null default '',
  body_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, mailbox_id)
    references public.mailboxes(organization_id, id) on delete cascade,
  check (char_length(to_address) <= 320),
  check (char_length(subject) <= 998),
  check (char_length(body_text) <= 80000)
);

create index email_drafts_user_mailbox_updated_idx
  on public.email_drafts (user_id, organization_id, mailbox_id, updated_at desc);

create trigger email_drafts_touch_updated_at
  before update on public.email_drafts
  for each row execute function private.touch_updated_at();

alter table public.email_drafts enable row level security;
revoke all on table public.email_drafts from public, anon, authenticated;
grant select on table public.email_drafts to authenticated;

create policy email_drafts_read_own_authorized
  on public.email_drafts for select to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
    and exists (
      select 1 from public.mailboxes m
      where m.id = email_drafts.mailbox_id
        and m.organization_id = email_drafts.organization_id
        and m.status = 'active'
        and (
          private.has_org_role(m.organization_id, array['owner', 'admin']::text[])
          or exists (
            select 1 from public.mailbox_memberships mm
            where mm.organization_id = m.organization_id
              and mm.mailbox_id = m.id
              and mm.user_id = (select auth.uid())
              and mm.status = 'active'
              and mm.can_read
          )
        )
    )
  );

comment on table public.email_drafts is
  'Private per-user drafts, isolated by organization and mailbox; independent of sent-message delivery status.';
