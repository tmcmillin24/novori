/** Bounded local cache for public book metadata, never reader/library state. */
export function createBookReadCache<T>(ttlMs = 5 * 60_000, maxEntries = 40) {
  const values = new Map<string, { value: T; expiresAt: number }>();
  const pending = new Map<string, Promise<T>>();
  const previews = new Map<string, T>();
  const listeners = new Map<string, Set<(value: T) => void>>();
  const copy = (value: T): T => JSON.parse(JSON.stringify(value));
  return async (key: string, load: (publish: (value: T) => void) => Promise<T>, cacheable: (value: T) => boolean = () => true, onProgress?: (value: T) => void): Promise<T> => {
    const cached = values.get(key);
    if (cached && cached.expiresAt > Date.now()) return copy(cached.value);
    const notify = (listener: (value: T) => void, value: T) => {
      try { listener(copy(value)); } catch { /* A UI subscriber cannot fail shared loading. */ }
    };
    if (onProgress) {
      let group = listeners.get(key);
      if (!group) { group = new Set(); listeners.set(key, group); }
      group.add(onProgress);
      if (previews.has(key)) notify(onProgress, previews.get(key)!);
    }
    let request = pending.get(key);
    if (!request) {
      request = Promise.resolve().then(() => load(value => {
        previews.set(key, copy(value));
        for (const listener of listeners.get(key) ?? []) notify(listener, value);
      })).then(value => {
        if (cacheable(value)) {
          values.delete(key);
          values.set(key, { value: copy(value), expiresAt: Date.now() + ttlMs });
          while (values.size > maxEntries) values.delete(values.keys().next().value!);
        }
        return value;
      });
      pending.set(key, request);
    }
    try { return copy(await request); }
    finally {
      if (onProgress) {
        const group = listeners.get(key);
        group?.delete(onProgress);
        if (!group?.size) listeners.delete(key);
      }
      if (pending.get(key) === request) { pending.delete(key); previews.delete(key); }
    }
  };
}
