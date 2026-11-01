-- Freeze branded email content and the exact workspace identity used when it is scheduled.
-- This is additive: existing plain-text scheduled messages remain unchanged.

alter table public.scheduled_email_messages
  add column design_content_json jsonb,
  add column design_brand_profile_json jsonb;

alter table public.scheduled_email_messages
  add constraint scheduled_email_design_payload_check check (
    (
      design_content_json is null
      and design_brand_profile_json is null
    )
    or
    (
      design_content_json is not null
      and design_brand_profile_json is not null
      and jsonb_typeof(design_content_json) = 'object'
      and design_content_json ->> 'version' = '1'
      and case
        when jsonb_typeof(design_content_json -> 'blocks') = 'array'
          then jsonb_array_length(design_content_json -> 'blocks') between 1 and 100
        else false
      end
      and pg_column_size(design_content_json) <= 524288
      and jsonb_typeof(design_brand_profile_json) = 'object'
      and pg_column_size(design_brand_profile_json) <= 16384
    )
  );

create or replace function private.prevent_scheduled_email_payload_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.organization_id is distinct from old.organization_id
    or new.mailbox_id is distinct from old.mailbox_id
    or new.user_id is distinct from old.user_id
    or new.to_address is distinct from old.to_address
    or new.subject is distinct from old.subject
    or new.body_text is distinct from old.body_text
    or new.design_content_json is distinct from old.design_content_json
    or new.design_brand_profile_json is distinct from old.design_brand_profile_json
  then
    raise exception 'Scheduled email payload is immutable';
  end if;
  return new;
end;
$function$;

revoke all on function private.prevent_scheduled_email_payload_mutation() from public, anon, authenticated;

create trigger scheduled_email_payload_immutable
  before update on public.scheduled_email_messages
  for each row execute function private.prevent_scheduled_email_payload_mutation();

comment on column public.scheduled_email_messages.design_content_json is
  'Validated, immutable versioned block content for a designed scheduled email.';
comment on column public.scheduled_email_messages.design_brand_profile_json is
  'Safe organization brand-profile snapshot captured when the designed email is scheduled; never reread from mutable profile at send time.';
