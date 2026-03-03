import { BLACK } from './types';

/**
 * Creates an empty (all-white) grid of the given size.
 * Each cell is an empty string (white).
 */
export function createEmptyGrid(size: number): string[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => '')
  );
}

/**
 * Deep-clones a 2D string grid.
 */
function cloneGrid(grid: string[][]): string[][] {
  return grid.map(row => [...row]);
}

/**
 * Checks whether all white cells in the grid are connected via BFS.
 * Returns true if connected (or if there are no white cells).
 */
export function isConnected(grid: string[][]): boolean {
  const size = grid.length;
  let startR = -1;
  let startC = -1;
  let totalWhite = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] !== BLACK) {
        totalWhite++;
        if (startR === -1) {
          startR = r;
          startC = c;
        }
      }
    }
  }

  if (totalWhite === 0) return true;

  const visited: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const queue: [number, number][] = [[startR, startC]];
  visited[startR][startC] = true;
  let reachable = 0;

  const dirs: readonly [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
  ];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    reachable++;

    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (
        nr >= 0 && nr < size &&
        nc >= 0 && nc < size &&
        !visited[nr][nc] &&
        grid[nr][nc] !== BLACK
      ) {
        visited[nr][nc] = true;
        queue.push([nr, nc]);
      }
    }
  }

  return reachable === totalWhite;
}

/**
 * Checks that every white cell has a horizontal span >= minSpan
 * AND a vertical span >= minSpan.
 */
export function allSpansValid(grid: string[][], minSpan: number): boolean {
  const size = grid.length;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === BLACK) continue;

      // Horizontal span
      let hLeft = c;
      while (hLeft > 0 && grid[r][hLeft - 1] !== BLACK) hLeft--;
      let hRight = c;
      while (hRight < size - 1 && grid[r][hRight + 1] !== BLACK) hRight++;
      if (hRight - hLeft + 1 < minSpan) return false;

      // Vertical span
      let vTop = r;
      while (vTop > 0 && grid[vTop - 1][c] !== BLACK) vTop--;
      let vBottom = r;
      while (vBottom < size - 1 && grid[vBottom + 1][c] !== BLACK) vBottom++;
      if (vBottom - vTop + 1 < minSpan) return false;
    }
  }

  return true;
}

/**
 * Places a symmetric pair of black cells at (r, c) and its 180-degree
 * rotational mirror. Mutates the grid in place.
 */
export function placeBlackPair(grid: string[][], r: number, c: number): void {
  const size = grid.length;
  const mirrorR = size - 1 - r;
  const mirrorC = size - 1 - c;
  grid[r][c] = BLACK;
  grid[mirrorR][mirrorC] = BLACK;
}

/**
 * Fisher-Yates shuffle. Returns a new shuffled array.
 */
function shuffle<T>(arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const DEFAULT_PATTERN_ATTEMPTS = 20;

/**
 * Generates a valid crossword grid pattern of the given size.
 *
 * The pattern has:
 * - 180-degree rotational symmetry
 * - All white cells connected
 * - Every white cell has horizontal AND vertical span >= minSpan (default 3)
 * - Black cell density between minDensity and maxDensity (defaults 18-28%)
 *
 * @param size - Grid dimension (e.g. 9 for a 9x9 grid)
 * @param maxAttempts - Maximum number of full retries (default 20)
 * @param options - Optional density and span overrides
 * @returns A 2D string array where cells are either BLACK or '' (white)
 * @throws Error if no valid pattern found within maxAttempts
 */
export function generatePattern(
  size: number,
  maxAttempts: number = DEFAULT_PATTERN_ATTEMPTS,
  options?: { minDensity?: number; maxDensity?: number; minSpan?: number },
): string[][] {
  const totalCells = size * size;
  const minBlack = Math.floor(totalCells * (options?.minDensity ?? 0.18));
  const maxBlack = Math.floor(totalCells * (options?.maxDensity ?? 0.28));

  // Build candidate positions: only one cell per symmetric pair.
  // For a cell (r, c) and its mirror (size-1-r, size-1-c), we pick the
  // lexicographically smaller one to avoid duplicates.
  const candidates: [number, number][] = [];
  const seen = new Set<string>();

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const mirrorR = size - 1 - r;
      const mirrorC = size - 1 - c;
      const key1 = `${r},${c}`;
      const key2 = `${mirrorR},${mirrorC}`;
      if (!seen.has(key1) && !seen.has(key2)) {
        seen.add(key1);
        seen.add(key2);
        candidates.push([r, c]);
      }
    }
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const grid = createEmptyGrid(size);
    let blackCount = 0;

    const shuffled = shuffle(candidates);

    for (const [r, c] of shuffled) {
      if (blackCount >= maxBlack) break;

      const mirrorR = size - 1 - r;
      const mirrorC = size - 1 - c;
      const isCenterCell = r === mirrorR && c === mirrorC;
      const pairSize = isCenterCell ? 1 : 2;

      // Would exceed the max?
      if (blackCount + pairSize > maxBlack) continue;

      // Tentatively place the pair
      const backup = cloneGrid(grid);
      placeBlackPair(grid, r, c);

      // Check constraints: connectivity and minimum spans
      if (isConnected(grid) && allSpansValid(grid, options?.minSpan ?? 3)) {
        blackCount += pairSize;
      } else {
        // Revert
        grid[r][c] = backup[r][c];
        grid[mirrorR][mirrorC] = backup[mirrorR][mirrorC];
      }
    }

    // Check black count is in range
    if (blackCount >= minBlack && blackCount <= maxBlack) {
      return grid;
    }

    // If we have too few black cells, this attempt didn't work — retry
  }

  throw new Error(
    `Failed to generate a valid ${size}x${size} pattern after ${maxAttempts} attempts`
  );
}
