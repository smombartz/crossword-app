import { BLACK } from './types';
import type { Puzzle, PlayerPuzzle, PlayerEntry } from './types';
import { obfuscateSolution } from './solution';

/**
 * Transform a full Puzzle into a PlayerPuzzle suitable for the player view.
 *
 * - Replaces the grid with a pattern array (1=white, 0=black).
 * - Strips the `answer` field from every entry.
 * - Obfuscates the solution grid into a solutionHash.
 *
 * The returned object contains NO cleartext answers.
 */
export function getPlayerPuzzle(puzzle: Puzzle, puzzleId: string): PlayerPuzzle {
  const pattern = puzzle.grid.map(row =>
    row.map(cell => (cell === BLACK ? 0 : 1))
  );

  const entries: PlayerEntry[] = puzzle.entries.map(({ number, direction, clue, start, length }) => ({
    number,
    direction,
    clue,
    start,
    length,
  }));

  const solutionHash = obfuscateSolution(puzzle.grid, puzzleId);

  return { id: puzzleId, size: puzzle.size, pattern, solutionHash, entries };
}
