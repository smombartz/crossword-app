# Admin Presets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an admin-only settings page backed by Supabase that stores per-grid-size generation presets, which the engine consumes at generation time.

**Architecture:** New `generation_presets` Supabase table with RLS. Public `GET /api/presets` route for the worker. Admin-gated `POST /api/admin/presets` route. Worker fetches presets on init and merges them into `GenerateOptions` per size. Engine functions accept new optional fields, falling back to current hardcoded values.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), NextAuth session checks, existing CSS design system.

**Design doc:** `docs/plans/2026-02-22-admin-presets-design.md`

---

### Task 1: Extend GenerateOptions with preset fields

**Files:**
- Modify: `src/engine/types.ts:35-39`

**Step 1: Add optional fields to GenerateOptions**

In `src/engine/types.ts`, replace the `GenerateOptions` interface (lines 35-39) with:

```typescript
export interface GenerateOptions {
  readonly size?: number;            // default 13
  readonly seed?: string;            // for reproducibility
  readonly maxAttempts?: number;     // outer generation retry budget (default 50)
  readonly minDensity?: number;      // min black cell ratio (default 0.18)
  readonly maxDensity?: number;      // max black cell ratio (default 0.28)
  readonly minSpan?: number;         // minimum word length (default 3)
  readonly maxCandidates?: number;   // backtracker branching limit (default 50)
  readonly patternAttempts?: number; // inner pattern retry budget (default 20)
}
```

**Step 2: Run typecheck to verify no breakage**

Run: `pnpm typecheck 2>&1 | grep -v tests/`
Expected: No errors (pre-existing test errors excluded)

**Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat(engine): extend GenerateOptions with preset fields"
```

---

### Task 2: Wire preset fields through engine functions

**Files:**
- Modify: `src/engine/generator.ts:18-24`
- Modify: `src/engine/patterns.ts:146-152,196`
- Modify: `src/engine/filler.ts:119,134`

**Step 1: Update `generatePattern` to accept options**

In `src/engine/patterns.ts`, change the `generatePattern` function signature and density/span lines:

Replace lines 146-152 and 196:

```typescript
export function generatePattern(
  size: number,
  maxAttempts: number = 100,
  options?: { minDensity?: number; maxDensity?: number; minSpan?: number },
): string[][] {
  const totalCells = size * size;
  const minBlack = Math.floor(totalCells * (options?.minDensity ?? 0.18));
  const maxBlack = Math.floor(totalCells * (options?.maxDensity ?? 0.28));
```

And line 196 (the `allSpansValid` call):

```typescript
      if (isConnected(grid) && allSpansValid(grid, options?.minSpan ?? 3)) {
```

**Step 2: Update `fillGrid` to accept maxCandidates**

In `src/engine/filler.ts`, change `MAX_CANDIDATES_PER_SLOT` from a constant to a parameter:

Replace lines 118-119:
```typescript
/** Default maximum number of word candidates to try per slot. */
const DEFAULT_MAX_CANDIDATES = 50;
```

Update the `fillGrid` signature (line 153-156) to accept it:
```typescript
export function fillGrid(
  pattern: readonly (readonly string[])[],
  wordList: WordList,
  maxCandidates: number = DEFAULT_MAX_CANDIDATES,
): string[][] | null {
```

Update the `getCandidates` function (lines 125-140) to accept the parameter:
```typescript
function getCandidates(
  grid: readonly (readonly string[])[],
  slot: Slot,
  wordList: WordList,
  usedWords: ReadonlySet<string>,
  maxCandidates: number,
): readonly WordEntry[] {
  const constraints = getConstraints(grid, slot);
  const all = wordList.wordsMatchingPattern(slot.length, constraints);
  const viable: WordEntry[] = [];
  for (let i = 0; i < all.length && viable.length < maxCandidates; i++) {
    if (!usedWords.has(all[i].word)) {
      viable.push(all[i]);
    }
  }
  return viable;
}
```

Update the call to `getCandidates` inside `solve()` (line 193):
```typescript
      const candidates = getCandidates(grid, allSlots[i], wordList, usedWords, maxCandidates);
```

**Step 3: Update `generatePuzzle` to pass options through**

In `src/engine/generator.ts`, replace lines 22-25:

```typescript
    try {
      const pattern = generatePattern(size, options?.patternAttempts ?? 20, {
        minDensity: options?.minDensity,
        maxDensity: options?.maxDensity,
        minSpan: options?.minSpan,
      });
      const filled = fillGrid(pattern, wordList, options?.maxCandidates);
```

**Step 4: Run tests**

Run: `pnpm test:engine`
Expected: All 99 tests pass (no behavior change — all new params default to current values)

**Step 5: Commit**

```bash
git add src/engine/generator.ts src/engine/patterns.ts src/engine/filler.ts
git commit -m "feat(engine): wire preset fields through pattern and filler functions"
```

---

### Task 3: Create Supabase table and seed data

**Files:**
- Create: `supabase/migrations/20260222_create_generation_presets.sql`

**Step 1: Write the migration SQL**

```sql
-- Create generation_presets table
CREATE TABLE IF NOT EXISTS generation_presets (
  grid_size    integer PRIMARY KEY,
  min_density  real NOT NULL DEFAULT 0.18,
  max_density  real NOT NULL DEFAULT 0.28,
  min_span     integer NOT NULL DEFAULT 3,
  max_candidates integer NOT NULL DEFAULT 50,
  pattern_attempts integer NOT NULL DEFAULT 20,
  max_attempts integer NOT NULL DEFAULT 50,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Seed default rows
INSERT INTO generation_presets (grid_size, min_density, max_density, min_span, max_candidates, pattern_attempts, max_attempts)
VALUES
  (7,  0.18, 0.28, 3, 50, 20, 50),
  (13, 0.18, 0.28, 3, 50, 20, 50)
ON CONFLICT (grid_size) DO NOTHING;

-- RLS: public read, admin-only write
ALTER TABLE generation_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read presets"
  ON generation_presets FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies for anon — only service role can write.
-- The admin API route uses the service role key.
```

**Step 2: Run the migration against Supabase**

Run the SQL in the Supabase dashboard SQL editor, or via CLI:
```bash
# If using Supabase CLI:
supabase db push
```

**Step 3: Verify the table exists and has seed data**

Check in Supabase dashboard: Table Editor → generation_presets → should show 2 rows.

**Step 4: Commit**

```bash
git add supabase/migrations/20260222_create_generation_presets.sql
git commit -m "feat(db): add generation_presets table with seed data"
```

---

### Task 4: Create GET /api/presets route

**Files:**
- Create: `src/app/api/presets/route.ts`

**Step 1: Write the route**

```typescript
import { getSupabaseServer } from '@/lib/db';

export interface PresetRow {
  grid_size: number;
  min_density: number;
  max_density: number;
  min_span: number;
  max_candidates: number;
  pattern_attempts: number;
  max_attempts: number;
}

export async function GET() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('generation_presets')
    .select('grid_size, min_density, max_density, min_span, max_candidates, pattern_attempts, max_attempts');

  if (error) {
    return Response.json({ error: 'Failed to load presets' }, { status: 500 });
  }

  return Response.json(data as PresetRow[]);
}
```

**Step 2: Verify manually**

Run: `pnpm dev` then `curl http://localhost:3000/api/presets`
Expected: JSON array with 2 rows (size 7 and 13)

**Step 3: Commit**

```bash
git add src/app/api/presets/route.ts
git commit -m "feat(api): add GET /api/presets route"
```

---

### Task 5: Create POST /api/admin/presets route

**Files:**
- Create: `src/app/api/admin/presets/route.ts`

**Step 1: Write the admin-gated route**

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/db';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email || email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { grid_size, min_density, max_density, min_span, max_candidates, pattern_attempts, max_attempts } = body;

    if (typeof grid_size !== 'number' || grid_size < 3) {
      return Response.json({ error: 'Invalid grid_size' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('generation_presets')
      .upsert(
        {
          grid_size,
          min_density,
          max_density,
          min_span,
          max_candidates,
          pattern_attempts,
          max_attempts,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'grid_size' }
      )
      .select()
      .single();

    if (error) {
      return Response.json({ error: 'Failed to save preset' }, { status: 500 });
    }

    return Response.json(data);
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

**Step 2: Add ADMIN_EMAIL to .env.local**

Add to `.env.local`:
```
ADMIN_EMAIL=your-google-email@gmail.com
```

**Step 3: Run typecheck**

Run: `pnpm typecheck 2>&1 | grep -v tests/`
Expected: No new errors

**Step 4: Commit**

```bash
git add src/app/api/admin/presets/route.ts
git commit -m "feat(api): add admin-gated POST /api/admin/presets route"
```

---

### Task 6: Update worker to fetch and apply presets

**Files:**
- Modify: `src/engine/worker.ts:1-38`

**Step 1: Update the worker to fetch presets on init and merge on generate**

Replace the entire file with:

```typescript
/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;
export {}; // make this file a module

import { loadWordList } from './wordlist';
import { generatePuzzle } from './generator';
import type { WordList } from './wordlist';
import type { GenerateOptions } from './types';

interface PresetRow {
  grid_size: number;
  min_density: number;
  max_density: number;
  min_span: number;
  max_candidates: number;
  pattern_attempts: number;
  max_attempts: number;
}

let wordList: WordList | null = null;
let presets: Map<number, PresetRow> = new Map();

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'init') {
    try {
      const [wordlistRes, presetsRes] = await Promise.all([
        fetch('/wordlist.json'),
        fetch('/api/presets'),
      ]);
      const data = await wordlistRes.json();
      wordList = loadWordList(data);

      if (presetsRes.ok) {
        const rows: PresetRow[] = await presetsRes.json();
        presets = new Map(rows.map(r => [r.grid_size, r]));
      }

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
      const size = options?.size ?? 13;
      const preset = presets.get(size);

      const mergedOptions: GenerateOptions = {
        ...options,
        ...(preset && {
          minDensity: options?.minDensity ?? preset.min_density,
          maxDensity: options?.maxDensity ?? preset.max_density,
          minSpan: options?.minSpan ?? preset.min_span,
          maxCandidates: options?.maxCandidates ?? preset.max_candidates,
          patternAttempts: options?.patternAttempts ?? preset.pattern_attempts,
          maxAttempts: options?.maxAttempts ?? preset.max_attempts,
        }),
      };

      const puzzle = generatePuzzle(wordList, mergedOptions);
      self.postMessage({ type: 'success', puzzle });
    } catch (err) {
      self.postMessage({ type: 'error', message: (err as Error).message });
    }
    return;
  }
};
```

**Step 2: Run typecheck**

Run: `pnpm typecheck 2>&1 | grep -v tests/`
Expected: No new errors

**Step 3: Run engine tests**

Run: `pnpm test:engine`
Expected: All 99 tests pass

**Step 4: Commit**

```bash
git add src/engine/worker.ts
git commit -m "feat(worker): fetch presets on init and merge into generate options"
```

---

### Task 7: Build the admin settings page

**Files:**
- Create: `src/app/admin/settings/page.tsx`
- Create: `src/app/admin/settings/admin-settings-client.tsx`

**Step 1: Create the server component with auth gating**

`src/app/admin/settings/page.tsx`:

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdminSettingsClient } from './admin-settings-client';

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email || email !== process.env.ADMIN_EMAIL) {
    redirect('/');
  }

  return (
    <div>
      <h1>Generation Presets</h1>
      <p className="text-muted text-body" style={{ marginTop: 8 }}>
        Per-grid-size parameters for the puzzle generator.
      </p>
      <AdminSettingsClient />
    </div>
  );
}
```

**Step 2: Create the client component**

`src/app/admin/settings/admin-settings-client.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';

interface Preset {
  grid_size: number;
  min_density: number;
  max_density: number;
  min_span: number;
  max_candidates: number;
  pattern_attempts: number;
  max_attempts: number;
}

const FIELDS: { key: keyof Omit<Preset, 'grid_size'>; label: string; step: string; min: number }[] = [
  { key: 'min_density', label: 'Min Density', step: '0.01', min: 0 },
  { key: 'max_density', label: 'Max Density', step: '0.01', min: 0 },
  { key: 'min_span', label: 'Min Span', step: '1', min: 2 },
  { key: 'max_candidates', label: 'Max Candidates', step: '1', min: 1 },
  { key: 'pattern_attempts', label: 'Pattern Attempts', step: '1', min: 1 },
  { key: 'max_attempts', label: 'Max Attempts', step: '1', min: 1 },
];

export function AdminSettingsClient() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/presets')
      .then(res => res.json())
      .then((data: Preset[]) => {
        setPresets(data.sort((a, b) => a.grid_size - b.grid_size));
        setLoading(false);
      })
      .catch(() => {
        setMessage({ type: 'error', text: 'Failed to load presets' });
        setLoading(false);
      });
  }, []);

  const handleChange = (gridSize: number, key: keyof Preset, value: string) => {
    setPresets(prev =>
      prev.map(p =>
        p.grid_size === gridSize ? { ...p, [key]: parseFloat(value) || 0 } : p
      )
    );
  };

  const handleSave = async (preset: Preset) => {
    setSaving(preset.grid_size);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preset),
      });
      if (!res.ok) throw new Error('Save failed');
      setMessage({ type: 'success', text: `Saved ${preset.grid_size}×${preset.grid_size} preset` });
    } catch {
      setMessage({ type: 'error', text: `Failed to save ${preset.grid_size}×${preset.grid_size} preset` });
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="status info">Loading presets...</div>;

  return (
    <div style={{ marginTop: 24 }}>
      {message && (
        <div className={`status ${message.type}`}>{message.text}</div>
      )}

      {presets.map(preset => (
        <div key={preset.grid_size} className="card" style={{ marginTop: 16 }}>
          <h2>{preset.grid_size}×{preset.grid_size}</h2>
          <div style={{ marginTop: 16 }}>
            {FIELDS.map(({ key, label, step, min }) => (
              <div key={key} className="settings-row">
                <div>
                  <div className="setting-label">{label}</div>
                </div>
                <div className="setting-input">
                  <input
                    type="number"
                    step={step}
                    min={min}
                    value={preset[key]}
                    onChange={e => handleChange(preset.grid_size, key, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #ccc',
                      borderRadius: 4,
                      fontSize: '0.9rem',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <button
              className="btn btn-primary"
              onClick={() => handleSave(preset)}
              disabled={saving === preset.grid_size}
            >
              {saving === preset.grid_size ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Run typecheck and lint**

Run: `pnpm typecheck 2>&1 | grep -v tests/ && pnpm lint`
Expected: No new errors

**Step 4: Commit**

```bash
git add src/app/admin/settings/page.tsx src/app/admin/settings/admin-settings-client.tsx
git commit -m "feat(ui): add admin settings page for generation presets"
```

---

### Task 8: End-to-end manual verification

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Verify public presets API**

Run: `curl http://localhost:3000/api/presets`
Expected: JSON array with size 7 and 13 rows

**Step 3: Verify admin page access**

Navigate to `http://localhost:3000/admin/settings` while signed in with admin email.
Expected: See two cards (7×7 and 13×13) with editable fields.

Navigate while signed out or with non-admin email.
Expected: Redirected to `/`.

**Step 4: Test preset changes**

On the admin page, change 7×7 `min_density` to `0.10` and `max_density` to `0.20`. Save.
Go to `/`, select 7×7, generate a puzzle.
Expected: Grid should have noticeably fewer black cells than before.

Revert to `0.18` / `0.28` and save again.

**Step 5: Verify 13×13 is unchanged**

Generate a 13×13 puzzle.
Expected: Works exactly as before (preset values match original hardcoded values).

**Step 6: Run full test suite**

Run: `pnpm lint && pnpm typecheck 2>&1 | grep -v tests/ && pnpm test:engine`
Expected: Lint clean, no new type errors, all 99 engine tests pass.

**Step 7: Final commit**

```bash
git add -A
git commit -m "chore: verify admin presets end-to-end"
```

(Only if there are any remaining unstaged changes from verification.)
