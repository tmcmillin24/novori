import { test, expect, jest } from '@jest/globals';
import { cacheSeriesPublications, readCatalogPublications } from '../supabase/functions/_shared/book-publication-cache';
import { bookPublicationKeys } from '../supabase/functions/_shared/book-edition-metadata';
import { getBookPublication, getPublicationVersion, rememberBookPublications, subscribeBookPublications } from '../src/lib/book-publication';

const fact = { title: 'Cache Test Novel', authors: ['Reader, Jane'], releaseDate: '2012' };
const book = { volumeInfo: { title: 'Cache Test Novel', authors: ['Jane Reader'], publishedDate: '2023-09-12' } };
function database() {
 const rows: any[] = [];
 let writes = 0;
 let reads = 0;
 const admin = { from() {
  reads++;
  let data = rows.slice();
  const query: any = {
   select() { return query; },
   eq(column: string, value: any) { data = data.filter(row => row[column] === value); return query; },
   in(column: string, values: any[]) { data = data.filter(row => values.includes(row[column])); return query; },
   gt(column: string, value: string) { data = data.filter(row => row[column] > value); return query; },
   upsert(input: any[]) { writes++; for (const row of input) { const old = rows.find(candidate => candidate.request_key === row.request_key); if (old) Object.assign(old, row); else rows.push(row); } return Promise.resolve({ error: null }); },
   then(resolve: any) { return Promise.resolve({ data, error: null }).then(resolve); },
  };
  return query;
 } };
 return { admin, rows, counts: () => ({ writes, reads }) };
}

test('series originals persist once and a single batch lookup enriches different edition IDs', async () => {
 const db = database();
 await cacheSeriesPublications(db.admin, { books: [fact, { ...fact, title: 'Untitled', releaseDate: null }] });
 await cacheSeriesPublications(db.admin, { books: [fact] });
 expect(db.counts().writes).toBe(1);
 const before = db.counts().reads;
 const publications = await readCatalogPublications(db.admin, [
  { provider_book_id: 'printing-one', metadata: book }, { provider_book_id: 'printing-two', metadata: book },
  { provider_book_id: 'other-author', metadata: { volumeInfo: { ...book.volumeInfo, authors: ['Other Writer'] } } },
  { provider_book_id: 'set', metadata: { volumeInfo: { ...book.volumeInfo, description: 'All five books in a luxe box set.' } } },
 ]);
 expect(publications).toEqual({ 'printing-one': fact, 'printing-two': fact });
 expect(db.counts().reads - before).toBe(1);
 db.rows[0].stale_until = '2000-01-01T00:00:00Z';
 expect(await readCatalogPublications(db.admin, [{ provider_book_id: 'printing-one', metadata: book }])).toEqual({});
});

test('cached search cards update after learning a series date without changing ISBN metadata', () => {
 const notify = jest.fn();
 const unsubscribe = subscribeBookPublications(notify);
 const before = getPublicationVersion();
 rememberBookPublications([fact]);
 expect(getPublicationVersion()).toBeGreaterThan(before);
 expect(notify).toHaveBeenCalledTimes(1);
 expect(getBookPublication(book)).toEqual({ date: '2012', label: 'First published', editionDate: '2023-09-12' });
 rememberBookPublications([fact]);
 expect(notify).toHaveBeenCalledTimes(1);
 expect(book.volumeInfo.publishedDate).toBe('2023-09-12');
 unsubscribe();
});

test('publication keys group the work by normalized title and author, not ISBN or title alone', () => {
 expect(bookPublicationKeys(fact)).toEqual(bookPublicationKeys(book.volumeInfo));
 expect(bookPublicationKeys({ title: fact.title, authors: ['Other Writer'] })).not.toEqual(bookPublicationKeys(fact));
 expect(bookPublicationKeys({ title: fact.title })).toEqual([]);
});

test('old cached series responses supply original dates in the same batch read', async () => {
 const db = database();
 const metadata = { volumeInfo: { ...book.volumeInfo, industryIdentifiers: [{ identifier: '9781234567897' }] } };
 db.rows.push({ provider: 'hardcover_series', request_key: 'series:v2:english-isbns::9781234567897::cache test novel::jane reader',
  response_json: { books: [fact] }, stale_until: '2099-01-01T00:00:00Z' });
 expect(await readCatalogPublications(db.admin, [{ provider_book_id: 'legacy-edition', metadata }])).toEqual({ 'legacy-edition': fact });
 expect(db.counts()).toEqual({ writes: 0, reads: 1 });
});
