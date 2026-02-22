import { BLACK } from './types';

/**
 * Flatten a 2D grid into a pipe-delimited string.
 * e.g. [['H','E','L','L','O'], ['#','#','I','#','#'], ['W','O','R','L','D']]
 *   -> "HELLO|##I##|WORLD"
 */
function gridToString(grid: readonly (readonly string[])[]): string {
  return grid.map((row) => row.join('')).join('|');
}

/**
 * Restore a pipe-delimited string back into a 2D grid.
 * e.g. "HELLO|##I##|WORLD"
 *   -> [['H','E','L','L','O'], ['#','#','I','#','#'], ['W','O','R','L','D']]
 */
function stringToGrid(s: string): string[][] {
  return s.split('|').map((row) => row.split(''));
}

/**
 * XOR each character of `text` with cycling characters from `key`.
 * Returns a new string of the same length.
 */
function xorWithKey(text: string, key: string): string {
  const result: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const textCode = text.charCodeAt(i);
    const keyCode = key.charCodeAt(i % key.length);
    result.push(String.fromCharCode(textCode ^ keyCode));
  }
  return result.join('');
}

/**
 * Obfuscate a puzzle grid into an encoded string.
 *
 * Approach:
 * 1. Flatten grid to pipe-delimited string: "HELLO|##I##|WORLD"
 * 2. XOR each char with cycling puzzleId chars
 * 3. Base64 encode the result
 *
 * This is NOT encryption -- it is obfuscation to prevent casual
 * inspection of the solution in the player puzzle object.
 */
export function obfuscateSolution(
  grid: readonly (readonly string[])[],
  puzzleId: string
): string {
  const flat = gridToString(grid);
  const xored = xorWithKey(flat, puzzleId);
  return btoa(xored);
}

/**
 * Deobfuscate an encoded string back into a 2D grid.
 * Reverses the process of `obfuscateSolution`.
 */
export function deobfuscateSolution(
  encoded: string,
  puzzleId: string
): string[][] {
  const xored = atob(encoded);
  const flat = xorWithKey(xored, puzzleId);
  return stringToGrid(flat);
}

/**
 * Validate a player's grid against the obfuscated solution.
 *
 * Re-obfuscates the player's grid with the same puzzleId and
 * compares the result to the stored solutionHash.
 */
export function validateSolution(
  playerGrid: readonly (readonly string[])[],
  solutionHash: string,
  puzzleId: string
): boolean {
  const playerHash = obfuscateSolution(playerGrid, puzzleId);
  return playerHash === solutionHash;
}
