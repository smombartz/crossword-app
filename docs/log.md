# Change Log

## 2026-02-27 — CSS & UI Consistency Audit

- Removed 17 unused CSS classes: `.heading-display`, `.heading-section`, `.heading-subsection`, `.text-xs`, `.text-mono`, `.tabs`/`.tab`/`.tab.active`, `.status-done`/`.status-active`/`.status-pending`/`.status-error`/`.status-text`, `.grid-cell.editable`, `.grid-cell.player`, `.answer`, `.celebrate`/`@keyframes pop`, `.container-narrow`
- Removed corresponding mobile responsive rules for `.tabs`, `.tab`, `.grid-cell.player`
- Updated existing CSS rules with element defaults: h2/h3 margins, `.text-hint` text-transform reset, `.btn` display/text-decoration, `.setting-hint` line-height, `.grid-container` position, `.custom-word-input-wrapper` position
- Added ~15 new semantic CSS classes: `.app-header`, `.page-stack`, `.share-url`, `.clue-bar`, `.timer`, `.player-header`/`.player-grid`/`.player-clues`, `.overlay`/`.overlay-card`/`.overlay-actions`, `.card-compact`, `.puzzle-list`, `.not-found`, `.sr-only`, `.settings-intro`/`.settings-section`/`.card-actions`
- Updated 10 component files to replace ~40 inline styles with CSS classes
- Eliminated all inline styles except one `marginLeft: 12` in my-puzzles (contextual spacing between sibling spans)
