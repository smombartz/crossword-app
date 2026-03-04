/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;
export {}; // make this file a module

import { loadWordList } from './wordlist';
import { generatePuzzle } from './generator';
import type { WordList } from './wordlist';
import type { GenerateOptions } from './types';

interface PresetRow {
  grid_size: number;
  min_density: number;
  max_density: number;
  min_span: number;
  max_candidates: number;
  pattern_attempts: number;
  max_attempts: number;
}

type RawWordListData = Record<string, [string, string[]][]>;

interface DynamicClue {
  word: string;
  clue: string;
}

function mergeDynamicClues(data: RawWordListData, dynamicClues: DynamicClue[]): void {
  for (const { word, clue } of dynamicClues) {
    const upper = word.toUpperCase();
    const lenKey = String(upper.length);
    let bucket = data[lenKey];
    if (!bucket) {
      bucket = [];
      data[lenKey] = bucket;
    }
    const existing = bucket.find(([w]) => w === upper);
    if (existing) {
      if (!existing[1].includes(clue)) {
        existing[1].push(clue);
      }
    } else {
      bucket.push([upper, [clue]]);
    }
  }
}

let wordList: WordList | null = null;
let presets: Map<number, PresetRow> = new Map();

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'init') {
    try {
      const [wordlistRes, presetsRes, wordCluesRes] = await Promise.all([
        fetch('/wordlist.json'),
        fetch('/api/presets'),
        fetch('/api/word-clues'),
      ]);
      const data: RawWordListData = await wordlistRes.json();

      if (wordCluesRes.ok) {
        try {
          const dynamicClues: DynamicClue[] = await wordCluesRes.json();
          mergeDynamicClues(data, dynamicClues);
        } catch { /* skip merge on parse error */ }
      }

      wordList = loadWordList(data);

      if (presetsRes.ok) {
        const rows: PresetRow[] = await presetsRes.json();
        presets = new Map(rows.map(r => [r.grid_size, r]));
      }

      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: (err as Error).message });
    }
    return;
  }

  if (type === 'validate-word') {
    const word = (payload?.word ?? '').toUpperCase();
    const valid = wordList ? wordList.hasWord(word) : false;
    self.postMessage({ type: 'validate-word-result', word, valid });
    return;
  }

  if (type === 'getClues') {
    const word = (payload?.word ?? '').toUpperCase();
    const clues = wordList ? wordList.getAllClues(word) : [];
    self.postMessage({ type: 'clues-result', word, clues });
    return;
  }

  if (type === 'generate') {
    try {
      if (!wordList) throw new Error('Word list not loaded');
      const options: GenerateOptions | undefined = payload?.options;
      const size = options?.size ?? 9;
      const preset = presets.get(size);

      const mergedOptions: GenerateOptions = {
        ...options,
        ...(preset && {
          minDensity: options?.minDensity ?? preset.min_density,
          maxDensity: options?.maxDensity ?? preset.max_density,
          minSpan: options?.minSpan ?? preset.min_span,
          maxCandidates: options?.maxCandidates ?? preset.max_candidates,
          patternAttempts: options?.patternAttempts ?? preset.pattern_attempts,
          maxAttempts: options?.maxAttempts ?? preset.max_attempts,
        }),
      };

      const puzzle = generatePuzzle(wordList, mergedOptions);
      self.postMessage({ type: 'success', puzzle });
    } catch (err) {
      self.postMessage({ type: 'error', message: (err as Error).message });
    }
    return;
  }
};
