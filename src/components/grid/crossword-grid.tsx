'use client';

import { memo, useRef } from 'react';
import { BLACK } from '@/engine/types';
import type { Entry } from '@/engine/types';

interface CellProps {
  letter: string;
  isBlack: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  number: number | null;
  onClick?: () => void;
}

const Cell = memo(function Cell({
  letter,
  isBlack,
  isSelected,
  isHighlighted,
  number,
  onClick,
}: CellProps) {
  const classes = [
    'grid-cell',
    isBlack && 'black',
    isSelected && 'active',
    isHighlighted && !isSelected && 'highlight',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} onClick={isBlack ? undefined : onClick}>
      {number && <span className="cell-number">{number}</span>}
      {!isBlack && letter}
    </div>
  );
});

interface CrosswordGridProps {
  grid: readonly (readonly string[])[];
  entries: readonly Entry[];
  activeCell?: { row: number; col: number } | null;
  highlightedCells?: Set<string>; // "row,col" format
  onCellClick?: (row: number, col: number) => void;
  /** When provided, display playerGrid values for white cells instead of grid values. */
  playerGrid?: readonly (readonly string[])[];
  /** Keyboard event handler for interactive (player) mode. */
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function CrosswordGrid({
  grid,
  entries,
  activeCell,
  highlightedCells,
  onCellClick,
  playerGrid,
  onKeyDown,
}: CrosswordGridProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Build a map of cell numbers from entries
  const numberMap = new Map<string, number>();
  for (const entry of entries) {
    const key = `${entry.start[0]},${entry.start[1]}`;
    if (!numberMap.has(key)) {
      numberMap.set(key, entry.number);
    }
  }

  const handleCellClick = (r: number, c: number): void => {
    onCellClick?.(r, c);
    if (playerGrid) {
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="grid-container"
      style={{ position: 'relative' }}
      tabIndex={playerGrid ? 0 : undefined}
      onKeyDown={!playerGrid ? onKeyDown : undefined}
    >
      {grid.map((row, r) => (
        <div className="grid-row" key={r}>
          {row.map((cell, c) => {
            const key = `${r},${c}`;
            const isBlack = cell === BLACK;
            const displayLetter = isBlack
              ? ''
              : playerGrid
                ? playerGrid[r][c]
                : cell;
            return (
              <Cell
                key={key}
                letter={displayLetter}
                isBlack={isBlack}
                isSelected={activeCell?.row === r && activeCell?.col === c}
                isHighlighted={highlightedCells?.has(key) ?? false}
                number={numberMap.get(key) ?? null}
                onClick={
                  onCellClick ? () => handleCellClick(r, c) : undefined
                }
              />
            );
          })}
        </div>
      ))}
      {playerGrid && (
        <input
          ref={inputRef}
          style={{
            position: 'absolute',
            opacity: 0,
            width: 0,
            height: 0,
            pointerEvents: 'none',
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
        />
      )}
    </div>
  );
}
