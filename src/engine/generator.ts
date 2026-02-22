import type { Puzzle, GenerateOptions } from './types';
import type { WordList } from './wordlist';
import { generatePattern } from './patterns';
import { fillGrid } from './filler';
import { getEntries } from './numbering';

/**
 * Generates a complete crossword puzzle.
 *
 * Orchestrates the pipeline: pattern generation -> grid fill -> entry numbering -> clue assignment.
 * Retries up to maxAttempts times if pattern generation or fill fails.
 *
 * @param wordList - Word list to draw words and clues from
 * @param options - Optional generation parameters (size, maxAttempts)
 * @returns A complete Puzzle with grid, entries, and clues
 * @throws Error if no valid puzzle could be generated within maxAttempts
 */
export function generatePuzzle(wordList: WordList, options?: GenerateOptions): Puzzle {
  const size = options?.size ?? 13;
  const maxAttempts = options?.maxAttempts ?? 50;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const pattern = generatePattern(size, 20);
      const filled = fillGrid(pattern, wordList);
      if (!filled) continue;

      const entries = getEntries(filled);
      const entriesWithClues = entries.map(entry => ({
        ...entry,
        clue: wordList.getClue(entry.answer),
      }));

      return { grid: filled, size, entries: entriesWithClues };
    } catch {
      continue;
    }
  }

  throw new Error(`Failed to generate puzzle after ${maxAttempts} attempts`);
}
