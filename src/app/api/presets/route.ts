import { getSupabaseServer } from '@/lib/db';

export interface PresetRow {
  grid_size: number;
  min_density: number;
  max_density: number;
  min_span: number;
  max_candidates: number;
  pattern_attempts: number;
  max_attempts: number;
}

export async function GET() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from('generation_presets')
    .select('grid_size, min_density, max_density, min_span, max_candidates, pattern_attempts, max_attempts');

  if (error) {
    return Response.json({ error: 'Failed to load presets' }, { status: 500 });
  }

  return Response.json(data as PresetRow[]);
}
