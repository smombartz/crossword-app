# Plan: Align 5x5 CSS with html-css-reference.html Patterns

## Context
After adding 5x5 grid support (type union, button, CSS), the user wants to verify our implementation follows the patterns in `html-css-reference.html`. A comparison revealed one CSS fix needed and several intentional differences that are correct for our React/Next.js context.

## Comparison Summary

### Matches (no changes needed)
- Grid base `.grid-cell`: 52px, 1.3rem font, 0.5px border — identical
- `.cell-number`: 0.55rem, absolute positioned top-left — identical
- `.grid-container`: `display: inline-block; border: 2px solid #121212` — identical
- Mobile base: 42px cells, 0.48rem numbers, 1.1rem font — identical
- All button, status, clue, tab, card, and form patterns — identical

### One CSS Fix Needed

**File:** `src/styles/crossword-styles.css` line 144

The reference has max 2 buttons in a `.btn-group`, so `:last-child` provided a separator between them. With 3 buttons (5x5, 7x7, 13x13), only the last gets a border — the middle button has no left separator.

**Change:**
```css
/* Before */
.btn-group .btn:last-child { border-left: 1px solid #fff; }

/* After */
.btn-group .btn + .btn { border-left: 1px solid #fff; }
```

This adds a white separator between every pair of adjacent buttons, matching the reference intent for any number of buttons.

### Intentional Differences (no fix needed)

| Aspect | Reference | Our App | Why Different |
|--------|-----------|---------|---------------|
| Cell sizing approach | Inline styles + `.sm` class | `.grid-container.grid-size-N` CSS classes | React components use class-based sizing; grid component applies `grid-size-${gridSize}` dynamically |
| Cell sizes | 52px (5x5), 38px (7x7) | 88px (5x5), 72px (7x7), 52px (13x13) | Reference shows 7 puzzles simultaneously; our app shows 1 puzzle, so cells are proportionally larger |
| Size selector | `<select>` dropdown | btn-group buttons | Different UI choice for our single-puzzle creator view |
| btn-group-label | Outside btn-group div | Inside btn-group div | Works fine either way; label has `display: flex; align-items: center` |

## Verification
1. Visual: Confirm white separator line appears between all 3 size buttons
2. `pnpm typecheck` — no new errors
