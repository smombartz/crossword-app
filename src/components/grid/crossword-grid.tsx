'use client';

import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { BLACK } from '@/engine/types';
import type { Entry } from '@/engine/types';

interface CellProps {
  letter: string;
  isBlack: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  isEditing: boolean;
  isEditable: boolean;
  number: number | null;
  onClick?: () => void;
  onEditCommit?: (letter: string) => void;
}

const Cell = memo(function Cell({
  letter,
  isBlack,
  isSelected,
  isHighlighted,
  isEditing,
  isEditable,
  number,
  onClick,
  onEditCommit,
}: CellProps) {
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    if (!editRef.current) return;
    const val = editRef.current.value.toUpperCase().replace(/[^A-Z]/g, '');
    onEditCommit?.(val.length === 1 ? val : letter);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      editRef.current?.blur();
    } else if (e.key === 'Escape') {
      onEditCommit?.(letter);
    }
  };

  const classes = [
    'grid-cell',
    isBlack && 'black',
    isSelected && 'active',
    isHighlighted && !isSelected && 'highlight',
    isEditable && !isBlack && 'word-edit-cell',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} onClick={isBlack ? undefined : onClick}>
      {number && <span className="cell-number">{number}</span>}
      {isEditing ? (
        <input
          ref={editRef}
          type="text"
          maxLength={1}
          defaultValue={letter}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : (
        !isBlack && letter
      )}
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
  /** Grid size (e.g. 7 or 9) — used for size-specific styling. */
  gridSize?: number;
  /** Callback for editing a cell letter in creator mode. */
  onCellEdit?: (row: number, col: number, letter: string) => void;
}

export function CrosswordGrid({
  grid,
  entries,
  activeCell,
  highlightedCells,
  onCellClick,
  playerGrid,
  onKeyDown,
  gridSize,
  onCellEdit,
}: CrosswordGridProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);

  const handleCellClick = (r: number, c: number): void => {
    onCellClick?.(r, c);
    if (onCellEdit) {
      setEditingCell(`${r},${c}`);
    }
    if (playerGrid) {
      inputRef.current?.focus();
    }
  };

  const handleEditCommit = useCallback((r: number, c: number, letter: string) => {
    setEditingCell(null);
    if (letter !== grid[r][c]) {
      onCellEdit?.(r, c, letter);
    }
  }, [grid, onCellEdit]);

  // Build a map of cell numbers from entries
  const numberMap = new Map<string, number>();
  for (const entry of entries) {
    const key = `${entry.start[0]},${entry.start[1]}`;
    if (!numberMap.has(key)) {
      numberMap.set(key, entry.number);
    }
  }

  return (
    <div
      className={`grid-container${gridSize ? ` grid-size-${gridSize}` : ''}`}
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
                isEditing={editingCell === key}
                isEditable={!!onCellEdit}
                number={numberMap.get(key) ?? null}
                onClick={
                  onCellClick || onCellEdit ? () => handleCellClick(r, c) : undefined
                }
                onEditCommit={onCellEdit ? (letter) => handleEditCommit(r, c, letter) : undefined}
              />
            );
          })}
        </div>
      ))}
      {playerGrid && (
        <input
          ref={inputRef}
          className="sr-only"
          onKeyDown={onKeyDown}
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
        />
      )}
    </div>
  );
}
