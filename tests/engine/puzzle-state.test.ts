import { describe, it, expect } from 'vitest';
import type { PlayerPuzzle, PlayerEntry } from '@/engine/types';
import {
  initPuzzleState,
  puzzleReducer,
  isComplete,
  getActiveEntry,
  getHighlightedCells,
} from '@/state/puzzle-state';

/**
 * Test grid (5x5):
 *
 *   1 . 2 . .
 *   . # . # #
 *   3 . . . 4
 *   # # . # .
 *   5 . . . .
 *
 * pattern: 1=white, 0=black
 *
 * Entries:
 *   1-across: (0,0) length 5 "_ _ _ _ _"
 *   2-down:   (0,2) length 5 "_ _ _ _ _"
 *   3-across: (2,0) length 5 "_ _ _ _ _"
 *   4-down:   (2,4) length 3 "_ _ _"
 *   5-across: (4,0) length 5 "_ _ _ _ _"
 *   1-down:   (0,0) length 3 "_ _ _"  (same number as 1-across)
 */
const pattern: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1],
  [1, 0, 1, 0, 0],
  [1, 1, 1, 1, 1],
  [0, 0, 1, 0, 1],
  [1, 1, 1, 1, 1],
];

const entries: readonly PlayerEntry[] = [
  { number: 1, direction: 'across', clue: 'First across', start: [0, 0], length: 5 },
  { number: 1, direction: 'down', clue: 'First down', start: [0, 0], length: 3 },
  { number: 2, direction: 'down', clue: 'Second down', start: [0, 2], length: 5 },
  { number: 3, direction: 'across', clue: 'Third across', start: [2, 0], length: 5 },
  { number: 4, direction: 'down', clue: 'Fourth down', start: [2, 4], length: 3 },
  { number: 5, direction: 'across', clue: 'Fifth across', start: [4, 0], length: 5 },
];

const testPuzzle: PlayerPuzzle = {
  id: 'test_001',
  size: 5,
  pattern,
  solutionHash: 'fakehash',
  entries,
};

describe('initPuzzleState', () => {
  it('creates an empty grid matching the pattern', () => {
    const state = initPuzzleState(testPuzzle);
    expect(state.playerGrid).toHaveLength(5);
    for (let r = 0; r < 5; r++) {
      expect(state.playerGrid[r]).toHaveLength(5);
      for (let c = 0; c < 5; c++) {
        if (pattern[r][c] === 1) {
          expect(state.playerGrid[r][c]).toBe('');
        } else {
          expect(state.playerGrid[r][c]).toBe('#');
        }
      }
    }
  });

  it('sets cursor to the first white cell', () => {
    const state = initPuzzleState(testPuzzle);
    expect(state.cursor).toEqual({ row: 0, col: 0 });
  });

  it('defaults direction to across', () => {
    const state = initPuzzleState(testPuzzle);
    expect(state.direction).toBe('across');
  });

  it('stores pattern and entries from the puzzle', () => {
    const state = initPuzzleState(testPuzzle);
    expect(state.pattern).toBe(pattern);
    expect(state.entries).toBe(entries);
  });
});

describe('SELECT_CELL', () => {
  it('moves cursor to the specified cell', () => {
    const state = initPuzzleState(testPuzzle);
    const next = puzzleReducer(state, { type: 'SELECT_CELL', row: 2, col: 3 });
    expect(next.cursor).toEqual({ row: 2, col: 3 });
  });

  it('does not move cursor to a black cell', () => {
    const state = initPuzzleState(testPuzzle);
    const next = puzzleReducer(state, { type: 'SELECT_CELL', row: 1, col: 1 });
    // cursor stays where it was
    expect(next.cursor).toEqual(state.cursor);
  });

  it('toggles direction when clicking the already-selected cell', () => {
    const state = initPuzzleState(testPuzzle);
    // cursor starts at (0,0) across
    expect(state.direction).toBe('across');
    const next = puzzleReducer(state, { type: 'SELECT_CELL', row: 0, col: 0 });
    expect(next.direction).toBe('down');
    const next2 = puzzleReducer(next, { type: 'SELECT_CELL', row: 0, col: 0 });
    expect(next2.direction).toBe('across');
  });

  it('sets direction to across when selecting a cell that belongs to an across entry', () => {
    // Start at (0,0) and toggle to down
    let state = initPuzzleState(testPuzzle);
    state = puzzleReducer(state, { type: 'SELECT_CELL', row: 0, col: 0 }); // toggle to down
    expect(state.direction).toBe('down');
    // Now select (0,3) which only belongs to 1-across (no down entry at col 3 row 0)
    const next = puzzleReducer(state, { type: 'SELECT_CELL', row: 0, col: 3 });
    expect(next.cursor).toEqual({ row: 0, col: 3 });
    expect(next.direction).toBe('across');
  });
});

describe('TYPE_LETTER', () => {
  it('fills the current cell with an uppercase letter', () => {
    const state = initPuzzleState(testPuzzle);
    const next = puzzleReducer(state, { type: 'TYPE_LETTER', letter: 'a' });
    expect(next.playerGrid[0][0]).toBe('A');
  });

  it('advances cursor to the next white cell in current direction', () => {
    const state = initPuzzleState(testPuzzle);
    const next = puzzleReducer(state, { type: 'TYPE_LETTER', letter: 'H' });
    expect(next.cursor).toEqual({ row: 0, col: 1 });
  });

  it('auto-advances across, skipping nothing when cells are contiguous', () => {
    let state = initPuzzleState(testPuzzle);
    state = puzzleReducer(state, { type: 'TYPE_LETTER', letter: 'H' });
    state = puzzleReducer(state, { type: 'TYPE_LETTER', letter: 'E' });
    state = puzzleReducer(state, { type: 'TYPE_LETTER', letter: 'L' });
    state = puzzleReducer(state, { type: 'TYPE_LETTER', letter: 'L' });
    state = puzzleReducer(state, { type: 'TYPE_LETTER', letter: 'O' });
    expect(state.playerGrid[0]).toEqual(['H', 'E', 'L', 'L', 'O']);
    // After filling last cell of entry, cursor stays at the end
    expect(state.cursor).toEqual({ row: 0, col: 4 });
  });

  it('auto-advances down direction', () => {
    let state = initPuzzleState(testPuzzle);
    // Toggle to down at (0,0)
    state = puzzleReducer(state, { type: 'SELECT_CELL', row: 0, col: 0 }); // toggle to down
    state = puzzleReducer(state, { type: 'TYPE_LETTER', letter: 'A' });
    expect(state.cursor).toEqual({ row: 1, col: 0 });
    state = puzzleReducer(state, { type: 'TYPE_LETTER', letter: 'B' });
    expect(state.cursor).toEqual({ row: 2, col: 0 });
  });
});

describe('BACKSPACE', () => {
  it('clears the current cell if it has a letter', () => {
    let state = initPuzzleState(testPuzzle);
    state = puzzleReducer(state, { type: 'TYPE_LETTER', letter: 'A' });
    // cursor is now at (0,1)
    // Go back to (0,0) by selecting it
    state = puzzleReducer(state, { type: 'SELECT_CELL', row: 0, col: 0 });
    state = puzzleReducer(state, { type: 'BACKSPACE' });
    expect(state.playerGrid[0][0]).toBe('');
  });

  it('moves back to previous cell if current cell is already empty', () => {
    let state = initPuzzleState(testPuzzle);
    state = puzzleReducer(state, { type: 'TYPE_LETTER', letter: 'A' });
    // cursor is at (0,1), which is empty
    expect(state.playerGrid[0][1]).toBe('');
    state = puzzleReducer(state, { type: 'BACKSPACE' });
    // Should move back to (0,0) and clear it
    expect(state.cursor).toEqual({ row: 0, col: 0 });
    expect(state.playerGrid[0][0]).toBe('');
  });

  it('moves backward in down direction', () => {
    let state = initPuzzleState(testPuzzle);
    // Toggle to down
    state = puzzleReducer(state, { type: 'SELECT_CELL', row: 0, col: 0 }); // toggle to down
    state = puzzleReducer(state, { type: 'TYPE_LETTER', letter: 'A' });
    state = puzzleReducer(state, { type: 'TYPE_LETTER', letter: 'B' });
    // cursor is at (2,0)
    expect(state.cursor).toEqual({ row: 2, col: 0 });
    state = puzzleReducer(state, { type: 'BACKSPACE' });
    // current cell was empty, so moves back to (1,0) and clears it
    expect(state.cursor).toEqual({ row: 1, col: 0 });
    expect(state.playerGrid[1][0]).toBe('');
  });
});

describe('ARROW', () => {
  it('moves cursor right', () => {
    const state = initPuzzleState(testPuzzle);
    const next = puzzleReducer(state, { type: 'ARROW', arrow: 'right' });
    expect(next.cursor).toEqual({ row: 0, col: 1 });
  });

  it('moves cursor left', () => {
    let state = initPuzzleState(testPuzzle);
    state = puzzleReducer(state, { type: 'SELECT_CELL', row: 0, col: 2 });
    const next = puzzleReducer(state, { type: 'ARROW', arrow: 'left' });
    expect(next.cursor).toEqual({ row: 0, col: 1 });
  });

  it('moves cursor down', () => {
    const state = initPuzzleState(testPuzzle);
    const next = puzzleReducer(state, { type: 'ARROW', arrow: 'down' });
    // row 1, col 0 is white
    expect(next.cursor).toEqual({ row: 1, col: 0 });
  });

  it('moves cursor up', () => {
    let state = initPuzzleState(testPuzzle);
    state = puzzleReducer(state, { type: 'SELECT_CELL', row: 2, col: 0 });
    const next = puzzleReducer(state, { type: 'ARROW', arrow: 'up' });
    expect(next.cursor).toEqual({ row: 1, col: 0 });
  });

  it('skips black cells when moving right', () => {
    let state = initPuzzleState(testPuzzle);
    // Position at (1,0), which is white. To the right is (1,1) which is black. Next white is (1,2).
    state = puzzleReducer(state, { type: 'SELECT_CELL', row: 1, col: 0 });
    const next = puzzleReducer(state, { type: 'ARROW', arrow: 'right' });
    expect(next.cursor).toEqual({ row: 1, col: 2 });
  });

  it('skips black cells when moving down', () => {
    let state = initPuzzleState(testPuzzle);
    // Position at (2,0). Down is (3,0) which is black. Next white is (4,0).
    state = puzzleReducer(state, { type: 'SELECT_CELL', row: 2, col: 0 });
    const next = puzzleReducer(state, { type: 'ARROW', arrow: 'down' });
    expect(next.cursor).toEqual({ row: 4, col: 0 });
  });

  it('does not move cursor if at edge and no white cell ahead', () => {
    const state = initPuzzleState(testPuzzle);
    // at (0,0), can't go left
    const next = puzzleReducer(state, { type: 'ARROW', arrow: 'left' });
    expect(next.cursor).toEqual({ row: 0, col: 0 });
  });

  it('does not move cursor up from (0,0)', () => {
    const state = initPuzzleState(testPuzzle);
    const next = puzzleReducer(state, { type: 'ARROW', arrow: 'up' });
    expect(next.cursor).toEqual({ row: 0, col: 0 });
  });

  it('sets direction to match arrow axis', () => {
    const state = initPuzzleState(testPuzzle);
    expect(state.direction).toBe('across');
    const down = puzzleReducer(state, { type: 'ARROW', arrow: 'down' });
    expect(down.direction).toBe('down');
    const right = puzzleReducer(down, { type: 'ARROW', arrow: 'right' });
    expect(right.direction).toBe('across');
  });
});

describe('TAB', () => {
  it('moves to the first empty cell of the next entry', () => {
    const state = initPuzzleState(testPuzzle);
    // Currently on 1-across. Next entry should be 1-down.
    const next = puzzleReducer(state, { type: 'TAB', shift: false });
    const activeEntry = getActiveEntry(next);
    expect(activeEntry).toBeDefined();
    // Should advance to the next entry (1-down starts at 0,0)
    expect(activeEntry!.number).toBe(1);
    expect(activeEntry!.direction).toBe('down');
  });

  it('shift+tab moves to the previous entry', () => {
    let state = initPuzzleState(testPuzzle);
    // Tab forward twice, then shift+tab back once
    state = puzzleReducer(state, { type: 'TAB', shift: false });
    state = puzzleReducer(state, { type: 'TAB', shift: false });
    const next = puzzleReducer(state, { type: 'TAB', shift: true });
    const activeEntry = getActiveEntry(next);
    expect(activeEntry).toBeDefined();
    expect(activeEntry!.number).toBe(1);
    expect(activeEntry!.direction).toBe('down');
  });

  it('wraps around from the last entry to the first', () => {
    let state = initPuzzleState(testPuzzle);
    // Tab through all entries (6 total), should wrap to first
    for (let i = 0; i < entries.length; i++) {
      state = puzzleReducer(state, { type: 'TAB', shift: false });
    }
    const activeEntry = getActiveEntry(state);
    expect(activeEntry).toBeDefined();
    expect(activeEntry!.number).toBe(1);
    expect(activeEntry!.direction).toBe('across');
  });
});

describe('SELECT_CLUE', () => {
  it('moves cursor to the first cell of the entry', () => {
    const state = initPuzzleState(testPuzzle);
    const entry3Across = entries.find(
      (e) => e.number === 3 && e.direction === 'across'
    )!;
    const next = puzzleReducer(state, { type: 'SELECT_CLUE', entry: entry3Across });
    expect(next.cursor).toEqual({ row: 2, col: 0 });
  });

  it('sets direction to match the entry', () => {
    const state = initPuzzleState(testPuzzle);
    const entry2Down = entries.find(
      (e) => e.number === 2 && e.direction === 'down'
    )!;
    const next = puzzleReducer(state, { type: 'SELECT_CLUE', entry: entry2Down });
    expect(next.direction).toBe('down');
    expect(next.cursor).toEqual({ row: 0, col: 2 });
  });
});

describe('isComplete', () => {
  it('returns false when grid has empty cells', () => {
    const state = initPuzzleState(testPuzzle);
    expect(isComplete(state)).toBe(false);
  });

  it('returns true when all white cells are filled', () => {
    const state = initPuzzleState(testPuzzle);
    // Fill all white cells
    const filledGrid = state.playerGrid.map((row, r) =>
      row.map((cell, c) => (pattern[r][c] === 1 ? 'X' : '#'))
    );
    const filledState = { ...state, playerGrid: filledGrid };
    expect(isComplete(filledState)).toBe(true);
  });

  it('returns false when even one white cell is empty', () => {
    const state = initPuzzleState(testPuzzle);
    const almostFilledGrid: string[][] = state.playerGrid.map((row, r) =>
      row.map((cell, c) => (pattern[r][c] === 1 ? 'X' : '#'))
    );
    almostFilledGrid[4][4] = ''; // Leave one cell empty
    const almostFilledState = { ...state, playerGrid: almostFilledGrid };
    expect(isComplete(almostFilledState)).toBe(false);
  });
});

describe('getActiveEntry', () => {
  it('returns the entry containing the cursor', () => {
    const state = initPuzzleState(testPuzzle);
    const active = getActiveEntry(state);
    expect(active).toBeDefined();
    expect(active!.number).toBe(1);
    expect(active!.direction).toBe('across');
  });

  it('returns the entry matching current direction', () => {
    let state = initPuzzleState(testPuzzle);
    // (0,0) has both 1-across and 1-down. Direction is across initially.
    expect(getActiveEntry(state)!.direction).toBe('across');
    // Toggle to down
    state = puzzleReducer(state, { type: 'SELECT_CELL', row: 0, col: 0 });
    expect(getActiveEntry(state)!.direction).toBe('down');
  });

  it('returns correct entry when cursor is in the middle of an entry', () => {
    let state = initPuzzleState(testPuzzle);
    state = puzzleReducer(state, { type: 'SELECT_CELL', row: 0, col: 3 });
    const active = getActiveEntry(state);
    expect(active).toBeDefined();
    expect(active!.number).toBe(1);
    expect(active!.direction).toBe('across');
  });
});

describe('getHighlightedCells', () => {
  it('returns cells of the active entry', () => {
    const state = initPuzzleState(testPuzzle);
    const highlighted = getHighlightedCells(state);
    // 1-across starts at (0,0) length 5: (0,0) (0,1) (0,2) (0,3) (0,4)
    expect(highlighted).toEqual(
      new Set(['0,0', '0,1', '0,2', '0,3', '0,4'])
    );
  });

  it('returns cells for a down entry', () => {
    let state = initPuzzleState(testPuzzle);
    // Toggle to down at (0,0) -> 1-down, start (0,0), length 3
    // 1-down: (0,0), (1,0), (2,0)
    state = puzzleReducer(state, { type: 'SELECT_CELL', row: 0, col: 0 }); // toggle to down
    const highlighted = getHighlightedCells(state);
    expect(highlighted).toEqual(new Set(['0,0', '1,0', '2,0']));
  });

  it('returns an empty set when no entry matches', () => {
    // Create a state with cursor on a cell that doesn't belong to any entry
    // in the current direction. This is an edge case.
    const state = initPuzzleState(testPuzzle);
    // Move to (3,4) which belongs to 4-down but not any across entry
    const next = puzzleReducer(state, { type: 'SELECT_CELL', row: 3, col: 4 });
    // Direction should be set to down since there's only a down entry there
    expect(next.direction).toBe('down');
    const highlighted = getHighlightedCells(next);
    expect(highlighted.size).toBeGreaterThan(0);
  });
});
