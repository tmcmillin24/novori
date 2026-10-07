import { test, expect, jest, afterEach } from '@jest/globals';
import { createBookReadCache } from '../src/lib/book-read-cache';

afterEach(() => { jest.useRealTimers(); });

test('concurrent readers share a request but cannot mutate each other or cached data', async () => {
  const read = createBookReadCache<{ books: { id: string }[] }>();
  const load = jest.fn(async () => ({ books: [{ id: 'original' }] }));
  const [a, b] = await Promise.all([read('query', load), read('query', load)]);
  a.books[0].id = 'changed';
  expect(b.books[0].id).toBe('original');
  expect((await read('query', load)).books[0].id).toBe('original');
  expect(load).toHaveBeenCalledTimes(1);
});

test('expiration and capacity bound local book metadata', async () => {
  jest.useFakeTimers();
  const read = createBookReadCache<number>(1000, 2);
  const load = jest.fn(async () => 1);
  await read('a', load); await read('b', load); await read('c', load);
  await read('a', load);
  expect(load).toHaveBeenCalledTimes(4);
  jest.advanceTimersByTime(1001);
  await read('a', load);
  expect(load).toHaveBeenCalledTimes(5);
});

test('failed and unsuccessful identity reads are retried instead of cached', async () => {
  const read = createBookReadCache<{ ok: boolean }>();
  const failed = jest.fn(async () => { throw new Error('offline'); });
  await expect(read('query', failed)).rejects.toThrow('offline');
  await expect(read('query', failed)).rejects.toThrow('offline');
  expect(failed).toHaveBeenCalledTimes(2);
  const missing = jest.fn(async () => ({ ok: false }));
  await read('query', missing, value => value.ok);
  await read('query', missing, value => value.ok);
  expect(missing).toHaveBeenCalledTimes(2);
});
