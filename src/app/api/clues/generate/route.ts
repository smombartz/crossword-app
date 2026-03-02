import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateCrosswordClue } from '@/lib/gemini';
import { saveGeneratedClue } from '@/lib/clue-store';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: 'Sign in required' }, { status: 401 });
  }

  let body: { word?: string; existingClues?: string[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const word = body.word?.toUpperCase();
  if (!word || word.length < 2 || !/^[A-Z]+$/.test(word)) {
    return Response.json({ error: 'Invalid word' }, { status: 400 });
  }

  try {
    const clue = await generateCrosswordClue(word, body.existingClues ?? []);
    saveGeneratedClue(word, clue);
    return Response.json({ clue });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate clue';
    return Response.json({ error: message }, { status: 500 });
  }
}
