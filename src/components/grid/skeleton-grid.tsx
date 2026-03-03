'use client';

import { useMemo } from 'react';

interface SkeletonGridProps {
  gridSize: number;
}

export function SkeletonGrid({ gridSize }: SkeletonGridProps) {
  // Generate stable random delays per gridSize so they don't reshuffle every render
  const delays = useMemo(() => {
    const cells: number[] = [];
    for (let i = 0; i < gridSize * gridSize; i++) {
      cells.push(Math.random() * 3); // 0–3s delay across the 3s animation
    }
    return cells;
  }, [gridSize]);

  return (
    <div className={`grid-container grid-size-${gridSize}`}>
      {Array.from({ length: gridSize }, (_, r) => (
        <div className="grid-row" key={r}>
          {Array.from({ length: gridSize }, (_, c) => (
            <div
              key={`${r},${c}`}
              className="grid-cell skeleton-cell"
              style={{ animationDelay: `${delays[r * gridSize + c].toFixed(2)}s` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
