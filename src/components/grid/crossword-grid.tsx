'use client';

import { memo } from 'react';
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
}

export function CrosswordGrid({
  grid,
  entries,
  activeCell,
  highlightedCells,
  onCellClick,
}: CrosswordGridProps) {
  // Build a map of cell numbers from entries
  const numberMap = new Map<string, number>();
  for (const entry of entries) {
    const key = `${entry.start[0]},${entry.start[1]}`;
    if (!numberMap.has(key)) {
      numberMap.set(key, entry.number);
    }
  }

  return (
    <div className="grid-container">
      {grid.map((row, r) => (
        <div className="grid-row" key={r}>
          {row.map((cell, c) => {
            const key = `${r},${c}`;
            return (
              <Cell
                key={key}
                letter={cell === BLACK ? '' : cell}
                isBlack={cell === BLACK}
                isSelected={activeCell?.row === r && activeCell?.col === c}
                isHighlighted={highlightedCells?.has(key) ?? false}
                number={numberMap.get(key) ?? null}
                onClick={onCellClick ? () => onCellClick(r, c) : undefined}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
