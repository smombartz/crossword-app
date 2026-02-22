import { nanoid } from 'nanoid';

export function generateShareSlug(): string {
  return nanoid(8);
}

export function generatePuzzleId(): string {
  return `pzl_${nanoid()}`;
}

export function getShareUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  return `${base}/play/${slug}`;
}
