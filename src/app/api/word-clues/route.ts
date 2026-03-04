import { getSupabaseServer } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('word_clues')
    .select('word, clue')
    .limit(50000);

  if (error) {
    return Response.json({ error: 'Failed to load word clues' }, { status: 500 });
  }

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
