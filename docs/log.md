# Change Log

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
