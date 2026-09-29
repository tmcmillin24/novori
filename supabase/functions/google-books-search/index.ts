import {
  createClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':
    '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const PROVIDER =
  'google_books';
const CACHE_VERSION =
  1;
const CACHE_TTL_MS =
  24 * 60 * 60 * 1000;
const STALE_TTL_MS =
  7 * 24 * 60 * 60 * 1000;
const SOFT_DAILY_GUARD =
  800;

type CacheRow = {
  response_json:
    unknown;
  expires_at:
    string;
  stale_until:
    string;
};

type ClaimResult = {
  allowed:
    boolean;
  reason:
    string | null;
  user_window_count:
    number;
  user_daily_count:
    number;
  global_upstream_count:
    number;
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

function normalizeQuery(
  value:
    string
) {
  return value
    .normalize(
      'NFKC'
    )
    .toLowerCase()
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}

function buildCacheKey(
  query:
    string
) {
  return `search:v${CACHE_VERSION}:${normalizeQuery(
    query
  )}`;
}

function isFuture(
  value:
    string | null | undefined,
  now:
    number
) {
  if (
    !value
  ) {
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
  requestKey:
    string,
  stale:
    boolean
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

  if (
    error
  ) {
    console.warn(
      'Could not record Google Books cache hit:',
      error.message
    );
  }
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

      if (
        !googleApiKey
      ) {
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

      if (
        !accessToken
      ) {
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

      const query =
        typeof body?.query ===
          'string'
          ? body.query
              .trim()
          : '';

      if (
        query.length <
          2 ||
        query.length >
          200
      ) {
        return jsonResponse(
          {
            ok: false,
            status: 400,
            error:
              'Search query must be between 2 and 200 characters.',
          }
        );
      }

      const requestKey =
        buildCacheKey(
          query
        );

      const now =
        Date.now();

      const {
        data:
          cacheData,
        error:
          cacheError,
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

      if (
        cacheError
      ) {
        throw new Error(
          `Could not read shared book cache: ${cacheError.message}`
        );
      }

      const cache =
        cacheData as
          CacheRow | null;

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
          'google-books-search cache=hit'
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

      const today =
        new Date()
          .toISOString()
          .slice(
            0,
            10
          );

      const {
        data:
          dailyUsage,
        error:
          dailyUsageError,
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

      if (
        dailyUsageError
      ) {
        throw new Error(
          `Could not read API usage: ${dailyUsageError.message}`
        );
      }

      const upstreamToday =
        Number(
          dailyUsage
            ?.upstream_requests ??
            0
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

        console.info(
          'google-books-search cache=stale reason=soft-quota-guard'
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
            quota: {
              upstreamRequestsToday:
                upstreamToday,
            },
          }
        );
      }

      const {
        data:
          claimData,
        error:
          claimError,
      } =
        await supabaseAdmin.rpc(
          'novori_claim_google_books_search',
          {
            p_user_id:
              user.id,
          }
        );

      if (
        claimError
      ) {
        throw new Error(
          `Could not claim Google Books quota: ${claimError.message}`
        );
      }

      const claim =
        (
          Array.isArray(
            claimData
          )
            ? claimData[0]
            : claimData
        ) as
          ClaimResult | null;

      if (
        !claim?.allowed
      ) {
        if (
          staleAvailable
        ) {
          await recordCacheHit(
            supabaseAdmin,
            requestKey,
            true
          );

          console.info(
            `google-books-search cache=stale reason=${claim?.reason ?? 'rate-limited'}`
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
                  claim
                    ?.reason ??
                  'rate_limited',
              },
              quota: {
                upstreamRequestsToday:
                  claim
                    ?.global_upstream_count ??
                  upstreamToday,
              },
            }
          );
        }

        console.warn(
          `google-books-search blocked reason=${claim?.reason ?? 'rate-limited'}`
        );

        return jsonResponse(
          {
            ok: false,
            status: 429,
            error:
              claim?.reason ===
                'global_quota_guard'
                ? 'Book search is temporarily using its daily API safety limit. Please try again later.'
                : 'Too many uncached book searches. Please wait a few minutes and try again.',
            reason:
              claim
                ?.reason ??
              'rate_limited',
            quota: {
              upstreamRequestsToday:
                claim
                  ?.global_upstream_count ??
                upstreamToday,
            },
          }
        );
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
        '40'
      );
      googleUrl.searchParams.set(
        'printType',
        'books'
      );
      googleUrl.searchParams.set(
        'projection',
        'full'
      );
      googleUrl.searchParams.set(
        'key',
        googleApiKey
      );

      const googleResponse =
        await fetch(
          googleUrl.toString()
        );

      if (
        !googleResponse.ok
      ) {
        if (
          staleAvailable
        ) {
          await recordCacheHit(
            supabaseAdmin,
            requestKey,
            true
          );

          console.warn(
            `google-books-search cache=stale google-status=${googleResponse.status}`
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
                  `google_${googleResponse.status}`,
              },
            }
          );
        }

        return jsonResponse(
          {
            ok: false,
            status:
              googleResponse.status,
            error:
              'Google Books search is temporarily unavailable.',
          }
        );
      }

      const payload =
        await googleResponse
          .json();

      const fetchedAt =
        new Date();

      const expiresAt =
        new Date(
          fetchedAt.getTime() +
            CACHE_TTL_MS
        );

      const staleUntil =
        new Date(
          fetchedAt.getTime() +
            STALE_TTL_MS
        );

      const {
        error:
          writeError,
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

      if (
        writeError
      ) {
        console.warn(
          'Could not write shared Google Books cache:',
          writeError.message
        );
      }

      console.info(
        'google-books-search cache=miss google=1'
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
            googleRequestMade:
              true,
            expiresAt:
              expiresAt
                .toISOString(),
          },
          quota: {
            upstreamRequestsToday:
              claim
                .global_upstream_count,
            userWindowRequests:
              claim
                .user_window_count,
            userDailyRequests:
              claim
                .user_daily_count,
          },
        }
      );
    } catch (
      error
    ) {
      console.error(
        'google-books-search failed:',
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
              : 'Unknown search cache error.',
        },
        500
      );
    }
  }
);
