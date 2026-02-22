import { describe, it, expect } from 'vitest';
import { BLACK } from '@/engine/types';
import type { Puzzle, PlayerPuzzle, Entry } from '@/engine/types';

describe('engine types', () => {
  it('BLACK constant is #', () => {
    expect(BLACK).toBe('#');
  });

  it('Puzzle type accepts valid shape', () => {
    const puzzle: Puzzle = {
      grid: [['A', '#'], ['#', 'B']],
      size: 2,
      entries: [],
    };
    expect(puzzle.size).toBe(2);
  });
});
