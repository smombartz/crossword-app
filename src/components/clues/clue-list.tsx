'use client';

import type { Direction } from '@/engine/types';

interface ClueEntry {
  number: number;
  direction: Direction;
  clue: string;
}

interface ClueListProps {
  entries: readonly ClueEntry[];
  activeNumber?: number | null;
  activeDirection?: Direction | null;
  onClueClick?: (entry: ClueEntry) => void;
}

export function ClueList({ entries, activeNumber, activeDirection, onClueClick }: ClueListProps) {
  const across = entries.filter(e => e.direction === 'across');
  const down = entries.filter(e => e.direction === 'down');

  return (
    <div className="clue-columns">
      <div className="clue-column">
        <h4>Across</h4>
        {across.map(entry => (
          <div
            key={`${entry.number}a`}
            className={`clue-item${activeNumber === entry.number && activeDirection === 'across' ? ' active-clue' : ''}`}
            onClick={() => onClueClick?.(entry)}
          >
            <span className="cn">{entry.number}</span>
            {entry.clue}
          </div>
        ))}
      </div>
      <div className="clue-column">
        <h4>Down</h4>
        {down.map(entry => (
          <div
            key={`${entry.number}d`}
            className={`clue-item${activeNumber === entry.number && activeDirection === 'down' ? ' active-clue' : ''}`}
            onClick={() => onClueClick?.(entry)}
          >
            <span className="cn">{entry.number}</span>
            {entry.clue}
          </div>
        ))}
      </div>
    </div>
  );
}
