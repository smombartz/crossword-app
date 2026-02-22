import type { Direction, PlayerEntry, PlayerPuzzle } from '@/engine/types';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface PuzzleState {
  readonly playerGrid: string[][];
  readonly cursor: { row: number; col: number };
  readonly direction: Direction;
  readonly pattern: readonly (readonly number[])[];
  readonly entries: readonly PlayerEntry[];
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type PuzzleAction =
  | { type: 'SELECT_CELL'; row: number; col: number }
  | { type: 'TYPE_LETTER'; letter: string }
  | { type: 'BACKSPACE' }
  | { type: 'ARROW'; arrow: 'up' | 'down' | 'left' | 'right' }
  | { type: 'TAB'; shift: boolean }
  | { type: 'SELECT_CLUE'; entry: PlayerEntry };

// ---------------------------------------------------------------------------
// Helpers (internal)
// ---------------------------------------------------------------------------

function isWhite(pattern: readonly (readonly number[])[], row: number, col: number): boolean {
  const size = pattern.length;
  if (row < 0 || row >= size || col < 0 || col >= size) return false;
  return pattern[row][col] === 1;
}

/**
 * Find the entry that contains (row, col) in the given direction.
 */
function findEntry(
  entries: readonly PlayerEntry[],
  row: number,
  col: number,
  direction: Direction,
): PlayerEntry | null {
  for (const entry of entries) {
    if (entry.direction !== direction) continue;
    const [startRow, startCol] = entry.start;
    if (direction === 'across') {
      if (row === startRow && col >= startCol && col < startCol + entry.length) {
        return entry;
      }
    } else {
      if (col === startCol && row >= startRow && row < startRow + entry.length) {
        return entry;
      }
    }
  }
  return null;
}

/**
 * Determine the best direction for a cell. Prefers keeping the current
 * direction if possible; otherwise switches to whichever entry the cell
 * belongs to.
 */
function bestDirection(
  entries: readonly PlayerEntry[],
  row: number,
  col: number,
  preferred: Direction,
): Direction {
  const hasPreferred = findEntry(entries, row, col, preferred) !== null;
  if (hasPreferred) return preferred;
  const other: Direction = preferred === 'across' ? 'down' : 'across';
  const hasOther = findEntry(entries, row, col, other) !== null;
  if (hasOther) return other;
  return preferred;
}

/**
 * Clone a 2D grid so we can mutate it without affecting the original.
 */
function cloneGrid(grid: string[][]): string[][] {
  return grid.map((row) => [...row]);
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export function initPuzzleState(puzzle: PlayerPuzzle): PuzzleState {
  const { size, pattern, entries } = puzzle;
  const playerGrid: string[][] = [];

  let firstWhite: { row: number; col: number } | null = null;

  for (let r = 0; r < size; r++) {
    const row: string[] = [];
    for (let c = 0; c < size; c++) {
      if (pattern[r][c] === 1) {
        row.push('');
        if (!firstWhite) firstWhite = { row: r, col: c };
      } else {
        row.push('#');
      }
    }
    playerGrid.push(row);
  }

  return {
    playerGrid,
    cursor: firstWhite ?? { row: 0, col: 0 },
    direction: 'across',
    pattern,
    entries,
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function puzzleReducer(state: PuzzleState, action: PuzzleAction): PuzzleState {
  switch (action.type) {
    case 'SELECT_CELL':
      return handleSelectCell(state, action.row, action.col);
    case 'TYPE_LETTER':
      return handleTypeLetter(state, action.letter);
    case 'BACKSPACE':
      return handleBackspace(state);
    case 'ARROW':
      return handleArrow(state, action.arrow);
    case 'TAB':
      return handleTab(state, action.shift);
    case 'SELECT_CLUE':
      return handleSelectClue(state, action.entry);
  }
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

function handleSelectCell(state: PuzzleState, row: number, col: number): PuzzleState {
  const { pattern, entries, direction, cursor } = state;

  // Ignore clicks on black cells
  if (!isWhite(pattern, row, col)) return state;

  // If clicking the already-selected cell, toggle direction
  if (row === cursor.row && col === cursor.col) {
    const toggled: Direction = direction === 'across' ? 'down' : 'across';
    // Only actually toggle if the cell belongs to an entry in that direction
    const hasToggled = findEntry(entries, row, col, toggled) !== null;
    return {
      ...state,
      direction: hasToggled ? toggled : direction,
    };
  }

  // Move to the new cell, pick the best direction
  const newDirection = bestDirection(entries, row, col, direction);
  return {
    ...state,
    cursor: { row, col },
    direction: newDirection,
  };
}

function handleTypeLetter(state: PuzzleState, letter: string): PuzzleState {
  const { cursor, direction, pattern } = state;
  const grid = cloneGrid(state.playerGrid);
  grid[cursor.row][cursor.col] = letter.toUpperCase();

  // Advance cursor to next white cell in current direction
  const next = advanceCursor(pattern, cursor.row, cursor.col, direction);

  return {
    ...state,
    playerGrid: grid,
    cursor: next,
  };
}

function handleBackspace(state: PuzzleState): PuzzleState {
  const { cursor, direction, pattern } = state;
  const grid = cloneGrid(state.playerGrid);
  const currentLetter = grid[cursor.row][cursor.col];

  if (currentLetter !== '' && currentLetter !== '#') {
    // Clear current cell, stay put
    grid[cursor.row][cursor.col] = '';
    return { ...state, playerGrid: grid };
  }

  // Current cell is empty -- move back and clear that cell
  const prev = retreatCursor(pattern, cursor.row, cursor.col, direction);
  if (prev.row !== cursor.row || prev.col !== cursor.col) {
    grid[prev.row][prev.col] = '';
  }

  return {
    ...state,
    playerGrid: grid,
    cursor: prev,
  };
}

function handleArrow(
  state: PuzzleState,
  arrow: 'up' | 'down' | 'left' | 'right',
): PuzzleState {
  const { cursor, pattern } = state;
  const size = pattern.length;

  const deltas: Record<string, [number, number]> = {
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1],
  };
  const [dr, dc] = deltas[arrow];

  // Walk in the arrow direction, skipping black cells
  let r = cursor.row + dr;
  let c = cursor.col + dc;
  while (r >= 0 && r < size && c >= 0 && c < size) {
    if (isWhite(pattern, r, c)) {
      const newDirection: Direction =
        arrow === 'up' || arrow === 'down' ? 'down' : 'across';
      return {
        ...state,
        cursor: { row: r, col: c },
        direction: newDirection,
      };
    }
    r += dr;
    c += dc;
  }

  // No valid cell found -- stay in place but still update direction
  const newDirection: Direction =
    arrow === 'up' || arrow === 'down' ? 'down' : 'across';
  return {
    ...state,
    direction: newDirection,
  };
}

function handleTab(state: PuzzleState, shift: boolean): PuzzleState {
  const { entries, direction, cursor } = state;
  if (entries.length === 0) return state;

  // Find current entry index
  const currentEntry = getActiveEntry(state);
  let currentIdx = currentEntry
    ? entries.indexOf(currentEntry)
    : -1;
  if (currentIdx === -1) currentIdx = 0;

  // Move to next/previous entry
  const step = shift ? -1 : 1;
  const nextIdx = (currentIdx + step + entries.length) % entries.length;
  const nextEntry = entries[nextIdx];

  return jumpToEntry(state, nextEntry);
}

function handleSelectClue(state: PuzzleState, entry: PlayerEntry): PuzzleState {
  return jumpToEntry(state, entry);
}

// ---------------------------------------------------------------------------
// Cursor movement helpers
// ---------------------------------------------------------------------------

function advanceCursor(
  pattern: readonly (readonly number[])[],
  row: number,
  col: number,
  direction: Direction,
): { row: number; col: number } {
  const size = pattern.length;
  if (direction === 'across') {
    for (let c = col + 1; c < size; c++) {
      if (isWhite(pattern, row, c)) return { row, col: c };
    }
  } else {
    for (let r = row + 1; r < size; r++) {
      if (isWhite(pattern, r, col)) return { row: r, col };
    }
  }
  return { row, col }; // stay if no next cell
}

function retreatCursor(
  pattern: readonly (readonly number[])[],
  row: number,
  col: number,
  direction: Direction,
): { row: number; col: number } {
  if (direction === 'across') {
    for (let c = col - 1; c >= 0; c--) {
      if (isWhite(pattern, row, c)) return { row, col: c };
    }
  } else {
    for (let r = row - 1; r >= 0; r--) {
      if (isWhite(pattern, r, col)) return { row: r, col };
    }
  }
  return { row, col }; // stay if no previous cell
}

/**
 * Jump the cursor to the first empty cell of the given entry (or first cell
 * if all cells are filled).
 */
function jumpToEntry(state: PuzzleState, entry: PlayerEntry): PuzzleState {
  const [startRow, startCol] = entry.start;
  let targetRow = startRow;
  let targetCol = startCol;

  // Find first empty cell in the entry
  for (let i = 0; i < entry.length; i++) {
    const r = entry.direction === 'across' ? startRow : startRow + i;
    const c = entry.direction === 'across' ? startCol + i : startCol;
    if (state.playerGrid[r][c] === '') {
      targetRow = r;
      targetCol = c;
      break;
    }
  }

  return {
    ...state,
    cursor: { row: targetRow, col: targetCol },
    direction: entry.direction,
  };
}

// ---------------------------------------------------------------------------
// Public query functions
// ---------------------------------------------------------------------------

/**
 * Returns true when every white cell has been filled with a letter.
 */
export function isComplete(state: PuzzleState): boolean {
  const { pattern, playerGrid } = state;
  const size = pattern.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (pattern[r][c] === 1 && playerGrid[r][c] === '') {
        return false;
      }
    }
  }
  return true;
}

/**
 * Returns the entry that contains the cursor in the current direction,
 * or null if none matches.
 */
export function getActiveEntry(state: PuzzleState): PlayerEntry | null {
  const { entries, cursor, direction } = state;
  return findEntry(entries, cursor.row, cursor.col, direction);
}

/**
 * Returns a Set of "row,col" strings representing cells that belong to the
 * currently active entry.
 */
export function getHighlightedCells(state: PuzzleState): Set<string> {
  const entry = getActiveEntry(state);
  const cells = new Set<string>();
  if (!entry) return cells;

  const [startRow, startCol] = entry.start;
  for (let i = 0; i < entry.length; i++) {
    const r = entry.direction === 'across' ? startRow : startRow + i;
    const c = entry.direction === 'across' ? startCol + i : startCol;
    cells.add(`${r},${c}`);
  }
  return cells;
}
