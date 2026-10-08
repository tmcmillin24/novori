import { createBookReadCache } from './book-read-cache';
import { matchesSeriesCatalogEdition } from '../../supabase/functions/_shared/series-book-catalog';

export type DiscoveryBook = {
  id: number;
  title: string;
  authors: string[];
  isbns: string[];
  coverUrl: string | null;
  coverBookId?: string | null;
  coverPolicyVersion?: number;
  coverProvider?: string;
  coverAliases?: string[];
  coverWorkId?: string;
  genres?: string[];
  releaseDate?: string | null;
  releaseYear?: number | null;
  rating?: number | null;
  description?: string | null;
};
type Identity = Pick<DiscoveryBook, 'id' | 'title' | 'authors'>;
const known = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;
const text = (value: string) => value.normalize('NFKC').toLowerCase().trim();
const identityKey = (book: Identity) => JSON.stringify([book.id, text(book.title), book.authors.map(text).sort()]);

export function getDiscoveryBookId(book: Identity & { coverBookId?: string | null; coverPolicyVersion?: number }) {
  return book.coverPolicyVersion === 7 ? book.coverBookId ?? known.get(identityKey(book)) ?? null : known.get(identityKey(book)) ?? book.coverBookId ?? null;
}
export function rememberDiscoveryBookId(book: Identity, bookId: string) {
  if (!Number.isSafeInteger(book.id) || book.id <= 0 || !/^[A-Za-z0-9_-]{1,200}$/.test(bookId)) return;
  const key = identityKey(book);
  if (known.get(key) === bookId) return;
  known.delete(key);
  known.set(key, bookId);
  while (known.size > 500) known.delete(known.keys().next().value!);
  version++;
  listeners.forEach(listener => listener());
}
export function getDiscoveryBookVersion() { return version; }
export function subscribeDiscoveryBooks(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Hardcover ISBNs can identify a different printing or even a different work.
// Never use them as cover aliases before title/author verification establishes ID.
export function discoveryCoverInput(book: DiscoveryBook) {
  return { googleBookId: getDiscoveryBookId(book), existingCoverUrl: book.coverUrl };
}

type Candidate = { id: string; volumeInfo: { title?: string; authors?: string[]; language?: string } };
type Lookup = (input: { title: string; author?: string; isbn?: string }) => Promise<{ ok: boolean; status: number; googleBookId: string | null }>;
export function createDiscoveryBookResolver(lookup: Lookup, search: (title: string) => Promise<Candidate[]>) {
  const read = createBookReadCache<string | null>(5 * 60_000, 150);
  return async (book: DiscoveryBook): Promise<string | null> => {
    const existing = getDiscoveryBookId(book);
    if (existing) return existing;
    const id = await read(identityKey(book), async () => {
      const isbns = [...new Set(book.isbns.map(value => value.replace(/[\s-]/g, '').toUpperCase()))]
        .filter(value => /^(?:[0-9]{13}|[0-9]{9}[0-9X])$/.test(value)).slice(0, 6);
      const first = await lookup({ title: book.title, author: book.authors[0], isbn: isbns[0] });
      if (!first.ok) throw new Error('Book details are temporarily unavailable.');
      if (first.googleBookId) return first.googleBookId;
      // Title-only shared search finds books omitted by a combined title/author
      // provider query, but still requires the same verified title and author.
      const match = (await search(book.title)).find(candidate => matchesSeriesCatalogEdition(book, { metadata: candidate }));
      if (match) return match.id;
      for (const isbn of isbns.slice(1)) {
        const result = await lookup({ title: book.title, author: book.authors[0], isbn });
        if (!result.ok) throw new Error('Book details are temporarily unavailable.');
        if (result.googleBookId) return result.googleBookId;
      }
      return null;
    }, value => value !== null);
    if (id) rememberDiscoveryBookId(book, id);
    return id;
  };
}

export function parseDiscoveryBook(raw: string | undefined): DiscoveryBook | null {
  try {
    if (!raw || raw.length > 16_000) return null;
    const book = JSON.parse(raw);
    if (!Number.isSafeInteger(book.id) || book.id <= 0 || typeof book.title !== 'string' || !book.title.trim() || book.title.length > 1000 ||
        !Array.isArray(book.authors) || book.authors.length > 20 || book.authors.some((author: unknown) => typeof author !== 'string' || author.length > 300) ||
        !Array.isArray(book.isbns) || book.isbns.length > 100 || book.isbns.some((isbn: unknown) => typeof isbn !== 'string' || isbn.length > 30)) return null;
    return { id: book.id, title: book.title, authors: book.authors, isbns: book.isbns,
      coverBookId: typeof book.coverBookId === 'string' && book.coverBookId.length <= 300 ? book.coverBookId : null,
      coverUrl: typeof book.coverUrl === 'string' && /^https?:\/\/[^\s]+$/i.test(book.coverUrl) && book.coverUrl.length <= 4096 ? book.coverUrl : null,
      releaseDate: typeof book.releaseDate === 'string' ? book.releaseDate.slice(0, 30) : null,
      releaseYear: Number.isInteger(book.releaseYear) ? book.releaseYear : null,
      rating: typeof book.rating === 'number' && book.rating >= 0 && book.rating <= 5 ? book.rating : null,
      description: typeof book.description === 'string' ? book.description.slice(0, 8000) : null,
    };
  } catch { return null; }
}
