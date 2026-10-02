import { supabase } from './supabase';
import type { BookImageLinks } from './book-covers';

export type CanonicalCoverInput = {
  googleBookId?: string | null;
  isbn?: string | null;
  isbns?: string[];
  imageLinks?: BookImageLinks;
  existingCoverUrl?: string | null;
};

type Entry = { url: string | null; workId?: string; checkedAt: number };
type SelectionDetail = { workId?: string | null; url?: string | null };
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const pending = new Map<string, { input: CanonicalCoverInput; resolve: (url: string | null) => void }[]>();
const inFlight = new Map<string, Promise<string | null>>();
const RECHECK_MS = 60_000;
let scheduled = false;

function secure(url?: string | null) {
  return url?.trim().replace(/^http:\/\//i, 'https://') || null;
}

function validIsbns(input: CanonicalCoverInput) {
  return [...new Set([input.isbn, ...(input.isbns ?? [])].map(value =>
    (value ?? '').replace(/[^0-9Xx]/g, '').toUpperCase()
  ).filter(value => /^(?:[0-9]{13}|[0-9]{9}[0-9X])$/.test(value)))];
}

export function canonicalCoverKey(input: CanonicalCoverInput) {
  return input.googleBookId || (validIsbns(input)[0] ? `isbn:${validIsbns(input)[0]}` :
    (fallback(input) ? `url:${fallback(input)}` : null));
}

function fallback(input: CanonicalCoverInput) {
  const links = input.imageLinks;
  return secure(input.existingCoverUrl) ?? secure(links?.extraLarge) ?? secure(links?.large) ??
    secure(links?.medium) ?? secure(links?.small) ?? secure(links?.thumbnail) ?? secure(links?.smallThumbnail);
}

export function getCanonicalBookCover(input: CanonicalCoverInput) {
  const key = canonicalCoverKey(input);
  return key && entries.has(key) ? entries.get(key)!.url : null;
}

export function subscribeCanonicalBookCovers(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Only catalog responses can replace an established choice. Old post, stack,
// route and library snapshots are fallback data, never competing cover selectors.
export function publishCatalogCovers(
  covers: Record<string, string | null>,
  details: Record<string, SelectionDetail> = {},
) {
  for (const [key, rawUrl] of Object.entries(covers)) {
    const url = secure(rawUrl);
    const previous = entries.get(key);
    const workId = details[key]?.workId ?? previous?.workId;
    if (!url) continue;
    const entry = { url, workId: workId || undefined, checkedAt: Date.now() };
    entries.set(key, entry);
    if (workId) {
      for (const [alias, oldEntry] of entries) {
        if (oldEntry.workId === workId) entries.set(alias, entry);
      }
    }
  }
  listeners.forEach(listener => listener());
}

async function flush() {
  scheduled = false;
  const requests = [...pending.entries()].slice(0, 200);
  requests.forEach(([key]) => pending.delete(key));
  if (pending.size) schedule();
  const inputs = requests.map(([, waiters]) => waiters[0].input);
  try {
    const { data, error } = await supabase.functions.invoke('book-cover-selection', {
      body: {
        volumeIds: [...new Set(inputs.map(input => input.googleBookId).filter(Boolean))],
        isbns: [...new Set([...inputs.map(input => validIsbns(input)[0]).filter(Boolean),
          ...inputs.flatMap(validIsbns)])].slice(0, 400),
      },
    });
    if (error || data?.ok !== true) throw error ?? new Error('Cover catalog unavailable');
    publishCatalogCovers(data.data?.covers ?? {}, data.data?.details ?? {});
    for (const [key, waiters] of requests) {
      if (!entries.has(key)) entries.set(key, { url: fallback(waiters[0].input), checkedAt: Date.now() });
      else entries.set(key, { ...entries.get(key)!, checkedAt: Date.now() });
    }
  } catch {
    // Keep one shared fallback while offline. Retry on the next mount/read;
    // do not probe other providers or choose different artwork per screen.
    for (const [key, waiters] of requests) {
      if (!entries.has(key)) entries.set(key, { url: fallback(waiters[0].input), checkedAt: 0 });
    }
  }
  listeners.forEach(listener => listener());
  for (const [key, waiters] of requests) {
    waiters.forEach(waiter => waiter.resolve(entries.get(key)?.url ?? null));
  }
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => { void flush(); }, 0);
}

export function resolveCanonicalBookCover(input: CanonicalCoverInput, refresh = false): Promise<string | null> {
  const key = canonicalCoverKey(input);
  if (!key) return Promise.resolve(fallback(input));
  let existing = entries.get(key);
  if (existing && !existing.url && fallback(input)) {
    existing = { ...existing, url: fallback(input) };
    entries.set(key, existing);
    listeners.forEach(listener => listener());
  }
  if (key.startsWith('url:')) {
    if (!existing) {
      entries.set(key, { url: fallback(input), checkedAt: Date.now() });
      listeners.forEach(listener => listener());
    }
    return Promise.resolve(fallback(input));
  }
  if (!refresh && existing && Date.now() - existing.checkedAt < RECHECK_MS) return Promise.resolve(existing.url);
  const running = inFlight.get(key);
  if (running) return refresh ? running.then(() => resolveCanonicalBookCover(input, true)) : running;
  const promise = new Promise<string | null>(resolve => {
    pending.set(key, [...(pending.get(key) ?? []), { input, resolve }]);
    schedule();
  });
  inFlight.set(key, promise);
  void promise.finally(() => { if (inFlight.get(key) === promise) inFlight.delete(key); });
  return promise;
}
