/** Bounded local cache for public book metadata, never reader/library state. */
export function createBookReadCache<T>(ttlMs = 5 * 60_000, maxEntries = 40) {
  const values = new Map<string, { value: T; expiresAt: number }>();
  const pending = new Map<string, Promise<T>>();
  const copy = (value: T): T => JSON.parse(JSON.stringify(value));
  return async (key: string, load: () => Promise<T>, cacheable: (value: T) => boolean = () => true): Promise<T> => {
    const cached = values.get(key);
    if (cached && cached.expiresAt > Date.now()) return copy(cached.value);
    let request = pending.get(key);
    if (!request) {
      request = Promise.resolve().then(load).then(value => {
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
    finally { if (pending.get(key) === request) pending.delete(key); }
  };
}
