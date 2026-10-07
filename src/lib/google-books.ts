import { bookWorkDetails } from './book-work-details';
import { createBookReadCache } from './book-read-cache';
import { normalizeIsbnDbEdition } from '../../supabase/functions/_shared/book-edition-metadata';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

type MemoryEntry = {
  expiresAt: number;
  status: number;
  data: unknown;
};

type PersistentBookEntry = {
  id: string;
  savedAt: number;
  data: unknown;
};

type GoogleBooksJsonResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  fromCache: boolean;
  workDetails?: Promise<T>;
};

const SEARCH_CACHE_MS =
  10 * 60 * 1000;

const DETAIL_CACHE_MS =
  30 * 24 * 60 * 60 * 1000;

const MAX_PERSISTED_BOOKS =
  150;

const PERSISTED_INDEX_KEY =
  'novori:google-books:detail-index:v5';

const memoryCache =
  new Map<string, MemoryEntry>();

const volumeMemoryCache =
  new Map<
    string,
    {
      expiresAt: number;
      data: unknown;
    }
  >();

const inFlight =
  new Map<
    string,
    Promise<GoogleBooksJsonResult<unknown>>
  >();

function isVolumeDetailUrl(
  url: string
) {
  return (
    /\/books\/v1\/volumes\/[^?]+(?:\?|$)/.test(
      url
    ) &&
    !url.includes(
      'q='
    )
  );
}

function getVolumeId(
  url: string
) {
  const match =
    url.match(
      /\/books\/v1\/volumes\/([^?]+)/
    );

  return match?.[1]
    ? decodeURIComponent(
        match[1]
      )
    : null;
}

function getSearchQuery(
  url: string
) {
  try {
    const requestUrl =
      new URL(
        url
      );

    if (
      requestUrl.pathname !==
        '/books/v1/volumes' ||
      !requestUrl.searchParams.has(
        'q'
      )
    ) {
      return null;
    }

    return requestUrl.searchParams
      .get(
        'q'
      )
      ?.trim() ||
      null;
  } catch {
    return null;
  }
}

function detailKey(
  id: string
) {
  return `novori:google-books:detail:v5:${id}`;
}

async function readPersistentDetail<T>(id: string): Promise<{ data: T; expiresAt: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(detailKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistentBookEntry;
    const expiresAt = parsed.savedAt + DETAIL_CACHE_MS;
    if (parsed.id !== id || !Number.isFinite(parsed.savedAt) || parsed.savedAt > Date.now() || expiresAt <= Date.now() || !parsed.data) {
      await AsyncStorage.removeItem(detailKey(id));
      return null;
    }
    return { data: parsed.data as T, expiresAt };
  } catch { return null; }
}

let persistenceQueue: Promise<void> = Promise.resolve();
function persistDetail(id: string, data: unknown) {
  // Serialize the read/modify/write index so parallel book loads cannot lose entries.
  persistenceQueue = persistenceQueue.then(async () => {
    try {
      const raw = await AsyncStorage.getItem(PERSISTED_INDEX_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const index: { id: string; savedAt: number }[] = Array.isArray(parsed) ? parsed : [];
      const savedAt = Date.now();
      const nextIndex = [{ id, savedAt }, ...index.filter(entry => entry.id !== id)].slice(0, MAX_PERSISTED_BOOKS);
      const removed = index.filter(entry => !nextIndex.some(kept => kept.id === entry.id));
      await AsyncStorage.multiSet([
        [detailKey(id), JSON.stringify({ id, savedAt, data } satisfies PersistentBookEntry)],
        [PERSISTED_INDEX_KEY, JSON.stringify(nextIndex)],
      ]);
      if (removed.length) await AsyncStorage.multiRemove(removed.map(entry => detailKey(entry.id)));
    } catch { /* Device storage failures must not block book loading. */ }
  });
  return persistenceQueue;
}

async function readCatalogBook<T>(
  googleBookId: string
): Promise<T | null> {
  try {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'google_books_catalog'
        )
        .select(
          'metadata, detail_complete, fetched_at'
        )
        .eq(
          'google_book_id',
          googleBookId
        )
        .maybeSingle();

    if (
      error ||
      !data?.metadata ||
      data.detail_complete !==
        true ||
      Date.parse(data.fetched_at ?? '') + 90 * 86400000 <= Date.now() || !Number.isFinite(Date.parse(data.fetched_at ?? ''))
    ) {
      return null;
    }

    return normalizeIsbnDbEdition(data.metadata) as T;
  } catch {
    return null;
  }
}

async function upsertCatalogBooks(
  books: unknown[],
  detailComplete: boolean
) {
  const rows =
    books
      .filter(
        (
          book
        ): book is {
          id: string;
          [key: string]:
            unknown;
        } =>
          Boolean(
            book &&
            typeof book ===
              'object' &&
            typeof (
              book as {
                id?: unknown;
              }
            ).id ===
              'string'
          )
      )
      .map(
        (
          book
        ) => ({
          google_book_id:
            book.id,
          metadata:
            book,
          fetched_at:
            new Date().toISOString(),
          detail_complete:
            detailComplete,
        })
      );

  if (
    rows.length ===
    0
  ) {
    return;
  }

  try {
    const {
      error,
    } =
      await supabase
        .from(
          'google_books_catalog'
        )
        .upsert(
          rows,
          {
            onConflict:
              'google_book_id',
            ignoreDuplicates:
              !detailComplete,
          }
        );

    if (
      error
    ) {
      console.warn(
        'Could not update Novori book catalog:',
        error
      );
    }
  } catch (
    error
  ) {
    console.warn(
      'Could not update Novori book catalog:',
      error
    );
  }
}

function hasUsablePageCount(
  book: unknown
) {
  if (
    !book ||
    typeof book !==
      'object'
  ) {
    return false;
  }

  const pageCount =
    (
      book as {
        volumeInfo?: {
          pageCount?: unknown;
        };
      }
    ).volumeInfo
      ?.pageCount;

  return (
    typeof pageCount ===
      'number' &&
    Number.isFinite(
      pageCount
    ) &&
    pageCount >
      0
  );
}

function catalogBooksFromPayload(
  payload: unknown,
  detailId: string | null
) {
  if (
    payload &&
    typeof payload ===
      'object' &&
    Array.isArray(
      (
        payload as {
          items?: unknown[];
        }
      ).items
    )
  ) {
    return (
      payload as {
        items: unknown[];
      }
    ).items;
  }

  if (
    detailId &&
    payload &&
    typeof payload ===
      'object'
  ) {
    return [
      payload,
    ];
  }

  return [];
}

type SharedGoogleBooksDetailEnvelope = {
  ok?: boolean;
  status?: number;
  data?: unknown;
  error?: string;
  reason?: string;
  cache?: {
    status?: 'hit' | 'miss' | 'stale';
    googleRequestMade?: boolean;
    expiresAt?: string;
    reason?: string;
  };
  quota?: {
    upstreamRequestsToday?: number;
    userWindowRequests?: number;
    userDailyRequests?: number;
  };
};

async function fetchSharedGoogleBooksDetail(
  volumeId: string
): Promise<
  GoogleBooksJsonResult<unknown>
> {
  try {
    const {
      data,
      error,
    } =
      await supabase.functions.invoke(
        'google-books-detail',
        {
          body: {
            volumeId,
          },
        }
      );

    if (error) {
      console.warn(
        'Shared Google Books detail unavailable:',
        error
      );

      return {
        ok: false,
        status: 503,
        data: null,
        fromCache: false,
      };
    }

    const response =
      data as
        SharedGoogleBooksDetailEnvelope;

    if (
      response?.ok ===
        true &&
      response.data
    ) {
      if (__DEV__) {
        console.log(
          '[Novori book detail cache]',
          {
            cache:
              response.cache
                ?.status ??
              'unknown',
            googleRequestMade:
              response.cache
                ?.googleRequestMade ??
              false,
            quota:
              response.quota ??
              null,
          }
        );
      }

      return {
        ok: true,
        status:
          response.status ??
          200,
        data:
          response.data,
        fromCache:
          response.cache
            ?.status !==
          'miss',
      };
    }

    if (
      response?.ok ===
        false
    ) {
      return {
        ok: false,
        status:
          response.status ??
          500,
        data: null,
        fromCache: false,
      };
    }

    console.warn(
      'Shared Google Books detail returned an unexpected payload.'
    );

    return {
      ok: false,
      status: 502,
      data: null,
      fromCache: false,
    };
  } catch (
    error
  ) {
    console.warn(
      'Shared Google Books detail failed:',
      error
    );

    return {
      ok: false,
      status: 503,
      data: null,
      fromCache: false,
    };
  }
}

async function fetchSharedGoogleBooksSearch(
  query: string, startIndex = 0
): Promise<
  GoogleBooksJsonResult<unknown>
> {
  try {
    const {
      data,
      error,
    } =
      await supabase.functions.invoke(
        'google-books-search',
        {
          body: {
            query,
            startIndex,
          },
        }
      );

    if (error) {
      console.warn(
        'Shared Google Books search unavailable:',
        error
      );

      return {
        ok: false,
        status: 503,
        data: null,
        fromCache: false,
      };
    }

    const response =
      data as
        SharedGoogleBooksDetailEnvelope;

    if (
      response?.ok ===
        true &&
      response.data
    ) {
      if (__DEV__) {
        console.log(
          '[Novori book search cache]',
          {
            cache:
              response.cache
                ?.status ??
              'unknown',
            googleRequestMade:
              response.cache
                ?.googleRequestMade ??
              false,
            quota:
              response.quota ??
              null,
          }
        );
      }

      return {
        ok: true,
        status:
          response.status ??
          200,
        data:
          response.data,
        fromCache:
          response.cache
            ?.status !==
          'miss',
      };
    }

    if (
      response?.ok ===
        false
    ) {
      return {
        ok: false,
        status:
          response.status ??
          500,
        data: null,
        fromCache: false,
      };
    }

    console.warn(
      'Shared Google Books search returned an unexpected payload.'
    );

    return {
      ok: false,
      status: 502,
      data: null,
      fromCache: false,
    };
  } catch (
    error
  ) {
    console.warn(
      'Shared Google Books search failed:',
      error
    );

    return {
      ok: false,
      status: 503,
      data: null,
      fromCache: false,
    };
  }
}

export type GoogleBooksIdentityResult = {
  ok: boolean;
  status: number;
  googleBookId: string | null;
  fromCache: boolean;
  googleRequestMade: boolean;
  quota: {
    upstreamRequestsToday?: number;
    userWindowRequests?: number | null;
    userDailyRequests?: number | null;
  } | null;
};

const readBookIdentity = createBookReadCache<GoogleBooksIdentityResult>();
export function resolveGoogleBooksIdentity(input: { title: string; author?: string; isbn?: string }) {
  return readBookIdentity(JSON.stringify([input.title, input.author ?? '', input.isbn ?? '']),
    () => loadGoogleBooksIdentity(input), value => value.ok && Boolean(value.googleBookId));
}

async function loadGoogleBooksIdentity(
  input: {
    title: string;
    author?: string;
    isbn?: string;
  }
): Promise<GoogleBooksIdentityResult> {
  try {
    const {
      data,
      error,
    } =
      await supabase.functions.invoke(
        'google-books-resolve',
        {
          body: {
            mode:
              'identity',
            title:
              input.title,
            author:
              input.author,
            isbn:
              input.isbn,
          },
        }
      );

    if (error) {
      console.warn(
        'Shared Google Books identity resolver unavailable:',
        error
      );

      return {
        ok: false,
        status: 503,
        googleBookId: null,
        fromCache: false,
        googleRequestMade: false,
        quota: null,
      };
    }

    const response =
      data as
        SharedGoogleBooksDetailEnvelope & {
          data?: {
            kind?:
              | 'identity'
              | 'trending'
              | 'isbn';
            googleBookId?:
              string | null;
          } | null;
        };

    if (
      response?.ok ===
        true &&
      response.data
    ) {
      if (__DEV__) {
        console.log(
          '[Novori book identity cache]',
          {
            cache:
              response.cache
                ?.status ??
              'unknown',
            googleRequestMade:
              response.cache
                ?.googleRequestMade ??
              false,
            quota:
              response.quota ??
              null,
          }
        );
      }

      return {
        ok: true,
        status:
          response.status ??
          200,
        googleBookId:
          response.data
            .googleBookId ??
          null,
        fromCache:
          response.cache
            ?.status !==
          'miss',
        googleRequestMade:
          response.cache
            ?.googleRequestMade ??
          false,
        quota:
          response.quota ??
          null,
      };
    }

    return {
      ok: false,
      status:
        response?.status ??
        500,
      googleBookId: null,
      fromCache: false,
      googleRequestMade: false,
      quota:
        response?.quota ??
        null,
    };
  } catch (
    error
  ) {
    console.warn(
      'Shared Google Books identity resolver failed:',
      error
    );

    return {
      ok: false,
      status: 503,
      googleBookId: null,
      fromCache: false,
      googleRequestMade: false,
      quota: null,
    };
  }
}

export async function fetchGoogleBooksJson<T>(url: string, options?: {
  cachedFirst?: boolean;
  onWorkDetails?: (book: T) => void;
}): Promise<GoogleBooksJsonResult<T>> {
  const result = await loadGoogleBooksJson<T>(url);
  // Apply current metadata rules even to older memory, device, and server rows.
  if (isVolumeDetailUrl(url) && result.data && typeof result.data === 'object' && 'volumeInfo' in result.data) {
    const edition = normalizeIsbnDbEdition(result.data as any);
    if (options?.cachedFirst) {
      const known = bookWorkDetails.peek(edition);
      if (known) return { ...result, data: known as T };
      // Keep the existing deduplicated work lookup, but never hold cached edition
      // data behind it. No raw memory/device/catalog cache rows are rewritten.
      const workDetails = bookWorkDetails.resolve(edition) as Promise<T>;
      void workDetails.then(book => options.onWorkDetails?.(book)).catch(() => {});
      return { ...result, data: edition as T, workDetails };
    }
    return { ...result, data: await bookWorkDetails.resolve(edition) as T };
  }
  return result;
}

async function loadGoogleBooksJson<T>(url: string): Promise<GoogleBooksJsonResult<T>> {
  const detailId = isVolumeDetailUrl(url) ? getVolumeId(url) : null;
  const searchQuery = detailId ? null : getSearchQuery(url);
  const startIndex = searchQuery ? Math.max(0, Number(new URL(url).searchParams.get('startIndex') ?? 0) || 0) : 0;
  const key = detailId ? 'detail:' + detailId : 'search:' + (searchQuery ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim() + ':' + startIndex;
  const memory = memoryCache.get(key);
  if (memory && memory.expiresAt > Date.now()) return { ok: memory.status >= 200 && memory.status < 300, status: memory.status, data: memory.data as T, fromCache: true };
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<GoogleBooksJsonResult<T>>;
  const request = (async () => {
    if (detailId) {
      const primed = volumeMemoryCache.get(detailId);
      if (primed && primed.expiresAt > Date.now()) return { ok: true, status: 200, data: primed.data, fromCache: true };
      const persisted = await readPersistentDetail<unknown>(detailId);
      if (persisted) {
        volumeMemoryCache.set(detailId, persisted);
        memoryCache.set(key, { ...persisted, status: 200 });
        return { ok: true, status: 200, data: persisted.data, fromCache: true };
      }
      const catalog = await readCatalogBook<unknown>(detailId);
      if (catalog) {
        const expiresAt = Date.now() + DETAIL_CACHE_MS;
        volumeMemoryCache.set(detailId, { data: catalog, expiresAt });
        memoryCache.set(key, { data: catalog, expiresAt, status: 200 });
        void persistDetail(detailId, catalog);
        return { ok: true, status: 200, data: catalog, fromCache: true };
      }
    }
    const result = detailId ? await fetchSharedGoogleBooksDetail(detailId)
      : searchQuery ? await fetchSharedGoogleBooksSearch(searchQuery, startIndex)
      : { ok: false, status: 400, data: null, fromCache: false };
    if (!result.ok || !result.data) {
      // Short local backoff avoids repeated edge-function calls during provider outages.
      memoryCache.set(key, { data: null, status: result.status, expiresAt: Date.now() + 30_000 });
      return result;
    }
    const catalogBooks = catalogBooksFromPayload(result.data, detailId);
    if (catalogBooks.length && !result.fromCache) void upsertCatalogBooks(catalogBooks, Boolean(detailId));
    const expiresAt = Date.now() + (detailId ? DETAIL_CACHE_MS : SEARCH_CACHE_MS);
    memoryCache.set(key, { data: result.data, status: result.status, expiresAt });
    if (memoryCache.size > 300) memoryCache.delete(memoryCache.keys().next().value!);
    if (detailId) {
      volumeMemoryCache.set(detailId, { data: result.data, expiresAt });
      void persistDetail(detailId, result.data);
    }
    return result;
  })();
  inFlight.set(key, request);
  try { return await request as GoogleBooksJsonResult<T>; }
  finally { inFlight.delete(key); }
}
