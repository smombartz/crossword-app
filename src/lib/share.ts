import { nanoid } from 'nanoid';

export function generateShareSlug(): string {
  return nanoid(8);
}

export function generatePuzzleId(): string {
  return `pzl_${nanoid()}`;
}

export function getShareUrl(slug: string, origin: string): string {
  return `${origin}/play/${slug}`;
}
