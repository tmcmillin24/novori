const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const crypto = require('crypto').webcrypto;

const book = (id, author = 'Caro Claire Burke', title = 'Yesteryear: A GMA Book Club Pick: A Novel') => ({
  id, volumeInfo: { title, authors: [author], language: 'en', imageLinks: { thumbnail: 'https://covers/original.jpg' } }, saleInfo: { country: 'US' },
});
function harness({ catalog = [], mapping = null, fallback = [], fallbackStatus = 200, quotaLimit = Infinity } = {}) {
  const rows = new Map(), calls = [], catalogReads = [];
  const key = 'trending:v1:yesteryear::caro claire burke';
  if (mapping) rows.set('google_books:' + key, mapping);
  let quota = 0;
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: 'reader' } } }) },
    rpc: async (name) => name === 'novori_claim_api_cache_refresh' ? { data: [{ acquired: true }] }
      : name === 'novori_claim_google_books_search' ? { data: [{ allowed: ++quota <= quotaLimit, global_upstream_count: quota }] }
      : { data: null },
    from(table) {
      const filters = {};
      const query = {
        select: () => query, eq: (name, value) => { filters[name] = value; return query; },
        in: () => query, ilike: () => { catalogReads.push(table); return query; }, limit: () => query, order: () => query,
        maybeSingle: async () => ({ data: table === 'book_api_cache' ? rows.get(filters.provider + ':' + filters.request_key) ?? null : null }),
        upsert: async (value) => { if (table === 'book_api_cache') rows.set(value.provider + ':' + value.request_key, value); return { error: null }; },
        then: (resolve) => Promise.resolve({ data: table === 'google_books_catalog' ? catalog.map((metadata) => ({ metadata })) : [], error: null }).then(resolve),
      };
      return query;
    },
  };
  const modules = new Map();
  function load(relative) {
    const filename = path.resolve(__dirname, '..', relative);
    if (modules.has(filename)) return modules.get(filename);
    const exports = {};
    modules.set(filename, exports);
    const source = fs.readFileSync(filename, 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
      exports, Response, URL, URLSearchParams, TextEncoder, Uint8Array, AbortController, crypto, Date, Math, Promise, setTimeout, clearTimeout,
      console: { warn() {}, error() {} },
      fetch: async (url) => {
        calls.push(url);
        const query = new URL(url).searchParams.get('q');
        return new Response(JSON.stringify({ items: query.includes('inauthor') ? [] : fallback }),
          { status: query.includes('inauthor') ? 200 : fallbackStatus });
      },
      Deno: { env: { get: () => 'configured' }, serve: (handler) => { exports.handler = handler; } },
      require: (name) => name.startsWith('https:') ? { createClient: () => admin }
        : name.includes('book-catalog') ? { recordGoogleBooksInCatalog: async () => {} }
        : load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name))),
    });
    return exports;
  }
  const endpoint = load('supabase/functions/google-books-resolve/index.ts');
  return {
    calls, rows, catalogReads, key,
    call: async () => (await endpoint.handler({ method: 'POST', headers: { get: () => 'Bearer reader' }, json: async () => ({ mode: 'trending', title: 'Yesteryear', author: 'Caro Claire Burke' }) })).json(),
    quota: () => quota,
  };
}
function mapping(payload) {
  return { response_json: payload, fetched_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(), stale_until: new Date(Date.now() + 2 * 86400000).toISOString() };
}

test('existing successful mappings stay cached with zero provider calls or catalog rescans', async () => {
  const h = harness({ mapping: mapping({ kind: 'trending', googleBookId: 'saved-edition' }) });
  expect((await h.call()).data.googleBookId).toBe('saved-edition');
  expect(h.calls).toHaveLength(0);
  expect(h.catalogReads).toHaveLength(0);
  expect(h.quota()).toBe(0);
});

test('an old not-found mapping repairs from the cached book-club edition with zero Google calls', async () => {
  const h = harness({ catalog: [book('verified-edition')], mapping: mapping({ kind: 'trending', googleBookId: null }) });
  const result = await h.call();
  expect(result.data.googleBookId).toBe('verified-edition');
  expect(result.cache.googleRequestMade).toBe(false);
  expect(h.calls).toHaveLength(0);
  await h.call();
  expect(h.calls).toHaveLength(0);
  expect(h.catalogReads).toHaveLength(1);
});

test('strict-query misses use one cached title-only fallback and reject unrelated authors', async () => {
  const h = harness({ fallback: [book('wrong-author', 'Someone Else'), book('verified-edition')] });
  expect((await h.call()).data.googleBookId).toBe('verified-edition');
  expect(h.calls).toHaveLength(2);
  expect(h.quota()).toBe(2);
  await h.call();
  expect(h.calls).toHaveLength(2);
});

test('fresh new-version misses do not repeat provider requests on every tap', async () => {
  const h = harness({ mapping: mapping({ kind: 'trending', googleBookId: null, resolverVersion: 2 }) });
  expect((await h.call()).data.googleBookId).toBeNull();
  await h.call();
  expect(h.calls).toHaveLength(0);
  expect(h.quota()).toBe(0);
});

test('another book with the same title cannot replace the requested author', async () => {
  const h = harness({ catalog: [book('unrelated', 'Someone Else')], fallback: [book('unrelated', 'Someone Else')] });
  expect((await h.call()).data.googleBookId).toBeNull();
  expect(h.rows.get('google_books:' + h.key).response_json.resolverVersion).toBe(2);
  const calls = h.calls.length;
  await h.call();
  expect(h.calls).toHaveLength(calls);
});

test.each([
  ['quota reached', { quotaLimit: 1 }],
  ['Google unavailable', { fallbackStatus: 503 }],
])('a stale successful mapping survives a title fallback with %s', async (_, options) => {
  const stored = mapping({ kind: 'trending', googleBookId: 'saved-edition' });
  stored.expires_at = new Date(Date.now() - 1000).toISOString();
  const h = harness({ mapping: stored, ...options });
  const result = await h.call();
  expect(result.ok).toBe(true);
  expect(result.data.googleBookId).toBe('saved-edition');
  expect(result.cache.status).toBe('stale');
  expect(h.rows.get('google_books:' + h.key).response_json.googleBookId).toBe('saved-edition');
});
