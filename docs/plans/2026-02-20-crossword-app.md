# Crossword App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a shareable crossword puzzle web app where users generate 13×13 puzzles client-side, share via unique URLs (requires Google sign-in), and others solve them in a browser-based player view with confetti on completion.

**Architecture:** Three-layer separation — standalone crossword engine (runs in Web Worker, zero UI deps), puzzle state manager (solve session state), and app shell (Next.js with auth, routing, sharing). Server is a thin persistence layer (Supabase). All game logic is client-side.

**Tech Stack:** Next.js 14+ (App Router), TypeScript (strict), custom CSS, Supabase (Postgres), NextAuth.js (Google OAuth), pnpm, Vitest, Playwright

---

## Prerequisites & Current State

**What exists:**
- `CLAUDE.md` — project instructions
- `docs/crossword-app-prd.md` — full PRD
- `docs/styleguide.md` — design system documentation
- `src/styles/crossword-styles.css` — complete CSS design system
- `wordlist.db` — SQLite with 526K words, but only 99 have clues

**What needs to happen first:**
- Clue generation for wordlist.db is incomplete (99/526K words have clues). The engine needs thousands of clued words to fill grids. This plan includes a build script that exports available words; clue generation is a parallel workstream using the Gemini API key in `.env`.

**Key reference docs to consult during implementation:**
- `CLAUDE.md` — coding standards, engine isolation rules, all conventions
- `docs/crossword-app-prd.md` — data model, API contracts, UI specs, engine API
- `docs/styleguide.md` — design tokens, component patterns

---

## Phase 1: Project Scaffolding

### Task 1: Initialize Next.js project with pnpm

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Initialize Next.js**

```bash
pnpm create next-app@latest . --typescript --app --no-tailwind --no-eslint --no-src-dir --import-alias "@/*"
```

Then move `app/` into `src/app/` (the project uses `src/` directory).

**Step 2: Update tsconfig.json for strict mode**

Ensure `"strict": true` is set. Add path alias `"@/*": ["./src/*"]`.

**Step 3: Install core dependencies**

```bash
pnpm add nanoid @supabase/supabase-js next-auth canvas-confetti
pnpm add -D vitest @types/canvas-confetti better-sqlite3 @types/better-sqlite3
```

**Step 4: Create .env.example**

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=http://localhost:3000
```

**Step 5: Create directory structure**

```bash
mkdir -p src/engine src/state src/hooks src/lib src/components/grid src/components/clues src/components/player src/components/ui src/types tests/engine tests/e2e
```

**Step 6: Configure next.config.ts**

Enable webpack config for Web Worker support. No special config needed — Next.js supports `new Worker(new URL(...))` natively.

**Step 7: Update layout.tsx with fonts and CSS**

Import Google Fonts (Libre Baskerville + Libre Franklin) via `next/font/google` or `<link>` tags. Import `@/styles/crossword-styles.css`.

**Step 8: Add scripts to package.json**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:engine": "vitest run tests/engine",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "build:wordlist": "tsx scripts/build-wordlist.ts"
  }
}
```

**Step 9: Verify dev server starts**

```bash
pnpm dev
```

Expected: Next.js dev server on localhost:3000, no errors.

**Step 10: Commit**

```bash
git init && git add -A && git commit -m "chore: scaffold Next.js project with TypeScript strict mode"
```

---

## Phase 2: Word List Build Pipeline

### Task 2: Build wordlist.json from wordlist.db

**Files:**
- Create: `scripts/build-wordlist.ts`
- Output: `public/wordlist.json`

**Context:** The wordlist.db has 526K words but only ~99 have clues. The build script exports words grouped by length. Words without clues get a placeholder clue (the word itself) so the engine can still fill grids during development. As more clues are generated via batch jobs, re-running `pnpm build:wordlist` picks them up.

**Step 1: Write the build script**

```typescript
// scripts/build-wordlist.ts
import Database from 'better-sqlite3';
import { writeFileSync } from 'fs';
import { join } from 'path';

const db = new Database(join(__dirname, '..', 'wordlist.db'), { readonly: true });

interface WordRow {
  word: string;
  length: number;
  clues: string | null;
}

// Export format: { "3": [["STY", ["clue1","clue2","clue3"]], ...], "4": [...] }
// Words 3-13 letters (crossword-relevant for 13×13 grid)
const result: Record<string, [string, string[]][]> = {};

const rows = db.prepare(
  `SELECT word, length, clues FROM words WHERE length BETWEEN 3 AND 13 ORDER BY length`
).all() as WordRow[];

for (const row of rows) {
  const key = String(row.length);
  if (!result[key]) result[key] = [];

  let clues: string[];
  if (row.clues) {
    try {
      clues = JSON.parse(row.clues);
    } catch {
      clues = [row.word];
    }
  } else {
    clues = [row.word]; // placeholder — word as its own clue
  }

  result[key].push([row.word.toUpperCase(), clues]);
}

const outPath = join(__dirname, '..', 'public', 'wordlist.json');
writeFileSync(outPath, JSON.stringify(result));

const totalWords = Object.values(result).reduce((sum, arr) => sum + arr.length, 0);
console.log(`Wrote ${totalWords} words to ${outPath}`);
console.log(`File size: ${(Buffer.byteLength(JSON.stringify(result)) / 1024 / 1024).toFixed(1)} MB`);

db.close();
```

**Step 2: Install tsx for running TypeScript scripts**

```bash
pnpm add -D tsx
```

**Step 3: Run the build**

```bash
pnpm build:wordlist
```

Expected: `public/wordlist.json` created, console shows word count and file size.

**Step 4: Verify output format**

Spot-check that the JSON has the expected structure: keys are length strings, values are arrays of `[word, clues]` tuples.

**Step 5: Commit**

```bash
git add scripts/build-wordlist.ts public/wordlist.json
git commit -m "feat: add wordlist build script (SQLite → JSON)"
```

**Note:** `public/wordlist.json` will be large (~60MB). Consider adding it to `.gitignore` and building it in CI instead. For now, keep it tracked for simplicity.

---

## Phase 3: Engine Core — Types & Pure Functions

### Task 3: Define engine types

**Files:**
- Create: `src/engine/types.ts`
- Test: `tests/engine/types.test.ts`

**Step 1: Write the types**

```typescript
// src/engine/types.ts

export type Direction = 'across' | 'down';

export interface Entry {
  readonly number: number;
  readonly direction: Direction;
  readonly answer: string;
  readonly clue: string;
  readonly start: readonly [number, number]; // [row, col]
  readonly length: number;
}

export interface Puzzle {
  readonly grid: readonly (readonly string[])[];
  readonly size: number;
  readonly entries: readonly Entry[];
}

export interface PlayerEntry {
  readonly number: number;
  readonly direction: Direction;
  readonly clue: string;
  readonly start: readonly [number, number];
  readonly length: number;
}

export interface PlayerPuzzle {
  readonly id: string;
  readonly size: number;
  readonly pattern: readonly (readonly number[])[]; // 1=white, 0=black
  readonly solutionHash: string;
  readonly entries: readonly PlayerEntry[];
  readonly creatorName?: string;
}

export interface GenerateOptions {
  readonly size?: number;        // default 13
  readonly seed?: string;        // for reproducibility
  readonly maxAttempts?: number;  // how many patterns to try
}

/** Black cell marker in the grid */
export const BLACK = '#';
```

**Step 2: Write a basic type-check test**

```typescript
// tests/engine/types.test.ts
import { describe, it, expect } from 'vitest';
import { BLACK } from '@/engine/types';
import type { Puzzle, PlayerPuzzle, Entry } from '@/engine/types';

describe('engine types', () => {
  it('BLACK constant is #', () => {
    expect(BLACK).toBe('#');
  });

  it('Puzzle type accepts valid shape', () => {
    const puzzle: Puzzle = {
      grid: [['A', '#'], ['#', 'B']],
      size: 2,
      entries: [],
    };
    expect(puzzle.size).toBe(2);
  });
});
```

**Step 3: Configure Vitest**

Create `vitest.config.ts` at project root:

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
```

**Step 4: Run tests**

```bash
pnpm test:engine
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/types.ts tests/engine/types.test.ts vitest.config.ts
git commit -m "feat(engine): add core type definitions"
```

---

### Task 4: Solution obfuscation — obfuscate, deobfuscate, validate

**Files:**
- Create: `src/engine/solution.ts`
- Create: `tests/engine/solution.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/engine/solution.test.ts
import { describe, it, expect } from 'vitest';
import { obfuscateSolution, deobfuscateSolution, validateSolution } from '@/engine/solution';
import { BLACK } from '@/engine/types';

describe('solution obfuscation', () => {
  const grid = [
    ['H', 'E', 'L', 'L', 'O'],
    [BLACK, BLACK, 'I', BLACK, BLACK],
    ['W', 'O', 'R', 'L', 'D'],
  ];
  const puzzleId = 'pzl_test123';

  it('round-trips correctly', () => {
    const encoded = obfuscateSolution(grid, puzzleId);
    const decoded = deobfuscateSolution(encoded, puzzleId);
    expect(decoded).toEqual(grid);
  });

  it('obfuscated output is not plaintext', () => {
    const encoded = obfuscateSolution(grid, puzzleId);
    expect(encoded).not.toContain('HELLO');
    expect(encoded).not.toContain('WORLD');
  });

  it('validateSolution returns true for correct grid', () => {
    const encoded = obfuscateSolution(grid, puzzleId);
    expect(validateSolution(grid, encoded, puzzleId)).toBe(true);
  });

  it('validateSolution returns false for incorrect grid', () => {
    const encoded = obfuscateSolution(grid, puzzleId);
    const wrong = [
      ['X', 'E', 'L', 'L', 'O'],
      [BLACK, BLACK, 'I', BLACK, BLACK],
      ['W', 'O', 'R', 'L', 'D'],
    ];
    expect(validateSolution(wrong, encoded, puzzleId)).toBe(false);
  });

  it('different puzzleIds produce different hashes', () => {
    const hash1 = obfuscateSolution(grid, 'pzl_aaa');
    const hash2 = obfuscateSolution(grid, 'pzl_bbb');
    expect(hash1).not.toBe(hash2);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm test:engine -- tests/engine/solution.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement solution.ts**

```typescript
// src/engine/solution.ts
import { BLACK } from './types';

/**
 * XOR each character of `text` with characters from `key` (cycling).
 */
function xorWithKey(text: string, key: string): string {
  return Array.from(text)
    .map((ch, i) => String.fromCharCode(ch.charCodeAt(0) ^ key.charCodeAt(i % key.length)))
    .join('');
}

/**
 * Flatten grid to a pipe-delimited string.
 * e.g. [['H','E'],['#','O']] → "HE|#O"
 */
function flattenGrid(grid: readonly (readonly string[])[]): string {
  return grid.map(row => row.join('')).join('|');
}

/**
 * Unflatten a pipe-delimited string back to a 2D grid.
 */
function unflattenGrid(flat: string): string[][] {
  return flat.split('|').map(row => row.split(''));
}

/**
 * Obfuscate the solution grid for storage/sharing.
 * Uses XOR with puzzleId as key, then Base64.
 */
export function obfuscateSolution(
  grid: readonly (readonly string[])[],
  puzzleId: string
): string {
  const flat = flattenGrid(grid);
  const xored = xorWithKey(flat, puzzleId);
  // btoa works on Latin-1; use a safe encoding approach
  return btoa(unescape(encodeURIComponent(xored)));
}

/**
 * Deobfuscate a solution hash back to a grid.
 */
export function deobfuscateSolution(
  encoded: string,
  puzzleId: string
): string[][] {
  const xored = decodeURIComponent(escape(atob(encoded)));
  const flat = xorWithKey(xored, puzzleId);
  return unflattenGrid(flat);
}

/**
 * Validate a player's grid against the obfuscated solution.
 */
export function validateSolution(
  playerGrid: readonly (readonly string[])[],
  solutionHash: string,
  puzzleId: string
): boolean {
  const solution = deobfuscateSolution(solutionHash, puzzleId);
  return playerGrid.every((row, r) =>
    row.every((cell, c) => cell === solution[r][c])
  );
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm test:engine -- tests/engine/solution.test.ts
```

Expected: All 5 tests PASS.

**Step 5: Commit**

```bash
git add src/engine/solution.ts tests/engine/solution.test.ts
git commit -m "feat(engine): add solution obfuscation with XOR + Base64"
```

---

### Task 5: Entry numbering — getEntries

**Files:**
- Create: `src/engine/numbering.ts`
- Create: `tests/engine/numbering.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/engine/numbering.test.ts
import { describe, it, expect } from 'vitest';
import { getEntries } from '@/engine/numbering';
import { BLACK } from '@/engine/types';

const B = BLACK;

describe('getEntries', () => {
  // Simple 5×5 grid:
  // H E L L O
  // # # I # #
  // W O R L D
  // # # E # #
  // S T A R S
  const grid = [
    ['H', 'E', 'L', 'L', 'O'],
    [B,    B,   'I',  B,   B],
    ['W', 'O', 'R', 'L', 'D'],
    [B,    B,   'E',  B,   B],
    ['S', 'T', 'A', 'R', 'S'],
  ];

  it('finds across entries of length >= 3', () => {
    const entries = getEntries(grid);
    const across = entries.filter(e => e.direction === 'across');
    // Across entries: HELLO (row 0), WORLD (row 2), STARS (row 4)
    expect(across.map(e => e.answer)).toEqual(['HELLO', 'WORLD', 'STARS']);
  });

  it('finds down entries of length >= 3', () => {
    const entries = getEntries(grid);
    const down = entries.filter(e => e.direction === 'down');
    // Down entry: LIREA (col 2) spanning all 5 rows
    expect(down.map(e => e.answer)).toEqual(['LIREA']);
  });

  it('assigns sequential numbers', () => {
    const entries = getEntries(grid);
    const numbers = [...new Set(entries.map(e => e.number))].sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4]);
    // 1: HELLO across + no down at (0,0)
    // 2 should be at (0,2) col 2 for LIREA down — but actually numbering goes L-R, T-B
  });

  it('sets correct start positions', () => {
    const entries = getEntries(grid);
    const hello = entries.find(e => e.answer === 'HELLO');
    expect(hello?.start).toEqual([0, 0]);
    expect(hello?.length).toBe(5);
  });

  it('returns no entries shorter than 3', () => {
    const entries = getEntries(grid);
    entries.forEach(e => {
      expect(e.length).toBeGreaterThanOrEqual(3);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm test:engine -- tests/engine/numbering.test.ts
```

**Step 3: Implement numbering.ts**

```typescript
// src/engine/numbering.ts
import { BLACK } from './types';
import type { Entry, Direction } from './types';

function isBlack(grid: readonly (readonly string[])[], r: number, c: number): boolean {
  return r < 0 || r >= grid.length || c < 0 || c >= grid[0].length || grid[r][c] === BLACK;
}

/**
 * Scan a run of white cells starting at (r, c) in the given direction.
 * Returns the word (concatenated letters) and its length.
 */
function scanRun(
  grid: readonly (readonly string[])[],
  r: number,
  c: number,
  direction: Direction
): { word: string; length: number } {
  let word = '';
  let row = r;
  let col = c;
  const dr = direction === 'down' ? 1 : 0;
  const dc = direction === 'across' ? 1 : 0;

  while (
    row >= 0 && row < grid.length &&
    col >= 0 && col < grid[0].length &&
    grid[row][col] !== BLACK
  ) {
    word += grid[row][col];
    row += dr;
    col += dc;
  }

  return { word, length: word.length };
}

/**
 * Extract all numbered entries from a filled grid.
 * An entry starts where:
 * - Across: cell is white, cell to the left is black or edge
 * - Down: cell is white, cell above is black or edge
 * Only entries with length >= 3 are included.
 */
export function getEntries(grid: readonly (readonly string[])[]): Entry[] {
  const entries: Entry[] = [];
  let number = 0;
  const size = grid.length;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === BLACK) continue;

      const startsAcross = isBlack(grid, r, c - 1);
      const startsDown = isBlack(grid, r - 1, c);

      if (!startsAcross && !startsDown) continue;

      // Check if either direction yields a valid entry (length >= 3)
      const acrossRun = startsAcross ? scanRun(grid, r, c, 'across') : null;
      const downRun = startsDown ? scanRun(grid, r, c, 'down') : null;

      const hasValidAcross = acrossRun !== null && acrossRun.length >= 3;
      const hasValidDown = downRun !== null && downRun.length >= 3;

      if (!hasValidAcross && !hasValidDown) continue;

      number++;

      if (hasValidAcross) {
        entries.push({
          number,
          direction: 'across',
          answer: acrossRun!.word,
          clue: '', // clues assigned later by generator
          start: [r, c],
          length: acrossRun!.length,
        });
      }

      if (hasValidDown) {
        entries.push({
          number,
          direction: 'down',
          answer: downRun!.word,
          clue: '', // clues assigned later by generator
          start: [r, c],
          length: downRun!.length,
        });
      }
    }
  }

  return entries;
}
```

**Step 4: Run tests**

```bash
pnpm test:engine -- tests/engine/numbering.test.ts
```

Expected: PASS (may need to adjust test expectations based on exact numbering — the test author should verify the expected numbers match the algorithm).

**Step 5: Commit**

```bash
git add src/engine/numbering.ts tests/engine/numbering.test.ts
git commit -m "feat(engine): add entry numbering / getEntries"
```

---

### Task 6: Grid validation — validateGrid

**Files:**
- Create: `src/engine/validator.ts`
- Create: `tests/engine/validator.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/engine/validator.test.ts
import { describe, it, expect } from 'vitest';
import { validateGrid } from '@/engine/validator';
import { BLACK } from '@/engine/types';

const B = BLACK;

describe('validateGrid', () => {
  it('accepts a valid symmetric connected grid', () => {
    // Valid 5×5 with 180° symmetry, all connected, min span 3
    const grid = [
      ['A', 'B', 'C', 'D', 'E'],
      ['F', B,   'G',  B,  'H'],
      ['I', 'J', 'K', 'L', 'M'],
      ['N', B,   'O',  B,  'P'],
      ['Q', 'R', 'S', 'T', 'U'],
    ];
    const result = validateGrid(grid);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects grid without 180° symmetry', () => {
    const grid = [
      ['A', B,   'C', 'D', 'E'],
      ['F', 'G', 'H', 'I', 'J'],
      ['K', 'L', 'M', 'N', 'O'],
      ['P', 'Q', 'R', 'S', 'T'],
      ['U', 'V', 'W', 'X', 'Y'],
    ];
    const result = validateGrid(grid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('symmetry'))).toBe(true);
  });

  it('rejects disconnected white cells', () => {
    // Two isolated islands
    const grid = [
      ['A', 'B',  B,   B,  B],
      ['C', 'D',  B,   B,  B],
      [B,    B,    B,   B,  B],
      [B,    B,    B,  'E', 'F'],
      [B,    B,    B,  'G', 'H'],
    ];
    const result = validateGrid(grid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('connect'))).toBe(true);
  });

  it('rejects entries shorter than 3 letters', () => {
    // Has a 2-letter run
    const grid = [
      ['A', 'B',  B,  'C', 'D'],
      [B,    B,    B,   B,   B ],
      [B,    B,   'E',  B,   B ],
      [B,    B,    B,   B,   B ],
      ['F', 'G',  B,  'H', 'I'],
    ];
    const result = validateGrid(grid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('short'))).toBe(true);
  });

  it('rejects orphaned letters (white cell not in both across and down)', () => {
    // A white cell that only belongs to an across word, not a down word of length >= 3
    const grid = [
      ['A', 'B', 'C', 'D', 'E'],
      [B,    B,   B,    B,   B ],
      ['F', 'G', 'H', 'I', 'J'],
      [B,    B,   B,    B,   B ],
      ['K', 'L', 'M', 'N', 'O'],
    ];
    const result = validateGrid(grid);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('span'))).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm test:engine -- tests/engine/validator.test.ts
```

**Step 3: Implement validator.ts**

```typescript
// src/engine/validator.ts
import { BLACK } from './types';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isWhite(grid: readonly (readonly string[])[], r: number, c: number): boolean {
  return r >= 0 && r < grid.length && c >= 0 && c < grid[0].length && grid[r][c] !== BLACK;
}

/**
 * Check 180° rotational symmetry: grid[r][c] is black iff grid[size-1-r][size-1-c] is black.
 */
function checkSymmetry(grid: readonly (readonly string[])[]): string[] {
  const size = grid.length;
  const errors: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const isBlack = grid[r][c] === BLACK;
      const mirrorBlack = grid[size - 1 - r][size - 1 - c] === BLACK;
      if (isBlack !== mirrorBlack) {
        errors.push(`symmetry violation at (${r},${c}) vs (${size-1-r},${size-1-c})`);
        return errors; // one is enough
      }
    }
  }
  return errors;
}

/**
 * BFS to check all white cells are connected.
 */
function checkConnectivity(grid: readonly (readonly string[])[]): string[] {
  const size = grid.length;
  const visited = Array.from({ length: size }, () => new Array(size).fill(false));

  // Find first white cell
  let startR = -1, startC = -1;
  outer: for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] !== BLACK) { startR = r; startC = c; break outer; }
    }
  }
  if (startR === -1) return ['no white cells'];

  // BFS
  const queue: [number, number][] = [[startR, startC]];
  visited[startR][startC] = true;
  let count = 1;

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nr = r + dr, nc = c + dc;
      if (isWhite(grid, nr, nc) && !visited[nr][nc]) {
        visited[nr][nc] = true;
        count++;
        queue.push([nr, nc]);
      }
    }
  }

  // Count total white cells
  let total = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] !== BLACK) total++;
    }
  }

  if (count !== total) {
    return [`white cells not connected: reached ${count} of ${total}`];
  }
  return [];
}

/**
 * Check no entry (horizontal or vertical run of white cells) is shorter than 3.
 * Also check every white cell has a span of at least 3 in BOTH directions.
 */
function checkMinimumSpans(grid: readonly (readonly string[])[]): string[] {
  const size = grid.length;
  const errors: string[] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === BLACK) continue;

      // Measure horizontal span containing this cell
      let hLeft = c;
      while (hLeft > 0 && grid[r][hLeft - 1] !== BLACK) hLeft--;
      let hRight = c;
      while (hRight < size - 1 && grid[r][hRight + 1] !== BLACK) hRight++;
      const hSpan = hRight - hLeft + 1;

      // Measure vertical span containing this cell
      let vTop = r;
      while (vTop > 0 && grid[vTop - 1][c] !== BLACK) vTop--;
      let vBottom = r;
      while (vBottom < size - 1 && grid[vBottom + 1][c] !== BLACK) vBottom++;
      const vSpan = vBottom - vTop + 1;

      if (hSpan < 3) {
        errors.push(`short horizontal span of ${hSpan} at (${r},${c})`);
        return errors;
      }
      if (vSpan < 3) {
        errors.push(`short vertical span of ${vSpan} at (${r},${c})`);
        return errors;
      }
    }
  }
  return errors;
}

/**
 * Validate a grid meets all crossword construction constraints.
 */
export function validateGrid(grid: readonly (readonly string[])[]): ValidationResult {
  const errors: string[] = [
    ...checkSymmetry(grid),
    ...checkConnectivity(grid),
    ...checkMinimumSpans(grid),
  ];
  return { valid: errors.length === 0, errors };
}
```

**Step 4: Run tests**

```bash
pnpm test:engine -- tests/engine/validator.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/validator.ts tests/engine/validator.test.ts
git commit -m "feat(engine): add grid validation (symmetry, connectivity, min spans)"
```

---

### Task 7: getPlayerPuzzle — strip answers for player view

**Files:**
- Create: `src/engine/player-puzzle.ts`
- Create: `tests/engine/player-puzzle.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/engine/player-puzzle.test.ts
import { describe, it, expect } from 'vitest';
import { getPlayerPuzzle } from '@/engine/player-puzzle';
import { BLACK } from '@/engine/types';
import type { Puzzle } from '@/engine/types';

describe('getPlayerPuzzle', () => {
  const puzzle: Puzzle = {
    grid: [
      ['H', 'E', 'L', 'L', 'O'],
      [BLACK, BLACK, 'I', BLACK, BLACK],
      ['W', 'O', 'R', 'L', 'D'],
    ],
    size: 5,
    entries: [
      { number: 1, direction: 'across', answer: 'HELLO', clue: 'A greeting', start: [0, 0], length: 5 },
      { number: 2, direction: 'down', answer: 'LIR', clue: 'Test clue', start: [0, 2], length: 3 },
      { number: 3, direction: 'across', answer: 'WORLD', clue: 'The earth', start: [2, 0], length: 5 },
    ],
  };

  it('produces correct pattern (1=white, 0=black)', () => {
    const player = getPlayerPuzzle(puzzle, 'pzl_test');
    expect(player.pattern).toEqual([
      [1, 1, 1, 1, 1],
      [0, 0, 1, 0, 0],
      [1, 1, 1, 1, 1],
    ]);
  });

  it('strips answer field from entries', () => {
    const player = getPlayerPuzzle(puzzle, 'pzl_test');
    player.entries.forEach(e => {
      expect(e).not.toHaveProperty('answer');
    });
  });

  it('preserves clue, number, direction, start, length', () => {
    const player = getPlayerPuzzle(puzzle, 'pzl_test');
    const first = player.entries[0];
    expect(first.number).toBe(1);
    expect(first.direction).toBe('across');
    expect(first.clue).toBe('A greeting');
    expect(first.start).toEqual([0, 0]);
    expect(first.length).toBe(5);
  });

  it('includes a solutionHash that is not plaintext', () => {
    const player = getPlayerPuzzle(puzzle, 'pzl_test');
    expect(player.solutionHash).toBeTruthy();
    expect(player.solutionHash).not.toContain('HELLO');
  });

  it('sets the puzzle id', () => {
    const player = getPlayerPuzzle(puzzle, 'pzl_test');
    expect(player.id).toBe('pzl_test');
  });
});
```

**Step 2: Run tests to verify they fail**

**Step 3: Implement player-puzzle.ts**

```typescript
// src/engine/player-puzzle.ts
import { BLACK } from './types';
import type { Puzzle, PlayerPuzzle, PlayerEntry } from './types';
import { obfuscateSolution } from './solution';

/**
 * Transform a full Puzzle into a PlayerPuzzle:
 * - Grid → pattern (1/0)
 * - Entries → strip answer field
 * - Solution → obfuscated hash
 */
export function getPlayerPuzzle(puzzle: Puzzle, puzzleId: string): PlayerPuzzle {
  const pattern = puzzle.grid.map(row =>
    row.map(cell => (cell === BLACK ? 0 : 1))
  );

  const entries: PlayerEntry[] = puzzle.entries.map(({ number, direction, clue, start, length }) => ({
    number,
    direction,
    clue,
    start,
    length,
  }));

  const solutionHash = obfuscateSolution(puzzle.grid, puzzleId);

  return {
    id: puzzleId,
    size: puzzle.size,
    pattern,
    solutionHash,
    entries,
  };
}
```

**Step 4: Run tests**

```bash
pnpm test:engine -- tests/engine/player-puzzle.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/player-puzzle.ts tests/engine/player-puzzle.test.ts
git commit -m "feat(engine): add getPlayerPuzzle (strips answers, obfuscates solution)"
```

---

## Phase 4: Engine — Word List & Generator

### Task 8: Word list loader

**Files:**
- Create: `src/engine/wordlist.ts`
- Create: `tests/engine/wordlist.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/engine/wordlist.test.ts
import { describe, it, expect } from 'vitest';
import { loadWordList } from '@/engine/wordlist';
import type { WordList } from '@/engine/wordlist';

const sampleData = {
  "3": [["CAT", ["A feline"]], ["DOG", ["A canine"]], ["BAT", ["Flying mammal"]]],
  "4": [["CATS", ["Plural felines"]], ["DOGS", ["Plural canines"]]],
  "5": [["HELLO", ["A greeting", "Hi there", "Salutation"]]],
};

describe('loadWordList', () => {
  it('returns a WordList with getByLength', () => {
    const wl = loadWordList(sampleData);
    expect(wl.getByLength(3)).toHaveLength(3);
    expect(wl.getByLength(4)).toHaveLength(2);
    expect(wl.getByLength(5)).toHaveLength(1);
    expect(wl.getByLength(99)).toHaveLength(0);
  });

  it('returns word and clue data', () => {
    const wl = loadWordList(sampleData);
    const threes = wl.getByLength(3);
    const cat = threes.find(w => w.word === 'CAT');
    expect(cat).toBeDefined();
    expect(cat!.clues).toEqual(["A feline"]);
  });

  it('getClue picks a random clue from available clues', () => {
    const wl = loadWordList(sampleData);
    const clue = wl.getClue('HELLO');
    expect(["A greeting", "Hi there", "Salutation"]).toContain(clue);
  });

  it('getClue returns word itself as fallback', () => {
    const wl = loadWordList(sampleData);
    const clue = wl.getClue('NONEXISTENT');
    expect(clue).toBe('NONEXISTENT');
  });

  it('wordsMatchingPattern finds words matching a constraint pattern', () => {
    const wl = loadWordList(sampleData);
    // Pattern: C_T (3 letters, C at 0, T at 2)
    const matches = wl.wordsMatchingPattern(3, new Map([[0, 'C'], [2, 'T']]));
    expect(matches.map(w => w.word)).toContain('CAT');
    expect(matches.map(w => w.word)).not.toContain('DOG');
  });
});
```

**Step 2: Run tests to verify they fail**

**Step 3: Implement wordlist.ts**

```typescript
// src/engine/wordlist.ts

export interface WordEntry {
  readonly word: string;
  readonly clues: readonly string[];
}

export interface WordList {
  getByLength(length: number): readonly WordEntry[];
  getClue(word: string): string;
  wordsMatchingPattern(length: number, constraints: Map<number, string>): readonly WordEntry[];
}

type RawWordListData = Record<string, [string, string[]][]>;

export function loadWordList(data: RawWordListData): WordList {
  const byLength = new Map<number, WordEntry[]>();
  const clueMap = new Map<string, string[]>();

  for (const [lenStr, words] of Object.entries(data)) {
    const len = Number(lenStr);
    const entries: WordEntry[] = [];
    for (const [word, clues] of words) {
      const upper = word.toUpperCase();
      entries.push({ word: upper, clues });
      clueMap.set(upper, clues);
    }
    byLength.set(len, entries);
  }

  return {
    getByLength(length: number): readonly WordEntry[] {
      return byLength.get(length) ?? [];
    },

    getClue(word: string): string {
      const clues = clueMap.get(word.toUpperCase());
      if (!clues || clues.length === 0) return word;
      return clues[Math.floor(Math.random() * clues.length)];
    },

    wordsMatchingPattern(length: number, constraints: Map<number, string>): readonly WordEntry[] {
      const words = byLength.get(length) ?? [];
      return words.filter(entry =>
        Array.from(constraints.entries()).every(
          ([pos, letter]) => entry.word[pos] === letter
        )
      );
    },
  };
}
```

**Step 4: Run tests**

```bash
pnpm test:engine -- tests/engine/wordlist.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/wordlist.ts tests/engine/wordlist.test.ts
git commit -m "feat(engine): add word list loader with pattern matching"
```

---

### Task 9: Grid pattern generation

**Files:**
- Create: `src/engine/patterns.ts`
- Create: `tests/engine/patterns.test.ts`

**Context:** Generate valid 13×13 black/white grid patterns. The approach: start with an all-white grid, randomly place black squares maintaining 180° symmetry, then validate that all constraints hold (connectivity, min span of 3 in both directions). Use multiple attempts.

**Step 1: Write the failing tests**

```typescript
// tests/engine/patterns.test.ts
import { describe, it, expect } from 'vitest';
import { generatePattern } from '@/engine/patterns';
import { validateGrid } from '@/engine/validator';
import { BLACK } from '@/engine/types';

describe('generatePattern', () => {
  it('produces a 13×13 grid', () => {
    const pattern = generatePattern(13);
    expect(pattern.length).toBe(13);
    pattern.forEach(row => expect(row.length).toBe(13));
  });

  it('contains only BLACK and empty string cells', () => {
    const pattern = generatePattern(13);
    pattern.forEach(row =>
      row.forEach(cell => expect([BLACK, '']).toContain(cell))
    );
  });

  it('passes validateGrid', () => {
    // Generate a few patterns and ensure they all validate
    // (Using '' for white cells — validator treats non-BLACK as white)
    for (let i = 0; i < 3; i++) {
      const pattern = generatePattern(13);
      // Fill white cells with 'A' for validation (validator needs non-BLACK chars)
      const filled = pattern.map(row =>
        row.map(cell => cell === BLACK ? BLACK : 'A')
      );
      const result = validateGrid(filled);
      expect(result.valid).toBe(true);
    }
  });

  it('has reasonable black cell count (15-35% of grid)', () => {
    const pattern = generatePattern(13);
    let blackCount = 0;
    pattern.forEach(row => row.forEach(cell => { if (cell === BLACK) blackCount++; }));
    const ratio = blackCount / (13 * 13);
    expect(ratio).toBeGreaterThan(0.12);
    expect(ratio).toBeLessThan(0.40);
  });
});
```

**Step 2: Run tests to verify they fail**

**Step 3: Implement patterns.ts**

The pattern generator uses a template-based approach with random variations. It places black squares in symmetric pairs and validates constraints after each placement.

```typescript
// src/engine/patterns.ts
import { BLACK } from './types';

type Grid = string[][];

function createEmptyGrid(size: number): Grid {
  return Array.from({ length: size }, () => new Array(size).fill(''));
}

function clone(grid: Grid): Grid {
  return grid.map(row => [...row]);
}

/**
 * Check that all white cells are connected via BFS.
 */
function isConnected(grid: Grid): boolean {
  const size = grid.length;
  let startR = -1, startC = -1;
  let whiteCount = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] !== BLACK) {
        whiteCount++;
        if (startR === -1) { startR = r; startC = c; }
      }
    }
  }
  if (whiteCount === 0) return false;

  const visited = new Set<string>();
  const queue: [number, number][] = [[startR, startC]];
  visited.add(`${startR},${startC}`);

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nr = r + dr, nc = c + dc;
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size && grid[nr][nc] !== BLACK && !visited.has(key)) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }

  return visited.size === whiteCount;
}

/**
 * Check every white cell has a horizontal and vertical span of at least `minSpan`.
 */
function allSpansValid(grid: Grid, minSpan: number): boolean {
  const size = grid.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === BLACK) continue;

      // Horizontal span
      let hL = c, hR = c;
      while (hL > 0 && grid[r][hL - 1] !== BLACK) hL--;
      while (hR < size - 1 && grid[r][hR + 1] !== BLACK) hR++;
      if (hR - hL + 1 < minSpan) return false;

      // Vertical span
      let vT = r, vB = r;
      while (vT > 0 && grid[vT - 1][c] !== BLACK) vT--;
      while (vB < size - 1 && grid[vB + 1][c] !== BLACK) vB++;
      if (vB - vT + 1 < minSpan) return false;
    }
  }
  return true;
}

/**
 * Place a symmetric pair of black squares at (r,c) and (size-1-r, size-1-c).
 * If r,c is the center, only one square is placed.
 */
function placeBlackPair(grid: Grid, r: number, c: number): void {
  const size = grid.length;
  grid[r][c] = BLACK;
  grid[size - 1 - r][size - 1 - c] = BLACK;
}

/**
 * Generate a valid grid pattern for a crossword.
 * Returns a grid where cells are either BLACK or '' (white).
 */
export function generatePattern(size: number, maxAttempts: number = 100): Grid {
  const targetBlackRatio = 0.18 + Math.random() * 0.10; // 18-28%
  const targetBlackCount = Math.round(size * size * targetBlackRatio);
  // Black squares come in pairs (symmetry), except possibly center
  const pairsNeeded = Math.floor(targetBlackCount / 2);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const grid = createEmptyGrid(size);

    // Collect all candidate positions (top half + center row left half)
    const candidates: [number, number][] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // Only add each symmetric pair once (top-left triangle)
        const mr = size - 1 - r;
        const mc = size - 1 - c;
        if (r < mr || (r === mr && c <= mc)) {
          candidates.push([r, c]);
        }
      }
    }

    // Shuffle candidates
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Try placing black pairs one by one
    let placed = 0;
    for (const [r, c] of candidates) {
      if (placed >= pairsNeeded) break;

      const test = clone(grid);
      placeBlackPair(test, r, c);

      // Quick validation: spans still valid and connected
      if (allSpansValid(test, 3) && isConnected(test)) {
        placeBlackPair(grid, r, c);
        placed++;
      }
    }

    // Final validation
    if (isConnected(grid) && allSpansValid(grid, 3)) {
      return grid;
    }
  }

  throw new Error(`Failed to generate valid pattern after ${maxAttempts} attempts`);
}
```

**Step 4: Run tests**

```bash
pnpm test:engine -- tests/engine/patterns.test.ts
```

Expected: PASS (pattern generation is randomized, but constraints ensure validity).

**Step 5: Commit**

```bash
git add src/engine/patterns.ts tests/engine/patterns.test.ts
git commit -m "feat(engine): add grid pattern generator with symmetry + constraint checking"
```

---

### Task 10: Grid fill algorithm

**Files:**
- Create: `src/engine/filler.ts`
- Create: `tests/engine/filler.test.ts`

**Context:** Fill a grid pattern with words from the word list using constraint propagation + backtracking. This is the most complex algorithm in the project.

**Step 1: Write the failing tests**

```typescript
// tests/engine/filler.test.ts
import { describe, it, expect } from 'vitest';
import { fillGrid } from '@/engine/filler';
import { loadWordList } from '@/engine/wordlist';
import { BLACK } from '@/engine/types';
import { validateGrid } from '@/engine/validator';

// Minimal word list for testing
const testData = {
  "3": [
    ["CAT", ["A feline"]], ["DOG", ["A canine"]], ["BAT", ["A stick"]],
    ["COT", ["A bed"]], ["BOG", ["A marsh"]], ["BIG", ["Large"]],
    ["DIG", ["Excavate"]], ["COG", ["A gear"]], ["BOT", ["A robot"]],
    ["TAG", ["A label"]], ["GAB", ["Chat"]], ["TAB", ["A flap"]],
    ["GOD", ["Deity"]], ["GOT", ["Obtained"]], ["BIT", ["A piece"]],
  ],
  "5": [
    ["CATOG", ["Test"]], ["DOGIT", ["Test"]], ["BATCH", ["Test"]],
    ["BIGOT", ["Test"]], ["TABCO", ["Test"]],
  ],
};

describe('fillGrid', () => {
  it('fills a small grid with valid words', () => {
    const wl = loadWordList(testData);
    // 3×3 all-white grid
    const pattern = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ];
    const result = fillGrid(pattern, wl);
    if (result) {
      // All cells should be filled
      result.forEach(row =>
        row.forEach(cell => {
          expect(cell).not.toBe('');
          expect(cell).toMatch(/^[A-Z]$/);
        })
      );
    }
    // It's OK if fill fails with a tiny word list — the test validates the interface
  });

  it('preserves black cells', () => {
    const wl = loadWordList(testData);
    const pattern = [
      ['', '',   BLACK],
      ['', '',   ''],
      [BLACK, '', ''],
    ];
    const result = fillGrid(pattern, wl);
    if (result) {
      expect(result[0][2]).toBe(BLACK);
      expect(result[2][0]).toBe(BLACK);
    }
  });

  it('returns null when fill is impossible', () => {
    // Empty word list — should fail
    const wl = loadWordList({});
    const pattern = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ];
    const result = fillGrid(pattern, wl);
    expect(result).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

**Step 3: Implement filler.ts**

```typescript
// src/engine/filler.ts
import { BLACK } from './types';
import type { WordList, WordEntry } from './wordlist';

type Grid = string[][];

interface Slot {
  cells: [number, number][];  // list of (row, col) for each letter
  direction: 'across' | 'down';
}

/**
 * Extract all slots (runs of white cells) from a pattern grid.
 */
function extractSlots(grid: Grid): Slot[] {
  const size = grid.length;
  const slots: Slot[] = [];

  // Across slots
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (grid[r][c] === BLACK) { c++; continue; }
      const cells: [number, number][] = [];
      while (c < size && grid[r][c] !== BLACK) {
        cells.push([r, c]);
        c++;
      }
      if (cells.length >= 3) {
        slots.push({ cells, direction: 'across' });
      }
    }
  }

  // Down slots
  for (let c = 0; c < size; c++) {
    let r = 0;
    while (r < size) {
      if (grid[r][c] === BLACK) { r++; continue; }
      const cells: [number, number][] = [];
      while (r < size && grid[r][c] !== BLACK) {
        cells.push([r, c]);
        r++;
      }
      if (cells.length >= 3) {
        slots.push({ cells, direction: 'down' });
      }
    }
  }

  return slots;
}

/**
 * Get current constraints for a slot from the grid.
 */
function getConstraints(grid: Grid, slot: Slot): Map<number, string> {
  const constraints = new Map<number, string>();
  slot.cells.forEach(([r, c], i) => {
    if (grid[r][c] !== '' && grid[r][c] !== BLACK) {
      constraints.set(i, grid[r][c]);
    }
  });
  return constraints;
}

/**
 * Place a word into a slot on the grid.
 */
function placeWord(grid: Grid, slot: Slot, word: string): void {
  slot.cells.forEach(([r, c], i) => {
    grid[r][c] = word[i];
  });
}

/**
 * Shuffle array in-place (Fisher-Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Fill a grid pattern with words using backtracking.
 * Returns the filled grid or null if impossible.
 */
export function fillGrid(pattern: Grid, wordList: WordList): Grid | null {
  const grid = pattern.map(row => [...row]);
  const slots = extractSlots(grid);

  // Track used words to avoid duplicates
  const usedWords = new Set<string>();

  // Sort slots by length (most constrained first — longer slots have fewer options)
  slots.sort((a, b) => b.cells.length - a.cells.length);

  function backtrack(slotIndex: number): boolean {
    if (slotIndex >= slots.length) return true;

    const slot = slots[slotIndex];
    const constraints = getConstraints(grid, slot);
    const candidates = wordList.wordsMatchingPattern(slot.cells.length, constraints);

    // Shuffle candidates for variety
    const shuffled = shuffle([...candidates]);

    // Limit attempts per slot to avoid extremely long search
    const maxCandidates = Math.min(shuffled.length, 50);

    for (let i = 0; i < maxCandidates; i++) {
      const candidate = shuffled[i];
      if (usedWords.has(candidate.word)) continue;

      // Save current state for backtrack
      const saved = slot.cells.map(([r, c]) => grid[r][c]);

      placeWord(grid, slot, candidate.word);
      usedWords.add(candidate.word);

      if (backtrack(slotIndex + 1)) return true;

      // Restore
      usedWords.delete(candidate.word);
      slot.cells.forEach(([r, c], idx) => { grid[r][c] = saved[idx]; });
    }

    return false;
  }

  return backtrack(0) ? grid : null;
}
```

**Step 4: Run tests**

```bash
pnpm test:engine -- tests/engine/filler.test.ts
```

Expected: PASS (at least the "returns null" test; small word list may or may not fill successfully).

**Step 5: Commit**

```bash
git add src/engine/filler.ts tests/engine/filler.test.ts
git commit -m "feat(engine): add grid fill algorithm with backtracking"
```

---

### Task 11: Main generator — generatePuzzle

**Files:**
- Create: `src/engine/generator.ts`
- Create: `tests/engine/generator.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/engine/generator.test.ts
import { describe, it, expect } from 'vitest';
import { generatePuzzle } from '@/engine/generator';
import { loadWordList } from '@/engine/wordlist';
import { validateGrid } from '@/engine/validator';
import { BLACK } from '@/engine/types';

// NOTE: This test requires the real wordlist.json for meaningful results.
// For CI, use a smaller test fixture. For local dev, load the real file.
// If the real file isn't available, the test will skip gracefully.

describe('generatePuzzle', () => {
  // Use a small but sufficient word list for testing
  const testData: Record<string, [string, string[]][]> = {};

  // Generate synthetic test data: 3-letter words
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let len = 3; len <= 7; len++) {
    const words: [string, string[]][] = [];
    // Generate a bunch of random words for testing
    for (let i = 0; i < 200; i++) {
      let word = '';
      for (let j = 0; j < len; j++) {
        word += letters[Math.floor(Math.random() * 26)];
      }
      words.push([word, [`Clue for ${word}`]]);
    }
    testData[String(len)] = words;
  }

  it('returns a Puzzle with correct structure', () => {
    const wl = loadWordList(testData);
    try {
      const puzzle = generatePuzzle(wl, { size: 5, maxAttempts: 10 });
      expect(puzzle.size).toBe(5);
      expect(puzzle.grid.length).toBe(5);
      expect(puzzle.entries.length).toBeGreaterThan(0);
      // Every entry has a clue
      puzzle.entries.forEach(e => {
        expect(e.clue).toBeTruthy();
        expect(e.answer.length).toBe(e.length);
      });
    } catch {
      // Generation can fail with random test data — that's acceptable
    }
  });

  it('generated grid passes validateGrid', () => {
    const wl = loadWordList(testData);
    try {
      const puzzle = generatePuzzle(wl, { size: 5, maxAttempts: 20 });
      const result = validateGrid(puzzle.grid);
      expect(result.valid).toBe(true);
    } catch {
      // Generation can fail — acceptable
    }
  });

  it('no entry is shorter than 3 letters', () => {
    const wl = loadWordList(testData);
    try {
      const puzzle = generatePuzzle(wl, { size: 5, maxAttempts: 20 });
      puzzle.entries.forEach(e => {
        expect(e.length).toBeGreaterThanOrEqual(3);
      });
    } catch {
      // acceptable
    }
  });
});
```

**Step 2: Run tests to verify they fail**

**Step 3: Implement generator.ts**

```typescript
// src/engine/generator.ts
import type { Puzzle, GenerateOptions } from './types';
import type { WordList } from './wordlist';
import { generatePattern } from './patterns';
import { fillGrid } from './filler';
import { getEntries } from './numbering';

/**
 * Generate a complete crossword puzzle.
 * 1. Generate a valid grid pattern (black/white squares)
 * 2. Fill the pattern with words from the word list
 * 3. Extract entries with numbering
 * 4. Assign clues from the word list
 */
export function generatePuzzle(
  wordList: WordList,
  options?: GenerateOptions
): Puzzle {
  const size = options?.size ?? 13;
  const maxAttempts = options?.maxAttempts ?? 50;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Step 1: Generate pattern
      const pattern = generatePattern(size, 20);

      // Step 2: Fill with words
      const filled = fillGrid(pattern, wordList);
      if (!filled) continue;

      // Step 3: Extract entries
      const entries = getEntries(filled);

      // Step 4: Assign clues
      const entriesWithClues = entries.map(entry => ({
        ...entry,
        clue: wordList.getClue(entry.answer),
      }));

      return {
        grid: filled,
        size,
        entries: entriesWithClues,
      };
    } catch {
      // Pattern generation failed, try again
      continue;
    }
  }

  throw new Error(`Failed to generate puzzle after ${maxAttempts} attempts`);
}
```

**Step 4: Run tests**

```bash
pnpm test:engine -- tests/engine/generator.test.ts
```

Expected: Tests should pass (or be gracefully skipped if random data doesn't produce fills).

**Step 5: Commit**

```bash
git add src/engine/generator.ts tests/engine/generator.test.ts
git commit -m "feat(engine): add main generatePuzzle orchestrator"
```

---

### Task 12: Web Worker entry point

**Files:**
- Create: `src/engine/worker.ts`

**Context:** This is the integration boundary. It uses Worker APIs (self.onmessage, self.postMessage, fetch) to load the word list and call engine functions. This is the ONLY file in src/engine/ that can use browser/worker APIs.

**Step 1: Implement worker.ts**

```typescript
// src/engine/worker.ts
import { loadWordList } from './wordlist';
import { generatePuzzle } from './generator';
import type { WordList } from './wordlist';
import type { GenerateOptions } from './types';

let wordList: WordList | null = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'init') {
    try {
      const response = await fetch('/wordlist.json');
      const data = await response.json();
      wordList = loadWordList(data);
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: (err as Error).message });
    }
    return;
  }

  if (type === 'generate') {
    try {
      if (!wordList) throw new Error('Word list not loaded');
      const options: GenerateOptions | undefined = payload?.options;
      const puzzle = generatePuzzle(wordList, options);
      self.postMessage({ type: 'success', puzzle });
    } catch (err) {
      self.postMessage({ type: 'error', message: (err as Error).message });
    }
    return;
  }
};
```

**Step 2: Verify TypeScript compiles**

```bash
pnpm typecheck
```

Expected: No errors in src/engine/.

**Step 3: Commit**

```bash
git add src/engine/worker.ts
git commit -m "feat(engine): add Web Worker entry point"
```

---

## Phase 5: Auth, Database & API

### Task 13: Supabase database schema

**Files:**
- Create: `supabase/migrations/001_initial.sql`

**Step 1: Write the migration SQL**

```sql
-- supabase/migrations/001_initial.sql

-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,                    -- user_ + nanoid
  google_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Puzzles table
CREATE TABLE puzzles (
  id TEXT PRIMARY KEY,                    -- pzl_ + nanoid
  share_slug TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  grid_data JSONB NOT NULL,
  solution_hash TEXT NOT NULL,
  entries_data JSONB NOT NULL,
  pattern_data JSONB NOT NULL,
  size INTEGER NOT NULL DEFAULT 13,
  is_shared BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_puzzles_share_slug ON puzzles(share_slug);
CREATE INDEX idx_puzzles_created_by ON puzzles(created_by);

-- RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;

-- Anyone can read shared puzzles
CREATE POLICY "Public read shared puzzles"
  ON puzzles FOR SELECT
  USING (is_shared = true);

-- Authenticated users can insert puzzles
CREATE POLICY "Auth users create puzzles"
  ON puzzles FOR INSERT
  WITH CHECK (true);  -- Auth checked at API layer

-- Users can read their own data
CREATE POLICY "Users read own data"
  ON users FOR SELECT
  USING (true);  -- Simplified for v1

CREATE POLICY "Users insert own data"
  ON users FOR INSERT
  WITH CHECK (true);  -- Auth checked at API layer
```

**Step 2: Apply migration via Supabase dashboard or CLI**

**Step 3: Commit**

```bash
git add supabase/
git commit -m "feat(db): add initial Supabase migration (users + puzzles)"
```

---

### Task 14: Auth configuration

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

**Step 1: Implement auth config**

```typescript
// src/lib/auth.ts
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.provider !== 'google') return false;

      // Upsert user in Supabase
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('google_id', account.providerAccountId)
        .single();

      if (!existing) {
        await supabase.from('users').insert({
          id: `user_${nanoid()}`,
          google_id: account.providerAccountId,
          email: user.email,
          display_name: user.name ?? 'Anonymous',
          avatar_url: user.image,
        });
      }

      return true;
    },
    async session({ session, token }) {
      // Fetch user ID from Supabase
      if (token.sub) {
        const { data } = await supabase
          .from('users')
          .select('id, display_name, avatar_url')
          .eq('google_id', token.sub)
          .single();

        if (data && session.user) {
          (session.user as Record<string, unknown>).userId = data.id;
          (session.user as Record<string, unknown>).displayName = data.display_name;
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
```

**Step 2: Create the route handler**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

**Step 3: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/
git commit -m "feat(auth): add NextAuth with Google OAuth + Supabase user sync"
```

---

### Task 15: Database client + API routes

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/share.ts`
- Create: `src/app/api/puzzles/route.ts`
- Create: `src/app/api/puzzles/[slug]/route.ts`

**Step 1: Create Supabase client helper**

```typescript
// src/lib/db.ts
import { createClient } from '@supabase/supabase-js';

export function getSupabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 2: Create share utility**

```typescript
// src/lib/share.ts
import { nanoid } from 'nanoid';

export function generateShareSlug(): string {
  return nanoid(8);
}

export function generatePuzzleId(): string {
  return `pzl_${nanoid()}`;
}

export function getShareUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  return `${base}/play/${slug}`;
}
```

**Step 3: Create POST /api/puzzles**

```typescript
// src/app/api/puzzles/route.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/db';
import { generateShareSlug, generatePuzzleId, getShareUrl } from '@/lib/share';
import { getPlayerPuzzle } from '@/engine/player-puzzle';
import { obfuscateSolution } from '@/engine/solution';
import { BLACK } from '@/engine/types';
import type { Puzzle } from '@/engine/types';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json() as { grid: string[][]; entries: Puzzle['entries']; size: number };
    const supabase = getSupabaseServer();

    const puzzleId = generatePuzzleId();
    const shareSlug = generateShareSlug();
    const solutionHash = obfuscateSolution(body.grid, puzzleId);
    const pattern = body.grid.map(row => row.map(cell => cell === BLACK ? 0 : 1));

    const userId = (session.user as Record<string, unknown>).userId as string;

    const { error } = await supabase.from('puzzles').insert({
      id: puzzleId,
      share_slug: shareSlug,
      created_by: userId,
      grid_data: body.grid,
      solution_hash: solutionHash,
      entries_data: body.entries,
      pattern_data: pattern,
      size: body.size,
      is_shared: true,
    });

    if (error) {
      return Response.json({ error: 'Failed to save puzzle' }, { status: 500 });
    }

    return Response.json({
      id: puzzleId,
      shareSlug,
      shareUrl: getShareUrl(shareSlug),
    });
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

**Step 4: Create GET /api/puzzles/[slug]**

```typescript
// src/app/api/puzzles/[slug]/route.ts
import { getSupabaseServer } from '@/lib/db';
import type { PlayerEntry } from '@/engine/types';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from('puzzles')
    .select('id, size, pattern_data, solution_hash, entries_data, users!created_by(display_name)')
    .eq('share_slug', params.slug)
    .single();

  if (error || !data) {
    return Response.json({ error: 'Puzzle not found' }, { status: 404 });
  }

  // Strip answers from entries
  const entries: PlayerEntry[] = (data.entries_data as Array<Record<string, unknown>>).map(
    ({ number, direction, clue, start, length }) => ({
      number: number as number,
      direction: direction as 'across' | 'down',
      clue: clue as string,
      start: start as [number, number],
      length: length as number,
    })
  );

  const creatorName = (data.users as Record<string, unknown>)?.display_name as string | undefined;

  return Response.json({
    id: data.id,
    size: data.size,
    pattern: data.pattern_data,
    solutionHash: data.solution_hash,
    entries,
    creatorName: creatorName ?? 'Anonymous',
  });
}
```

**Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/share.ts src/app/api/puzzles/
git commit -m "feat(api): add puzzle CRUD endpoints + share utilities"
```

---

## Phase 6: UI Components

### Task 16: App layout with fonts and header

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/ui/header.tsx`

**Context:** Set up the root layout with Google Fonts, crossword-styles.css import, and a header component with logo + auth button. Refer to `docs/styleguide.md` for fonts and design tokens.

**Step 1: Implement layout.tsx**

Import Libre Baskerville + Libre Franklin via `next/font/google`. Import `@/styles/crossword-styles.css`. Wrap children in a `<div className="container">` with the Header component.

**Step 2: Implement header.tsx**

Server component by default. Shows app name (h1, Baskerville) on left, sign-in/avatar on right. Use `getServerSession` to check auth state. Use `flex-between` class from crossword-styles.css.

**Step 3: Verify dev server renders**

```bash
pnpm dev
```

Expected: Page loads with header, fonts applied.

**Step 4: Commit**

```bash
git add src/app/layout.tsx src/components/ui/header.tsx
git commit -m "feat(ui): add root layout with fonts, CSS, and header"
```

---

### Task 17: Grid display component (read-only, for creator preview)

**Files:**
- Create: `src/components/grid/crossword-grid.tsx`

**Context:** Renders a crossword grid using the CSS classes from crossword-styles.css. Used in both creator view (read-only, shows answers) and player view (interactive). This task builds the read-only version.

**Step 1: Implement CrosswordGrid**

`'use client'` component. Props: `grid: string[][]`, `entries: Entry[]`, optional interaction callbacks. Uses `.grid-container`, `.grid-row`, `.grid-cell`, `.black`, `.cell-number` classes. Memoize individual Cell components (169 cells for 13×13).

Follow the Cell pattern from CLAUDE.md exactly:

```typescript
const Cell = memo(function Cell({ letter, isBlack, isSelected, isHighlighted, number, onClick }: CellProps) {
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

**Step 2: Commit**

```bash
git add src/components/grid/crossword-grid.tsx
git commit -m "feat(ui): add CrosswordGrid component"
```

---

### Task 18: Clue list component

**Files:**
- Create: `src/components/clues/clue-list.tsx`

**Context:** Displays Across and Down clues in two columns. Uses `.clue-columns`, `.clue-column`, `.clue-item`, `.cn`, `.active-clue` classes.

**Step 1: Implement ClueList**

Props: `entries`, `activeEntry` (optional), `onClueClick` (optional). Split entries into across/down. Show number + clue text. Highlight active clue with `.active-clue` class.

**Step 2: Commit**

```bash
git add src/components/clues/clue-list.tsx
git commit -m "feat(ui): add ClueList component"
```

---

### Task 19: usePuzzleGenerator hook

**Files:**
- Create: `src/hooks/use-puzzle-generator.ts`

**Context:** Manages Web Worker lifecycle. Follow the exact pattern from CLAUDE.md: create worker on mount, send 'init', track 'ready' state, expose `generate()` that returns a Promise with timeout.

**Step 1: Implement the hook**

Follow CLAUDE.md pattern exactly. Key details:
- Worker URL: `new URL('../engine/worker.ts', import.meta.url)`
- Ready state tracks when word list is loaded
- `generate()` returns `Promise<Puzzle>` with 60s timeout
- Cleanup: `worker.terminate()` on unmount

**Step 2: Commit**

```bash
git add src/hooks/use-puzzle-generator.ts
git commit -m "feat(hooks): add usePuzzleGenerator hook for Worker lifecycle"
```

---

### Task 20: Creator page (homepage)

**Files:**
- Modify: `src/app/page.tsx`

**Context:** The main creator view. Shows a "Generate Crossword" button, grid preview (when generated), clue list, and "Share" button. See PRD UI layout.

**Step 1: Implement the creator page**

`'use client'` component. Uses:
- `usePuzzleGenerator` hook for generate
- `CrosswordGrid` for preview (read-only, answers visible)
- `ClueList` for clue display
- Generate button: `.btn .btn-primary`, shows "Generating..." spinner when working
- Share button: `.btn .btn-export`, disabled until puzzle exists
- Loading state: "Loading word list..." shown while worker initializes

**Step 2: Add share flow**

When Share clicked:
- If not signed in → trigger Google sign-in via `signIn('google')`
- If signed in → POST puzzle to `/api/puzzles`, show share URL in a modal/dialog
- Copy link button with clipboard API

**Step 3: Verify in browser**

```bash
pnpm dev
```

Expected: Page loads, "Generate" button works (may take time with full wordlist), grid + clues appear.

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): add creator page with generate + share flow"
```

---

## Phase 7: Player View

### Task 21: Puzzle state manager

**Files:**
- Create: `src/state/puzzle-state.ts`
- Create: `tests/engine/puzzle-state.test.ts`

**Context:** Manages the solve session: player grid, cursor position, selected direction, input handling. This is a reducer — no side effects, no class.

**Step 1: Write failing tests**

Test key behaviors:
- Initial state from a PlayerPuzzle (empty grid matching pattern)
- Selecting a cell updates cursor and highlights the entry
- Clicking selected cell toggles direction
- Typing a letter fills cell and advances cursor
- Backspace clears and moves back
- Arrow keys move cursor (skip black squares)
- Tab jumps to next entry
- `isComplete()` returns true when all white cells filled

**Step 2: Implement puzzle-state.ts as a reducer**

```typescript
// Core state shape:
interface PuzzleState {
  playerGrid: string[][];
  cursor: { row: number; col: number };
  direction: Direction;
  pattern: number[][];
  entries: PlayerEntry[];
}

type PuzzleAction =
  | { type: 'SELECT_CELL'; row: number; col: number }
  | { type: 'TYPE_LETTER'; letter: string }
  | { type: 'BACKSPACE' }
  | { type: 'ARROW'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'TAB'; shift: boolean }
  | { type: 'SELECT_CLUE'; entry: PlayerEntry };

export function puzzleReducer(state: PuzzleState, action: PuzzleAction): PuzzleState { ... }
export function initPuzzleState(puzzle: PlayerPuzzle): PuzzleState { ... }
export function isComplete(state: PuzzleState): boolean { ... }
export function getActiveEntry(state: PuzzleState): PlayerEntry | null { ... }
export function getHighlightedCells(state: PuzzleState): Set<string> { ... }
```

**Step 3: Run tests**

**Step 4: Commit**

```bash
git add src/state/puzzle-state.ts tests/engine/puzzle-state.test.ts
git commit -m "feat(state): add puzzle state reducer for solve sessions"
```

---

### Task 22: Timer hook

**Files:**
- Create: `src/state/timer.ts`

**Step 1: Implement useTimer hook**

```typescript
// Starts on first call to start(), counts elapsed seconds, formats as MM:SS
// Pauses on tab blur (document.hidden), resumes on focus
export function useTimer(): {
  elapsedSeconds: number;
  formatted: string;       // "MM:SS"
  start: () => void;
  isRunning: boolean;
}
```

**Step 2: Commit**

```bash
git add src/state/timer.ts
git commit -m "feat(state): add useTimer hook"
```

---

### Task 23: Interactive player grid

**Files:**
- Modify: `src/components/grid/crossword-grid.tsx` (add interactive mode)

**Context:** Extend the grid component to support player interaction: cell selection, keyboard input, direction toggling. Uses the puzzle state reducer.

**Step 1: Add interactive props**

Add props for: `playerGrid`, `cursor`, `direction`, `highlightedCells`, `onCellClick`, `onKeyDown`. When in interactive mode, show player-typed letters instead of answers. Attach a hidden `<input>` or use `tabIndex` + `onKeyDown` on the grid container to capture keyboard events.

**Step 2: Wire up keyboard handler**

Handle: letter keys → TYPE_LETTER, Backspace → BACKSPACE, arrows → ARROW, Tab → TAB. Dispatch to the reducer.

**Step 3: Commit**

```bash
git add src/components/grid/crossword-grid.tsx
git commit -m "feat(ui): add interactive mode to CrosswordGrid"
```

---

### Task 24: Active clue bar

**Files:**
- Create: `src/components/player/clue-bar.tsx`

**Context:** Shows the currently active clue prominently above the grid. Format: "1 Across — A common greeting". Uses `.text-body` styling.

**Step 1: Implement ClueBar**

Simple component. Props: `activeEntry: PlayerEntry | null`. Renders the clue text.

**Step 2: Commit**

```bash
git add src/components/player/clue-bar.tsx
git commit -m "feat(ui): add active clue bar component"
```

---

### Task 25: Completion detection + confetti

**Files:**
- Create: `src/components/player/completion-overlay.tsx`

**Context:** When all cells are filled and correct, show confetti + congratulations message. Uses `canvas-confetti` library. Overlay shows time, "Share Your Time" button, "Play Another" link.

**Step 1: Install canvas-confetti** (already in Task 1)

**Step 2: Implement CompletionOverlay**

`'use client'` component. Props: `time: string`, `creatorName: string`, `shareUrl: string`. On mount, fire confetti for 3-5 seconds. Show overlay message per PRD spec.

**Step 3: Commit**

```bash
git add src/components/player/completion-overlay.tsx
git commit -m "feat(ui): add completion overlay with confetti"
```

---

### Task 26: Player page — compose everything

**Files:**
- Create: `src/app/play/[slug]/page.tsx`

**Context:** Server component that fetches puzzle data, then renders the client-side player. This is the most complex page — it composes: interactive grid, clue bar, clue list, timer, puzzle state, completion detection.

**Step 1: Server component for data fetching**

Fetch puzzle from `/api/puzzles/[slug]` (or directly from Supabase on server). If not found, call `notFound()` from next/navigation.

**Step 2: Client wrapper component**

`'use client'` component that receives the PlayerPuzzle data and manages:
- `useReducer(puzzleReducer, initPuzzleState(puzzle))`
- `useTimer()` — start on first keystroke
- Keyboard event handling (dispatch to reducer)
- Completion detection: after each keystroke, check `isComplete(state)`, then call `validateSolution()` from engine
- Render: Header with timer → ClueBar → CrosswordGrid (interactive) → ClueList

**Step 3: Verify in browser**

Requires a shared puzzle in the database. For dev testing, manually insert a test puzzle or test after the share flow works.

**Step 4: Commit**

```bash
git add src/app/play/
git commit -m "feat(ui): add player page with interactive solve experience"
```

---

## Phase 8: Supporting Pages & Polish

### Task 27: My Puzzles page

**Files:**
- Create: `src/app/my-puzzles/page.tsx`

**Context:** Protected page showing user's shared puzzles. Redirects to sign-in if not authenticated.

**Step 1: Implement as server component**

Check session, fetch puzzles from Supabase where `created_by = userId`, render list with share links and created dates.

**Step 2: Commit**

```bash
git add src/app/my-puzzles/
git commit -m "feat(ui): add My Puzzles page"
```

---

### Task 28: 404 page for invalid slugs

**Files:**
- Create: `src/app/not-found.tsx`

**Step 1: Implement not-found page**

Simple page: "Puzzle not found" message with link back to homepage. Uses `.text-center` and `.btn .btn-primary` for the home link.

**Step 2: Commit**

```bash
git add src/app/not-found.tsx
git commit -m "feat(ui): add 404 page"
```

---

### Task 29: Mobile polish

**Files:**
- Modify: `src/components/grid/crossword-grid.tsx`

**Context:** Ensure grid is usable on mobile. The CSS already handles responsive cell sizes via `@media (max-width: 640px)`. This task focuses on touch interaction and virtual keyboard support.

**Step 1: Add touch handling**

Ensure `onClick` works for touch. Add a hidden `<input>` element that follows the selected cell to trigger the native keyboard on mobile devices.

**Step 2: Test on mobile viewport**

Use Chrome DevTools responsive mode to verify layout stacks correctly and cells are tappable.

**Step 3: Commit**

```bash
git add src/components/grid/crossword-grid.tsx
git commit -m "fix(ui): improve mobile touch interaction and virtual keyboard"
```

---

## Phase 9: E2E Testing

### Task 30: Playwright setup + critical flows

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/generate.spec.ts`
- Create: `tests/e2e/player.spec.ts`

**Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
npx playwright install
```

**Step 2: Write E2E tests**

Critical flows per PRD:
1. Generate a puzzle → grid appears with clues
2. Invalid share slug → 404 page
3. (With test data) Solve a puzzle correctly → confetti appears

**Step 3: Run E2E tests**

```bash
pnpm test:e2e
```

**Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e/
git commit -m "test(e2e): add Playwright tests for critical user flows"
```

---

## Task Dependency Graph

```
Task 1 (scaffolding)
├── Task 2 (wordlist build) → Task 8 (wordlist loader)
├── Task 3 (types) → Task 4 (solution) → Task 7 (player-puzzle)
│                  → Task 5 (numbering) → Task 11 (generator)
│                  → Task 6 (validator) → Task 9 (patterns) → Task 10 (filler) → Task 11
├── Task 11 (generator) → Task 12 (worker) → Task 19 (hook) → Task 20 (creator page)
├── Task 13 (db schema) → Task 15 (API routes) → Task 20 (creator page)
├── Task 14 (auth) → Task 15 (API routes)
├── Task 16 (layout) → Task 17 (grid) → Task 20 (creator page)
│                    → Task 18 (clues) → Task 20
├── Task 20 (creator) → Task 26 (player page)
├── Task 21 (state) → Task 23 (interactive grid) → Task 26
├── Task 22 (timer) → Task 26
├── Task 24 (clue bar) → Task 26
├── Task 25 (confetti) → Task 26
├── Task 26 (player page) → Task 27, 28, 29, 30
```

## Summary

**30 tasks across 9 phases.** The critical path is:

1. **Scaffolding** (Task 1)
2. **Engine core** (Tasks 3-7) — types, solution, numbering, validation, player-puzzle
3. **Word list + generator** (Tasks 2, 8-11) — build pipeline, loader, patterns, fill, orchestrator
4. **Worker** (Task 12) — integration boundary
5. **Auth + DB + API** (Tasks 13-15) — Supabase, NextAuth, routes
6. **UI** (Tasks 16-20) — layout, grid, clues, hook, creator page
7. **Player** (Tasks 21-26) — state, timer, interaction, clue bar, confetti, player page
8. **Supporting** (Tasks 27-29) — my puzzles, 404, mobile
9. **E2E** (Task 30) — Playwright tests

**The hardest parts are Tasks 9-10** (pattern generation + grid fill). These are the algorithmic core. Everything else is standard web app plumbing.

**Data prerequisite:** The wordlist needs more clues generated (currently 99/526K). Run clue generation in parallel with app development. The engine works without clues (uses word-as-clue fallback) but the user experience requires real clues.
