import type { CanonicalCoverInput } from './canonical-book-covers';

type RowMetadata = {
  bookId: string;
  isbn?: string;
  imageLinks?: CanonicalCoverInput['imageLinks'];
  publishedDate?: string;
};

const rows = new Map<string, RowMetadata>();
const listeners = new Set<() => void>();
let version = 0;
export const seriesRowMetadataVersion = () => version;
export function subscribeSeriesRowMetadata(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export const getSeriesRowMetadata = (seriesId: number, bookId: number) =>
  rows.get(`${seriesId}:${bookId}`);

export function rememberSeriesRowMetadata(seriesId: number, bookId: number, edition: RowMetadata) {
  const key = `${seriesId}:${bookId}`;
  const prior = rows.get(key);
  const next = prior?.bookId === edition.bookId ? {
    ...edition,
    imageLinks: edition.imageLinks ?? prior.imageLinks,
    publishedDate: edition.publishedDate ?? prior.publishedDate,
    isbn: edition.isbn ?? prior.isbn,
  } : edition;
  if (prior?.bookId === next.bookId && prior.isbn === next.isbn &&
      prior.publishedDate === next.publishedDate &&
      JSON.stringify(prior.imageLinks) === JSON.stringify(next.imageLinks)) return;
  rows.delete(key);
  rows.set(key, next);
  if (rows.size > 200) rows.delete(rows.keys().next().value!);
  version++;
  listeners.forEach(listener => listener());
}
