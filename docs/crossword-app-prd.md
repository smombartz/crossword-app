# Shareable Crossword App — Product Requirements Document

## Overview

A web application that lets users generate crossword puzzles and share them with friends via unique URLs. Generators can create and preview puzzles without an account, but must sign in with Google to share. Players solve shared crosswords in a clean, focused player view and get a confetti celebration on completion.

The crossword generation engine (grid generation, fill, validation) is treated as a standalone module with a clean API boundary, so it can be swapped, upgraded, or replaced independently of the app shell.

---

## Architecture Principles

### Separation of Concerns

The codebase must maintain a strict boundary between three layers:

```
┌─────────────────────────────────────┐
│           App Shell (UI)            │  ← Auth, routing, sharing, player chrome
├─────────────────────────────────────┤
│        Puzzle State Manager         │  ← Tracks player input, validates completion,
│                                     │     manages timer, handles undo/redo
├─────────────────────────────────────┤
│     Crossword Engine (Game Logic)   │  ← Grid generation, fill, clue lookup,
│                                     │     solution validation
└─────────────────────────────────────┘
```

**Crossword Engine** — Pure logic, no UI dependencies. Runs entirely client-side in a **Web Worker** to keep the UI thread responsive during generation. Exposes functions like `generatePuzzle()`, `validateSolution(playerGrid, solutionHash, puzzleId)`, `getEntries(grid)`. This is the module described in the companion document `crossword-app-prd.md`. It should be importable as a standalone library.

**Puzzle State Manager** — Manages the interactive solve session: which cells are filled, cursor position, selected direction, completion detection. No knowledge of how puzzles are generated. Receives a puzzle object and manages player interaction with it.

**App Shell** — Authentication, routing, database, sharing, UI components. Consumes the engine and state manager but never contains game logic directly.

This separation means you can replace the crossword engine entirely (e.g., swap in a better generator, switch from local generation to an API call) without touching the player view or sharing infrastructure.

### Client-Side First

**Everything runs in the browser.** The server's only job is storing shared puzzles and handling auth.

- **Puzzle generation** runs client-side in a Web Worker. No server compute, no timeouts, no cost.
- **Solution validation** runs client-side. The solution is shipped with the shared puzzle in an obfuscated form (see below). Cheating prevention is not a goal — the priority is speed and simplicity.
- **The server** is a thin persistence layer: store puzzles on share, retrieve puzzles on load. That's it.

### Solution Obfuscation

The solution is included in the puzzle data sent to the player, but lightly obfuscated so it's not immediately readable if someone views the page source or network tab. This is not security — it's just preventing accidental spoilers.

**Approach:** Base64-encode a simple Caesar cipher (shift by a fixed or per-puzzle offset), or use a basic XOR with the puzzle ID as the key. The client-side validation function decodes, compares, and returns a boolean. Example:

```typescript
// Encoding (when storing/sharing):
function obfuscateSolution(grid: string[][], puzzleId: string): string {
  const flat = grid.map(row => row.join('')).join('|');
  const shifted = caesarShift(flat, 13);  // ROT13 or similar
  return btoa(shifted);
}

// Decoding (in player view, at validation time only):
function deobfuscateSolution(encoded: string, puzzleId: string): string[][] {
  const shifted = atob(encoded);
  const flat = caesarShift(shifted, -13);
  return flat.split('|').map(row => row.split(''));
}

// Validation:
function validateSolution(playerGrid: string[][], encoded: string, puzzleId: string): boolean {
  const solution = deobfuscateSolution(encoded, puzzleId);
  return playerGrid.every((row, r) =>
    row.every((cell, c) => cell === solution[r][c])
  );
}
```

The point is: a solver won't accidentally see "HELLO" in the JSON, but anyone who really wants to decode it can. That's fine.

---

## Data Model

### Puzzle Object (Stored in DB)

The engine produces the core fields (`grid`, `size`, `entries`). The app layer adds `id` and `metadata` before persisting to the database.

```json
{
  "id": "pzl_a1b2c3d4",
  "grid": [
    ["H", "E", "L", "L", "O", "#", "W", "O", "R", "L", "D", "A", "Y"],
    ...
  ],
  "size": 13,
  "entries": [
    {
      "number": 1,
      "direction": "across",
      "clue": "A common greeting",
      "answer": "HELLO",
      "start": [0, 0],
      "length": 5
    }
  ],
  "metadata": {
    "createdAt": "2025-02-20T15:30:00Z",
    "createdBy": "user_abc123 | null",
    "shared": false,
    "shareSlug": null
  }
}
```

### Player Puzzle Object (Sent to Solver)

This is what the player view receives. It includes an obfuscated solution for client-side validation. Answers are NOT present in cleartext anywhere.

```json
{
  "id": "pzl_a1b2c3d4",
  "size": 13,
  "pattern": [
    [1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1],
    ...
  ],
  "solutionHash": "UkdNTnxGUk55...",
  "entries": [
    {
      "number": 1,
      "direction": "across",
      "clue": "A common greeting",
      "start": [0, 0],
      "length": 5
    }
  ]
}
```

`solutionHash` is the obfuscated (ROT13 + Base64 or XOR) solution grid. Decoded client-side only at the moment of validation. Not cryptographically secure — just prevents casual spoilers.

### User Object

```json
{
  "id": "user_abc123",
  "email": "sascha@example.com",
  "displayName": "Sascha",
  "avatarUrl": "https://...",
  "createdAt": "2025-02-20T15:00:00Z",
}
```

### Solve Session (Player State — Not Persisted Long-Term)

```json
{
  "puzzleId": "pzl_a1b2c3d4",
  "playerGrid": [
    ["H", "E", "L", "", "", "#", "", "", "", "", "", "", ""],
    ...
  ],
  "startedAt": "2025-02-20T16:00:00Z",
  "completedAt": null,
  "elapsedSeconds": 142
}
```

---

## Authentication

### Provider

Google OAuth 2.0 via Sign In with Google. Single provider, no email/password.

### Auth States

| State | Can Generate | Can Preview | Can Share | Can Solve |
|---|---|---|---|---|
| **Anonymous** | ✅ | ✅ | ❌ | ✅ |
| **Signed In** | ✅ | ✅ | ✅ | ✅ |

### Auth Flow

1. User lands on the app → Anonymous by default. No login wall.
2. User clicks **Generate** → Puzzle is created client-side. No auth required. Puzzle is held in local/session state.
3. User clicks **Share** while anonymous → Auth modal appears: "Sign in with Google to share your crossword." After sign-in, the share flow continues automatically (no need to click Share again).
4. After sign-in, puzzle is persisted to database and a unique share URL is generated.
5. Signed-in users see a minimal account indicator (avatar + name) in the header with a sign-out option.

### Implementation Notes

- Use NextAuth.js / Auth.js for Next.js.
- Store only: Google ID, email, display name, avatar URL. No passwords.
- Session persistence via HTTP-only cookies or JWT — user stays signed in across browser sessions.
- Anonymous-generated puzzles that are never shared can be discarded on tab close. No need to persist them.

---

## Feature: Crossword Generator (Creator View)

### URL

`/` (homepage) or `/create`

### UI Layout

```
┌──────────────────────────────────────────────────┐
│  [Logo]                        [Sign In / Avatar] │
├──────────────────────────────────────────────────┤
│                                                    │
│          ┌─────────────────────┐                   │
│          │                     │                   │
│          │   13×13 Grid        │                   │
│          │   (Preview Only)    │                   │
│          │                     │                   │
│          └─────────────────────┘                   │
│                                                    │
│     [ ✨ Generate Crossword ]   [ 🔗 Share ]      │
│                                                    │
│          ┌─────────────────────┐                   │
│          │  Across    │  Down  │                   │
│          │  1. ...    │ 1. .. │                   │
│          │  5. ...    │ 2. .. │                   │
│          │  ...       │ ...   │                   │
│          └─────────────────────┘                   │
│                                                    │
└──────────────────────────────────────────────────┘
```

### Behavior

**Generate Button:**
- Triggers the crossword engine to produce a new puzzle.
- While generating, show a loading state on the button (spinner + "Generating…"). Generation may take several seconds.
- On success: render the filled grid (answers visible) with clues listed below.
- On failure (engine couldn't produce a valid puzzle): show a friendly inline error — "Couldn't generate a puzzle. Try again!" with the Generate button re-enabled.
- Each click generates a completely new puzzle. No caching of previous results (though the user can click Share before generating a new one).

**Grid Preview (Creator View):**
- Shows the completed grid with all answers visible. This is a read-only preview — the creator sees what the puzzle looks like filled in.
- Black squares are visually distinct (solid dark fill).
- Entry numbers displayed in top-left corner of starting cells.
- Clue list displayed below or beside the grid, split into Across and Down columns.

**Share Button:**
- Disabled/hidden until a puzzle has been generated.
- If user is anonymous → trigger Google sign-in flow, then continue to share.
- If user is signed in → persist puzzle to database, generate a unique share slug, construct the share URL.
- Share URL format: `https://[domain]/play/[shareSlug]`
  - `shareSlug` is an 8-character, URL-safe string (e.g., `xK9mQ2pL`). Use `nanoid(8)`.
- After URL is generated, open a share dialog/modal with:
  - The share URL displayed and pre-selected for easy copying.
  - A "Copy Link" button.
  - The player view of the puzzle (empty grid) shown in a new tab or embedded preview so the creator can see what the solver will experience.
- The share URL is permanent. Once shared, the puzzle is immutable — the creator cannot edit it.

---

## Feature: Player View (Solver Experience)

### URL

`/play/[shareSlug]`

### Access

- No authentication required to solve a puzzle. Anyone with the link can play.
- If the share slug is invalid or the puzzle doesn't exist, show a 404 page with a link back to the homepage.

### UI Layout

```
┌──────────────────────────────────────────────────┐
│  [Logo]              [Timer: 03:42]   [Sign In]  │
├──────────────────────────────────────────────────┤
│                                                    │
│          ┌─────────────────────┐                   │
│          │                     │                   │
│          │   13×13 Grid        │                   │
│          │   (Interactive)     │                   │
│          │                     │                   │
│          └─────────────────────┘                   │
│                                                    │
│   Active Clue: 1 Across — "A common greeting"    │
│                                                    │
│          ┌─────────────────────┐                   │
│          │  Across    │  Down  │                   │
│          │  1. ...    │ 1. .. │                   │
│          │  5. ...    │ 2. .. │                   │
│          └─────────────────────┘                   │
│                                                    │
└──────────────────────────────────────────────────┘
```

### Grid Interaction

**Cell Selection:**
- Click a white cell to select it. The selected cell is highlighted (e.g., blue background).
- The entire entry (across or down) the cell belongs to is soft-highlighted (e.g., light blue).
- Clicking an already-selected cell toggles direction (across ↔ down).
- Clicking a clue in the clue list selects the first cell of that entry and sets the direction.

**Typing:**
- Type a letter → it fills the selected cell and auto-advances to the next cell in the current direction.
- Backspace → clears the current cell. If already empty, moves back to the previous cell.
- Arrow keys → move selection in that direction (skip black squares).
- Tab → jump to the first empty cell of the next entry.
- Shift+Tab → jump to the previous entry.

**Active Clue Display:**
- A prominent clue bar above or below the grid shows the clue for the currently selected entry.
- Both the across and down clue are accessible if the cell is a crossing.

**Mobile Support:**
- Grid cells must be tappable at a comfortable size. On small screens, the grid should be zoomable/pannable or the layout should stack vertically.
- Show a virtual keyboard (letters only) if the device doesn't have a physical keyboard. The native keyboard may also work if the grid uses hidden input fields.

### Timer

- Starts automatically when the player types their first letter.
- Displays elapsed time in `MM:SS` format in the header.
- Pauses if the player navigates away (tab blur) — optional but nice.
- Final time is displayed on the completion screen.

### Completion Detection

**How it works:**
1. After every keystroke, the Puzzle State Manager checks: is every white cell filled?
2. If yes, decode the `solutionHash` and compare the player's grid against the solution. This happens entirely client-side — no server call.
3. If fully correct → trigger completion celebration.
4. If incorrect → do NOT auto-reveal errors. The player just keeps solving. Optionally, offer a "Check puzzle" button that highlights incorrect cells (this is also client-side since the solution is available locally).

**Completion Celebration:**
- Full-screen confetti animation (use a library like `canvas-confetti` or `react-confetti`).
- Overlay message:
  ```
  🎉 Congratulations!

  You solved it in 4:32

  [Share Your Time]  [Play Another]
  ```
- Confetti runs for 3–5 seconds, then settles. The message overlay stays until dismissed.
- "Share Your Time" → copies a text string to clipboard like: "I solved [Creator Name]'s crossword in 4:32! [link]"
- "Play Another" → links back to homepage.
- The grid remains visible behind the overlay with all answers locked in, so the player can review.

---

## Feature: Clues

Each word in the word list has 3 pre-generated clues. After the engine fills the grid, it looks up clues for each entry word and picks one at random. This keeps generation fast (no API call) and fully offline-capable.

- **Source of truth:** `wordlist.db` (SQLite) at the project root. Contains ~500K words with scores and 3 clues each. Used for development and as build input.
- **Client-side:** `public/wordlist.json` — a compact JSON derivative built from `wordlist.db` via `pnpm build:wordlist`. Words are grouped by length for efficient fill lookups. ~60MB raw, but ~6–9MB over the wire with Brotli compression (served automatically by Vercel/Next.js).
- The Web Worker fetches `/wordlist.json` once on init, parses it into an in-memory Map, and reuses it across generate calls. The browser caches it after first download.
- A loading state ("Loading word list...") is shown until the Worker signals it's ready.
- Clue selection is part of the Generate flow — no separate loading step.
- The 3 clues per word provide variety across puzzles that share words.

---

## Page Routing

| Route | View | Auth Required |
|---|---|---|
| `/` | Creator view (generate + share) | No |
| `/create` | Alias for `/` | No |
| `/play/[slug]` | Player view (solve puzzle) | No |
| `/my-puzzles` | List of user's created/shared puzzles | Yes |
| `/api/puzzles` | POST: persist puzzle for sharing | Yes |
| `/api/puzzles/[slug]` | GET: fetch player puzzle (pattern + clues + solution hash) | No |
| `/api/auth/*` | Google OAuth callback routes | — |

---

## API Endpoints

### `POST /api/puzzles`

Creates and persists a puzzle. Requires authentication.

**Request body:**
```json
{
  "grid": [...],
  "entries": [...],
  "size": 13
}
```

**Response:**
```json
{
  "id": "pzl_a1b2c3d4",
  "shareSlug": "xK9mQ2pL",
  "shareUrl": "https://domain.com/play/xK9mQ2pL"
}
```

### `GET /api/puzzles/[slug]`

Fetches a shared puzzle for the player view. No auth required.

**Response:** The player puzzle object — grid pattern, clues, and an obfuscated solution string for client-side validation. No cleartext answers.

```json
{
  "id": "pzl_a1b2c3d4",
  "size": 13,
  "pattern": [
    [1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1],
    ...
  ],
  "solutionHash": "UkdNTnxGUk55...",
  "entries": [
    {
      "number": 1,
      "direction": "across",
      "clue": "A common greeting",
      "start": [0, 0],
      "length": 5
    }
  ],
  "creatorName": "Sascha"
}
```

No server-side validation endpoint is needed. The client decodes `solutionHash` and compares locally. This is fast, offline-capable, and keeps the server simple.

---

## Database Schema

Use whatever database suits the stack (Postgres, SQLite, Supabase, PlanetScale, etc.). Minimum tables:

### `users`
| Column | Type | Notes |
|---|---|---|
| id | string (PK) | `user_` prefix + nanoid |
| google_id | string (unique) | From Google OAuth |
| email | string | |
| display_name | string | |
| avatar_url | string | |
| created_at | timestamp | |

### `puzzles`
| Column | Type | Notes |
|---|---|---|
| id | string (PK) | `pzl_` prefix + nanoid |
| share_slug | string (unique, indexed) | Short URL-safe string for sharing |
| created_by | string (FK → users.id) | |
| grid_data | jsonb | Full grid with answers (for creator view / record-keeping) |
| solution_hash | text | Obfuscated solution string (sent to player for client-side validation) |
| entries_data | jsonb | Entries with clues AND answers |
| pattern_data | jsonb | Grid pattern only (1s and 0s) |
| size | integer | 13 |
| created_at | timestamp | |
| is_shared | boolean | Whether the puzzle has been shared |

---

## Tech Stack Recommendation

Not prescriptive, but suggested:

| Layer | Recommendation | Rationale |
|---|---|---|
| Framework | Next.js (App Router) | SSR for player view SEO/sharing, API routes built in |
| Auth | NextAuth.js / Auth.js | Google provider built in, session management handled |
| Database | Supabase (Postgres) | Free tier, real-time if needed later, good auth integration |
| Crossword Engine | Standalone TypeScript module, runs in Web Worker | Keep portable, no framework deps, off main thread |
| Word List | `wordlist.db` → `public/wordlist.json` | SQLite source of truth; compact JSON derivative served to clients (~6–9MB Brotli) |
| Confetti | `canvas-confetti` | Lightweight, no React dependency |
| Styling | Custom CSS (`src/styles/crossword-styles.css`) | Lightweight design system with grid, typography, and component classes |
| Deployment | Vercel (free tier) | Zero-config for Next.js, no server compute needed |
| Share Slugs | `nanoid` | Short, URL-safe, collision-resistant |

---

## Engine Module API (Contract)

The crossword engine must expose these functions. The app shell only ever interacts with the engine through this interface.

```typescript
// Generate a new puzzle. Returns a complete puzzle object or throws.
// Runs in a Web Worker to keep the UI responsive.
generatePuzzle(options?: {
  size?: number;          // default 13
  seed?: string;          // for reproducibility
  maxAttempts?: number;   // how many patterns to try
}): Promise<Puzzle>

// Validate a player's solution against the obfuscated solution.
// Runs client-side — decodes the solution hash and compares.
validateSolution(
  playerGrid: string[][],
  solutionHash: string,
  puzzleId: string
): boolean

// Obfuscate the solution grid for storage/sharing.
obfuscateSolution(grid: string[][], puzzleId: string): string

// Extract the player-safe version of a puzzle (no cleartext answers).
getPlayerPuzzle(puzzle: Puzzle): PlayerPuzzle

// Get all entries with numbers, directions, positions.
getEntries(grid: string[][]): Entry[]

// Validate that a grid meets all construction constraints.
// Useful for testing and debugging.
validateGrid(grid: string[][]): {
  valid: boolean;
  errors: string[];
}
```

```typescript
interface Puzzle {
  id?: string;               // Assigned by app layer when persisting, not by engine
  grid: string[][];          // Full grid with answers (creator-only)
  size: number;
  entries: Entry[];
}

interface Entry {
  number: number;
  direction: 'across' | 'down';
  answer: string;            // Present in full Puzzle, stripped for player
  clue: string;
  start: [number, number];
  length: number;
}

interface PlayerPuzzle {
  id: string;                // Always present (fetched from DB)
  size: number;
  pattern: number[][];       // 1 = white, 0 = black
  solutionHash: string;      // Obfuscated solution for client-side validation
  entries: Omit<Entry, 'answer'>[];
}
```

---

## Security Considerations

1. **Solutions are obfuscated, not encrypted.** The `solutionHash` prevents casual spoilers but is not cryptographically secure. This is a deliberate trade-off — speed and simplicity over cheat prevention.
2. **Share slugs should be unguessable.** Use 8-character nanoids, not sequential IDs.
3. **Google OAuth tokens** should never be stored long-term. Use session cookies.
4. **Sanitize puzzle data** before persisting — don't store raw user input if users can ever name puzzles or add custom clues.
5. **POST /api/puzzles requires auth.** The database shouldn't accept anonymous writes.

---

## Validation Checklist

Before shipping, verify:

**Engine:**
- [ ] Generated puzzles pass all hard constraints from `crossword-app-prd.md`
- [ ] Engine module has no UI or framework dependencies
- [ ] Engine can be imported and used independently of the app

**Auth:**
- [ ] Anonymous users can generate and preview puzzles
- [ ] Share button triggers Google sign-in for anonymous users
- [ ] After sign-in, share flow completes automatically without re-clicking
- [ ] Sessions persist across browser refreshes

**Sharing:**
- [ ] Share URL is generated and displayed after sign-in + share
- [ ] Share URL loads the correct puzzle in player view
- [ ] Invalid share slugs show a 404 page
- [ ] Puzzle data at share URL does not include cleartext answers
- [ ] `solutionHash` is present and decodable by the client

**Player View:**
- [ ] All keyboard interactions work (typing, backspace, arrows, tab)
- [ ] Clicking a cell selects it; clicking again toggles direction
- [ ] Active clue updates on cell selection
- [ ] Timer starts on first keystroke
- [ ] Completion detection works client-side (no server call)
- [ ] Completion triggers confetti and congratulations message
- [ ] Incorrect grids do not trigger completion
- [ ] Works on mobile (touch input, virtual keyboard)

**Security:**
- [ ] No cleartext answers visible in network tab or page source
- [ ] Cannot guess share slugs by enumeration
- [ ] POST /api/puzzles requires authentication