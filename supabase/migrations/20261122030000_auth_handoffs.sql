-- One-time hand-off of a Google sign-in from Safari to the installed iPhone app.
-- (An app added to the iPhone Home Screen keeps its own cookies, so a Google
-- sign-in completed in Safari has to be passed over.) Rows live for minutes.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
create table if not exists public.auth_handoffs (
  -- SHA-256 of a random secret that only the app knows.
  hash text primary key,
  access_token text not null,
  refresh_token text not null,
  created_at timestamptz not null default now()
);

-- No policies: only the server (service-role key) can read or write.
alter table public.auth_handoffs enable row level security;
