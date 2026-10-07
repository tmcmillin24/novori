import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { BookImageLinks } from './book-covers';

export type CanonicalCoverInput = {
  googleBookId?: string | null;
  isbn?: string | null;
  isbns?: string[];
  imageLinks?: BookImageLinks;
  existingCoverUrl?: string | null;
};

type Entry = { url: string | null; workId?: string; checkedAt: number; confirmed: boolean; revision: number };
type SelectionDetail = { workId?: string | null; url?: string | null };
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
const activeKeys = new Map<string, number>();
const pending = new Map<string, { input: CanonicalCoverInput; resolve: (url: string | null) => void }[]>();
const inFlight = new Map<string, { promise: Promise<string | null>; refresh: boolean; started: boolean }>();
const refreshAfterFlight = new Map<string, Promise<string | null>>();
const RECHECK_MS = 60_000;
const MAX_IDLE_ENTRIES = 1000;
const RETENTION_MS = 14 * 24 * 60 * 60_000;
const STORAGE_KEY = 'novori:canonical-book-covers:v1';
// A single Android storage record must also be bounded by size, not just count.
// This character budget is at most 1.54 MB in UTF-8, keeping native storage rows small.
const MAX_STORAGE_CHARS = 512_000;
let catalogRevision = 0;
export function getCanonicalBookCoverRevision() { return catalogRevision; }
let scheduled = false;
let hydrated = false;
let hydration: Promise<void> | undefined;
let persistenceTimer: ReturnType<typeof setTimeout> | undefined;
let persistenceQueue: Promise<void> = Promise.resolve();

function notify() { listeners.forEach(listener => listener()); }

// Keep mounted images pinned so eviction cannot blank a visible cover. The
// remaining map has a fixed bound; unmounting releases pins and trims it again.
function trimEntries() {
  let idle = 0;
  for (const key of entries.keys()) if (!activeKeys.has(key)) idle++;
  for (const key of entries.keys()) {
    if (idle <= MAX_IDLE_ENTRIES) break;
    if (!activeKeys.has(key)) { entries.delete(key); idle--; }
  }
}

function remember(key: string, entry: Entry) {
  entries.delete(key);
  entries.set(key, entry);
  trimEntries();
}

function storedEntry(value: unknown, now: number): [string, Entry] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [key, entry] = value;
  if (typeof key !== 'string' || !/^(?:[A-Za-z0-9_-]{1,200}|isbn:(?:[0-9]{13}|[0-9]{9}[0-9X]))$/.test(key) ||
      !entry || typeof entry !== 'object' || entry.confirmed !== true ||
      typeof entry.url !== 'string' || entry.url.length > 4096 || !/^https?:\/\/[^\s]+$/i.test(entry.url) ||
      !Number.isFinite(entry.checkedAt) || entry.checkedAt < 0 || entry.checkedAt > now || now - entry.checkedAt >= RETENTION_MS ||
      (entry.workId !== undefined && (typeof entry.workId !== 'string' || !entry.workId || entry.workId.length > 256))) return null;
  return [key, { url: secure(entry.url), checkedAt: entry.checkedAt, workId: entry.workId, confirmed: true, revision: 0 }];
}

function hydrate(): Promise<void> {
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw || raw.length > MAX_STORAGE_CHARS) return;
      const saved = JSON.parse(raw);
      if (saved?.version !== 1 || !Array.isArray(saved.entries)) return;
      const now = Date.now();
      const restored = saved.entries.slice(-MAX_IDLE_ENTRIES).map((value: unknown) => storedEntry(value, now))
        .filter((value: [string, Entry] | null): value is [string, Entry] => value !== null)
        .sort((a: [string, Entry], b: [string, Entry]) => a[1].checkedAt - b[1].checkedAt);
      // A live catalog result always wins over a delayed disk read, including
      // previously saved aliases of a work that was just promoted/locked.
      const liveWorks = new Map<string, Entry>();
      for (const entry of entries.values()) {
        if (entry.confirmed && entry.workId) liveWorks.set(entry.workId, entry);
      }
      const restoredWorks = new Map<string, Entry>();
      for (const [, entry] of restored) if (entry.workId) restoredWorks.set(entry.workId, entry);
      const restoredKeys = new Map<string, Entry>(restored);
      let changed = false;
      for (const [key, entry] of restoredKeys) {
        if (entries.get(key)?.confirmed) continue;
        const winner = entry.workId ? liveWorks.get(entry.workId) ?? restoredWorks.get(entry.workId) ?? entry : entry;
        remember(key, winner);
        changed = true;
      }
      if (changed) notify();
    } catch { /* Corrupt/unavailable device storage must never block the catalog. */ }
    finally { hydrated = true; }
  })();
  return hydration;
}

function persist() {
  if (persistenceTimer !== undefined) return;
  // Coalesce grid/batch updates, then serialize writes. Snapshot only after
  // hydration and preceding writes so older data cannot replace a newer choice.
  persistenceTimer = setTimeout(() => {
    persistenceTimer = undefined;
    persistenceQueue = persistenceQueue.then(async () => {
      await hydrate();
      try {
        const now = Date.now();
        const prefix = '{"version":1,"entries":[';
        const suffix = ']}';
        const saved: string[] = [];
        let length = prefix.length + suffix.length;
        for (const value of [...entries].reverse()) {
          if (saved.length === MAX_IDLE_ENTRIES) break;
          if (!storedEntry(value, now)) continue;
          const [key, entry] = value;
          const encoded = JSON.stringify([key, { url: entry.url, workId: entry.workId, checkedAt: entry.checkedAt, confirmed: true }]);
          const added = encoded.length + (saved.length ? 1 : 0);
          if (length + added > MAX_STORAGE_CHARS) continue;
          saved.push(encoded);
          length += added;
        }
        await AsyncStorage.setItem(STORAGE_KEY, prefix + saved.reverse().join(',') + suffix);
      } catch { /* Quota/native storage failures do not affect rendered artwork. */ }
    });
  }, 100);
}

function secure(url?: string | null) {
  return typeof url === 'string' ? url.trim().replace(/^http:\/\//i, 'https://') || null : null;
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
  const entry = key ? entries.get(key) : undefined;
  if (key && entry) { entries.delete(key); entries.set(key, entry); }
  return entry?.url ?? null;
}

export function subscribeCanonicalBookCovers(listener: () => void, key?: string | null) {
  if (key) activeKeys.set(key, (activeKeys.get(key) ?? 0) + 1);
  listeners.add(listener);
  void hydrate();
  return () => {
    listeners.delete(listener);
    if (key) {
      const count = (activeKeys.get(key) ?? 1) - 1;
      if (count) activeKeys.set(key, count); else activeKeys.delete(key);
      trimEntries();
    }
  };
}

// Only catalog responses can replace an established choice. Old post, stack,
// route and library snapshots are fallback data, never competing cover selectors.
export function publishCatalogCovers(
  covers: Record<string, string | null>,
  details: Record<string, SelectionDetail> = {},
  readRevision?: number,
) {
  const publicationRevision = ++catalogRevision;
  for (const [key, rawUrl] of Object.entries(covers)) {
    const url = secure(rawUrl);
    const previous = entries.get(key);
    const workId = details[key]?.workId ?? previous?.workId;
    if (!url) continue;
    // A read started before another catalog result cannot undo that selection,
    // even when its response introduces a previously unknown ISBN/work alias.
    const newer = readRevision === undefined ? undefined : [...entries.values()].find(entry =>
      entry.confirmed && entry.revision > readRevision && entry.revision < publicationRevision &&
      (entry === previous || Boolean(workId && entry.workId === workId)));
    if (newer) { remember(key, newer); continue; }
    const entry = { url, workId: workId || undefined, checkedAt: Date.now(), confirmed: true, revision: publicationRevision };
    if (workId) {
      for (const [alias, oldEntry] of entries) {
        if (oldEntry.workId === workId) entries.set(alias, entry);
      }
    }
    remember(key, entry);
  }
  persist();
  notify();
}

async function flush() {
  scheduled = false;
  const requests = [...pending.entries()].slice(0, 200);
  requests.forEach(([key]) => pending.delete(key));
  if (pending.size) schedule();
  const inputs = requests.map(([, waiters]) => waiters[0].input);
  requests.forEach(([key]) => { const flight = inFlight.get(key); if (flight) flight.started = true; });
  const readRevision = catalogRevision;
  try {
    const { data, error } = await supabase.functions.invoke('book-cover-selection', {
      body: {
        volumeIds: [...new Set(inputs.map(input => input.googleBookId).filter(Boolean))],
        isbns: [...new Set([...inputs.map(input => validIsbns(input)[0]).filter(Boolean),
          ...inputs.flatMap(validIsbns)])].slice(0, 400),
      },
    });
    if (error || data?.ok !== true) throw error ?? new Error('Cover catalog unavailable');
    publishCatalogCovers(data.data?.covers ?? {}, data.data?.details ?? {}, readRevision);
    for (const [key, waiters] of requests) {
      if (!entries.has(key)) remember(key, { url: fallback(waiters[0].input), checkedAt: Date.now(), confirmed: false, revision: 0 });
      else remember(key, { ...entries.get(key)!, checkedAt: Date.now() });
    }
    persist();
  } catch {
    // Keep one shared fallback while offline. Retry on the next mount/read;
    // do not probe other providers or choose different artwork per screen.
    for (const [key, waiters] of requests) {
      if (!entries.has(key)) remember(key, { url: fallback(waiters[0].input), checkedAt: 0, confirmed: false, revision: 0 });
    }
  }
  notify();
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
  // Existing catalog results need no disk wait. Cold requests share one local
  // read before deciding whether a catalog request is needed.
  if (!hydrated && !entries.get(key)?.confirmed && !key.startsWith('url:')) {
    return hydrate().then(() => resolveCanonicalBookCover(input, refresh));
  }
  let existing = entries.get(key);
  if (existing && !existing.url && fallback(input)) {
    existing = { ...existing, url: fallback(input) };
    remember(key, existing);
    notify();
  }
  if (key.startsWith('url:')) {
    if (!existing) {
      remember(key, { url: fallback(input), checkedAt: Date.now(), confirmed: false, revision: 0 });
      notify();
    }
    return Promise.resolve(entries.get(key)?.url ?? fallback(input));
  }
  if (!refresh && existing && Date.now() - existing.checkedAt < RECHECK_MS) return Promise.resolve(existing.url);
  if (!refresh && existing?.confirmed) {
    // Keep the established original URL usable while rechecking the catalog.
    // Staleness does not put a network wait back in front of cached artwork.
    void requestCover(input, key, false);
    return Promise.resolve(existing.url);
  }
  return requestCover(input, key, refresh);
}

function requestCover(input: CanonicalCoverInput, key: string, refresh: boolean): Promise<string | null> {
  const running = inFlight.get(key);
  if (running) {
    if (!refresh || running.refresh) return running.promise;
    // If the batch has not left yet, its catalog read will already occur after
    // the promotion. Upgrade that request instead of issuing a second one.
    if (!running.started) { running.refresh = true; return running.promise; }
    // A promotion may have completed after the ordinary request started. Keep
    // one follow-up refresh in that case; all overlapping callers share it.
    let followUp = refreshAfterFlight.get(key);
    if (!followUp) {
      followUp = running.promise.then(() => requestCover(input, key, true));
      refreshAfterFlight.set(key, followUp);
      const shared = followUp;
      void followUp.finally(() => { if (refreshAfterFlight.get(key) === shared) refreshAfterFlight.delete(key); });
    }
    return followUp;
  }
  const promise = new Promise<string | null>(resolve => {
    pending.set(key, [...(pending.get(key) ?? []), { input, resolve }]);
    schedule();
  });
  const flight = { promise, refresh, started: false };
  inFlight.set(key, flight);
  void promise.finally(() => { if (inFlight.get(key) === flight) inFlight.delete(key); });
  return promise;
}
