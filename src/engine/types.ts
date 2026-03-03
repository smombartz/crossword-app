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
  readonly size?: number;            // default 9
  readonly seed?: string;            // for reproducibility
  readonly maxAttempts?: number;     // outer generation retry budget (default 50)
  readonly minDensity?: number;      // min black cell ratio (default 0.18)
  readonly maxDensity?: number;      // max black cell ratio (default 0.28)
  readonly minSpan?: number;         // minimum word length (default 3)
  readonly maxCandidates?: number;   // backtracker branching limit (default 50)
  readonly patternAttempts?: number; // inner pattern retry budget (default 20)
  readonly customWords?: readonly string[]; // up to 4 words to seed into the grid
}

/** Black cell marker in the grid */
export const BLACK = '#';
