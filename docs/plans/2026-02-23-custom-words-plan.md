# Custom Words Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to input up to 4 custom words that are seeded into the puzzle during generation.

**Architecture:** Custom words are validated upfront (exists in word list, fits grid size), passed through GenerateOptions to the filler, which places them in compatible slots before the backtracker fills the rest. A new `validate-word` worker message supports real-time validation in the UI.

**Tech Stack:** Engine (pure TS), Web Worker messaging, React state on the creator page.

**Design doc:** `docs/plans/2026-02-23-custom-words-design.md`

---

### Task 1: Add `hasWord` to WordList interface

**Files:**
- Modify: `src/engine/wordlist.ts:6-10,29-52`
- Test: `tests/engine/wordlist.test.ts`

**Step 1: Add `hasWord` to the WordList interface**

In `src/engine/wordlist.ts`, add to the `WordList` interface (after line 9):

```typescript
hasWord(word: string): boolean;
```

**Step 2: Implement `hasWord` in `loadWordList`**

In the return object (after the `wordsMatchingPattern` method, before the closing `};`):

```typescript
    hasWord(word: string): boolean {
      const upper = word.toUpperCase();
      return clueMap.has(upper);
    },
```

**Step 3: Run tests**

Run: `pnpm test:engine`
Expected: All 99 tests pass (no behavior change)

**Step 4: Commit**

```bash
git add src/engine/wordlist.ts
git commit -m "feat(engine): add hasWord method to WordList interface"
```

---

### Task 2: Add `customWords` to GenerateOptions and seed in filler

**Files:**
- Modify: `src/engine/types.ts:35-44`
- Modify: `src/engine/filler.ts:154-239`
- Modify: `src/engine/generator.ts:24-29`
- Test: `tests/engine/filler.test.ts`

**Step 1: Add `customWords` to GenerateOptions**

In `src/engine/types.ts`, add after line 43 (before the closing `}`):

```typescript
  readonly customWords?: readonly string[]; // up to 4 words to seed into the grid
```

**Step 2: Add custom word seeding to `fillGrid`**

In `src/engine/filler.ts`, update the `fillGrid` signature to accept `customWords`:

```typescript
export function fillGrid(
  pattern: readonly (readonly string[])[],
  wordList: WordList,
  maxCandidates: number = DEFAULT_MAX_CANDIDATES,
  customWords?: readonly string[],
): string[][] | null {
```

After the line `const usedWords = new Set<string>();` (line 177), add the seeding logic:

```typescript
  // Seed custom words into compatible slots before backtracking
  if (customWords && customWords.length > 0) {
    const remainingCustom = [...customWords];
    // Shuffle slot order for variety when placing custom words
    const slotIndices = allSlots.map((_, i) => i);
    for (let i = slotIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slotIndices[i], slotIndices[j]] = [slotIndices[j], slotIndices[i]];
    }

    for (const word of remainingCustom) {
      let placed = false;
      for (const idx of slotIndices) {
        if (filled.has(idx)) continue;
        const slot = allSlots[idx];
        if (slot.length !== word.length) continue;

        // Check letter constraints — does this word fit with already-placed letters?
        const constraints = getConstraints(grid, slot);
        const fits = Array.from(constraints.entries()).every(
          ([pos, letter]) => word[pos] === letter,
        );
        if (!fits) continue;

        placeWord(grid, slot, word);
        usedWords.add(word);
        filled.add(idx);
        placed = true;
        break;
      }
      if (!placed) return null; // Custom word couldn't fit — caller should retry
    }
  }
```

**Step 3: Pass customWords through from generatePuzzle**

In `src/engine/generator.ts`, update the `fillGrid` call (line 29):

```typescript
      const filled = fillGrid(pattern, wordList, options?.maxCandidates, options?.customWords);
```

**Step 4: Write tests for custom word seeding**

Add to `tests/engine/filler.test.ts`:

```typescript
  it('places custom words in the grid', () => {
    const wl = loadWordList(testData);
    const pattern = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ];
    const result = fillGrid(pattern, wl, 50, ['ACE']);
    expect(result).not.toBeNull();
    if (result) {
      // ACE should appear in at least one across or down slot
      const words: string[] = [];
      for (let r = 0; r < 3; r++) words.push(result[r].join(''));
      for (let c = 0; c < 3; c++) words.push(result.map(row => row[c]).join(''));
      expect(words).toContain('ACE');
    }
  });

  it('returns null when custom word cannot fit', () => {
    const wl = loadWordList(testData);
    const pattern = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ];
    // CATCH is 5 letters — no 5-letter slot in a 3x3 grid
    const result = fillGrid(pattern, wl, 50, ['CATCH']);
    expect(result).toBeNull();
  });

  it('places multiple custom words without conflicts', () => {
    const wl = loadWordList(testData);
    const pattern = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ];
    const result = fillGrid(pattern, wl, 50, ['ACE', 'DRY']);
    expect(result).not.toBeNull();
    if (result) {
      const words: string[] = [];
      for (let r = 0; r < 3; r++) words.push(result[r].join(''));
      for (let c = 0; c < 3; c++) words.push(result.map(row => row[c]).join(''));
      expect(words).toContain('ACE');
      expect(words).toContain('DRY');
    }
  });
```

**Step 5: Run tests**

Run: `pnpm test:engine`
Expected: All tests pass (99 existing + 3 new)

**Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/filler.ts src/engine/generator.ts tests/engine/filler.test.ts
git commit -m "feat(engine): seed custom words into filler before backtracking"
```

---

### Task 3: Add `validate-word` message to worker

**Files:**
- Modify: `src/engine/worker.ts:23-73`

**Step 1: Add validate-word handler**

In `src/engine/worker.ts`, add a new message handler after the `init` block (after line 45, before the `generate` block):

```typescript
  if (type === 'validate-word') {
    const word = (payload?.word ?? '').toUpperCase();
    const valid = wordList ? wordList.hasWord(word) : false;
    self.postMessage({ type: 'validate-word-result', word, valid });
    return;
  }
```

**Step 2: Run typecheck**

Run: `pnpm typecheck 2>&1 | grep -v tests/`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/engine/worker.ts
git commit -m "feat(worker): add validate-word message handler"
```

---

### Task 4: Add `validateWord` to the puzzle generator hook

**Files:**
- Modify: `src/hooks/use-puzzle-generator.ts:1-58`

**Step 1: Add validateWord callback**

In `src/hooks/use-puzzle-generator.ts`, add a `validateWord` callback after the `generate` callback (before the return statement):

```typescript
  const validateWord = useCallback((word: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const worker = workerRef.current;
      if (!worker) return resolve(false);

      const handler = (e: MessageEvent) => {
        if (e.data.type === 'validate-word-result' && e.data.word === word.toUpperCase()) {
          worker.removeEventListener('message', handler);
          resolve(e.data.valid);
        }
      };
      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'validate-word', payload: { word } });
    });
  }, []);
```

Update the return statement to include `validateWord`:

```typescript
  return { generate, validateWord, ready, error };
```

**Step 2: Run typecheck**

Run: `pnpm typecheck 2>&1 | grep -v tests/`
Expected: No new errors

**Step 3: Commit**

```bash
git add src/hooks/use-puzzle-generator.ts
git commit -m "feat(hooks): add validateWord to usePuzzleGenerator"
```

---

### Task 5: Add custom words UI to creator page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/styles/crossword-styles.css`

**Step 1: Add custom words state and handlers to CreatorPage**

In `src/app/page.tsx`, add state after the `gridSize` state (line 18):

```typescript
  const [customWords, setCustomWords] = useState<string[]>(['', '', '', '']);
  const [wordErrors, setWordErrors] = useState<(string | null)[]>([null, null, null, null]);
```

Update the destructured hook to include `validateWord`:

```typescript
  const { generate, validateWord, ready, error: workerError } = usePuzzleGenerator();
```

Add a validation handler after `handleSizeChange`:

```typescript
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
      newErrors[index] = `Too long for ${gridSize}×${gridSize}`;
    } else {
      const valid = await validateWord(upper);
      newErrors[index] = valid ? null : 'Not in word list';
    }
    setWordErrors(newErrors);
  };

  const handleWordChange = (index: number, value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z]/g, '');
    const newWords = [...customWords];
    newWords[index] = upper;
    setCustomWords(newWords);
  };

  const clearWord = (index: number) => {
    const newWords = [...customWords];
    newWords[index] = '';
    setCustomWords(newWords);
    const newErrors = [...wordErrors];
    newErrors[index] = null;
    setWordErrors(newErrors);
  };
```

Update `handleSizeChange` to re-validate word lengths:

```typescript
  const handleSizeChange = (size: 7 | 13) => {
    setGridSize(size);
    setPuzzle(null);
    setShareUrl(null);
    // Re-validate word lengths for new grid size
    setWordErrors(prev =>
      prev.map((err, i) => {
        const word = customWords[i];
        if (!word) return null;
        if (word.length > size) return `Too long for ${size}×${size}`;
        return err === `Too long for ${gridSize}×${gridSize}` ? null : err;
      })
    );
  };
```

Update `handleGenerate` to pass custom words:

```typescript
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setShareUrl(null);
    try {
      const validCustomWords = customWords.filter((w, i) => w.length > 0 && !wordErrors[i]);
      const result = await generate({
        size: gridSize,
        customWords: validCustomWords.length > 0 ? validCustomWords : undefined,
      });
      setPuzzle(result);
    } catch (err) {
      setError((err as Error).message || "Couldn't generate a puzzle. Try again!");
    } finally {
      setGenerating(false);
    }
  };
```

**Step 2: Add the custom words input section to the JSX**

Add between the `.btn-row` div (line 132) and the error display (line 134):

```tsx
      <div className="custom-words-section" style={{ marginBottom: 16 }}>
        <h3>Custom Words (optional)</h3>
        <div className="custom-words-row">
          {customWords.map((word, i) => (
            <div key={i} className="custom-word-input-wrapper">
              <div style={{ position: 'relative' }}>
                <input
                  className={`custom-word-input${wordErrors[i] ? ' input-error' : ''}`}
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
                    ×
                  </button>
                )}
              </div>
              {wordErrors[i] && (
                <div className="custom-word-error">{wordErrors[i]}</div>
              )}
            </div>
          ))}
        </div>
      </div>
```

**Step 3: Add CSS for custom word inputs**

In `src/styles/crossword-styles.css`, add before the `/* ============================================================ Responsive */` section:

```css
/* ============================================================
   Custom Words Input
   ============================================================ */
.custom-words-section { margin-top: 8px; }
.custom-words-row { display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
.custom-word-input-wrapper { flex: 1; min-width: 120px; max-width: 180px; }
.custom-word-input {
  width: 100%;
  padding: 8px 28px 8px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.custom-word-input:focus { outline: 2px solid #326891; border-color: #326891; }
.custom-word-input.input-error { border-color: #cc0000; }
.custom-word-clear {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 1.1rem;
  color: #888;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.custom-word-clear:hover { color: #cc0000; }
.custom-word-error { font-size: 0.72rem; color: #cc0000; margin-top: 2px; }
```

Add inside the `@media (max-width: 640px)` block:

```css
  /* Custom words — stack on mobile */
  .custom-words-row { flex-direction: column; }
  .custom-word-input-wrapper { max-width: 100%; }
```

**Step 4: Run typecheck and lint**

Run: `pnpm typecheck 2>&1 | grep -v tests/ && pnpm lint`
Expected: No new errors

**Step 5: Commit**

```bash
git add src/app/page.tsx src/styles/crossword-styles.css
git commit -m "feat(ui): add custom words input to creator page"
```

---

### Task 6: Pass customWords through worker generate message

**Files:**
- Modify: `src/engine/worker.ts:47-72`

**Step 1: Forward customWords in the generate handler**

In `src/engine/worker.ts`, the `generate` handler currently reads `payload?.options`. The `customWords` field is already part of `GenerateOptions`, so it will flow through automatically when the UI passes `customWords` in the options object. No change needed to the worker — the `mergedOptions` spread already preserves all fields from the caller's options.

Verify by reading the code: `const mergedOptions: GenerateOptions = { ...options, ... }` — the spread of `options` carries `customWords` through.

**Step 2: Verify the full data flow**

Trace the path:
1. UI: `generate({ size: gridSize, customWords: [...] })` — passes to hook
2. Hook: `worker.postMessage({ type: 'generate', payload: { options } })` — sends to worker
3. Worker: `const options: GenerateOptions | undefined = payload?.options` — reads options (customWords included)
4. Worker: `mergedOptions = { ...options, ... }` — preserves customWords
5. Worker: `generatePuzzle(wordList, mergedOptions)` — passes to generator
6. Generator: `fillGrid(pattern, wordList, options?.maxCandidates, options?.customWords)` — passes to filler
7. Filler: seeds custom words before backtracking

No code changes needed — this task is verification only.

**Step 3: Run full test suite**

Run: `pnpm lint && pnpm typecheck 2>&1 | grep -v tests/ && pnpm test:engine`
Expected: Lint clean, no new type errors, all tests pass

---

### Task 7: End-to-end manual verification

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Test custom word input validation**

Go to `http://localhost:3000`:
- Type "HI" in word 1 → should show "Too short (min 3)" error
- Type "CAT" → error should clear (word exists in word list)
- Type "XYZZY" → should show "Not in word list"
- Switch to 7×7, type an 8-letter word → should show "Too long for 7×7"
- Click × to clear a word → error clears

**Step 3: Test generation with custom words**

- Type "CAT" in word 1, click Generate (13×13)
- Verify "CAT" appears in the grid's across or down entries
- Type two words, generate, verify both appear
- Leave all inputs empty, generate → works normally (no custom words)

**Step 4: Test failure case**

- Type 4 long words (if they conflict), generate
- Should either succeed or show the standard generation error after retries

**Step 5: Run full test suite**

Run: `pnpm lint && pnpm typecheck 2>&1 | grep -v tests/ && pnpm test:engine`
Expected: All checks pass
