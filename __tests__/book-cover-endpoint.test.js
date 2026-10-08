const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const { selectCanonicalGoogleCoversForWorkIds } = require('../supabase/functions/_shared/book-cover-selector');

function endpoint(locked = false, customize = () => {}) {
  const rows = {
    book_editions: [
      { id: 'a', provider: 'google_books', provider_book_id: 'volumeA', work_id: 'work', isbn_13: '9781234567897', language: 'en', sale_country: 'US', detail_complete: true },
      { id: 'b', provider: 'google_books', provider_book_id: 'volumeB', work_id: 'work', isbn_10: '123456789X', language: 'en', sale_country: 'US', detail_complete: true },
    ],
    book_cover_candidates: [
      { id: 'best', work_id: 'work', edition_id: 'a', provider: 'google_books', source_variant: 'extraLarge', scope: 'edition', url: 'https://art/original.jpg' },
      { id: 'manual', work_id: 'work', provider: 'manual', scope: 'work', url: 'https://art/manual.jpg' },
    ],
    book_cover_selections: locked ? [{ work_id: 'work', candidate_id: 'manual', locked: true, status: 'selected' }] : [],
  };
  rows.novori_discover_cache = [];
  rows.book_works = [];
  rows.book_api_cache = [];
  rows.book_editions.forEach(row => { row.metadata = { volumeInfo: { title: 'Example Novel', authors: ['Writer'], language: 'en', imageLinks: { medium: 'https://art/original.jpg' } } }; });
  customize(rows);
  const client = {
    auth: { getUser: async token => token === 'session' ? { data: { user: { id: 'reader' } } } : { error: 'unauthorized' } },
    from(table) {
      let data = rows[table];
      const query = {
        select() { return query; },
        gt() { return query; },
      order() { return query; },
      range(start, end) { data = data.slice(start, end + 1); return query; },
        in(column, values) { data = data.filter(row => values.includes(row[column])); return query; },
        eq(column, value) { data = data.filter(row => row[column] === value); return query; },
        upsert(decisions) {
          for (const decision of decisions) {
            const old = rows[table].find(row => row.work_id === decision.work_id);
            if (old) Object.assign(old, decision); else rows[table].push({ ...decision, locked: false });
          }
          return Promise.resolve({ error: null });
        },
        then(resolve) { return Promise.resolve({ data, error: null }).then(resolve); },
      };
      return query;
    },
  };
  let handler;
  const source = fs.readFileSync(path.join(__dirname, '../supabase/functions/book-cover-selection/index.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(compiled, {
    exports: {}, Response, console,
    Deno: { env: { get: name => name === 'NOVORI_SERVER_KEY' ? 'sb_secret_test' : name === 'SUPABASE_URL' ? 'https://test.supabase.co' : undefined }, serve: callback => { handler = callback; } },
    require: name => name.startsWith('https:') ? { createClient: () => client }
      : name.includes('supabase-keys') ? { getServerKey: read => read('NOVORI_SERVER_KEY') }
      : name.includes('edition-cover-catalog') ? require('../supabase/functions/_shared/edition-cover-catalog')
      : name.includes('catalog-cover-preferences') ? require('../supabase/functions/_shared/catalog-cover-preferences')
      : name.includes('series-book-catalog') ? require('../supabase/functions/_shared/series-book-catalog')
      : name.includes('catalog-metadata-covers') ? require('../supabase/functions/_shared/catalog-metadata-covers')
      : name.includes('catalog-cover-aliases') ? require('../supabase/functions/_shared/catalog-cover-aliases')
      : name.includes('book-publication-cache') ? require('../supabase/functions/_shared/book-publication-cache')
      : { selectCanonicalGoogleCoversForWorkIds },
  });
  return async (body, token = 'session') => {
    const response = await handler({ method: 'POST', headers: { get: () => token ? `Bearer ${token}` : '' }, json: async () => body });
    return response.json();
  };
}

test('batch endpoint returns one persisted cover for both volume IDs and ISBN keys', async () => {
  const result = await endpoint()({ volumeIds: ['volumeA', 'volumeB'], isbns: ['9781234567897', '123456789X'] });
  expect(result.ok).toBe(true);
  expect(Object.values(result.data.covers)).toEqual(Array(4).fill('https://art/original.jpg'));
  expect(Object.values(result.data.details).every(detail => detail.workId.startsWith('edition:') && detail.authoritative)).toBe(true);
});

test('single volume, ISBN-only, and locked/manual selections remain supported', async () => {
  const single = await endpoint(true)({ volumeId: 'volumeA' });
  expect(single.data).toMatchObject({ url: 'https://art/manual.jpg', locked: true, authoritative: true });
  const isbn = await endpoint(true)({ volumeIds: [], isbns: ['9781234567897'] });
  expect(isbn.data.covers['isbn:9781234567897']).toBe('https://art/manual.jpg');
});

test('endpoint rejects invalid IDs, ISBNs, oversized requests, and missing sessions', async () => {
  const handler = endpoint();
  for (const body of [{ volumeIds: ['invalid/id'] }, { isbns: ['bad'] }, { volumeIds: Array.from({ length: 201 }, (_, i) => `id${i}`) }]) {
    expect((await handler(body)).status).toBe(400);
  }
  expect((await handler({ volumeId: 'volumeA' }, '')).status).toBe(401);
});

test('different Catching Fire queries and saved IDs share a verified cached cover without merging IDs', async () => {
 const result = await endpoint(false, rows => {
  const info = { title: 'Catching Fire', authors: ['Suzanne Collins'], language: 'en', imageLinks: { medium: 'https://art/original.jpg' } };
  rows.book_editions[0].metadata = { volumeInfo: info };
  rows.book_editions[1].work_id = 'legacy-work';
  rows.book_editions[1].metadata = { volumeInfo: { ...info, title: 'Catching Fire (The Hunger Games, 2)', authors: ['Collins, Suzanne'] } };
  rows.book_works = [{ id: 'work', normalized_title: 'catching fire' }, { id: 'legacy-work', normalized_title: 'catching fire' }];
 })({ volumeIds: ['volumeB', 'volumeA'] });
 expect(result.ok).toBe(true);
 expect(result.data.covers).toEqual({ volumeA: 'https://art/original.jpg', volumeB: 'https://art/original.jpg' });
 expect(result.data.details.volumeA.workId).not.toBe(result.data.details.volumeB.workId);
});
test('a same-title different-author work cannot lend its artwork to an empty edition', async () => {
 const result = await endpoint(false, rows => {
  rows.book_editions[0].metadata = { volumeInfo: { title: 'Catching Fire', authors: ['Suzanne Collins'], language: 'en' } };
  rows.book_editions[1].work_id = 'other-work';
  rows.book_editions[1].metadata = { volumeInfo: { title: 'Catching Fire', authors: ['Other Author'], language: 'en' } };
  rows.book_works = [{ id: 'work', normalized_title: 'catching fire' }, { id: 'other-work', normalized_title: 'catching fire' }];
 })({ volumeIds: ['volumeB'] });
 expect(result.data.covers.volumeB).toBeNull();
});
test('rejected raw Hardcover art is reported so every client surface can retire saved snapshots', async () => {
 const result = await endpoint(false, rows => {
  rows.book_cover_candidates = [{ id: 'unsafe', work_id: 'work', edition_id: 'a', provider: 'hardcover', source_variant: 'series_verified', scope: 'edition', url: 'https://art/spanish.jpg' }];
  rows.book_cover_selections = [{ work_id: 'work', candidate_id: 'unsafe', locked: false, status: 'selected', selector_version: 3 }];
 })({ volumeIds: ['volumeA'] });
 expect(result.data.covers.volumeA).toBe('https://art/original.jpg');
 expect(result.data.details.volumeA.provider).toBe('google_books');
});


test.each(['Catching Fire', '1984', 'Piranesi', 'The Infinite Extent', 'Harry Potter and the Philosopher’s Stone'])('cached %s artwork is returned before opening even without candidate rows',async title=>{
 const run=endpoint(false,rows=>{
  rows.book_cover_candidates=[];
  rows.book_editions[0].metadata={volumeInfo:{title,authors:['Author'],language:'en',imageLinks:{medium:'https://publisher/art.jpg'}}};
  rows.book_editions[1].metadata={volumeInfo:{title,authors:['Author'],language:'en'}};
 });
 const result=await run({volumeIds:['volumeA','volumeB']});
 expect(result.data.covers).toEqual({volumeA:'https://publisher/art.jpg',volumeB:'https://publisher/art.jpg'});
});


test('owner preferred ISBN metadata supplies artwork even before its candidate row exists',async()=>{
 const run=endpoint(false,rows=>{
  rows.book_editions.forEach((row,i)=>Object.assign(row,{isbn_13:i?'9781682818527':'9781682818084',metadata:{volumeInfo:{title:'Threshing Day',authors:['Rebecca Yarros'],language:'en',imageLinks:{medium:i?'https://publisher/preferred.jpg':'https://publisher/other.jpg'}}}}));
 });
 const result=await run({volumeIds:['volumeA','volumeB']});
 expect(Object.values(result.data.covers)).toEqual(['https://publisher/preferred.jpg','https://publisher/preferred.jpg']);
});
test('the actual shared cover endpoint serves persisted Hardcover art across edition IDs and ISBNs',async()=>{
 const url='https://assets.hardcover.app/preferred.jpg';
 const proof={version:1,editionId:90,title:'Example Novel',language:'en',isbn:'9781234567897',url,nonAudio:true,format:'Physical Book'};
 const run=endpoint(false,rows=>rows.book_cover_candidates.push({id:'hardcover',work_id:'work',provider:'hardcover',source_variant:'discovery_verified_v1',url,source_metadata:{hardcoverBookId:30,title:'Example Novel',authors:['Writer'],coverEdition:proof,genres:['Fantasy'],reviewsCount:123}}));
 const result=await run({volumeIds:['volumeA','volumeB'],isbns:['9781234567897','123456789X']});
 expect(Object.values(result.data.covers).every(value=>value===url)).toBe(true);
 expect(result.data.details.volumeA).toMatchObject({provider:'hardcover',workId:'hardcover:30',scope:'work',genres:['Fantasy'],reviewsCount:123,aliases:['volumeA','volumeB']});
});
