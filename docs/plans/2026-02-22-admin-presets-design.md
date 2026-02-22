# Design: Admin Settings for Per-Size Generation Presets

## Problem

The crossword engine has many hardcoded constants (density range, minimum span, backtracker branching limit, retry budgets) that significantly affect puzzle quality — especially at different grid sizes. 7x7 puzzles feel samey because the 13x13 defaults don't suit small grids. There's no way to tune these without changing code and redeploying.

## Solution

An admin-only settings page backed by Supabase, allowing per-grid-size parameter presets that the engine consumes at generation time.

## Data Model

New `generation_presets` table:

| Column | Type | Description |
|---|---|---|
| `grid_size` | `integer` PK | 7, 13, etc. |
| `min_density` | `real` | Min black cell ratio (e.g. 0.18) |
| `max_density` | `real` | Max black cell ratio (e.g. 0.28) |
| `min_span` | `integer` | Minimum word length (e.g. 3) |
| `max_candidates` | `integer` | Backtracker branching limit (e.g. 50) |
| `pattern_attempts` | `integer` | Inner pattern retry budget (e.g. 20) |
| `max_attempts` | `integer` | Outer generation retry budget (e.g. 50) |
| `updated_at` | `timestamptz` | Last modified |

RLS: admin-only INSERT/UPDATE, public SELECT.

Initial seed rows: size 7 and size 13 with current hardcoded values.

## API Routes

- `GET /api/presets` — Public. Returns all rows from `generation_presets`. Consumed by the Web Worker on init.
- `POST /api/admin/presets` — Admin-gated. Upserts a preset row. Validates session email against `ADMIN_EMAIL` env var.

## Admin Page

- Route: `/admin/settings`
- Auth: Server component checks `getServerSession()` email against `ADMIN_EMAIL` env var. Non-admins redirected to `/`.
- UI: One `.card` per grid size. Each card has labeled number inputs for all 6 parameters and a Save button. Uses existing design system classes (`.settings-row`, `.form-row`, `.btn-primary`).
- No nav link — accessed directly by URL.

## Engine Integration

The engine isolation boundary is preserved:

1. `GenerateOptions` in `src/engine/types.ts` gains optional fields: `minDensity`, `maxDensity`, `minSpan`, `maxCandidates`, `patternAttempts`.
2. `patterns.ts` and `filler.ts` read these from their options argument, falling back to current hardcoded values when undefined.
3. The Web Worker fetches presets from `GET /api/presets` during init, stores them as a `Map<number, Preset>`.
4. On each `generate` call, the worker merges the matching size preset into the options passed to engine functions.
5. Engine functions never fetch anything — they receive values as arguments.

`validator.ts` is unchanged — validation rules stay hardcoded at min span 3. Only generation parameters are tuneable.

## Parameters and Their Effects

| Parameter | Controls | Raising it... | Lowering it... |
|---|---|---|---|
| `min_density` | Floor of black cell count | More black cells, more word boundaries | More open grids, longer words |
| `max_density` | Ceiling of black cell count | Allows denser patterns | Forces more open patterns |
| `min_span` | Shortest allowed word | Eliminates short words | Allows 2-letter entries (unusual) |
| `max_candidates` | Backtracker branching | Better fill quality, slower | Faster but more failures |
| `pattern_attempts` | Pattern retries per cycle | More pattern variety | Faster failure, outer loop retries more |
| `max_attempts` | Total generation retries | More resilient, slower worst-case | Fails faster |
