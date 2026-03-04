import Database from 'better-sqlite3';
import { appendFileSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getSupabaseServer } from './db';

const DEFAULT_DB_PATH = join(process.cwd(), 'wordlist.db');
const DEFAULT_JSONL_PATH = join(process.cwd(), 'llm-clues.jsonl');
const DEFAULT_JSON_PATH = join(process.cwd(), 'public', 'wordlist.json');

export async function saveWordClue(
  word: string,
  clue: string,
  source: string = 'gemini-2.5-flash-lite',
  dbPath: string = DEFAULT_DB_PATH,
  jsonlPath: string = DEFAULT_JSONL_PATH,
  jsonPath: string = DEFAULT_JSON_PATH,
): Promise<void> {
  const upper = word.toUpperCase();

  // 0. Persist to Supabase (primary store — works on Vercel)
  try {
    const supabase = getSupabaseServer();
    await supabase.from('word_clues').upsert(
      { word: upper, clue, source },
      { onConflict: 'word,clue', ignoreDuplicates: true }
    );
  } catch { /* best-effort */ }

  // 1. Append to JSONL backup (always, even if other writes fail)
  try {
    const entry = {
      word: upper,
      clue,
      source,
      timestamp: new Date().toISOString(),
    };
    appendFileSync(jsonlPath, JSON.stringify(entry) + '\n');
  } catch { /* best-effort */ }

  // 2. Upsert into wordlist.db
  try {
    const db = new Database(dbPath);
    const row = db.prepare('SELECT clues FROM words WHERE word = ?').get(upper) as
      | { clues: string | null }
      | undefined;

    const now = new Date().toISOString();
    if (row) {
      const existing: string[] = row.clues ? JSON.parse(row.clues) : [];
      if (!existing.includes(clue)) {
        existing.push(clue);
        db.prepare('UPDATE words SET clues = ?, updated_at = ? WHERE word = ?').run(
          JSON.stringify(existing),
          now,
          upper,
        );
      }
    } else {
      db.prepare('INSERT INTO words (word, clues, updated_at) VALUES (?, ?, ?)').run(
        upper,
        JSON.stringify([clue]),
        now,
      );
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
      const existing = bucket.find(([w]) => w === upper);
      if (existing && !existing[1].includes(clue)) {
        existing[1].push(clue);
        writeFileSync(jsonPath, JSON.stringify(data));
      } else if (!existing) {
        bucket.push([upper, [clue]]);
        writeFileSync(jsonPath, JSON.stringify(data));
      }
    }
  } catch { /* best-effort */ }
}

/** @deprecated Use saveWordClue instead */
export const saveGeneratedClue = saveWordClue;
