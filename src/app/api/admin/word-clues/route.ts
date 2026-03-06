import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/db';

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email || email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, status } = body as { id?: number; status?: string };

    if (!id || !status || !['approved', 'rejected'].includes(status)) {
      return Response.json({ error: 'Invalid id or status' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from('word_clues')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return Response.json({ error: 'Failed to update word clue' }, { status: 500 });
    }

    return Response.json(data);
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
