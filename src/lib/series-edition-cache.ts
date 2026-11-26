import { publicBookCache } from './public-book-cache';

type SeriesEdition = { id: string; volumeInfo: { title?: string } };
const key = (seriesId: number, bookId: number) => `series-edition:v1:${seriesId}:${bookId}`;

function validEdition<T extends SeriesEdition>(value: unknown): value is T {
  const edition = value as SeriesEdition | null;
  return typeof edition?.id === 'string' && /^[\w-]{1,200}$/.test(edition.id) &&
    typeof edition.volumeInfo?.title === 'string' && Boolean(edition.volumeInfo.title.trim());
}

export function readSeriesEdition<T extends SeriesEdition>(
  seriesId: number, bookId: number, load: () => Promise<T | null>, cache = publicBookCache,
) {
  return cache.read(key(seriesId, bookId), load, {
    freshMs: 86400000,
    retainMs: 7 * 86400000,
    valid: validEdition<T>,
  });
}

export function peekSeriesEdition<T extends SeriesEdition>(seriesId: number, bookId: number) {
  return publicBookCache.peek(key(seriesId, bookId), validEdition<T>);
}
