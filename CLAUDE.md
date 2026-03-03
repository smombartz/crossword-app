# CLAUDE.md — Crossword App Project Instructions

## Project Overview

A shareable crossword puzzle web app. Users generate 9×9 crossword puzzles client-side, optionally share them via unique URLs (requires Google sign-in), and others solve them in a browser-based player view with confetti on completion.

**Key architectural principle:** The crossword engine (generation, validation, grid logic) is a standalone module with zero UI or framework dependencies. It runs in a Web Worker. The app shell consumes it through a typed API boundary.

---

## Workflow: Planning & Documentation

1. **After brainstorming** - Save the plan to `docs/plans/YYYY-MM-DD-feature-name.md`
2. **After completing a plan** - Update the plan file (mark as "Implemented"), move it to `docs/plans/completed/`, and update this CLAUDE.md if the feature adds new environment variables, services, or patterns
3. **After completing a feature or build** - Append to `docs/log.md` with a heading of `## YYYY-MM-DD HH:MM — Feature Title` followed by a bullet list of changes, features, fixes, etc.

Plans location: `docs/plans/` (completed plans in `docs/plans/completed/`)
Change log: `docs/log.md`

---

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Custom CSS (`src/styles/crossword-styles.css` + `styleguide.md`)
- **Word List:** `wordlist.db` (SQLite, project root) → `public/wordlist.json` (compact JSON, served to clients). Clues can be bulk-imported from an external DB via `pnpm import:clues`, then `pnpm build:wordlist` regenerates the JSON.
- **Auth:** NextAuth.js / Auth.js with Google OAuth provider
- **Database:** Supabase (Postgres)
- **Deployment:** Vercel
- **Package Manager:** pnpm

---

## Project Structure

```
/
├── CLAUDE.md                          # This file
├── docs/
│   └── crossword-app-prd.md           # App features & architecture
├── src/
│   ├── app/                           # Next.js App Router pages
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # Creator view (/)
│   │   ├── play/
│   │   │   └── [slug]/
│   │   │       └── page.tsx           # Player view
│   │   ├── my-puzzles/
│   │   │   └── page.tsx               # User's puzzle history
│   │   └── api/
│   │       ├── auth/[...nextauth]/
│   │       │   └── route.ts
│   │       └── puzzles/
│   │           ├── route.ts           # POST: create shared puzzle
│   │           └── [slug]/
│   │               └── route.ts       # GET: fetch player puzzle
│   ├── components/                    # React components
│   │   ├── grid/                      # Crossword grid rendering
│   │   ├── clues/                     # Clue list display
│   │   ├── player/                    # Player view chrome
│   │   └── ui/                        # Shared UI primitives
│   ├── engine/                        # ⚠️ STANDALONE — no React, no Next.js imports
│   │   ├── generator.ts              # Grid pattern generation + fill
│   │   ├── validator.ts              # Grid constraint validation
│   │   ├── solution.ts               # Obfuscation/deobfuscation
│   │   ├── numbering.ts              # Entry numbering logic
│   │   ├── types.ts                  # Puzzle, Entry, PlayerPuzzle interfaces
│   │   ├── wordlist.ts               # Word list + clue lookup (in-memory Map)
│   │   └── worker.ts                 # Web Worker entry point
│   ├── state/                         # Puzzle state manager (solve session)
│   │   ├── puzzle-state.ts           # Cursor, selection, direction, input
│   │   └── timer.ts                  # Solve timer logic
│   ├── hooks/                         # Custom React hooks
│   │   └── use-puzzle-generator.ts   # Worker lifecycle + generate API
│   ├── lib/                           # App utilities
│   │   ├── db.ts                     # Supabase client
│   │   ├── auth.ts                   # NextAuth config
│   │   └── share.ts                  # Slug generation, URL building
│   ├── styles/
│   │   └── crossword-styles.css      # All component and layout styles
│   └── types/                         # App-level type definitions
├── wordlist.db                        # SQLite word list + clues (source of truth, not served)
├── public/
│   └── wordlist.json                 # Compact word list (built from wordlist.db)
├── tests/
│   ├── engine/                        # Engine unit tests
│   └── e2e/                           # Playwright E2E tests
├── next.config.ts
├── styleguide.md                      # Design tokens, typography, color palette
├── tsconfig.json
└── package.json
```

---

## Critical Rules

### 1. Engine Isolation

The `src/engine/` directory is a **firewall boundary**. Core engine files (`generator.ts`, `validator.ts`, `solution.ts`, `numbering.ts`, `types.ts`, `wordlist.ts`):

- Must NOT import from `react`, `next`, `next/server`, or any component/UI code.
- Must NOT import from `src/app/`, `src/components/`, `src/lib/`, or `src/state/`.
- Must NOT use `window`, `document`, `fetch`, or any browser/Node API.
- CAN import from `src/engine/` sibling files and npm packages that are pure JS (no DOM).
- CAN be imported by code outside `src/engine/`.

**Exception: `worker.ts`** is the integration boundary between the Web Worker environment and the pure engine. It CAN use Worker APIs (`self.onmessage`, `self.postMessage`, `fetch`) to load `/wordlist.json` and initialize the engine. Core engine functions receive data as arguments — they never fetch anything themselves.

If you need to add framework-dependent logic related to puzzles, put it in `src/lib/` or `src/state/`, not `src/engine/`.

**Test:** The core engine files (everything except `worker.ts`) should be extractable into a standalone npm package with zero changes.

### 2. Server is a Thin Persistence Layer

The API routes (`src/app/api/`) should be minimal. They:

- Store puzzles to Supabase on share.
- Retrieve puzzles from Supabase for the player view.
- Handle auth callbacks.

They do NOT run game logic, generate puzzles, or validate solutions. All of that is client-side.

### 3. Solution Validation is Client-Side

Solutions are obfuscated (not encrypted) and shipped to the client. Validation happens in the browser. There is no server-side validation endpoint. See `docs/crossword-app-prd.md` for the obfuscation approach.

### 4. Answers Never Appear in Cleartext in Player Context

When building the player puzzle object, strip `answer` fields from entries and replace the grid with a pattern array (1/0). The `solutionHash` is the only representation of the answer, and it's obfuscated. The `getPlayerPuzzle()` engine function handles this transformation.

---

## Coding Standards

### TypeScript

- **Strict mode is required.** `"strict": true` in tsconfig.json. No `any` types except in genuinely unavoidable third-party interop.
- Prefer `interface` over `type` for object shapes. Use `type` for unions, intersections, and mapped types.
- All engine functions must have explicit return types. Don't rely on inference for public APIs.
- Use `readonly` for data that shouldn't be mutated, especially puzzle grids and entry arrays.

### React / Next.js

- Use **Server Components** by default. Add `'use client'` only when the component needs interactivity (event handlers, hooks, browser APIs).
- The player grid component and creator view will be client components. Layout, navigation, and static content should be server components.
- Use `next/navigation` for programmatic routing (`useRouter`, `usePathname`), not `next/router`.
- Data fetching in server components should use `fetch` or direct Supabase calls, not `useEffect`.
- For the Web Worker, use `new Worker(new URL('./worker.ts', import.meta.url))` which Next.js/webpack supports natively.

### State Management

- Use React `useState` and `useReducer` for component-level state. No global state library unless complexity demands it.
- The puzzle state manager (`src/state/puzzle-state.ts`) should be a custom hook or a reducer — not a class with side effects.
- Timer state is local to the player view component tree. Don't persist it to a database.

### Styling

- Use the classes defined in `src/styles/crossword-styles.css`. No CSS modules, no styled-components, no inline style objects. Import it in `src/app/layout.tsx`.
- Refer to `styleguide.md` for design tokens (colors, typography, spacing) and component patterns (buttons, cards, tabs, status messages).
- Grid cells use `.grid-cell`, `.black`, `.highlight`, `.active`, and `.cell-number` classes from `src/styles/crossword-styles.css`.
- Dark mode support is not required for v1 but don't hardcode colors that would make it impossible later — use the color values documented in `src/styles/crossword-styles.css`.
- Responsive breakpoint is `640px`. Mobile layout rules are handled by the `@media` block in `src/styles/crossword-styles.css`.

### Error Handling

- Engine generation can fail (no valid fill found). This is expected. Handle it gracefully in the UI — show a retry prompt, not a crash.
- Wrap Web Worker communication in a promise-based API with a timeout (e.g., 60 seconds). If the worker hangs, reject and let the user retry.
- API route errors should return proper HTTP status codes and a `{ error: string }` JSON body.
- Use `try/catch` in async functions. Don't let unhandled promise rejections slip through.

---

## Database Conventions

### Supabase

- Use the Supabase JS client (`@supabase/supabase-js`) for all database operations.
- Server-side (API routes): use `createServerClient` or service role key.
- Client-side: use `createBrowserClient` with anon key (only for read operations on public data).
- Row Level Security (RLS) should be enabled:
  - `puzzles` table: anyone can SELECT shared puzzles; only the creator can INSERT; no UPDATE or DELETE for v1.
  - `users` table: users can only read their own row.

### Naming

- Tables: `snake_case` plural (`users`, `puzzles`).
- Columns: `snake_case` (`share_slug`, `created_at`, `grid_data`).
- TypeScript interfaces use `PascalCase` (`Puzzle`, `User`).
- Map between them explicitly — don't assume camelCase/snake_case auto-conversion.

### IDs

- Use `nanoid` for all generated IDs. Prefix with the entity type: `user_`, `pzl_`.
- Share slugs are 8 characters, URL-safe alphabet: `nanoid(8)`.
- Don't use Supabase's default UUID for public-facing IDs — they're too long for URLs.

---

## Testing Strategy

### Engine Tests (Unit)

- Use Vitest (or Jest). Test the engine functions in isolation.
- **Critical tests:**
  - Every generated grid passes `validateGrid()` — no orphaned letters, no stubs, full symmetry, full connectivity.
  - `obfuscateSolution()` → `deobfuscateSolution()` round-trips correctly.
  - `validateSolution()` returns `true` for correct grids and `false` for incorrect ones.
  - `getPlayerPuzzle()` output contains no cleartext answers.
  - No entry shorter than 3 letters in any generated puzzle.
  - Minimum span of 3 in both directions for every white cell.
- Run engine tests with: `pnpm test:engine`

### Integration / E2E Tests

- Use Playwright for critical user flows:
  - Generate a puzzle → grid appears with clues.
  - Share flow → sign in → URL generated → player view loads.
  - Solve a puzzle correctly → confetti appears.
  - Invalid share slug → 404 page.
- Run E2E tests with: `pnpm test:e2e`

### Test Commands

```bash
pnpm test           # Run all tests
pnpm test:engine    # Engine unit tests only
pnpm test:e2e       # Playwright E2E tests
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
pnpm build:wordlist # Rebuild public/wordlist.json from wordlist.db
pnpm import:clues   # Import clues from new-crossword_clues.db into wordlist.db
```

---

## Development Workflow

### Local Setup

```bash
pnpm install
cp .env.example .env.local     # Fill in Supabase + Google OAuth credentials
pnpm dev                        # Starts Next.js dev server on localhost:3000
```

### Environment Variables

```
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
NEXTAUTH_SECRET=xxx             # Generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
```

### Before Committing

```bash
pnpm lint && pnpm typecheck && pnpm test:engine
```

All three must pass. Don't skip the typecheck — TypeScript strict mode catches real bugs.

## Common Patterns

### Web Worker Communication

The Worker is created once, loads the word list on init, and is reused for all generate calls.

```typescript
// src/engine/worker.ts
import { loadWordList, type WordList } from './wordlist';
import { generatePuzzle } from './generator';

let wordList: WordList | null = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'init') {
    try {
      const response = await fetch('/wordlist.json');
      const data = await response.json();
      wordList = loadWordList(data);        // pure function — builds in-memory Map
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: (err as Error).message });
    }
  }

  if (type === 'generate') {
    try {
      if (!wordList) throw new Error('Word list not loaded');
      const puzzle = await generatePuzzle(wordList, payload.options);
      self.postMessage({ type: 'success', puzzle });
    } catch (err) {
      self.postMessage({ type: 'error', message: (err as Error).message });
    }
  }
};
```

```typescript
// src/hooks/use-puzzle-generator.ts
export function usePuzzleGenerator() {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const worker = new Worker(
      new URL('../engine/worker.ts', import.meta.url)
    );
    workerRef.current = worker;
    worker.onmessage = (e) => {
      if (e.data.type === 'ready') setReady(true);
    };
    worker.postMessage({ type: 'init' });
    return () => worker.terminate();
  }, []);

  const generate = useCallback((options?: GenerateOptions) => {
    return new Promise<Puzzle>((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) return reject(new Error('Worker not initialized'));

      const timeout = setTimeout(() => reject(new Error('Generation timed out')), 60_000);

      worker.onmessage = (e) => {
        if (e.data.type === 'success') { clearTimeout(timeout); resolve(e.data.puzzle); }
        if (e.data.type === 'error') { clearTimeout(timeout); reject(new Error(e.data.message)); }
      };

      worker.postMessage({ type: 'generate', payload: { options } });
    });
  }, []);

  return { generate, ready };   // ready=false while word list is loading
}
```

### Protected API Route

```typescript
// src/app/api/puzzles/route.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  // ... persist to Supabase
}
```

### Grid Cell Component Pattern

```typescript
// Keep cell rendering simple and memoized — there are 169 cells.
// Uses classes from src/styles/crossword-styles.css: .grid-cell, .black, .highlight, .active, .cell-number
const Cell = memo(function Cell({
  letter, isBlack, isSelected, isHighlighted, number, onClick
}: CellProps) {
  const classes = [
    'grid-cell',
    isBlack && 'black',
    isSelected && 'active',
    isHighlighted && !isSelected && 'highlight',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={isBlack ? undefined : onClick}>
      {number && <span className="cell-number">{number}</span>}
      {!isBlack && letter}
    </div>
  );
});
```

---

## Reference Documents

Always consult these before making architectural decisions:

- `docs/crossword-app-prd.md` — App features, auth flow, data model, API contracts, player interaction spec.

When in doubt about whether something belongs in the engine vs. the app shell, check the three-layer architecture diagram in the app PRD.

---

## Don'ts

- **Don't import React or Next.js in `src/engine/`.** This is the most important rule.
- **Don't validate solutions server-side.** It's client-side by design.
- **Don't expose cleartext answers in the player puzzle object.**
- **Don't use `any` to silence TypeScript errors.** Fix the types.
- **Don't put game logic in API routes or components.** It goes in `src/engine/` or `src/state/`.
- **Don't use `useEffect` for data fetching** in server components. Use async server components or route handlers.
- **Don't install a global state manager** (Redux, Zustand, Jotai) unless the app genuinely outgrows `useReducer`. It almost certainly won't for v1.
- **Don't build dark mode for v1.** But don't hardcode colors — use the color values and design tokens from `styleguide.md` so it's addable later.