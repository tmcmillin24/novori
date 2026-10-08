import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { resolveDiscoveryBook } from './resolve-discovery-book';
import type { DiscoveryBook } from './discovery-books';
import { resolveCanonicalBookCover, publishCatalogCovers } from './canonical-book-covers';
import { moderationMediaUrl } from './moderation-media-url';

type Card = { coverBookId?: string | null; coverUrl: string | null; coverPolicyVersion?: number;
 rejectedCoverUrls?: string[];
 coverAlternatives?: { url: string; bookId: string; locked?: boolean }[] };
const checks = new Map<string, { expires: number; promise: Promise<boolean> }>();
const DAY = 86400000;
const storageKey = (kind: string) => `novori:validated-discovery:v7:${kind}`;

export function validateDiscoveryImage(url: string): Promise<boolean> {
 const old = checks.get(url);
 if (old && old.expires > Date.now()) return old.promise;
 const promise = new Promise<boolean>(resolve => {
  const timer = setTimeout(() => resolve(false), 6000);
  const finish = (valid: boolean) => { clearTimeout(timer); resolve(valid); };
  Image.getSize(moderationMediaUrl(url) ?? url, (width, height) => {
   if (!(width >= 80 && height >= 120 && width / height >= 0.4 && width / height <= 0.95)) { finish(false); return; }
   void ExpoImage.prefetch(moderationMediaUrl(url) ?? url, { cachePolicy: 'memory-disk' }).then(finish, () => finish(false));
  }, () => finish(false));
 });
 checks.set(url, { expires: Date.now() + DAY, promise });
 void promise.then(valid => { if (!valid) checks.delete(url); });
 while (checks.size > 500) checks.delete(checks.keys().next().value!);
 return promise;
}
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
  const cards = saved.books.filter((row: Card) => row.coverPolicyVersion === 7 && row.coverBookId && row.coverUrl).slice(0, 60);
  publish(cards);
  return cards;
 } catch { return []; }
}

export async function prepareDiscovery<T extends Card>(kind: string, books: T[]): Promise<T[]> {
 const ready: T[] = [];
 let missingLookups = 0;
 // Validate in ranked order, four downloads at a time. No provider API calls.
 for (let offset = 0; offset < books.length && ready.length < 60; offset += 4) {
  const batch = await Promise.all(books.slice(offset, offset + 4).map(async book => {
   if (book.coverPolicyVersion !== 7) return null;
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
   const choices = [{ url: book.coverUrl!, bookId: book.coverBookId! }, ...(book.coverAlternatives ?? [])];
   const seen = new Set<string>();
   for (const choice of choices.slice(0, 8)) {
    if (seen.has(choice.url)) continue;
    seen.add(choice.url);
    if (await validateDiscoveryImage(choice.url)) return { ...book, coverUrl: choice.url, coverBookId: choice.bookId, rejectedCoverUrls: [...seen].filter(url => url !== choice.url), coverAlternatives: choices.filter(row => row.url === choice.url || !seen.has(row.url)) };
   }
   return null;
  }));
  for (const book of batch) if (book) ready.push(book as T);
 }
 if (!ready.length) return readValidatedDiscovery<T>(kind);
 publish(ready);
 await AsyncStorage.setItem(storageKey(kind), JSON.stringify({ savedAt: Date.now(), books: ready })).catch(() => {});
 return ready;
}
