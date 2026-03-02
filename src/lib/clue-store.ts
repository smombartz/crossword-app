import Database from 'better-sqlite3';
import { appendFileSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DEFAULT_DB_PATH = join(process.cwd(), 'wordlist.db');
const DEFAULT_JSONL_PATH = join(process.cwd(), 'llm-clues.jsonl');
const DEFAULT_JSON_PATH = join(process.cwd(), 'public', 'wordlist.json');

export function saveGeneratedClue(
  word: string,
  clue: string,
  dbPath: string = DEFAULT_DB_PATH,
  jsonlPath: string = DEFAULT_JSONL_PATH,
  jsonPath: string = DEFAULT_JSON_PATH,
): void {
  const upper = word.toUpperCase();

  // 1. Append to JSONL backup (always, even if other writes fail)
  try {
    const entry = {
      word: upper,
      clue,
      model: 'gemini-2.5-flash-lite',
      timestamp: new Date().toISOString(),
    };
    appendFileSync(jsonlPath, JSON.stringify(entry) + '\n');
  } catch { /* best-effort */ }

  // 2. Append to wordlist.db
  try {
    const db = new Database(dbPath);
    const row = db.prepare('SELECT clues FROM words WHERE word = ?').get(upper) as
      | { clues: string | null }
      | undefined;

    if (row) {
      const existing: string[] = row.clues ? JSON.parse(row.clues) : [];
      if (!existing.includes(clue)) {
        existing.push(clue);
        db.prepare('UPDATE words SET clues = ?, updated_at = ? WHERE word = ?').run(
          JSON.stringify(existing),
          new Date().toISOString(),
          upper,
        );
      }
    }
    db.close();
  } catch { /* best-effort — read-only FS on Vercel */ }

  // 3. Patch public/wordlist.json (targeted update, not full rebuild)
  try {
    const raw = readFileSync(jsonPath, 'utf-8');
    const data: Record<string, [string, string[]][]> = JSON.parse(raw);
    const lenKey = String(upper.length);
    const bucket = data[lenKey];
    if (bucket) {
      const entry = bucket.find(([w]) => w === upper);
      if (entry && !entry[1].includes(clue)) {
        entry[1].push(clue);
        writeFileSync(jsonPath, JSON.stringify(data));
      }
    }
  } catch { /* best-effort */ }
}
