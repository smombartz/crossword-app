import { describe, it, expect, beforeEach } from 'vitest';
import { loadWordList } from '@/engine/wordlist';
import type { WordList } from '@/engine/wordlist';

const sampleData = {
  "3": [["CAT", ["A feline"]], ["DOG", ["A canine"]], ["BAT", ["Flying mammal"]]],
  "4": [["CATS", ["Plural felines"]], ["DOGS", ["Plural canines"]]],
  "5": [["HELLO", ["A greeting", "Hi there", "Salutation"]]],
};

describe('loadWordList', () => {
  let wl: WordList;

  // Use a fresh word list for each test to avoid cross-test pollution
  // (especially for tests that rely on randomness)
  beforeEach(() => {
    wl = loadWordList(sampleData as Parameters<typeof loadWordList>[0]);
  });

  describe('getByLength', () => {
    it('returns correct count for each length', () => {
      expect(wl.getByLength(3)).toHaveLength(3);
      expect(wl.getByLength(4)).toHaveLength(2);
      expect(wl.getByLength(5)).toHaveLength(1);
    });

    it('returns empty array for lengths with no words', () => {
      expect(wl.getByLength(1)).toEqual([]);
      expect(wl.getByLength(99)).toEqual([]);
    });

    it('returns word and clue data correctly', () => {
      const threeLetterWords = wl.getByLength(3);
      const cat = threeLetterWords.find(e => e.word === 'CAT');
      expect(cat).toBeDefined();
      expect(cat!.word).toBe('CAT');
      expect(cat!.clues).toEqual(['A feline']);
    });

    it('uppercases words from input', () => {
      const lowerData = {
        "3": [["cat", ["A feline"]]],
      };
      const wl2 = loadWordList(lowerData as Parameters<typeof loadWordList>[0]);
      const words = wl2.getByLength(3);
      expect(words[0].word).toBe('CAT');
    });
  });

  describe('getClue', () => {
    it('returns a clue from the available clues for a known word', () => {
      const clue = wl.getClue('CAT');
      expect(clue).toBe('A feline');
    });

    it('picks from available clues (all returned clues are valid)', () => {
      // HELLO has 3 clues; run multiple times to check the returned clue is always valid
      const validClues = ['A greeting', 'Hi there', 'Salutation'];
      for (let i = 0; i < 20; i++) {
        const clue = wl.getClue('HELLO');
        expect(validClues).toContain(clue);
      }
    });

    it('is case-insensitive for lookup', () => {
      const clue = wl.getClue('cat');
      expect(clue).toBe('A feline');
    });

    it('returns the word itself as fallback for unknown words', () => {
      expect(wl.getClue('ZEBRA')).toBe('ZEBRA');
    });

    it('returns word itself (uppercased) as fallback for unknown lowercase input', () => {
      expect(wl.getClue('zebra')).toBe('ZEBRA');
    });
  });

  describe('wordsMatchingPattern', () => {
    it('returns all words of a given length when constraints are empty', () => {
      const matches = wl.wordsMatchingPattern(3, new Map());
      expect(matches).toHaveLength(3);
    });

    it('filters by single position constraint', () => {
      // position 0 = 'C' should match CAT but not DOG or BAT
      const matches = wl.wordsMatchingPattern(3, new Map([[0, 'C']]));
      expect(matches).toHaveLength(1);
      expect(matches[0].word).toBe('CAT');
    });

    it('filters by multiple position constraints', () => {
      // C_T pattern: position 0='C', position 2='T' -> only CAT matches
      const matches = wl.wordsMatchingPattern(
        3,
        new Map([[0, 'C'], [2, 'T']]),
      );
      expect(matches).toHaveLength(1);
      expect(matches[0].word).toBe('CAT');
    });

    it('matches multiple words with shared constraint', () => {
      // position 2='T' matches CAT and BAT (not DOG)
      const matches = wl.wordsMatchingPattern(3, new Map([[2, 'T']]));
      expect(matches).toHaveLength(2);
      const words = matches.map(e => e.word);
      expect(words).toContain('CAT');
      expect(words).toContain('BAT');
    });

    it('returns empty array when no words match', () => {
      const matches = wl.wordsMatchingPattern(3, new Map([[0, 'Z']]));
      expect(matches).toEqual([]);
    });

    it('returns empty array for a length with no words', () => {
      const matches = wl.wordsMatchingPattern(99, new Map([[0, 'A']]));
      expect(matches).toEqual([]);
    });
  });
});
