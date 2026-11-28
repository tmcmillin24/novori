import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserBook } from './user-books';

export type DiscoverLibraryBook = Pick<UserBook, 'google_book_id' | 'title' | 'authors' | 'isbn' | 'owned' | 'status'>;

const key = (userId: string) => `novori:discover-library:v1:${userId}`;
let writes = Promise.resolve();

function exclusion(book: DiscoverLibraryBook): DiscoverLibraryBook {
  const { google_book_id, title, authors, isbn, owned, status } = book;
  return { google_book_id, title, authors, isbn, owned, status };
}

function valid(value: unknown): value is DiscoverLibraryBook {
  if (!value || typeof value !== 'object') return false;
  const row = value as DiscoverLibraryBook;
  return typeof row.google_book_id === 'string' && typeof row.title === 'string' &&
    Array.isArray(row.authors) && row.authors.every(author => typeof author === 'string') &&
    (row.isbn === null || typeof row.isbn === 'string') &&
    typeof row.owned === 'boolean' && [null, 'want_to_read', 'reading', 'read', 'dnf'].includes(row.status);
}

async function read(userId: string): Promise<DiscoverLibraryBook[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (raw === null) return null;
    const saved: unknown = JSON.parse(raw);
    return Array.isArray(saved) && saved.every(valid) ? saved : null;
  } catch {
    return null;
  }
}

export async function readDiscoverLibrarySnapshot(userId: string) {
  await writes;
  return read(userId);
}

function queueWrite(write: () => Promise<void>) {
  writes = writes.then(write).catch(() => {});
  return writes;
}

export function saveDiscoverLibrarySnapshot(userId: string, books: DiscoverLibraryBook[]) {
  return queueWrite(async () => {
    await AsyncStorage.setItem(key(userId), JSON.stringify(books.filter(book => book.owned || book.status).map(exclusion)));
  });
}

export function patchDiscoverLibrarySnapshot(userId: string, bookId: string, book?: DiscoverLibraryBook) {
  return queueWrite(async () => {
    const existing = await read(userId);
    // Only a completed Library read can establish an authoritative initial snapshot.
    if (!existing) return;
    const next = existing.filter(row => row.google_book_id !== bookId);
    if (book?.owned || book?.status) next.push(exclusion(book));
    await AsyncStorage.setItem(key(userId), JSON.stringify(next));
  });
}
