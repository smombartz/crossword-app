import { BLACK } from './types';
import type { Entry, Direction } from './types';

function isBlack(grid: readonly (readonly string[])[], r: number, c: number): boolean {
  return r < 0 || r >= grid.length || c < 0 || c >= grid[0].length || grid[r][c] === BLACK;
}

function scanRun(
  grid: readonly (readonly string[])[],
  r: number, c: number,
  direction: Direction
): { word: string; length: number } {
  let word = '';
  let row = r, col = c;
  const dr = direction === 'down' ? 1 : 0;
  const dc = direction === 'across' ? 1 : 0;

  while (row >= 0 && row < grid.length && col >= 0 && col < grid[0].length && grid[row][col] !== BLACK) {
    word += grid[row][col];
    row += dr;
    col += dc;
  }
  return { word, length: word.length };
}

/**
 * Extract all numbered entries from a filled grid.
 * An entry starts where the cell to the left (across) or above (down) is black/edge.
 * Only entries with length >= 3 are included.
 * Numbers are assigned sequentially scanning left-to-right, top-to-bottom.
 */
export function getEntries(grid: readonly (readonly string[])[]): Entry[] {
  const entries: Entry[] = [];
  let number = 0;

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] === BLACK) continue;

      const startsAcross = isBlack(grid, r, c - 1);
      const startsDown = isBlack(grid, r - 1, c);

      if (!startsAcross && !startsDown) continue;

      const acrossRun = startsAcross ? scanRun(grid, r, c, 'across') : null;
      const downRun = startsDown ? scanRun(grid, r, c, 'down') : null;

      const hasValidAcross = acrossRun !== null && acrossRun.length >= 3;
      const hasValidDown = downRun !== null && downRun.length >= 3;

      if (!hasValidAcross && !hasValidDown) continue;

      number++;

      if (hasValidAcross) {
        entries.push({
          number, direction: 'across',
          answer: acrossRun!.word, clue: '',
          start: [r, c], length: acrossRun!.length,
        });
      }

      if (hasValidDown) {
        entries.push({
          number, direction: 'down',
          answer: downRun!.word, clue: '',
          start: [r, c], length: downRun!.length,
        });
      }
    }
  }
  return entries;
}
