import {formatBookDescription} from './book-description';
import {publicBookCache} from './public-book-cache';
import { audioEditionPenalty, catalogWorkTitleKey, cleanCatalogBookTitle, displayBookTitle, normalizeCatalogAuthor, isCatalogCollection, isCatalogSupplement } from '../../supabase/functions/_shared/book-edition-metadata';
import { isEnglishBookLanguage } from '../../supabase/functions/_shared/book-language';
import { unknownSeriesLanguage } from '../../supabase/functions/_shared/series-reading-edition';
import type { GoogleBookSearchItem } from './book-search';

const normalize = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const titleKey = (book: GoogleBookSearchItem) => normalize(cleanCatalogBookTitle(book.volumeInfo.title ?? '')).replace(/^(?:a|an|the) /, '');
const authors = (book: GoogleBookSearchItem) => (book.volumeInfo.authors ?? []).map(name => normalize(normalizeCatalogAuthor(name))).filter(Boolean);
const eligible = (book: GoogleBookSearchItem) => !isCatalogCollection(book) && !isCatalogSupplement(book) && isEnglishBookLanguage(book.volumeInfo.language);
export function sameBookWork(a: GoogleBookSearchItem, b: GoogleBookSearchItem) {
  return eligible(a) && eligible(b) && Boolean(titleKey(a)) && titleKey(a) === titleKey(b) && authors(a).some(author => authors(b).includes(author));
}

const adaptation = /\b(?:graphic novel|comic|manga|adaptation|retelling|abridged|study guide|summary|workbook)\b/i;
const editionTitle = (book: GoogleBookSearchItem) => catalogWorkTitleKey(
  book.volumeInfo.title ?? '', book.novoriEdition?.originalTitle,
);

function synopsisSibling(edition: GoogleBookSearchItem, candidate: GoogleBookSearchItem) {
  return !isCatalogCollection(edition) && !isCatalogSupplement(edition) &&
    (isEnglishBookLanguage(edition.volumeInfo.language) || unknownSeriesLanguage(edition.volumeInfo.language)) &&
    eligible(candidate) && Boolean(editionTitle(edition)) && editionTitle(edition) === editionTitle(candidate) &&
    authors(edition).some(author => authors(candidate).includes(author));
}

const synopsisFormat = (book: GoogleBookSearchItem) => !audioEditionPenalty(book) &&
  !adaptation.test([book.volumeInfo.title, book.volumeInfo.subtitle, book.novoriEdition?.originalTitle].filter(Boolean).join(' '));

export function fillMissingBookSynopsis<T extends GoogleBookSearchItem>(edition: T, candidates: GoogleBookSearchItem[]): T {
  if (formatBookDescription(edition.volumeInfo.description)) return edition;
  if (!synopsisFormat(edition)) return edition;
  const source = candidates.find(book => synopsisSibling(edition, book) && synopsisFormat(book) &&
    formatBookDescription(book.volumeInfo.description));
  return source ? {...edition, volumeInfo:{...edition.volumeInfo, description:source.volumeInfo.description}} : edition;
}

/** Display work metadata without changing the saved edition's ID, ISBN or cover. */
export function applyBookWorkDetails<T extends GoogleBookSearchItem>(edition: T, representative: GoogleBookSearchItem): T {
  const display = fillMissingBookSynopsis(edition, [representative]);
  if (!sameBookWork(edition, representative)) return display;
  return { ...display, novoriDetails: { bookId: representative.id, isbns: (representative.volumeInfo.industryIdentifiers ?? []).map(identifier => identifier.identifier) }, novoriPublication: representative.novoriPublication ?? edition.novoriPublication,
    volumeInfo: { ...display.volumeInfo,
      title: displayBookTitle(representative.volumeInfo.title ?? edition.volumeInfo.title ?? ''),
      publishedDate: edition.volumeInfo.publishedDate,
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
  function peek<T extends GoogleBookSearchItem>(edition: T): T | null {
    const known = cache.get(key(edition));
    return known && known.expiresAt > Date.now() ? applyBookWorkDetails(edition, known.book) : null;
  }
  async function resolve<T extends GoogleBookSearchItem>(edition: T): Promise<T> {
    if ((!eligible(edition) && !(unknownSeriesLanguage(edition.volumeInfo.language) &&
        !formatBookDescription(edition.volumeInfo.description) && !isCatalogCollection(edition) && !isCatalogSupplement(edition))) ||
        !titleKey(edition) || !authors(edition).length) return edition;
    const workKey = key(edition);
    const known = cache.get(workKey);
    if (known && known.expiresAt > Date.now()) return applyBookWorkDetails(edition, known.book);
    let request = pending.get(workKey);
    if (!request) {
      request = search(cleanCatalogBookTitle(edition.volumeInfo.title ?? '')).then(results => {
        const match = results.find(candidate => sameBookWork(edition, candidate)) ?? results.find(candidate => synopsisSibling(edition, candidate));
        const representative = match ? fillMissingBookSynopsis(match, results) : null;
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
  return { remember, resolve, peek };
}

// Lazy import avoids a runtime initialization cycle: search uses the raw shared
// reader for search payloads; only volume detail payloads enter this resolver.
export const bookWorkDetails = createBookWorkDetails(async query => {
  const { searchNovoriBooks } = await import('./book-search');
  const cached=await publicBookCache.read(`work-representative:v3:${query.trim().toLowerCase()}`,()=>searchNovoriBooks(query),{freshMs:86400000,retainMs:7*86400000,valid:(value):value is GoogleBookSearchItem[]=>Array.isArray(value)&&value.length>0&&value.every(book=>book&&typeof book.id==='string'&&book.volumeInfo&&typeof book.volumeInfo.title==='string')});
  return cached.value;
});

/** Inspect unmerged provider rows, and at most two detailed English editions. */
export async function resolveMissingBookSynopsis<T extends GoogleBookSearchItem>(edition: T, read: {
  search: (title: string) => Promise<GoogleBookSearchItem[]>;
  detail: (id: string) => Promise<GoogleBookSearchItem | null>;
}): Promise<T> {
  if (formatBookDescription(edition.volumeInfo.description) || !editionTitle(edition) || !authors(edition).length ||
      !synopsisFormat(edition) || isCatalogCollection(edition) || isCatalogSupplement(edition) ||
      !(isEnglishBookLanguage(edition.volumeInfo.language) || unknownSeriesLanguage(edition.volumeInfo.language))) return edition;
  const candidates = (await read.search(cleanCatalogBookTitle(edition.volumeInfo.title ?? '')))
    .filter(book => synopsisSibling(edition, book) && synopsisFormat(book));
  const fromSearch = fillMissingBookSynopsis(edition, candidates);
  if (fromSearch !== edition) return fromSearch;
  const ids = [...new Set(candidates.map(book => book.id))].filter(id => id !== edition.id && /^[\w-]{1,200}$/.test(id)).slice(0, 2);
  const detailed = await Promise.all(ids.map(id => read.detail(id).catch(() => null)));
  return fillMissingBookSynopsis(edition, detailed.filter((book): book is GoogleBookSearchItem => Boolean(book)));
}
