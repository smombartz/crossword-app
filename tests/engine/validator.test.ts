import { describe, it, expect } from 'vitest';
import { validateGrid } from '@/engine/validator';
import { BLACK } from '@/engine/types';

/**
 * Helper: creates a size×size grid filled with a given value.
 */
function makeGrid(size: number, fill: string): string[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => fill));
}

describe('validateGrid', () => {
  // ── 1. Valid grid ─────────────────────────────────────────────────────
  it('accepts a valid 5×5 symmetric, connected grid with min spans ≥ 3', () => {
    // 5×5 grid with black cells at all four corners (rotationally symmetric).
    // All remaining white cells have horizontal AND vertical span ≥ 3.
    //
    //  #  B  C  D  #
    //  F  G  H  I  J
    //  K  L  M  N  O
    //  P  Q  R  S  T
    //  #  V  W  X  #
    //
    // Corner mirrors: (0,0)↔(4,4), (0,4)↔(4,0). All symmetric.
    // Connectivity: rows 1-3 are fully white; row 0 cols 1-3 and row 4 cols 1-3
    //   connect through their adjacent rows.
    // Spans: Cell (0,1) has h-span=3 (cols 1-3), v-span=5 (rows 0-4). OK.
    //         Cell (1,0) has h-span=5 (cols 0-4), v-span=3 (rows 1-3). OK.
    //         Interior cells have even larger spans.
    const grid = [
      [BLACK, 'B', 'C', 'D', BLACK],
      ['F', 'G', 'H', 'I', 'J'],
      ['K', 'L', 'M', 'N', 'O'],
      ['P', 'Q', 'R', 'S', 'T'],
      [BLACK, 'V', 'W', 'X', BLACK],
    ];

    const result = validateGrid(grid);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  // ── 2. All-white grid is valid ────────────────────────────────────────
  it('accepts a fully white 5×5 grid (trivially symmetric, connected, spans ≥ 3)', () => {
    const grid = makeGrid(5, 'A');
    const result = validateGrid(grid);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  // ── 3. Symmetry violation ─────────────────────────────────────────────
  it('rejects a grid that lacks 180° rotational symmetry', () => {
    // Black cell at (0,0) but NOT at (4,4)
    const grid = makeGrid(5, 'A');
    grid[0][0] = BLACK;
    // mirror would be (4,4), but we leave it white

    const result = validateGrid(grid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /symmetry/i.test(e))).toBe(true);
  });

  // ── 4. Disconnected white cells ───────────────────────────────────────
  it('rejects a grid where white cells form two disconnected islands', () => {
    // Row 2 is entirely black, splitting top and bottom halves.
    // Symmetry: row 2 mirrors to row 2 (self-mirror in a 5×5), so that's OK.
    const grid = makeGrid(5, 'A');
    for (let c = 0; c < 5; c++) {
      grid[2][c] = BLACK;
    }

    const result = validateGrid(grid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => /connect/i.test(e))).toBe(true);
  });

  // ── 5. Short horizontal span (2-letter run) ──────────────────────────
  it('rejects a grid with a 2-letter horizontal run', () => {
    // 5×5 grid, symmetric. Put black cells at (0,2) and (4,2).
    // Row 0 becomes: A B # D E — the left side has span 2 (too short).
    const grid = makeGrid(5, 'A');
    grid[0][2] = BLACK;
    grid[4][2] = BLACK; // symmetric mirror

    const result = validateGrid(grid);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => /short|span/i.test(e))
    ).toBe(true);
  });

  // ── 6. Short vertical span ───────────────────────────────────────────
  it('rejects a grid with a 2-letter vertical run', () => {
    // 5×5 grid, symmetric. Put black cells at (2,0) and (2,4).
    // Col 0 becomes: A A # A A — top segment has span 2 (too short).
    const grid = makeGrid(5, 'A');
    grid[2][0] = BLACK;
    grid[2][4] = BLACK; // symmetric mirror

    const result = validateGrid(grid);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => /short|span/i.test(e))
    ).toBe(true);
  });

  // ── 7. Orphaned cell (white cell without min span in BOTH directions)
  it('rejects a grid with an orphaned white cell (span < 3 in both directions)', () => {
    // Black at (0,1),(1,0),(1,1) and their 180° mirrors (4,3),(3,4),(3,3).
    // This creates a nook: cell (0,0) has h-span=1 and v-span=1 (orphaned).
    //
    //  A  #  A  A  A
    //  #  #  A  A  A
    //  A  A  A  A  A
    //  A  A  A  #  #
    //  A  A  A  #  A
    const grid = makeGrid(5, 'A');
    grid[0][1] = BLACK;
    grid[1][0] = BLACK;
    grid[1][1] = BLACK;
    grid[4][3] = BLACK;   // mirror of (0,1)
    grid[3][4] = BLACK;   // mirror of (1,0)
    grid[3][3] = BLACK;   // mirror of (1,1)

    const result = validateGrid(grid);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => /short|span|orphan/i.test(e))
    ).toBe(true);
  });

  // ── 8. Multiple errors reported ───────────────────────────────────────
  it('reports multiple errors when multiple constraints are violated', () => {
    // Asymmetric black cell + creates short span
    const grid = makeGrid(5, 'A');
    grid[0][0] = BLACK; // no mirror at (4,4) → symmetry error
    // (0,1) now has horizontal span starting at col 1 through col 4 = 4, OK.
    // But col 0: row 0 black, row 1-4 white → span 4 in vertical. OK.
    // Let's also break connectivity.
    // Actually the asymmetry alone is enough for one error. Let's also add
    // a short span by placing another asymmetric black cell.
    grid[0][2] = BLACK; // no mirror at (4,2) → another symmetry violation
    // Row 0 now: # A # A A  → (0,1) has horizontal span of 1 → short span!

    const result = validateGrid(grid);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  // ── 9. Larger 13×13 valid grid ────────────────────────────────────────
  it('accepts a valid 13×13 all-white grid', () => {
    const grid = makeGrid(13, 'X');
    const result = validateGrid(grid);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
