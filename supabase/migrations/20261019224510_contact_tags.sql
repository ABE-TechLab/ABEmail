-- Add lightweight contact labels without replacing the existing address-book model.
alter table public.contacts
  add column tags text[] not null default '{}'::text[];

alter table public.contacts
  add constraint contacts_tags_limit_check
  check (cardinality(tags) <= 12);

create index contacts_organization_tags_gin_idx
  on public.contacts using gin (tags);
