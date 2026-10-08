import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveDiscoveryBook } from './resolve-discovery-book';
import type { DiscoveryBook } from './discovery-books';
import { resolveCanonicalBookCover, publishCatalogCovers } from './canonical-book-covers';

type Card = { coverBookId?: string | null; coverUrl: string | null; coverPolicyVersion?: number;
 rejectedCoverUrls?: string[];
 coverAlternatives?: { url: string; bookId: string; locked?: boolean }[] };
const DAY = 86400000;
const storageKey = (kind: string) => `novori:validated-discovery:v7:${kind}`;

function publish(cards: Card[]) {
 const covers: Record<string, string> = {}, details: Record<string, any> = {};
 for (const card of cards) if (card.coverBookId && card.coverUrl) {
  covers[card.coverBookId] = card.coverUrl;
  details[card.coverBookId] = { workId: `edition:${card.coverBookId}`, rejectedUrls: card.rejectedCoverUrls ?? [], locked: card.coverAlternatives?.some(choice => choice.url === card.coverUrl && choice.locked) ?? false, alternatives: [...new Set([card.coverUrl, ...(card.coverAlternatives ?? []).map(choice => choice.url)])] };
 }
 publishCatalogCovers(covers, details);
}
export async function readValidatedDiscovery<T extends Card>(kind: string): Promise<T[]> {
 try {
  const saved = JSON.parse(await AsyncStorage.getItem(storageKey(kind)) ?? 'null');
  if (!saved || Date.now() - saved.savedAt > 7 * DAY || !Array.isArray(saved.books)) return [];
  const cards = saved.books.filter((row: Card) => row.coverBookId && row.coverUrl).slice(0, 60);
  publish(cards);
  return cards;
 } catch { return []; }
}

export async function prepareDiscovery<T extends Card>(kind: string, books: T[]): Promise<T[]> {
 const ready: T[] = books.filter(book => book.coverBookId && book.coverUrl).slice(0, 60);
 let missingLookups = 0;
 // Cached catalog cards need neither image checks nor identity/API requests.
 // Resolve a bounded cold feed only when there are no ready catalog cards.
 for (let offset = 0; !ready.length && offset < Math.min(books.length, 6); offset += 4) {
  const batch = await Promise.all(books.slice(offset, Math.min(offset + 4, 6)).map(async book => {
   if (!book.coverBookId || !book.coverUrl) {
    // Only fill a bounded number of catalog misses; normal cached cards need no provider call.
    if (++missingLookups > 6) return null;
    try {
     const id = await resolveDiscoveryBook(book as unknown as DiscoveryBook);
     const url = id ? await resolveCanonicalBookCover({ googleBookId: id }, true) : null;
     if (!id || !url) return null;
     book = { ...book, coverBookId: id, coverUrl: url };
    } catch { return null; }
   }
   return book;
  }));
  for (const book of batch) if (book) ready.push(book as T);
 }
 if (!ready.length) return readValidatedDiscovery<T>(kind);
 publish(ready);
 await AsyncStorage.setItem(storageKey(kind), JSON.stringify({ savedAt: Date.now(), books: ready })).catch(() => {});
 return ready;
}
