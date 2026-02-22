export type Direction = 'across' | 'down';

export interface Entry {
  readonly number: number;
  readonly direction: Direction;
  readonly answer: string;
  readonly clue: string;
  readonly start: readonly [number, number]; // [row, col]
  readonly length: number;
}

export interface Puzzle {
  readonly grid: readonly (readonly string[])[];
  readonly size: number;
  readonly entries: readonly Entry[];
}

export interface PlayerEntry {
  readonly number: number;
  readonly direction: Direction;
  readonly clue: string;
  readonly start: readonly [number, number];
  readonly length: number;
}

export interface PlayerPuzzle {
  readonly id: string;
  readonly size: number;
  readonly pattern: readonly (readonly number[])[]; // 1=white, 0=black
  readonly solutionHash: string;
  readonly entries: readonly PlayerEntry[];
  readonly creatorName?: string;
}

export interface GenerateOptions {
  readonly size?: number;        // default 13
  readonly seed?: string;        // for reproducibility
  readonly maxAttempts?: number;  // how many patterns to try
}

/** Black cell marker in the grid */
export const BLACK = '#';
