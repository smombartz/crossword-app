'use client';

import { useState, useEffect, useRef } from 'react';
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
  editable?: boolean;
  onClueEdit?: (number: number, direction: Direction, newClue: string) => void;
}

function EditableClueItem({
  entry,
  isActive,
  onClueClick,
  onClueEdit,
}: {
  entry: ClueEntry;
  isActive: boolean;
  onClueClick?: (entry: ClueEntry) => void;
  onClueEdit?: (number: number, direction: Direction, newClue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.clue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(entry.clue);
    setEditing(false);
  }, [entry.clue]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== entry.clue) {
      onClueEdit?.(entry.number, entry.direction, trimmed);
    } else {
      setDraft(entry.clue);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(entry.clue);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={`clue-item${isActive ? ' active-clue' : ''} clue-item-editable`}>
        <span className="cn">{entry.number}</span>
        <input
          ref={inputRef}
          className="clue-edit-input"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          onBlur={commit}
        />
      </div>
    );
  }

  return (
    <div
      className={`clue-item${isActive ? ' active-clue' : ''} clue-item-editable`}
      onClick={() => onClueClick?.(entry)}
    >
      <span className="cn">{entry.number}</span>
      <span style={{ flex: 1 }}>{entry.clue}</span>
      <span
        className="clue-edit-icon"
        onClick={e => {
          e.stopPropagation();
          setEditing(true);
        }}
        title="Edit clue"
      >
        &#9998;
      </span>
    </div>
  );
}

export function ClueList({ entries, activeNumber, activeDirection, onClueClick, editable, onClueEdit }: ClueListProps) {
  const across = entries.filter(e => e.direction === 'across');
  const down = entries.filter(e => e.direction === 'down');

  const renderItem = (entry: ClueEntry, keySuffix: string) => {
    const isActive = activeNumber === entry.number && activeDirection === entry.direction;

    if (editable) {
      return (
        <EditableClueItem
          key={`${entry.number}${keySuffix}`}
          entry={entry}
          isActive={isActive}
          onClueClick={onClueClick}
          onClueEdit={onClueEdit}
        />
      );
    }

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
