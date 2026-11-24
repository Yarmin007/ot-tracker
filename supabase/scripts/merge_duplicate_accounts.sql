-- Merge two accounts that belong to the same person (e.g. one made with email +
-- password, one with Google). NOT a migration: run by hand, one step at a time,
-- in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Why it happens: Supabase only joins sign-ins whose email is exactly the same.
-- Gmail ignores dots and capitals ("ali.hassan@gmail.com" = "AliHassan@gmail.com"),
-- so the same inbox can end up as two separate accounts here.

-- STEP 1: find look-alike accounts (same address once dots/case are ignored).
select u.id, u.email, u.created_at, u.last_sign_in_at,
       (select string_agg(i.provider, ', ') from auth.identities i where i.user_id = u.id) as sign_in_methods,
       (select count(*) from public.overtime_slips s where s.user_id = u.id) as entries
from auth.users u
where lower(replace(split_part(u.email, '@', 1), '.', '')) || '@' || lower(split_part(u.email, '@', 2)) in (
  select lower(replace(split_part(email, '@', 1), '.', '')) || '@' || lower(split_part(email, '@', 2))
  from auth.users group by 1 having count(*) > 1
)
order by 1;

-- STEP 2: fill in the two emails below and run this block.
--   keep_email:   the account to keep (usually the one with the most entries)
--   remove_email: the duplicate. Its entries move to keep_email, then it is deleted.
-- Afterwards, sign in to the kept account and use Settings -> "Connect Google"
-- or "Set a password" so both sign-in methods open the same account.
do $$
declare
  keep_email   text := 'KEEP@example.com';
  remove_email text := 'REMOVE@example.com';
  keep_id   uuid;
  remove_id uuid;
begin
  select id into keep_id   from auth.users where lower(email) = lower(keep_email);
  select id into remove_id from auth.users where lower(email) = lower(remove_email);
  if keep_id is null or remove_id is null then raise exception 'Email not found'; end if;
  if keep_id = remove_id then raise exception 'Both emails are the same account'; end if;

  update public.overtime_slips set user_id = keep_id where user_id = remove_id;
  delete from public.push_subscriptions where user_id = remove_id;
  -- Keep the kept account's profile; only fill in what it is missing.
  update public.profiles k set
    full_name      = coalesce(nullif(k.full_name, ''), r.full_name),
    designation    = coalesce(nullif(k.designation, ''), r.designation),
    record_card_no = coalesce(nullif(k.record_card_no, ''), r.record_card_no),
    basic_salary   = coalesce(k.basic_salary, r.basic_salary),
    signature      = coalesce(k.signature, r.signature),
    avatar_url     = coalesce(k.avatar_url, r.avatar_url)
  from public.profiles r
  where k.id = keep_id and r.id = remove_id;
  delete from public.profiles where id = remove_id;
  delete from auth.users where id = remove_id;
  raise notice 'Merged % into %', remove_email, keep_email;
end $$;
