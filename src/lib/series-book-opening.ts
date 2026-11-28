import { isVerifiedReadingEdition, seriesIsbnKey, type ReadingEdition, type SeriesMember } from '../../supabase/functions/_shared/series-reading-edition';

export async function resolveSeriesOpening<T extends ReadingEdition>(
  member: SeriesMember, seriesName: string, peekSearch: (title: string) => T[] | undefined,
  resolveEdition: () => Promise<T | null>,
): Promise<T | null> {
  const englishIsbns = new Set((member.isbns ?? []).map(seriesIsbnKey).filter((isbn): isbn is string => isbn !== null));
  const cached = peekSearch(member.title)?.find(row => isVerifiedReadingEdition(member, row, seriesName, englishIsbns));
  return cached ?? await resolveEdition();
}
