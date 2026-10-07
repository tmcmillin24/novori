import { createBookReadCache } from './book-read-cache';
import { preferredCoverIsbn } from '../../supabase/functions/_shared/catalog-cover-preferences';
import { resolveCanonicalBookCover } from './canonical-book-covers';
import type { DiscoveryBook } from './discovery-books';
import { createDiscoveryBookResolver } from './discovery-books';
import { resolveGoogleBooksIdentity } from './google-books';
import { searchNovoriBooks } from './book-search';

// Endpoint/field names are compatibility names. The server chooses ISBNdb or
// cached legacy metadata; the client never calls a raw Google Books API here.
export const resolveDiscoveryBook = createDiscoveryBookResolver(resolveGoogleBooksIdentity, searchNovoriBooks);

// Only mounted previews resolve; bound concurrency and reuse the same cached
// identity path as taps. Do not prefetch the entire 100/150-book provider pool.
const previewRead = createBookReadCache<boolean>(5 * 60_000, 150);
let active = 0;
const waiting: Array<() => void> = [];
async function limited<T>(run: () => Promise<T>): Promise<T> {
 if (active >= 2) await new Promise<void>(resolve => waiting.push(resolve));
 else active++;
 try { return await run(); } finally {
  const next = waiting.shift();
  if (next) next(); else active--;
 }
}
export function loadDiscoveryCover(book: DiscoveryBook) {
 return previewRead(JSON.stringify([book.id, book.title, book.authors]), () => limited(async () => {
  const preferred = preferredCoverIsbn(book);
  if (book.coverUrl && !preferred) return true;
  if (preferred) {
   try { await resolveGoogleBooksIdentity({ title: book.title, author: book.authors[0], isbn: preferred }); }
   catch { /* Existing catalog artwork remains available during provider outages. */ }
  }
  const id = await resolveDiscoveryBook(book);
  if (id) await resolveCanonicalBookCover({ googleBookId: id }, true);
  return Boolean(id);
 }));
}
