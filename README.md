# Crossword App

A shareable crossword puzzle web app. Generate 9x9 crossword puzzles in your browser, share them via unique URLs, and solve puzzles others have created.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Database:** Supabase (Postgres)
- **Auth:** NextAuth.js with Google OAuth
- **Testing:** Vitest (unit), Playwright (E2E)
- **Package Manager:** pnpm

## Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- A [Supabase](https://supabase.com) project
- A [Google Cloud](https://console.cloud.google.com) OAuth 2.0 client

## Local Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` with your credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

NEXTAUTH_SECRET=your-secret          # Generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
```

### 3. Set up the database

Run the migration SQL against your Supabase project. You can do this in the Supabase dashboard SQL editor:

```bash
# The migration file is at:
supabase/migrations/001_initial.sql
```

This creates the `users` and `puzzles` tables with Row Level Security policies.

### 4. Build the word list

The crossword engine needs a word list served as JSON. Build it from the SQLite source:

```bash
pnpm build:wordlist
```

This reads `wordlist.db` and writes `public/wordlist.json`.

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. **Generate** -- Click "Generate Crossword" on the homepage. Puzzle generation runs in a Web Worker.
2. **Share** -- Click "Share" to get a unique URL. Requires Google sign-in.
3. **Solve** -- Open a shared URL to play. Type letters, use arrow keys to navigate, Tab to jump between clues. Confetti on completion.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm test` | Run all tests |
| `pnpm test:engine` | Run engine unit tests only |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm lint` | ESLint |
| `pnpm build:wordlist` | Rebuild `public/wordlist.json` from `wordlist.db` |
| `pnpm import:clues` | Import clues from an external SQLite DB (`new-crossword_clues.db`) into `wordlist.db` |

## Project Structure

```
src/
  engine/       # Standalone crossword engine (zero UI deps, runs in Web Worker)
  state/        # Puzzle solve state manager (reducer + timer)
  hooks/        # React hooks (Web Worker lifecycle)
  components/   # UI components (grid, clues, player chrome)
  app/          # Next.js App Router pages and API routes
  lib/          # Auth config, DB client, share utilities
  styles/       # CSS
```

The engine (`src/engine/`) is a firewall boundary -- it has no React, Next.js, or browser API imports (except `worker.ts`). All game logic lives here.

## Architecture

- **Puzzle generation** is entirely client-side, running in a Web Worker
- **The server** is a thin persistence layer (Supabase) for sharing puzzles
- **Solution validation** happens in the browser -- solutions are obfuscated (not encrypted) and shipped to the client
- **No cleartext answers** appear in the player view -- the `PlayerPuzzle` type strips answer fields and replaces the grid with a binary pattern
