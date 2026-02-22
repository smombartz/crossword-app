import { getSupabaseServer } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from('puzzles')
    .select('id, size, pattern_data, solution_hash, entries_data, created_by')
    .eq('share_slug', slug)
    .single();

  if (error || !data) {
    return Response.json({ error: 'Puzzle not found' }, { status: 404 });
  }

  // Get creator name
  const { data: user } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', data.created_by)
    .single();

  // Strip answers from entries — only send fields needed for the player view
  const entries = (data.entries_data as Array<Record<string, unknown>>).map(
    ({ number, direction, clue, start, length }) => ({
      number,
      direction,
      clue,
      start,
      length,
    })
  );

  return Response.json({
    id: data.id,
    size: data.size,
    pattern: data.pattern_data,
    solutionHash: data.solution_hash,
    entries,
    creatorName: user?.display_name ?? 'Anonymous',
  });
}
