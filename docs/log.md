# Change Log

## 2026-03-02 — Preserve Puzzle Across OAuth Redirect

- Added `sessionStorage` helpers (`savePendingShare`, `loadPendingShare`, `clearPendingShare`) to persist puzzle state before OAuth redirect
- Before `signIn('google')`, puzzle/gridSize/customWords are stashed under `xword_pending_share` key
- On mount, restore effect checks sessionStorage and repopulates state without triggering auto-generate
- Auto-share effect fires once session resolves and restored puzzle is present
- Manual generate and size change clear pending share state to prevent stale restores
- All helpers wrapped in try/catch for private browsing compatibility
- Header login button (`src/components/ui/header.tsx`) dispatches `xword:before-sign-in` custom event before `signIn('google')`
- Page listens for event and saves puzzle with `autoShare: false` — puzzle restores but doesn't auto-share
- `PendingShareData.autoShare` flag distinguishes Share-triggered redirects (auto-share on return) from Login-triggered redirects (restore only)

## 2026-03-02 — Skeleton Grid Loading State

- Added animated skeleton grid placeholder shown while puzzles generate
- Empty cells with black squares that randomly fade in/out at staggered intervals
- Skeleton card mirrors full completed layout: card border, Preview heading, grid, Clues heading with Across/Down sections and 3 placeholder input rows each
- Skeleton matches the selected grid size (5x5, 7x7, 9x9) using same cell dimensions
- Replaces blank page gap between clicking a size and puzzle appearing
- Auto-generate puzzle on grid size change (no more empty page after clicking a size button)

## 2026-03-02 17:30 — Fix: AI clue breaks refresh cycling

- Fixed `handleAiClue` in `page.tsx` to pre-populate `clueCache` from the worker via `getClues` before appending the AI clue
- Previously, clicking sparkle before ever clicking refresh left the cache with only the AI clue, making refresh stuck on a single entry
- Added `getClues` to the `useCallback` dependency array

## 2026-03-02 16:21 — AI Clue Generation (Gemini Flash)

- Added `@google/generative-ai` dependency, moved `better-sqlite3` to production deps
- Configured `serverExternalPackages` in `next.config.mjs` to externalize `better-sqlite3`
- Created `src/lib/gemini.ts` — Gemini Flash 2.5 Lite client with `buildCluePrompt()` and `generateCrosswordClue()`
- Created `src/lib/clue-store.ts` — best-effort persistence to `llm-clues.jsonl`, `wordlist.db`, and `public/wordlist.json`
- Created `src/app/api/clues/generate/route.ts` — auth-gated POST endpoint that generates and persists AI clues
- Added sparkle button (✦) to `CreatorClueRow` in `clue-list.tsx` with loading animation
- Wired `handleAiClue` callback in `page.tsx` with `aiGeneratingKey` loading state
- Added `.clue-sparkle`, `.spinner-dot`, and `@keyframes pulse` CSS styles

## 2026-02-27 — CSS & UI Consistency Audit

- Removed 17 unused CSS classes: `.heading-display`, `.heading-section`, `.heading-subsection`, `.text-xs`, `.text-mono`, `.tabs`/`.tab`/`.tab.active`, `.status-done`/`.status-active`/`.status-pending`/`.status-error`/`.status-text`, `.grid-cell.editable`, `.grid-cell.player`, `.answer`, `.celebrate`/`@keyframes pop`, `.container-narrow`
- Removed corresponding mobile responsive rules for `.tabs`, `.tab`, `.grid-cell.player`
- Updated existing CSS rules with element defaults: h2/h3 margins, `.text-hint` text-transform reset, `.btn` display/text-decoration, `.setting-hint` line-height, `.grid-container` position, `.custom-word-input-wrapper` position
- Added ~15 new semantic CSS classes: `.app-header`, `.page-stack`, `.share-url`, `.clue-bar`, `.timer`, `.player-header`/`.player-grid`/`.player-clues`, `.overlay`/`.overlay-card`/`.overlay-actions`, `.card-compact`, `.puzzle-list`, `.not-found`, `.sr-only`, `.settings-intro`/`.settings-section`/`.card-actions`
- Updated 10 component files to replace ~40 inline styles with CSS classes
- Eliminated all inline styles except one `marginLeft: 12` in my-puzzles (contextual spacing between sibling spans)
