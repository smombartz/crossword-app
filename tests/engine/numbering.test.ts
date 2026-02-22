import { describe, it, expect } from 'vitest';
import { getEntries } from '@/engine/numbering';
import { BLACK } from '@/engine/types';

/**
 * Test grid (5x5):
 *
 *   H E L L O
 *   # # I # #
 *   W O R L D
 *   # # E # #
 *   S T A R S
 *
 * Expected across entries: HELLO (1-across), WORLD (3-across), STARS (5-across)
 * Expected down entry:     LIREA (1-down, col 2)
 */
const testGrid: readonly (readonly string[])[] = [
  ['H', 'E', 'L', 'L', 'O'],
  [BLACK, BLACK, 'I', BLACK, BLACK],
  ['W', 'O', 'R', 'L', 'D'],
  [BLACK, BLACK, 'E', BLACK, BLACK],
  ['S', 'T', 'A', 'R', 'S'],
];

describe('getEntries', () => {
  const entries = getEntries(testGrid);

  it('finds across entries of length >= 3', () => {
    const acrossEntries = entries.filter((e) => e.direction === 'across');
    const acrossWords = acrossEntries.map((e) => e.answer);
    expect(acrossWords).toContain('HELLO');
    expect(acrossWords).toContain('WORLD');
    expect(acrossWords).toContain('STARS');
    expect(acrossEntries).toHaveLength(3);
  });

  it('finds down entries of length >= 3', () => {
    const downEntries = entries.filter((e) => e.direction === 'down');
    const downWords = downEntries.map((e) => e.answer);
    expect(downWords).toContain('LIREA');
    expect(downEntries).toHaveLength(1);
  });

  it('assigns sequential numbers scanning left-to-right, top-to-bottom', () => {
    // Number assignment order based on first appearance position:
    // (0,0) H: starts across (HELLO) -> number 1
    // (0,2) L: starts down (LIREA) -> number 2
    // (2,0) W: starts across (WORLD) -> number 3
    // (4,0) S: starts across (STARS) -> number 4
    const hello = entries.find((e) => e.answer === 'HELLO');
    const lirea = entries.find((e) => e.answer === 'LIREA');
    const world = entries.find((e) => e.answer === 'WORLD');
    const stars = entries.find((e) => e.answer === 'STARS');

    expect(hello).toBeDefined();
    expect(lirea).toBeDefined();
    expect(world).toBeDefined();
    expect(stars).toBeDefined();

    expect(hello!.number).toBe(1);
    expect(lirea!.number).toBe(2);
    expect(world!.number).toBe(3);
    expect(stars!.number).toBe(4);
  });

  it('sets correct start positions and lengths', () => {
    const hello = entries.find((e) => e.answer === 'HELLO')!;
    expect(hello.start).toEqual([0, 0]);
    expect(hello.length).toBe(5);

    const lirea = entries.find((e) => e.answer === 'LIREA')!;
    expect(lirea.start).toEqual([0, 2]);
    expect(lirea.length).toBe(5);

    const world = entries.find((e) => e.answer === 'WORLD')!;
    expect(world.start).toEqual([2, 0]);
    expect(world.length).toBe(5);

    const stars = entries.find((e) => e.answer === 'STARS')!;
    expect(stars.start).toEqual([4, 0]);
    expect(stars.length).toBe(5);
  });

  it('returns no entries shorter than 3', () => {
    for (const entry of entries) {
      expect(entry.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('sets clue to empty string for all entries', () => {
    for (const entry of entries) {
      expect(entry.clue).toBe('');
    }
  });

  it('works on a standard 5x5 grid with black cells', () => {
    // The test grid is 5x5 with black cells -- the overall result should be 4 entries
    expect(entries).toHaveLength(4);
  });

  it('excludes runs shorter than 3', () => {
    // Grid where some runs are only 2 long
    const smallGrid: readonly (readonly string[])[] = [
      ['A', 'B', BLACK, 'C', 'D'],
      [BLACK, BLACK, BLACK, BLACK, BLACK],
      ['E', 'F', 'G', 'H', 'I'],
    ];
    const result = getEntries(smallGrid);
    // AB (len 2) and CD (len 2) should be excluded; EFGHI (len 5) should be included
    const acrossWords = result.filter((e) => e.direction === 'across').map((e) => e.answer);
    expect(acrossWords).not.toContain('AB');
    expect(acrossWords).not.toContain('CD');
    expect(acrossWords).toContain('EFGHI');
  });

  it('handles a grid with no valid entries', () => {
    // 2x2 grid -- no runs can be >= 3
    const tinyGrid: readonly (readonly string[])[] = [
      ['A', 'B'],
      ['C', 'D'],
    ];
    const result = getEntries(tinyGrid);
    expect(result).toEqual([]);
  });

  it('assigns the same number to across and down entries starting at the same cell', () => {
    // Grid where a cell starts both an across and down entry
    const crossGrid: readonly (readonly string[])[] = [
      ['A', 'B', 'C'],
      ['D', BLACK, BLACK],
      ['E', BLACK, BLACK],
    ];
    const result = getEntries(crossGrid);
    const acrossABC = result.find((e) => e.answer === 'ABC');
    const downADE = result.find((e) => e.answer === 'ADE');
    expect(acrossABC).toBeDefined();
    expect(downADE).toBeDefined();
    expect(acrossABC!.number).toBe(downADE!.number);
  });
});
