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
 const admin: any = { from: () => ({ select() { return this; }, in(column: string) { return column === 'provider' ? this : Promise.resolve({ data: [edition], error: null }); } }) };
 const result = await attachSeriesCatalogIdentities(admin, { books: [book, { ...book, title: 'Another Book' }] });
 expect(result.books[0]).toMatchObject({ coverBookId: 'correct', imageUrl: null });
 expect(result.books[1]).toMatchObject({ coverBookId: null, imageUrl: null });
 expect(book.imageUrl).toBe('https://wrong/cartoon.jpg');
});
