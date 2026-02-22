import { describe, it, expect } from 'vitest';
import { obfuscateSolution, deobfuscateSolution, validateSolution } from '@/engine/solution';
import { BLACK } from '@/engine/types';

describe('solution obfuscation', () => {
  const grid = [
    ['H', 'E', 'L', 'L', 'O'],
    [BLACK, BLACK, 'I', BLACK, BLACK],
    ['W', 'O', 'R', 'L', 'D'],
  ];
  const puzzleId = 'pzl_test123';

  it('round-trips correctly', () => {
    const encoded = obfuscateSolution(grid, puzzleId);
    const decoded = deobfuscateSolution(encoded, puzzleId);
    expect(decoded).toEqual(grid);
  });

  it('obfuscated output is not plaintext', () => {
    const encoded = obfuscateSolution(grid, puzzleId);
    expect(encoded).not.toContain('HELLO');
    expect(encoded).not.toContain('WORLD');
  });

  it('validateSolution returns true for correct grid', () => {
    const encoded = obfuscateSolution(grid, puzzleId);
    expect(validateSolution(grid, encoded, puzzleId)).toBe(true);
  });

  it('validateSolution returns false for incorrect grid', () => {
    const encoded = obfuscateSolution(grid, puzzleId);
    const wrong = [
      ['X', 'E', 'L', 'L', 'O'],
      [BLACK, BLACK, 'I', BLACK, BLACK],
      ['W', 'O', 'R', 'L', 'D'],
    ];
    expect(validateSolution(wrong, encoded, puzzleId)).toBe(false);
  });

  it('different puzzleIds produce different hashes', () => {
    const hash1 = obfuscateSolution(grid, 'pzl_aaa');
    const hash2 = obfuscateSolution(grid, 'pzl_bbb');
    expect(hash1).not.toBe(hash2);
  });
});
