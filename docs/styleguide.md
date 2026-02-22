# Crossword Design System — Style Guide

A clean, newspaper-inspired design system built for crossword puzzles and editorial tools. Designed to feel like a modern take on the NYT Mini aesthetic.

---

## Fonts

**Google Fonts import:**

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Libre+Franklin:wght@400;500;600;700&display=swap" rel="stylesheet">
```

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| Display / Headings | Libre Baskerville | 400, 700, 400 italic | Page titles, day headings, completion messages |
| Body / UI | Libre Franklin | 400, 500, 600, 700 | All body text, buttons, labels, clues |
| Code / Answers | System monospace | — | API keys, word previews in clue editor |

---

## Color Palette

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#121212` | Body text, headings, grid borders |
| Secondary | `#5a5a5a` | Subtitles, labels, section headings |
| Hint | `#888` | Helper text, word previews |
| Disabled | `#888` | Disabled button text |

### Accent

| Token | Hex | Usage |
|-------|-----|-------|
| Blue | `#326891` | Export buttons, active status, focused clue |
| Blue hover | `#255473` | Export button hover |

### Links

| State | Hex |
|-------|-----|
| Default | `#478fc5` |
| Visited | `#4e98d0` |
| Hover / Active | `#255980` |

### Semantic

| Token | Hex | Usage |
|-------|-----|-------|
| Success | `#1a7a2e` | Completed states, loaded confirmations |
| Error | `#cc0000` | Error messages, failed states |
| Highlight (active) | `#ffda00` | Currently selected cell (yellow) |
| Highlight (range) | `#a7d8ff` | Word highlight in grid (light blue) |

### Borders & Backgrounds

| Token | Hex | Usage |
|-------|-----|-------|
| Border | `#e2e2e2` | Cards, tab underlines |
| Border light | `#eee` | Dividers between rows |
| Border input | `#ccc` | Form input borders |
| Border strong | `#121212` | Grid cell borders |
| Background | `#fff` | Page background |
| Background subtle | `#f7f7f7` | Status message background |
| Background hover | `#f0f0f0` | Secondary button hover |
| Background disabled | `#ccc` | Disabled buttons |

---

## Typography Scale

| Class / Element | Size | Weight | Notes |
|-----------------|------|--------|-------|
| `h1` | 1.6rem | 700 | Baskerville, page title |
| `h2` | 1.1rem | 700 | Baskerville, section title |
| `h3` / `.heading-section` | 0.75rem | 600 | Franklin, uppercase + tracking |
| `h4` / `.heading-subsection` | 0.85rem | — | Uppercase, border-bottom divider |
| `.text-body` | 0.85rem | 400 | Standard body |
| `.text-small` | 0.8rem | — | Secondary info |
| `.text-xs` | 0.72rem | — | Hints, fine print |
| Grid cell letter | 1.3rem | 700 | Centered in cell |
| Cell number | 0.55rem | 600 | Top-left corner of cell |

---

## Components

### Buttons

Three variants, all sharing the base `.btn` class:

```html
<button class="btn btn-primary">Generate</button>
<button class="btn btn-secondary">Cancel</button>
<button class="btn btn-export">Export</button>
```

- **Primary** — Dark background (`#121212`), white text. Main actions.
- **Secondary** — White background, dark border. Secondary actions.
- **Export/Accent** — Blue background (`#326891`), white text. Export or special actions.

All buttons: `border-radius: 4px`, `font-weight: 600`, subtle scale on `:active`.

**Button group** (segmented control):

```html
<span class="btn-group-label">Generate All</span>
<div class="btn-group">
  <button class="btn btn-primary">Puzzles</button>
  <button class="btn btn-primary">Clues</button>
</div>
```

### Tabs

Underline-style tabs. Active tab gets a `3px` bottom border in `#121212`.

```html
<div class="tabs">
  <div class="tab active">Mon</div>
  <div class="tab">Tue</div>
  <div class="tab">Wed</div>
</div>
```

### Cards

Bordered container with rounded corners for grouped settings or content.

```html
<div class="card">
  <h3>Configuration</h3>
  <div class="settings-row">
    <div>
      <div class="setting-label">Label</div>
      <div class="setting-hint">Helper text</div>
    </div>
    <div class="setting-input">
      <input type="text">
    </div>
  </div>
</div>
```

### Status Messages

Hidden by default, shown by adding a type class:

```html
<div class="status info">Loading data...</div>
<div class="status success">Complete!</div>
<div class="status error">Something went wrong.</div>
```

Background is always `#f7f7f7` with a subtle border. Text color changes per type.

### Form Rows

Horizontal label + input pairs that stack vertically on mobile:

```html
<div class="form-row">
  <label>Grid Size:</label>
  <select>...</select>
</div>
```

---

## Crossword Grid

The grid uses a flex-based layout with no gaps between cells.

```
┌─────┬─────┬─────┬─────┬─────┐
│ ¹A  │  B  │  C  │█████│ ²D  │
├─────┼─────┼─────┼─────┼─────┤
│  E  │█████│  F  │  G  │  H  │
├─────┼─────┼─────┼─────┼─────┤
│  I  │  J  │  K  │  L  │  M  │
├─────┼─────┼─────┼─────┼─────┤
│  N  │  O  │█████│  P  │  Q  │
├─────┼─────┼─────┼─────┼─────┤
│  R  │  S  │  T  │  U  │  V  │
└─────┴─────┴─────┴─────┴─────┘
```

| Property | 5x5 | 7x7 |
|----------|-----|-----|
| Cell size | 52px | 38px |
| Cell size (mobile) | 42px | 42px |
| Cell size (player) | 56px | 40px |
| Border | 0.5px solid `#121212` | same |
| Outer border | 2px solid `#121212` | same |

**Cell states:**

| State | Background | When |
|-------|-----------|------|
| Default | `#fff` | Empty or filled cell |
| Black | `#121212` | Blocked cell |
| Highlight | `#a7d8ff` | Part of the active word |
| Active | `#ffda00` | Currently selected cell |
| Hover (editor) | `#ffda00` | Hovering over editable cell |

**Cell number:** Positioned `top: 2px; left: 3px`, small (`0.55rem`), weight 600, color `#555`.

---

## Responsive Behavior

Breakpoint: `640px`

| Element | Desktop | Mobile |
|---------|---------|--------|
| Layout rows | Horizontal flex | Stacked column |
| Tabs | Static row | Horizontal scroll, hidden scrollbar |
| Form inputs | Fixed widths | Full width |
| Buttons | Inline | Full width, stacked |
| Grid cells | 52px | 42px |
| Clue columns | Side-by-side | Single column |
| Card padding | 24px 28px | 16px |

---

## Usage

Link the stylesheet and Google Fonts in your HTML:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Libre+Franklin:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="crossword-styles.css">
```

Class names are generic enough to reuse across projects. The grid-specific classes (`.grid-cell`, `.clue-row`, etc.) can be ignored if you only need the base design system (typography, buttons, tabs, cards, forms, status messages).
