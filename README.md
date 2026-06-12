# MathFlow ⚡

A fast, flashcard-style mental math speed drill. Dark theme by default (with a light-mode toggle), stats logged to Supabase, and a progress graph so you can watch yourself improve.

The whole app is a single file: **`index.html`**. Open it in a browser or drop it on any static host.

## 1. Create the Supabase table

In your Supabase dashboard, open **SQL Editor**, paste this, and run it:

```sql
-- Stores one row per completed round.
create table public.sessions (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),  -- when the round was played
  operations    text[]      not null,                -- e.g. {add, mul}
  time_limit    integer     not null,                -- round length in seconds
  total_solved  integer     not null,                -- problems answered correctly
  accuracy_pct  numeric     not null,                -- 0–100
  avg_time_secs numeric     not null                 -- average seconds per problem
);

-- The app uses the public anon key (no login), so allow anonymous
-- inserts and reads via Row Level Security policies.
alter table public.sessions enable row level security;

create policy "Allow anon insert" on public.sessions
  for insert to anon with check (true);

create policy "Allow anon read" on public.sessions
  for select to anon using (true);
```

> Note: with the anon key and these policies, anyone who has your hosted URL can write to and read this table. That's fine for a personal practice app — if you ever want it locked down, add Supabase Auth and scope the policies to `auth.uid()`.

## 2. Paste your Supabase credentials

Open `index.html` and find this block at the **top of the `<script>` section** (search for `SUPABASE CONFIG`):

```js
const SUPABASE_URL = "PASTE_YOUR_SUPABASE_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";
```

Replace both values with your own, found in the Supabase dashboard under **Project Settings → API** (the "Project URL" and the "anon public" key).

Until you do this, the app still works fully — it just shows "Not saved" after each round instead of logging to the database.

## 3. Play

- Pick your operations and number ranges, choose a time limit, hit **Start**.
- Type answers — correct ones advance instantly, no Enter key needed.
- When time runs out you get your results, the session is saved, and the 📈 stats screen graphs your history (toggle between problems solved and accuracy).
- The ☀️/🌙 button in the header switches between dark and light mode.
