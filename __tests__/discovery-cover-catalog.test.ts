import { attachDiscoveryCatalogCovers } from '../supabase/functions/_shared/discovery-cover-catalog';

test('trending rejects an unrelated ISBN edition and uses the verified English work cover', async () => {
 const right = { provider_book_id: 'isbndb_correct', work_id: 'novel', isbn_13: '9781111111111', metadata: { volumeInfo: { title: 'Threshing Day (Standard Edition)', authors: ['Rebecca Yarros'], language: 'en', imageLinks: { thumbnail: 'https://covers/edition.jpg' } } } };
 const wrong = { ...right, provider_book_id: 'wrong', work_id: 'cartoon', isbn_13: '9780349451428', metadata: { volumeInfo: { title: 'Les Dragons', authors: ['Someone Else'], language: 'en' } } };
 const calls: string[] = [];
 const admin: any = { from(table: string) { return {
  select() { return this; }, eq() { return this; },
  in(column: string) {
   calls.push(`${table}.${column}`);
   if (column === 'provider') return this;
   const data = table === 'book_works' ? [{ id: 'novel' }] : table === 'book_cover_selections' ? [{ work_id: 'novel', candidate_id: 'selected' }] : table === 'book_cover_candidates' ? [{ id: 'selected', url: 'https://covers/selected.jpg' }] : column === 'work_id' || column === 'provider_book_id' ? [right] : [wrong];
   return Promise.resolve({ data, error: null });
  },
 }; } };
 const payload = { books: [{ title: 'Threshing Day', authors: ['Rebecca Yarros'], isbns: ['9780349451428'], coverUrl: 'https://covers/cartoon.jpg' }] };
 const result = await attachDiscoveryCatalogCovers(admin, payload);
 expect(result.books[0]).toMatchObject({ coverBookId: 'isbndb_correct', coverUrl: 'https://covers/selected.jpg' });
 expect(payload.books[0].coverUrl).toBe('https://covers/cartoon.jpg');
 expect(calls).toContain('book_editions.provider_book_id');
});


test('an unresolved discovery listing cannot retain an unverified photographed cover', async () => {
 const admin: any = { from() { const q: any = { select: () => q, eq: () => q, in: () => q,
  then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve) }; return q; } };
 const result = await attachDiscoveryCatalogCovers(admin, { books: [{ title: 'Unknown Book', authors: ['Writer'], isbns: [], coverUrl: 'https://photos/angled.jpg' }] });
 expect(result.books[0].coverUrl).toBeNull();
});
