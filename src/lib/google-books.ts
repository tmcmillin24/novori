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
};

const SEARCH_CACHE_MS =
  10 * 60 * 1000;

const DETAIL_CACHE_MS =
  30 * 24 * 60 * 60 * 1000;

const RATE_LIMIT_COOLDOWN_MS =
  60 * 1000;

const MAX_PERSISTED_BOOKS =
  150;

const PERSISTED_INDEX_KEY =
  'novori:google-books:detail-index:v3';

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

let rateLimitedUntil =
  0;

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

function detailKey(
  id: string
) {
  return `novori:google-books:detail:v3:${id}`;
}

async function readPersistentDetail<T>(
  id: string
): Promise<T | null> {
  try {
    const raw =
      await AsyncStorage.getItem(
        detailKey(
          id
        )
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(
        raw
      ) as PersistentBookEntry;

    if (
      Date.now() -
        parsed.savedAt >
      DETAIL_CACHE_MS
    ) {
      await AsyncStorage.removeItem(
        detailKey(
          id
        )
      );
      return null;
    }

    return parsed.data as T;
  } catch {
    return null;
  }
}

async function persistDetail(
  id: string,
  data: unknown
) {
  try {
    const rawIndex =
      await AsyncStorage.getItem(
        PERSISTED_INDEX_KEY
      );

    const index =
      rawIndex
        ? (
            JSON.parse(
              rawIndex
            ) as {
              id: string;
              savedAt: number;
            }[]
          )
        : [];

    const now =
      Date.now();

    const nextIndex = [
      {
        id,
        savedAt:
          now,
      },
      ...index.filter(
        (
          entry
        ) =>
          entry.id !==
          id
      ),
    ].slice(
      0,
      MAX_PERSISTED_BOOKS
    );

    const removed =
      index.filter(
        (
          entry
        ) =>
          !nextIndex.some(
            (
              kept
            ) =>
              kept.id ===
              entry.id
          )
      );

    await AsyncStorage.multiSet([
      [
        detailKey(
          id
        ),
        JSON.stringify({
          id,
          savedAt:
            now,
          data,
        } satisfies PersistentBookEntry),
      ],
      [
        PERSISTED_INDEX_KEY,
        JSON.stringify(
          nextIndex
        ),
      ],
    ]);

    if (
      removed.length >
      0
    ) {
      await AsyncStorage.multiRemove(
        removed.map(
          (
            entry
          ) =>
            detailKey(
              entry.id
            )
        )
      );
    }
  } catch {
    // Cache failures should never block book loading.
  }
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
          'metadata, detail_complete'
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
      !hasUsablePageCount(
        data.metadata
      )
    ) {
      return null;
    }

    return data.metadata as T;
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

export async function fetchGoogleBooksJson<T>(
  url: string
): Promise<GoogleBooksJsonResult<T>> {
  const now =
    Date.now();

  const memory =
    memoryCache.get(
      url
    );

  if (
    memory &&
    memory.expiresAt >
      now
  ) {
    return {
      ok:
        memory.status >=
          200 &&
        memory.status <
          300,
      status:
        memory.status,
      data:
        memory.data as T,
      fromCache:
        true,
    };
  }

  const detailId =
    isVolumeDetailUrl(
      url
    )
      ? getVolumeId(
          url
        )
      : null;

  if (detailId) {
    const primedVolume =
      volumeMemoryCache.get(
        detailId
      );

    if (
      primedVolume &&
      primedVolume.expiresAt >
        now
    ) {
      void persistDetail(
        detailId,
        primedVolume.data
      );

      return {
        ok: true,
        status: 200,
        data:
          primedVolume.data as T,
        fromCache:
          true,
      };
    }

    const persisted =
      await readPersistentDetail<T>(
        detailId
      );

    if (persisted) {
      memoryCache.set(
        url,
        {
          expiresAt:
            now +
            DETAIL_CACHE_MS,
          status:
            200,
          data:
            persisted,
        }
      );

      return {
        ok: true,
        status: 200,
        data:
          persisted,
        fromCache:
          true,
      };
    }


  }

  if (
    rateLimitedUntil >
    now
  ) {
    return {
      ok: false,
      status: 429,
      data: null,
      fromCache:
        false,
    };
  }

  const existing =
    inFlight.get(
      url
    );

  if (existing) {
    return existing as Promise<
      GoogleBooksJsonResult<T>
    >;
  }

  const request =
    (async () => {
      const apiKey =
        process.env
          .EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;

      if (
        !apiKey
      ) {
        return {
          ok: false,
          status: 500,
          data: null,
          fromCache:
            false,
        } satisfies GoogleBooksJsonResult<unknown>;
      }

      const requestUrl =
        new URL(
          url
        );

      requestUrl.searchParams.set(
        'key',
        apiKey
      );

      const response =
        await fetch(
          requestUrl.toString()
        );

      if (
        response.status ===
        429
      ) {
        rateLimitedUntil =
          Date.now() +
          RATE_LIMIT_COOLDOWN_MS;

        return {
          ok: false,
          status: 429,
          data: null,
          fromCache:
            false,
        } satisfies GoogleBooksJsonResult<unknown>;
      }

      if (
        !response.ok
      ) {
        return {
          ok: false,
          status:
            response.status,
          data: null,
          fromCache:
            false,
        } satisfies GoogleBooksJsonResult<unknown>;
      }

      const data =
        await response.json();

      const catalogBooks =
        catalogBooksFromPayload(
          data,
          detailId
        );

      if (
        catalogBooks.length >
        0
      ) {
        if (
          detailId
        ) {
          void upsertCatalogBooks(
            catalogBooks,
            true
          );
        } else {
          void upsertCatalogBooks(
            catalogBooks,
            false
          );
        }
      }

      memoryCache.set(
        url,
        {
          expiresAt:
            Date.now() +
            (
              detailId
                ? DETAIL_CACHE_MS
                : SEARCH_CACHE_MS
            ),
          status:
            response.status,
          data,
        }
      );

      if (detailId) {
        volumeMemoryCache.set(
          detailId,
          {
            expiresAt:
              Date.now() +
              DETAIL_CACHE_MS,
            data,
          }
        );

        void persistDetail(
          detailId,
          data
        );
      }

      return {
        ok: true,
        status:
          response.status,
        data,
        fromCache:
          false,
      } satisfies GoogleBooksJsonResult<unknown>;
    })();

  inFlight.set(
    url,
    request
  );

  try {
    return await request as GoogleBooksJsonResult<T>;
  } finally {
    inFlight.delete(
      url
    );
  }
}
