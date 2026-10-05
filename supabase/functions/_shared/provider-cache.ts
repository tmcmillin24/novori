import { isbnDbEnabled, isbnDbSearch } from './isbndb.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { claimApiCacheRefresh, jitteredDurationMs } from './api-cache-guard.ts';

const RETRY_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
type ProviderCacheRow = {
  response_json: any; status_code: number; fetched_at: string; expires_at: string; stale_until: string;
};

export function createCacheAdmin() {
  const url = Deno.env.get('SUPABASE_URL');
  let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  try {
    key = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default ?? key;
  } catch { /* Legacy service-role key remains supported. */ }
  if (!url || !key) throw new Error('Shared API cache is not configured.');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function requireReader(admin: SupabaseClient, request: Request) {
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('A reader session is required.');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new Error('A valid reader session is required.');
  return data.user;
}

export async function cacheDigest(value: unknown) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function readProviderCache(admin: SupabaseClient, provider: string, key: string) {
  const { data, error } = await admin.from('book_api_cache')
    .select('response_json, status_code, fetched_at, expires_at, stale_until')
    .eq('provider', provider).eq('request_key', key).maybeSingle();
  // Cache/lock outages must not turn every app request into a provider request.
  if (error) throw new Error('Could not read shared API cache: ' + error.message);
  return data as ProviderCacheRow | null;
}

export async function writeProviderCache(
  admin: SupabaseClient, provider: string, key: string, data: unknown,
  freshMs: number, staleMs: number, sourceExpiresAt = Infinity,
) {
  const now = Date.now();
  const row = {
    provider, request_key: key, response_json: data, status_code: 200,
    fetched_at: new Date(now).toISOString(),
    expires_at: new Date(Math.min(now + jitteredDurationMs(freshMs), sourceExpiresAt)).toISOString(),
    stale_until: new Date(now + jitteredDurationMs(Math.max(freshMs, staleMs))).toISOString(),
    schema_version: 1, hit_count: 0, last_hit_at: null,
  };
  const { error } = await admin.from('book_api_cache').upsert(row, { onConflict: 'provider,request_key' });
  if (error) throw new Error('Could not persist shared API cache: ' + error.message);
  return row;
}

function fresh(row: ProviderCacheRow | null | undefined): boolean {
  return Boolean(row && Date.parse(row.expires_at) > Date.now());
}
function usable(row: ProviderCacheRow | null | undefined): boolean {
  return Boolean(row && Date.parse(row.stale_until) > Date.now());
}

async function recordHit(admin: SupabaseClient, provider: string, key: string, stale: boolean) {
  const { error } = await admin.rpc('novori_record_api_cache_hit', {
    p_provider: provider, p_request_key: key, p_stale: stale,
  });
  if (error) console.warn('Could not record provider cache hit:', error.message);
}

export async function cachedProviderValue<T>(options: {
  admin: SupabaseClient; provider: string; key: string; freshMs: number; staleMs: number;
  load: () => Promise<T>; leaseSeconds?: number; allowStale?: boolean;
  onCacheRead?: (row: any) => void; sourceExpiresAt?: () => number;
}): Promise<T> {
  const { admin, provider, key, freshMs, staleMs, load } = options;
  const cached = await readProviderCache(admin, provider, key);
  if (cached && fresh(cached)) {
    options.onCacheRead?.(cached);
    await recordHit(admin, provider, key, false);
    return cached.response_json as T;
  }
  const retry = await readProviderCache(admin, provider, key + ':retry');
  if (fresh(retry)) {
    if (options.allowStale !== false && cached && usable(cached)) {
      await recordHit(admin, provider, key, true);
      return cached.response_json as T;
    }
    throw new Error('Provider refresh is cooling down. Please try again later.');
  }
  const claim = await claimApiCacheRefresh(admin, provider, key, crypto.randomUUID(), options.leaseSeconds ?? 30);
  if (!claim.acquired) {
    if (options.allowStale !== false && cached && usable(cached)) {
      await recordHit(admin, provider, key, true);
      return cached.response_json as T;
    }
    // Wait for the owner. A miss never falls through to an unclaimed API request.
    for (let attempt = 0; attempt < 12; attempt++) {
      if (attempt) await new Promise(resolve => setTimeout(resolve, 250));
      const filled = await readProviderCache(admin, provider, key);
      if (filled && (fresh(filled) || (options.allowStale !== false && usable(filled)))) {
        options.onCacheRead?.(filled);
        await recordHit(admin, provider, key, !fresh(filled));
        return filled.response_json as T;
      }
    }
    const busy = new Error('Provider refresh is already in progress.');
    busy.name = 'CacheRefreshBusy';
    throw busy;
  }
  try {
    const result = await load();
    const row = await writeProviderCache(admin, provider, key, result, freshMs, staleMs, options.sourceExpiresAt?.());
    options.onCacheRead?.(row);
    return result;
  } catch (error) {
    // Keep the original stale deadline. Failed refreshes cannot make old data immortal.
    if (!(error instanceof Error && ['CacheRefreshBusy', 'CacheQuotaBlocked'].includes(error.name))) {
      try {
        await writeProviderCache(admin, provider, key + ':retry', { retry: true }, RETRY_MS, RETRY_MS);
      } catch (cacheError) { console.warn('Could not persist provider retry cooldown:', cacheError); }
    }
    if (options.allowStale !== false && cached && usable(cached)) {
      await recordHit(admin, provider, key, true);
      return cached.response_json as T;
    }
    throw error;
  }
}

// The timeout includes reading the body, so an API cannot outlive its refresh lease.
export async function fetchJsonWithTimeout(url: string, init: RequestInit = {}) {
  const target = new URL(url);
  if (isbnDbEnabled() && (target.hostname === 'googleapis.com' || target.hostname.endsWith('.googleapis.com')) && target.pathname.startsWith('/books/')) {
    throw new Error('Google Books API requests are disabled while ISBNdb is active.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.text();
    if (response.ok) JSON.parse(body);
    // Return a buffered response for existing endpoint parsers and HTTP fallbacks.
    return new Response(body, { status: response.status, headers: response.headers });
  } catch {
    return new Response(JSON.stringify({ error: 'Book provider request timed out or failed.' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  } finally { clearTimeout(timer); }
}

export async function cachedHardcoverFetch(
  admin: SupabaseClient, url: string, init: RequestInit,
  freshMs: number, staleMs: number, provider = 'hardcover_series', onCacheRead?: (row: any) => void,
) {
  const request = JSON.parse(String(init.body));
  // Normalize formatting only; preserve string literals and GraphQL semantics.
  const key = 'graphql:v1:' + await cacheDigest({ query: request.query, variables: request.variables ?? {} });
  const data = await cachedProviderValue({ admin, provider, key, freshMs, staleMs, allowStale: false, onCacheRead, load: async () => {
    const response = await fetchHardcoverUpstream(admin, url, init, provider);
    if (!response.ok) throw new Error('Hardcover request failed (' + response.status + ').');
    const payload = await response.json();
    if (payload.errors?.length) throw new Error('Hardcover returned GraphQL errors.');
    return payload;
  } });
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function fetchHardcoverUpstream(admin: SupabaseClient, url: string, init: RequestInit, route = 'unknown') {
  const retry = await readProviderCache(admin, 'hardcover_popularity', 'hardcover:rate-limit-retry');
  if (fresh(retry)) throw new Error('Hardcover rate limit is cooling down.');
  const { error: usageError } = await admin.rpc('novori_record_hardcover_request');
  if (usageError) throw new Error('Could not record Hardcover request: ' + usageError.message);
  console.info('Hardcover upstream request', { provider: 'hardcover', route });
  const response = await fetchJsonWithTimeout(url, init);
  if (response.status === 429) {
    await writeProviderCache(admin, 'hardcover_popularity', 'hardcover:rate-limit-retry', { retry: true }, RETRY_MS, RETRY_MS);
  }
  return response;
}

export async function cachedGoogleQuery(
  admin: SupabaseClient, url: string, claimQuota: () => Promise<boolean>,
) {
  if (isbnDbEnabled()) {
    const parsed = new URL(url);
    const payload = await isbnDbSearch(admin, '', parsed.searchParams.get('q') ?? '', Number(parsed.searchParams.get('startIndex') ?? 0));
    return new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } });
  }
  const normalized = new URL(url);
  normalized.searchParams.delete('key');
  normalized.searchParams.sort();
  const query = (normalized.searchParams.get('q') ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  const standardSearch = normalized.searchParams.get('maxResults') === '40'
    && normalized.searchParams.get('projection') === 'full'
    && normalized.searchParams.get('printType') === 'books';
  const key = standardSearch ? 'search:v1:' + query : 'query:v1:' + await cacheDigest(normalized.toString());
  try {
    if (!standardSearch) {
      const sharedSearch = await readProviderCache(admin, 'google_books', 'search:v1:' + query);
      if (sharedSearch && fresh(sharedSearch)) {
        const limit = Number(normalized.searchParams.get('maxResults') ?? 10);
        const payload = sharedSearch.response_json;
        return new Response(JSON.stringify({ ...payload, items: (payload.items ?? []).slice(0, limit) }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    const data = await cachedProviderValue({
      admin, provider: 'google_books', key,
      freshMs: 14 * 86400000, staleMs: 60 * 86400000,
      load: async () => {
        if (!await claimQuota()) {
          const blocked = new Error('Google Books quota reserve is active.');
          blocked.name = 'CacheQuotaBlocked';
          throw blocked;
        }
        const response = await fetchJsonWithTimeout(url);
        if (!response.ok) throw new Error('Google Books query failed (' + response.status + ').');
        return response.json();
      },
    });
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'Google Books query is unavailable.' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function rememberGoogleFailure(admin: SupabaseClient, key: string, status: number) {
  const ttl = status === 404 ? 86400000 : RETRY_MS;
  await writeProviderCache(admin, 'google_books', key + ':failure', { status }, ttl, ttl);
}
