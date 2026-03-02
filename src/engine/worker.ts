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

let wordList: WordList | null = null;
let presets: Map<number, PresetRow> = new Map();

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'init') {
    try {
      const [wordlistRes, presetsRes] = await Promise.all([
        fetch('/wordlist.json'),
        fetch('/api/presets'),
      ]);
      const data = await wordlistRes.json();
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
      const size = options?.size ?? 13;
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
