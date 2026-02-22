import { describe, it, expect } from 'vitest';
import { generatePattern } from '@/engine/patterns';
import { validateGrid } from '@/engine/validator';
import { BLACK } from '@/engine/types';

describe('generatePattern', () => {
  it('produces a 13x13 grid', () => {
    const pattern = generatePattern(13);
    expect(pattern.length).toBe(13);
    pattern.forEach(row => expect(row.length).toBe(13));
  });

  it('contains only BLACK and empty string cells', () => {
    const pattern = generatePattern(13);
    pattern.forEach(row =>
      row.forEach(cell => expect([BLACK, '']).toContain(cell))
    );
  });

  it('passes validateGrid', () => {
    for (let i = 0; i < 3; i++) {
      const pattern = generatePattern(13);
      const filled = pattern.map(row => row.map(cell => cell === BLACK ? BLACK : 'A'));
      const result = validateGrid(filled);
      expect(result.valid).toBe(true);
    }
  });

  it('has reasonable black cell count (12-40% of grid)', () => {
    const pattern = generatePattern(13);
    let blackCount = 0;
    pattern.forEach(row => row.forEach(cell => { if (cell === BLACK) blackCount++; }));
    const ratio = blackCount / (13 * 13);
    expect(ratio).toBeGreaterThan(0.12);
    expect(ratio).toBeLessThan(0.40);
  });

  it('also works for 5x5', () => {
    const pattern = generatePattern(5);
    expect(pattern.length).toBe(5);
    const filled = pattern.map(row => row.map(cell => cell === BLACK ? BLACK : 'A'));
    const result = validateGrid(filled);
    expect(result.valid).toBe(true);
  });
});
