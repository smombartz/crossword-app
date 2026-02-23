import { describe, it, expect } from 'vitest';
import { fillGrid } from '@/engine/filler';
import { loadWordList } from '@/engine/wordlist';
import { BLACK } from '@/engine/types';

// A word list rich enough to fill a 3x3 grid.
// Includes known valid word squares, e.g.:
//   ACE / DRY / DYE  ->  down: ADD / CRY / EYE
const testData: Parameters<typeof loadWordList>[0] = {
  "3": [
    ["ACE", ["A card"]], ["ACT", ["Perform"]], ["ADD", ["Sum"]],
    ["AGE", ["Years"]], ["AGO", ["Past"]], ["AID", ["Help"]],
    ["ATE", ["Consumed"]], ["BAD", ["Not good"]], ["BAG", ["Container"]],
    ["BAT", ["A stick"]], ["BIG", ["Large"]], ["BIT", ["A piece"]],
    ["BOG", ["A marsh"]], ["BOT", ["A robot"]], ["CAD", ["A rogue"]],
    ["CAR", ["Vehicle"]], ["CAT", ["A feline"]], ["COG", ["A gear"]],
    ["COT", ["A bed"]], ["CRY", ["Weep"]], ["DAD", ["Father"]],
    ["DIG", ["Excavate"]], ["DOG", ["A canine"]], ["DRY", ["Not wet"]],
    ["DYE", ["Color"]], ["EYE", ["Organ of sight"]], ["GAB", ["Chat"]],
    ["GAG", ["Joke"]], ["GOD", ["Deity"]], ["GOT", ["Obtained"]],
    ["OAT", ["Grain"]], ["ODD", ["Strange"]], ["TAB", ["A flap"]],
    ["TAG", ["A label"]],
  ],
  "5": [
    ["CATCH", ["Grab"]], ["BATCH", ["Group"]], ["DOGMA", ["Belief"]],
    ["BIGOT", ["Narrow"]], ["TABOO", ["Forbidden"]],
  ],
};

describe('fillGrid', () => {
  it('fills a small grid with valid words', () => {
    const wl = loadWordList(testData);
    const pattern = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ];
    const result = fillGrid(pattern, wl);
    expect(result).not.toBeNull();
    if (result) {
      result.forEach(row =>
        row.forEach(cell => {
          expect(cell).not.toBe('');
          expect(cell).toMatch(/^[A-Z]$/);
        })
      );
    }
  });

  it('preserves black cells', () => {
    const wl = loadWordList(testData);
    const pattern = [
      ['', '', BLACK],
      ['', '', ''],
      [BLACK, '', ''],
    ];
    const result = fillGrid(pattern, wl);
    expect(result).not.toBeNull();
    if (result) {
      expect(result[0][2]).toBe(BLACK);
      expect(result[2][0]).toBe(BLACK);
    }
  });

  it('returns null when fill is impossible', () => {
    const wl = loadWordList({});
    const pattern = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ];
    const result = fillGrid(pattern, wl);
    expect(result).toBeNull();
  });

  it('does not use the same word twice', () => {
    const wl = loadWordList(testData);
    const pattern = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ];
    const result = fillGrid(pattern, wl);
    expect(result).not.toBeNull();
    if (result) {
      // Extract all across and down words
      const words: string[] = [];
      // Across
      for (let r = 0; r < 3; r++) {
        words.push(result[r].join(''));
      }
      // Down
      for (let c = 0; c < 3; c++) {
        words.push(result.map(row => row[c]).join(''));
      }
      const unique = new Set(words);
      expect(unique.size).toBe(words.length);
    }
  });

  it('places custom words in the grid', () => {
    const wl = loadWordList(testData);
    const pattern = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ];
    const result = fillGrid(pattern, wl, 50, ['ACE']);
    expect(result).not.toBeNull();
    if (result) {
      const words: string[] = [];
      for (let r = 0; r < 3; r++) words.push(result[r].join(''));
      for (let c = 0; c < 3; c++) words.push(result.map(row => row[c]).join(''));
      expect(words).toContain('ACE');
    }
  });

  it('returns null when custom word cannot fit', () => {
    const wl = loadWordList(testData);
    const pattern = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ];
    const result = fillGrid(pattern, wl, 50, ['CATCH']);
    expect(result).toBeNull();
  });

  it('places multiple custom words without conflicts', () => {
    const wl = loadWordList(testData);
    const pattern = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ];
    const result = fillGrid(pattern, wl, 50, ['ACE', 'DRY']);
    expect(result).not.toBeNull();
    if (result) {
      const words: string[] = [];
      for (let r = 0; r < 3; r++) words.push(result[r].join(''));
      for (let c = 0; c < 3; c++) words.push(result.map(row => row[c]).join(''));
      expect(words).toContain('ACE');
      expect(words).toContain('DRY');
    }
  });
});
