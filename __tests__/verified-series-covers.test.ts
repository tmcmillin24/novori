import { test, expect, jest } from '@jest/globals';
import { promoteVerifiedSeriesCovers } from '../supabase/functions/_shared/verified-series-covers';
import { selectCanonicalGoogleCoversForWorkIds } from '../supabase/functions/_shared/book-cover-selector';
jest.mock('../supabase/functions/_shared/book-cover-selector', () => ({ selectCanonicalGoogleCoversForWorkIds: jest.fn() }));
const row = { id: 3, title: "The Dungeon Anarchist's Cookbook", authors: ['Matt Dinniman'], isbns: ['9780593820285'], imageUrl: 'https://hardcover/novel-original.jpg', position: 3 };
const edition = { id: 'edition', work_id: 'novel-work', provider_book_id: 'nv_novel', isbn_13: row.isbns[0], metadata: { volumeInfo: { title: row.title, authors: row.authors, language: 'en' } } };
function harness(editions: any[]) {
 const save = jest.fn(async () => ({ error: null }));
 const admin: any = { from: (table: string) => ({ select() { return this; }, in(column: string) { return column === 'provider' ? this : Promise.resolve({ data: editions }); }, upsert: save }) };
 return { admin, save };
}
test('ISBNdb and legacy catalog identities receive the same verified Hardcover series candidate policy', async () => {
 const h = harness([edition]);
 await promoteVerifiedSeriesCovers(h.admin, { series: { id: 5 }, books: [row] }, row.authors);
 expect(h.save).toHaveBeenCalledWith(expect.objectContaining({ work_id: 'novel-work', edition_id: 'edition', provider: 'hardcover', source_variant: 'series_verified', scope: 'edition', source_kind: 'series_cover', url: row.imageUrl }), { onConflict: 'candidate_key' });
 expect(selectCanonicalGoogleCoversForWorkIds).toHaveBeenLastCalledWith(h.admin, ['novel-work']);
});
test('wrong ISBN metadata, unrelated authors and expiring art cannot promote a cookbook cover', async () => {
 for (const bad of [ { ...edition, metadata: { volumeInfo: { title: 'A Cookbook', authors: ['Matt Dinniman'], language: 'en' } } }, { ...edition, metadata: { volumeInfo: { title: row.title, authors: ['Other Author'], language: 'en' } } } ]) {
  const h = harness([bad]);
  await promoteVerifiedSeriesCovers(h.admin, { series: {}, books: [row] }, row.authors);
  expect(h.save).not.toHaveBeenCalled();
 }
 const h = harness([edition]);
 await promoteVerifiedSeriesCovers(h.admin, { series: {}, books: [ { ...row, imageUrl: 'https://image/temporary?Expires=123' }, { ...row, authors: ['Other Author'] } ] }, row.authors);
 expect(h.save).not.toHaveBeenCalled();
});
test('already verified alternate-printing identity works without fetching provider metadata', async () => {
 const h = harness([{ ...edition, isbn_13: '9789999999999' }]);
 await promoteVerifiedSeriesCovers(h.admin, { series: {}, books: [{ ...row, isbns: [], coverBookId: 'nv_novel' }] }, row.authors);
 expect(h.save).toHaveBeenCalledTimes(1);
});
