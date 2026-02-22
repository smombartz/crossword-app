import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/db';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email || email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { grid_size, min_density, max_density, min_span, max_candidates, pattern_attempts, max_attempts } = body;

    if (typeof grid_size !== 'number' || grid_size < 3) {
      return Response.json({ error: 'Invalid grid_size' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('generation_presets')
      .upsert(
        {
          grid_size,
          min_density,
          max_density,
          min_span,
          max_candidates,
          pattern_attempts,
          max_attempts,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'grid_size' }
      )
      .select()
      .single();

    if (error) {
      return Response.json({ error: 'Failed to save preset' }, { status: 500 });
    }

    return Response.json(data);
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
