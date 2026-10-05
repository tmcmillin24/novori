import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cachedProviderValue, createCacheAdmin, fetchJsonWithTimeout, requireReader } from './provider-cache.ts';
import { recordGoogleBooksInCatalog } from './book-catalog.ts';

export const isbnDbEnabled = () => Deno.env.get('NOVORI_BOOK_PROVIDER') === 'isbndb';
const PROVIDER = 'isbndb';
const DAY = 86_400_000;
type Book = { id: string; source: { provider: string; isbn13: string }; volumeInfo: any };

export function validIsbn13(value: unknown): string | null {
  const text = typeof value === 'string' ? value.replace(/[\s-]/g, '') : '';
  if (!/^(978|979)\d{10}$/.test(text)) return null;
  const sum = [...text].reduce((total, digit, i) => total + Number(digit) * (i % 2 ? 3 : 1), 0);
  return sum % 10 === 0 ? text : null;
}

export function isbn13From10(value: string): string | null {
  const text = value.replace(/[\s-]/g, '').toUpperCase();
  if (!/^\d{9}[\dX]$/.test(text)) return null;
  if ([...text].reduce((n, d, i) => n + (d === 'X' ? 10 : Number(d)) * (10 - i), 0) % 11) return null;
  const first = '978' + text.slice(0, 9);
  const sum = [...first].reduce((n, d, i) => n + Number(d) * (i % 2 ? 3 : 1), 0);
  return first + ((10 - sum % 10) % 10);
}

function normalize(text: string) {
  return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function identityMatches(book: Book, title: string, author = '') {
  const actual = normalize(book.volumeInfo.title ?? '').split(/\s+/);
  const wanted = normalize(title).split(/\s+/).filter(Boolean);
  const by = normalize((book.volumeInfo.authors ?? []).join(' ')).split(/\s+/);
  // Match complete title words, and author prefixes (Freida vs Freida McFadden).
  return wanted.length > 0 && wanted.every(word => actual.includes(word))
    && normalize(author).split(/\s+/).filter(Boolean).every(word => by.some(part => part.startsWith(word)));
}

export function adaptIsbnDbBook(raw: any, id?: string): Book | null {
  const isbn = validIsbn13(raw?.isbn13) ?? validIsbn13(raw?.isbn) ?? isbn13From10(String(raw?.isbn10 ?? raw?.isbn ?? ''));
  if (!isbn || typeof raw?.title !== 'string' || !raw.title.trim()) return null;
  let image: string | undefined;
  try {
    const url = new URL(raw.image);
    if (url.protocol === 'https:' && url.hostname === 'images.isbndb.com' && !/placeholder|no[-_]?image|no[-_]?cover|default/i.test(url.pathname) && !url.username && !url.password) image = url.toString();
  } catch { /* Missing artwork is normal. Never persist expiring image_original links. */ }
  return {
    id: id ?? `nv_${isbn}`,
    source: { provider: PROVIDER, isbn13: isbn },
    volumeInfo: {
      title: raw.title.trim(), authors: Array.isArray(raw.authors) ? raw.authors.filter((v: unknown) => typeof v === 'string') : [],
      publisher: typeof raw.publisher === 'string' ? raw.publisher : undefined,
      publishedDate: typeof raw.date_published === 'string' ? raw.date_published : undefined,
      description: typeof raw.synopsis === 'string' ? raw.synopsis : undefined,
      pageCount: Number.isInteger(raw.pages) && raw.pages > 0 ? raw.pages : undefined,
      language: ({ eng: 'en', fra: 'fr', spa: 'es', deu: 'de' } as Record<string, string>)[raw.language] ?? raw.language,
      categories: Array.isArray(raw.subjects) ? raw.subjects : [],
      industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }, ...(typeof raw.isbn10 === 'string' && isbn13From10(raw.isbn10) === isbn ? [{ type: 'ISBN_10', identifier: raw.isbn10 }] : [])],
      // These are compatibility rendition slots, not a claim of original resolution.
      imageLinks: image ? { thumbnail: image, small: image, medium: image } : undefined,
    },
  };
}

async function upstream(admin: SupabaseClient, userId: string, path: string) {
  const key = Deno.env.get('ISBNDB_API_KEY');
  if (!key) throw new Error('ISBNdb credentials are not configured.');
  const deadline = Date.now() + 8000;
  while (true) {
    const { data, error } = await admin.rpc('novori_claim_isbndb_request', { p_user_id: userId || null });
    if (error) throw new Error('ISBNdb quota controls are unavailable. Apply the ISBNdb migration first.');
    const claim = Array.isArray(data) ? data[0] : data;
    if (claim?.allowed) break;
    if (claim?.reason !== 'rate_limit' || Date.now() >= deadline) {
      const blocked = new Error('Book lookup is busy or has reached its usage allowance. Please try again shortly.');
      blocked.name = 'CacheQuotaBlocked';
      throw blocked;
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(1200, Math.max(100, Number(claim.retry_ms) || 250))));
  }
  const response = await fetchJsonWithTimeout('https://api2.isbndb.com' + path, { headers: { Authorization: key } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`ISBNdb lookup unavailable (${response.status}).`);
  return response.json();
}

async function attachIdentities(admin: SupabaseClient, books: Book[]): Promise<Book[]> {
  if (!books.length) return [];
  const isbns = [...new Set(books.map(book => book.source.isbn13))];
  const { data: aliases, error } = await admin.from('novori_book_provider_ids').select('isbn13,book_id').in('isbn13', isbns);
  if (error) throw new Error('Could not read book identity mappings.');
  const ids = new Map<string, string>((aliases ?? []).map((row: any) => [row.isbn13, row.book_id]));
  const missing = books.filter(book => !ids.has(book.source.isbn13));
  if (missing.length) {
    const { data: old, error: oldError } = await admin.from('book_editions').select('isbn_13,provider_book_id,metadata')
      .eq('provider', 'google_books').in('isbn_13', missing.map(book => book.source.isbn13));
    if (oldError) throw new Error('Could not verify existing book identities.');
    const entries = missing.map(book => {
      const matching = (old ?? []).filter((row: any) => row.isbn_13 === book.source.isbn13 && row.metadata
        && identityMatches(row.metadata as Book, book.volumeInfo.title, (book.volumeInfo.authors ?? []).join(' ')));
      const id = matching.sort((a: any, b: any) => a.provider_book_id.localeCompare(b.provider_book_id))[0]?.provider_book_id ?? book.id;
      return { isbn13: book.source.isbn13, book_id: id };
    });
    const unique = [...new Map(entries.map(row => [row.isbn13, row])).values()];
    const { error: writeError } = await admin.from('novori_book_provider_ids').upsert(unique, { onConflict: 'isbn13', ignoreDuplicates: true });
    if (writeError) throw new Error('Could not save book identity mappings.');
    // A simultaneous first lookup may have established an alias already.
    const { data: saved, error: readError } = await admin.from('novori_book_provider_ids').select('isbn13,book_id').in('isbn13', isbns);
    if (readError) throw new Error('Could not confirm book identity mappings.');
    for (const row of saved ?? []) ids.set(row.isbn13, row.book_id);
  }
  if (isbns.some(isbn => !ids.has(isbn))) throw new Error('Book identity mapping is incomplete.');
  return books.map(book => ({ ...book, id: ids.get(book.source.isbn13)! }));
}

async function ingest(admin: SupabaseClient, raw: any): Promise<Book | null> {
  const mapped = adaptIsbnDbBook(raw);
  if (!mapped) return null;
  return (await attachIdentities(admin, [mapped]))[0];
}

async function catalog(admin: SupabaseClient, books: Book[], complete = true) {
  if (!books.length) return;
  // This legacy column stores Novori's compatibility ID; source records remain explicitly ISBNdb.
  const { error } = await admin.from('google_books_catalog').upsert(books.map(book => ({
    google_book_id: book.id, metadata: book, detail_complete: complete, fetched_at: new Date().toISOString(),
  })), { onConflict: 'google_book_id', ignoreDuplicates: !complete });
  if (error) throw new Error('Could not save ISBNdb book details.');
  await recordGoogleBooksInCatalog(admin, { items: books }, complete, 'isbndb_lookup', PROVIDER);
}

async function lookup(admin: SupabaseClient, userId: string, isbn: string): Promise<Book | null> {
  return cachedProviderValue({ admin, provider: PROVIDER, key: `book:v1:${isbn}`, leaseSeconds: 60, freshMs: DAY, staleMs: 7 * DAY,
    load: async () => {
      const raw = await upstream(admin, userId, '/book/' + isbn);
      const book = raw?.book ? await ingest(admin, raw.book) : null;
      if (book && book.source.isbn13 !== isbn) throw new Error('ISBNdb returned a different edition.');
      await catalog(admin, book ? [book] : []);
      return book;
    },
  });
}

export async function isbnDbSearch(admin: SupabaseClient, userId: string, query: string, startIndex = 0) {
  if (typeof query !== 'string' || query.length < 2 || query.length > 200 || !Number.isInteger(startIndex) || startIndex < 0 || startIndex > 1000) throw new Error('Invalid book search.');
  const isbnText = query.replace(/^isbn:/i, '').trim();
  const isbn = validIsbn13(isbnText) ?? isbn13From10(isbnText);
  if (isbn) { const book = await lookup(admin, userId, isbn); return { items: book ? [book] : [], totalItems: book ? 1 : 0 }; }
  const text = query.replace(/\b(?:intitle|inauthor):/gi, '').replace(/"/g, '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 150) throw new Error('Book search must be no longer than 150 characters.');
  const page = Math.floor(startIndex / 40) + 1;
  return cachedProviderValue({ admin, provider: PROVIDER, key: `search:v1:${text.toLowerCase()}:${page}`, leaseSeconds: 60, freshMs: DAY, staleMs: 7 * DAY,
    load: async () => {
      const raw = await upstream(admin, userId, `/books/${encodeURIComponent(text)}?page=${page}&pageSize=40`);
      if (!raw || !Array.isArray(raw.books)) throw new Error('ISBNdb returned an invalid search response.');
      const mapped = raw.books.map((item: any) => adaptIsbnDbBook(item)).filter((book: Book | null): book is Book => Boolean(book));
      const linked = await attachIdentities(admin, mapped);
      const books = [...new Map(linked.map(book => [book.id, book])).values()];
      await catalog(admin, books, false);
      return { items: books, totalItems: Number(raw.total) || books.length };
    },
  });
}

async function detail(admin: SupabaseClient, userId: string, id: string) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new Error('Invalid book identifier.');
  let isbn = validIsbn13(id.replace(/^nv_/, ''));
  if (!isbn) {
    const { data, error } = await admin.from('book_editions').select('isbn_13,isbn_10').eq('provider_book_id', id).limit(20);
    if (error) throw new Error('Could not read existing book mapping.');
    isbn = (data ?? []).map((row: any) => validIsbn13(row.isbn_13) ?? isbn13From10(row.isbn_10 ?? '')).find(Boolean) ?? null;
  }
  if (!isbn) return null;
  const book = await lookup(admin, userId, isbn);
  return book ? { ...book, id } : null;
}

export async function handleIsbnDbRequest(request: Request, kind: 'search' | 'detail' | 'resolve') {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return json({ ok: false, status: 405, error: 'Method not allowed.' }, 405);
  try {
    const admin = createCacheAdmin();
    let user;
    try { user = await requireReader(admin, request); } catch { return json({ ok: false, status: 401, error: 'A valid reader session is required.' }, 401); }
    const body = await request.json();
    let data: unknown;
    if (kind === 'search') data = await isbnDbSearch(admin, user.id, body.query, body.startIndex ?? 0);
    else if (kind === 'detail') {
      data = await detail(admin, user.id, body.volumeId);
      if (!data) return json({ ok: false, status: 404, error: 'This book edition is unavailable.' });
    } else {
      if (!['isbn', 'identity', 'trending'].includes(body.mode)) throw new Error('Invalid resolver mode.');
      if (body.mode === 'isbn') {
        const isbn = validIsbn13(body.isbn) ?? isbn13From10(String(body.isbn ?? ''));
        if (!isbn) throw new Error('Invalid ISBN.');
        data = { kind: 'isbn', book: await lookup(admin, user.id, isbn) };
      } else {
        if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 150 || (body.author != null && (typeof body.author !== 'string' || body.author.length > 150))) throw new Error('Invalid book identity.');
        const isbn = validIsbn13(body.isbn) ?? isbn13From10(String(body.isbn ?? ''));
        let book = isbn ? await lookup(admin, user.id, isbn) : null;
        if (book && !identityMatches(book, body.title, body.author)) book = null;
        if (!book) {
          const found = await isbnDbSearch(admin, user.id, [body.title, body.author].filter(Boolean).join(' '));
          book = found.items.find(item => identityMatches(item, body.title, body.author)) ?? null;
        }
        data = { kind: body.mode, googleBookId: book?.id ?? null };
      }
    }
    return json({ ok: true, status: 200, data, provider: PROVIDER, cache: { status: 'shared', googleRequestMade: false } });
  } catch (error) {
    console.warn('ISBNdb book lookup failed:', error instanceof Error ? error.message : 'unknown');
    return json({ ok: false, status: error instanceof Error && error.name === 'CacheQuotaBlocked' ? 429 : 503, error: 'Book lookup is temporarily unavailable. Please try again shortly.' });
  }
}
