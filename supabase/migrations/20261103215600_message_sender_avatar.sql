-- Persist only the verified public sender logo URL carried by ABEmail-to-ABEmail mail.
-- The value is trusted only after the inbound X-ABEmail-Sender-Avatar signature is checked.
alter table public.email_messages
  add column if not exists sender_avatar_url text;

comment on column public.email_messages.sender_avatar_url is
  'Optional public sender logo URL. Inbound values are set only after verifying the signed ABEmail sender-avatar headers; null falls back to a public sender avatar lookup.';
