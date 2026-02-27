# Creator View Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the creator page layout to match the new Figma design — restructured header, inline toolbar, grid+clues in a side-by-side card, and custom words section moved to bottom.

**Architecture:** Pure UI/layout changes. No engine or API changes. All work is in `src/app/page.tsx`, `src/components/clues/clue-list.tsx`, `src/components/ui/header.tsx`, and `src/styles/crossword-styles.css`. The existing CSS class system is used (no Tailwind).

**Tech Stack:** Next.js 14 App Router, React, custom CSS (`crossword-styles.css`)

---

## Summary of Changes (Figma vs Current)

| Area | Current | Figma Target |
|------|---------|-------------|
| Header title | "Crossword" | "Crossword Generator" |
| Header subtitle | None | "Create Custom Crosswords" |
| Auth button | "Sign in" (primary) | "Login" (outlined/secondary) |
| Toolbar alignment | Left-aligned | Right-aligned (`justify-end`) |
| Size label | "Size" text label | No label |
| Generate button text | "Generate Crossword" | "Generate Puzzle" |
| Share button style | Blue (`btn-export`) | Outlined (`btn-secondary`) |
| Status messages | Separate block below toolbar | Inline in toolbar row, fills remaining space |
| Grid + Clues layout | Grid above, clues below in 2 columns | Side-by-side in a bordered card |
| Grid section | No heading | "PREVIEW" heading + "Click a letter to edit" hint |
| Clues section | Two columns (Across \| Down) | Single column, Across then Down stacked |
| Creator clue rows | Click-to-edit with pencil icon | Row: number \| word (mono) \| input field (always visible) |
| Custom words position | Above grid | Below crossword card, in own card |
| Custom words count | 4 inputs | 3 inputs |
| Custom words heading | `<h3>Custom Words (optional)</h3>` | "CUSTOM WORDS" (section heading) + "Optional" hint |
| Grid border-radius | None | 8px rounded corners |

---

### Task 1: Update Header Component

**Files:**
- Modify: `src/components/ui/header.tsx`
- Modify: `src/styles/crossword-styles.css`

**Step 1: Update header.tsx**

Change title from "Crossword" to "Crossword Generator", add subtitle, change "Sign in" to "Login" with `btn-secondary` style. Add a wrapper `div` for the left side containing both title and subtitle.

```tsx
// src/components/ui/header.tsx
'use client';

import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

export function Header() {
  const { data: session, status } = useSession();
  const isLoggedIn = !!session?.user;
  const isAdmin = isLoggedIn && ADMIN_EMAIL && session.user?.email === ADMIN_EMAIL;

  return (
    <header className="flex-between" style={{ padding: '16px 0', borderBottom: '1px solid #e2e2e2', marginBottom: '24px' }}>
      <div>
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <h1>Crossword Generator</h1>
        </Link>
        <p className="text-body text-muted" style={{ marginTop: 4 }}>Create Custom Crosswords</p>
      </div>
      <div className="header-actions">
        {status === 'loading' ? null : isLoggedIn ? (
          <>
            <span className="text-small text-muted">{session.user?.email}</span>
            {isAdmin && (
              <Link href="/admin/settings" className="btn btn-secondary btn-sm">Settings</Link>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => signOut()}>Log out</button>
          </>
        ) : (
          <button className="btn btn-secondary" onClick={() => signIn('google')}>Login</button>
        )}
      </div>
    </header>
  );
}
```

**Step 2: Verify visually**

Run: `pnpm dev`
Expected: Header shows "Crossword Generator" with "Create Custom Crosswords" subtitle. Auth button says "Login" with outlined style.

**Step 3: Commit**

```bash
git add src/components/ui/header.tsx
git commit -m "feat(ui): update header to match new design — title, subtitle, login button"
```

---

### Task 2: Restructure Toolbar Row

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/styles/crossword-styles.css`

**Step 1: Add CSS for the new toolbar layout**

Add a `.toolbar` class that right-aligns items and an inline status variant.

In `src/styles/crossword-styles.css`, add after the existing `.btn-row` styles (around line 131):

```css
/* Toolbar — right-aligned action bar */
.toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
}

/* Inline status (used inside toolbar) */
.status-inline {
  flex: 1;
  min-width: 0;
  padding: 9px 17px;
  border-radius: 4px;
  font-size: 0.85rem;
  background: #f7f7f7;
  border: 1px solid #e2e2e2;
}
.status-inline.success { color: #1a7a2e; }
.status-inline.error { color: #cc0000; }
.status-inline.info { color: #326891; }
```

**Step 2: Update the toolbar section in page.tsx**

Replace the current `.btn-row` with `.toolbar`. Remove the "Size" label. Change button text from "Generate Crossword" to "Generate Puzzle". Change Share from `btn-export` to `btn-secondary`. Move status messages inline.

Replace lines 156-197 in `src/app/page.tsx` (the `btn-row` div) with:

```tsx
<div className="toolbar">
  <div className="btn-group">
    <button
      className={`btn ${gridSize === 5 ? 'btn-primary' : 'btn-secondary'}`}
      onClick={() => handleSizeChange(5)}
      disabled={generating}
    >
      5×5
    </button>
    <button
      className={`btn ${gridSize === 7 ? 'btn-primary' : 'btn-secondary'}`}
      onClick={() => handleSizeChange(7)}
      disabled={generating}
    >
      7×7
    </button>
    <button
      className={`btn ${gridSize === 13 ? 'btn-primary' : 'btn-secondary'}`}
      onClick={() => handleSizeChange(13)}
      disabled={generating}
    >
      13×13
    </button>
  </div>

  <button
    className="btn btn-primary"
    onClick={handleGenerate}
    disabled={!ready || generating}
  >
    {generating ? 'Generating...' : 'Generate Puzzle'}
  </button>

  <button
    className="btn btn-secondary"
    onClick={handleShare}
    disabled={!puzzle || sharing}
  >
    {sharing ? 'Sharing...' : 'Share'}
  </button>

  {statusMessage && (
    <div className={`status-inline ${statusType}`}>{statusMessage}</div>
  )}
</div>
```

This requires computing `statusMessage` and `statusType` from the existing state. Add this derived state near the top of the component (after the `useState` calls):

```tsx
// Derive inline status message
let statusMessage: string | null = null;
let statusType: 'success' | 'error' | 'info' = 'info';
if (error) {
  statusMessage = error;
  statusType = 'error';
} else if (shareUrl) {
  statusMessage = shareUrl;
  statusType = 'success';
} else if (puzzle && !generating) {
  statusMessage = 'Crossword generated! Edit words/clues below, or generate AI clues.';
  statusType = 'success';
} else if (!ready) {
  statusMessage = 'Loading word list...';
  statusType = 'info';
}
```

Also remove the separate status blocks for `!ready`, `workerError`, `error`, and `shareUrl` that currently appear as standalone blocks (lines 149-244). The share URL copy-link UI can be integrated into the inline status:

```tsx
{statusMessage && (
  <div className={`status-inline ${statusType}`}>
    {shareUrl ? (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shareUrl}</span>
        <button className="btn btn-secondary btn-sm" onClick={handleCopyLink} style={{ flexShrink: 0 }}>Copy</button>
      </span>
    ) : statusMessage}
  </div>
)}
```

**Step 3: Verify visually**

Run: `pnpm dev`
Expected: Toolbar is right-aligned. Size buttons have no label. Generate says "Generate Puzzle". Share is outlined. Status appears inline to the right.

**Step 4: Commit**

```bash
git add src/app/page.tsx src/styles/crossword-styles.css
git commit -m "feat(ui): restructure toolbar — right-aligned with inline status"
```

---

### Task 3: Update Grid Container to Have Rounded Corners

**Files:**
- Modify: `src/styles/crossword-styles.css`

**Step 1: Add border-radius to grid container**

Update the `.grid-container` rule (line 264) to add `border-radius: 8px` and `overflow: hidden` (so child cells clip to the rounded corners):

```css
.grid-container { display: inline-block; border: 2px solid #121212; border-radius: 8px; overflow: hidden; }
```

**Step 2: Verify visually**

Run: `pnpm dev`
Expected: Grid has rounded corners. Letters in corner cells are clipped properly.

**Step 3: Commit**

```bash
git add src/styles/crossword-styles.css
git commit -m "feat(ui): add rounded corners to crossword grid"
```

---

### Task 4: Create Side-by-Side Crossword Card Layout

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/styles/crossword-styles.css`

**Step 1: Add CSS for the crossword card layout**

Add after the `.card` styles in CSS:

```css
/* Crossword card — grid + clues side by side */
.crossword-card {
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  padding: 25px 29px;
  display: flex;
  gap: 40px;
  align-items: flex-start;
}
.crossword-card-grid {
  flex-shrink: 0;
}
.crossword-card-clues {
  flex: 1;
  min-width: 0;
}
```

Add responsive override in the `@media (max-width: 640px)` block:

```css
.crossword-card { flex-direction: column; gap: 24px; padding: 16px; }
```

**Step 2: Update the puzzle rendering in page.tsx**

Replace the current puzzle rendering block (lines 246-253) with:

```tsx
{puzzle && (
  <div className="crossword-card">
    <div className="crossword-card-grid">
      <h3 style={{ marginBottom: 24 }}>
        Preview <span className="text-hint" style={{ textTransform: 'none', letterSpacing: 'normal' }}>Click a letter to edit</span>
      </h3>
      <CrosswordGrid grid={puzzle.grid} entries={puzzle.entries} gridSize={puzzle.size} />
    </div>
    <div className="crossword-card-clues">
      <h3 style={{ marginBottom: 24 }}>Clues</h3>
      <ClueList entries={puzzle.entries} editable onClueEdit={handleClueEdit} />
    </div>
  </div>
)}
```

**Step 3: Verify visually**

Run: `pnpm dev`
Expected: Grid and clues appear side-by-side inside a bordered card. "PREVIEW" and "CLUES" section headings visible. On mobile, they stack vertically.

**Step 4: Commit**

```bash
git add src/app/page.tsx src/styles/crossword-styles.css
git commit -m "feat(ui): crossword card with grid and clues side by side"
```

---

### Task 5: Update Clue List Creator Layout

**Files:**
- Modify: `src/components/clues/clue-list.tsx`
- Modify: `src/styles/crossword-styles.css`

The Figma shows clues in a single stacked column with each row being: `number. | WORD | [input field]`. Across and Down sections are stacked vertically with a gap. The answer word is always visible in monospace. The clue input is always visible (not click-to-edit).

**Step 1: Update ClueList to support the new creator layout**

The `ClueList` component needs a new `ClueEntry` interface that includes `answer` (the word), and the editable layout needs to change. The `Entry` type in `src/engine/types.ts` already has an `answer` field.

First, check types.ts to confirm `answer` field exists:

Read: `src/engine/types.ts` — confirm `Entry` has `answer: string`.

Update the `ClueEntry` interface in `clue-list.tsx` to include `answer`:

```tsx
interface ClueEntry {
  number: number;
  direction: Direction;
  clue: string;
  answer?: string;  // word answer, shown in creator view
}
```

Replace the `EditableClueItem` component with a simpler always-visible-input row:

```tsx
function CreatorClueRow({
  entry,
  onClueEdit,
}: {
  entry: ClueEntry;
  onClueEdit?: (number: number, direction: Direction, newClue: string) => void;
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
        className="clue-row-input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); }}
        onBlur={commit}
      />
    </div>
  );
}
```

Update the `ClueList` render for `editable` mode to use single-column stacked layout:

```tsx
export function ClueList({ entries, activeNumber, activeDirection, onClueClick, editable, onClueEdit }: ClueListProps) {
  const across = entries.filter(e => e.direction === 'across');
  const down = entries.filter(e => e.direction === 'down');

  if (editable) {
    return (
      <div className="clue-creator">
        <div className="clue-section">
          <h4>Across</h4>
          {across.map(entry => (
            <CreatorClueRow key={`${entry.number}a`} entry={entry} onClueEdit={onClueEdit} />
          ))}
        </div>
        <div className="clue-section">
          <h4>Down</h4>
          {down.map(entry => (
            <CreatorClueRow key={`${entry.number}d`} entry={entry} onClueEdit={onClueEdit} />
          ))}
        </div>
      </div>
    );
  }

  // Player (read-only) layout stays the same — two columns
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

**Step 2: Add CSS for the creator clue layout**

Add to `crossword-styles.css`:

```css
/* Creator clue layout — single stacked column */
.clue-creator {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.clue-section { min-width: 280px; }
```

The existing `.clue-row`, `.clue-num`, `.clue-word`, and `.clue-row input` styles should work. Verify `.clue-row input` matches the Figma input styling (1px solid #ddd border, 4px radius, padding 7px 11px).

**Step 3: Verify visually**

Run: `pnpm dev`
Expected: Clues show as stacked Across then Down, each row with number, word, and input field.

**Step 4: Commit**

```bash
git add src/components/clues/clue-list.tsx src/styles/crossword-styles.css
git commit -m "feat(ui): update creator clue list to row-based layout with visible inputs"
```

---

### Task 6: Move Custom Words to Bottom Card

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/styles/crossword-styles.css`

**Step 1: Reduce custom words from 4 to 3**

In `page.tsx`, change the initial state:

```tsx
const [customWords, setCustomWords] = useState<string[]>(['', '', '']);
const [wordErrors, setWordErrors] = useState<(string | null)[]>([null, null, null]);
```

**Step 2: Move custom words section below the crossword card**

Restructure the JSX so the custom words section appears after the crossword card, wrapped in a `.card` div with the new heading style. Remove the old `custom-words-section` placement (currently lines 199-231).

Place after the crossword card `{puzzle && ...}` block:

```tsx
<div className="card" style={{ marginTop: 40 }}>
  <h3 style={{ marginBottom: 24 }}>
    Custom Words <span className="text-hint" style={{ textTransform: 'none', letterSpacing: 'normal' }}>Optional</span>
  </h3>
  <div className="custom-words-row">
    {customWords.map((word, i) => (
      <div key={i} className="custom-word-input-wrapper">
        <div style={{ position: 'relative' }}>
          <input
            className={`custom-word-input${wordErrors[i] ? ' input-error' : ''}`}
            type="text"
            placeholder={`Word ${i + 1}`}
            value={word}
            onChange={e => handleWordChange(i, e.target.value)}
            onBlur={e => handleWordBlur(i, e.target.value)}
            maxLength={gridSize}
            disabled={generating}
          />
          {word && (
            <button
              className="custom-word-clear"
              onClick={() => clearWord(i)}
              tabIndex={-1}
            >
              &times;
            </button>
          )}
        </div>
        {wordErrors[i] && (
          <div className="custom-word-error">{wordErrors[i]}</div>
        )}
      </div>
    ))}
  </div>
</div>
```

**Step 3: Verify visually**

Run: `pnpm dev`
Expected: Custom words section appears below the crossword card in its own bordered card, with 3 inputs and "CUSTOM WORDS Optional" heading.

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): move custom words to bottom card with 3 inputs"
```

---

### Task 7: Add Spacing Between Major Sections

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Wrap sections in a flex column with consistent gap**

The Figma shows 40px gap between major sections (toolbar, crossword card, custom words card). Wrap the main content in a flex column container:

```tsx
return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
    {/* Toolbar */}
    <div className="toolbar">
      {/* ... toolbar contents ... */}
    </div>

    {/* Crossword Card */}
    {puzzle && (
      <div className="crossword-card">
        {/* ... grid + clues ... */}
      </div>
    )}

    {/* Custom Words Card */}
    <div className="card">
      {/* ... custom words ... */}
    </div>
  </div>
);
```

Remove any `marginTop`/`marginBottom` inline styles that were added in previous tasks, as the gap handles spacing.

**Step 2: Verify visually**

Run: `pnpm dev`
Expected: Consistent 40px spacing between toolbar, crossword card, and custom words card. Matches Figma vertical rhythm.

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): consistent 40px gap between major sections"
```

---

### Task 8: Final Typecheck and Lint

**Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors.

**Step 2: Run lint**

Run: `pnpm lint`
Expected: No errors.

**Step 3: Fix any issues found, then commit**

```bash
git add -A
git commit -m "fix: resolve typecheck and lint issues from redesign"
```
