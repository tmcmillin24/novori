const { resolveSeriesOpening } = require('../src/lib/series-book-opening');
function harness(results) {
 const peekSearch = jest.fn(() => results);
 const resolveEdition = jest.fn(async () => null);
 return { resolve: (row,seriesName='') => resolveSeriesOpening(row,seriesName,peekSearch,resolveEdition), deps:{peekSearch,resolveEdition} };
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



test('series artwork ID cannot bypass the shared reading-edition result',async()=>{
 const h=harness([novel]);
 const result=await h.resolve({...row,coverBookId:'nv_9781496764898'});
 expect(result).toEqual(novel);
 expect(h.deps.peekSearch).toHaveBeenCalledWith(row.title);
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
 expect(h.deps.peekSearch).toHaveBeenCalledTimes(1);
 expect(series.coverUrl).toBe('https://art/good.jpg');
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



test('verified series-name suffix and catalog author order can differ',async()=>{
 const record={id:'printing',volumeInfo:{title:'The Lantern Below (Lantern Archives, Book 2)',authors:['Stone, Lena'],language:'en'}};
 expect(await harness([record]).resolve({title:'Lantern Below',authors:['Lena Stone']},'Lantern Archives')).toEqual(record);
});

test('ISBN-10 is equivalent to the same English ISBN-13 in the cached result',async()=>{
 const short='0593820282', long=row.isbns[0];
 const record={...novel,volumeInfo:{...novel.volumeInfo,language:'und',industryIdentifiers:[{identifier:short}]}};
 const h=harness([record]);
 expect(await h.resolve({...row,isbns:[short,long]})).toEqual(record);
 expect(h.deps.resolveEdition).not.toHaveBeenCalled();
});








test('a cold tap starts the backend lookup right away without starting a Discover search',async()=>{
 const h=harness(undefined);
 h.deps.resolveEdition.mockResolvedValue(novel);
 const pending=h.resolve(row);
 expect(h.deps.peekSearch).toHaveBeenCalledWith(row.title);
 expect(h.deps.resolveEdition).toHaveBeenCalledTimes(1);
 expect(await pending).toEqual(novel);
});

test('an unverified cached hit falls through and backend failure remains retryable',async()=>{
 const h=harness([{...novel, volumeInfo:{...novel.volumeInfo,language:'es'}}]);
 h.deps.resolveEdition.mockRejectedValue(Error('temporarily offline'));
 await expect(h.resolve(row)).rejects.toThrow('temporarily offline');
});
