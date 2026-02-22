/**
 * Build script: wordlist.db (SQLite) → public/wordlist.json
 *
 * Reads all words with length 3–13 from the SQLite database and exports them
 * as a compact JSON file grouped by word length. Words with clues (status "done")
 * include their clue arrays; words without clues get a placeholder (the word itself).
 *
 * Output format:
 *   { "3": [["STY", ["clue1","clue2","clue3"]], ...], "4": [...], ... }
 *
 * Usage:
 *   pnpm build:wordlist
 */

import Database from 'better-sqlite3';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'wordlist.db');
const outDir = join(__dirname, '..', 'public');
const outPath = join(outDir, 'wordlist.json');

// Ensure public/ directory exists
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

const db = new Database(dbPath, { readonly: true });

interface WordRow {
  word: string;
  length: number;
  clues: string | null;
}

// Export format: { "3": [["STY", ["clue1","clue2","clue3"]], ...], "4": [...] }
const result: Record<string, [string, string[]][]> = {};

const rows = db.prepare(
  `SELECT word, length, clues FROM words WHERE length BETWEEN 3 AND 13 ORDER BY length`
).all() as WordRow[];

for (const row of rows) {
  const key = String(row.length);
  if (!result[key]) result[key] = [];

  let clues: string[];
  if (row.clues) {
    try {
      clues = JSON.parse(row.clues);
    } catch {
      clues = [row.word.toUpperCase()];
    }
  } else {
    clues = [row.word.toUpperCase()]; // placeholder — word as its own clue
  }

  result[key].push([row.word.toUpperCase(), clues]);
}

const json = JSON.stringify(result);
writeFileSync(outPath, json);

const totalWords = Object.values(result).reduce((sum, arr) => sum + arr.length, 0);
const fileSizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(1);

console.log(`Wrote ${totalWords.toLocaleString()} words to ${outPath}`);
console.log(`File size: ${fileSizeMB} MB`);

// Per-length breakdown
for (const [len, words] of Object.entries(result).sort(([a], [b]) => Number(a) - Number(b))) {
  console.log(`  ${len}-letter: ${words.length.toLocaleString()} words`);
}

db.close();
