import { describe, it, expect } from 'vitest';
import { getPlayerPuzzle } from '@/engine/player-puzzle';
import { BLACK } from '@/engine/types';
import type { Puzzle } from '@/engine/types';

describe('getPlayerPuzzle', () => {
  const puzzle: Puzzle = {
    grid: [
      ['H', 'E', 'L', 'L', 'O'],
      [BLACK, BLACK, 'I', BLACK, BLACK],
      ['W', 'O', 'R', 'L', 'D'],
    ],
    size: 5,
    entries: [
      { number: 1, direction: 'across', answer: 'HELLO', clue: 'A greeting', start: [0, 0], length: 5 },
      { number: 2, direction: 'down', answer: 'LIR', clue: 'Test clue', start: [0, 2], length: 3 },
      { number: 3, direction: 'across', answer: 'WORLD', clue: 'The earth', start: [2, 0], length: 5 },
    ],
  };

  it('produces correct pattern (1=white, 0=black)', () => {
    const player = getPlayerPuzzle(puzzle, 'pzl_test');
    expect(player.pattern).toEqual([
      [1, 1, 1, 1, 1],
      [0, 0, 1, 0, 0],
      [1, 1, 1, 1, 1],
    ]);
  });

  it('strips answer field from entries', () => {
    const player = getPlayerPuzzle(puzzle, 'pzl_test');
    player.entries.forEach(e => {
      expect(e).not.toHaveProperty('answer');
    });
  });

  it('preserves clue, number, direction, start, length', () => {
    const player = getPlayerPuzzle(puzzle, 'pzl_test');
    const first = player.entries[0];
    expect(first.number).toBe(1);
    expect(first.direction).toBe('across');
    expect(first.clue).toBe('A greeting');
    expect(first.start).toEqual([0, 0]);
    expect(first.length).toBe(5);
  });

  it('includes a solutionHash that is not plaintext', () => {
    const player = getPlayerPuzzle(puzzle, 'pzl_test');
    expect(player.solutionHash).toBeTruthy();
    expect(player.solutionHash).not.toContain('HELLO');
  });

  it('sets the puzzle id', () => {
    const player = getPlayerPuzzle(puzzle, 'pzl_test');
    expect(player.id).toBe('pzl_test');
  });
});
