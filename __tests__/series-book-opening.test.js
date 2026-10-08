const fs = require('fs'), path = require('path'), vm = require('vm'), ts = require('typescript');
const { matchesSeriesCatalogEdition } = require('../supabase/functions/_shared/series-book-catalog');
const { cleanCatalogBookTitle } = require('../supabase/functions/_shared/book-edition-metadata');
const source = fs.readFileSync(path.join(__dirname, '../src/app/book/[id]/index.tsx'), 'utf8');
function harness(results) {
 const start = source.indexOf('  async function findGoogleBookForSeries(');
 const end = source.indexOf('  async function saveReadingStatus(', start);
 const compiled = ts.transpileModule(source.slice(start, end) + '\nexports.resolve = findGoogleBookForSeries;', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
 const exports = {};
 const deps = {
  exports, matchesSeriesCatalogEdition, normalizeSeriesWorkTitle: title => cleanCatalogBookTitle(title ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''),
  normalizeAuthorName: name => (name ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''),
  getValidatedHighResolutionCover: (_, links) => links?.thumbnail,
  searchNovoriBooks: jest.fn(async () => results),
  resolveGoogleBooksIdentity: jest.fn(async () => ({ ok: true, status: 200, googleBookId: 'isbn-candidate' })),
  fetchGoogleBooksJson: jest.fn(async url => url.includes('/isbn-candidate') ? { ok: true, data: results[0] } : { ok: true, data: { items: results } }),
 };
 vm.runInNewContext(compiled, deps);
 return { resolve: exports.resolve, deps };
}
const row = { title: "The Dungeon Anarchist's Cookbook", authors: ['Matt Dinniman'], isbns: ['9780593820285'] };
const novel = { id: 'novel', volumeInfo: { title: "The Dungeon Anarchist's Cookbook (Dungeon Crawler Carl, 3)", authors: ['Matt Dinniman'], language: 'en', pageCount: 500, imageLinks: { thumbnail: 'https://novel/art' }, industryIdentifiers: [{ identifier: row.isbns[0] }] } };
test('series opening rejects an unrelated cookbook even with a matching listed ISBN and usable art/pages', async () => {
 const h = harness([{ ...novel, id: 'cookbook', volumeInfo: { ...novel.volumeInfo, title: "The Dungeon Anarchist's Cookbook Companion", authors: ['Other Author'] } }]);
 expect(await h.resolve(row)).toBeNull();
});
test('series opening keeps the verified novel ahead of wrong prefix candidates without a provider identity lookup', async () => {
 const h = harness([{ ...novel, id: 'wrong', volumeInfo: { ...novel.volumeInfo, title: "The Dungeon Anarchist's Cookbook Recipes" } }, novel]);
 expect((await h.resolve(row)).id).toBe('novel');
 expect(h.deps.resolveGoogleBooksIdentity).not.toHaveBeenCalled();
});

test('series ISBN fallback remains on shared search and never opens raw provider identity/detail results',async()=>{
 const h=harness([]);
 h.deps.searchNovoriBooks.mockImplementation(async query=>query==='isbn:'+row.isbns[0]?[novel]:[]);
 expect((await h.resolve(row)).id).toBe('novel');
 expect(h.deps.searchNovoriBooks.mock.calls.map(call=>call[0])).toEqual([row.title,'isbn:'+row.isbns[0]]);
 expect(h.deps.resolveGoogleBooksIdentity).not.toHaveBeenCalled();expect(h.deps.fetchGoogleBooksJson).not.toHaveBeenCalled();
});
