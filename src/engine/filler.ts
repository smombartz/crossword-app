import { BLACK } from './types';
import type { WordList, WordEntry } from './wordlist';

/** Direction for a slot: horizontal (across) or vertical (down). */
type SlotDirection = 'across' | 'down';

/** A slot is a contiguous run of white cells that needs a word. */
interface Slot {
  readonly row: number;
  readonly col: number;
  readonly length: number;
  readonly direction: SlotDirection;
}

/** A cell position within the grid. */
interface CellPos {
  readonly row: number;
  readonly col: number;
}

/**
 * Extract all horizontal and vertical runs of white cells with length >= 3.
 * These are the "slots" that need to be filled with words.
 */
export function extractSlots(grid: readonly (readonly string[])[]): Slot[] {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  const slots: Slot[] = [];

  // Horizontal (across) slots
  for (let r = 0; r < rows; r++) {
    let runStart = -1;
    for (let c = 0; c <= cols; c++) {
      const isWhite = c < cols && grid[r][c] !== BLACK;
      if (isWhite && runStart === -1) {
        runStart = c;
      } else if (!isWhite && runStart !== -1) {
        const length = c - runStart;
        if (length >= 3) {
          slots.push({ row: r, col: runStart, length, direction: 'across' });
        }
        runStart = -1;
      }
    }
  }

  // Vertical (down) slots
  for (let c = 0; c < cols; c++) {
    let runStart = -1;
    for (let r = 0; r <= rows; r++) {
      const isWhite = r < rows && grid[r][c] !== BLACK;
      if (isWhite && runStart === -1) {
        runStart = r;
      } else if (!isWhite && runStart !== -1) {
        const length = r - runStart;
        if (length >= 3) {
          slots.push({ row: runStart, col: c, length, direction: 'down' });
        }
        runStart = -1;
      }
    }
  }

  return slots;
}

/**
 * Get the grid cells that a slot occupies.
 */
function slotCells(slot: Slot): CellPos[] {
  const cells: CellPos[] = [];
  for (let i = 0; i < slot.length; i++) {
    if (slot.direction === 'across') {
      cells.push({ row: slot.row, col: slot.col + i });
    } else {
      cells.push({ row: slot.row + i, col: slot.col });
    }
  }
  return cells;
}

/**
 * Get letter constraints for a slot from the current grid state.
 * Returns a map of position-within-slot -> letter for any cells
 * that already have a letter placed.
 */
export function getConstraints(
  grid: readonly (readonly string[])[],
  slot: Slot,
): Map<number, string> {
  const constraints = new Map<number, string>();
  const cells = slotCells(slot);
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const value = grid[cell.row][cell.col];
    if (value !== '' && value !== BLACK) {
      constraints.set(i, value);
    }
  }
  return constraints;
}

/**
 * Place a word into a slot on the grid (mutates grid in place).
 */
export function placeWord(
  grid: string[][],
  slot: Slot,
  word: string,
): void {
  const cells = slotCells(slot);
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    grid[cell.row][cell.col] = word[i];
  }
}

/** Default maximum number of word candidates to try per slot to avoid combinatorial explosion. */
const DEFAULT_MAX_CANDIDATES = 50;

/**
 * Get viable candidates for a slot given the current grid state and used words.
 * Returns at most maxCandidates entries.
 */
function getCandidates(
  grid: readonly (readonly string[])[],
  slot: Slot,
  wordList: WordList,
  usedWords: ReadonlySet<string>,
  maxCandidates: number,
): readonly WordEntry[] {
  const constraints = getConstraints(grid, slot);
  const all = wordList.wordsMatchingPattern(slot.length, constraints);
  const viable: WordEntry[] = [];
  for (let i = 0; i < all.length && viable.length < maxCandidates; i++) {
    if (!usedWords.has(all[i].word)) {
      viable.push(all[i]);
    }
  }
  return viable;
}

/**
 * Fill a grid pattern with words using constraint propagation and backtracking.
 *
 * Uses the Minimum Remaining Values (MRV) heuristic: at each step, pick the
 * unfilled slot with the fewest viable candidates. This naturally interleaves
 * across and down slots, leading to earlier detection of dead ends.
 *
 * @param pattern - 2D grid where '' = white cell to fill, BLACK = black cell
 * @param wordList - Word list to draw words from
 * @returns Filled grid or null if no valid fill exists
 */
export function fillGrid(
  pattern: readonly (readonly string[])[],
  wordList: WordList,
  maxCandidates: number = DEFAULT_MAX_CANDIDATES,
  customWords?: readonly string[],
): string[][] | null {
  const rows = pattern.length;
  if (rows === 0) return null;

  // Create a mutable working copy of the grid
  const grid: string[][] = pattern.map(row => [...row]);

  // Extract all slots that need filling
  const allSlots = extractSlots(grid);

  if (allSlots.length === 0) {
    // No slots to fill — if the grid has white cells, it's unfillable
    // (all runs < 3 letters). If no white cells, return as-is.
    const hasWhite = grid.some(row => row.some(cell => cell === ''));
    return hasWhite ? null : grid;
  }

  // Track which slots have been filled and which words are used
  const filled = new Set<number>(); // indices into allSlots
  const usedWords = new Set<string>();

  // Seed custom words into compatible slots before backtracking.
  // Sort custom words longest-first so the most constrained words get placed
  // first, reducing the chance of conflicts between custom words.
  if (customWords && customWords.length > 0) {
    const sorted = [...customWords].sort((a, b) => b.length - a.length);

    for (const word of sorted) {
      let placed = false;
      for (let idx = 0; idx < allSlots.length; idx++) {
        if (filled.has(idx)) continue;
        const slot = allSlots[idx];
        if (slot.length !== word.length) continue;

        // Check letter constraints — does this word fit with already-placed letters?
        const constraints = getConstraints(grid, slot);
        const fits = Array.from(constraints.entries()).every(
          ([pos, letter]) => word[pos] === letter,
        );
        if (!fits) continue;

        placeWord(grid, slot, word);
        usedWords.add(word);
        filled.add(idx);
        placed = true;
        break;
      }
      if (!placed) return null; // Custom word couldn't fit — caller should retry
    }
  }

  /**
   * Recursive backtracking solver using MRV heuristic.
   * @returns true if a valid fill was found
   */
  function solve(): boolean {
    if (filled.size === allSlots.length) {
      return true; // All slots filled successfully
    }

    // MRV: pick the unfilled slot with the fewest viable candidates
    let bestSlotIdx = -1;
    let bestCandidates: readonly WordEntry[] = [];
    let bestCount = Infinity;

    for (let i = 0; i < allSlots.length; i++) {
      if (filled.has(i)) continue;
      const candidates = getCandidates(grid, allSlots[i], wordList, usedWords, maxCandidates);
      if (candidates.length === 0) {
        return false; // Dead end: an unfilled slot has no viable candidates
      }
      if (candidates.length < bestCount) {
        bestCount = candidates.length;
        bestSlotIdx = i;
        bestCandidates = candidates;
      }
    }

    if (bestSlotIdx === -1) {
      return false; // Should not happen, but guard against it
    }

    const slot = allSlots[bestSlotIdx];
    const cells = slotCells(slot);

    for (const candidate of bestCandidates) {
      // Save grid state for this slot's cells before placing
      const savedValues = cells.map(c => grid[c.row][c.col]);

      // Place the word
      placeWord(grid, slot, candidate.word);
      usedWords.add(candidate.word);
      filled.add(bestSlotIdx);

      if (solve()) {
        return true;
      }

      // Backtrack: restore grid and remove word from used set
      filled.delete(bestSlotIdx);
      usedWords.delete(candidate.word);
      for (let j = 0; j < cells.length; j++) {
        grid[cells[j].row][cells[j].col] = savedValues[j];
      }
    }

    return false; // No candidate worked for this slot
  }

  const success = solve();
  return success ? grid : null;
}
