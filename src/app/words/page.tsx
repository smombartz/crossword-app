'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, useRef } from 'react';

interface ClueDetail {
  clue: string;
  source: string;
  createdAt: string;
}

interface WordEntry {
  word: string;
  length: number;
  clueCount: number;
  clues: ClueDetail[];
}

interface ApiResponse {
  words: WordEntry[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export default function WordsPage() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [length, setLength] = useState('');
  const [minClues, setMinClues] = useState('');
  const [maxClues, setMaxClues] = useState('');
  const [page, setPage] = useState(1);

  // Data
  const [words, setWords] = useState<WordEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Expand state
  const [expandedWords, setExpandedWords] = useState<Set<string>>(new Set());

  // Add word form
  const [newWord, setNewWord] = useState('');
  const [newClue, setNewClue] = useState('');
  const [addStatus, setAddStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Inline add clue
  const [addClueWord, setAddClueWord] = useState<string | null>(null);
  const [inlineClue, setInlineClue] = useState('');
  const [inlineLoading, setInlineLoading] = useState(false);

  // Debounce
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const limit = 50;

  const fetchWords = useCallback(async () => {
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (length) params.set('length', length);
    if (minClues) params.set('minClues', minClues);
    if (maxClues) params.set('maxClues', maxClues);
    params.set('page', String(page));
    params.set('limit', String(limit));

    try {
      const res = await fetch(`/api/words?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(data.error || 'Request failed');
      }
      const data: ApiResponse = await res.json();
      setWords(data.words);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load words');
    } finally {
      setLoading(false);
    }
  }, [search, length, minClues, maxClues, page]);

  useEffect(() => {
    fetchWords();
  }, [fetchWords]);

  // Debounced search — update input immediately, delay API query
  const handleSearchChange = (value: string) => {
    const cleaned = value.replace(/[^a-zA-Z]/g, '').toUpperCase();
    setSearchInput(cleaned);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(cleaned);
    }, 300);
  };

  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const toggleExpand = (word: string) => {
    setExpandedWords(prev => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  };

  // Add word
  const handleAddWord = async () => {
    const word = newWord.replace(/[^a-zA-Z]/g, '').toUpperCase();
    const clue = newClue.trim();

    if (!word || word.length < 3) {
      setAddStatus({ type: 'error', message: 'Word must be at least 3 letters' });
      return;
    }
    if (!clue) {
      setAddStatus({ type: 'error', message: 'Clue is required' });
      return;
    }

    setAddLoading(true);
    setAddStatus(null);

    try {
      const res = await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, clue }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add word');
      }

      setAddStatus({ type: 'success', message: `Added "${word}" with clue` });
      setNewWord('');
      setNewClue('');
      fetchWords();
    } catch (err) {
      setAddStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to add' });
    } finally {
      setAddLoading(false);
    }
  };

  // Inline add clue
  const handleInlineAddClue = async (word: string) => {
    const clue = inlineClue.trim();
    if (!clue) return;

    setInlineLoading(true);

    try {
      const res = await fetch('/api/words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, clue }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add clue');
      }

      setAddClueWord(null);
      setInlineClue('');
      // Expand to show the new clue
      setExpandedWords(prev => new Set(prev).add(word));
      fetchWords();
    } catch (err) {
      setAddStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to add clue' });
    } finally {
      setInlineLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="page-stack">
      <h2>Word List</h2>

      {/* Filters */}
      <div className="card">
        <div className="words-filters">
          <div className="filter-group" style={{ flex: 1 }}>
            <label htmlFor="word-search">Search</label>
            <input
              id="word-search"
              className="input"
              type="text"
              placeholder="Search words..."
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="word-length">Length</label>
            <select
              id="word-length"
              className="input"
              value={length}
              onChange={e => handleFilterChange(setLength)(e.target.value)}
            >
              <option value="">All</option>
              {Array.from({ length: 13 }, (_, i) => i + 3).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="min-clues">Min clues</label>
            <input
              id="min-clues"
              className="input"
              type="number"
              min="0"
              style={{ width: 70 }}
              placeholder="—"
              value={minClues}
              onChange={e => handleFilterChange(setMinClues)(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label htmlFor="max-clues">Max clues</label>
            <input
              id="max-clues"
              className="input"
              type="number"
              min="0"
              style={{ width: 70 }}
              placeholder="—"
              value={maxClues}
              onChange={e => handleFilterChange(setMaxClues)(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Add Word (logged in only) */}
      {isLoggedIn && (
        <div className="card">
          <h3>Add Word</h3>
          <div className="add-word-form">
            <div className="filter-group">
              <label htmlFor="new-word">Word</label>
              <input
                id="new-word"
                className="input word-input"
                type="text"
                placeholder="WORD"
                value={newWord}
                onChange={e => setNewWord(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
              />
            </div>
            <div className="filter-group" style={{ flex: 1 }}>
              <label htmlFor="new-clue">Clue</label>
              <input
                id="new-clue"
                className="input clue-input"
                type="text"
                placeholder="Enter a clue..."
                value={newClue}
                onChange={e => setNewClue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddWord(); }}
              />
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleAddWord}
              disabled={addLoading}
            >
              {addLoading ? 'Adding...' : 'Add'}
            </button>
          </div>
          {addStatus && (
            <p className={`status ${addStatus.type === 'success' ? 'text-body' : 'text-muted'}`} style={{ marginTop: 8, color: addStatus.type === 'success' ? '#2e7d32' : '#c62828' }}>
              {addStatus.message}
            </p>
          )}
        </div>
      )}

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="words-empty">Loading...</div>
        ) : error ? (
          <div className="words-empty" style={{ color: '#c62828' }}>{error}</div>
        ) : words.length === 0 ? (
          <div className="words-empty">No words found matching your filters.</div>
        ) : (
          <>
            <div className="words-table-wrap">
              <table className="words-table">
                <thead>
                  <tr>
                    <th>Word</th>
                    <th className="length-cell">Len</th>
                    <th>Clues</th>
                    <th className="clue-count-cell">#</th>
                    {isLoggedIn && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {words.map(entry => {
                    const isExpanded = expandedWords.has(entry.word);
                    const isAddingClue = addClueWord === entry.word;
                    const firstClue = entry.clues[0];

                    return (
                      <tr key={entry.word}>
                        <td className="word-cell">{entry.word}</td>
                        <td className="length-cell">{entry.length}</td>
                        <td>
                          {firstClue && (
                            <span className="clue-preview">{firstClue.clue}</span>
                          )}
                          {entry.clueCount > 1 && !isExpanded && (
                            <>
                              {' '}
                              <button
                                className="clue-expand-toggle"
                                onClick={() => toggleExpand(entry.word)}
                              >
                                +{entry.clueCount - 1} more
                              </button>
                            </>
                          )}
                          {isExpanded && (
                            <>
                              <ul className="clue-detail-list">
                                {entry.clues.map((c, i) => (
                                  <li key={i}>
                                    {c.clue}
                                    <span className="clue-source">{c.source}</span>
                                  </li>
                                ))}
                              </ul>
                              <button
                                className="clue-expand-toggle"
                                onClick={() => toggleExpand(entry.word)}
                              >
                                Collapse
                              </button>
                            </>
                          )}
                          {isAddingClue && (
                            <div className="add-clue-row">
                              <input
                                className="input"
                                type="text"
                                placeholder="New clue..."
                                value={inlineClue}
                                onChange={e => setInlineClue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleInlineAddClue(entry.word);
                                  if (e.key === 'Escape') { setAddClueWord(null); setInlineClue(''); }
                                }}
                                autoFocus
                                disabled={inlineLoading}
                              />
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleInlineAddClue(entry.word)}
                                disabled={inlineLoading}
                              >
                                Save
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => { setAddClueWord(null); setInlineClue(''); }}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="clue-count-cell">{entry.clueCount}</td>
                        {isLoggedIn && (
                          <td>
                            {!isAddingClue && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setAddClueWord(entry.word);
                                  setInlineClue('');
                                  setExpandedWords(prev => new Set(prev).add(entry.word));
                                }}
                              >
                                + Clue
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="words-pagination">
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </button>
              <span className="page-info">
                Page {page} of {totalPages} ({total.toLocaleString()} words)
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={!hasMore}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
