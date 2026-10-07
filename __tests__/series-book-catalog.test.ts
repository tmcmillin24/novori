import { test, expect } from '@jest/globals';
import { attachSeriesCatalogIdentities, matchesSeriesCatalogEdition } from '../supabase/functions/_shared/series-book-catalog';
const book = { title: 'Threshing Day', authors: ['Rebecca Yarros'], isbns: ['9780349451428'], imageUrl: 'https://wrong/cartoon.jpg' };
const edition = { provider_book_id: 'correct', isbn_13: '9780349451428', metadata: { volumeInfo: { title: 'Threshing Day (Standard Edition)', authors: ['Yarros, Rebecca'], language: 'en' } } };
test('series requires matching English title and author, not just an ISBN', () => {
 expect(matchesSeriesCatalogEdition(book, edition)).toBe(true);
 expect(matchesSeriesCatalogEdition(book, { ...edition, metadata: { volumeInfo: { title: 'Les Dragons', authors: ['Other Author'], language: 'en' } } })).toBe(false);
 expect(matchesSeriesCatalogEdition(book, { ...edition, metadata: { volumeInfo: { ...edition.metadata.volumeInfo, language: 'es' } } })).toBe(false);
});
test('cached series thumbnails resolve to matching catalog IDs and unverified artwork is suppressed', async () => {
 const admin: any = { from: (table: string) => ({ select() { return this; }, in(column: string) { return column === 'provider' ? this : Promise.resolve({ data: table === 'book_works' ? [] : [edition], error: null }); } }) };
 const result = await attachSeriesCatalogIdentities(admin, { books: [book, { ...book, title: 'Another Book' }] });
 expect(result.books[0]).toMatchObject({ coverBookId: 'correct', imageUrl: null });
 expect(result.books[1]).toMatchObject({ coverBookId: null, imageUrl: null });
 expect(book.imageUrl).toBe('https://wrong/cartoon.jpg');
});

test('series uses another cached English printing without accepting foreign or collection metadata', async () => {
 const alternative = { ...edition, isbn_13: '9789999999999' };
 const calls: string[] = [];
 const admin: any = { from: (table: string) => ({ select() { return this; }, in(column: string) {
  calls.push(`${table}.${column}`);
  if (column === 'provider') return this;
  const data = table === 'book_works' ? [{ id: 'work' }] : column === 'work_id' ? [
   { ...alternative, provider_book_id: 'foreign', language: 'es', metadata: { volumeInfo: { ...alternative.metadata.volumeInfo, language: 'es' } } },
   { ...alternative, provider_book_id: 'set', metadata: { volumeInfo: { ...alternative.metadata.volumeInfo, description: 'All five books in a luxe box set.' } } },
   alternative,
  ] : [];
  return Promise.resolve({ data, error: null });
 } }) };
 const result = await attachSeriesCatalogIdentities(admin, { books: [book, { ...book, authors: ['Other Author'] }] });
 expect(result.books[0].coverBookId).toBe('correct');
 expect(result.books[1].coverBookId).toBeNull();
 expect(calls.filter(call => call === 'book_works.normalized_title')).toHaveLength(1);
 expect(calls.filter(call => call === 'book_editions.work_id')).toHaveLength(1);
});
