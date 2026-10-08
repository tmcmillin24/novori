import { normalizeBookGenres } from '../../supabase/functions/_shared/book-genres';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { BookImageLinks } from './book-covers';

export type CanonicalCoverInput = {
  googleBookId?: string | null;
  hardcoverBookId?: number;
  isbn?: string | null;
  isbns?: string[];
  imageLinks?: BookImageLinks;
  existingCoverUrl?: string | null;
};

type Entry = { provider?: string; genres?: string[]; failedUrls?: string[]; failedAt?: number; locked?: boolean; alternatives?: string[]; url: string | null; workId?: string; checkedAt: number; confirmed: boolean; revision: number };
type SelectionDetail = { aliases?: string[]; provider?: string | null; genres?: string[]; workId?: string | null; url?: string | null; locked?: boolean; rejectedUrls?: string[]; alternatives?: string[] };
const entries = new Map<string, Entry>();
// Rejections are scoped to a work so another work's manual selection is untouched.
const rejectedByWork = new Map<string, Set<string>>();
function permitted(url: string | null, workId?: string) {
  return url && workId && rejectedByWork.get(workId)?.has(url) ? null : url;
}
const failedUrls = new Map<string, Set<string>>();
const listeners = new Set<() => void>();
const activeKeys = new Map<string, number>();
const pending = new Map<string, { input: CanonicalCoverInput; resolve: (url: string | null) => void }[]>();
const inFlight = new Map<string, { promise: Promise<string | null>; refresh: boolean; started: boolean }>();
const refreshAfterFlight = new Map<string, Promise<string | null>>();
const RECHECK_MS = 60_000;
const MAX_IDLE_ENTRIES = 1000;
const RETENTION_MS = 14 * 24 * 60 * 60_000;
const STORAGE_KEY = 'novori:canonical-book-covers:v2';
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
      (entry.url !== null && (typeof entry.url !== 'string' || entry.url.length > 4096 || !/^https?:\/\/[^\s]+$/i.test(entry.url))) ||
      (entry.url === null && !entry.workId) ||
      !Number.isFinite(entry.checkedAt) || entry.checkedAt < 0 || entry.checkedAt > now || now - entry.checkedAt >= RETENTION_MS ||
      (entry.workId !== undefined && (typeof entry.workId !== 'string' || !entry.workId || entry.workId.length > 256))) return null;
  return [key, { provider: ['hardcover','manual','isbndb','google_books'].includes(entry.provider) ? entry.provider : undefined, genres: normalizeBookGenres(entry.genres), locked: entry.locked === true, failedUrls: Array.isArray(entry.failedUrls) ? entry.failedUrls.filter((url: unknown) => typeof url === 'string').slice(0, 8) : [], failedAt: Number(entry.failedAt) || 0, alternatives: Array.isArray(entry.alternatives) ? entry.alternatives.filter((url: unknown) => typeof url === 'string' && /^https:\/\//.test(url)).slice(0, 8) : [], url: secure(entry.url), checkedAt: entry.checkedAt, workId: entry.workId, confirmed: true, revision: 0 }];
}

function hydrate(): Promise<void> {
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw || raw.length > MAX_STORAGE_CHARS) return;
      const saved = JSON.parse(raw);
      if (saved?.version !== 1 || !Array.isArray(saved.entries)) return;
      if (Array.isArray(saved.rejections)) for (const value of saved.rejections.slice(-MAX_IDLE_ENTRIES)) {
        if (!Array.isArray(value) || value.length !== 2) continue;
        const [workId, urls] = value;
        if (typeof workId !== 'string' || !workId || workId.length > 256 || !Array.isArray(urls)) continue;
        if (rejectedByWork.has(workId)) continue; // Live responses win over disk.
        rejectedByWork.set(workId, new Set(urls.slice(-20).filter((url: unknown): url is string =>
          typeof url === 'string' && url.length <= 4096 && /^https:\/\/[^\s]+$/i.test(url))));
      }
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
        if (entry.failedUrls?.length && now - (entry.failedAt ?? 0) < 6 * 60 * 60_000 && !failedUrls.has(key)) failedUrls.set(key, new Set(entry.failedUrls));
        if (entries.get(key)?.confirmed) continue;
        const winner = entry.workId ? liveWorks.get(entry.workId) ?? restoredWorks.get(entry.workId) ?? entry : entry;
        remember(key, { ...winner, url: permitted(winner.url, winner.workId) });
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
        // Include revocations in the same bounded, atomic storage snapshot.
        const revocations = [...rejectedByWork].slice(-MAX_IDLE_ENTRIES).map(([id, urls]) => [id, [...urls].slice(-20)]);
        while (revocations.length && JSON.stringify(revocations).length > MAX_STORAGE_CHARS / 2) revocations.shift();
        const suffix = '],"rejections":' + JSON.stringify(revocations) + '}';
        const saved: string[] = [];
        let length = prefix.length + suffix.length;
        for (const value of [...entries].reverse()) {
          if (saved.length === MAX_IDLE_ENTRIES) break;
          const [key, original] = value;
          // A safe snapshot fallback is still not a catalog-selected image.
          // Persist only its rejection tombstone until a selection is confirmed.
          const entry = !original.confirmed && original.workId && rejectedByWork.get(original.workId)?.size
            ? { ...original, url: null, confirmed: true } : original;
          if (!storedEntry([key, entry], now)) continue;
          const encoded = JSON.stringify([key, { provider: entry.provider, genres: entry.genres, url: entry.url, locked: entry.locked, failedUrls: entry.failedUrls, failedAt: entry.failedAt, alternatives: entry.alternatives, workId: entry.workId, checkedAt: entry.checkedAt, confirmed: true }]);
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
  return input.googleBookId || (Number.isSafeInteger(input.hardcoverBookId) && input.hardcoverBookId! > 0 ? `hc_art_${input.hardcoverBookId}` : null) || (validIsbns(input)[0] ? `isbn:${validIsbns(input)[0]}` :
    (fallback(input) ? `url:${fallback(input)}` : null));
}

function fallback(input: CanonicalCoverInput) {
  const links = input.imageLinks;
  const key = input.googleBookId || (validIsbns(input)[0] ? `isbn:${validIsbns(input)[0]}` : undefined);
  const workId = key ? entries.get(key)?.workId : undefined;
  return [input.existingCoverUrl, links?.extraLarge, links?.large, links?.medium, links?.small, links?.thumbnail, links?.smallThumbnail]
    .map(url => permitted(secure(url), workId)).filter(url => !url || (!/assets\.hardcover\.app/i.test(url) && !failedUrls.get(key ?? '')?.has(url))).find(Boolean) ?? null;
}

export function getCanonicalBookCover(input: CanonicalCoverInput) {
  const key = canonicalCoverKey(input);
  const entry = key ? entries.get(key) : undefined;
  if (key && entry) { entries.delete(key); entries.set(key, entry); }
  return entry?.url ?? (entry ? null : fallback(input));
}

export function getCanonicalBookCoverMetadata(input: CanonicalCoverInput) {
 const key = canonicalCoverKey(input);
 const entry = key ? entries.get(key) : undefined;
 return entry ? { provider: entry.provider, workId: entry.workId, genres: entry.genres ?? [] } : null;
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
    let url = secure(rawUrl);
    const previous = entries.get(key);
    // A verified Hardcover choice is shared work artwork. Older feed snapshots
    // and ISBNdb refreshes cannot silently downgrade it; manual locks can win.
    if (previous?.provider === 'hardcover' && details[key]?.provider !== 'hardcover' && !details[key]?.locked) continue;
    const workId = details[key]?.workId ?? previous?.workId;
    // A read started before another catalog result cannot undo that selection,
    // even when its response introduces a previously unknown ISBN/work alias.
    const newer = readRevision === undefined ? undefined : [...entries.values()].find(entry =>
      entry.confirmed && entry.revision > readRevision && entry.revision < publicationRevision &&
      (entry === previous || Boolean(workId && entry.workId === workId)));
    if (newer) { remember(key, newer); continue; }
    // Explicit rejection is different from an unavailable catalog response.
    // It must also retire the same image from saved post/library aliases.
    if (workId && Array.isArray(details[key]?.rejectedUrls) &&
        !(readRevision !== undefined && previous && previous.revision > readRevision)) {
      const rejected = new Set((details[key].rejectedUrls ?? []).map(secure).filter((value): value is string => Boolean(value)));
      rejectedByWork.set(workId, rejected);
      while (rejectedByWork.size > MAX_IDLE_ENTRIES) rejectedByWork.delete(rejectedByWork.keys().next().value!);
      for (const [alias, old] of [...entries]) {
        if (old.workId === workId && old.url && rejected.has(old.url))
          remember(alias, { ...old, url: null, checkedAt: Date.now(), revision: publicationRevision });
      }
      if (!entries.has(key) && rejected.size) remember(key, { url: null, workId, confirmed: true, checkedAt: Date.now(), revision: publicationRevision });
    }
    const alternatives = (details[key]?.alternatives ?? previous?.alternatives ?? []).map(secure).filter((url): url is string => Boolean(url));
    const failed = failedUrls.get(key);
    if (details[key]?.provider === 'hardcover') { failedUrls.delete(key); }
    else if (url && failed?.has(url)) url = alternatives.find(value => !failed.has(value)) ?? null;
    url = permitted(url, workId ?? undefined);
    if (!url) continue;
    const entry = { provider: details[key]?.provider ?? previous?.provider, genres: normalizeBookGenres(details[key]?.genres ?? previous?.genres), url, alternatives, failedUrls: details[key]?.provider === 'hardcover' ? [] : failed ? [...failed] : [], failedAt: previous?.failedAt, locked: details[key]?.locked ?? previous?.locked, workId: workId || undefined, checkedAt: Date.now(), confirmed: true, revision: publicationRevision };
    if (workId) {
      for (const [alias, oldEntry] of entries) {
        if (oldEntry.workId === workId) entries.set(alias, entry);
      }
    }
    remember(key, entry);
    for (const alias of (details[key]?.aliases ?? []).slice(0,500)) {
      if (/^[A-Za-z0-9_-]{1,200}$/.test(alias) && (!entries.get(alias)?.locked || entry.locked)) remember(alias,entry);
    }
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
      if (!entries.get(key)?.url) {
        const old = entries.get(key);
        remember(key, { ...old, url: waiters.map(waiter => fallback(waiter.input)).find(Boolean) ?? null,
          checkedAt: Date.now(), confirmed: false, revision: old?.revision ?? 0 });
      }
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
  if (key.startsWith('hc_art_')) return hydrate().then(() => entries.get(key)?.url ?? null);
  // Existing catalog results need no disk wait. Cold requests share one local
  // read before deciding whether a catalog request is needed.
  if (!hydrated && !entries.get(key)?.confirmed && !key.startsWith('url:')) {
    return hydrate().then(() => resolveCanonicalBookCover(input, refresh));
  }
  let existing = entries.get(key);
  if (existing && !existing.url && fallback(input)) {
    existing = { ...existing, url: fallback(input), confirmed: false };
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

/** A failed image advances one shared edition entry, so all mounted surfaces agree. */
export function reportBookCoverFailure(input: CanonicalCoverInput, failedUrl: string | null) {
  const key = canonicalCoverKey(input);
  if (!key || !failedUrl) return;
  const entry = entries.get(key);
  if (entry?.locked || entry?.provider === 'hardcover' || (entry?.url && entry.url !== failedUrl)) return;
  if (!entry?.alternatives) { void resolveCanonicalBookCover(input, true); return; }
  const failed = failedUrls.get(key) ?? new Set<string>();
  failed.add(failedUrl);
  failedUrls.set(key, failed);
  while (failedUrls.size > MAX_IDLE_ENTRIES) failedUrls.delete(failedUrls.keys().next().value!);
  const next = entry?.alternatives?.find(url => !failed.has(url) && permitted(url, entry.workId)) ?? null;
  const updated = { ...entry, url: next, failedUrls: [...failed], failedAt: Date.now(), checkedAt: Date.now(), confirmed: Boolean(next), revision: ++catalogRevision };
  for (const [alias, old] of [...entries]) {
    if (alias === key || (entry.workId && old.workId === entry.workId)) {
      failedUrls.set(alias, new Set(failed));
      remember(alias, updated);
    }
  }
  persist();
  notify();
  // One catalog-only read can supply alternatives for an unconfirmed snapshot.
  if (!entry?.alternatives) void resolveCanonicalBookCover(input, true);
}
