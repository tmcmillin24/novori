import { test, expect } from '@jest/globals';
import { selectCanonicalGoogleCoversForWorkIds } from '../supabase/functions/_shared/book-cover-selector';

function catalog(candidates: any[], selections: any[] = []) {
  const writes: any[] = [];
  const editions = [
    { id: 'edition', detail_complete: true, language: 'en', sale_country: 'US' },
    { id: 'foreign', detail_complete: true, language: 'fr', sale_country: 'FR' },
  ];
  const rows: Record<string, any[]> = { book_cover_selections: selections, book_cover_candidates: candidates, book_editions: editions };
  const client = { from(table: string) {
    let data = rows[table];
    const query = {
      select() { return query; },
      order() { return query; },
      range(start: number, end: number) { data = data.slice(start, end + 1); return query; },
      in(column: string, values: unknown[]) { data = data.filter(row => values.includes(row[column])); return query; },
      eq(column: string, value: unknown) { data = data.filter(row => row[column] === value); return query; },
      upsert(decisions: any[]) { writes.push(...decisions); return Promise.resolve({ error: null }); },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data, error: null }).then(resolve); },
    };
    return query;
  } };
  return { client, writes };
}
function candidate(id: string, variant: string, provider = 'google_books', work = 'work') {
  return { id, work_id: work, edition_id: 'edition', provider, source_variant: variant, scope: 'edition', url: `https://art/${id}` };
}

test('catalog chooses extraLarge, then verified series, then Google large', async () => {
  const first = catalog([candidate('large', 'large'), candidate('verified', 'series_verified', 'hardcover'), candidate('biggest', 'extraLarge')]);
  await selectCanonicalGoogleCoversForWorkIds(first.client as any, ['work']);
  expect(first.writes[0].candidate_id).toBe('biggest');
  const second = catalog([candidate('large', 'large'), candidate('verified', 'series_verified', 'hardcover')]);
  await selectCanonicalGoogleCoversForWorkIds(second.client as any, ['work']);
  expect(second.writes[0].candidate_id).toBe('verified');
});

test('saves the largest available small artwork when no larger candidate exists', async () => {
  const { client, writes } = catalog([candidate('tiny', 'smallThumbnail'), candidate('thumb', 'thumbnail'), candidate('small', 'small')]);
  await selectCanonicalGoogleCoversForWorkIds(client as any, ['work']);
  expect(writes[0]).toMatchObject({ candidate_id: 'small', status: 'selected' });
});

test('never writes over a locked/manual work', async () => {
  const { client, writes } = catalog([candidate('new', 'extraLarge')], [{ work_id: 'work', locked: true }]);
  await selectCanonicalGoogleCoversForWorkIds(client as any, ['work']);
  expect(writes).toEqual([]);
});

test('does not borrow another work or explicitly foreign artwork', async () => {
  const { client, writes } = catalog([candidate('other', 'extraLarge', 'google_books', 'other'), { ...candidate('foreign', 'extraLarge'), edition_id: 'foreign' }]);
  await selectCanonicalGoogleCoversForWorkIds(client as any, ['work']);
  expect(writes[0].candidate_id).toBeNull();
});

test('reading an unchanged canonical cover does not rewrite the saved selection', async () => {
  const { client, writes } = catalog([candidate('best', 'extraLarge')], [{
    work_id: 'work', locked: false, candidate_id: 'best', status: 'selected', score: 700, selector_version: 1,
  }]);
  await selectCanonicalGoogleCoversForWorkIds(client as any, ['work']);
  expect(writes).toEqual([]);
});

test('finds the best stored candidate beyond the database first-page limit', async () => {
  const candidates = Array.from({ length: 1000 }, (_, i) => candidate(`small-${i}`, 'small'));
  candidates.push(candidate('best-last', 'extraLarge'));
  const { client, writes } = catalog(candidates);
  await selectCanonicalGoogleCoversForWorkIds(client as any, ['work']);
  expect(writes[0].candidate_id).toBe('best-last');
});
