import {
  createClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

import {
  cacheRowIsFresh,
  claimApiCacheRefresh,
  jitteredDurationMs,
  waitForApiCacheFill,
} from '../_shared/api-cache-guard.ts';
import {
  recordOpenLibraryWorkCoverCandidates,
} from '../_shared/book-catalog.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin':
    '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const PROVIDER =
  'open_library';
const CACHE_VERSION =
  1;

const SUCCESS_CACHE_TTL_MS =
  180 * 24 * 60 * 60 * 1000;
const SUCCESS_STALE_TTL_MS =
  365 * 24 * 60 * 60 * 1000;

const NEGATIVE_CACHE_TTL_MS =
  60 * 24 * 60 * 60 * 1000;
const NEGATIVE_STALE_TTL_MS =
  120 * 24 * 60 * 60 * 1000;

type CacheRow = {
  response_json:
    unknown;
  expires_at:
    string;
  stale_until:
    string;
};

type OpenLibrarySearchResponse = {
  docs?: {
    key?: string;
    title?: string;
    author_name?: string[];
    cover_i?: number;
    isbn?: string[];
  }[];
};

type OpenLibraryWorkResponse = {
  covers?: number[];
};

type UpstreamClaimResult = {
  allowed:
    boolean;
  reason:
    string | null;
  user_window_count:
    number;
  user_daily_count:
    number;
  global_window_count:
    number;
  global_daily_count:
    number;
};

type ResolverPayload = {
  kind:
    'work-cover';
  matchFound:
    boolean;
  workKey:
    string | null;
  coverIds:
    number[];
};

function jsonResponse(
  body:
    Record<
      string,
      unknown
    >,
  status = 200
) {
  return new Response(
    JSON.stringify(
      body
    ),
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

function normalizeLookupText(
  value?: string | null
) {
  return (
    value ??
    ''
  )
    .toLowerCase()
    .normalize(
      'NFKD'
    )
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

function buildCacheKey(
  title: string,
  author: string
) {
  return (
    `work-cover:v${CACHE_VERSION}:` +
    normalizeLookupText(
      title
    ) +
    '::' +
    normalizeLookupText(
      author
    )
  );
}

function isFuture(
  value:
    string | null | undefined,
  now:
    number
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
      'Could not record Open Library cache hit:',
      error.message
    );
  }
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
      'Could not read shared Open Library cache: ' +
      error.message
    );
  }

  return data as
    CacheRow | null;
}

async function claimOpenLibraryRequest(
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
      'novori_claim_open_library_request',
      {
        p_user_id:
          userId,
      }
    );

  if (error) {
    throw new Error(
      'Could not claim Open Library quota: ' +
      error.message
    );
  }

  return (
    Array.isArray(
      data
    )
      ? data[0]
      : data
  ) as
    UpstreamClaimResult | null;
}


function sleep(
  milliseconds: number
) {
  return new Promise<void>(
    (
      resolve
    ) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

async function claimOpenLibraryRequestWithRetry(
  supabaseAdmin:
    ReturnType<
      typeof createClient
    >,
  userId: string
) {
  for (
    let attempt = 0;
    attempt < 4;
    attempt += 1
  ) {
    const claim =
      await claimOpenLibraryRequest(
        supabaseAdmin,
        userId
      );

    if (
      claim?.allowed ||
      claim?.reason !==
        'global_min_interval'
    ) {
      return claim;
    }

    if (
      attempt <
      3
    ) {
      await sleep(
        1100
      );
    }
  }

  return null;
}

async function writeCache(
  supabaseAdmin:
    ReturnType<
      typeof createClient
    >,
  requestKey: string,
  payload: ResolverPayload
) {
  const isNegative =
    !payload.matchFound;

  const freshMs =
    isNegative
      ? NEGATIVE_CACHE_TTL_MS
      : SUCCESS_CACHE_TTL_MS;

  const staleMs =
    isNegative
      ? NEGATIVE_STALE_TTL_MS
      : SUCCESS_STALE_TTL_MS;

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
            CACHE_VERSION,
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
      'Could not write shared Open Library cache:',
      error.message
    );
  }

  return {
    expiresAt:
      expiresAt
        .toISOString(),
  };
}

function findCandidate(
  payload:
    OpenLibrarySearchResponse,
  title:
    string,
  author:
    string
) {
  const wantedTitle =
    normalizeLookupText(
      title
    );

  const wantedAuthor =
    normalizeLookupText(
      author
    );

  return (
    payload.docs ??
    []
  ).find(
    (
      doc
    ) => {
      const candidateTitle =
        normalizeLookupText(
          doc.title
        );

      const titleMatches =
        candidateTitle ===
          wantedTitle ||
        candidateTitle.startsWith(
          `${wantedTitle} `
        ) ||
        wantedTitle.startsWith(
          `${candidateTitle} `
        );

      const candidateAuthors =
        (
          doc.author_name ??
          []
        ).map(
          normalizeLookupText
        );

      const authorMatches =
        !wantedAuthor ||
        candidateAuthors.some(
          (
            candidateAuthor
          ) =>
            candidateAuthor ===
              wantedAuthor ||
            candidateAuthor.includes(
              wantedAuthor
            ) ||
            wantedAuthor.includes(
              candidateAuthor
            )
        );

      return (
        titleMatches &&
        authorMatches &&
        Boolean(
          doc.cover_i
        )
      );
    }
  );
}

async function recordCoverCandidatesFromPayload(
  supabaseAdmin:
    ReturnType<
      typeof createClient
    >,
  title: string,
  author: string,
  payload: unknown,
  discoverySource:
    string
) {
  if (
    !payload ||
    typeof payload !==
      'object'
  ) {
    return;
  }

  const resolver =
    payload as
      Partial<
        ResolverPayload
      >;

  if (
    resolver.kind !==
      'work-cover' ||
    resolver.matchFound !==
      true ||
    !Array.isArray(
      resolver.coverIds
    )
  ) {
    return;
  }

  await recordOpenLibraryWorkCoverCandidates(
    supabaseAdmin,
    {
      title,
      author,
      openLibraryWorkKey:
        typeof resolver.workKey ===
          'string'
          ? resolver.workKey
          : null,
      coverIds:
        resolver.coverIds,
      discoverySource,
    }
  );
}

async function staleResponse(
  supabaseAdmin:
    ReturnType<
      typeof createClient
    >,
  title: string,
  author: string,
  cache:
    CacheRow,
  reason:
    string
) {
  await recordCoverCandidatesFromPayload(
    supabaseAdmin,
    title,
    author,
    cache.response_json,
    'open_library_cache'
  );

  return jsonResponse(
    {
      ok: true,
      status: 200,
      data:
        cache.response_json,
      cache: {
        status:
          'stale',
        openLibraryRequestsMade:
          0,
        reason,
      },
    }
  );
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

      if (
        !supabaseUrl ||
        !serviceRoleKey
      ) {
        throw new Error(
          'Supabase service credentials are not configured.'
        );
      }

      const authorization =
        request.headers.get(
          'Authorization'
        ) ??
        '';

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
        !title ||
        title.length >
          300 ||
        author.length >
          300
      ) {
        return jsonResponse(
          {
            ok: false,
            status: 400,
            error:
              'Invalid Open Library work lookup.',
          }
        );
      }

      const requestKey =
        buildCacheKey(
          title,
          author
        );

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

        console.info(
          'open-library-work-cover cache=hit'
        );

        await recordCoverCandidatesFromPayload(
          supabaseAdmin,
          title,
          author,
          cache.response_json,
          'open_library_cache'
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
              openLibraryRequestsMade:
                0,
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

      const refreshOwnerToken =
        crypto.randomUUID();

      const refreshClaim =
        await claimApiCacheRefresh(
          supabaseAdmin,
          PROVIDER,
          requestKey,
          refreshOwnerToken
        );

      if (
        !refreshClaim.acquired
      ) {
        if (
          staleAvailable &&
          cache
        ) {
          await recordCacheHit(
            supabaseAdmin,
            requestKey,
            true
          );

          return staleResponse(
            supabaseAdmin,
            title,
            author,
            cache,
            'refresh_in_progress'
          );
        }

        const filledCache =
          await waitForApiCacheFill(
            supabaseAdmin,
            PROVIDER,
            requestKey
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

          await recordCoverCandidatesFromPayload(
            supabaseAdmin,
            title,
            author,
            filledCache.response_json,
            'open_library_cache'
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
                openLibraryRequestsMade:
                  0,
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
              'This Open Library lookup is already being refreshed. Please try again.',
            reason:
              'refresh_in_progress',
          }
        );
      }

      const searchClaim =
        await claimOpenLibraryRequestWithRetry(
          supabaseAdmin,
          user.id
        );

      if (
        !searchClaim?.allowed
      ) {
        if (
          staleAvailable &&
          cache
        ) {
          await recordCacheHit(
            supabaseAdmin,
            requestKey,
            true
          );

          return staleResponse(
            supabaseAdmin,
            title,
            author,
            cache,
            searchClaim
              ?.reason ??
              'rate_limited'
          );
        }

        return jsonResponse(
          {
            ok: false,
            status: 429,
            error:
              'Open Library is temporarily using its API safety limit. Please try again shortly.',
            reason:
              searchClaim
                ?.reason ??
              'rate_limited',
          }
        );
      }

      const params =
        new URLSearchParams();

      params.set(
        'title',
        title
      );

      if (
        author
      ) {
        params.set(
          'author',
          author
        );
      }

      params.set(
        'fields',
        'key,title,author_name,cover_i,isbn'
      );

      params.set(
        'limit',
        '10'
      );

      let searchResponse:
        Response;

      try {
        searchResponse =
          await fetch(
            `https://openlibrary.org/search.json?${params.toString()}`,
            {
              headers: {
                'Accept':
                  'application/json',
                'User-Agent':
                  'Novori/1.0',
              },
            }
          );
      } catch {
        if (
          staleAvailable &&
          cache
        ) {
          await recordCacheHit(
            supabaseAdmin,
            requestKey,
            true
          );

          return staleResponse(
            supabaseAdmin,
            title,
            author,
            cache,
            'open_library_network_error'
          );
        }

        return jsonResponse(
          {
            ok: false,
            status: 503,
            error:
              'Open Library search is temporarily unavailable.',
          }
        );
      }

      if (
        !searchResponse.ok
      ) {
        if (
          staleAvailable &&
          cache
        ) {
          await recordCacheHit(
            supabaseAdmin,
            requestKey,
            true
          );

          return staleResponse(
            supabaseAdmin,
            title,
            author,
            cache,
            `open_library_${searchResponse.status}`
          );
        }

        return jsonResponse(
          {
            ok: false,
            status:
              searchResponse.status,
            error:
              'Open Library search is temporarily unavailable.',
          }
        );
      }

      const searchPayload =
        await searchResponse
          .json() as
            OpenLibrarySearchResponse;

      const candidate =
        findCandidate(
          searchPayload,
          title,
          author
        );

      if (
        !candidate
      ) {
        const payload:
          ResolverPayload = {
            kind:
              'work-cover',
            matchFound:
              false,
            workKey:
              null,
            coverIds:
              [],
          };

        const {
          expiresAt,
        } =
          await writeCache(
            supabaseAdmin,
            requestKey,
            payload
          );

        console.info(
          'open-library-work-cover cache=miss upstream=1 result=no-match'
        );

        return jsonResponse(
          {
            ok: true,
            status: 200,
            data:
              payload,
            cache: {
              status:
                'miss',
              openLibraryRequestsMade:
                1,
              expiresAt,
            },
          }
        );
      }

      const workKey =
        (
          candidate.key ??
          ''
        )
          .replace(
            /^\/works\//,
            ''
          )
          .trim();

      const coverIds =
        new Set<number>();

      if (
        candidate.cover_i &&
        Number.isFinite(
          candidate.cover_i
        ) &&
        candidate.cover_i >
          0
      ) {
        coverIds.add(
          candidate.cover_i
        );
      }

      let upstreamRequestsMade =
        1;

      if (
        workKey
      ) {
        const workClaim =
          await claimOpenLibraryRequestWithRetry(
            supabaseAdmin,
            user.id
          );

        if (
          !workClaim?.allowed
        ) {
          const payload:
            ResolverPayload = {
              kind:
                'work-cover',
              matchFound:
                true,
              workKey,
              coverIds:
                Array.from(
                  coverIds
                ),
            };

          console.info(
            'open-library-work-cover bypass-cache reason=work-quota-guard'
          );

          await recordCoverCandidatesFromPayload(
            supabaseAdmin,
            title,
            author,
            payload,
            'open_library_work'
          );

          return jsonResponse(
            {
              ok: true,
              status: 200,
              data:
                payload,
              cache: {
                status:
                  'bypass',
                openLibraryRequestsMade:
                  upstreamRequestsMade,
                reason:
                  workClaim
                    ?.reason ??
                  'rate_limited',
              },
            }
          );
        }

        upstreamRequestsMade +=
          1;

        let workResponse:
          Response;

        try {
          workResponse =
            await fetch(
              `https://openlibrary.org/works/${encodeURIComponent(
                workKey
              )}.json`,
              {
                headers: {
                  'Accept':
                    'application/json',
                  'User-Agent':
                    'Novori/1.0',
                },
              }
            );
        } catch {
          const payload:
            ResolverPayload = {
              kind:
                'work-cover',
              matchFound:
                true,
              workKey,
              coverIds:
                Array.from(
                  coverIds
                ),
            };

          await recordCoverCandidatesFromPayload(
            supabaseAdmin,
            title,
            author,
            payload,
            'open_library_work'
          );

          return jsonResponse(
            {
              ok: true,
              status: 200,
              data:
                payload,
              cache: {
                status:
                  'bypass',
                openLibraryRequestsMade:
                  upstreamRequestsMade,
                reason:
                  'work_network_error',
              },
            }
          );
        }

        if (
          !workResponse.ok
        ) {
          const payload:
            ResolverPayload = {
              kind:
                'work-cover',
              matchFound:
                true,
              workKey,
              coverIds:
                Array.from(
                  coverIds
                ),
            };

          await recordCoverCandidatesFromPayload(
            supabaseAdmin,
            title,
            author,
            payload,
            'open_library_work'
          );

          return jsonResponse(
            {
              ok: true,
              status: 200,
              data:
                payload,
              cache: {
                status:
                  'bypass',
                openLibraryRequestsMade:
                  upstreamRequestsMade,
                reason:
                  `work_${workResponse.status}`,
              },
            }
          );
        }

        const work =
          await workResponse
            .json() as
              OpenLibraryWorkResponse;

        for (
          const coverId of
            work.covers ??
            []
        ) {
          if (
            Number.isFinite(
              coverId
            ) &&
            coverId >
              0
          ) {
            coverIds.add(
              coverId
            );
          }
        }
      }

      const payload:
        ResolverPayload = {
          kind:
            'work-cover',
          matchFound:
            true,
          workKey:
            workKey ||
            null,
          coverIds:
            Array.from(
              coverIds
            ),
        };

      await recordCoverCandidatesFromPayload(
        supabaseAdmin,
        title,
        author,
        payload,
        'open_library_work'
      );

      const {
        expiresAt,
      } =
        await writeCache(
          supabaseAdmin,
          requestKey,
          payload
        );

      console.info(
        `open-library-work-cover cache=miss upstream=${upstreamRequestsMade}`
      );

      return jsonResponse(
        {
          ok: true,
          status: 200,
          data:
            payload,
          cache: {
            status:
              'miss',
            openLibraryRequestsMade:
              upstreamRequestsMade,
            expiresAt,
          },
          quota: {
            globalWindowRequests:
              searchClaim
                .global_window_count,
            globalDailyRequests:
              searchClaim
                .global_daily_count,
          },
        }
      );
    } catch (
      error
    ) {
      console.error(
        'open-library-work-cover failed:',
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
              : 'Unknown Open Library cache error.',
        }
      );
    }
  }
);
