const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const { selectCanonicalGoogleCoversForWorkIds } = require('../supabase/functions/_shared/book-cover-selector');

function endpoint(locked = false) {
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
  const client = {
    auth: { getUser: async token => token === 'session' ? { data: { user: { id: 'reader' } } } : { error: 'unauthorized' } },
    from(table) {
      let data = rows[table];
      const query = {
        select() { return query; },
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
    Deno: { env: { get: () => 'configured' }, serve: callback => { handler = callback; } },
    require: name => name.startsWith('https:') ? { createClient: () => client } : { selectCanonicalGoogleCoversForWorkIds },
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
  expect(Object.values(result.data.details).every(detail => detail.workId === 'work' && detail.authoritative)).toBe(true);
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
