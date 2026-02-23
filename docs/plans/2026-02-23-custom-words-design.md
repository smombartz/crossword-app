# Design: Custom Words in Puzzle Generation

## Problem

Users want to include up to 4 specific words in their generated puzzles. Currently, all words are chosen automatically by the filler from the word list.

## Solution

Add optional custom word inputs on the creator page. Custom words are validated upfront (must exist in the word list, fit the grid size), then seeded into the filler as priority placements before the backtracker fills the remaining slots.

## Constraints

- Up to 4 custom words
- Each word must exist in the word list (auto-clued)
- Each word must be 3+ letters, alpha only, <= grid size in length
- Validation happens upfront in the UI via a worker message

## Engine Changes

### GenerateOptions

New optional field:
```typescript
readonly customWords?: readonly string[];
```

### fillGrid (filler.ts)

New `customWords` parameter. Before the MRV backtracker runs:

1. Find all slots matching each custom word's length
2. Try to place custom words into compatible slots (shuffled for variety)
3. Respect letter constraints from previously placed custom words (crossings)
4. Mark placed slots as filled and words as used
5. If any custom word has zero compatible slots, return null (outer loop retries)
6. Backtracker fills remaining slots normally

### generatePuzzle (generator.ts)

Passes `options.customWords` through to `fillGrid`.

### No changes to

- Pattern generation (patterns.ts)
- Validator (validator.ts)
- Numbering (numbering.ts)
- Solution obfuscation (solution.ts)
- Player view

## Worker Changes

### New message: validate-word

Request: `{ type: 'validate-word', payload: { word: string } }`
Response: `{ type: 'validate-word-result', word: string, valid: boolean }`

Checks if the uppercased word exists in the word list via `getByLength` + matching.

### Generate message

`customWords` array added to the generate payload, passed through to `generatePuzzle`.

## UI Changes

### Creator page (page.tsx)

- Up to 4 text inputs between the size selector and Generate button
- Inputs uppercase on entry
- Validated on blur: alpha only, 3+ letters, <= grid size, exists in word list
- Invalid words show red inline error
- Inputs are optional — empty = normal generation
- `customWords` passed to `generate()` options

## Data Flow

```
User types word → blur → worker validate-word → valid/invalid feedback
User clicks Generate → customWords in options → worker → generatePuzzle → fillGrid seeds custom words → backtracker fills rest
```

## Failure Handling

- Upfront validation catches length/format/word-list issues before generation
- During generation: if custom words can't fit a pattern, fillGrid returns null, outer loop retries with a new pattern (up to maxAttempts)
- If all attempts fail: standard "Couldn't generate a puzzle. Try again!" error
