import AsyncStorage from "@react-native-async-storage/async-storage";
type Entry = {
  value: unknown;
  savedAt: number;
  freshUntil: number;
  expiresAt: number;
};
type Options<T> = {
  freshMs: number;
  retainMs: number;
  valid: (value: unknown) => value is T;
  onRefresh?: (value: T) => void;
};
const STORAGE_KEY = "novori:public-book-extras:v1",
  MAX_ENTRIES = 100,
  MAX_CHARS = 512000;
const copy = <T>(value: T): T =>
  value === undefined ? value : JSON.parse(JSON.stringify(value));
/** Public catalog metadata only. Never store library status, reviews or auth here. */
export function createPublicBookCache(
  storage: Pick<typeof AsyncStorage, "getItem" | "setItem">,
  now = Date.now,
) {
  const entries = new Map<string, Entry>(),
    pending = new Map<string, Promise<unknown>>();
  let hydration: Promise<void> | undefined,
    writes = Promise.resolve();
  function hydrate() {
    return (hydration ??= (async () => {
      try {
        const raw = await storage.getItem(STORAGE_KEY);
        if (!raw || raw.length > MAX_CHARS) return;
        const data = JSON.parse(raw);
        if (data.version !== 1 || !Array.isArray(data.entries)) return;
        for (const pair of data.entries.slice(-MAX_ENTRIES)) {
          if (!Array.isArray(pair) || pair.length !== 2) continue;
          const [key, e] = pair;
          if (
            typeof key !== "string" ||
            key.length > 2000 ||
            !e ||
            !Number.isFinite(e.savedAt) ||
            !Number.isFinite(e.freshUntil) ||
            !Number.isFinite(e.expiresAt) ||
            e.savedAt > now() ||
            e.savedAt < 0 ||
            e.freshUntil < e.savedAt ||
            e.expiresAt < e.freshUntil ||
            e.expiresAt - e.savedAt > 14 * 86400000 ||
            e.expiresAt <= now()
          )
            continue;
          entries.set(key, e);
        }
      } catch {
        /* Unavailable/corrupt disk never blocks a fresh read. */
      }
    })());
  }
  function persist() {
    writes = writes.then(async () => {
      try {
        const kept = [...entries]
          .filter(([, e]) => e.expiresAt > now())
          .slice(-MAX_ENTRIES);
        let raw = JSON.stringify({ version: 1, entries: kept });
        while (raw.length > MAX_CHARS && kept.length) {
          kept.shift();
          raw = JSON.stringify({ version: 1, entries: kept });
        }
        await storage.setItem(STORAGE_KEY, raw);
      } catch {
        /* Best-effort public cache. */
      }
    });
  }
  async function peek<T>(
    key: string,
    valid: (value: unknown) => value is T,
  ): Promise<T | null> {
    await hydrate();
    const e = entries.get(key);
    return e && e.expiresAt > now() && valid(e.value) ? copy(e.value) : null;
  }
  async function read<T>(
    key: string,
    load: () => Promise<T>,
    options: Options<T>,
  ): Promise<{ value: T; fromCache: boolean }> {
    await hydrate();
    const e = entries.get(key);
    function refresh(): Promise<T> {
      let request = pending.get(key) as Promise<T> | undefined;
      if (!request) {
        request = Promise.resolve()
          .then(load)
          .then((value) => {
            if (options.valid(value) && JSON.stringify(value).length < 100000) {
              const savedAt = now();
              entries.delete(key);
              entries.set(key, {
                value: copy(value),
                savedAt,
                freshUntil: savedAt + options.freshMs,
                expiresAt: savedAt + options.retainMs,
              });
              while (entries.size > MAX_ENTRIES)
                entries.delete(entries.keys().next().value!);
              persist();
            }
            return value;
          })
          .finally(() => pending.delete(key));
        pending.set(key, request);
      }
      return request;
    }
    if (e && e.expiresAt > now() && options.valid(e.value)) {
      if (e.freshUntil <= now())
        void refresh()
          .then((value) => {
            if (options.valid(value)) options.onRefresh?.(value);
          })
          .catch(() => {});
      return { value: copy(e.value), fromCache: true };
    }
    return { value: copy(await refresh()), fromCache: false };
  }
  return { peek, read, flush: () => writes };
}
export const publicBookCache = createPublicBookCache(AsyncStorage);
export const bookExtraKey = (
  kind: "series" | "rating",
  id: string,
  isbn?: string | null,
) => `${kind}:v1:${id}:${isbn ?? ""}`;
