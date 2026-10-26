-- Add the shared default footer copy to the organization-level branded email profile.
alter table public.organization_brand_profiles
  add column default_footer_text text not null default ''
  check (char_length(default_footer_text) <= 4000);
