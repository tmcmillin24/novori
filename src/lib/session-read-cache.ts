import { supabase } from './supabase';

type Entry = {
  value?: unknown;
  ready: boolean;
  expiresAt: number;
  pending?: Promise<unknown>;
};

type ReadOptions = {
  force?: boolean;
  ttlMs?: number;
  timeoutMs?: number;
};

const entries = new Map<string, Entry>();
let currentScope = '';
let listening = false;

function setScope(scope: string) {
  if (scope !== currentScope) {
    entries.clear();
    currentScope = scope;
  }
}

/** Local identity for UI/cache partitioning only. RPCs still enforce server authorization. */
export async function getSessionReadScope() {
  if (!listening && typeof supabase.auth.onAuthStateChange === 'function') {
    listening = true;
    // This callback stays synchronous to avoid taking an auth lock inside another auth callback.
    supabase.auth.onAuthStateChange((_event, session) => {
      setScope(session ? `${session.user.id}:${session.access_token}` : '');
    });
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session;
  setScope(session ? `${session.user.id}:${session.access_token}` : '');
  return { userId: session?.user.id ?? null, key: currentScope };
}

export function invalidateSessionReads(prefix = '') {
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}

export function isTransientReadError(error: unknown) {
  const value = error as { message?: string; details?: string; name?: string; code?: string };
  return value?.name === 'AbortError'
    || value?.code === 'READ_TIMEOUT'
    || /fetch failed|failed to fetch|network|connection.*lost|timed?\s*out/i.test(
      `${value?.message ?? ''} ${value?.details ?? ''}`
    );
}

/** Short-lived, bounded, memory-only reads. Failed or invalidated responses never populate the cache. */
export function sessionRead<T>(
  scope: string,
  key: string,
  read: (signal: AbortSignal) => Promise<T>,
  options: ReadOptions = {}
): Promise<T> {
  const cacheKey = `${key}|${scope}`;
  const existing = entries.get(cacheKey);
  if (!options.force && existing) {
    if (existing.pending) return existing.pending as Promise<T>;
    if (existing.ready && existing.expiresAt > Date.now()) {
      return Promise.resolve(existing.value as T);
    }
  }

  const controller = new AbortController();
  const entry: Entry = { ready: false, expiresAt: 0 };
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = Object.assign(
        new Error('The connection took too long. Please try again.'),
        { code: 'READ_TIMEOUT' }
      );
      reject(error);
      controller.abort();
    }, options.timeoutMs ?? 8000);
  });

  const request = Promise.race([
    Promise.resolve().then(() => read(controller.signal)),
    timeout,
  ]).then(value => {
    if (currentScope === scope && entries.get(cacheKey) === entry) {
      entry.value = value;
      entry.ready = true;
      entry.expiresAt = Date.now() + (options.ttlMs ?? 20000);
    }
    return value;
  }).finally(() => {
    clearTimeout(timer);
    entry.pending = undefined;
    if (!entry.ready && entries.get(cacheKey) === entry) entries.delete(cacheKey);
  });

  entry.pending = request;
  entries.set(cacheKey, entry);
  while (entries.size > 40) entries.delete(entries.keys().next().value!);
  return request;
}
