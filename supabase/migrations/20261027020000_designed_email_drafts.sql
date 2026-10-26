-- Persist the validated block structure for designed-email drafts.
-- Standard drafts continue to use body_text with a NULL design_content_json.
alter table public.email_drafts
  add column design_content_json jsonb
    check (
      design_content_json is null or (
        jsonb_typeof(design_content_json) = 'object'
        and design_content_json ? 'version'
        and design_content_json ? 'blocks'
        and design_content_json ->> 'version' = '1'
        and case when jsonb_typeof(design_content_json -> 'blocks') = 'array'
          then jsonb_array_length(design_content_json -> 'blocks') between 1 and 100
          else false
        end
        and pg_column_size(design_content_json) <= 262144
      )
    );
