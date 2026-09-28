import AsyncStorage from '@react-native-async-storage/async-storage';

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
  'novori:google-books:detail-index:v1';

const memoryCache =
  new Map<string, MemoryEntry>();

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
    /\/books\/v1\/volumes\/[^?]+\?/.test(
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
  return `novori:google-books:detail:${id}`;
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
      const response =
        await fetch(
          url
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
