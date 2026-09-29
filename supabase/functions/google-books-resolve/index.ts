import {
  createClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const PROVIDER = 'google_books';
const ISBN_CACHE_TTL_MS =
  90 * 24 * 60 * 60 * 1000;
const ISBN_STALE_TTL_MS =
  180 * 24 * 60 * 60 * 1000;
const TRENDING_CACHE_TTL_MS =
  30 * 24 * 60 * 60 * 1000;
const TRENDING_STALE_TTL_MS =
  90 * 24 * 60 * 60 * 1000;
const SOFT_DAILY_GUARD = 650;

type GoogleBookItem = {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    industryIdentifiers?: {
      type: string;
      identifier: string;
    }[];
  };
};

type GoogleBooksResponse = {
  items?: GoogleBookItem[];
};

type CacheRow = {
  response_json: unknown;
  expires_at: string;
  stale_until: string;
};

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

async function recordCacheHit(
  supabaseAdmin:
    ReturnType<
      typeof createClient
    >,
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
    ReturnType<
      typeof createClient
    >
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
    ReturnType<
      typeof createClient
    >,
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
    ReturnType<
      typeof createClient
    >,
  userId: string,
  query: string,
  maxResults: number,
  projectionFull: boolean
) {
  const claim =
    await claimGoogleRequest(
      supabaseAdmin,
      userId
    );

  if (!claim?.allowed) {
    return {
      blocked: true,
      claim,
      status: 429,
      data: null,
    };
  }

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

  const response =
    await fetch(
      googleUrl.toString()
    );

  if (!response.ok) {
    return {
      blocked: false,
      claim,
      status:
        response.status,
      data: null,
    };
  }

  return {
    blocked: false,
    claim,
    status: 200,
    data:
      await response.json() as
        GoogleBooksResponse,
  };
}

async function readCache(
  supabaseAdmin:
    ReturnType<
      typeof createClient
    >,
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
        'response_json, expires_at, stale_until'
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

  return data as
    CacheRow | null;
}

async function writeCache(
  supabaseAdmin:
    ReturnType<
      typeof createClient
    >,
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
        freshMs
    );

  const staleUntil =
    new Date(
      fetchedAt.getTime() +
        staleMs
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
          'trending'
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
                'Invalid Trending book title.',
            }
          );
        }

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
        )
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

        if (isbn) {
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

            const exactIsbnMatch =
              results.find(
                (
                  result
                ) =>
                  result.volumeInfo
                    .industryIdentifiers
                    ?.some(
                      (
                        identifier
                      ) =>
                        identifier
                          .identifier ===
                        isbn
                    )
              );

            googleBookId =
              exactIsbnMatch
                ?.id ??
              results[0]
                ?.id ??
              null;
          }
        }

        if (!googleBookId) {
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
            response.data
          ) {
            const results =
              response.data
                .items ??
              [];

            const wantedTitle =
              normalizeTitle(
                title
              );

            const exactTitle =
              results.find(
                (
                  result
                ) =>
                  normalizeTitle(
                    result.volumeInfo
                      .title
                  ) ===
                  wantedTitle
              );

            if (exactTitle) {
              googleBookId =
                exactTitle.id;
            } else {
              const titleAndAuthor =
                results.find(
                  (
                    result
                  ) => {
                    const resultTitle =
                      normalizeTitle(
                        result.volumeInfo
                          .title
                      );

                    const resultAuthors =
                      result.volumeInfo
                        .authors ??
                      [];

                    const titleMatches =
                      resultTitle.includes(
                        wantedTitle
                      ) ||
                      wantedTitle.includes(
                        resultTitle
                      );

                    const authorMatches =
                      !author ||
                      resultAuthors.some(
                        (
                          resultAuthor
                        ) =>
                          resultAuthor
                            .toLowerCase()
                            .includes(
                              author.toLowerCase()
                            ) ||
                          author
                            .toLowerCase()
                            .includes(
                              resultAuthor.toLowerCase()
                            )
                      );

                    return (
                      titleMatches &&
                      authorMatches
                    );
                  }
                );

              googleBookId =
                titleAndAuthor
                  ?.id ??
                results[0]
                  ?.id ??
                null;
            }
          }
        }

        resultPayload = {
          kind:
            'trending',
          googleBookId,
        };
      }

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
              true,
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
