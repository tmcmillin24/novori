const fs = require('fs'), path = require('path'), vm = require('vm'), ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/app/book/[id]/index.tsx'), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };

function harness({ canonicalId = 'book', failStatus = false, discoveryId = undefined } = {}) {
  const state = {}, reader = deferred(), cover = deferred(), cart = deferred(), rating = deferred(), reviews = deferred(), work = deferred();
  const book = { id: 'book', volumeInfo: { title: 'Dune', authors: ['Frank Herbert'], industryIdentifiers: [] } };
  const setters = Object.fromEntries([...new Set(source.match(/\bset[A-Z]\w+/g))].map(name => [name, jest.fn(value => { state[name] = value; })]));
  let metadataOptions;
  const getUserBook = jest.fn(id => failStatus ? Promise.reject(Error('offline')) : reader.promise.then(row => ({ ...row, google_book_id: id })));
  const deps = {
    ...setters, applyEditionPages: require('../src/lib/edition-pages').applyEditionPages, discoveryId, rememberDiscoveryBookId: jest.fn(), id: 'book', source: 'library', canonicalizeWork: canonicalId === 'book' ? '0' : '1',
    clickedTitle: 'Dune', discoverClickedAuthors: ['Frank Herbert'], clickedIsbn: undefined, discoverCoverUrl: 'https://covers/current',
    savedStatusVersion: { current: 0 }, bookLoadGeneration: { current: 0 }, firstFocusBook: { current: null }, isSavedBookContext: true,
    getUserBook,
    fetchGoogleBooksJson: jest.fn(async (_, options) => { metadataOptions = options; return { ok: true, data: book, workDetails: work.promise }; }),
    resolveClickedDiscoverBook: jest.fn(async value => ({ ...value, id: canonicalId })),
    getCanonicalBookCover: jest.fn(() => 'https://covers/current'), resolveCanonicalBookCover: jest.fn(() => cover.promise),
    getBookISBN: () => null, loadSeries: jest.fn(), getBookCartItem: jest.fn(() => cart.promise),
    resolveHardcoverRating: jest.fn(() => rating.promise), getCommunityBookReviews: jest.fn(() => reviews.promise),
    __DEV__: false,
    console: { warn: jest.fn(), error: jest.fn() }, Promise,
  };
  const start = source.indexOf('    let active = true;', source.indexOf('    async function loadBook()') - 500);
  const end = source.indexOf('\n  }, [', start);
  const compiled = ts.transpileModule('exports.open = () => {\n' + source.slice(start, end) + '\n};', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { ...deps, exports });
  const focusStart = source.indexOf('      () => {', source.indexOf('  useFocusEffect(', end));
  const focusEnd = source.indexOf('\n      },\n      [', focusStart) + '\n      }'.length;
  vm.runInNewContext(ts.transpileModule('exports.focus = ' + source.slice(focusStart, focusEnd) + ';', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { ...deps, exports });
  return { state, deps, reader, cover, cart, rating, reviews, work, book, open: exports.open, focus: exports.focus, enrich: value => metadataOptions.onWorkDetails(value) };
}

test('cached details and existing cover display before private, cover, and enrichment requests finish', async () => {
  const h = harness(); h.open(); await flush();
  expect(h.state.setBook.id).toBe('book');
  expect(h.state.setLoading).toBe(false);
  expect(h.state.setSelectedWorkCoverUrl).toBe('https://covers/current');
  expect(h.state.setReaderStateReady).toBe(false);
  expect(h.state.setBookCartBusy).toBe(true);
  expect(h.deps.getUserBook).toHaveBeenCalledTimes(1);
  expect(h.deps.getBookCartItem).toHaveBeenCalledTimes(1);
  expect(h.deps.getCommunityBookReviews).toHaveBeenCalledTimes(1);
  expect(h.deps.resolveHardcoverRating).not.toHaveBeenCalled();
  const enriched = { ...h.book, novoriDetails: { bookId: 'work', isbns: ['isbn'] } };
  h.enrich(enriched); h.work.resolve(enriched); await flush();
  expect(h.deps.resolveHardcoverRating.mock.calls[0][0].googleBookId).toBe('work');
  expect(h.deps.loadSeries).toHaveBeenCalledWith(enriched, expect.any(Function));
  h.reader.resolve({ status: 'reading' }); await flush();
  expect(h.state.setReaderStateReady).toBe(true);
  expect(h.state.setReadingStatus).toBe('reading');
  h.cart.resolve(null); h.rating.resolve(null); h.reviews.resolve([]); h.cover.resolve('https://covers/current'); await flush();
  expect(h.deps.getUserBook).toHaveBeenCalledTimes(1);
  expect(h.state.setBookCartBusy).toBe(false);
});

test('canonicalized book reads status for its resolved identity', async () => {
  const h = harness({ canonicalId: 'canonical' }); h.open(); await flush();
  expect(h.state.setBook.id).toBe('canonical');
  expect(h.deps.getUserBook.mock.calls.map(call => call[0])).toEqual(['book', 'canonical']);
  h.reader.resolve({ status: 'read' }); await flush();
  expect(h.state.setSavedBook.google_book_id).toBe('canonical');
});

test('failed private lookup leaves book visible and exposes retry without enabling mutations', async () => {
  const h = harness({ failStatus: true }); h.open(); await flush();
  expect(h.state.setLoading).toBe(false);
  expect(h.state.setReaderStateReady).toBe(false);
  expect(h.state.setReaderStateError).toBe(true);
});

test('late results from a departed book cannot overwrite the next screen', async () => {
  const h = harness(); const cancel = h.open(); await flush(); cancel();
  expect(h.deps.bookLoadGeneration.current).toBe(2);
  const before = JSON.stringify(h.state);
  h.enrich({ ...h.book, volumeInfo: { title: 'Late metadata' } });
  h.work.resolve(h.book); h.reader.resolve({ status: 'read' }); h.cover.resolve('https://covers/late'); h.cart.resolve({ id: 'cart' }); h.reviews.resolve([{ id: 'review' }]); h.rating.resolve({ rating: 5 });
  await flush(); expect(JSON.stringify(h.state)).toBe(before);
});

test('initial focus avoids a duplicate private read, while later refocus refreshes status', async () => {
  const h = harness(); h.focus(); h.open(); await flush();
  expect(h.deps.getUserBook).toHaveBeenCalledTimes(1);
  h.reader.resolve({ status: 'reading' }); await flush();
  h.focus(); await flush();
  expect(h.deps.getUserBook).toHaveBeenCalledTimes(2);
  expect(h.state.setReaderStateReady).toBe(true);
});

test('refocus cannot overwrite a reading-status mutation that finishes during its read', async () => {
  const h = harness(); h.focus(); h.focus(); h.deps.savedStatusVersion.current += 1;
  h.reader.resolve({ status: 'want_to_read' }); await flush();
  expect(h.deps.setSavedBook).not.toHaveBeenCalled();
});

test('verified canonicalized details update the discovery card identity', async () => {
  const h = harness({ canonicalId: 'canonical', discoveryId: '42' }); h.open(); await flush();
  expect(h.deps.rememberDiscoveryBookId).toHaveBeenCalledWith({ id: 42, title: 'Dune', authors: ['Frank Herbert'] }, 'canonical');
  expect(h.state.setBook.id).toBe('canonical');
});
