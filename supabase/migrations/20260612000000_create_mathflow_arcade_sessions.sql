create extension if not exists pgcrypto;

create table if not exists public.arcade_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  device_id text not null,
  game_id text not null,
  mode text not null,
  difficulty text not null,
  time_limit integer,
  score integer not null default 0,
  solved integer not null default 0,
  attempts integer not null default 0,
  accuracy_pct numeric not null default 0,
  avg_time_secs numeric,
  fastest_time_secs numeric,
  max_streak integer not null default 0,
  duration_secs numeric,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists arcade_sessions_created_at_idx on public.arcade_sessions (created_at desc);
create index if not exists arcade_sessions_leaderboard_idx on public.arcade_sessions (game_id, difficulty, time_limit, score desc, created_at desc);
create index if not exists arcade_sessions_device_idx on public.arcade_sessions (device_id, created_at desc);

alter table public.arcade_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'arcade_sessions' and policyname = 'Allow public arcade session inserts'
  ) then
    create policy "Allow public arcade session inserts" on public.arcade_sessions
      for insert to anon, authenticated
      with check (
        score >= 0
        and solved >= 0
        and attempts >= 0
        and accuracy_pct >= 0
        and accuracy_pct <= 100
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'arcade_sessions' and policyname = 'Allow public arcade leaderboard reads'
  ) then
    create policy "Allow public arcade leaderboard reads" on public.arcade_sessions
      for select to anon, authenticated
      using (true);
  end if;
end $$;

grant select, insert on table public.arcade_sessions to anon, authenticated;
