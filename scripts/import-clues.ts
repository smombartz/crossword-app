/**
 * Import clues from new-crossword_clues.db into wordlist.db
 *
 * Merges clues for words that already have them (deduplicating),
 * and copies clues for words that don't.
 *
 * Usage:
 *   pnpm import:clues
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mainDbPath = join(__dirname, '..', 'wordlist.db');
const newDbPath = join(__dirname, '..', 'new-crossword_clues.db');

const mainDb = new Database(mainDbPath);
const newDb = new Database(newDbPath, { readonly: true });

interface WordRow {
  word: string;
  clues: string | null;
  status: string;
  model: string | null;
}

// Get all done rows from new DB
const newRows = newDb.prepare(
  `SELECT word, clues, status, model FROM words WHERE status = 'done' AND clues IS NOT NULL`
).all() as WordRow[];

console.log(`Source DB: ${newRows.length.toLocaleString()} words with clues`);

// Get existing done words from main DB for merge detection
const existingDone = new Set<string>();
const existingRows = mainDb.prepare(
  `SELECT word FROM words WHERE status = 'done'`
).all() as { word: string }[];
for (const row of existingRows) {
  existingDone.add(row.word);
}
console.log(`Target DB: ${existingDone.size.toLocaleString()} words already have clues`);

const now = new Date().toISOString();

// Prepare statements
const getClues = mainDb.prepare(`SELECT clues FROM words WHERE word = ?`);
const updateWord = mainDb.prepare(
  `UPDATE words SET clues = ?, status = 'done', model = COALESCE(model, ?), updated_at = ? WHERE word = ?`
);

let updated = 0;
let merged = 0;
let skipped = 0;
let notFound = 0;

const importAll = mainDb.transaction(() => {
  for (const row of newRows) {
    const existing = getClues.get(row.word) as { clues: string | null } | undefined;

    if (!existing) {
      // Word doesn't exist in main DB at all
      notFound++;
      continue;
    }

    if (existingDone.has(row.word) && existing.clues) {
      // Already has clues — merge and deduplicate
      try {
        const oldClues: string[] = JSON.parse(existing.clues);
        const newClues: string[] = JSON.parse(row.clues!);
        const mergedClues = [...new Set([...oldClues, ...newClues])];

        if (mergedClues.length > oldClues.length) {
          updateWord.run(JSON.stringify(mergedClues), row.model, now, row.word);
          merged++;
        } else {
          skipped++;
        }
      } catch {
        skipped++;
      }
    } else {
      // No clues yet — copy from new DB
      updateWord.run(row.clues, row.model, now, row.word);
      updated++;
    }
  }
});

importAll();

const totalDone = (mainDb.prepare(`SELECT COUNT(*) as c FROM words WHERE status = 'done'`).get() as { c: number }).c;

console.log(`\nResults:`);
console.log(`  New clues added:    ${updated.toLocaleString()}`);
console.log(`  Merged (expanded):  ${merged.toLocaleString()}`);
console.log(`  Skipped (no change):${skipped.toLocaleString()}`);
console.log(`  Not in target DB:   ${notFound.toLocaleString()}`);
console.log(`\nTotal words with clues now: ${totalDone.toLocaleString()}`);

mainDb.close();
newDb.close();
