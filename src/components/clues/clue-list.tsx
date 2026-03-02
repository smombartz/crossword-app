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
  onAiClue?: (number: number, direction: Direction) => void;
  aiGeneratingKey?: string | null;
}

function CreatorClueRow({
  entry,
  onClueEdit,
  onClueRefresh,
  onAiClue,
  isAiGenerating,
}: {
  entry: ClueEntry;
  onClueEdit?: (number: number, direction: Direction, newClue: string) => void;
  onClueRefresh?: (number: number, direction: Direction) => void;
  onAiClue?: (number: number, direction: Direction) => void;
  isAiGenerating?: boolean;
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
      <button
        className="btn-icon clue-sparkle"
        onClick={() => onAiClue?.(entry.number, entry.direction)}
        disabled={isAiGenerating}
        title="Generate AI clue"
      >
        {isAiGenerating ? (
          <span className="spinner-dot">···</span>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0L9.2 5.8L14 3.5L10.2 7.4L16 8L10.2 8.6L14 12.5L9.2 10.2L8 16L6.8 10.2L2 12.5L5.8 8.6L0 8L5.8 7.4L2 3.5L6.8 5.8Z" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function ClueList({ entries, activeNumber, activeDirection, onClueClick, editable, onClueEdit, onClueRefresh, onAiClue, aiGeneratingKey }: ClueListProps) {
  const across = entries.filter(e => e.direction === 'across');
  const down = entries.filter(e => e.direction === 'down');

  if (editable) {
    return (
      <div className="clue-creator">
        <div className="clue-section">
          <h4>Across</h4>
          {across.map(entry => (
            <CreatorClueRow key={`${entry.number}a`} entry={entry} onClueEdit={onClueEdit} onClueRefresh={onClueRefresh} onAiClue={onAiClue} isAiGenerating={aiGeneratingKey === `${entry.number}-across`} />
          ))}
        </div>
        <div className="clue-section">
          <h4>Down</h4>
          {down.map(entry => (
            <CreatorClueRow key={`${entry.number}d`} entry={entry} onClueEdit={onClueEdit} onClueRefresh={onClueRefresh} onAiClue={onAiClue} isAiGenerating={aiGeneratingKey === `${entry.number}-down`} />
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
