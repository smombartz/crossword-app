import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { getSupabaseServer } from '@/lib/db';

export default async function MyPuzzlesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.userId) {
    redirect('/');
  }

  const supabase = getSupabaseServer();
  const { data: puzzles } = await supabase
    .from('puzzles')
    .select('id, share_slug, size, created_at')
    .eq('created_by', session.user.userId)
    .order('created_at', { ascending: false });

  return (
    <div>
      <h2>My Puzzles</h2>

      {!puzzles || puzzles.length === 0 ? (
        <p className="text-body text-muted">
          You haven&apos;t shared any puzzles yet.{' '}
          <Link href="/">Create one!</Link>
        </p>
      ) : (
        <div className="puzzle-list">
          {puzzles.map(puzzle => (
            <div
              key={puzzle.id}
              className="card card-compact"
            >
              <div className="flex-between">
                <div>
                  <strong className="text-body">
                    {puzzle.size}&times;{puzzle.size} Crossword
                  </strong>
                  <span className="text-small text-muted" style={{ marginLeft: 12 }}>
                    {new Date(puzzle.created_at).toLocaleDateString()}
                  </span>
                </div>
                <Link
                  href={`/play/${puzzle.share_slug}`}
                  className="btn btn-secondary btn-sm"
                >
                  Play
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
