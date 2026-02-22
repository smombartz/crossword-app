import { BLACK } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a crossword grid against three constraints:
 * 1. 180-degree rotational symmetry
 * 2. All white cells are connected
 * 3. Every white cell has horizontal AND vertical span of at least 3
 */
export function validateGrid(
  grid: readonly (readonly string[])[]
): ValidationResult {
  const errors: string[] = [
    ...checkSymmetry(grid),
    ...checkConnectivity(grid),
    ...checkMinimumSpans(grid),
  ];
  return { valid: errors.length === 0, errors };
}

/**
 * Checks 180-degree rotational symmetry: grid[r][c] is black iff
 * grid[size-1-r][size-1-c] is black.
 *
 * Each violating pair is reported once (deduplicated via canonical key).
 */
function checkSymmetry(
  grid: readonly (readonly string[])[]
): string[] {
  const size = grid.length;
  const errors: string[] = [];
  const seen = new Set<string>();

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const mirrorR = size - 1 - r;
      const mirrorC = size - 1 - c;
      const isBlack = grid[r][c] === BLACK;
      const mirrorIsBlack = grid[mirrorR][mirrorC] === BLACK;

      if (isBlack !== mirrorIsBlack) {
        const key1 = `${r},${c}`;
        const key2 = `${mirrorR},${mirrorC}`;
        const canonicalKey =
          key1 < key2 ? `${key1}-${key2}` : `${key2}-${key1}`;

        if (!seen.has(canonicalKey)) {
          seen.add(canonicalKey);
          errors.push(
            `Symmetry violation: (${r},${c}) is ${isBlack ? 'black' : 'white'} ` +
              `but its mirror (${mirrorR},${mirrorC}) is ${mirrorIsBlack ? 'black' : 'white'}`
          );
        }
      }
    }
  }

  return errors;
}

/**
 * Checks that all white cells form a single connected component via BFS.
 */
function checkConnectivity(
  grid: readonly (readonly string[])[]
): string[] {
  const size = grid.length;

  // Find the first white cell and count total white cells
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

  // Edge case: no white cells (all black) — trivially connected
  if (totalWhite === 0) {
    return [];
  }

  // BFS from the first white cell
  const visited = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );
  const queue: [number, number][] = [[startR, startC]];
  visited[startR][startC] = true;
  let reachable = 0;

  const directions: readonly [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    reachable++;

    for (const [dr, dc] of directions) {
      const nr = r + dr;
      const nc = c + dc;
      if (
        nr >= 0 &&
        nr < size &&
        nc >= 0 &&
        nc < size &&
        !visited[nr][nc] &&
        grid[nr][nc] !== BLACK
      ) {
        visited[nr][nc] = true;
        queue.push([nr, nc]);
      }
    }
  }

  if (reachable < totalWhite) {
    return [
      `Connectivity error: only ${reachable} of ${totalWhite} white cells are connected`,
    ];
  }

  return [];
}

/**
 * Checks that every white cell belongs to a horizontal run of at least 3
 * AND a vertical run of at least 3.
 */
function checkMinimumSpans(
  grid: readonly (readonly string[])[]
): string[] {
  const errors: string[] = [];
  const size = grid.length;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === BLACK) continue;

      // Horizontal span: find the contiguous run of white cells in row r
      // that contains column c.
      let hLeft = c;
      while (hLeft > 0 && grid[r][hLeft - 1] !== BLACK) hLeft--;
      let hRight = c;
      while (hRight < size - 1 && grid[r][hRight + 1] !== BLACK) hRight++;
      const hSpan = hRight - hLeft + 1;

      // Vertical span: find the contiguous run of white cells in column c
      // that contains row r.
      let vTop = r;
      while (vTop > 0 && grid[vTop - 1][c] !== BLACK) vTop--;
      let vBottom = r;
      while (vBottom < size - 1 && grid[vBottom + 1][c] !== BLACK) vBottom++;
      const vSpan = vBottom - vTop + 1;

      if (hSpan < 3) {
        errors.push(
          `Short span at (${r},${c}): horizontal span is ${hSpan} (minimum 3)`
        );
      }

      if (vSpan < 3) {
        errors.push(
          `Short span at (${r},${c}): vertical span is ${vSpan} (minimum 3)`
        );
      }
    }
  }

  return errors;
}
