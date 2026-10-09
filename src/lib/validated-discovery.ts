import { createBookReadCache } from './book-read-cache';
import { normalizeCatalogAuthor } from '../../supabase/functions/_shared/book-edition-metadata';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveDiscoveryBook } from './resolve-discovery-book';
import type { DiscoveryBook } from './discovery-books';
import { resolveCanonicalBookCover, publishCatalogCovers, getCanonicalBookCoverMetadata } from './canonical-book-covers';

type Card = { coverFallback?: boolean; coverAliases?: string[]; coverProvider?: string; coverWorkId?: string; genres?: string[]; id?: number; title?: string; authors?: string[]; coverBookId?: string | null; coverUrl: string | null; coverPolicyVersion?: number;
 rejectedCoverUrls?: string[];
 coverAlternatives?: { url: string; bookId: string; locked?: boolean }[] };
const hasArtwork = (book: Card) => Boolean(book.coverUrl && (book.coverBookId || (book.coverProvider === 'hardcover' && book.id)));
const DAY = 86400000;
const storageKey = (kind: string) => `novori:validated-discovery:v9:${kind}`;

function publish(cards: Card[]) {
 const covers: Record<string, string> = {}, details: Record<string, any> = {};
 for (const card of cards) {
  const key = card.coverBookId ?? (card.coverProvider === 'hardcover' && card.id ? `hc_art_${card.id}` : null);
  if (!key || !card.coverUrl) continue;
  covers[key] = card.coverUrl;
  details[key] = { workId: card.coverWorkId ?? (card.coverProvider === 'hardcover' ? `hardcover:${card.id}` : `edition:${card.coverBookId}`), provider: card.coverProvider, fallback: card.coverFallback === true, aliases: card.coverAliases, genres: card.genres, rejectedUrls: card.rejectedCoverUrls ?? [], locked: card.coverAlternatives?.some(choice => choice.url === card.coverUrl && choice.locked) ?? false, alternatives: [...new Set([card.coverUrl, ...(card.coverAlternatives ?? []).map(choice => choice.url)])] };
 }
 publishCatalogCovers(covers, details);
}
export async function readValidatedDiscovery<T extends Card>(kind: string): Promise<T[]> {
 try {
  const saved = JSON.parse(await AsyncStorage.getItem(storageKey(kind)) ?? 'null');
  if (!saved || !Number.isFinite(saved.savedAt) || saved.savedAt > Date.now() || Date.now() - saved.savedAt > 7 * DAY || !Array.isArray(saved.books)) return [];
  const cards = saved.books.filter((row: Card) => hasArtwork(row)).slice(0, 100);
  publish(cards);
  return cards;
 } catch { return []; }
}

export function discoveryAuthorKey(book: Card): string {
 return normalizeCatalogAuthor(book.authors?.[0] ?? '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  .replace(/\b(?:[a-z]\s+)+[a-z]\b/g, initials => initials.replace(/\s/g, ''));
}
const fillRead = createBookReadCache<Card | null>(5 * 60_000, 300);
const identity = (book: Card) => JSON.stringify([book.id ?? book.coverBookId, book.title, book.authors]);
type FillOptions<T> = {
 onProgress?: (books: T[]) => void;
 isEligible?: (book: T) => boolean;
 isCurrent?: () => boolean;
 sourceSavedAt?: number;
};

export async function prepareDiscovery<T extends Card>(kind: string, books: T[], options: FillOptions<T> = {}): Promise<T[]> {
 const target = kind === 'trending' ? 50 : 20;
 const lookupBudget = kind === 'trending' ? 100 : 40;
 const current = () => options.isCurrent?.() ?? true;
 const saved = await readValidatedDiscovery<T>(kind);
 if (!current()) return [];
 const savedByIdentity = new Map(saved.map(book => [identity(book), book]));
 const pool = books.slice(0, 150).map(book => {
  const old = savedByIdentity.get(identity(book));
  return !book.coverUrl && old?.coverBookId && old.coverUrl
   ? { ...book, coverBookId: old.coverBookId, coverUrl: old.coverUrl, coverAlternatives: old.coverAlternatives } : book;
 });
 const prepared = new Map<number, T>();
 pool.forEach((book, index) => { if (hasArtwork(book)) prepared.set(index, book); });
 const ready = () => [...prepared.entries()].sort((a,b) => a[0]-b[0]).map(([,book]) => book).slice(0, 100);
 const eligible = (book: T) => options.isEligible?.(book) ?? true;
 const authors = () => new Set(ready().filter(eligible).map(discoveryAuthorKey).filter(Boolean));
 const enough = () => authors().size >= target;
 const sourceSavedAt = Number.isFinite(options.sourceSavedAt) && options.sourceSavedAt! <= Date.now() ? options.sourceSavedAt! : Date.now();
 const emit = async (cards: T[], persist = true) => {
  if (!current() || !cards.length) return;
  publish(cards);
  options.onProgress?.(cards);
  if (persist) await AsyncStorage.setItem(storageKey(kind), JSON.stringify({ savedAt: sourceSavedAt, books: cards })).catch(() => {});
 };
 // Publish the cached pool first; missing identities never block its display.
 await emit(ready().length ? ready() : saved, ready().length > 0);
 let lookups = 0;
 let offset = 0;
 // At most two missing-book resolutions at once; budgets are 100 for the
 // fifty-author Trending pool and forty for twenty Recent Releases picks.
 // Skip library/excluded candidates and authors that already have a ready book.
 while (current() && !enough() && offset < pool.length && lookups < lookupBudget) {
  const batch: {index: number; book: T}[] = [];
  const selectedAuthors = authors();
  const batchLimit = Math.min(2, target - selectedAuthors.size);
  while (offset < pool.length && batch.length < batchLimit && lookups < lookupBudget) {
   const index = offset++, book = pool[index], author = discoveryAuthorKey(book);
   if (!author || prepared.has(index) || !eligible(book) || (author && selectedAuthors.has(author))) continue;
   if (author) selectedAuthors.add(author);
   batch.push({index, book}); lookups++;
  }
  await Promise.all(batch.map(async ({index,book}) => {
   try {
    const resolved = await fillRead(identity(book), async () => {
     const id = book.coverBookId ?? await resolveDiscoveryBook(book as unknown as DiscoveryBook);
     const url = id ? await resolveCanonicalBookCover({ googleBookId: id }, true) : null;
     const metadata = id ? getCanonicalBookCoverMetadata({googleBookId:id}) : null;
     return id && url ? { ...book, coverBookId: id, coverUrl: url,
      coverProvider: metadata?.provider, coverWorkId: metadata?.workId,
      genres: metadata?.genres.length ? metadata.genres : book.genres } : null;
    });
    if (current() && resolved) prepared.set(index, { ...book, ...resolved } as T);
   } catch { /* Preserve good cards; provider quota/backoff still governs misses. */ }
  }));
  if (current() && batch.length && ready().length) await emit(ready());
 }
 if (!current()) return [];
 return ready().length ? ready() : saved;
}
