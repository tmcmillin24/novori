import { isbnDbEnabled, handleIsbnDbRequest } from '../_shared/isbndb.ts';
import { cachedGoogleQuery } from '../_shared/provider-cache.ts';
import {
  createClient, type SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

import {
  cacheRowIsFresh,
  claimApiCacheRefresh,
  jitteredDurationMs,
  waitForApiCacheFill,
} from '../_shared/api-cache-guard.ts';
import {
  recordGoogleBooksInCatalog,
} from '../_shared/book-catalog.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const PROVIDER = 'google_books';
const ISBN_CACHE_TTL_MS =
  365 * 24 * 60 * 60 * 1000;
const ISBN_STALE_TTL_MS =
  730 * 24 * 60 * 60 * 1000;
const TRENDING_CACHE_TTL_MS =
  90 * 24 * 60 * 60 * 1000;
const TRENDING_STALE_TTL_MS =
  180 * 24 * 60 * 60 * 1000;
const IDENTITY_CACHE_TTL_MS =
  365 * 24 * 60 * 60 * 1000;
const IDENTITY_STALE_TTL_MS =
  730 * 24 * 60 * 60 * 1000;
const SOFT_DAILY_GUARD = 650;
const EMERGENCY_DAILY_GUARD = 900;

type GoogleBookItem = {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    industryIdentifiers?: {
      type: string;
      identifier: string;
    }[];
    ratingsCount?: number;
    language?: string;
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
  };
  saleInfo?: {
    country?: string;
  };
};

type GoogleBooksResponse = {
  items?: GoogleBookItem[];
};

type CacheRow = {
  response_json: unknown;
  expires_at: string;
  stale_until: string;
  fetched_at?: string;
};

// A missing mapping can become available soon (especially for upcoming books).
const NEGATIVE_RESOLVER_VERSION = 2;
const NEGATIVE_FRESH_MS = 6 * 60 * 60 * 1000;
const NEGATIVE_STALE_MS = 7 * 86400000;
function isNegativeMapping(payload: unknown) {
  const value = payload as { kind?: string; book?: unknown; googleBookId?: unknown } | null;
  return Boolean(value && (value.kind === 'isbn' ? !value.book : value.kind && !value.googleBookId));
}
function boundedResolverCache(row: CacheRow): CacheRow {
  if (!isNegativeMapping(row.response_json)) return row;
  const payload = row.response_json as { kind?: string; resolverVersion?: number };
  // Retry only old unsuccessful identity mappings. Successful mappings and all
  // raw provider responses retain their existing keys, expiry and cache locks.
  if (payload.kind !== 'isbn' && payload.resolverVersion !== NEGATIVE_RESOLVER_VERSION) {
    return { ...row, expires_at: new Date(0).toISOString(), stale_until: new Date(0).toISOString() };
  }
  const fetched = Date.parse(row.fetched_at ?? '') || 0;
  return { ...row,
    expires_at: new Date(Math.min(Date.parse(row.expires_at), fetched + NEGATIVE_FRESH_MS)).toISOString(),
    stale_until: new Date(Math.min(Date.parse(row.stale_until), fetched + NEGATIVE_STALE_MS)).toISOString(),
  };
}

type ClaimResult = {
  allowed: boolean;
  reason: string | null;
  user_window_count: number;
  user_daily_count: number;
  global_upstream_count: number;
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type':
          'application/json',
        'Cache-Control':
          'no-store',
      },
    }
  );
}

function normalizeIsbn(
  value?: string | null
) {
  return (
    value
      ?.replace(
        /[^0-9Xx]/g,
        ''
      )
      .toUpperCase() ??
    ''
  );
}

function normalizeTitle(
  value?: string | null
) {
  return (
    value ??
    ''
  )
    .toLowerCase()
    .normalize('NFKD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-z0-9]+/g,
      ' '
    )
    .trim();
}

function canonicalWorkTitle(
  value?: string | null
) {
  if (!value) {
    return '';
  }

  let raw =
    value
      .normalize('NFKD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .trim();

  raw =
    raw.replace(
      /\s*[\[(][^\])]*(?:edition|collector|deluxe|special|exclusive|anniversary|movie tie|tv tie|paperback|hardcover|mass market|large print|book\s*\d+|volume\s*\d+|vol\.?\s*\d+|series|#\s*\d+|,\s*\d+)[^\])]*[\])]/gi,
      ''
    );

  raw =
    raw.replace(
      /\s*[:\-–—]\s*(?:a novel|the novel|special edition|deluxe edition|collector'?s edition|collectors edition|anniversary edition|movie tie[- ]?in edition|tv tie[- ]?in edition|hardcover edition|paperback edition|mass market paperback|large print edition|.*(?:series|book\s*\d+|volume\s*\d+|vol\.?\s*\d+|#\s*\d+).*)$/i,
      ''
    );

  raw = raw.replace(
    /\s*[:\-–—]\s*(?:an?\s+)?(?:(?:gma|good morning america|reese'?s|oprah'?s|read with jenna)\s+)?book club (?:pick|selection)(?:\s*[:\-–—]\s*(?:a novel|the novel))?\s*$/i,
    ''
  );

  let title =
    normalizeTitle(
      raw
    );

  const removableSuffixes = [
    ' limited edition',
    ' deluxe edition',
    ' special edition',
    ' collectors edition',
    ' collector s edition',
    ' exclusive edition',
    ' anniversary edition',
    ' hardcover edition',
    ' paperback edition',
    ' international edition',
    ' movie tie in edition',
    ' tv tie in edition',
    ' mass market paperback',
    ' large print edition',
    ' uncut edition',
    ' illustrated edition',
    ' gift edition',
    ' ebook edition',
    ' kindle edition',
    ' trade paperback',
    ' a novel',
  ];

  let changed = true;

  while (changed) {
    changed = false;

    for (
      const suffix of
        removableSuffixes
    ) {
      if (
        title.endsWith(
          suffix
        )
      ) {
        title =
          title
            .slice(
              0,
              -suffix.length
            )
            .trim();

        changed = true;
      }
    }
  }

  return title;
}

function canonicalWorkTitleForBook(
  book: GoogleBookItem
) {
  let title =
    canonicalWorkTitle(
      book.volumeInfo
        .title
    );

  const primaryAuthor =
    normalizeTitle(
      book.volumeInfo
        .authors?.[0]
    );

  if (
    title &&
    primaryAuthor
  ) {
    const authorPrefix =
      `${primaryAuthor} s `;

    if (
      title.startsWith(
        authorPrefix
      )
    ) {
      title =
        title
          .slice(
            authorPrefix.length
          )
          .trim();
    }
  }

  return title;
}

function authorMatchesWork(
  expectedAuthor: string,
  candidateAuthors:
    string[]
) {
  const wanted =
    normalizeTitle(
      expectedAuthor
    );

  if (!wanted) {
    return true;
  }

  return candidateAuthors.some(
    (
      candidateAuthor
    ) => {
      const actual =
        normalizeTitle(
          candidateAuthor
        );

      return (
        actual === wanted ||
        actual.includes(
          wanted
        ) ||
        wanted.includes(
          actual
        )
      );
    }
  );
}

function editionLocaleScore(
  book: GoogleBookItem
) {
  const language =
    (
      book.volumeInfo
        .language ??
      ''
    )
      .trim()
      .toLowerCase();

  const country =
    (
      book.saleInfo
        ?.country ??
      ''
    )
      .trim()
      .toUpperCase();

  const isEnglish =
    language ===
      'en' ||
    language ===
      'eng' ||
    language.startsWith(
      'en-'
    );

  if (
    language &&
    !isEnglish
  ) {
    return null;
  }

  if (
    isEnglish &&
    country ===
      'US'
  ) {
    return 150;
  }

  if (isEnglish) {
    return 100;
  }

  if (
    !language &&
    country ===
      'US'
  ) {
    return 50;
  }

  return null;
}

function canonicalIdentityBook(
  books: GoogleBookItem[],
  title: string,
  author: string
) {
  const wantedWorkTitle =
    canonicalWorkTitle(
      title
    );

  const wantedExactTitle =
    normalizeTitle(
      title
    );

  return (
    books
      .map(
        (
          book
        ) => {
          const localeScore =
            editionLocaleScore(
              book
            );

          if (
            localeScore ===
              null ||
            canonicalWorkTitleForBook(
              book
            ) !==
              wantedWorkTitle ||
            !authorMatchesWork(
              author,
              book.volumeInfo
                .authors ??
                []
            )
          ) {
            return null;
          }

          const exactTitle =
            normalizeTitle(
              book.volumeInfo
                .title
            ) ===
              wantedExactTitle;

          const hasCover =
            Boolean(
              book.volumeInfo
                .imageLinks
                ?.thumbnail ||
              book.volumeInfo
                .imageLinks
                ?.smallThumbnail
            );

          return {
            book,
            localeScore,
            ratingsCount:
              book.volumeInfo
                .ratingsCount ??
              0,
            exactTitle,
            hasCover,
          };
        }
      )
      .filter(
        (
          candidate
        ): candidate is NonNullable<
          typeof candidate
        > =>
          Boolean(
            candidate
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          b.localeScore -
            a.localeScore ||
          b.ratingsCount -
            a.ratingsCount ||
          Number(
            b.exactTitle
          ) -
            Number(
              a.exactTitle
            ) ||
          Number(
            b.hasCover
          ) -
            Number(
              a.hasCover
            )
      )[0]
      ?.book ??
    null
  );
}

function isbn13ToIsbn10(
  isbn13: string
) {
  const normalized =
    normalizeIsbn(
      isbn13
    );

  if (
    normalized.length !==
      13 ||
    !normalized.startsWith(
      '978'
    )
  ) {
    return null;
  }

  const body =
    normalized.slice(
      3,
      12
    );

  let total = 0;

  for (
    let index = 0;
    index < body.length;
    index += 1
  ) {
    total +=
      Number(
        body[index]
      ) *
      (
        10 -
        index
      );
  }

  const remainder =
    11 -
    (
      total %
      11
    );

  const checkDigit =
    remainder === 10
      ? 'X'
      : remainder === 11
        ? '0'
        : String(
            remainder
          );

  return (
    body +
    checkDigit
  );
}

function bookMatchesAnyIsbn(
  book: GoogleBookItem,
  isbns: string[]
) {
  const wanted =
    new Set(
      isbns
        .map(
          normalizeIsbn
        )
        .filter(
          Boolean
        )
    );

  return Boolean(
    book.volumeInfo
      .industryIdentifiers
      ?.some(
        (
          identifier
        ) =>
          wanted.has(
            normalizeIsbn(
              identifier.identifier
            )
          )
      )
  );
}

function isFuture(
  value:
    string | null | undefined,
  now: number
) {
  if (!value) {
    return false;
  }

  const timestamp =
    Date.parse(
      value
    );

  return (
    Number.isFinite(
      timestamp
    ) &&
    timestamp >
      now
  );
}

function trendingCacheKey(
  title: string,
  author: string,
  isbn: string
) {
  if (isbn) {
    return (
      'trending:v1:isbn:' +
      normalizeIsbn(
        isbn
      )
    );
  }

  return (
    'trending:v1:' +
    normalizeTitle(
      title
    ) +
    '::' +
    normalizeTitle(
      author
    )
  );
}

function identityCacheKey(
  title: string,
  author: string
) {
  return (
    'identity:v3:' +
    canonicalWorkTitle(
      title
    ) +
    '::' +
    normalizeTitle(
      author
    )
  );
}

type CatalogEditionRow = {
  provider_book_id: string;
  title: string | null;
  authors: string[] | null;
  language: string | null;
  sale_country: string | null;
  detail_complete: boolean | null;
  page_count: number | null;
  cover_url: string | null;
};

function canonicalWorkTitleForInput(
  title: string,
  author: string
) {
  let normalizedTitle =
    canonicalWorkTitle(
      title
    );

  const normalizedAuthor =
    normalizeTitle(
      author
    );

  if (
    normalizedTitle &&
    normalizedAuthor
  ) {
    const authorPrefix =
      `${normalizedAuthor} s `;

    if (
      normalizedTitle.startsWith(
        authorPrefix
      )
    ) {
      normalizedTitle =
        normalizedTitle
          .slice(
            authorPrefix.length
          )
          .trim();
    }
  }

  return normalizedTitle;
}

async function findCachedVolumeIdentity(admin: SupabaseClient, title: string, author: string) {
  // Google responses already stored by Discover/Search are enough to repair a
  // missed mapping; this lookup never calls either upstream book provider.
  const prefix = title.trim().replace(/[\\%_]/g, '\\$&');
  const { data, error } = await admin.from('google_books_catalog')
    .select('metadata').ilike('metadata->volumeInfo->>title', `${prefix}%`).limit(40);
  if (error) throw new Error('Could not read cached book identity: ' + error.message);
  const books = (data ?? []).map((row: { metadata: GoogleBookItem }) => row.metadata)
    .filter((book: GoogleBookItem) => book?.id && book.volumeInfo);
  return canonicalIdentityBook(books, title, author)?.id ?? null;
}

async function findCanonicalCatalogGoogleBookId(
  supabaseAdmin:
    SupabaseClient,
  title: string,
  author: string
) {
  const normalizedWorkTitle =
    canonicalWorkTitleForInput(
      title,
      author
    );

  const normalizedAuthor =
    normalizeTitle(
      author
    );

  if (!normalizedWorkTitle) {
    return null;
  }

  const workKey =
    `${normalizedWorkTitle}::${normalizedAuthor}`;

  const {
    data:
      workRows,
    error:
      workError,
  } =
    await supabaseAdmin
      .from(
        'book_works'
      )
      .select(
        'id'
      )
      .eq(
        'work_key',
        workKey
      )
      .limit(1);

  if (workError) {
    throw new Error(
      'Could not read Novori book work identity: ' +
      workError.message
    );
  }

  const workId =
    (
      workRows ??
      []
    )[0]
      ?.id as
      | string
      | undefined;

  if (!workId) {
    return findCachedVolumeIdentity(supabaseAdmin, title, author);
  }

  const {
    data:
      editionRows,
    error:
      editionError,
  } =
    await supabaseAdmin
      .from(
        'book_editions'
      )
      .select(
        'provider_book_id, title, authors, language, sale_country, detail_complete, page_count, cover_url'
      )
      .eq(
        'provider',
        PROVIDER
      )
      .eq(
        'work_id',
        workId
      );

  if (editionError) {
    throw new Error(
      'Could not read Novori book editions for identity: ' +
      editionError.message
    );
  }

  const ranked =
    (
      editionRows ??
      []
    )
      .map(
        (
          row
        ) => {
          const edition =
            row as
              CatalogEditionRow;

          const language =
            (
              edition.language ??
              ''
            )
              .trim()
              .toLowerCase();

          const country =
            (
              edition.sale_country ??
              ''
            )
              .trim()
              .toUpperCase();

          const isEnglish =
            language ===
              'en' ||
            language ===
              'eng' ||
            language.startsWith(
              'en-'
            );

          if (
            language &&
            !isEnglish
          ) {
            return null;
          }

          const localeScore =
            isEnglish &&
            country ===
              'US'
              ? 300
              : isEnglish
                ? 250
                : country ===
                    'US'
                  ? 200
                  : 100;

          const exactCleanTitle =
            normalizeTitle(
              edition.title
            ) ===
              normalizedWorkTitle;

          const authors =
            Array.isArray(
              edition.authors
            )
              ? edition.authors
              : [];

          const authorMatches =
            !normalizedAuthor ||
            authors.some(
              (
                candidateAuthor
              ) => {
                const actual =
                  normalizeTitle(
                    candidateAuthor
                  );

                return (
                  actual ===
                    normalizedAuthor ||
                  actual.includes(
                    normalizedAuthor
                  ) ||
                  normalizedAuthor.includes(
                    actual
                  )
                );
              }
            );

          if (!authorMatches) {
            return null;
          }

          return {
            id:
              edition.provider_book_id,
            score:
              (
                exactCleanTitle
                  ? 1000
                  : 0
              ) +
              localeScore +
              (
                edition.detail_complete
                  ? 100
                  : 0
              ) +
              (
                edition.cover_url
                  ? 20
                  : 0
              ) +
              (
                (
                  edition.page_count ??
                  0
                ) >
                  0
                  ? 10
                  : 0
              ),
          };
        }
      )
      .filter(
        (
          candidate
        ): candidate is NonNullable<
          typeof candidate
        > =>
          Boolean(
            candidate
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          b.score -
            a.score ||
          a.id.localeCompare(
            b.id
          )
      );

  return (
    ranked[0]
      ?.id ??
    await findCachedVolumeIdentity(supabaseAdmin, title, author)
  );
}

async function recordCacheHit(
  supabaseAdmin:
    SupabaseClient,
  requestKey: string,
  stale: boolean
) {
  const {
    error,
  } =
    await supabaseAdmin.rpc(
      'novori_record_api_cache_hit',
      {
        p_provider:
          PROVIDER,
        p_request_key:
          requestKey,
        p_stale:
          stale,
      }
    );

  if (error) {
    console.warn(
      'Could not record Google Books resolver cache hit:',
      error.message
    );
  }
}

async function getUpstreamToday(
  supabaseAdmin:
    SupabaseClient
) {
  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10
      );

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        'api_usage_daily'
      )
      .select(
        'upstream_requests'
      )
      .eq(
        'provider',
        PROVIDER
      )
      .eq(
        'usage_date',
        today
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      'Could not read API usage: ' +
      error.message
    );
  }

  return Number(
    data?.upstream_requests ??
      0
  );
}

async function claimGoogleRequest(
  supabaseAdmin:
    SupabaseClient,
  userId: string
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin.rpc(
      'novori_claim_google_books_search',
      {
        p_user_id:
          userId,
      }
    );

  if (error) {
    throw new Error(
      'Could not claim Google Books quota: ' +
      error.message
    );
  }

  return (
    Array.isArray(
      data
    )
      ? data[0]
      : data
  ) as ClaimResult | null;
}

async function googleSearch(
  googleApiKey: string,
  supabaseAdmin:
    SupabaseClient,
  userId: string,
  query: string,
  maxResults: number,
  projectionFull: boolean
) {
  const quotaState: { claim: ClaimResult | null } = { claim: null };
  const googleUrl =
    new URL(
      'https://www.googleapis.com/books/v1/volumes'
    );

  googleUrl.searchParams.set(
    'q',
    query
  );
  googleUrl.searchParams.set(
    'maxResults',
    String(
      maxResults
    )
  );
  googleUrl.searchParams.set(
    'printType',
    'books'
  );

  if (projectionFull) {
    googleUrl.searchParams.set(
      'projection',
      'full'
    );
  }

  googleUrl.searchParams.set(
    'key',
    googleApiKey
  );

  const response = await cachedGoogleQuery(supabaseAdmin, googleUrl.toString(), async () => {
    quotaState.claim = await claimGoogleRequest(supabaseAdmin, userId);
    return quotaState.claim?.allowed === true;
  });

  const claim = quotaState.claim;
  if (!response.ok) {
    return {
      blocked: claim !== null && !claim.allowed,
      claim,
      status:
        response.status,
      data: null,
    };
  }

  const data =
    await response.json() as
      GoogleBooksResponse;

  await recordGoogleBooksInCatalog(
    supabaseAdmin,
    data,
    false,
    'google_resolve'
  );

  return {
    blocked: claim !== null && !claim.allowed,
    claim,
    status: 200,
    data,
  };
}

async function readCache(
  supabaseAdmin:
    SupabaseClient,
  requestKey: string
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        'book_api_cache'
      )
      .select(
        'response_json, expires_at, stale_until, fetched_at'
      )
      .eq(
        'provider',
        PROVIDER
      )
      .eq(
        'request_key',
        requestKey
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      'Could not read shared book cache: ' +
      error.message
    );
  }

  return data ? boundedResolverCache(data as CacheRow) : null;
}

async function writeCache(
  supabaseAdmin:
    SupabaseClient,
  requestKey: string,
  payload: unknown,
  freshMs: number,
  staleMs: number
) {
  const fetchedAt =
    new Date();

  const expiresAt =
    new Date(
      fetchedAt.getTime() +
        jitteredDurationMs(
          freshMs
        )
    );

  const staleUntil =
    new Date(
      fetchedAt.getTime() +
        jitteredDurationMs(
          staleMs
        )
    );

  const {
    error,
  } =
    await supabaseAdmin
      .from(
        'book_api_cache'
      )
      .upsert(
        {
          provider:
            PROVIDER,
          request_key:
            requestKey,
          response_json:
            payload,
          status_code:
            200,
          fetched_at:
            fetchedAt
              .toISOString(),
          expires_at:
            expiresAt
              .toISOString(),
          stale_until:
            staleUntil
              .toISOString(),
          schema_version:
            1,
          hit_count:
            0,
          last_hit_at:
            null,
        },
        {
          onConflict:
            'provider,request_key',
        }
      );

  if (error) {
    console.warn(
      'Could not write Google Books resolver cache:',
      error.message
    );
  }

  return {
    expiresAt:
      expiresAt
        .toISOString(),
  };
}

Deno.serve(
  async (
    request
  ) => {
    if (
      request.method ===
      'OPTIONS'
    ) {
      return new Response(
        'ok',
        {
          headers:
            corsHeaders,
        }
      );
    }

    if (
      request.method !==
      'POST'
    ) {
      return jsonResponse(
        {
          ok: false,
          status: 405,
          error:
            'Method not allowed.',
        },
        405
      );
    }

    if (isbnDbEnabled()) return handleIsbnDbRequest(request, 'resolve');

    try {
      const supabaseUrl =
        Deno.env.get(
          'SUPABASE_URL'
        );

      const serviceRoleKey =
        Deno.env.get(
          'SUPABASE_SERVICE_ROLE_KEY'
        );

      const googleApiKey =
        Deno.env.get(
          'GOOGLE_BOOKS_API_KEY'
        );

      if (
        !supabaseUrl ||
        !serviceRoleKey
      ) {
        throw new Error(
          'Supabase service credentials are not configured.'
        );
      }

      if (!googleApiKey) {
        throw new Error(
          'GOOGLE_BOOKS_API_KEY is not configured.'
        );
      }

      const authorization =
        request.headers.get(
          'Authorization'
        ) ?? '';

      const accessToken =
        authorization
          .replace(
            /^Bearer\s+/i,
            ''
          )
          .trim();

      if (!accessToken) {
        return jsonResponse(
          {
            ok: false,
            status: 401,
            error:
              'Authentication required.',
          }
        );
      }

      const supabaseAdmin =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              autoRefreshToken:
                false,
              persistSession:
                false,
            },
          }
        );

      const {
        data:
          authData,
        error:
          authError,
      } =
        await supabaseAdmin
          .auth
          .getUser(
            accessToken
          );

      const user =
        authData?.user;

      if (
        authError ||
        !user
      ) {
        return jsonResponse(
          {
            ok: false,
            status: 401,
            error:
              'Invalid session.',
          }
        );
      }

      const body =
        await request.json();

      const mode =
        body?.mode ===
          'isbn' ||
        body?.mode ===
          'trending' ||
        body?.mode ===
          'identity'
          ? body.mode
          : null;

      if (!mode) {
        return jsonResponse(
          {
            ok: false,
            status: 400,
            error:
              'Invalid resolver mode.',
          }
        );
      }

      let requestKey = '';
      let freshMs = 0;
      let staleMs = 0;

      const isbn =
        normalizeIsbn(
          typeof body?.isbn ===
            'string'
            ? body.isbn
            : ''
        );

      const title =
        typeof body?.title ===
          'string'
          ? body.title
              .trim()
          : '';

      const author =
        typeof body?.author ===
          'string'
          ? body.author
              .trim()
          : '';

      if (
        mode ===
        'isbn'
      ) {
        if (
          !/^(978|979)\d{10}$/.test(
            isbn
          )
        ) {
          return jsonResponse(
            {
              ok: false,
              status: 400,
              error:
                'Invalid ISBN-13.',
            }
          );
        }

        requestKey =
          'isbn:v1:' +
          isbn;
        freshMs =
          ISBN_CACHE_TTL_MS;
        staleMs =
          ISBN_STALE_TTL_MS;
      } else {
        if (
          !title ||
          title.length >
            300
        ) {
          return jsonResponse(
            {
              ok: false,
              status: 400,
              error:
                'Invalid book title.',
            }
          );
        }

        if (
          mode ===
            'identity'
        ) {
          requestKey =
            identityCacheKey(
              title,
              author
            );
          freshMs =
            IDENTITY_CACHE_TTL_MS;
          staleMs =
            IDENTITY_STALE_TTL_MS;
        } else {
          requestKey =
            trendingCacheKey(
              title,
              author,
              isbn
            );
          freshMs =
            TRENDING_CACHE_TTL_MS;
          staleMs =
            TRENDING_STALE_TTL_MS;
        }
      }

      const now =
        Date.now();

      const cache =
        await readCache(
          supabaseAdmin,
          requestKey
        );

      if (
        cache &&
        isFuture(
          cache.expires_at,
          now
        ) &&
        !isNegativeMapping(cache.response_json)
      ) {
        await recordCacheHit(
          supabaseAdmin,
          requestKey,
          false
        );

        return jsonResponse(
          {
            ok: true,
            status: 200,
            data:
              cache.response_json,
            cache: {
              status:
                'hit',
              googleRequestMade:
                false,
              expiresAt:
                cache.expires_at,
            },
          }
        );
      }

      const staleAvailable =
        Boolean(
          cache &&
          isFuture(
            cache.stale_until,
            now
          )
        );

      if (mode === 'identity' || mode === 'trending') {
        const catalogGoogleBookId =
          await findCanonicalCatalogGoogleBookId(
            supabaseAdmin,
            title,
            author
          );

        if (
          catalogGoogleBookId
        ) {
          const resultPayload = {
            kind: mode,
            googleBookId:
              catalogGoogleBookId,
          };

          const {
            expiresAt,
          } =
            await writeCache(
              supabaseAdmin,
              requestKey,
              resultPayload,
              freshMs,
              staleMs
            );

          return jsonResponse(
            {
              ok: true,
              status: 200,
              data:
                resultPayload,
              cache: {
                status:
                  'miss',
                googleRequestMade:
                  false,
                reason:
                  'catalog_identity',
                expiresAt,
              },
              quota: {
                upstreamRequestsToday:
                  await getUpstreamToday(
                    supabaseAdmin
                  ),
              },
            }
          );
        }
      }



      if (cache && isFuture(cache.expires_at, now) && isNegativeMapping(cache.response_json)) {
        await recordCacheHit(supabaseAdmin, requestKey, false);
        return jsonResponse({ ok: true, status: 200, data: cache.response_json,
          cache: { status: 'hit', googleRequestMade: false, expiresAt: cache.expires_at } });
      }

      const upstreamToday =
        await getUpstreamToday(
          supabaseAdmin
        );

      if (
        staleAvailable &&
        upstreamToday >=
          SOFT_DAILY_GUARD
      ) {
        await recordCacheHit(
          supabaseAdmin,
          requestKey,
          true
        );

        return jsonResponse(
          {
            ok: true,
            status: 200,
            data:
              cache
                ?.response_json,
            cache: {
              status:
                'stale',
              googleRequestMade:
                false,
              reason:
                'soft_quota_guard',
            },
          }
        );
      }

      if (
        upstreamToday >=
          EMERGENCY_DAILY_GUARD
      ) {
        return jsonResponse(
          {
            ok: false,
            status: 429,
            error:
              'Google Books daily safety reserve is active. Please try again later.',
            reason:
              'emergency_quota_guard',
            quota: {
              upstreamRequestsToday:
                upstreamToday,
            },
          }
        );
      }

      const refreshOwnerToken =
        crypto.randomUUID();

      const refreshClaim =
        await claimApiCacheRefresh(
          supabaseAdmin,
          PROVIDER,
          requestKey,
          refreshOwnerToken,
          90
        );

      if (
        !refreshClaim.acquired
      ) {
        if (
          staleAvailable
        ) {
          await recordCacheHit(
            supabaseAdmin,
            requestKey,
            true
          );

          return jsonResponse(
            {
              ok: true,
              status: 200,
              data:
                cache
                  ?.response_json,
              cache: {
                status:
                  'stale',
                googleRequestMade:
                  false,
                reason:
                  'refresh_in_progress',
              },
            }
          );
        }

        const filledCache =
          await waitForApiCacheFill(
            supabaseAdmin,
            PROVIDER,
            requestKey,
            boundedResolverCache
          );

        if (
          filledCache
        ) {
          const filledIsFresh =
            cacheRowIsFresh(
              filledCache
            );

          await recordCacheHit(
            supabaseAdmin,
            requestKey,
            !filledIsFresh
          );

          return jsonResponse(
            {
              ok: true,
              status: 200,
              data:
                filledCache
                  .response_json,
              cache: {
                status:
                  filledIsFresh
                    ? 'hit'
                    : 'stale',
                googleRequestMade:
                  false,
                reason:
                  'waited_for_refresh',
                expiresAt:
                  filledCache
                    .expires_at,
              },
            }
          );
        }

        return jsonResponse(
          {
            ok: false,
            status: 409,
            error:
              'This book mapping is already being refreshed. Please try again.',
            reason:
              'refresh_in_progress',
          }
        );
      }

      let resultPayload:
        Record<string, unknown>;

      let lastClaim:
        ClaimResult | null =
        null;

      if (
        mode ===
        'isbn'
      ) {
        const isbn10 =
          isbn13ToIsbn10(
            isbn
          );

        const isbnCandidates =
          Array.from(
            new Set(
              [
                isbn,
                isbn10,
              ].filter(
                (
                  value
                ): value is string =>
                  Boolean(
                    value
                  )
              )
            )
          );

        const queries = [
          ...isbnCandidates.map(
            (
              candidate
            ) =>
              'isbn:' +
              candidate
          ),
          ...isbnCandidates,
        ];

        let match:
          GoogleBookItem | null =
          null;

        let sawSuccessfulResponse =
          false;

        let lastGoogleStatus =
          200;

        for (
          const query of
            queries
        ) {
          const response =
            await googleSearch(
              googleApiKey,
              supabaseAdmin,
              user.id,
              query,
              10,
              true
            );

          lastClaim =
            response.claim ??
            lastClaim;

          lastGoogleStatus =
            response.status;

          if (
            response.blocked
          ) {
            if (
              staleAvailable
            ) {
              await recordCacheHit(
                supabaseAdmin,
                requestKey,
                true
              );

              return jsonResponse(
                {
                  ok: true,
                  status: 200,
                  data:
                    cache
                      ?.response_json,
                  cache: {
                    status:
                      'stale',
                    googleRequestMade:
                      false,
                    reason:
                      response.claim
                        ?.reason ??
                      'rate_limited',
                  },
                }
              );
            }

            return jsonResponse(
              {
                ok: false,
                status: 429,
                error:
                  'Too many uncached Google Books requests. Please try again later.',
                reason:
                  response.claim
                    ?.reason ??
                  'rate_limited',
              }
            );
          }

          if (
            response.status ===
              429
          ) {
            return jsonResponse(
              {
                ok: false,
                status: 429,
                error:
                  'Google Books rate limit reached.',
              }
            );
          }

          if (
            !response.data
          ) {
            continue;
          }

          sawSuccessfulResponse =
            true;

          const matches =
            response.data
              .items ??
            [];

          const exactMatch =
            matches.find(
              (
                candidate
              ) =>
                bookMatchesAnyIsbn(
                  candidate,
                  isbnCandidates
                )
            );

          if (exactMatch) {
            match =
              exactMatch;
            break;
          }

          if (
            matches[0]
          ) {
            match =
              matches[0];
            break;
          }
        }

        if (
          !match &&
          !sawSuccessfulResponse
        ) {
          if (
            staleAvailable
          ) {
            await recordCacheHit(
              supabaseAdmin,
              requestKey,
              true
            );

            return jsonResponse(
              {
                ok: true,
                status: 200,
                data:
                  cache
                    ?.response_json,
                cache: {
                  status:
                    'stale',
                  googleRequestMade:
                    true,
                  reason:
                    'google_' +
                    lastGoogleStatus,
                },
              }
            );
          }

          return jsonResponse(
            {
              ok: false,
              status:
                lastGoogleStatus,
              error:
                'Google Books ISBN resolution is temporarily unavailable.',
            }
          );
        }

        resultPayload = {
          kind:
            'isbn',
          book:
            match,
        };
      } else {
        let googleBookId:
          string | null =
          null;

        if (
          mode ===
            'identity'
        ) {
          const response =
            await googleSearch(
              googleApiKey,
              supabaseAdmin,
              user.id,
              title,
              40,
              true
            );

          lastClaim =
            response.claim ??
            lastClaim;

          if (
            response.blocked
          ) {
            if (
              staleAvailable
            ) {
              await recordCacheHit(
                supabaseAdmin,
                requestKey,
                true
              );

              return jsonResponse(
                {
                  ok: true,
                  status: 200,
                  data:
                    cache
                      ?.response_json,
                  cache: {
                    status:
                      'stale',
                    googleRequestMade:
                      false,
                    reason:
                      response.claim
                        ?.reason ??
                      'rate_limited',
                  },
                }
              );
            }

            return jsonResponse(
              {
                ok: false,
                status: 429,
                error:
                  'Too many uncached Google Books requests. Please try again later.',
                reason:
                  response.claim
                    ?.reason ??
                  'rate_limited',
              }
            );
          }

          if (
            response.status ===
              429
          ) {
            return jsonResponse(
              {
                ok: false,
                status: 429,
                error:
                  'Google Books rate limit reached.',
              }
            );
          }        if (!response.data) {
          if (staleAvailable) {
            await recordCacheHit(supabaseAdmin, requestKey, true);
            return jsonResponse({ ok: true, status: 200, data: cache?.response_json,
              cache: { status: 'stale', googleRequestMade: Boolean(lastClaim?.allowed), reason: 'provider_unavailable' } });
          }
          return jsonResponse({ ok: false, status: response.status, error: 'Google Books identity resolution is temporarily unavailable.' });
        }


          if (
            response.data
          ) {
            googleBookId =
              await findCanonicalCatalogGoogleBookId(
                supabaseAdmin,
                title,
                author
              );

            if (
              !googleBookId
            ) {
              googleBookId =
                canonicalIdentityBook(
                  response.data
                    .items ??
                    [],
                  title,
                  author
                )
                  ?.id ??
                null;
            }
          }
        }

        if (
          mode !==
            'identity' &&
          isbn
        ) {
          const response =
            await googleSearch(
              googleApiKey,
              supabaseAdmin,
              user.id,
              'isbn:' +
                isbn,
              5,
              false
            );

          lastClaim =
            response.claim ??
            lastClaim;

          if (
            response.blocked
          ) {
            if (
              staleAvailable
            ) {
              await recordCacheHit(
                supabaseAdmin,
                requestKey,
                true
              );

              return jsonResponse(
                {
                  ok: true,
                  status: 200,
                  data:
                    cache
                      ?.response_json,
                  cache: {
                    status:
                      'stale',
                    googleRequestMade:
                      false,
                    reason:
                      response.claim
                        ?.reason ??
                      'rate_limited',
                  },
                }
              );
            }

            return jsonResponse(
              {
                ok: false,
                status: 429,
                error:
                  'Too many uncached Google Books requests. Please try again later.',
              }
            );
          }

          if (
            response.data
          ) {
            const results =
              response.data
                .items ??
              [];

            const verified = results.filter((result) =>
              canonicalWorkTitleForBook(result) === canonicalWorkTitle(title) &&
              authorMatchesWork(author, result.volumeInfo.authors ?? [])
            );
            googleBookId = canonicalIdentityBook(verified, title, author)?.id ?? null;
          }
        }

        if (
          !googleBookId &&
          mode !==
            'identity'
        ) {
          const queryParts = [
            'intitle:"' +
              title +
              '"',
          ];

          if (author) {
            queryParts.push(
              'inauthor:"' +
                author +
                '"'
            );
          }

          const response =
            await googleSearch(
              googleApiKey,
              supabaseAdmin,
              user.id,
              queryParts.join(
                ' '
              ),
              20,
              false
            );

          lastClaim =
            response.claim ??
            lastClaim;

          if (
            response.blocked
          ) {
            if (
              staleAvailable
            ) {
              await recordCacheHit(
                supabaseAdmin,
                requestKey,
                true
              );

              return jsonResponse(
                {
                  ok: true,
                  status: 200,
                  data:
                    cache
                      ?.response_json,
                  cache: {
                    status:
                      'stale',
                    googleRequestMade:
                      false,
                    reason:
                      response.claim
                        ?.reason ??
                      'rate_limited',
                  },
                }
              );
            }

            return jsonResponse(
              {
                ok: false,
                status: 429,
                error:
                  'Too many uncached Google Books requests. Please try again later.',
              }
            );
          }

          if (
            response.status ===
              429
          ) {
            return jsonResponse(
              {
                ok: false,
                status: 429,
                error:
                  'Google Books rate limit reached.',
              }
            );
          }

          if (
            !response.data
          ) {
            if (
              staleAvailable
            ) {
              await recordCacheHit(
                supabaseAdmin,
                requestKey,
                true
              );

              return jsonResponse(
                {
                  ok: true,
                  status: 200,
                  data:
                    cache
                      ?.response_json,
                  cache: {
                    status:
                      'stale',
                    googleRequestMade:
                      true,
                    reason:
                      'google_' +
                      response.status,
                  },
                }
              );
            }

            return jsonResponse(
              {
                ok: false,
                status:
                  response.status,
                error:
                  'Google Books identity resolution is temporarily unavailable.',
              }
            );
          }

          if (
            response.data
          ) {
            const results =
              response.data
                .items ??
              [];

            googleBookId = canonicalIdentityBook(results, title, author)?.id ?? null;
          }
        }

        if (!googleBookId && mode === 'trending') {
          // Google can miss a valid book when ISBN or quoted-author terms are
          // overly restrictive. One bounded, shared-cache title search is enough.
          const response = await googleSearch(googleApiKey, supabaseAdmin, user.id,
            `intitle:"${title}"`, 40, true);
          lastClaim = response.claim ?? lastClaim;
          if (response.blocked || response.status === 429) {
            if (staleAvailable) {
              await recordCacheHit(supabaseAdmin, requestKey, true);
              return jsonResponse({ ok: true, status: 200, data: cache?.response_json,
                cache: { status: 'stale', googleRequestMade: Boolean(lastClaim?.allowed),
                  reason: response.claim?.reason ?? 'rate_limited' } });
            }
            return jsonResponse({ ok: false, status: 429, error: 'Google Books rate limit reached.' });
          }
          if (!response.data) {
            if (staleAvailable) {
              await recordCacheHit(supabaseAdmin, requestKey, true);
              return jsonResponse({ ok: true, status: 200, data: cache?.response_json,
                cache: { status: 'stale', googleRequestMade: Boolean(lastClaim?.allowed), reason: 'provider_unavailable' } });
            }
            return jsonResponse({ ok: false, status: response.status, error: 'Book identity resolution is temporarily unavailable.' });
          }
          googleBookId = canonicalIdentityBook(response.data.items ?? [], title, author)?.id ?? null;
        }

        resultPayload = {
          kind:
            mode,
          googleBookId,
        };
      }

      if (isNegativeMapping(resultPayload) && mode !== 'isbn') {
        resultPayload.resolverVersion = NEGATIVE_RESOLVER_VERSION;
      }

      const {
        expiresAt,
      } =
        await writeCache(
          supabaseAdmin,
          requestKey,
          resultPayload,
          isNegativeMapping(resultPayload) ? NEGATIVE_FRESH_MS : freshMs,
          isNegativeMapping(resultPayload) ? NEGATIVE_STALE_MS : staleMs
        );

      return jsonResponse(
        {
          ok: true,
          status: 200,
          data:
            resultPayload,
          cache: {
            status:
              'miss',
            googleRequestMade: Boolean(lastClaim?.allowed),
            expiresAt,
          },
          quota: {
            upstreamRequestsToday:
              lastClaim
                ?.global_upstream_count ??
              upstreamToday,
            userWindowRequests:
              lastClaim
                ?.user_window_count ??
              null,
            userDailyRequests:
              lastClaim
                ?.user_daily_count ??
              null,
          },
        }
      );
    } catch (
      error
    ) {
      console.error(
        'google-books-resolve failed:',
        error
      );

      return jsonResponse(
        {
          ok: false,
          status: 500,
          error:
            error instanceof
              Error
              ? error.message
              : 'Unknown resolver cache error.',
        }
      );
    }
  }
);
