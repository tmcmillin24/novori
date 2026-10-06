import { cleanCatalogBookTitle, normalizeCatalogAuthor, isCatalogCollection, isCatalogSupplement } from '../../supabase/functions/_shared/book-edition-metadata';
import { isEnglishBookLanguage } from '../../supabase/functions/_shared/book-language';
import type { GoogleBookSearchItem } from './book-search';

const normalize = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const titleKey = (book: GoogleBookSearchItem) => normalize(cleanCatalogBookTitle(book.volumeInfo.title ?? '')).replace(/^(?:a|an|the) /, '');
const authors = (book: GoogleBookSearchItem) => (book.volumeInfo.authors ?? []).map(name => normalize(normalizeCatalogAuthor(name))).filter(Boolean);
const eligible = (book: GoogleBookSearchItem) => !isCatalogCollection(book) && !isCatalogSupplement(book) && isEnglishBookLanguage(book.volumeInfo.language);
export function sameBookWork(a: GoogleBookSearchItem, b: GoogleBookSearchItem) {
  return eligible(a) && eligible(b) && Boolean(titleKey(a)) && titleKey(a) === titleKey(b) && authors(a).some(author => authors(b).includes(author));
}

/** Display work metadata without changing the saved edition's ID, ISBN or cover. */
export function applyBookWorkDetails<T extends GoogleBookSearchItem>(edition: T, representative: GoogleBookSearchItem): T {
  if (!sameBookWork(edition, representative)) return edition;
  return { ...edition, novoriDetails: { bookId: representative.id, isbns: (representative.volumeInfo.industryIdentifiers ?? []).map(identifier => identifier.identifier) }, novoriPublication: representative.novoriPublication ?? edition.novoriPublication,
    volumeInfo: { ...representative.volumeInfo,
      imageLinks: edition.volumeInfo.imageLinks,
      industryIdentifiers: edition.volumeInfo.industryIdentifiers,
    } };
}

export function createBookWorkDetails(search: (query: string) => Promise<GoogleBookSearchItem[]>, ttlMs = 5 * 60_000) {
  const cache = new Map<string, { book: GoogleBookSearchItem; expiresAt: number }>();
  const pending = new Map<string, Promise<GoogleBookSearchItem | null>>();
  const key = (book: GoogleBookSearchItem) => `${titleKey(book)}::${authors(book).sort().join('|')}`;
  function remember(query: string, books: GoogleBookSearchItem[]) {
    const queryTitle = normalize(cleanCatalogBookTitle(query)).replace(/^(?:a|an|the) /, '');
    for (const book of books) {
      // Only a full-title search establishes the work representative. An author,
      // ISBN or partial-title query can return a different subset of editions.
      if (!eligible(book) || queryTitle !== titleKey(book) || !authors(book).length) continue;
      cache.delete(key(book));
      cache.set(key(book), { book: JSON.parse(JSON.stringify(book)), expiresAt: Date.now() + ttlMs });
      while (cache.size > 150) cache.delete(cache.keys().next().value!);
    }
  }
  async function resolve<T extends GoogleBookSearchItem>(edition: T): Promise<T> {
    if (!eligible(edition) || !titleKey(edition) || !authors(edition).length) return edition;
    const workKey = key(edition);
    const known = cache.get(workKey);
    if (known && known.expiresAt > Date.now()) return applyBookWorkDetails(edition, known.book);
    let request = pending.get(workKey);
    if (!request) {
      request = search(cleanCatalogBookTitle(edition.volumeInfo.title ?? '')).then(results => {
        const representative = results.find(candidate => sameBookWork(edition, candidate)) ?? null;
        if (representative) remember(representative.volumeInfo.title ?? '', [representative]);
        return representative;
      });
      pending.set(workKey, request);
    }
    try {
      const representative = await request;
      return representative ? applyBookWorkDetails(edition, representative) : edition;
    } catch {
      // An unavailable search must never erase usable cached edition details.
      return edition;
    } finally {
      if (pending.get(workKey) === request) pending.delete(workKey);
    }
  }
  return { remember, resolve };
}

// Lazy import avoids a runtime initialization cycle: search uses the raw shared
// reader for search payloads; only volume detail payloads enter this resolver.
export const bookWorkDetails = createBookWorkDetails(async query => {
  const { searchNovoriBooks } = await import('./book-search');
  return searchNovoriBooks(query);
});
