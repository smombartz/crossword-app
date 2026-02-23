export interface WordEntry {
  readonly word: string;
  readonly clues: readonly string[];
}

export interface WordList {
  getByLength(length: number): readonly WordEntry[];
  getClue(word: string): string;
  wordsMatchingPattern(length: number, constraints: Map<number, string>): readonly WordEntry[];
  hasWord(word: string): boolean;
}

type RawWordListData = Record<string, [string, string[]][]>;

export function loadWordList(data: RawWordListData): WordList {
  const byLength = new Map<number, WordEntry[]>();
  const clueMap = new Map<string, string[]>();

  for (const [lenStr, words] of Object.entries(data)) {
    const len = Number(lenStr);
    const entries: WordEntry[] = [];
    for (const [word, clues] of words) {
      const upper = word.toUpperCase();
      entries.push({ word: upper, clues });
      clueMap.set(upper, clues);
    }
    byLength.set(len, entries);
  }

  return {
    getByLength(length: number): readonly WordEntry[] {
      return byLength.get(length) ?? [];
    },

    getClue(word: string): string {
      const upper = word.toUpperCase();
      const clues = clueMap.get(upper);
      if (!clues || clues.length === 0) return upper;
      return clues[Math.floor(Math.random() * clues.length)];
    },

    wordsMatchingPattern(
      length: number,
      constraints: Map<number, string>,
    ): readonly WordEntry[] {
      const words = byLength.get(length) ?? [];
      return words.filter(entry =>
        Array.from(constraints.entries()).every(
          ([pos, letter]) => entry.word[pos] === letter,
        ),
      );
    },

    hasWord(word: string): boolean {
      const upper = word.toUpperCase();
      return clueMap.has(upper);
    },
  };
}
