const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const crypto = require('crypto').webcrypto;

function harness() {
  const rows = new Map(), locks = new Map(), discover = new Map();
  const errors = { read: false, lock: false, write: false, usage: false };
  const calls = [], env = { SUPABASE_URL: 'https://cache.test', SUPABASE_SERVICE_ROLE_KEY: 'server', HARDCOVER_API_TOKEN: 'hardcover', GOOGLE_BOOKS_API_KEY: 'google' };
  let upstream = async () => ({ data: { books: [] } });
  let claims = 0, hardcoverRequests = 0;
  const admin = {
    auth: { getUser: async token => token === 'reader' ? { data: { user: { id: 'reader' } } } : { error: 'invalid' } },
    rpc: async (name, args) => {
      if (name === 'novori_claim_api_cache_refresh') {
        if (errors.lock) return { error: { message: 'offline' } };
        const key = args.p_provider + ':' + args.p_request_key;
        const acquired = !(locks.get(key) > Date.now());
        if (acquired) locks.set(key, Date.now() + args.p_lease_seconds * 1000);
        return { data: [{ acquired, lock_until: new Date(locks.get(key)).toISOString() }] };
      }
      if (name === 'novori_record_hardcover_request') { if(errors.usage) return {error:{message:'tracking unavailable'}}; hardcoverRequests++; return {error:null}; }
      if (name === 'novori_claim_google_books_search') { claims++; return { data: [{ allowed: true, global_upstream_count: claims }] }; }
      if (name === 'novori_search_book_catalog_fuzzy') return { data: [] };
      return { data: null, error: null };
    },
    from(table) {
      const filters = {};
      const q = {
        select: () => q, eq: (k,v) => { filters[k] = v; return q; },
        in: () => q, or: () => q, ilike: () => q, order: () => q, limit: () => q,
        maybeSingle: async () => {
          if (errors.read) return { error: { message: 'offline' } };
          return { data: table === 'book_api_cache' ? rows.get(filters.provider + ':' + filters.request_key) ?? null : null };
        },
        upsert: async data => {
          if (errors.write) return { error: { message: 'offline' } };
          if (table === 'book_api_cache') rows.set(data.provider + ':' + data.request_key, { ...data });
          return { error: null };
        },
        then: resolve => Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return q;
    },
  };
  const fetch = async (url, init) => {
    if (url.startsWith('https://cache.test/rest/')) {
      const u = new URL(url);
      if (init.method === 'POST') {
        const row = JSON.parse(init.body); discover.set(row.cache_key, row);
        return new Response('', { status: 200 });
      }
      const key = u.searchParams.get('cache_key').replace(/^eq\./, '');
      return new Response(JSON.stringify(discover.has(key) ? [discover.get(key)] : []));
    }
    calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : null });
    const result = await upstream(url, init, calls.at(-1).body);
    return result instanceof Response ? result : new Response(JSON.stringify(result));
  };
  const modules = new Map();
  function load(relative) {
    const file = path.resolve(__dirname, '..', relative);
    if (modules.has(file)) return modules.get(file);
    const exports = {};
    modules.set(file, exports);
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(compiled, {
      exports, Response, Request, URL, URLSearchParams, TextEncoder, Uint8Array, AbortController, crypto, Date, Math, Error, Promise, setTimeout, clearTimeout,
      console: { info() {}, warn() {}, error() {} }, fetch,
      Deno: { env: { get: key => env[key] }, serve: handler => { exports.handler = handler; } },
      require: name => name.startsWith('https:') ? { createClient: () => admin }
        : name.includes('book-catalog') ? { recordGoogleBooksInCatalog: async () => {} }
        : name.includes('book-cover-selector') ? { selectCanonicalGoogleCoversForWorkIds: async () => {} }
        : name.includes('discovery-canonical-covers') ? { applyCanonicalDiscoveryCovers: async payload => payload }
        : load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(file), name))),
    });
    return exports;
  }
  const api = load('supabase/functions/_shared/provider-cache.ts');
  return { rows, locks, discover, errors, calls, env, admin, api, load,
    setUpstream: callback => { upstream = callback; }, get claims() { return claims; }, get hardcoverRequests() { return hardcoverRequests; },
    request: (endpoint, body, token = 'reader') => load(`supabase/functions/${endpoint}/index.ts`).handler(new Request('https://app.test', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })).then(response => response.json()),
  };
}

const options = h => ({ admin: h.admin, provider: 'hardcover_series', key: 'series:test', freshMs: 10000, staleMs: 30000 });

test('warm, concurrent and negative cached values require only one load', async () => {
  const h = harness(); let count = 0;
  const load = async () => { count++; await new Promise(resolve => setTimeout(resolve, 20)); return null; };
  expect(await Promise.all(Array.from({ length: 4 }, () => h.api.cachedProviderValue({ ...options(h), load })))).toEqual([null, null, null, null]);
  expect(await h.api.cachedProviderValue({ ...options(h), load })).toBeNull();
  expect(count).toBe(1);
});

test('provider failure serves bounded stale data and suppresses repeat refreshes', async () => {
  const h = harness(); const row = { response_json: { books: ['old'] }, expires_at: new Date(Date.now()-1).toISOString(), stale_until: new Date(Date.now()+30000).toISOString() };
  h.rows.set('hardcover_series:series:test', row);
  let count=0; const load=async()=>{ count++; throw new Error('provider offline'); };
  expect(await h.api.cachedProviderValue({ ...options(h), load })).toEqual(row.response_json);
  expect(await h.api.cachedProviderValue({ ...options(h), load })).toEqual(row.response_json);
  expect(count).toBe(1);
  expect(h.rows.get('hardcover_series:series:test').stale_until).toBe(row.stale_until);
  row.stale_until = new Date(Date.now()-1).toISOString();
  await expect(h.api.cachedProviderValue({ ...options(h), load })).rejects.toThrow('cooling down');
  expect(count).toBe(1);
});

test('cache or lock outages fail closed without contacting a provider', async () => {
  for (const error of ['read','lock']) {
    const h=harness(); h.errors[error]=true; let count=0;
    await expect(h.api.cachedProviderValue({ ...options(h), load: async()=>{ count++; return {}; } })).rejects.toThrow();
    expect(count).toBe(0);
  }
});

test('GraphQL errors are not cached as successful empty results', async () => {
  const h=harness(); h.setUpstream(async()=>({ errors: [{ message: 'rate limited' }] }));
  const call=()=>h.api.cachedHardcoverFetch(h.admin,'https://api.hardcover.app/v1/graphql',{ body: JSON.stringify({ query:'query Test { books { id } }', variables:{} }) },10000,30000);
  await expect(call()).rejects.toThrow('GraphQL errors');
  await expect(call()).rejects.toThrow('cooling down');
  expect(h.calls.length).toBe(1);
});

test('Google fallback queries share results and reserve quota only for an actual request', async () => {
  const h=harness(); let quota=0;
  h.setUpstream(async()=>({ items:[{id:'a'}] }));
  const url='https://www.googleapis.com/books/v1/volumes?q=isbn%3A9781111111111&maxResults=5&printType=books&key=secret';
  const call=()=>h.api.cachedGoogleQuery(h.admin,url,async()=>{ quota++; return true; });
  expect(await (await call()).json()).toEqual({items:[{id:'a'}]});
  await call(); expect(quota).toBe(1); expect(h.calls.length).toBe(1);
  expect([...h.rows.keys()].some(key=>key.includes('secret'))).toBe(false);
});

test('Google resolver query reuses the existing search cache without a quota claim', async () => {
  const h=harness();
  h.rows.set('google_books:search:v1:shared title', { response_json:{items:[{id:'known'}]}, expires_at:new Date(Date.now()+10000).toISOString() });
  let quota=0;
  const response=await h.api.cachedGoogleQuery(h.admin,'https://www.googleapis.com/books/v1/volumes?q=Shared%20Title&maxResults=5&printType=books&key=secret',async()=>{quota++;return true;});
  expect((await response.json()).items[0].id).toBe('known');expect(h.calls.length).toBe(0);expect(quota).toBe(0);
});

function hcBook(isbn,id=1,title='Alpha') {
  return { id,title,rating:4.5,ratings_count:100,reviews_count:20,users_count:200,
    contributions:[{author:{name:'Author'}}], editions:[{isbn_13:isbn}] };
}
const book=(id,isbn,title='Alpha')=>({googleBookId:id,isbns:[isbn],title,authors:['Author']});

test('popularity reuses books across reordered, overlapping and new-edition batches', async () => {
  const h=harness();
  h.setUpstream(async(url,init,body)=>({data:{books:body.variables.isbns.map((isbn,i)=>hcBook(isbn,i+1,isbn==='9782222222222'?'Beta':'Alpha'))}}));
  const a=book('a','9781111111111'),b=book('b','9782222222222','Beta');
  expect((await h.request('hardcover-search-popularity',{books:[a,b]})).popularity.a.rating).toBe(4.5);
  await h.request('hardcover-search-popularity',{books:[b,a]});
  await h.request('hardcover-search-popularity',{books:[{...a,googleBookId:'new-edition',isbns:['9783333333333']}],allowTitleFallback:true});
  expect(h.calls.length).toBe(1);
});

test('forty popularity title misses use one batch request and cache confirmed no-matches', async()=>{
  const h=harness();h.setUpstream(async()=>({data:{}}));
  const books=Array.from({length:40},(_,i)=>({googleBookId:'id'+i,title:'Title '+i,authors:['Author'],isbns:[]}));
  expect((await h.request('hardcover-search-popularity',{books,allowTitleFallback:true})).popularity).toEqual({});
  expect(h.calls.length).toBe(1);expect(h.calls[0].body.query).toContain('book39: search');
  await h.request('hardcover-search-popularity',{books:books.slice(0,1),allowTitleFallback:true});
  expect(h.calls.length).toBe(1);
});

test('simultaneous overlapping popularity requests query each ISBN only once', async()=>{
  const h=harness();h.setUpstream(async(url,init,body)=>{
    await new Promise(resolve=>setTimeout(resolve,20));
    return {data:{books:body.variables.isbns.map(isbn=>hcBook(isbn,isbn==='9781111111111'?1:2,isbn==='9781111111111'?'Alpha':'Beta'))}};
  });
  const a=book('a','9781111111111'),b=book('b','9782222222222','Beta');
  const results=await Promise.all([h.request('hardcover-search-popularity',{books:[a,b]}),h.request('hardcover-search-popularity',{books:[a]})]);
  expect(results.every(result=>result.popularity?.a)).toBe(true);
  const isbns=h.calls.flatMap(call=>call.body.variables.isbns);
  expect(isbns.filter(isbn=>isbn===a.isbns[0]).length).toBe(1);
});

test('ISBN-only discovery popularity inputs produce matches',async()=>{
  const h=harness();h.setUpstream(async()=>({data:{books:[hcBook('9781111111111')]}}));
  expect((await h.request('hardcover-search-popularity',{books:[{googleBookId:'a',isbns:['9781111111111']}]})).popularity.a.hardcoverBookId).toBe(1);
});

test('series membership data is reused when a different book in the same series is opened',async()=>{
  const h=harness();
  const language={code2:'en'};
  const record=(id,title)=>({id,title,editions:[{isbn_13:'978'+id,language}],book_series:[{position:id,series:{id:50,name:'Series'}}]});
  h.setUpstream(async(url,init,body)=>body.query.includes('FindBookByISBN')
    ? {data:{editions:[{language,book:record(body.variables.isbn.endsWith('2')?2:1,'Book')}]}}
    : {data:{series_by_pk:{id:50,name:'Series',book_series:[{position:1,book:record(1,'One')},{position:2,book:record(2,'Two')}]}}});
  const first=await h.request('hardcover-series',{isbn:'9781111111111'});
  const second=await h.request('hardcover-series',{isbn:'9782222222222'});
  expect(first.series.id).toBe(50);expect(second.series.id).toBe(50);
  expect(h.calls.filter(call=>call.body.query.includes('GetSeries')).length).toBe(1);
  expect(h.calls.length).toBe(3);
});

test('a confirmed no-series result is cached and skips Google language lookup',async()=>{
  const h=harness();h.setUpstream(async()=>({data:{editions:[]}}));
  expect(await h.request('hardcover-series',{isbn:'9781111111111'})).toEqual({series:null,books:[]});
  await h.request('hardcover-series',{isbn:'9781111111111'});
  expect(h.calls.length).toBe(1);expect(h.claims).toBe(0);
});

test.each(['hardcover-trending','hardcover-recent-releases'])('fresh %s data survives pull-to-refresh with no provider request',async endpoint=>{
  const h=harness();const key=endpoint==='hardcover-trending'?'hardcover-trending:v5:90:100':'hardcover-recent-releases:v2:18:150';
  h.discover.set(key,{cache_key:key,payload:{books:[{id:1}]},refreshed_at:new Date(Date.now()-20*60000).toISOString()});
  expect((await h.request(endpoint,{forceRefresh:true})).books).toEqual([{id:1}]);
  expect(h.calls.length).toBe(0);
});

test.each(['hardcover-trending','hardcover-recent-releases'])('cold concurrent %s refreshes share the provider response',async endpoint=>{
  const h=harness();h.setUpstream(async()=>{await new Promise(resolve=>setTimeout(resolve,20));return {data:{books:[]}};});
  const results=await Promise.all([h.request(endpoint,{}),h.request(endpoint,{forceRefresh:true})]);
  expect(results.every(result=>Array.isArray(result.books))).toBe(true);
  expect(h.calls.length).toBe(1);
});

test('unsigned Hardcover requests and missing cache credentials never call the provider',async()=>{
  for(const endpoint of ['hardcover-search-popularity','hardcover-series','hardcover-trending','hardcover-recent-releases']){
    const h=harness();expect((await h.request(endpoint,{books:[book('a','9781111111111')],isbn:'9781111111111'},'invalid')).error).toBeTruthy();
    delete h.env.SUPABASE_SERVICE_ROLE_KEY;
    expect((await h.request(endpoint,{books:[book('a','9781111111111')],isbn:'9781111111111'})).error).toBeTruthy();
    expect(h.calls.length).toBe(0);
  }
});

test('derived cache entries do not extend the freshness of their upstream source',async()=>{
  const h=harness();const deadline=Date.now()+5000;
  await h.api.cachedProviderValue({...options(h),sourceExpiresAt:()=>deadline,load:async()=>({books:[1]})});
  expect(Date.parse(h.rows.get('hardcover_series:series:test').expires_at)).toBe(deadline);
});

test('Hardcover 429 backoff suppresses different uncached query keys too',async()=>{
  const h=harness();h.setUpstream(async()=>new Response('{}',{status:429}));
  const call=query=>h.api.cachedHardcoverFetch(h.admin,'https://api.hardcover.app/v1/graphql',{body:JSON.stringify({query,variables:{}})},10000,30000);
  await expect(call('query First { books { id } }')).rejects.toThrow('429');
  await expect(call('query Second { series { id } }')).rejects.toThrow('cooling down');
  expect(h.calls.length).toBe(1);
});

test.each(['google-books-detail','google-books-search'])('%s preserves stale data on network failure and caches the retry cooldown',async endpoint=>{
  const h=harness();const key=endpoint==='google-books-detail'?'detail:v1:known':'search:v1:known';
  const payload=endpoint==='google-books-detail'?{id:'known',volumeInfo:{title:'Known'}}:{items:[{id:'known'}]};
  h.rows.set('google_books:'+key,{response_json:payload,expires_at:new Date(Date.now()-1).toISOString(),stale_until:new Date(Date.now()+100000).toISOString()});
  h.setUpstream(async()=>{throw new Error('offline');});
  const body=endpoint==='google-books-detail'?{volumeId:'known'}:{query:'known'};
  expect((await h.request(endpoint,body)).data).toEqual(payload);
  expect((await h.request(endpoint,body)).cache.googleRequestMade).toBe(false);
  expect(h.calls.length).toBe(1);expect(h.claims).toBe(1);
});

test('Google 404 results are negatively cached without consuming quota repeatedly',async()=>{
  const h=harness();h.setUpstream(async()=>new Response('{}',{status:404}));
  expect((await h.request('google-books-detail',{volumeId:'missing'})).status).toBe(404);
  expect((await h.request('google-books-detail',{volumeId:'missing'})).status).toBe(404);
  expect(h.calls.length).toBe(1);expect(h.claims).toBe(1);
});

test('Google query failures cannot become year-long no-match identity cache entries',async()=>{
  const h=harness();h.setUpstream(async()=>new Response('{}',{status:503}));
  const result=await h.request('google-books-resolve',{mode:'identity',title:'Unknown',author:'Author'});
  expect(result.ok).toBe(false);
  expect([...h.rows.keys()].some(key=>key.startsWith('google_books:identity:'))).toBe(false);
});

test('Google resolver and normal search share the same query cache',async()=>{
  const h=harness();h.setUpstream(async()=>({items:[]}));
  expect((await h.request('google-books-resolve',{mode:'identity',title:'Unseen Title',author:'Author'})).ok).toBe(true);
  expect((await h.request('google-books-search',{query:'Unseen Title'})).ok).toBe(true);
  expect(h.calls.length).toBe(1);expect(h.claims).toBe(1);
});

test('Google pagination uses a separate shared cache key and actual upstream offset',async()=>{
  const h=harness();h.setUpstream(async()=>({items:[]}));
  await h.request('google-books-search',{query:'New',startIndex:40});
  await h.request('google-books-search',{query:'New',startIndex:40});
  expect(h.calls.length).toBe(1);expect(new URL(h.calls[0].url).searchParams.get('startIndex')).toBe('40');
});

test('successful no-match Google mappings get six hours, and legacy year-long negatives are capped',async()=>{
  const h=harness();h.setUpstream(async()=>({items:[]}));
  await h.request('google-books-resolve',{mode:'identity',title:'Unknown',author:'Author'});
  const row=[...h.rows.entries()].find(([key])=>key.startsWith('google_books:identity:'))[1];
  expect(Date.parse(row.expires_at)-Date.parse(row.fetched_at)).toBeLessThan(7*3600000);
  row.fetched_at=new Date(Date.now()-8*86400000).toISOString();
  row.expires_at=new Date(Date.now()+365*86400000).toISOString();row.stale_until=new Date(Date.now()+730*86400000).toISOString();
  h.locks.clear();
  h.rows.delete('google_books:search:v1:unknown');
  await h.request('google-books-resolve',{mode:'identity',title:'Unknown',author:'Author'});
  expect(h.calls.length).toBe(2);
});

 test('Hardcover counts actual upstream attempts once, never warm cache reads',async()=>{
 const h=harness();const init={method:'POST',body:JSON.stringify({query:'query { books { id } }'})};
 await h.api.cachedHardcoverFetch(h.admin,'https://api.hardcover.app/v1/graphql',init,10000,30000);
 await h.api.cachedHardcoverFetch(h.admin,'https://api.hardcover.app/v1/graphql',init,10000,30000);
 expect(h.hardcoverRequests).toBe(1);expect(h.calls).toHaveLength(1);
 });
 test('Hardcover tracking failures cannot silently send uncounted requests',async()=>{
 const h=harness();h.errors.usage=true;
 await expect(h.api.fetchHardcoverUpstream(h.admin,'https://api.hardcover.app/v1/graphql',{})).rejects.toThrow('Could not record');
 expect(h.calls).toHaveLength(0);expect(h.hardcoverRequests).toBe(0);
 });
 test('failed Hardcover attempts count, rate-limit cooldown retries do not',async()=>{
 const h=harness();h.setUpstream(async()=>new Response('{}',{status:429}));
 await h.api.fetchHardcoverUpstream(h.admin,'https://api.hardcover.app/v1/graphql',{});
 await expect(h.api.fetchHardcoverUpstream(h.admin,'https://api.hardcover.app/v1/graphql',{})).rejects.toThrow('cooling down');
 expect(h.hardcoverRequests).toBe(1);expect(h.calls).toHaveLength(1);
 });
