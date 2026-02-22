import { notFound } from 'next/navigation';
import { getSupabaseServer } from '@/lib/db';
import type { Direction, PlayerPuzzle } from '@/engine/types';
import { PlayerClient } from './player-client';

interface PageProps {
  params: { slug: string };
}

export default async function PlayerPage({ params }: PageProps) {
  const { slug } = params;
  const supabase = getSupabaseServer();

  const { data, error } = await supabase
    .from('puzzles')
    .select('id, size, pattern_data, solution_hash, entries_data, created_by')
    .eq('share_slug', slug)
    .single();

  if (error || !data) {
    notFound();
  }

  // Fetch creator display name
  const { data: user } = await supabase
    .from('users')
    .select('display_name')
    .eq('id', data.created_by)
    .single();

  const puzzle: PlayerPuzzle = {
    id: data.id,
    size: data.size,
    pattern: data.pattern_data as readonly (readonly number[])[],
    solutionHash: data.solution_hash as string,
    entries: (data.entries_data as Array<Record<string, unknown>>).map(
      ({ number, direction, clue, start, length }) => ({
        number: number as number,
        direction: direction as Direction,
        clue: clue as string,
        start: start as readonly [number, number],
        length: length as number,
      })
    ),
    creatorName: user?.display_name ?? 'Anonymous',
  };

  return <PlayerClient puzzle={puzzle} />;
}
