# Skeleton Grid Loading State — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show a full-fidelity loading skeleton while a puzzle is generating — matching the completed puzzle card layout (card border, Preview heading, animated grid, Clues heading with Across/Down sections and placeholder input rows).

**Architecture:** A new `SkeletonGrid` component renders an animated empty grid matching the current `gridSize`. Each cell has a CSS animation that fades it from white to black and back, with randomized delays so different cells go dark at different times. In `page.tsx`, the skeleton is wrapped in the same `.card .crossword-card` layout as the real puzzle — with the grid on the left and placeholder clue sections (Across/Down headings + 3 empty disabled inputs each) on the right.

**Tech Stack:** React component + CSS keyframes animation. No new dependencies.

---

### Task 1: Add skeleton grid CSS animation

**Files:**
- Modify: `src/styles/crossword-styles.css` (after the grid section, ~line 260)

**Step 1: Add the CSS**

Insert after line 260 (`/* Grid size variants removed... */`):

```css
/* Skeleton grid — loading placeholder */
.skeleton-cell {
  animation: skeleton-fade 3s ease-in-out infinite;
}

@keyframes skeleton-fade {
  0%, 100% { background: #fff; }
  35%, 45% { background: #121212; }
}
```

This animation keeps cells white for most of the cycle (0–35% and 45–100%) with a brief black phase (35–45%). Combined with staggered delays, only ~10–15% of cells appear black at any given moment.

**Step 2: Verify no lint errors**

Run: `pnpm lint`
Expected: no errors

**Step 3: Commit**

```bash
git add src/styles/crossword-styles.css
git commit -m "style: add skeleton grid fade animation"
```

---

### Task 2: Create SkeletonGrid component

**Files:**
- Create: `src/components/grid/skeleton-grid.tsx`

**Step 1: Create the component**

```tsx
'use client';

import { useMemo } from 'react';

interface SkeletonGridProps {
  gridSize: number;
}

export function SkeletonGrid({ gridSize }: SkeletonGridProps) {
  // Generate stable random delays per gridSize so they don't reshuffle every render
  const delays = useMemo(() => {
    const cells: number[] = [];
    for (let i = 0; i < gridSize * gridSize; i++) {
      cells.push(Math.random() * 3); // 0–3s delay across the 3s animation
    }
    return cells;
  }, [gridSize]);

  return (
    <div className={`grid-container grid-size-${gridSize}`}>
      {Array.from({ length: gridSize }, (_, r) => (
        <div className="grid-row" key={r}>
          {Array.from({ length: gridSize }, (_, c) => (
            <div
              key={`${r},${c}`}
              className="grid-cell skeleton-cell"
              style={{ animationDelay: `${delays[r * gridSize + c].toFixed(2)}s` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

**Key design decisions:**
- `useMemo` with `gridSize` dependency → delays are recalculated only when size changes, not on every re-render
- Random delays between 0–3s spread across the 3s animation cycle so cells go dark at different times
- Uses the same `.grid-container`, `.grid-row`, `.grid-cell` classes as the real grid for identical sizing
- No letters, no numbers — just empty cells with the fade animation

**Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: no errors

**Step 3: Commit**

```bash
git add src/components/grid/skeleton-grid.tsx
git commit -m "feat: add SkeletonGrid loading placeholder component"
```

---

### Task 3: Wire SkeletonGrid into the creator page with full card layout

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add import**

At the top of `page.tsx`, after the `CrosswordGrid` import (line 6):

```tsx
import { SkeletonGrid } from '@/components/grid/skeleton-grid';
```

**Step 2: Replace the conditional grid render**

Currently (lines 297–310):
```tsx
{puzzle && (
  <div className="card crossword-card">
    <div className="crossword-card-grid">
      <h3>
        Preview <span className="text-hint">Click a letter to edit</span>
      </h3>
      <CrosswordGrid grid={puzzle.grid} entries={puzzle.entries} gridSize={puzzle.size} />
    </div>
    <div className="crossword-card-clues">
      <h3>Clues</h3>
      <ClueList entries={puzzle.entries} editable onClueEdit={handleClueEdit} onClueRefresh={handleClueRefresh} onAiClue={handleAiClue} aiGeneratingKey={aiGeneratingKey} />
    </div>
  </div>
)}
```

Replace with:

```tsx
{generating && (
  <div className="card crossword-card">
    <div className="crossword-card-grid">
      <h3>Preview</h3>
      <SkeletonGrid gridSize={gridSize} />
    </div>
    <div className="crossword-card-clues">
      <h3>Clues</h3>
      <div className="clue-creator">
        <div className="clue-section">
          <h4>Across</h4>
          {[1, 2, 3].map(n => (
            <div className="clue-row" key={n}>
              <input className="input" disabled />
            </div>
          ))}
        </div>
        <div className="clue-section">
          <h4>Down</h4>
          {[1, 2, 3].map(n => (
            <div className="clue-row" key={n}>
              <input className="input" disabled />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)}

{puzzle && !generating && (
  <div className="card crossword-card">
    <div className="crossword-card-grid">
      <h3>
        Preview <span className="text-hint">Click a letter to edit</span>
      </h3>
      <CrosswordGrid grid={puzzle.grid} entries={puzzle.entries} gridSize={puzzle.size} />
    </div>
    <div className="crossword-card-clues">
      <h3>Clues</h3>
      <ClueList entries={puzzle.entries} editable onClueEdit={handleClueEdit} onClueRefresh={handleClueRefresh} onAiClue={handleAiClue} aiGeneratingKey={aiGeneratingKey} />
    </div>
  </div>
)}
```

**Why this layout mirrors the completed state:**
- Same `.card .crossword-card` wrapper → identical card border and flex layout
- Same `.crossword-card-grid` → "Preview" heading + grid (skeleton instead of real)
- Same `.crossword-card-clues` → "Clues" heading + `.clue-creator` with `.clue-section` for each direction
- 3 disabled `<input className="input">` per direction as empty placeholders
- No clue numbers, word labels, or action buttons — just clean empty fields

**Why `generating` alone (not `generating && !puzzle`):** When the user clicks "Generate Puzzle" again on the same size, `handleGenerate` doesn't clear `puzzle` to null. Using just `generating` ensures the skeleton always replaces the real grid during generation. The `!generating` guard on the real grid prevents both from showing simultaneously.

**Step 3: Verify build**

Run: `pnpm lint && pnpm typecheck`
Expected: no errors

**Step 4: Manual test**

Run: `pnpm dev`

1. Page loads → skeleton card appears (5×5 grid + Across/Down placeholder inputs) → real puzzle replaces it
2. Click 7×7 → skeleton card appears (7×7 grid) with same clue placeholder layout → real puzzle replaces it
3. Click 9×9 → skeleton card appears (9×9 grid) → real puzzle replaces it
4. Click "Generate Puzzle" while already on a size → skeleton card replaces the real card → new puzzle appears
5. Black squares fade in and out at different positions across the skeleton grid
6. Card border, "Preview" heading, "Clues" heading, "Across"/"Down" headings all match the completed state
7. Placeholder inputs are visible and disabled (no interaction)
8. On mobile (≤640px), layout stacks vertically like the real card (`.crossword-card` flex-direction: column)

**Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: show skeleton loading card during puzzle generation"
```

---

### Task 4: Update docs/log.md

**Files:**
- Modify: `docs/log.md`

**Step 1: Append to log**

```markdown
## 2026-03-02 — Skeleton Grid Loading State

- Added animated skeleton grid placeholder shown while puzzles generate
- Empty cells with black squares that randomly fade in/out at staggered intervals
- Skeleton card mirrors full completed layout: card border, Preview heading, grid, Clues heading with Across/Down sections and 3 placeholder input rows each
- Skeleton matches the selected grid size (5×5, 7×7, 9×9) using same cell dimensions
- Replaces blank page gap between clicking a size and puzzle appearing
```

**Step 2: Commit**

```bash
git add docs/log.md
git commit -m "docs: log skeleton grid loading state"
```
