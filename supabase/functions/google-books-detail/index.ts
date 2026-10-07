import { getServerKey } from "../_shared/supabase-keys.mjs";
import { isbnDbEnabled, handleIsbnDbRequest } from '../_shared/isbndb.ts';
import { fetchJsonWithTimeout, readProviderCache, rememberGoogleFailure } from '../_shared/provider-cache.ts';
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
  90 * 24 * 60 * 60 * 1000;
const STALE_TTL_MS =
  365 * 24 * 60 * 60 * 1000;
const SOFT_DAILY_GUARD =
  650;
const EMERGENCY_DAILY_GUARD =
  900;

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

function buildCacheKey(
  volumeId:
    string
) {
  return `detail:v${CACHE_VERSION}:${volumeId}`;
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
    SupabaseClient,
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

  if (error) {
    console.warn(
      'Could not record Google Books detail cache hit:',
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

    if (isbnDbEnabled()) return handleIsbnDbRequest(request, 'detail');
    // Books saved during the rollout must still open after a provider rollback.
    const compatibilityBody = await request.clone().json().catch(() => null);
    if (typeof compatibilityBody?.volumeId === 'string' && compatibilityBody.volumeId.startsWith('nv_')) {
      return handleIsbnDbRequest(request, 'detail');
    }

    try {
      const supabaseUrl =
        Deno.env.get(
          'SUPABASE_URL'
        );

      const serviceRoleKey =
        getServerKey(name => Deno.env.get(name));

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

      const volumeId =
        typeof body?.volumeId ===
          'string'
          ? body.volumeId
              .trim()
          : '';

      if (
        !volumeId ||
        volumeId.length >
          200 ||
        !/^[A-Za-z0-9_-]+$/.test(
          volumeId
        )
      ) {
        return jsonResponse(
          {
            ok: false,
            status: 400,
            error:
              'Invalid Google Books volume ID.',
          }
        );
      }

      const requestKey =
        buildCacheKey(
          volumeId
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

      if (cacheError) {
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
          'google-books-detail cache=hit'
        );

        await recordGoogleBooksInCatalog(
          supabaseAdmin,
          cache.response_json,
          true,
          'google_detail_cache'
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
      const failure = await readProviderCache(supabaseAdmin, PROVIDER, requestKey + ':failure');
      if (failure && Date.parse(failure.expires_at) > Date.now()) {
        if (staleAvailable) {
          await recordCacheHit(supabaseAdmin, requestKey, true);
          return jsonResponse({ ok: true, status: 200, data: cache?.response_json,
            cache: { status: 'stale', googleRequestMade: false, reason: 'provider_cooldown' } });
        }
        return jsonResponse({ ok: false, status: failure.response_json.status ?? 503,
          error: 'Google Books request is temporarily cached as unavailable.',
          cache: { status: 'hit', googleRequestMade: false, reason: 'provider_cooldown' } });
      }


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

      if (dailyUsageError) {
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
          'google-books-detail cache=stale reason=soft-quota-guard'
        );

        await recordGoogleBooksInCatalog(
          supabaseAdmin,
          cache?.response_json,
          true,
          'google_detail_cache'
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

      if (
        upstreamToday >=
          EMERGENCY_DAILY_GUARD
      ) {
        console.info(
          'google-books-detail blocked reason=emergency-quota-guard'
        );

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
          refreshOwnerToken
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

          console.info(
            'google-books-detail cache=stale reason=refresh-in-progress'
          );

          await recordGoogleBooksInCatalog(
            supabaseAdmin,
            cache?.response_json,
            true,
            'google_detail_cache'
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

          console.info(
            `google-books-detail cache=${filledIsFresh ? 'hit' : 'stale'} reason=waited-for-refresh`
          );

          await recordGoogleBooksInCatalog(
            supabaseAdmin,
            filledCache.response_json,
            true,
            'google_detail_cache'
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
              'This book detail is already being refreshed. Please try again.',
            reason:
              'refresh_in_progress',
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

      if (claimError) {
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

      if (!claim?.allowed) {
        if (staleAvailable) {
          await recordCacheHit(
            supabaseAdmin,
            requestKey,
            true
          );

          console.info(
            `google-books-detail cache=stale reason=${claim?.reason ?? 'rate-limited'}`
          );

          await recordGoogleBooksInCatalog(
            supabaseAdmin,
            cache?.response_json,
            true,
            'google_detail_cache'
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
          `google-books-detail blocked reason=${claim?.reason ?? 'rate-limited'}`
        );

        return jsonResponse(
          {
            ok: false,
            status: 429,
            error:
              claim?.reason ===
                'global_quota_guard'
                ? 'Book details are temporarily using the daily API safety limit. Please try again later.'
                : 'Too many uncached book requests. Please wait a few minutes and try again.',
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
          `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(
            volumeId
          )}`
        );

      googleUrl.searchParams.set(
        'key',
        googleApiKey
      );

      const googleResponse = await fetchJsonWithTimeout(
          googleUrl.toString()
        );

      if (!googleResponse.ok) {
        await rememberGoogleFailure(supabaseAdmin, requestKey, googleResponse.status);

        if (staleAvailable) {
          await recordCacheHit(
            supabaseAdmin,
            requestKey,
            true
          );

          console.warn(
            `google-books-detail cache=stale google-status=${googleResponse.status}`
          );

          await recordGoogleBooksInCatalog(
            supabaseAdmin,
            cache?.response_json,
            true,
            'google_detail_cache'
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
              'Google Books detail is temporarily unavailable.',
          }
        );
      }

      const payload =
        await googleResponse
          .json();

      await recordGoogleBooksInCatalog(
        supabaseAdmin,
        payload,
        true,
        'google_detail'
      );

      const fetchedAt =
        new Date();

      const expiresAt =
        new Date(
          fetchedAt.getTime() +
            jitteredDurationMs(
              CACHE_TTL_MS
            )
        );

      const staleUntil =
        new Date(
          fetchedAt.getTime() +
            jitteredDurationMs(
              STALE_TTL_MS
            )
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

      if (writeError) {
        console.warn(
          'Could not write shared Google Books detail cache:',
          writeError.message
        );
      }

      console.info(
        'google-books-detail cache=miss google=1'
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
        'google-books-detail failed:',
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
              : 'Unknown detail cache error.',
        }
      );
    }
  }
);
