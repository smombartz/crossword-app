'use client';

import type { PlayerEntry } from '@/engine/types';

interface ClueBarProps {
  activeEntry: PlayerEntry | null;
}

export function ClueBar({ activeEntry }: ClueBarProps) {
  if (!activeEntry) return null;

  return (
    <div className="text-body" style={{ padding: '8px 0', fontWeight: 500 }}>
      <strong>{activeEntry.number} {activeEntry.direction === 'across' ? 'Across' : 'Down'}</strong>
      {' — '}
      {activeEntry.clue}
    </div>
  );
}
