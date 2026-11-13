import {
  createPublicBookCache,
  bookExtraKey,
} from "../src/lib/public-book-cache";
const valid = (v: unknown): v is { rating: number } =>
  !!v && typeof (v as any).rating === "number";
const options = { freshMs: 1000, retainMs: 7000, valid };
function storage() {
  let raw: string | null = null;
  return {
    getItem: jest.fn(async () => raw),
    setItem: jest.fn(async (_key: string, value: string) => {
      raw = value;
    }),
    raw: () => raw,
    seed: (value: string) => {
      raw = value;
    },
  };
}
const tick = async () => {
  for (let n = 0; n < 15; n++) await Promise.resolve();
};
test("fresh metadata survives process restart without another network call", async () => {
  const disk = storage(),
    load = jest.fn(async () => ({ rating: 4.2 }));
  const first = createPublicBookCache(disk, () => 100);
  await first.read("rating:book", load, options);
  await first.flush();
  const restarted = createPublicBookCache(disk, () => 500);
  expect(await restarted.read("rating:book", load, options)).toEqual({
    value: { rating: 4.2 },
    fromCache: true,
  });
  expect(load).toHaveBeenCalledTimes(1);
});
test("concurrent misses coalesce and callers cannot mutate the retained value", async () => {
  const disk = storage(),
    cache = createPublicBookCache(disk, () => 100),
    load = jest.fn(async () => ({ rating: 4.2 }));
  const [a, b] = await Promise.all([
    cache.read("same", load, options),
    cache.read("same", load, options),
  ]);
  expect(load).toHaveBeenCalledTimes(1);
  a.value.rating = 0;
  expect((await cache.read("same", load, options)).value.rating).toBe(4.2);
  expect(b.value.rating).toBe(4.2);
});
test("stale results appear immediately while one background refresh updates the disk", async () => {
  const disk = storage();
  let now = 100;
  const cache = createPublicBookCache(disk, () => now);
  await cache.read("book", async () => ({ rating: 4 }), options);
  now = 1500;
  let finish!: (value: { rating: number }) => void;
  const load = jest.fn(
    () =>
      new Promise<{ rating: number }>((done) => {
        finish = done;
      }),
  );
  const onRefresh = jest.fn();
  expect(
    (await cache.read("book", load, { ...options, onRefresh })).value.rating,
  ).toBe(4);
  expect((await cache.read("book", load, options)).fromCache).toBe(true);
  expect(load).toHaveBeenCalledTimes(1);
  finish({ rating: 4.3 });
  await tick();
  await cache.flush();
  expect(onRefresh).toHaveBeenCalledWith({ rating: 4.3 });
  expect(
    (await createPublicBookCache(disk, () => 1600).read("book", load, options))
      .value.rating,
  ).toBe(4.3);
});
test("failed refresh retains usable metadata; an expired result must load again", async () => {
  let now = 100;
  const disk = storage(),
    cache = createPublicBookCache(disk, () => now);
  await cache.read("book", async () => ({ rating: 4 }), options);
  now = 1500;
  expect(
    (
      await cache.read(
        "book",
        async () => {
          throw Error("offline");
        },
        options,
      )
    ).value.rating,
  ).toBe(4);
  await tick();
  now = 8000;
  await expect(
    cache.read(
      "book",
      async () => {
        throw Error("offline");
      },
      options,
    ),
  ).rejects.toThrow("offline");
});
test("missing/invalid responses and corrupt disk are not negative caches", async () => {
  const disk = storage();
  disk.seed("{broken");
  const cache = createPublicBookCache(disk, () => 100);
  const missing = jest.fn(async () => null);
  await cache.read("none", missing, {
    ...options,
    valid: (v): v is null => false,
  });
  await cache.read("none", missing, {
    ...options,
    valid: (v): v is null => false,
  });
  expect(missing).toHaveBeenCalledTimes(2);
});
test("persisted cache is bounded and exact editions use different keys", async () => {
  const disk = storage(),
    cache = createPublicBookCache(disk, () => 100);
  for (let n = 0; n < 105; n++)
    await cache.read(`rating:${n}`, async () => ({ rating: 4 }), options);
  await cache.flush();
  expect(JSON.parse(disk.raw()!).entries).toHaveLength(100);
  expect(disk.raw()!.length).toBeLessThanOrEqual(512000);
  expect(bookExtraKey("series", "book", "isbn-one")).not.toBe(
    bookExtraKey("series", "book", "isbn-two"),
  );
  expect(bookExtraKey("series", "book")).not.toBe(
    bookExtraKey("rating", "book"),
  );
});
