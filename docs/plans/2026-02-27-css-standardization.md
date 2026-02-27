# CSS Component Standardization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate the CSS design system into reusable, consistent primitives — exactly 2 button styles (filled + outline), 1 input style, 1 status style — and remove all dead CSS.

**Architecture:** CSS-only refactor plus updating class references in .tsx files. No logic changes.

**Tech Stack:** Custom CSS (`crossword-styles.css`), React/Next.js TSX components

---

## Audit Summary

### Buttons — 3 variants exist, should be 2
| Class | Style | Status |
|-------|-------|--------|
| `.btn-primary` | Filled black | **Keep** (= "filled") |
| `.btn-secondary` | Outlined black border | **Keep** (= "outline") |
| `.btn-export` | Filled blue | **Delete** — unused after redesign |

Issues:
- `.btn-secondary` has no `:disabled` state (missing)
- `my-puzzles/page.tsx:50` uses inline style overrides (`padding: '6px 12px', fontSize: '0.8rem'`) instead of `.btn-sm`

### Inputs — 5+ inconsistent styles, should be 1
| Location | Padding | Border | Font-size | Notes |
|----------|---------|--------|-----------|-------|
| `.form-row input` | 8px 12px | 1px #ccc | 0.9rem | **Unused** |
| `.custom-word-input` | 8px 28px 8px 10px | 1px #ccc | 0.85rem | Has uppercase, font-weight 600, extra right padding for clear btn |
| `.clue-row input` | 6px 10px | 1px #ddd | 0.85rem | Border uses #ddd not #ccc |
| `.clue-edit-input` | 2px 6px | 1px #ccc | 0.85rem | **Unused** |
| `input[type="password"]` | 8px 10px | 1px #ccc | 0.85rem | Global selector |
| Admin settings (inline) | 8px 12px | 1px #ccc | 0.9rem | Inline styles, no class |

**Standard input should be:** `padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.85rem;`

### Status messages — 2 parallel systems, should be 1
| Class | Used in | Behavior |
|-------|---------|----------|
| `.status` + `.info/.success/.error` | admin-settings-client | `display: none` by default, shown via modifier |
| `.status-inline` + `.success/.error/.info` | page.tsx toolbar | Always visible, flex child |

Both share identical colors. Unify into one `.status` class (always visible, no `display: none` trick).

### Dead CSS (classes defined but not used in any .tsx)
`.btn-export`, `.btn-row`, `.form-row` (+ children), `.panel`, `.btn-group-label`, `.custom-words-section`, `.clue-item-editable`, `.clue-edit-icon`, `.clue-edit-input`, `.grid-cell.sm`

### Cards — near-duplicate
`.crossword-card` repeats `.card` styling (1px difference in padding). Should extend `.card`.

---

### Task 1: Standardize Buttons

**Files:**
- Modify: `src/styles/crossword-styles.css`
- Modify: `src/app/my-puzzles/page.tsx` (line 50 — remove inline style overrides, use `btn-sm`)

**Step 1: Delete `.btn-export` from CSS**

Remove lines 125-127:
```css
.btn-export { background: #326891; color: #fff; }
.btn-export:hover { background: #255473; }
.btn-export:disabled { background: #ccc; color: #888; cursor: not-allowed; }
```

**Step 2: Add `.btn-secondary:disabled` state**

After `.btn-secondary:hover`, add:
```css
.btn-secondary:disabled { background: #fff; color: #888; border-color: #ccc; cursor: not-allowed; }
```

**Step 3: Fix my-puzzles inline style overrides**

In `src/app/my-puzzles/page.tsx` line 47-53, change:
```tsx
<Link
  href={`/play/${puzzle.share_slug}`}
  className="btn btn-secondary"
  style={{ textDecoration: 'none', padding: '6px 12px', fontSize: '0.8rem' }}
>
```
To:
```tsx
<Link
  href={`/play/${puzzle.share_slug}`}
  className="btn btn-secondary btn-sm"
  style={{ textDecoration: 'none' }}
>
```

**Step 4: Commit**
```bash
git add src/styles/crossword-styles.css src/app/my-puzzles/page.tsx
git commit -m "refactor(css): standardize buttons to filled + outline only"
```

---

### Task 2: Standardize Inputs

**Files:**
- Modify: `src/styles/crossword-styles.css`
- Modify: `src/app/admin/settings/admin-settings-client.tsx` (replace inline input styles with class)
- Modify: `src/app/page.tsx` (custom word input uses `.input` base)

**Step 1: Create a single `.input` base class**

Replace the Form Controls section in CSS with:

```css
/* ============================================================
   Form Controls
   ============================================================ */
.input {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.85rem;
  font-family: inherit;
  background: #fff;
  width: 100%;
}
.input:focus { outline: 2px solid #326891; border-color: #326891; }
.input.input-error { border-color: #cc0000; }

input[type="password"] {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.85rem;
  font-family: monospace;
}
```

Delete the old `.form-row` block entirely (unused).

**Step 2: Apply `.input` to clue row inputs**

Change `.clue-row input` to use consistent values:
```css
.clue-row input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.85rem;
}
```

(Change: padding from `6px 10px` to `8px 12px`, border from `#ddd` to `#ccc`)

**Step 3: Simplify custom word input**

Change `.custom-word-input` to extend the standard input look. Keep the extra right padding (for the clear button) and uppercase:

```css
.custom-word-input {
  width: 100%;
  padding: 8px 28px 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.custom-word-input:focus { outline: 2px solid #326891; border-color: #326891; }
.custom-word-input.input-error { border-color: #cc0000; }
```

(Change: left padding from `10px` to `12px` to match standard)

**Step 4: Replace inline styles in admin-settings-client.tsx**

In `src/app/admin/settings/admin-settings-client.tsx` lines 144-157, change:
```tsx
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
```
To:
```tsx
<input
  className="input"
  type="number"
  step={step}
  min={min}
  value={preset[key]}
  onChange={e => handleChange(preset.grid_size, key, e.target.value)}
/>
```

**Step 5: Commit**
```bash
git add src/styles/crossword-styles.css src/app/admin/settings/admin-settings-client.tsx
git commit -m "refactor(css): standardize all inputs to single .input base class"
```

---

### Task 3: Unify Status Messages

**Files:**
- Modify: `src/styles/crossword-styles.css`
- Modify: `src/app/admin/settings/admin-settings-client.tsx` (update class usage)
- Modify: `src/app/page.tsx` (update class usage)

**Step 1: Replace both status systems with one**

Replace the Status Messages section in CSS:

```css
/* ============================================================
   Status Messages
   ============================================================ */
.status {
  padding: 9px 14px;
  border-radius: 4px;
  font-size: 0.85rem;
  background: #f7f7f7;
  border: 1px solid #e2e2e2;
}
.status.success { color: #1a7a2e; }
.status.error { color: #cc0000; }
.status.info { color: #326891; }
```

Delete the old `.status-inline` block entirely.

Keep the inline status indicators (`.status-done`, `.status-active`, etc.) — those are text-color-only helpers, not full status boxes.

**Step 2: Update page.tsx**

Change `status-inline` to `status` in `src/app/page.tsx` line 211:
```tsx
// Before:
<div className={`status-inline ${statusType}`}>
// After:
<div className={`status ${statusType}`}>
```

Add flex behavior for the inline toolbar usage via a layout utility. In the toolbar, the status needs `flex: 1; min-width: 0;`. Add this inline since it's a layout concern, not a component concern:
```tsx
<div className={`status ${statusType}`} style={{ flex: 1, minWidth: 0 }}>
```

**Step 3: Admin settings already uses `.status` — verify it still works**

The admin page uses `<div className={`status ${message.type}`}>`. Previously `.status` had `display: none` which was overridden by `.status.info` etc. to `display: block`. Now `.status` has no `display: none`, so it's always visible. Since the admin page only renders the status div conditionally (`{message && ...}`), this is correct — the React conditional handles visibility.

Also, `.status` previously had `margin-top: 12px`. Remove that from the base class (it's a layout concern — consumers add margin). The admin page doesn't rely on it since it's inside a flow.

**Step 4: Commit**
```bash
git add src/styles/crossword-styles.css src/app/page.tsx
git commit -m "refactor(css): unify status messages into single .status class"
```

---

### Task 4: Consolidate Cards

**Files:**
- Modify: `src/styles/crossword-styles.css`
- Modify: `src/app/page.tsx`

**Step 1: Make `.crossword-card` extend `.card`**

Change `.crossword-card` to only add the flex layout on top of `.card`:

```css
/* Crossword card — grid + clues side by side */
.crossword-card {
  display: flex;
  gap: 40px;
  align-items: flex-start;
}
```

Remove the border, border-radius, and padding from `.crossword-card` (they're duplicated from `.card`).

**Step 2: Add `card` class alongside `crossword-card` in page.tsx**

In `src/app/page.tsx`, change:
```tsx
<div className="crossword-card">
```
To:
```tsx
<div className="card crossword-card">
```

**Step 3: Commit**
```bash
git add src/styles/crossword-styles.css src/app/page.tsx
git commit -m "refactor(css): make crossword-card extend card base class"
```

---

### Task 5: Remove Dead CSS

**Files:**
- Modify: `src/styles/crossword-styles.css`

**Step 1: Delete all unused CSS rules**

Remove these blocks entirely:

1. `.btn-row` (line ~131) — replaced by `.toolbar`
2. `.btn-group-label` (lines ~158-165) — unused
3. `.form-row` and all children (lines ~172-191) — unused
4. `.custom-words-section` (line ~464) — unused
5. `.clue-item-editable` and children (lines ~402-422) — old editable clue pattern, replaced by `.clue-row`
6. `.clue-edit-icon` (lines ~413-422) — old editable clue
7. `.clue-edit-input` and `:focus` (lines ~424-434) — old editable clue
8. `.grid-cell.sm` (line ~347) — unused size variant
9. `.panel` (lines ~240-246) — unused

Also in the responsive section, remove:
- `.btn-row` responsive rules
- `.form-row` responsive rules
- `.clue-edit-icon` responsive rule

**Step 2: Commit**
```bash
git add src/styles/crossword-styles.css
git commit -m "refactor(css): remove dead CSS classes"
```

---

### Task 6: Final Verification

**Step 1: Run lint**
```bash
pnpm lint
```
Expected: No errors.

**Step 2: Run typecheck**
```bash
pnpm typecheck
```
Expected: No new errors (pre-existing ones in tests/scripts are OK).

**Step 3: Visual check**

Run `pnpm dev` and verify:
- Creator page: buttons, grid card, clue inputs, custom word inputs, status bar all render correctly
- Admin settings: inputs and save button render correctly
- My puzzles: Play button renders correctly with btn-sm sizing

**Step 4: Commit any fixes**
