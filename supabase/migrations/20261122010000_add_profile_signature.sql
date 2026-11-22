-- Stores each employee's signature (a small PNG as a data URL) so it can be
-- printed in the signature (ސޮއި) columns of their OT sheet.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
alter table public.profiles
  add column if not exists signature text;
