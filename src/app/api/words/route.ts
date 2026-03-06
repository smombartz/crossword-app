import { getSupabaseServer } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { saveWordClue } from '@/lib/clue-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.toUpperCase() || null;
  const length = url.searchParams.get('length') ? parseInt(url.searchParams.get('length')!, 10) : null;
  const minClues = url.searchParams.get('minClues') ? parseInt(url.searchParams.get('minClues')!, 10) : null;
  const maxClues = url.searchParams.get('maxClues') ? parseInt(url.searchParams.get('maxClues')!, 10) : null;
  const status = url.searchParams.get('status') || null;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
  const offset = (page - 1) * limit;

  const supabase = getSupabaseServer();

  const [searchResult, countResult] = await Promise.all([
    supabase.rpc('search_words', {
      p_search: search,
      p_length: length,
      p_min_clues: minClues,
      p_max_clues: maxClues,
      p_limit: limit,
      p_offset: offset,
      p_status: status,
    }),
    supabase.rpc('count_words', {
      p_search: search,
      p_length: length,
      p_min_clues: minClues,
      p_max_clues: maxClues,
      p_status: status,
    }),
  ]);

  if (searchResult.error) {
    return Response.json({ error: 'Failed to search words' }, { status: 500 });
  }

  const total = (countResult.data as number) ?? 0;
  const words = (searchResult.data ?? []).map((row: { word: string; clue_count: number; clues: unknown[] }) => ({
    word: row.word,
    length: row.word.length,
    clueCount: Number(row.clue_count),
    clues: row.clues,
  }));

  return Response.json({
    words,
    total,
    page,
    limit,
    hasMore: offset + limit < total,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Sign in required' }, { status: 401 });
  }

  let body: { word?: string; clue?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const word = body.word?.toUpperCase().trim();
  const clue = body.clue?.trim();

  if (!word || !/^[A-Z]+$/.test(word)) {
    return Response.json({ error: 'Word must contain only letters A-Z' }, { status: 400 });
  }
  if (word.length < 3) {
    return Response.json({ error: 'Word must be at least 3 letters' }, { status: 400 });
  }
  if (word.length > 15) {
    return Response.json({ error: 'Word must be 15 letters or fewer' }, { status: 400 });
  }
  if (!clue || clue.length === 0) {
    return Response.json({ error: 'Clue is required' }, { status: 400 });
  }
  if (clue.length > 200) {
    return Response.json({ error: 'Clue must be 200 characters or fewer' }, { status: 400 });
  }

  try {
    const userId = (session.user as Record<string, unknown>).userId as string | undefined;
    await saveWordClue(word, clue, 'user-contributed', {
      createdBy: userId ?? null,
      status: 'pending',
    });
    return Response.json({ success: true, word, clue, status: 'pending' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save';
    return Response.json({ error: message }, { status: 500 });
  }
}
