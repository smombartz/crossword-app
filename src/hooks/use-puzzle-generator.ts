'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { Puzzle, GenerateOptions } from '@/engine/types';

export function usePuzzleGenerator() {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../engine/worker.ts', import.meta.url)
    );
    workerRef.current = worker;

    worker.onmessage = (e) => {
      if (e.data.type === 'ready') {
        setReady(true);
        setError(null);
      }
      if (e.data.type === 'error') {
        setError(e.data.message);
      }
    };

    worker.postMessage({ type: 'init' });

    return () => worker.terminate();
  }, []);

  const generate = useCallback((options?: GenerateOptions) => {
    return new Promise<Puzzle>((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) return reject(new Error('Worker not initialized'));

      const timeout = setTimeout(
        () => reject(new Error('Generation timed out')),
        60_000
      );

      worker.onmessage = (e) => {
        if (e.data.type === 'success') {
          clearTimeout(timeout);
          resolve(e.data.puzzle);
        }
        if (e.data.type === 'error') {
          clearTimeout(timeout);
          reject(new Error(e.data.message));
        }
      };

      worker.postMessage({ type: 'generate', payload: { options } });
    });
  }, []);

  const validateWord = useCallback((word: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const worker = workerRef.current;
      if (!worker) return resolve(false);

      const handler = (e: MessageEvent) => {
        if (e.data.type === 'validate-word-result' && e.data.word === word.toUpperCase()) {
          worker.removeEventListener('message', handler);
          resolve(e.data.valid);
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'validate-word', payload: { word } });
    });
  }, []);

  const getClues = useCallback((word: string): Promise<readonly string[]> => {
    return new Promise((resolve) => {
      const worker = workerRef.current;
      if (!worker) return resolve([]);
      const handler = (e: MessageEvent) => {
        if (e.data.type === 'clues-result' && e.data.word === word.toUpperCase()) {
          worker.removeEventListener('message', handler);
          resolve(e.data.clues);
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'getClues', payload: { word } });
    });
  }, []);

  return { generate, validateWord, getClues, ready, error };
}
