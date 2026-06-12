# MathFlow Arcade

MathFlow Arcade is a mobile-first installable web app for quick brain games. It keeps the original MathFlow mental math idea and adds a small arcade hub, streak scoring, achievements, local-first progress, Supabase leaderboard sync, and Cloudflare Pages Functions.

## What is included

- Five game modes: Math Sprint, Pattern Match, Memory Grid, Word Scramble, and Reaction Tap.
- Round modes: Timed, Blitz, Practice, and Daily Challenge.
- Mobile PWA install support with `manifest.webmanifest` and `service-worker.js`.
- Local-first persistence using IndexedDB with a localStorage fallback.
- Cloudflare Pages backend at `functions/api/sessions.js`.
- Supabase table migration in `supabase/migrations/20260612000000_create_mathflow_arcade_sessions.sql`.
- Supabase publishable key and URL in `.env.local` and `wrangler.toml`.

## Supabase

The app uses this project:

```txt
NEXT_PUBLIC_SUPABASE_URL=https://zciulgqkqusjxomyapcz.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_t3LKmsyqW22dT4ZMlKWQkg_UIyTziIe
```

The browser never needs a secret key. Every session saves locally first. The Cloudflare function then tries to insert into `public.arcade_sessions`; if network or Supabase is unavailable, the user still keeps progress locally.

Apply the migration before expecting global leaderboard sync:

```sql
-- See supabase/migrations/20260612000000_create_mathflow_arcade_sessions.sql
```

The table has RLS enabled and grants only `select` and `insert` to `anon` and `authenticated`.

## Cloudflare Pages

Recommended build settings:

```txt
Build command: npm run check
Build output directory: /
Root directory: /
```

This repo is a static ES module app, so there is no required bundle step. `wrangler.toml` includes `pages_build_output_dir = "."` so Pages can deploy the current root and the `functions/` backend.

## Local Preview

If Node and npm are installed:

```bash
npm install
npm run preview
```

Then open `http://localhost:4173`.

If npm is not available, any static server pointed at the repository root will work for the client app. Cloudflare Pages is still required to run `/api/sessions` locally.
