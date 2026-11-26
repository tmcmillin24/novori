import { isVerifiedReadingEdition, seriesIsbnKey, type ReadingEdition, type SeriesMember } from '../../supabase/functions/_shared/series-reading-edition';

export async function resolveSeriesOpening<T extends ReadingEdition>(
  member: SeriesMember, seriesName: string, peekSearch: (title: string) => T[] | undefined,
  resolveEdition: () => Promise<T | null>,
  searchBooks?: (title: string) => Promise<T[]>,
): Promise<T | null> {
  const englishIsbns = new Set((member.isbns ?? []).map(seriesIsbnKey).filter((isbn): isbn is string => isbn !== null));
  const matches = (row: T) => isVerifiedReadingEdition(member, row, seriesName, englishIsbns);
  const cached = peekSearch(member.title)?.find(matches);
  if (cached) return cached;

  let lookupFailed = false;
  let lookupError: unknown;
  try {
    const edition = await resolveEdition();
    if (edition) return edition;
  } catch (error) {
    lookupFailed = true;
    lookupError = error;
  }

  const match = (await searchBooks?.(member.title))?.find(matches);
  if (match) return match;
  if (lookupFailed) throw lookupError;
  return null;
}
