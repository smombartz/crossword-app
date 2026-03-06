'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { usePuzzleGenerator } from '@/hooks/use-puzzle-generator';
import { CrosswordGrid } from '@/components/grid/crossword-grid';
import { SkeletonGrid } from '@/components/grid/skeleton-grid';
import { ClueList } from '@/components/clues/clue-list';
import type { Puzzle, Direction, Entry } from '@/engine/types';
import { BLACK } from '@/engine/types';

const SESSION_KEY = 'xword_pending_share';

interface PendingShareData {
  puzzle: Puzzle;
  gridSize: 5 | 7 | 9;
  customWords: string[];
  autoShare: boolean;
}

function savePendingShare(data: PendingShareData): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage unavailable (private browsing, etc.)
  }
}

function loadPendingShare(): PendingShareData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingShareData;
  } catch {
    return null;
  }
}

function clearPendingShare(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export default function CreatorPage() {
  const { generate, validateWord, getClues, ready, error: workerError } = usePuzzleGenerator();
  const { data: session } = useSession();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [gridSize, setGridSize] = useState<5 | 7 | 9>(5);
  const [customWords, setCustomWords] = useState<string[]>(['', '', '']);
  const [wordErrors, setWordErrors] = useState<(string | null)[]>([null, null, null]);
  const [showCustomWords, setShowCustomWords] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const clueCache = useRef<Map<string, string[]>>(new Map());
  const [aiGeneratingKey, setAiGeneratingKey] = useState<string | null>(null);
  const hasRestoredFromSession = useRef(false);
  const pendingShareRef = useRef(false);

  // Restore puzzle from sessionStorage after OAuth redirect
  useEffect(() => {
    const saved = loadPendingShare();
    if (!saved) return;
    hasRestoredFromSession.current = true;
    pendingShareRef.current = saved.autoShare;
    setPuzzle(saved.puzzle);
    setGridSize(saved.gridSize);
    setCustomWords(saved.customWords);
  }, []);

  // Listen for header login button — save puzzle before OAuth redirect
  useEffect(() => {
    const handler = () => {
      if (puzzle) {
        savePendingShare({ puzzle, gridSize, customWords, autoShare: false });
      }
    };
    window.addEventListener('xword:before-sign-in', handler);
    return () => window.removeEventListener('xword:before-sign-in', handler);
  }, [puzzle, gridSize, customWords]);

  const handleSizeChange = (size: 5 | 7 | 9) => {
    if (size === gridSize) {
      handleGenerate();
      return;
    }
    clearPendingShare();
    hasRestoredFromSession.current = false;
    pendingShareRef.current = false;
    setGridSize(size);
    setPuzzle(null);
    setShareUrl(null);
    setWordErrors(prev =>
      prev.map((err, i) => {
        const word = customWords[i];
        if (!word) return null;
        if (word.length > size) return `Too long for ${size}\u00d7${size}`;
        return err === `Too long for ${gridSize}\u00d7${gridSize}` ? null : err;
      })
    );
  };

  const handleWordChange = (index: number, value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z]/g, '');
    const newWords = [...customWords];
    newWords[index] = upper;
    setCustomWords(newWords);
  };

  const handleWordBlur = async (index: number, value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z]/g, '');
    const newWords = [...customWords];
    newWords[index] = upper;
    setCustomWords(newWords);

    const newErrors = [...wordErrors];
    if (upper === '') {
      newErrors[index] = null;
    } else if (upper.length < 3) {
      newErrors[index] = 'Too short (min 3)';
    } else if (upper.length > gridSize) {
      newErrors[index] = `Too long for ${gridSize}\u00d7${gridSize}`;
    } else {
      const valid = await validateWord(upper);
      newErrors[index] = valid ? null : 'Not in word list';
    }
    setWordErrors(newErrors);
  };

  const clearWord = (index: number) => {
    const newWords = [...customWords];
    newWords[index] = '';
    setCustomWords(newWords);
    const newErrors = [...wordErrors];
    newErrors[index] = null;
    setWordErrors(newErrors);
  };

  const handleGenerate = async () => {
    clearPendingShare();
    hasRestoredFromSession.current = false;
    pendingShareRef.current = false;
    setGenerating(true);
    setError(null);
    setShareUrl(null);
    try {
      const validCustomWords = customWords.filter((w, i) => w.length > 0 && !wordErrors[i]);
      const result = await generate({
        size: gridSize,
        customWords: validCustomWords.length > 0 ? validCustomWords : undefined,
      });
      clueCache.current.clear();
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
      savePendingShare({ puzzle, gridSize, customWords, autoShare: true });
      setShowLoginModal(true);
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
      clearPendingShare();
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

  const hasAutoGenerated = useRef(false);
  useEffect(() => {
    if (ready && !hasAutoGenerated.current) {
      hasAutoGenerated.current = true;
      if (!hasRestoredFromSession.current) {
        handleGenerate();
      }
    }
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-generate when grid size changes
  useEffect(() => {
    if (ready && hasAutoGenerated.current) {
      handleGenerate();
    }
  }, [gridSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-trigger share after OAuth return with restored puzzle
  useEffect(() => {
    if (!pendingShareRef.current) return;
    if (!session?.user) return;
    if (!puzzle) return;
    pendingShareRef.current = false;
    handleShare();
  }, [session, puzzle]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClueEdit = useCallback((number: number, direction: Direction, newClue: string) => {
    setPuzzle(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        entries: prev.entries.map(e =>
          e.number === number && e.direction === direction ? { ...e, clue: newClue } : e
        ),
      };
    });
  }, []);

  const handleCellEdit = useCallback((row: number, col: number, letter: string) => {
    setPuzzle(prev => {
      if (!prev) return prev;
      // Update the grid
      const newGrid = prev.grid.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? letter : c)) : r
      );
      // Update answers for entries that pass through this cell
      const newEntries: Entry[] = prev.entries.map(e => {
        const [sr, sc] = e.start;
        let contains = false;
        if (e.direction === 'across') {
          contains = row === sr && col >= sc && col < sc + e.length;
        } else {
          contains = col === sc && row >= sr && row < sr + e.length;
        }
        if (!contains) return { ...e };
        // Rebuild the answer from the new grid
        let answer = '';
        for (let i = 0; i < e.length; i++) {
          const cr = e.direction === 'across' ? sr : sr + i;
          const cc = e.direction === 'across' ? sc + i : sc;
          answer += (cr === row && cc === col) ? letter : newGrid[cr][cc];
        }
        return { ...e, answer };
      });
      // Invalidate clue cache for changed words
      for (const e of newEntries) {
        const orig = prev.entries.find(o => o.number === e.number && o.direction === e.direction);
        if (orig && orig.answer !== e.answer) {
          clueCache.current.delete(orig.answer);
        }
      }
      return { ...prev, grid: newGrid, entries: newEntries };
    });
  }, []);

  const handleClueRefresh = useCallback(async (number: number, direction: Direction) => {
    if (!puzzle) return;
    const entry = puzzle.entries.find(e => e.number === number && e.direction === direction);
    if (!entry?.answer) return;

    const word = entry.answer;
    let clues = clueCache.current.get(word);
    if (!clues) {
      const fetched = await getClues(word);
      clues = [...fetched];
      clueCache.current.set(word, clues);
    }
    if (clues.length === 0) return;

    const currentIndex = clues.indexOf(entry.clue);
    const nextIndex = (currentIndex + 1) % clues.length;
    handleClueEdit(number, direction, clues[nextIndex]);
  }, [puzzle, getClues, handleClueEdit]);

  const handleAiClue = useCallback(async (number: number, direction: Direction) => {
    if (!puzzle || !session?.user) return;
    const entry = puzzle.entries.find(e => e.number === number && e.direction === direction);
    if (!entry?.answer) return;

    const key = `${number}-${direction}`;
    setAiGeneratingKey(key);
    setError(null);

    try {
      // Ensure clue cache is populated from the worker BEFORE adding AI clue
      let cached = clueCache.current.get(entry.answer);
      if (!cached) {
        const fetched = await getClues(entry.answer);
        cached = [...fetched];
        clueCache.current.set(entry.answer, cached);
      }

      const res = await fetch('/api/clues/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: entry.answer,
          existingClues: cached,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate clue');
      }

      const { clue } = await res.json();
      handleClueEdit(number, direction, clue);

      // Append AI clue to the already-populated cache
      if (!cached.includes(clue)) {
        cached.push(clue);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAiGeneratingKey(null);
    }
  }, [puzzle, session, handleClueEdit, getClues]);

  // Derive inline status message
  let statusMessage: string | null = null;
  let statusType: 'success' | 'error' | 'info' = 'info';
  if (workerError) {
    statusMessage = workerError;
    statusType = 'error';
  } else if (error) {
    statusMessage = error;
    statusType = 'error';
  } else if (shareUrl) {
    statusMessage = shareUrl;
    statusType = 'success';
  } else if (puzzle && !generating) {
    statusMessage = 'Crossword generated! Edit words/clues below, or generate AI clues.';
    statusType = 'success';
  } else if (!ready) {
    statusMessage = 'Loading word list...';
    statusType = 'info';
  }

  return (
    <div className="page-stack">
      <div className="toolbar">
        <div className="btn-group">
          <button
            className={`btn ${gridSize === 5 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleSizeChange(5)}
            disabled={generating}
          >
            5×5
          </button>
          <button
            className={`btn ${gridSize === 7 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleSizeChange(7)}
            disabled={generating}
          >
            7×7
          </button>
          <button
            className={`btn ${gridSize === 9 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleSizeChange(9)}
            disabled={generating}
          >
            9×9
          </button>
        </div>

        <button
          className={`btn ${showCustomWords ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowCustomWords(v => !v)}
        >
          Custom Words
        </button>

        <button
          className="btn btn-primary btn-fixed"
          onClick={handleGenerate}
          disabled={!ready || generating}
        >
          {generating ? 'Generating...' : 'Generate Puzzle'}
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleShare}
          disabled={!puzzle || sharing}
        >
          {sharing ? 'Sharing...' : 'Share'}
        </button>

        {statusMessage && (
          <div className={`status ${statusType}`}>
            {shareUrl ? (
              <a className="share-url-text" href={shareUrl} target="_blank" rel="noopener noreferrer">{shareUrl}</a>
            ) : statusMessage}
          </div>
        )}
        {shareUrl && (
          <button className="btn btn-secondary btn-sm" onClick={handleCopyLink}>Copy Link</button>
        )}
      </div>

      {showCustomWords && <div className="card">
        <h3>
          Custom Words <span className="text-hint">Optional</span>
        </h3>
        <div className="custom-words-row">
          {customWords.map((word, i) => (
            <div key={i} className="custom-word-input-wrapper">
                <input
                  className={`input custom-word-input${wordErrors[i] ? ' input-error' : ''}`}
                  type="text"
                  placeholder={`Word ${i + 1}`}
                  value={word}
                  onChange={e => handleWordChange(i, e.target.value)}
                  onBlur={e => handleWordBlur(i, e.target.value)}
                  maxLength={gridSize}
                  disabled={generating}
                />
                {word && (
                  <button
                    className="custom-word-clear"
                    onClick={() => clearWord(i)}
                    tabIndex={-1}
                  >
                    &times;
                  </button>
                )}
              {wordErrors[i] && (
                <div className="custom-word-error">{wordErrors[i]}</div>
              )}
            </div>
          ))}
          <button
            className="btn btn-primary btn-fixed"
            onClick={handleGenerate}
            disabled={!ready || generating}
          >
            {generating ? 'Generating...' : 'Generate Puzzle'}
          </button>
        </div>
      </div>}

      {(generating || (!ready && !puzzle)) && (
        <div className="card crossword-card">
          <div className="crossword-card-grid">
            <h3>Preview</h3>
            <SkeletonGrid gridSize={gridSize} />
          </div>
          <div className="crossword-card-clues">
            <h3>Clues</h3>
            <div className="clue-creator">
              <div className="clue-section">
                <h4>Across</h4>
                {[1, 2, 3].map(n => (
                  <div className="clue-row" key={n}>
                    <input className="input" disabled />
                  </div>
                ))}
              </div>
              <div className="clue-section">
                <h4>Down</h4>
                {[1, 2, 3].map(n => (
                  <div className="clue-row" key={n}>
                    <input className="input" disabled />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {puzzle && !generating && (
        <div className="card crossword-card">
          <div className="crossword-card-grid">
            <h3>
              Preview <span className="text-hint">Click a letter to edit</span>
            </h3>
            <CrosswordGrid grid={puzzle.grid} entries={puzzle.entries} gridSize={puzzle.size} onCellEdit={handleCellEdit} />
          </div>
          <div className="crossword-card-clues">
            <h3>Clues</h3>
            <ClueList entries={puzzle.entries} editable onClueEdit={handleClueEdit} onClueRefresh={handleClueRefresh} onAiClue={handleAiClue} aiGeneratingKey={aiGeneratingKey} />
          </div>
        </div>
      )}

      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowLoginModal(false)}>&times;</button>
            <h3>Sign in to share</h3>
            <p className="text-body text-muted">You need to be signed in with Google to share your crossword puzzle. Your puzzle will be saved and shared automatically after signing in.</p>
            <button
              className="gsi-material-button"
              onClick={() => signIn('google')}
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">Sign in with Google</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
