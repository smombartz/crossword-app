'use client';

import { useReducer, useRef, useState, useEffect, useCallback } from 'react';
import type { PlayerPuzzle, PlayerEntry, Entry } from '@/engine/types';
import { BLACK } from '@/engine/types';
import { validateSolution } from '@/engine/solution';
import {
  initPuzzleState,
  puzzleReducer,
  isComplete,
  getActiveEntry,
  getHighlightedCells,
} from '@/state/puzzle-state';
import { useTimer } from '@/state/timer';
import { CrosswordGrid } from '@/components/grid/crossword-grid';
import { ClueBar } from '@/components/player/clue-bar';
import { ClueList } from '@/components/clues/clue-list';
import { CompletionOverlay } from '@/components/player/completion-overlay';

interface PlayerClientProps {
  puzzle: PlayerPuzzle;
}

export function PlayerClient({ puzzle }: PlayerClientProps) {
  const [state, dispatch] = useReducer(puzzleReducer, puzzle, initPuzzleState);
  const [solved, setSolved] = useState(false);
  const timerStarted = useRef(false);
  const timer = useTimer();

  // Build base grid from pattern: black cells get BLACK, white cells get ''
  const baseGrid = puzzle.pattern.map((row) =>
    row.map((cell) => (cell === 1 ? '' : BLACK))
  );

  // Active entry and highlighted cells for the current cursor position
  const activeEntry = getActiveEntry(state);
  const highlightedCells = getHighlightedCells(state);

  // Check completion after every state change
  useEffect(() => {
    if (solved) return;
    if (isComplete(state)) {
      const valid = validateSolution(
        state.playerGrid,
        puzzle.solutionHash,
        puzzle.id
      );
      if (valid) {
        setSolved(true);
      }
    }
  }, [state, solved, puzzle]);

  // Keyboard handler: translates KeyboardEvent into PuzzleAction dispatches
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (solved) return;

      // Start the timer on first interaction
      if (!timerStarted.current) {
        timer.start();
        timerStarted.current = true;
      }

      if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        dispatch({ type: 'TYPE_LETTER', letter: e.key });
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        dispatch({ type: 'BACKSPACE' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        dispatch({ type: 'ARROW', arrow: 'up' });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        dispatch({ type: 'ARROW', arrow: 'down' });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        dispatch({ type: 'ARROW', arrow: 'left' });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        dispatch({ type: 'ARROW', arrow: 'right' });
      } else if (e.key === 'Tab') {
        e.preventDefault();
        dispatch({ type: 'TAB', shift: e.shiftKey });
      }
    },
    [solved, timer]
  );

  // Cell click handler
  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (solved) return;

      // Start timer on first click too
      if (!timerStarted.current) {
        timer.start();
        timerStarted.current = true;
      }

      dispatch({ type: 'SELECT_CELL', row, col });
    },
    [solved, timer]
  );

  // Clue click handler
  const handleClueClick = useCallback(
    (entry: { number: number; direction: string; clue: string }) => {
      if (solved) return;

      // Find the matching PlayerEntry from the puzzle
      const playerEntry = puzzle.entries.find(
        (e) =>
          e.number === entry.number && e.direction === entry.direction
      );
      if (playerEntry) {
        dispatch({ type: 'SELECT_CLUE', entry: playerEntry });
      }
    },
    [solved, puzzle.entries]
  );

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div>
      {/* Header bar: puzzle info + timer */}
      <div className="flex-between player-header">
        <div>
          
        </div>
        <div className="text-body countdown timer">
          {timer.formatted}
        </div>
      </div>

      {/* Active clue bar */}
      <ClueBar activeEntry={activeEntry} />

      {/* Interactive crossword grid */}
      <div className="player-grid">
        <CrosswordGrid
          grid={baseGrid}
          entries={puzzle.entries as unknown as readonly Entry[]}
          activeCell={solved ? null : state.cursor}
          highlightedCells={solved ? undefined : highlightedCells}
          onCellClick={handleCellClick}
          playerGrid={state.playerGrid}
          onKeyDown={handleKeyDown}
          gridSize={puzzle.size}
        />
      </div>

      {/* Clue list */}
      <div className="player-clues">
        <ClueList
          entries={puzzle.entries}
          activeNumber={activeEntry?.number ?? null}
          activeDirection={activeEntry?.direction ?? null}
          onClueClick={handleClueClick}
        />
      </div>

      {/* Completion overlay with confetti */}
      {solved && (
        <CompletionOverlay
          time={timer.formatted}
          creatorName={puzzle.creatorName ?? 'Anonymous'}
          shareUrl={shareUrl}
        />
      )}
    </div>
  );
}
