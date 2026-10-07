import { test, expect } from '@jest/globals';
import { selectCanonicalGoogleCoversForWorkIds } from '../supabase/functions/_shared/book-cover-selector';

function catalog(candidates: any[], selections: any[] = [], audio = false, extraEditions: any[] = []) {
  const writes: any[] = [];
  const editions = [
    ...extraEditions,
    { id: 'edition', metadata: { volumeInfo: { title: 'Catching Fire', language: 'en' } }, detail_complete: true, language: 'en', sale_country: 'US' },
    { id: 'foreign', detail_complete: true, language: 'fr', sale_country: 'FR' },
    { id: 'audio', detail_complete: true, language: 'en', sale_country: 'US', metadata: {volumeInfo:{description: audio ? 'MP3 CD Format' : ''},novoriEdition:{format: audio ? 'audio' : 'unknown'}} },
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
  return { id, work_id: work, edition_id: 'edition', provider, source_variant: variant, scope: 'edition', url: `https://art/${id}`, source_metadata: provider === 'hardcover' ? { coverEdition: { version: 1, editionId: 2, language: 'en', title: 'Catching Fire', isbn: '9780439023498', url: `https://art/${id}` } } : undefined };
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
    work_id: 'work', locked: false, candidate_id: 'best', status: 'selected', score: 700, selector_version: 4,
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

test('ISBNdb covers participate without downgrading larger or locked artwork', async () => {
 const plain=catalog([candidate('isbn','medium','isbndb')]);
 await selectCanonicalGoogleCoversForWorkIds(plain.client as any,['work']);
 expect(plain.writes[0].candidate_id).toBe('isbn');
 const better=catalog([candidate('isbn','medium','isbndb'),candidate('sharp','extraLarge')]);
 await selectCanonicalGoogleCoversForWorkIds(better.client as any,['work']);
 expect(better.writes[0].candidate_id).toBe('sharp');
 const manual=catalog([candidate('isbn','medium','isbndb')],[{work_id:'work',locked:true}]);
 await selectCanonicalGoogleCoversForWorkIds(manual.client as any,['work']);
 expect(manual.writes).toEqual([]);
});

test('same-work print cover outranks an audio narrator cover while audio-only artwork remains available',async()=>{
 const audio={...candidate('audio-art','medium','isbndb'),edition_id:'audio'};
 const pair=catalog([audio,candidate('print-art','medium','isbndb')],[],true);
 await selectCanonicalGoogleCoversForWorkIds(pair.client as any,['work']);
 expect(pair.writes[0].candidate_id).toBe('print-art');
 const only=catalog([audio],[],true);
 await selectCanonicalGoogleCoversForWorkIds(only.client as any,['work']);
 expect(only.writes[0].candidate_id).toBe('audio-art');
});

function isbnEdition(id: string, date: string | undefined, complete = false, format = 'print') {
  return { id, detail_complete: complete, language: 'en', sale_country: null,
    metadata: { volumeInfo: { title: 'A Novel', publishedDate: date }, novoriEdition: { format } } };
}
function isbnArt(id: string, editionId: string, url?: string) {
  return { ...candidate(id, 'medium', 'isbndb'), edition_id: editionId, ...(url ? { url } : {}) };
}

test('cached Iron Flame original print editions beat the opened 2025 reissue', async () => {
  // Candidate URLs and dates from the exported catalog; no uploaded artwork or
  // title-specific production rule. Other candidate UUIDs deliberately sort first.
  const editions = [
    isbnEdition('original-uk', '2023-10-31'),
    isbnEdition('original-us', '2023-11-07'),
    isbnEdition('reissue', '2025-05-20', true),
    isbnEdition('future', '2026-10-15'),
  ];
  const covers = [
    isbnArt('b9554419', 'reissue', 'https://images.isbndb.com/covers/6508543482775.jpg'),
    isbnArt('13067455', 'original-us', 'https://images.isbndb.com/covers/6474473482775.jpg'),
    isbnArt('2e882e58', 'original-uk', 'https://images.isbndb.com/covers/10823853482312.jpg'),
    isbnArt('04634eb8', 'future'),
  ];
  for (const candidates of [covers, [...covers].reverse()]) {
    const { client, writes } = catalog(candidates, [{work_id:'work', locked:false, candidate_id:'b9554419', selector_version:1, status:'selected',score:480}], false, editions);
    await selectCanonicalGoogleCoversForWorkIds(client as any, ['work']);
    expect(writes[0]).toMatchObject({candidate_id:'2e882e58', score:460, selector_version:4});
  }
});

test('fetching another equal ISBNdb edition cannot replace original release artwork', async () => {
  for (const complete of [false, true]) {
    const {client, writes} = catalog([
      isbnArt('z-original', 'original'), isbnArt('a-later', 'later')
    ], [{work_id:'work', locked:false,candidate_id:'z-original',status:'selected',score:460,selector_version:4}], false, [
      isbnEdition('original','2020-05-01'), isbnEdition('later','2024-05-01',complete)
    ]);
    await selectCanonicalGoogleCoversForWorkIds(client as any,['work']);
    expect(writes).toEqual([]);
  }
});

test('equivalent cached editions retain their winner instead of changing with new UUIDs', async () => {
  const {client,writes}=catalog([isbnArt('a-new','equal'),isbnArt('z-existing','original')],
    [{work_id:'work',locked:false,candidate_id:'z-existing',status:'selected',score:460,selector_version:4}], false,
    [isbnEdition('equal','2020-05-01',true),isbnEdition('original','2020-05-01')]);
  await selectCanonicalGoogleCoversForWorkIds(client as any,['work']);
  expect(writes).toEqual([]);
});

test('print and valid precise release dates beat unknown, ebook and invalid dates on equal artwork',async()=>{
  const editions=[isbnEdition('print','2020-05-01'),isbnEdition('year','2020'),
    isbnEdition('unknown',undefined),isbnEdition('invalid','2019-02-30'),isbnEdition('ebook','2010-01-01',true,'ebook')];
  const {client,writes}=catalog(editions.map(e=>isbnArt(e.id,e.id)),[],false,editions);
  await selectCanonicalGoogleCoversForWorkIds(client as any,['work']);
  expect(writes[0].candidate_id).toBe('print');
});

test('existing winner still upgrades to larger artwork and cannot keep an ineligible language',async()=>{
  const existing=[{work_id:'work',locked:false,candidate_id:'old',status:'selected',score:460,selector_version:4}];
  const {client,writes}=catalog([isbnArt('old','original'),candidate('sharp','extraLarge')],existing,false,[isbnEdition('original','2020-01-01')]);
  await selectCanonicalGoogleCoversForWorkIds(client as any,['work']);
  expect(writes[0].candidate_id).toBe('sharp');
  const foreign=catalog([{...isbnArt('old','foreign')},isbnArt('eligible','original')],existing,false,[isbnEdition('original','2020-01-01')]);
  await selectCanonicalGoogleCoversForWorkIds(foreign.client as any,['work']);
  expect(foreign.writes[0].candidate_id).toBe('eligible');
});


test('mislabeled sets already stored under a novel cannot supply its cover',async()=>{
 const extras=[{...isbnEdition('set','2010-01-01',true),metadata:{volumeInfo:{title:'A Novel',description:'All five of the novels in a deluxe box set.'},novoriEdition:{format:'print'}}}];
 const {client,writes}=catalog([isbnArt('set-cover','set'),isbnArt('novel-cover','novel')],[],false,[...extras,isbnEdition('novel','2020-01-01')]);
 await selectCanonicalGoogleCoversForWorkIds(client as any,['work']);
 expect(writes[0].candidate_id).toBe('novel-cover');
 const only=catalog([isbnArt('set-cover','set')],[],false,extras);
 await selectCanonicalGoogleCoversForWorkIds(only.client as any,['work']);
 expect(only.writes[0].candidate_id).toBe('set-cover');
});

test('retires legacy unproven series artwork even when linked catalog metadata is English', async () => {
 const unsafe = { ...candidate('spanish-art', 'series_verified', 'hardcover'), source_metadata: { hardcoverBookId: 1 } };
 const rejected: string[] = [];
 const { client, writes } = catalog([unsafe, candidate('english-art', 'medium', 'isbndb')]);
 await selectCanonicalGoogleCoversForWorkIds(client as any, ['work'], (_work, url) => rejected.push(url));
 expect(writes[0].candidate_id).toBe('english-art');
 expect(rejected).toEqual(['https://art/spanish-art']);
 const locked = catalog([unsafe], [{ work_id: 'work', locked: true, candidate_id: 'spanish-art' }]);
 await selectCanonicalGoogleCoversForWorkIds(locked.client as any, ['work'], () => { throw new Error('Manual locks must not be invalidated'); });
 expect(locked.writes).toEqual([]);
});
