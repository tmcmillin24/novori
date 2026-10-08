import { jest, test, expect } from '@jest/globals';
import { createDiscoveryBookResolver, discoveryCoverInput, getDiscoveryBookId, rememberDiscoveryBookId, parseDiscoveryBook } from '../src/lib/discovery-books';
const book = (id: number) => ({ id, title: 'The Book', authors: ['Jane Writer'], isbns: ['9781234567897', '9781234567898'], coverUrl: 'https://listing/tiny.jpg' });
const missing = { ok: true, status: 200, googleBookId: null };
const candidate = { id: 'nv_verified', volumeInfo: { title: 'The Book', authors: ['Jane Writer'], language: 'en' } };
test('unverified cards keep listing art without attaching unverified ISBN artwork; verified identity overrides stale cards', () => {
  const row = book(1001);
  expect(discoveryCoverInput(row)).toEqual({ googleBookId: null, existingCoverUrl: row.coverUrl });
  rememberDiscoveryBookId(row, 'verified');
  expect(discoveryCoverInput({ ...row, coverBookId: 'old' }).googleBookId).toBe('verified');
  expect(getDiscoveryBookId({ ...row, title: 'Different Book' })).toBeNull();
});
test('title-only fallback verifies title and author rather than accepting the first search result', async () => {
  const lookup = jest.fn(async () => missing);
  const search = jest.fn(async () => [ { ...candidate, id: 'wrong', volumeInfo: { ...candidate.volumeInfo, authors: ['Other Person'] } }, candidate ]);
  const resolve = createDiscoveryBookResolver(lookup, search);
  expect(await resolve(book(1002))).toBe('nv_verified');
  expect(search).toHaveBeenCalledWith('The Book');
  expect(await resolve(book(1002))).toBe('nv_verified');
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(search).toHaveBeenCalledTimes(1);
});
test('alternate ISBN lookup is bounded and only uses verified resolver results', async () => {
  const lookup = jest.fn(async (input: { isbn?: string }) => input.isbn === '9781234567898' ? { ...missing, googleBookId: 'alternate' } : missing);
  const resolve = createDiscoveryBookResolver(lookup, async () => []);
  expect(await resolve(book(1003))).toBe('alternate');
  expect(lookup).toHaveBeenCalledTimes(2);
});
test('simultaneous reads coalesce and missing results do not poison retries', async () => {
  const lookup = jest.fn(async () => missing);
  const search = jest.fn(async () => [] as typeof candidate[]);
  const resolve = createDiscoveryBookResolver(lookup, search);
  const row = { ...book(1004), isbns: [] };
  expect(await Promise.all([resolve(row), resolve(row)])).toEqual([null, null]);
  expect(lookup).toHaveBeenCalledTimes(1);
  search.mockResolvedValue([candidate]);
  expect(await resolve(row)).toBe('nv_verified');
  expect(lookup).toHaveBeenCalledTimes(2);
});
test('known verified listings need no lookup, and provider failure does not choose an unverified result', async () => {
  const lookup = jest.fn(async () => ({ ok: false, status: 503, googleBookId: null }));
  const search = jest.fn(async () => [candidate]);
  const resolve = createDiscoveryBookResolver(lookup, search);
  expect(await resolve({ ...book(1005), coverBookId: 'cached' })).toBe('cached');
  expect(lookup).not.toHaveBeenCalled();
  await expect(resolve(book(1006))).rejects.toThrow('temporarily unavailable');
  expect(search).not.toHaveBeenCalled();
});
test('listing route validates payload and discards untrusted edition IDs and URLs', () => {
  expect(parseDiscoveryBook(JSON.stringify({ ...book(1007), coverBookId: 'fabricated', coverUrl: 'file:///private' })))
    .toMatchObject({ id: 1007, coverUrl: null });
  expect(parseDiscoveryBook(JSON.stringify({ ...book(1007), authors: [3] }))).toBeNull();
  expect(parseDiscoveryBook('{bad')).toBeNull();
  expect(parseDiscoveryBook('x'.repeat(16001))).toBeNull();
});

 test('listing accepts a provider work with 200 edition ISBNs and bounds resolver metadata', () => {
  const isbns = Array.from({ length: 200 }, (_, i) => String(9780000000000 + i));
  const parsed = parseDiscoveryBook(JSON.stringify({ ...book(1020), isbns }));
  expect(parsed).toMatchObject({ id: 1020, title: 'The Book', coverUrl: 'https://listing/tiny.jpg' });
  expect(parsed?.isbns).toEqual(isbns.slice(0, 100));
});
