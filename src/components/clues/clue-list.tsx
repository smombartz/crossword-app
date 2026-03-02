'use client';

import { useState, useEffect } from 'react';
import type { Direction } from '@/engine/types';

interface ClueEntry {
  number: number;
  direction: Direction;
  clue: string;
  answer?: string;
}

interface ClueListProps {
  entries: readonly ClueEntry[];
  activeNumber?: number | null;
  activeDirection?: Direction | null;
  onClueClick?: (entry: ClueEntry) => void;
  editable?: boolean;
  onClueEdit?: (number: number, direction: Direction, newClue: string) => void;
  onClueRefresh?: (number: number, direction: Direction) => void;
}

function CreatorClueRow({
  entry,
  onClueEdit,
  onClueRefresh,
}: {
  entry: ClueEntry;
  onClueEdit?: (number: number, direction: Direction, newClue: string) => void;
  onClueRefresh?: (number: number, direction: Direction) => void;
}) {
  const [draft, setDraft] = useState(entry.clue);

  useEffect(() => {
    setDraft(entry.clue);
  }, [entry.clue]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== entry.clue) {
      onClueEdit?.(entry.number, entry.direction, trimmed);
    } else {
      setDraft(entry.clue);
    }
  };

  return (
    <div className="clue-row">
      <span className="clue-num">{entry.number}.</span>
      {entry.answer && <span className="clue-word">{entry.answer}</span>}
      <input
        className="input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); }}
        onBlur={commit}
      />
      <button
        className="btn-icon clue-refresh"
        onClick={() => onClueRefresh?.(entry.number, entry.direction)}
        title="Next clue"
      >
        ↻
      </button>
    </div>
  );
}

export function ClueList({ entries, activeNumber, activeDirection, onClueClick, editable, onClueEdit, onClueRefresh }: ClueListProps) {
  const across = entries.filter(e => e.direction === 'across');
  const down = entries.filter(e => e.direction === 'down');

  if (editable) {
    return (
      <div className="clue-creator">
        <div className="clue-section">
          <h4>Across</h4>
          {across.map(entry => (
            <CreatorClueRow key={`${entry.number}a`} entry={entry} onClueEdit={onClueEdit} onClueRefresh={onClueRefresh} />
          ))}
        </div>
        <div className="clue-section">
          <h4>Down</h4>
          {down.map(entry => (
            <CreatorClueRow key={`${entry.number}d`} entry={entry} onClueEdit={onClueEdit} onClueRefresh={onClueRefresh} />
          ))}
        </div>
      </div>
    );
  }

  // Player (read-only) layout — two columns
  const renderItem = (entry: ClueEntry, keySuffix: string) => {
    const isActive = activeNumber === entry.number && activeDirection === entry.direction;
    return (
      <div
        key={`${entry.number}${keySuffix}`}
        className={`clue-item${isActive ? ' active-clue' : ''}`}
        onClick={() => onClueClick?.(entry)}
      >
        <span className="cn">{entry.number}</span>
        {entry.clue}
      </div>
    );
  };

  return (
    <div className="clue-columns">
      <div className="clue-column">
        <h4>Across</h4>
        {across.map(entry => renderItem(entry, 'a'))}
      </div>
      <div className="clue-column">
        <h4>Down</h4>
        {down.map(entry => renderItem(entry, 'd'))}
      </div>
    </div>
  );
}
