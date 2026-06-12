# MathFlow ⚡

A fast, flashcard-style mental math speed drill. Dark theme by default (with a light-mode toggle), stats logged to Supabase, and a progress graph so you can watch yourself improve.

The whole app is a single file: **`index.html`**. Open it in a browser or drop it on any static host.

## Features

- **Difficulty modes** — Easy / Medium / Hard presets, plus a Custom mode where you set each operation's min–max range by hand.
- **Operations** — toggle Addition, Subtraction, Multiplication, Division on/off in any combination. Subtraction never goes negative; division always lands on a whole number.
- **Speed-first gameplay** — one big centered problem, auto-focused numeric input, instant auto-advance the moment your answer is correct. You can also press **Enter** to submit manually.
- **Instant feedback** — a green pulse on the score for correct answers, a red shake on the input for wrong ones, plus screen-reader announcements.
- **Best-score system** — your best score for each difficulty + time-limit combo is saved locally and shown on the settings and results screens, with a "🏆 New best" badge when you beat it.
- **Results + stats** — accuracy, average and fastest solve time, automatic Supabase logging, and a Chart.js progress graph (toggle between problems solved and accuracy) with best/average/total summaries.
- **Accessible & responsive** — semantic landmarks, labelled controls, visible focus rings, live regions, reduced-motion support, and a mobile-first layout that scales up to desktop.

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

-- The app uses a public client-side key (no login), so allow anonymous
-- inserts and reads via Row Level Security policies.
alter table public.sessions enable row level security;

create policy "Allow anon insert" on public.sessions
  for insert to anon with check (true);

create policy "Allow anon read" on public.sessions
  for select to anon using (true);
```

> Note: with a public client key and these policies, anyone who has your hosted URL can write to and read this table. That's fine for a personal practice app — if you ever want it locked down, add Supabase Auth and scope the policies to `auth.uid()`.

## 2. Supabase credentials

The project URL and publishable key are already filled in at the **top of the `<script>` section** of `index.html` (search for `SUPABASE CONFIG`):

```js
const SUPABASE_URL = "https://....supabase.co";
const SUPABASE_KEY = "sb_publishable_...";
```

To point the app at a different project, replace these with the values from your Supabase dashboard under **Project Settings → API** (the "Project URL" and either the "anon public" key or a "publishable" `sb_publishable_...` key). Both key types are designed to ship in client-side code — your data is protected by the Row Level Security policies above, not by keeping the key secret.

If the URL is left blank, the app still runs fully — it just shows "Not saved" after each round instead of logging to the database.

## 3. Play

- Pick a difficulty, choose which operations are on, set a time limit, and hit **Start**.
- Type answers — correct ones advance instantly (or press **Enter** to submit).
- When time runs out you get your results, the session is saved, and the 📈 stats screen graphs your history.
- The ☀️/🌙 button in the header switches between dark and light mode.
