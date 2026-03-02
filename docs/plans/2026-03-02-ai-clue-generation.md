# AI Clue Generation (Gemini Flash) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a sparkle button next to each clue's refresh button that generates a new crossword clue via Gemini Flash 2.5 Lite, replaces the current clue immediately, and persists the generated clue to `wordlist.db` + a `llm-clues.jsonl` backup file.

**Architecture:** Client-side sparkle button triggers `POST /api/clues/generate` with the word and existing clues. The API route (auth-gated) calls Gemini for a single clue, writes it to `wordlist.db` (appends to the word's clue array) and `llm-clues.jsonl`, then returns it. The client updates puzzle state. Persistence is local-dev only (filesystem writes don't work on Vercel's read-only FS).

**Tech Stack:** `@google/generative-ai` (Google AI SDK), `better-sqlite3` (moved to dependencies), Next.js API route, NextAuth session check.

---

## Environment Setup

Add to `.env.local`:
```
GEMINI_API_KEY=your-gemini-api-key-here
```

---

### Task 1: Install Google AI SDK

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run: `pnpm add @google/generative-ai`

**Step 2: Move better-sqlite3 to dependencies**

Run: `pnpm add better-sqlite3` (this moves it from devDependencies to dependencies)

**Step 3: Configure Next.js to externalize better-sqlite3**

Modify: `next.config.mjs`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
```

This prevents Next.js from trying to bundle the native module.

**Step 4: Verify dev server still works**

Run: `pnpm dev` — confirm no errors on startup, visit localhost:3000.

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml next.config.mjs
git commit -m "chore: add @google/generative-ai, move better-sqlite3 to deps"
```

---

### Task 2: Create Gemini client helper

**Files:**
- Create: `src/lib/gemini.ts`
- Test: `tests/lib/gemini.test.ts`

**Step 1: Write the failing test**

Create `tests/lib/gemini.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildCluePrompt } from '@/lib/gemini';

describe('buildCluePrompt', () => {
  it('includes the word in the prompt', () => {
    const prompt = buildCluePrompt('TIGER', []);
    expect(prompt).toContain('TIGER');
  });

  it('includes existing clues to avoid', () => {
    const prompt = buildCluePrompt('TIGER', ['Big cat', 'Striped predator']);
    expect(prompt).toContain('Big cat');
    expect(prompt).toContain('Striped predator');
  });

  it('handles empty existing clues', () => {
    const prompt = buildCluePrompt('APPLE', []);
    expect(prompt).toContain('APPLE');
    expect(prompt).not.toContain('Avoid duplicating');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/gemini.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `src/lib/gemini.ts`:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_ID = 'gemini-2.5-flash-lite';

export function buildCluePrompt(word: string, existingClues: string[]): string {
  let prompt = `You are an expert crossword puzzle constructor. Generate a single crossword clue for the word "${word}".

Requirements:
- The clue must be concise (typically 3-8 words)
- Use standard crossword clue conventions
- Do NOT include the answer word or any form of it in the clue
- Vary style: definitions, wordplay, cultural references, double meanings`;

  if (existingClues.length > 0) {
    prompt += `\n\nAvoid duplicating these existing clues:\n${existingClues.map(c => `- ${c}`).join('\n')}`;
  }

  prompt += '\n\nRespond with ONLY the clue text, nothing else.';
  return prompt;
}

export async function generateCrosswordClue(
  word: string,
  existingClues: string[],
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_ID });

  const prompt = buildCluePrompt(word, existingClues);
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  if (!text) throw new Error('Empty response from Gemini');
  return text;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/gemini.test.ts`
Expected: PASS (3 tests — only `buildCluePrompt` is tested; `generateCrosswordClue` calls the live API so we don't unit-test it).

**Step 5: Commit**

```bash
git add src/lib/gemini.ts tests/lib/gemini.test.ts
git commit -m "feat: add Gemini client helper with prompt builder"
```

---

### Task 3: Create the clue persistence helper

**Files:**
- Create: `src/lib/clue-store.ts`
- Test: `tests/lib/clue-store.test.ts`

This helper writes AI-generated clues to `wordlist.db` and `llm-clues.jsonl`. It's a server-only module (uses `fs` and `better-sqlite3`).

**Step 1: Write the failing test**

Create `tests/lib/clue-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { existsSync, unlinkSync, readFileSync } from 'fs';
import { join } from 'path';
import { saveGeneratedClue } from '@/lib/clue-store';

const TEST_DB = join(__dirname, 'test-wordlist.db');
const TEST_JSONL = join(__dirname, 'test-llm-clues.jsonl');

function createTestDb(): Database.Database {
  const db = new Database(TEST_DB);
  db.exec(`
    CREATE TABLE words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT UNIQUE NOT NULL,
      length INTEGER,
      status TEXT DEFAULT 'pending',
      clues TEXT,
      model TEXT,
      updated_at TEXT
    )
  `);
  db.prepare('INSERT INTO words (word, length, clues, status) VALUES (?, ?, ?, ?)').run(
    'TIGER', 5, JSON.stringify(['Big cat', 'Striped predator']), 'done'
  );
  return db;
}

describe('saveGeneratedClue', () => {
  beforeEach(() => {
    if (existsSync(TEST_JSONL)) unlinkSync(TEST_JSONL);
  });

  afterEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    if (existsSync(TEST_JSONL)) unlinkSync(TEST_JSONL);
  });

  it('appends clue to wordlist.db and creates jsonl backup', () => {
    const db = createTestDb();
    db.close();

    saveGeneratedClue('TIGER', 'Jungle feline', TEST_DB, TEST_JSONL);

    const db2 = new Database(TEST_DB, { readonly: true });
    const row = db2.prepare('SELECT clues FROM words WHERE word = ?').get('TIGER') as { clues: string };
    const clues = JSON.parse(row.clues);
    expect(clues).toContain('Jungle feline');
    expect(clues).toHaveLength(3);
    db2.close();

    const jsonl = readFileSync(TEST_JSONL, 'utf-8').trim();
    const entry = JSON.parse(jsonl);
    expect(entry.word).toBe('TIGER');
    expect(entry.clue).toBe('Jungle feline');
  });

  it('handles word not in db gracefully', () => {
    const db = createTestDb();
    db.close();

    // Should not throw — just skip DB write, still write to JSONL
    saveGeneratedClue('UNKNOWN', 'Mystery word', TEST_DB, TEST_JSONL);

    const jsonl = readFileSync(TEST_JSONL, 'utf-8').trim();
    const entry = JSON.parse(jsonl);
    expect(entry.word).toBe('UNKNOWN');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/clue-store.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `src/lib/clue-store.ts`:

```typescript
import Database from 'better-sqlite3';
import { appendFileSync } from 'fs';
import { join } from 'path';

const DEFAULT_DB_PATH = join(process.cwd(), 'wordlist.db');
const DEFAULT_JSONL_PATH = join(process.cwd(), 'llm-clues.jsonl');

export function saveGeneratedClue(
  word: string,
  clue: string,
  dbPath: string = DEFAULT_DB_PATH,
  jsonlPath: string = DEFAULT_JSONL_PATH,
): void {
  const upper = word.toUpperCase();

  // 1. Append to JSONL backup (always — even if DB write fails)
  const entry = {
    word: upper,
    clue,
    model: 'gemini-2.5-flash-lite',
    timestamp: new Date().toISOString(),
  };
  appendFileSync(jsonlPath, JSON.stringify(entry) + '\n');

  // 2. Append to wordlist.db
  try {
    const db = new Database(dbPath);
    const row = db.prepare('SELECT clues FROM words WHERE word = ?').get(upper) as
      | { clues: string | null }
      | undefined;

    if (row) {
      const existing: string[] = row.clues ? JSON.parse(row.clues) : [];
      if (!existing.includes(clue)) {
        existing.push(clue);
        db.prepare('UPDATE words SET clues = ?, updated_at = ? WHERE word = ?').run(
          JSON.stringify(existing),
          new Date().toISOString(),
          upper,
        );
      }
    }
    db.close();
  } catch {
    // DB write is best-effort (may fail on read-only filesystems like Vercel)
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/clue-store.test.ts`
Expected: PASS (2 tests).

**Step 5: Commit**

```bash
git add src/lib/clue-store.ts tests/lib/clue-store.test.ts
git commit -m "feat: add clue persistence to wordlist.db and llm-clues.jsonl"
```

---

### Task 4: Create the API route

**Files:**
- Create: `src/app/api/clues/generate/route.ts`

**Step 1: Write the API route**

Create `src/app/api/clues/generate/route.ts`:

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateCrosswordClue } from '@/lib/gemini';
import { saveGeneratedClue } from '@/lib/clue-store';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Sign in required' }, { status: 401 });
  }

  let body: { word?: string; existingClues?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const word = body.word?.toUpperCase();
  if (!word || word.length < 2 || !/^[A-Z]+$/.test(word)) {
    return Response.json({ error: 'Invalid word' }, { status: 400 });
  }

  const existingClues = body.existingClues ?? [];

  try {
    const clue = await generateCrosswordClue(word, existingClues);
    saveGeneratedClue(word, clue);
    return Response.json({ clue });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate clue';
    return Response.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Manual test**

Run: `pnpm dev`
Test with curl (you need a valid session cookie, so test via the UI in Task 6 instead).

**Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/app/api/clues/generate/route.ts
git commit -m "feat: add POST /api/clues/generate route with auth + persistence"
```

---

### Task 5: Add sparkle button to ClueList component

**Files:**
- Modify: `src/components/clues/clue-list.tsx`

**Step 1: Add `onAiClue` prop and `aiGeneratingKey` prop**

The `ClueListProps` interface (line 13) gets two new optional props:

```typescript
onAiClue?: (number: number, direction: Direction) => void;
aiGeneratingKey?: string | null; // format: "${number}-${direction}" when generating
```

**Step 2: Update `CreatorClueRow` to accept and render the sparkle button**

Add to the function signature:
```typescript
onAiClue?: (number: number, direction: Direction) => void;
isAiGenerating?: boolean;
```

Add the sparkle button after the refresh button in the JSX:

```tsx
<button
  className="btn-icon clue-sparkle"
  onClick={() => onAiClue?.(entry.number, entry.direction)}
  disabled={isAiGenerating}
  title="Generate AI clue"
>
  {isAiGenerating ? (
    <span className="spinner-dot">...</span>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0L9.2 5.8L14 3.5L10.2 7.4L16 8L10.2 8.6L14 12.5L9.2 10.2L8 16L6.8 10.2L2 12.5L5.8 8.6L0 8L5.8 7.4L2 3.5L6.8 5.8Z" />
    </svg>
  )}
</button>
```

**Step 3: Pass props through in `ClueList`**

In the editable branch, pass `onAiClue` and compute `isAiGenerating` per row:

```tsx
<CreatorClueRow
  key={`${entry.number}a`}
  entry={entry}
  onClueEdit={onClueEdit}
  onClueRefresh={onClueRefresh}
  onAiClue={onAiClue}
  isAiGenerating={aiGeneratingKey === `${entry.number}-${entry.direction}`}
/>
```

(Same for the down section.)

**Step 4: Full updated file**

See the complete `clue-list.tsx` after edits:

```tsx
'use client';

import { useState, useEffect } from 'react';
import type { Direction } from '@/engine/types';

interface ClueEntry {
  number: number;
  direction: Direction;
  clue: string;
  answer?: string;
}

interface ClueListProps {
  entries: readonly ClueEntry[];
  activeNumber?: number | null;
  activeDirection?: Direction | null;
  onClueClick?: (entry: ClueEntry) => void;
  editable?: boolean;
  onClueEdit?: (number: number, direction: Direction, newClue: string) => void;
  onClueRefresh?: (number: number, direction: Direction) => void;
  onAiClue?: (number: number, direction: Direction) => void;
  aiGeneratingKey?: string | null;
}

function CreatorClueRow({
  entry,
  onClueEdit,
  onClueRefresh,
  onAiClue,
  isAiGenerating,
}: {
  entry: ClueEntry;
  onClueEdit?: (number: number, direction: Direction, newClue: string) => void;
  onClueRefresh?: (number: number, direction: Direction) => void;
  onAiClue?: (number: number, direction: Direction) => void;
  isAiGenerating?: boolean;
}) {
  const [draft, setDraft] = useState(entry.clue);

  useEffect(() => {
    setDraft(entry.clue);
  }, [entry.clue]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== entry.clue) {
      onClueEdit?.(entry.number, entry.direction, trimmed);
    } else {
      setDraft(entry.clue);
    }
  };

  return (
    <div className="clue-row">
      <span className="clue-num">{entry.number}.</span>
      {entry.answer && <span className="clue-word">{entry.answer}</span>}
      <input
        className="input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); }}
        onBlur={commit}
      />
      <button
        className="btn-icon clue-refresh"
        onClick={() => onClueRefresh?.(entry.number, entry.direction)}
        title="Next clue"
      >
        ↻
      </button>
      <button
        className="btn-icon clue-sparkle"
        onClick={() => onAiClue?.(entry.number, entry.direction)}
        disabled={isAiGenerating}
        title="Generate AI clue"
      >
        {isAiGenerating ? (
          <span className="spinner-dot">···</span>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0L9.2 5.8L14 3.5L10.2 7.4L16 8L10.2 8.6L14 12.5L9.2 10.2L8 16L6.8 10.2L2 12.5L5.8 8.6L0 8L5.8 7.4L2 3.5L6.8 5.8Z" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function ClueList({
  entries, activeNumber, activeDirection, onClueClick,
  editable, onClueEdit, onClueRefresh, onAiClue, aiGeneratingKey,
}: ClueListProps) {
  const across = entries.filter(e => e.direction === 'across');
  const down = entries.filter(e => e.direction === 'down');

  if (editable) {
    return (
      <div className="clue-creator">
        <div className="clue-section">
          <h4>Across</h4>
          {across.map(entry => (
            <CreatorClueRow
              key={`${entry.number}a`}
              entry={entry}
              onClueEdit={onClueEdit}
              onClueRefresh={onClueRefresh}
              onAiClue={onAiClue}
              isAiGenerating={aiGeneratingKey === `${entry.number}-${entry.direction}`}
            />
          ))}
        </div>
        <div className="clue-section">
          <h4>Down</h4>
          {down.map(entry => (
            <CreatorClueRow
              key={`${entry.number}d`}
              entry={entry}
              onClueEdit={onClueEdit}
              onClueRefresh={onClueRefresh}
              onAiClue={onAiClue}
              isAiGenerating={aiGeneratingKey === `${entry.number}-${entry.direction}`}
            />
          ))}
        </div>
      </div>
    );
  }

  // Player (read-only) layout — unchanged
  const renderItem = (entry: ClueEntry, keySuffix: string) => {
    const isActive = activeNumber === entry.number && activeDirection === entry.direction;
    return (
      <div
        key={`${entry.number}${keySuffix}`}
        className={`clue-item${isActive ? ' active-clue' : ''}`}
        onClick={() => onClueClick?.(entry)}
      >
        <span className="cn">{entry.number}</span>
        {entry.clue}
      </div>
    );
  };

  return (
    <div className="clue-columns">
      <div className="clue-column">
        <h4>Across</h4>
        {across.map(entry => renderItem(entry, 'a'))}
      </div>
      <div className="clue-column">
        <h4>Down</h4>
        {down.map(entry => renderItem(entry, 'd'))}
      </div>
    </div>
  );
}
```

**Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: No errors.

**Step 6: Commit**

```bash
git add src/components/clues/clue-list.tsx
git commit -m "feat: add AI clue sparkle button to creator clue rows"
```

---

### Task 6: Wire up AI clue generation in creator page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add state for tracking which clue is generating**

After the existing state declarations (~line 20), add:

```typescript
const [aiGeneratingKey, setAiGeneratingKey] = useState<string | null>(null);
```

**Step 2: Add `handleAiClue` callback**

After `handleClueRefresh`, add:

```typescript
const handleAiClue = useCallback(async (number: number, direction: Direction) => {
  if (!puzzle || !session?.user) return;
  const entry = puzzle.entries.find(e => e.number === number && e.direction === direction);
  if (!entry?.answer) return;

  const key = `${number}-${direction}`;
  setAiGeneratingKey(key);
  try {
    // Gather existing clues for this word (from cache or current)
    const existingClues = clueCache.current.get(entry.answer) ?? [entry.clue];

    const res = await fetch('/api/clues/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: entry.answer, existingClues }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? 'Failed to generate clue');
    }

    const { clue } = await res.json();
    handleClueEdit(number, direction, clue);

    // Add to clue cache so refresh button includes it
    const cached = clueCache.current.get(entry.answer);
    if (cached && !cached.includes(clue)) {
      cached.push(clue);
    }
  } catch (err) {
    setError((err as Error).message);
  } finally {
    setAiGeneratingKey(null);
  }
}, [puzzle, session, handleClueEdit]);
```

**Step 3: Pass new props to `<ClueList>`**

Update the `<ClueList>` usage (~line 253):

```tsx
<ClueList
  entries={puzzle.entries}
  editable
  onClueEdit={handleClueEdit}
  onClueRefresh={handleClueRefresh}
  onAiClue={handleAiClue}
  aiGeneratingKey={aiGeneratingKey}
/>
```

**Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: No errors.

**Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire AI clue generation into creator page"
```

---

### Task 7: Add CSS styles for sparkle button

**Files:**
- Modify: `src/styles/crossword-styles.css`

**Step 1: Add styles after the existing `.clue-refresh` block**

After the `.clue-refresh:hover` rule (~line 303), add:

```css
.clue-sparkle {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  color: #5a5a5a;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}
.clue-sparkle:hover { background: #f0f0f0; color: #326891; }
.clue-sparkle:disabled { color: #ccc; cursor: not-allowed; background: none; }

.spinner-dot {
  font-size: 0.7rem;
  letter-spacing: 1px;
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
```

**Step 2: Verify visual appearance**

Run: `pnpm dev` — generate a puzzle, verify the sparkle button appears to the right of the refresh button, correct sizing and hover state.

**Step 3: Commit**

```bash
git add src/styles/crossword-styles.css
git commit -m "feat: add sparkle button and loading animation styles"
```

---

### Task 8: Add GEMINI_API_KEY to .env.example

**Files:**
- Modify: `.env.example` (if it exists, otherwise skip)

**Step 1: Add the env var**

Append to `.env.example`:

```
GEMINI_API_KEY=                    # Google AI Studio key for AI clue generation
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add GEMINI_API_KEY to .env.example"
```

---

### Task 9: End-to-end manual verification

**Checklist (all manual in browser):**

1. `pnpm dev` — app starts without errors
2. Generate a puzzle (5x5 or 7x7 for speed)
3. Verify the sparkle button (star icon) appears to the right of each ↻ button
4. Click sparkle while NOT signed in — nothing happens (auth required)
5. Sign in with Google
6. Click sparkle on a clue — button shows loading dots, then clue text updates
7. Verify `llm-clues.jsonl` was created in project root with the generated clue
8. Open `wordlist.db` and check the word's clues array was updated:
   `sqlite3 wordlist.db "SELECT clues FROM words WHERE word = 'THEWORD'"`
9. Click ↻ refresh on the same clue — the AI-generated clue should appear in the cycle
10. `pnpm typecheck` — no errors
11. `pnpm test:engine` — all existing tests pass
12. `pnpm vitest run tests/lib/` — new tests pass

---

## File Summary

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/lib/gemini.ts` | Gemini API client + prompt builder |
| Create | `src/lib/clue-store.ts` | Persist clues to wordlist.db + JSONL |
| Create | `src/app/api/clues/generate/route.ts` | Auth-gated API route |
| Create | `tests/lib/gemini.test.ts` | Prompt builder tests |
| Create | `tests/lib/clue-store.test.ts` | Persistence tests |
| Modify | `src/components/clues/clue-list.tsx` | Add sparkle button + props |
| Modify | `src/app/page.tsx` | Wire up AI clue handler |
| Modify | `src/styles/crossword-styles.css` | Sparkle button styles |
| Modify | `next.config.mjs` | Externalize better-sqlite3 |
| Modify | `package.json` | New dependency |

## Notes

- **Persistence is local-dev only.** On Vercel, the `wordlist.db` write silently fails (read-only FS). The Gemini call and clue display still work — just no DB persistence. The JSONL write also fails on Vercel but is caught.
- **Rate limiting is not implemented** for v1. The auth gate prevents anonymous abuse. Consider adding a simple in-memory rate limiter later if needed.
- **The `llm-clues.jsonl` file** should be added to `.gitignore` if you don't want it committed. Or commit it as a growing log of AI-generated clues.
