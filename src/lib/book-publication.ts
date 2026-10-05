import { bookPublicationKeys, resolveBookPublication, validPublicationDate, type BookPublicationRecord } from '../../supabase/functions/_shared/book-edition-metadata';

const known = new Map<string, BookPublicationRecord>();
const listeners = new Set<() => void>();
let version = 0;
export const getPublicationVersion = () => version;
export function subscribeBookPublications(listener: () => void) {
 listeners.add(listener);
 return () => { listeners.delete(listener); };
}

export function rememberBookPublications(records: BookPublicationRecord[]) {
 let changed = false;
 for (const record of records) {
  if (!validPublicationDate(record.releaseDate)) continue;
  const fact = { title: record.title, authors: record.authors, releaseDate: record.releaseDate };
  for (const key of bookPublicationKeys(record)) {
   if (JSON.stringify(known.get(key)) === JSON.stringify(fact)) continue;
   known.set(key, fact);
   changed = true;
  }
 }
 if (changed) {
  version += 1;
  listeners.forEach(listener => listener());
 }
}

export function getBookPublication(
 book: Parameters<typeof resolveBookPublication>[0],
 seriesBooks: BookPublicationRecord[] = [],
 currentPosition?: number | null,
) {
 const cached = bookPublicationKeys(book.volumeInfo).map(key => known.get(key)).find(Boolean);
 return resolveBookPublication({ ...book, novoriPublication: cached ?? book.novoriPublication }, seriesBooks, currentPosition);
}
