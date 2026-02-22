'use client';

import { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { usePuzzleGenerator } from '@/hooks/use-puzzle-generator';
import { CrosswordGrid } from '@/components/grid/crossword-grid';
import { ClueList } from '@/components/clues/clue-list';
import type { Puzzle } from '@/engine/types';

export default function CreatorPage() {
  const { generate, ready, error: workerError } = usePuzzleGenerator();
  const { data: session } = useSession();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [gridSize, setGridSize] = useState<7 | 13>(13);

  const handleSizeChange = (size: 7 | 13) => {
    setGridSize(size);
    setPuzzle(null);
    setShareUrl(null);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setShareUrl(null);
    try {
      const result = await generate({ size: gridSize });
      setPuzzle(result);
    } catch (err) {
      setError((err as Error).message || "Couldn't generate a puzzle. Try again!");
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!puzzle) return;

    if (!session?.user) {
      signIn('google');
      return;
    }

    setSharing(true);
    try {
      const res = await fetch('/api/puzzles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grid: puzzle.grid,
          entries: puzzle.entries,
          size: puzzle.size,
        }),
      });

      if (!res.ok) throw new Error('Failed to share puzzle');

      const data = await res.json();
      setShareUrl(data.shareUrl);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
    }
  };

  return (
    <div>
      {!ready && (
        <div className="status info">Loading word list...</div>
      )}
      {workerError && (
        <div className="status error">{workerError}</div>
      )}

      <div className="btn-row" style={{ marginBottom: 24 }}>
        <div className="btn-group">
          <span className="btn-group-label" style={{ marginRight: 8 }}>Size</span>
          <button
            className={`btn ${gridSize === 7 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleSizeChange(7)}
            disabled={generating}
          >
            7×7
          </button>
          <button
            className={`btn ${gridSize === 13 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleSizeChange(13)}
            disabled={generating}
          >
            13×13
          </button>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={!ready || generating}
        >
          {generating ? 'Generating...' : 'Generate Crossword'}
        </button>

        <button
          className="btn btn-export"
          onClick={handleShare}
          disabled={!puzzle || sharing}
        >
          {sharing ? 'Sharing...' : 'Share'}
        </button>
      </div>

      {error && (
        <div className="status error">{error}</div>
      )}

      {shareUrl && (
        <div className="status success" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ flex: 1, wordBreak: 'break-all' }}>{shareUrl}</span>
          <button className="btn btn-secondary" onClick={handleCopyLink} style={{ flexShrink: 0 }}>
            Copy Link
          </button>
        </div>
      )}

      {puzzle && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <CrosswordGrid grid={puzzle.grid} entries={puzzle.entries} gridSize={puzzle.size} />
          </div>
          <ClueList entries={puzzle.entries} />
        </div>
      )}
    </div>
  );
}
