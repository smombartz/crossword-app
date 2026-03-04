/**
 * Bulk import wordlist.json into Supabase word_clues table.
 *
 * Reads public/wordlist.json and batch-inserts all word-clue pairs.
 * Uses upsert with ignoreDuplicates to skip existing entries.
 *
 * Usage:
 *   pnpm import:wordlist-supabase
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH_SIZE = 1000;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const jsonPath = join(process.cwd(), 'public', 'wordlist.json');
  const raw = readFileSync(jsonPath, 'utf-8');
  const data: Record<string, [string, string[]][]> = JSON.parse(raw);

  // Build flat array of { word, clue, source } rows
  const rows: { word: string; clue: string; source: string }[] = [];
  for (const words of Object.values(data)) {
    for (const entry of words) {
      const word = entry[0] as string;
      const raw = entry[1];
      // Handle three shapes: string[], { clues: string[] }, or bare string
      let clues: string[];
      if (Array.isArray(raw)) {
        clues = raw;
      } else if (raw && typeof raw === 'object' && 'clues' in (raw as Record<string, unknown>)) {
        clues = (raw as { clues: string[] }).clues;
      } else if (typeof raw === 'string') {
        clues = [raw];
      } else {
        continue;
      }
      for (const clue of clues) {
        // Skip placeholder clues (word echoed as its own clue)
        if (clue === word) continue;
        rows.push({ word, clue, source: 'wordlist-import' });
      }
    }
  }

  console.log(`Total rows to import: ${rows.length}`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from('word_clues')
      .upsert(batch, { onConflict: 'word,clue', ignoreDuplicates: true, count: 'exact' });

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      imported += count ?? batch.length;
      skipped += batch.length - (count ?? batch.length);
    }

    if ((Math.floor(i / BATCH_SIZE) + 1) % 100 === 0) {
      console.log(`Progress: ${i + batch.length} / ${rows.length} rows processed`);
    }
  }

  console.log(`Done. Imported: ${imported}, Skipped (duplicates): ${skipped}, Errors: ${errors}`);
}

main().catch(console.error);
