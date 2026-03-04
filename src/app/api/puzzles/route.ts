import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { authOptions } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/db';
import { generateShareSlug, generatePuzzleId, getShareUrl } from '@/lib/share';
import { obfuscateSolution } from '@/engine/solution';
import { BLACK } from '@/engine/types';
import { saveWordClue } from '@/lib/clue-store';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).userId as
    | string
    | undefined;
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const headersList = await headers();
    const host = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost:3000';
    const proto = headersList.get('x-forwarded-proto') ?? 'https';
    const origin = `${proto}://${host}`;

    const body = await request.json();
    const supabase = getSupabaseServer();

    const puzzleId = generatePuzzleId();
    const shareSlug = generateShareSlug();
    const solutionHash = obfuscateSolution(body.grid, puzzleId);
    const pattern = body.grid.map((row: string[]) =>
      row.map((cell: string) => (cell === BLACK ? 0 : 1))
    );

    const { error } = await supabase.from('puzzles').insert({
      id: puzzleId,
      share_slug: shareSlug,
      created_by: userId,
      grid_data: body.grid,
      solution_hash: solutionHash,
      entries_data: body.entries,
      pattern_data: pattern,
      size: body.size,
      is_shared: true,
    });

    if (error) {
      return Response.json({ error: 'Failed to save puzzle' }, { status: 500 });
    }

    // Best-effort: save all word+clue pairs back to the wordlist
    const savePromises = (body.entries as { answer?: string; clue?: string }[])
      .filter(entry => entry.answer && entry.clue)
      .map(entry => saveWordClue(entry.answer!, entry.clue!, 'user-share'));
    await Promise.allSettled(savePromises);

    return Response.json({
      id: puzzleId,
      shareSlug,
      shareUrl: getShareUrl(shareSlug, origin),
    });
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
