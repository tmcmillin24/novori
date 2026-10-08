import { test, expect, jest } from '@jest/globals';
import { createBookWorkDetails, applyBookWorkDetails } from '../src/lib/book-work-details';
import type { GoogleBookSearchItem } from '../src/lib/book-search';
const book = (id: string, pages: number, author = 'Frank Herbert'): GoogleBookSearchItem => ({ id, source: { provider: 'isbndb' }, volumeInfo: { title: 'Dune', authors: [author], language: 'en', pageCount: pages, publishedDate: '2020-01-01', description: `Description ${id}`, imageLinks: { thumbnail: `https://covers/${id}` }, industryIdentifiers: [{ type: 'ISBN_13', identifier: id }] } });
test('trending, search, series and saved editions share work details while retaining every cover and identity', async () => {
 const representative = book('search', 412);
 const search = jest.fn(async () => [representative]);
 const reader = createBookWorkDetails(search);
 const editions = ['trending', 'search', 'series', 'library'].map(id => book(id, 600));
 const results = await Promise.all(editions.map(edition => reader.resolve(edition)));
 for (let i = 0; i < results.length; i++) {
  expect(results[i].volumeInfo.pageCount).toBe(600);
  expect(results[i].volumeInfo.description).toBe(editions[i].volumeInfo.description);
  expect(results[i].novoriDetails).toEqual({ bookId: 'search', isbns: ['search'] });
  expect(results[i].id).toBe(editions[i].id);
  expect(results[i].volumeInfo.imageLinks).toEqual(editions[i].volumeInfo.imageLinks);
  expect(results[i].volumeInfo.industryIdentifiers).toEqual(editions[i].volumeInfo.industryIdentifiers);
  expect(editions[i].volumeInfo.pageCount).toBe(600);
 }
 expect(search).toHaveBeenCalledTimes(1);
 await reader.resolve(book('another', 800));
 expect(search).toHaveBeenCalledTimes(1);
});
test('completed title search primes details without another search', async () => {
 const search = jest.fn(async () => []);
 const reader = createBookWorkDetails(search);
 reader.remember('DUNE', [book('correct', 412)]);
 expect((await reader.resolve(book('trending', 600))).volumeInfo.pageCount).toBe(600);
 expect(search).not.toHaveBeenCalled();
});
test('search updates replace cached work details without touching edition caches', async () => {
 const reader = createBookWorkDetails(async () => []);
 reader.remember('Dune', [book('correct', 412)]);
 reader.remember('Dune', [book('updated', 420)]);
 expect((await reader.resolve(book('trending', 600))).volumeInfo.pageCount).toBe(600);
});
test.each(['Other Author', 'Frank Herbert'])('wrong author, language, collection and missing matches cannot overwrite details: %s', async author => {
 const edition = book('original', 412);
 const candidate = book('wrong', 900, author);
 if (author === 'Frank Herbert') candidate.volumeInfo.language = 'es';
 expect(applyBookWorkDetails(edition, candidate)).toBe(edition);
 expect(await createBookWorkDetails(async () => [candidate]).resolve(edition)).toBe(edition);
 const collection = { ...candidate, volumeInfo: { ...candidate.volumeInfo, title: 'Dune (Box Set)' } };
 expect(applyBookWorkDetails(edition, collection)).toBe(edition);
});
test('provider failures retain cached detail metadata and can retry', async () => {
 const search = jest.fn<() => Promise<GoogleBookSearchItem[]>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([book('good', 412)]);
 const reader = createBookWorkDetails(search);
 expect((await reader.resolve(book('original', 600))).volumeInfo.pageCount).toBe(600);
 expect((await reader.resolve(book('original', 600))).volumeInfo.pageCount).toBe(600);
});
