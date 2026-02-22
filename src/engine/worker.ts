/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;
export {}; // make this file a module

import { loadWordList } from './wordlist';
import { generatePuzzle } from './generator';
import type { WordList } from './wordlist';
import type { GenerateOptions } from './types';

let wordList: WordList | null = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'init') {
    try {
      const response = await fetch('/wordlist.json');
      const data = await response.json();
      wordList = loadWordList(data);
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: (err as Error).message });
    }
    return;
  }

  if (type === 'generate') {
    try {
      if (!wordList) throw new Error('Word list not loaded');
      const options: GenerateOptions | undefined = payload?.options;
      const puzzle = generatePuzzle(wordList, options);
      self.postMessage({ type: 'success', puzzle });
    } catch (err) {
      self.postMessage({ type: 'error', message: (err as Error).message });
    }
    return;
  }
};
