import { jest, expect, describe, beforeEach, afterEach, test } from '@jest/globals';
import type { Mock } from 'jest-mock';
jest.mock('../src/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

describe('one catalog artwork across book surfaces', () => {
  let covers: typeof import('../src/lib/canonical-book-covers');
  let invoke: Mock<(...args: any[]) => Promise<any>>;
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    covers = require('../src/lib/canonical-book-covers');
    invoke = require('../src/lib/supabase').supabase.functions.invoke;
  });
  afterEach(() => { jest.useRealTimers(); });

  test('batches different books and deduplicates simultaneous requests for the same book', async () => {
    invoke.mockResolvedValue({ data: { ok: true, data: { covers: { a: 'https://art/a-original.jpg', b: 'https://art/b-original.jpg' } } } });
    const requests = [covers.resolveCanonicalBookCover({ googleBookId: 'a' }),
      covers.resolveCanonicalBookCover({ googleBookId: 'a', existingCoverUrl: 'https://old/thumbnail' }),
      covers.resolveCanonicalBookCover({ googleBookId: 'b' })];
    await jest.runAllTimersAsync();
    expect(await Promise.all(requests)).toEqual(['https://art/a-original.jpg', 'https://art/a-original.jpg', 'https://art/b-original.jpg']);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][1].body.volumeIds).toEqual(['a', 'b']);
  });

  test('a new catalog winner updates every known edition and ISBN alias of that work', async () => {
    const listener = jest.fn();
    const unsubscribe = covers.subscribeCanonicalBookCovers(listener);
    covers.publishCatalogCovers({ a: 'https://old/art', b: 'https://old/art', 'isbn:9781234567897': 'https://old/art', unrelated: 'https://other/art' }, {
      a: { workId: 'one-work' }, b: { workId: 'one-work' }, 'isbn:9781234567897': { workId: 'one-work' }, unrelated: { workId: 'another-work' },
    });
    covers.publishCatalogCovers({ a: 'http://best/original.jpg' }, { a: { workId: 'one-work' } });
    for (const googleBookId of ['a', 'b']) expect(covers.getCanonicalBookCover({ googleBookId })).toBe('https://best/original.jpg');
    expect(covers.getCanonicalBookCover({ isbn: '978-1234567897' })).toBe('https://best/original.jpg');
    expect(covers.getCanonicalBookCover({ googleBookId: 'unrelated' })).toBe('https://other/art');
    expect(await covers.resolveCanonicalBookCover({ googleBookId: 'b', existingCoverUrl: 'https://stale/library.jpg' })).toBe('https://best/original.jpg');
    expect(invoke).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  test('ISBN-only series and trending cards use the same saved artwork', async () => {
    invoke.mockResolvedValue({ data: { ok: true, data: { covers: { 'isbn:9781234567897': 'https://best/original' }, details: { 'isbn:9781234567897': { workId: 'work' } } } } });
    const result = covers.resolveCanonicalBookCover({ isbns: ['9781234567897'], existingCoverUrl: 'https://hardcover/old' });
    await jest.runAllTimersAsync();
    expect(await result).toBe('https://best/original');
    expect(invoke.mock.calls[0][1].body).toEqual({ volumeIds: [], isbns: ['9781234567897'] });
  });

  test('offline views share one fallback and retry without fetching other providers', async () => {
    invoke.mockResolvedValueOnce({ error: new Error('offline') }).mockResolvedValueOnce({ data: { ok: true, data: { covers: { a: 'https://catalog/art' } } } });
    const first = covers.resolveCanonicalBookCover({ googleBookId: 'a', existingCoverUrl: 'https://saved/art' });
    await jest.runAllTimersAsync();
    expect(await first).toBe('https://saved/art');
    const second = covers.resolveCanonicalBookCover({ googleBookId: 'a', existingCoverUrl: 'https://route/different' });
    await jest.runAllTimersAsync();
    expect(await second).toBe('https://catalog/art');
    expect(invoke.mock.calls.every(([name]) => name === 'book-cover-selection')).toBe(true);
  });

  test('splits a large library into requests of at most 200 volumes', async () => {
    invoke.mockImplementation((_name: string, { body }: any) => Promise.resolve({ data: { ok: true, data: { covers: Object.fromEntries(body.volumeIds.map((id: string) => [id, `https://art/${id}`])) } } }));
    const result = Promise.all(Array.from({ length: 205 }, (_, i) => covers.resolveCanonicalBookCover({ googleBookId: `book${i}` })));
    await jest.runAllTimersAsync();
    expect((await result).length).toBe(205);
    expect(invoke.mock.calls.map(([, request]) => request.body.volumeIds.length)).toEqual([200, 5]);
  });

  test('refresh after series promotion reads and publishes the saved catalog choice', async () => {
    covers.publishCatalogCovers({ a: 'https://google/old' });
    invoke.mockResolvedValue({ data: { ok: true, data: { covers: { a: 'https://verified/series' } } } });
    const result = covers.resolveCanonicalBookCover({ googleBookId: 'a' }, true);
    await jest.runAllTimersAsync();
    expect(await result).toBe('https://verified/series');
    expect(covers.getCanonicalBookCover({ googleBookId: 'a' })).toBe('https://verified/series');
  });
});
