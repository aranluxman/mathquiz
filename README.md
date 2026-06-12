# MathFlow Arcade 🎮⚡

A fast, mobile-first mental math arcade. Dark theme by default (light mode in Profile), installable as a PWA, with every session logged to Supabase and a progress graph in the Stats tab.

Files:
- **`index.html`** — the whole app (HTML + CSS + JS in one file)
- **`manifest.webmanifest`, `sw.js`, `icon.svg`, `icon-maskable.svg`** — PWA install + offline support

## Game modes

| Mode | What it is | Best score |
|---|---|---|
| ⭐ **Number Flow** (daily) | Solve 15 typed problems in 90 seconds — one challenge per day, keeps your ⭐ calendar and 🔥 streak going | progress / 15 |
| ⚡ **Math Sprint** | 20 multiple-choice questions in 60s with a streak multiplier (+10 × streak) and power-ups: 🕑 +10s ×2, ◐ 50/50 ×2, ⏭ Skip ×1 | points |
| 🧩 **Pattern Match** | Find the grid that matches the target pattern | matches in 60s |
| 🧠 **Memory Grid** | Classic pairs — flip, remember, match; board reshuffles when cleared | pairs in 60s |
| 🔤 **Word Scramble** | Unscramble words, auto-advance on correct, free skips | words in 60s |
| 👆 **Reaction Tap** | 5 rounds — tap the instant the screen flips green | fastest tap (lower = better) |

Math rules everywhere: subtraction never goes negative, division always lands on a whole number.

## Tabs

- **Home** — daily challenge card with progress ring, game mode list with bests, streak / total score / games played.
- **Challenges** — daily card, last-7-days ⭐ calendar, streak rules.
- **Stats** — Chart.js line graph of your Supabase history with per-game filter chips and a Score ↔ Accuracy toggle, plus best / average / session count.
- **Profile** — name, dark-mode toggle, cloud sync status, install button, lifetime totals.

## Supabase setup

The app is already wired to the project `zciulgqkqusjxomyapcz` and writes to its existing **`arcade_sessions`** table, which already has row-level-security policies allowing anonymous inserts and reads — so there is **no SQL you need to run**.

If you ever point it at a fresh project, create the table with:

```sql
create table public.arcade_sessions (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  device_id         text not null,         -- anonymous per-browser id
  game_id           text not null,         -- sprint | pattern | memory | scramble | reaction | daily
  mode              text not null,         -- standard | daily
  difficulty        text not null,
  time_limit        integer,               -- round length in seconds
  score             integer not null default 0,
  solved            integer not null default 0,
  attempts          integer not null default 0,
  accuracy_pct      numeric not null default 0,
  avg_time_secs     numeric,
  fastest_time_secs numeric,
  max_streak        integer not null default 0,
  duration_secs     numeric,
  metadata          jsonb not null default '{}'::jsonb
);

alter table public.arcade_sessions enable row level security;

create policy "Allow public arcade session inserts" on public.arcade_sessions
  for insert to anon, authenticated with check (true);

create policy "Allow public arcade leaderboard reads" on public.arcade_sessions
  for select to anon, authenticated using (true);
```

Then update the two constants at the top of the `<script>` in `index.html` (search for `SUPABASE CONFIG`):

```js
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_KEY = "sb_publishable_...";   // or the anon public key
```

Both key types are designed to ship in client code — access is controlled by the RLS policies, not by hiding the key. Without credentials the app still works fully; it just shows "Not saved" after rounds.

## Install as an app

Host the files anywhere static (Cloudflare Pages already deploys this repo). On Android/desktop Chrome an **Install** banner appears on the home screen; on iOS Safari use **Share → Add to Home Screen**. The service worker caches the app for offline play (sessions just won't sync until you're back online).
