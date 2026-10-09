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

  test('late catalog reads cannot revert a newer choice through a newly discovered alias', async () => {
    let finish!: (value: any) => void;
    invoke.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const read = covers.resolveCanonicalBookCover({ isbn: '9781234567897', existingCoverUrl: 'https://old/tiny' });
    await jest.advanceTimersByTimeAsync(0);
    expect(invoke).toHaveBeenCalledTimes(1);
    covers.publishCatalogCovers({ verified: 'https://best/original' }, { verified: { workId: 'work' } });
    finish({ data: { ok: true, data: { covers: { 'isbn:9781234567897': 'https://old/tiny' }, details: { 'isbn:9781234567897': { workId: 'work' } } } } });
    await jest.runAllTimersAsync();
    expect(await read).toBe('https://best/original');
    expect(covers.getCanonicalBookCover({ googleBookId: 'verified' })).toBe('https://best/original');
    // A later read can still publish a legitimate catalog change.
    const revision = covers.getCanonicalBookCoverRevision();
    covers.publishCatalogCovers({ verified: 'https://new/original' }, { verified: { workId: 'work' } }, revision);
    expect(covers.getCanonicalBookCover({ isbn: '9781234567897' })).toBe('https://new/original');
  });

  test('late reads for the same ID cannot replace a newer catalog selection', () => {
    const revision = covers.getCanonicalBookCoverRevision();
    covers.publishCatalogCovers({ same: 'https://best/original' });
    covers.publishCatalogCovers({ same: 'https://old/tiny' }, {}, revision);
    expect(covers.getCanonicalBookCover({ googleBookId: 'same' })).toBe('https://best/original');
  });

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

describe('bounded confirmed selections across restart and refresh races', () => {
  const storageKey = 'novori:canonical-book-covers:v2';
  let device: Map<string, string>;
  let covers: typeof import('../src/lib/canonical-book-covers');
  let invoke: Mock<(...args: any[]) => Promise<any>>;
  let storage: { getItem: Mock<(key: string) => Promise<string | null>>; setItem: Mock<(key: string, value: string) => Promise<void>> };
  const response = (urls: Record<string, string | null>, details = {}) => ({ data: { ok: true, data: { covers: urls, details } } });
  const saved = (key: string, url: string, checkedAt = Date.now(), workId?: string) =>
    [key, { url, checkedAt, workId, confirmed: true }];
  function restart() {
    jest.resetModules();
    storage = require('@react-native-async-storage/async-storage');
    storage.getItem.mockImplementation(async key => device.get(key) ?? null);
    storage.setItem.mockImplementation(async (key, value) => { device.set(key, value); });
    covers = require('../src/lib/canonical-book-covers');
    invoke = require('../src/lib/supabase').supabase.functions.invoke;
    invoke.mockResolvedValue(response({}));
  }
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-07T17:00:00Z'));
    device = new Map();
    restart();
  });
  afterEach(async () => { await jest.runAllTimersAsync(); jest.useRealTimers(); });

  test('fresh confirmed originals and ISBN aliases survive restart without a catalog/provider call', async () => {
    device.set('novori:google-books:detail:v5:a', 'untouched metadata');
    covers.publishCatalogCovers({ a: 'https://art/original-1500.jpg', b: 'https://art/original-1500.jpg', 'isbn:9781234567897': 'https://art/original-1500.jpg' }, {
      a: { workId: 'work' }, b: { workId: 'work' }, 'isbn:9781234567897': { workId: 'work' },
    });
    await jest.runAllTimersAsync();
    expect(JSON.parse(device.get(storageKey)!).entries).toHaveLength(3);
    restart();
    invoke.mockRejectedValue(new Error('offline: no request should be made'));
    expect(await Promise.all([
      covers.resolveCanonicalBookCover({ googleBookId: 'a', existingCoverUrl: 'https://old/tiny.jpg' }),
      covers.resolveCanonicalBookCover({ googleBookId: 'b' }),
      covers.resolveCanonicalBookCover({ isbn: '978-1234567897' }),
    ])).toEqual(Array(3).fill('https://art/original-1500.jpg'));
    expect(invoke).not.toHaveBeenCalled();
    expect(storage.getItem).toHaveBeenCalledTimes(1);
    expect(device.get('novori:google-books:detail:v5:a')).toBe('untouched metadata');
  });

  test('stale confirmed artwork returns before a slow recheck, then updates every restored alias', async () => {
    device.set(storageKey, JSON.stringify({ version: 1, entries: [
      saved('a', 'https://art/old-original', Date.now() - 61_000, 'work'),
      saved('b', 'https://art/old-original', Date.now() - 61_000, 'work'),
    ] }));
    let finish!: (value: any) => void;
    invoke.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    expect(await covers.resolveCanonicalBookCover({ googleBookId: 'a', existingCoverUrl: 'https://route/tiny' })).toBe('https://art/old-original');
    expect(await covers.resolveCanonicalBookCover({ googleBookId: 'a' })).toBe('https://art/old-original');
    await jest.advanceTimersByTimeAsync(0);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(covers.getCanonicalBookCover({ googleBookId: 'b' })).toBe('https://art/old-original');
    finish(response({ a: 'https://art/promoted-original' }, { a: { workId: 'work' } }));
    await jest.runAllTimersAsync();
    for (const googleBookId of ['a', 'b']) expect(covers.getCanonicalBookCover({ googleBookId })).toBe('https://art/promoted-original');
    expect(invoke.mock.calls.every(([name]) => name === 'book-cover-selection')).toBe(true);
  });

  test('an offline recheck cannot replace a persisted manual selection with route/provider fallback', async () => {
    device.set(storageKey, JSON.stringify({ version: 1, entries: [saved('a', 'https://manual/locked', Date.now() - 61_000)] }));
    invoke.mockRejectedValue(new Error('offline'));
    expect(await covers.resolveCanonicalBookCover({ googleBookId: 'a', imageLinks: { extraLarge: 'https://provider/different' } })).toBe('https://manual/locked');
    await jest.runAllTimersAsync();
    expect(covers.getCanonicalBookCover({ googleBookId: 'a' })).toBe('https://manual/locked');
    const refresh = covers.resolveCanonicalBookCover({ googleBookId: 'a', existingCoverUrl: 'https://old/tiny' }, true);
    await jest.runAllTimersAsync();
    expect(await refresh).toBe('https://manual/locked');
    expect(invoke.mock.calls.every(([name]) => name === 'book-cover-selection')).toBe(true);
  });

  test('offline, missing-selection and URL-only fallbacks never become durable catalog selections', async () => {
    invoke.mockResolvedValueOnce({ error: new Error('offline') }).mockResolvedValueOnce(response({}));
    const offline = covers.resolveCanonicalBookCover({ googleBookId: 'offline', existingCoverUrl: 'https://snapshot/offline' });
    await jest.runAllTimersAsync();
    expect(await offline).toBe('https://snapshot/offline');
    const missing = covers.resolveCanonicalBookCover({ googleBookId: 'missing', existingCoverUrl: 'https://snapshot/missing' });
    await jest.runAllTimersAsync();
    expect(await missing).toBe('https://snapshot/missing');
    await covers.resolveCanonicalBookCover({ existingCoverUrl: 'https://snapshot/url-only' });
    covers.publishCatalogCovers({ confirmed: 'https://catalog/confirmed' });
    await jest.runAllTimersAsync();
    expect(JSON.parse(device.get(storageKey)!).entries.map(([key]: [string]) => key)).toEqual(['confirmed']);
    restart();
    await covers.resolveCanonicalBookCover({ googleBookId: 'confirmed' });
    for (const googleBookId of ['offline', 'missing']) expect(covers.getCanonicalBookCover({ googleBookId })).toBeNull();
  });

  test('storage read/write failures do not prevent a live catalog cover from loading', async () => {
    storage.getItem.mockRejectedValue(new Error('storage unavailable'));
    storage.setItem.mockRejectedValue(new Error('quota exceeded'));
    invoke.mockResolvedValue(response({ a: 'https://catalog/original' }));
    const result = covers.resolveCanonicalBookCover({ googleBookId: 'a' });
    await jest.runAllTimersAsync();
    expect(await result).toBe('https://catalog/original');
    expect(covers.getCanonicalBookCover({ googleBookId: 'a' })).toBe('https://catalog/original');
    expect(storage.setItem).toHaveBeenCalled();
  });

  test('invalid JSON and unsupported versions miss safely instead of blocking catalog loading', async () => {
    for (const raw of ['broken JSON', JSON.stringify({ version: 9, entries: [saved('a', 'https://invalid/version')] })]) {
      device.set(storageKey, raw);
      restart();
      invoke.mockResolvedValue(response({ a: 'https://catalog/valid' }));
      const result = covers.resolveCanonicalBookCover({ googleBookId: 'a' });
      await jest.runAllTimersAsync();
      expect(await result).toBe('https://catalog/valid');
      expect(invoke).toHaveBeenCalledTimes(1);
    }
  });

  test('expired, future-dated, unconfirmed and invalid rows are ignored without losing valid rows', async () => {
    const rows = [
      saved('expired', 'https://old/expired', Date.now() - 14 * 86400000),
      saved('future', 'https://old/future', Date.now() + 1),
      ['unconfirmed', { url: 'https://old/fallback', checkedAt: Date.now(), confirmed: false }],
      saved('bad-url', 'javascript:alert(1)'),
      saved('bad/id', 'https://old/id'),
      saved('bad-work', 'https://old/work', Date.now(), 7 as any),
      ['bad-time', { url: 'https://old/time', checkedAt: 'now', confirmed: true }],
      null,
      saved('valid', 'https://old/duplicate', Date.now() - 1),
      saved('valid', 'http://art/valid'),
    ];
    device.set(storageKey, JSON.stringify({ version: 1, entries: rows }));
    expect(await covers.resolveCanonicalBookCover({ googleBookId: 'valid' })).toBe('https://art/valid');
    expect(invoke).not.toHaveBeenCalled();
    for (const googleBookId of ['expired', 'future', 'unconfirmed', 'bad-url', 'bad/id', 'bad-work', 'bad-time']) {
      expect(covers.getCanonicalBookCover({ googleBookId })).toBeNull();
    }
    invoke.mockResolvedValue(response({ expired: 'https://catalog/current' }));
    const expired = covers.resolveCanonicalBookCover({ googleBookId: 'expired' });
    await jest.runAllTimersAsync();
    expect(await expired).toBe('https://catalog/current');
  });

  test('delayed hydration cannot overwrite a live winner, even through old work aliases', async () => {
    let finishRead!: (value: string) => void;
    storage.getItem.mockImplementation(() => new Promise(resolve => { finishRead = resolve; }));
    const alias = covers.resolveCanonicalBookCover({ googleBookId: 'b' });
    covers.publishCatalogCovers({ a: 'https://manual/new-locked' }, { a: { workId: 'work' } });
    expect(await covers.resolveCanonicalBookCover({ googleBookId: 'a' })).toBe('https://manual/new-locked');
    finishRead(JSON.stringify({ version: 1, entries: [saved('a', 'https://old/art', Date.now(), 'work'), saved('b', 'https://old/art', Date.now(), 'work')] }));
    expect(await alias).toBe('https://manual/new-locked');
    await jest.runAllTimersAsync();
    expect(invoke).not.toHaveBeenCalled();
    expect(JSON.parse(device.get(storageKey)!).entries.every(([, entry]: [string, { url: string }]) => entry.url === 'https://manual/new-locked')).toBe(true);
  });

  test('serialized writes leave the newest catalog winner on disk when an older write is slow', async () => {
    let finishWrite!: () => void;
    storage.setItem.mockImplementationOnce((key, value) => new Promise(resolve => {
      finishWrite = () => { device.set(key, value); resolve(); };
    }));
    covers.publishCatalogCovers({ a: 'https://art/first' });
    await jest.advanceTimersByTimeAsync(100);
    covers.publishCatalogCovers({ a: 'https://art/newest' });
    await jest.advanceTimersByTimeAsync(100);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    finishWrite();
    await jest.runAllTimersAsync();
    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(JSON.parse(device.get(storageKey)!).entries[0][1].url).toBe('https://art/newest');
  });

  test('memory eviction keeps recently read and mounted images, and disk remains bounded', async () => {
    covers.publishCatalogCovers(Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`book${i}`, `https://art/${i}`])));
    const unmount = covers.subscribeCanonicalBookCovers(() => {}, 'book1');
    covers.getCanonicalBookCover({ googleBookId: 'book0' });
    covers.publishCatalogCovers(Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`book${1000 + i}`, `https://art/${1000 + i}`])));
    expect(covers.getCanonicalBookCover({ googleBookId: 'book2' })).toBeNull();
    expect(covers.getCanonicalBookCover({ googleBookId: 'book0' })).toBe('https://art/0');
    // Do not touch book1's recency before release, so it is the next idle victim.
    unmount();
    expect(covers.getCanonicalBookCover({ googleBookId: 'book1' })).toBeNull();
    await jest.runAllTimersAsync();
    expect(JSON.parse(device.get(storageKey)!).entries).toHaveLength(1000);
  });

  test('many simultaneous explicit refreshes share one request', async () => {
    covers.publishCatalogCovers({ a: 'https://art/old' });
    invoke.mockResolvedValue(response({ a: 'https://art/new' }));
    const refreshes = Array.from({ length: 20 }, () => covers.resolveCanonicalBookCover({ googleBookId: 'a' }, true));
    await jest.runAllTimersAsync();
    expect(await Promise.all(refreshes)).toEqual(Array(20).fill('https://art/new'));
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  test('long original URLs cannot create a storage record too large to restore', async () => {
    const urls = Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`book${i}`, `https://art/${i}?token=${'x'.repeat(3900)}`]));
    covers.publishCatalogCovers(urls);
    await jest.runAllTimersAsync();
    const raw = device.get(storageKey)!;
    expect(raw.length).toBeLessThanOrEqual(512_000);
    expect(JSON.parse(raw).entries.length).toBeLessThan(1000);
    restart();
    expect(await covers.resolveCanonicalBookCover({ googleBookId: 'book999' })).toBe(urls.book999);
    expect(invoke).not.toHaveBeenCalled();
  });

  test('promotion during an ordinary flight schedules only one follow-up for all forced callers', async () => {
    let finishOrdinary!: (value: any) => void;
    let finishRefresh!: (value: any) => void;
    invoke.mockImplementationOnce(() => new Promise(resolve => { finishOrdinary = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
    const ordinary = covers.resolveCanonicalBookCover({ googleBookId: 'a' });
    await jest.advanceTimersByTimeAsync(0);
    expect(invoke).toHaveBeenCalledTimes(1);
    const refreshes = Array.from({ length: 20 }, () => covers.resolveCanonicalBookCover({ googleBookId: 'a' }, true));
    finishOrdinary(response({ a: 'https://art/before-promotion' }));
    await jest.advanceTimersByTimeAsync(0);
    expect(invoke).toHaveBeenCalledTimes(2);
    const lateRefresh = covers.resolveCanonicalBookCover({ googleBookId: 'a' }, true);
    finishRefresh(response({ a: 'https://art/promoted' }));
    await jest.runAllTimersAsync();
    expect(await ordinary).toBe('https://art/before-promotion');
    expect(await Promise.all([...refreshes, lateRefresh])).toEqual(Array(21).fill('https://art/promoted'));
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  test('forced callers upgrade an unsent ordinary batch without adding a second read', async () => {
    // Hydrate first, then queue ordinary and forced reads in the same tick.
    await covers.resolveCanonicalBookCover({ existingCoverUrl: 'https://url-only/warm' });
    const unmount = covers.subscribeCanonicalBookCovers(() => {});
    await jest.advanceTimersByTimeAsync(0);
    invoke.mockResolvedValue(response({ a: 'https://art/promoted' }));
    const ordinary = covers.resolveCanonicalBookCover({ googleBookId: 'a' });
    const refreshes = Array.from({ length: 20 }, () => covers.resolveCanonicalBookCover({ googleBookId: 'a' }, true));
    await jest.runAllTimersAsync();
    expect(await Promise.all([ordinary, ...refreshes])).toEqual(Array(21).fill('https://art/promoted'));
    expect(invoke).toHaveBeenCalledTimes(1);
    unmount();
  });
  test('rejected cover snapshots are retired app-wide and cannot reappear after restart', async () => {

    const url = 'https://art/en-llamas.jpg';
    covers.publishCatalogCovers({ search: url, library: url, post: url, manualOtherWork: url }, {
      search: { workId: 'catching-fire' }, library: { workId: 'catching-fire' }, post: { workId: 'catching-fire' }, manualOtherWork: { workId: 'other' },
    });
    covers.publishCatalogCovers({ search: null }, { search: { workId: 'catching-fire', rejectedUrls: [url] } });
    for (const googleBookId of ['search', 'library', 'post']) {
      expect(covers.getCanonicalBookCover({ googleBookId })).toBeNull();
      expect(await covers.resolveCanonicalBookCover({ googleBookId, existingCoverUrl: url })).toBeNull();
    }
    expect(covers.getCanonicalBookCover({ googleBookId: 'manualOtherWork' })).toBe(url);
    await jest.runAllTimersAsync();
    restart();
    expect(await covers.resolveCanonicalBookCover({ googleBookId: 'library', existingCoverUrl: url })).toBeNull();
  });

  test('late rejection cannot revoke a newer manual choice through an unseen ISBN alias', () => {
    const revision = covers.getCanonicalBookCoverRevision();
    covers.publishCatalogCovers({ locked: 'https://art/manual.jpg' }, { locked: { workId: 'work', rejectedUrls: [] } });
    covers.publishCatalogCovers({ 'isbn:9780439023498': null }, { 'isbn:9780439023498': { workId: 'work', rejectedUrls: ['https://art/manual.jpg'] } }, revision);
    expect(covers.getCanonicalBookCover({ googleBookId: 'locked' })).toBe('https://art/manual.jpg');
    expect(covers.getCanonicalBookCover({ isbn: '9780439023498' })).toBe('https://art/manual.jpg');
  });

});

test('verified Hardcover cover and genres propagate to saved edition IDs and survive an ISBNdb downgrade attempt',()=>{
 const covers=require('../src/lib/canonical-book-covers');
 covers.publishCatalogCovers({hc_entry:'https://assets.hardcover.app/good.jpg'},{hc_entry:{provider:'hardcover',workId:'hardcover:900',aliases:['library_edition','post_edition'],genres:['Fantasy','Fängelser']}});
 covers.publishCatalogCovers({library_edition:'https://images.isbndb.com/old.jpg'},{library_edition:{provider:'isbndb',workId:'edition:library_edition'}});
 expect(covers.getCanonicalBookCover({googleBookId:'library_edition'})).toBe('https://assets.hardcover.app/good.jpg');
 expect(covers.getCanonicalBookCover({googleBookId:'post_edition'})).toBe('https://assets.hardcover.app/good.jpg');
 expect(covers.getCanonicalBookCoverMetadata({googleBookId:'library_edition'})?.genres).toEqual(['Fantasy']);
 covers.publishCatalogCovers({library_edition:'https://art/manual.jpg'},{library_edition:{provider:'manual',locked:true,workId:'hardcover:900'}});
 expect(covers.getCanonicalBookCover({googleBookId:'library_edition'})).toBe('https://art/manual.jpg');
});

test('Hardcover image errors keep the selected work art across all aliases and restore it on refresh',()=>{
 const covers=require('../src/lib/canonical-book-covers');
 const url='https://assets.hardcover.app/stable.jpg',fallback='https://images.isbndb.com/old.jpg';
 covers.publishCatalogCovers({hc_art_777:url},{hc_art_777:{provider:'hardcover',workId:'hardcover:777',aliases:['hc_verified_777'],alternatives:[url,fallback]}});
 covers.reportBookCoverFailure({hardcoverBookId:777},url);
 expect(covers.getCanonicalBookCover({hardcoverBookId:777})).toBe(url);
 expect(covers.getCanonicalBookCover({googleBookId:'hc_verified_777'})).toBe(url);
 covers.publishCatalogCovers({hc_verified_777:fallback},{hc_verified_777:{provider:'isbndb'}});
 expect(covers.getCanonicalBookCover({googleBookId:'hc_verified_777'})).toBe(url);
});

 test('series fallback yields to ISBNdb but cannot displace verified discovery artwork',()=>{
 const covers=require('../src/lib/canonical-book-covers');
 covers.publishCatalogCovers({series_entry:'https://assets.hardcover.app/series.jpg'},{series_entry:{provider:'hardcover',fallback:true}});
 covers.publishCatalogCovers({series_entry:'https://art/isbn.jpg'},{series_entry:{provider:'isbndb'}});
 expect(covers.getCanonicalBookCover({googleBookId:'series_entry'})).toBe('https://art/isbn.jpg');
 covers.publishCatalogCovers({series_entry:'https://assets.hardcover.app/series.jpg'},{series_entry:{provider:'hardcover',fallback:true}});
 expect(covers.getCanonicalBookCover({googleBookId:'series_entry'})).toBe('https://art/isbn.jpg');
 covers.publishCatalogCovers({series_entry:'https://assets.hardcover.app/feed.jpg'},{series_entry:{provider:'hardcover'}});
 covers.publishCatalogCovers({series_entry:'https://assets.hardcover.app/series.jpg'},{series_entry:{provider:'hardcover',fallback:true}});
 expect(covers.getCanonicalBookCover({googleBookId:'series_entry'})).toBe('https://assets.hardcover.app/feed.jpg');
 });

 test('series fallback aliases preserve discovery and ISBNdb choices and upgrade together',()=>{
 const covers=require('../src/lib/canonical-book-covers');
 covers.publishCatalogCovers({protected_feed:'https://art/feed.jpg'},{protected_feed:{provider:'hardcover',workId:'hardcover:81'}});
 covers.publishCatalogCovers({protected_isbn:'https://art/isbn.jpg'},{protected_isbn:{provider:'isbndb'}});
 covers.publishCatalogCovers({fallback_series:'https://art/fallback.jpg'},{fallback_series:{provider:'hardcover',fallback:true,workId:'hardcover:81',aliases:['protected_feed','protected_isbn','fallback_alias']}});
 expect(covers.getCanonicalBookCover({googleBookId:'protected_feed'})).toBe('https://art/feed.jpg');
 expect(covers.getCanonicalBookCover({googleBookId:'protected_isbn'})).toBe('https://art/isbn.jpg');
 covers.publishCatalogCovers({fallback_series:'https://art/new-isbn.jpg'},{fallback_series:{provider:'isbndb',workId:'edition:fallback_series'}});
 expect(covers.getCanonicalBookCover({googleBookId:'fallback_alias'})).toBe('https://art/new-isbn.jpg');
 expect(covers.getCanonicalBookCover({googleBookId:'protected_feed'})).toBe('https://art/feed.jpg');
 });

test('publisher family alias publication cannot overwrite protected Hardcover or manual images',()=>{
 const covers=require('../src/lib/canonical-book-covers');
 covers.publishCatalogCovers({feed_family:'https://art/feed.jpg'},{feed_family:{provider:'hardcover',workId:'hardcover:family'}});
 covers.publishCatalogCovers({manual_family:'https://art/manual.jpg'},{manual_family:{provider:'manual',locked:true}});
 covers.publishCatalogCovers({family_new:'https://art/family.jpg'},{family_new:{provider:'isbndb',workId:'series-edition:example',aliases:['feed_family','manual_family','family_other']}});
 expect(covers.getCanonicalBookCover({googleBookId:'feed_family'})).toBe('https://art/feed.jpg');
 expect(covers.getCanonicalBookCover({googleBookId:'manual_family'})).toBe('https://art/manual.jpg');
 expect(covers.getCanonicalBookCover({googleBookId:'family_other'})).toBe('https://art/family.jpg');
});

test('image failure cooldown expires in a running app and the original catalog URL can recover without wiping covers',()=>{
 jest.resetModules();jest.useFakeTimers();
 const covers=require('../src/lib/canonical-book-covers');
 const url='https://images.isbndb.com/recover.jpg';
 const detail={provider:'isbndb',workId:'retry-work',aliases:['retry-alias'],alternatives:[url]};
 covers.publishCatalogCovers({retry:url},{retry:detail});
 covers.reportBookCoverFailure({googleBookId:'retry'},url);
 expect(covers.getCanonicalBookCover({googleBookId:'retry'})).toBeNull();
 covers.publishCatalogCovers({retry:url},{retry:detail});
 expect(covers.getCanonicalBookCover({googleBookId:'retry'})).toBeNull();
 jest.setSystemTime(Date.now()+6*60*60_000+1);
 covers.publishCatalogCovers({retry:url},{retry:detail});
 expect(covers.getCanonicalBookCover({googleBookId:'retry'})).toBe(url);
 expect(covers.getCanonicalBookCover({googleBookId:'retry-alias'})).toBe(url);
 jest.useRealTimers();
});

test('server content rejection replaces a previously cached successful placeholder across shared aliases',()=>{
 jest.resetModules();
 const covers:typeof import('../src/lib/canonical-book-covers')=require('../src/lib/canonical-book-covers');
 const placeholder='https://images.isbndb.com/covers/4996893482325.jpg';
 const artwork='https://images.isbndb.com/covers/4484103482758.jpg';
 covers.publishCatalogCovers({search:placeholder,stack:placeholder},{search:{workId:'same',provider:'isbndb'},stack:{workId:'same',provider:'isbndb'}});
 covers.publishCatalogCovers({search:artwork},{search:{workId:'same',provider:'isbndb',rejectedUrls:[placeholder],alternatives:[artwork]}});
 for(const googleBookId of ['search','stack'])expect(covers.getCanonicalBookCover({googleBookId,existingCoverUrl:placeholder})).toBe(artwork);
});
