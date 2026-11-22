-- Lets a weekday slip be marked as a public holiday.
-- Fridays are always treated as holidays by the app, whatever this flag says.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
alter table public.overtime_slips
  add column if not exists is_holiday boolean not null default false;
