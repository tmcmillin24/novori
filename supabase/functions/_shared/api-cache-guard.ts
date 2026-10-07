import type {
  SupabaseClient,
} from 'https://esm.sh/@supabase/supabase-js@2';

export type SharedApiCacheRow = {
  response_json: unknown;
  expires_at: string;
  stale_until: string;
  fetched_at?: string;
};

type RefreshClaimRow = {
  acquired: boolean;
  lock_until: string | null;
};

const DEFAULT_JITTER_FRACTION =
  0.15;
const DEFAULT_REFRESH_LEASE_SECONDS =
  30;
const WAIT_ATTEMPTS =
  12;
const WAIT_DELAY_MS =
  250;

export function jitteredDurationMs(
  baseMs: number,
  maxExtraFraction =
    DEFAULT_JITTER_FRACTION
) {
  const extra =
    Math.random() *
    Math.max(
      0,
      maxExtraFraction
    );

  return Math.round(
    baseMs *
      (
        1 +
        extra
      )
  );
}

export async function claimApiCacheRefresh(
  supabaseAdmin: SupabaseClient,
  provider: string,
  requestKey: string,
  ownerToken: string,
  leaseSeconds =
    DEFAULT_REFRESH_LEASE_SECONDS
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin.rpc(
      'novori_claim_api_cache_refresh',
      {
        p_provider:
          provider,
        p_request_key:
          requestKey,
        p_owner_token:
          ownerToken,
        p_lease_seconds:
          leaseSeconds,
      }
    );

  if (error) {
    throw new Error(
      'Could not claim API cache refresh lock: ' +
      error.message
    );
  }

  const claim =
    (
      Array.isArray(
        data
      )
        ? data[0]
        : data
    ) as
      RefreshClaimRow | null;

  return {
    acquired:
      Boolean(
        claim?.acquired
      ),
    lockUntil:
      claim?.lock_until ??
      null,
  };
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

async function readApiCacheRow(
  supabaseAdmin: SupabaseClient,
  provider: string,
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
        provider
      )
      .eq(
        'request_key',
        requestKey
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      'Could not re-read shared API cache: ' +
      error.message
    );
  }

  return data as
    SharedApiCacheRow | null;
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

export async function waitForApiCacheFill(
  supabaseAdmin: SupabaseClient,
  provider: string,
  requestKey: string,
  transform: (row: SharedApiCacheRow) => SharedApiCacheRow = row => row
) {
  for (
    let attempt = 0;
    attempt <
    WAIT_ATTEMPTS;
    attempt += 1
  ) {
    if (
      attempt >
      0
    ) {
      await sleep(
        WAIT_DELAY_MS
      );
    }

    const storedCache =
      await readApiCacheRow(
        supabaseAdmin,
        provider,
        requestKey
      );

    const cache = storedCache ? transform(storedCache) : null;

    const now =
      Date.now();

    if (
      cache &&
      (
        isFuture(
          cache.expires_at,
          now
        ) ||
        isFuture(
          cache.stale_until,
          now
        )
      )
    ) {
      return cache;
    }
  }

  return null;
}

export function cacheRowIsFresh(
  cache: SharedApiCacheRow,
  now = Date.now()
) {
  return isFuture(
    cache.expires_at,
    now
  );
}
