import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_ID = 'gemini-2.5-flash-lite';

export function buildCluePrompt(word: string, existingClues: string[]): string {
  let prompt = `You are an expert crossword puzzle constructor. Generate a single crossword clue for the word "${word}".

Requirements:
- The clue must be concise (typically 3-8 words)
- Use standard crossword clue conventions
- Do NOT include the answer word or any form of it in the clue
- Vary style: definitions, wordplay, cultural references, double meanings`;

  if (existingClues.length > 0) {
    prompt += `\n\nAvoid duplicating these existing clues:\n${existingClues.map(c => `- ${c}`).join('\n')}`;
  }

  prompt += '\n\nRespond with ONLY the clue text, nothing else.';
  return prompt;
}

export async function generateCrosswordClue(
  word: string,
  existingClues: string[],
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_ID });

  const prompt = buildCluePrompt(word, existingClues);
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  if (!text) throw new Error('Empty response from Gemini');
  return text;
}
