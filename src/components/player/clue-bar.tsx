'use client';

import type { PlayerEntry } from '@/engine/types';

interface ClueBarProps {
  activeEntry: PlayerEntry | null;
}

export function ClueBar({ activeEntry }: ClueBarProps) {
  if (!activeEntry) return null;

  return (
    <div className="clue-bar">
      <strong>{activeEntry.number} {activeEntry.direction === 'across' ? 'Across' : 'Down'}</strong>
      {' — '}
      {activeEntry.clue}
    </div>
  );
}
