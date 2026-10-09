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

test('series artwork ID cannot bypass the shared reading-edition result',async()=>{
 const h=harness([novel]);
 const result=await h.resolve({...row,coverBookId:'nv_9781496764898'});
 expect(result).toEqual(novel);
 expect(h.deps.searchNovoriBooks).toHaveBeenCalledWith(row.title);
 expect(h.deps.fetchGoogleBooksJson).not.toHaveBeenCalled();
 expect(h.deps.resolveGoogleBooksIdentity).not.toHaveBeenCalled();
});

test.each([
 ['A Fate So Dark and Delicate','Sophia St. Germain'],
 ['Catching Fire','Suzanne Collins'],
 ['The Cruel Prince','Holly Black'],
 ['Platform Decay','Martha Wells'],
])('series opens Discover representative for %s regardless of artwork ID or Hardcover ISBN order',async(title,author)=>{
 const selected={id:'discover-reading-edition',source:{isbn13:'9781496764751'},volumeInfo:{title,authors:[author],language:'en',pageCount:480}};
 const artwork={...selected,id:'artwork-edition',source:{isbn13:'9781496764898'},volumeInfo:{...selected.volumeInfo,pageCount:undefined,imageLinks:{thumbnail:'https://art/good.jpg'},industryIdentifiers:[{identifier:'9781496764898'}]}};
 const h=harness([selected,artwork]);
 const series={title,authors:[author],isbns:['9781496764898'],coverBookId:artwork.id,coverUrl:'https://art/good.jpg'};
 expect(await h.resolve(series)).toEqual(selected);
 expect(h.deps.searchNovoriBooks).toHaveBeenCalledTimes(1);
 expect(series.coverUrl).toBe('https://art/good.jpg');
});
