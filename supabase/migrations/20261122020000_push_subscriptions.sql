-- Devices that want the monthly "submit your OT sheet" reminder (web push).
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  locale text not null default 'dv',
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Each user manages only their own devices. (The monthly sender uses the
-- service-role key on the server, which bypasses these policies.)
drop policy if exists "own subscriptions: select" on public.push_subscriptions;
create policy "own subscriptions: select" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "own subscriptions: insert" on public.push_subscriptions;
create policy "own subscriptions: insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "own subscriptions: update" on public.push_subscriptions;
create policy "own subscriptions: update" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own subscriptions: delete" on public.push_subscriptions;
create policy "own subscriptions: delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);
