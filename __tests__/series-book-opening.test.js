const { resolveSeriesOpening } = require('../src/lib/series-book-opening');
function harness(results) {
 const searchNovoriBooks = jest.fn(async () => results);
 return { resolve: (row,seriesName='') => resolveSeriesOpening(row,seriesName,searchNovoriBooks), deps:{searchNovoriBooks} };
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
});

test('series ISBN fallback remains on shared search and never opens raw provider identity/detail results',async()=>{
 const h=harness([]);
 h.deps.searchNovoriBooks.mockImplementation(async query=>query==='isbn:'+row.isbns[0]?[novel]:[]);
 expect((await h.resolve(row)).id).toBe('novel');
 expect(h.deps.searchNovoriBooks.mock.calls.map(call=>call[0])).toEqual([row.title,`${row.title} Matt Dinniman`,'isbn:'+row.isbns[0]]);
});

test('series artwork ID cannot bypass the shared reading-edition result',async()=>{
 const h=harness([novel]);
 const result=await h.resolve({...row,coverBookId:'nv_9781496764898'});
 expect(result).toEqual(novel);
 expect(h.deps.searchNovoriBooks).toHaveBeenCalledWith(row.title, 0, expect.objectContaining({onProgress:expect.any(Function)}));
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


test('series navigation uses verified progressive rows without waiting for ratings enrichment',async()=>{
 const h=harness([]);
 h.deps.searchNovoriBooks.mockImplementation((_query,_offset,options)=>{
   options.onProgress([novel]);
   return new Promise(()=>{});
 });
 expect(await h.resolve(row)).toEqual(novel);
 expect(h.deps.searchNovoriBooks).toHaveBeenCalledTimes(1);
});

test('ISBNdb may omit language; an exact ISBN from the English series edition can verify it',async()=>{
 const record={...novel,source:{isbn13:row.isbns[0]},volumeInfo:{...novel.volumeInfo,language:undefined,industryIdentifiers:[]}};
 const h=harness([record]);expect(await h.resolve(row)).toEqual(record);
});

test('English ISBN proof cannot override an explicit translation, audiobook, or different work',async()=>{
 const languageMissing={...novel,volumeInfo:{...novel.volumeInfo,language:undefined,industryIdentifiers:[]}};
 const spanish={...novel,volumeInfo:{...novel.volumeInfo,language:'es'}};
 const audiobook={...novel,novoriEdition:{format:'audio'}};
 const tieIn={...novel,volumeInfo:{...novel.volumeInfo,subtitle:'Study Guide'}};
 expect(await harness([languageMissing,spanish,audiobook,tieIn]).resolve(row)).toBeNull();
});

test('tries another verified English ISBN when the first printing is missing from the catalog',async()=>{
 const oldIsbn='9781250214713', newIsbn='9781250310620';
 const member={title:'The Lantern Below',authors:['Lena Stone'],isbns:[oldIsbn,newIsbn]};
 const book={id:'second-printing',source:{isbn13:newIsbn},volumeInfo:{title:member.title,authors:member.authors,language:'en'}};
 const h=harness([]);
 h.deps.searchNovoriBooks.mockImplementation(async(query,_offset,{onProgress})=>{
   if(query!==`isbn:${newIsbn}`) return [];
   onProgress([book]);
   return new Promise(()=>{});
 });
 expect(await h.resolve(member)).toEqual(book);
 expect(h.deps.searchNovoriBooks.mock.calls.map(([query])=>query)).toContain(`isbn:${oldIsbn}`);
});

test('verified series-name suffix and catalog author order can differ',async()=>{
 const record={id:'printing',volumeInfo:{title:'The Lantern Below (Lantern Archives, Book 2)',authors:['Stone, Lena'],language:'en'}};
 expect(await harness([record]).resolve({title:'Lantern Below',authors:['Lena Stone']},'Lantern Archives')).toEqual(record);
});

test('ISBN-10 is equivalent to the same English ISBN-13 but is searched only once',async()=>{
 const short='0593820282', long=row.isbns[0];
 const record={...novel,volumeInfo:{...novel.volumeInfo,language:'und',industryIdentifiers:[{identifier:short}]}};
 const h=harness([]);h.deps.searchNovoriBooks.mockImplementation(async query=>query===`isbn:${long}`?[record]:[]);
 expect(await h.resolve({...row,isbns:[short,long]})).toEqual(record);
 expect(h.deps.searchNovoriBooks.mock.calls.filter(([query])=>query.startsWith('isbn:'))).toHaveLength(1);
});

test('a preliminary near match does not end the search before the verified edition arrives',async()=>{
 const search=jest.fn(async(_query,_offset,{onProgress})=>{
   onProgress([{...novel,volumeInfo:{...novel.volumeInfo,authors:['Wrong Author']}}]);
   return [novel];
 });
 const resolveEdition=jest.fn(async()=>null);
 expect(await resolveSeriesOpening(row,'',search,resolveEdition)).toEqual(novel);
 expect(resolveEdition).not.toHaveBeenCalled();
});

test('a series tap falls back to the direct endpoint without waiting on a slow Discover search',async()=>{
 const routed={...novel,id:'nv_series_edition'};
 const search=jest.fn(()=>new Promise(()=>{}));
 const resolveEdition=jest.fn(async()=>routed);
 expect(await resolveSeriesOpening(row,'',search,resolveEdition)).toEqual(routed);
 expect(search).toHaveBeenCalledTimes(1);
 expect(resolveEdition).toHaveBeenCalledTimes(1);
});

test('provider failures surface as retryable and do not masquerade as no verified book',async()=>{
 const search=jest.fn(async()=>[]);
 await expect(resolveSeriesOpening(row,'',search,async()=>{throw Error('temporarily offline');}))
   .rejects.toThrow('lookup unavailable');
});
