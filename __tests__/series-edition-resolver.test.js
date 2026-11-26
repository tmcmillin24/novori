const {resolveSeriesEdition} = require('../supabase/functions/_shared/series-edition-resolver');
const series = {id:36,name:'Mapmakers'};
const hardcover = {
 id:17,title:'Winter Charts',contributions:[{author:{name:'Lena Grant'}}],
 book_series:[{series}],
};
const first='9781250214713', second='9781250310620';
const edition=(isbn,language='English',overrides={})=>({
 id:`nv_${isbn}`,source:{provider:'isbndb',isbn13:isbn},
 volumeInfo:{title:hardcover.title,authors:['Grant, Lena'],language,...overrides},
});
const sources=(options={})=>({
 catalog:jest.fn(async()=>[]),byIsbn:jest.fn(async()=>null),byTitle:jest.fn(async()=>[]),...options,
});

test('looks up an untagged Hardcover ISBN; ISBNdb independently verifies it as English',async()=>{
 const found=edition(second);
 const deps=sources({byIsbn:jest.fn(async isbn=>isbn===second ? found : null)});
 const book={...hardcover,editions:[
  {isbn_13:first,language:{code3:'eng'}},
  {isbn_10:'1250310628'},
 ]};
 expect(await resolveSeriesEdition(book,series.id,deps)).toEqual(found);
 expect(deps.byIsbn).toHaveBeenCalledWith(second);
});

test('an exact cached ISBNdb printing can borrow explicit English proof from Hardcover',async()=>{
 const found=edition(first,'und');
 const deps=sources({catalog:jest.fn(async()=>[found])});
 expect(await resolveSeriesEdition({
  ...hardcover,editions:[{isbn_13:first,language:{code3:'eng'}}],
 },series.id,deps)).toEqual(found);
 expect(deps.byTitle).not.toHaveBeenCalled();
 expect(deps.byIsbn).not.toHaveBeenCalled();
});

test('falls back to matching separate ISBNdb editions by title and author, without any ISBN on Hardcover',async()=>{
 const expected=edition(first,'en',{title:'Winter Charts (Mapmakers, Book 2)'});
 const deps=sources({byTitle:jest.fn(async()=>[
  edition(second,'es'),edition(second,'en',{authors:['Another Reader']}),expected,
 ])});
 expect(await resolveSeriesEdition(hardcover,series.id,deps)).toEqual(expected);
 expect(deps.byTitle).toHaveBeenCalledWith('Winter Charts Lena Grant');
});

test.each([
 ['a translation', edition(first,'spa')],
 ['language missing on both providers',edition(first,'und')],
 ['an audiobook',{...edition(first),novoriEdition:{format:'audio'}}],
 ['a bundle',edition(first,'en',{subtitle:'Books 1–3'})],
 ['a different work',edition(first,'en',{title:'Spring Charts'})],
 ['a different author',edition(first,'en',{authors:['Another Reader']})],
 ['a mismatched ISBN',edition(second)],
])('does not use %s returned from the exact ISBN lookup',async(_name,found)=>{
 const deps=sources({byIsbn:jest.fn(async()=>found)});
 expect(await resolveSeriesEdition({...hardcover,editions:[{isbn_13:first}]},series.id,deps)).toBeNull();
});

test('does not make ISBNdb requests for a book outside the requested series',async()=>{
 const deps=sources();
 expect(await resolveSeriesEdition(hardcover,404,deps)).toBeNull();
 expect(deps.byTitle).not.toHaveBeenCalled();
 expect(deps.byIsbn).not.toHaveBeenCalled();
});

test('a conflicting ISBNdb translation cannot be saved as a Hardcover edition',async()=>{
 const persistHardcoverEdition=jest.fn(async book=>book);
 const deps=sources({byIsbn:jest.fn(async()=>edition(first,'es')),persistHardcoverEdition});
 expect(await resolveSeriesEdition({...hardcover,editions:[
  {title:hardcover.title,isbn_13:first,language:{code2:'en'},physical_format:'Paperback'},
 ]},series.id,deps)).toBeNull();
 expect(persistHardcoverEdition).not.toHaveBeenCalled();
});

test('ISBNs on audiobooks or untagged works cannot produce a library edition when ISBNdb misses',async()=>{
 const persistHardcoverEdition=jest.fn(async book=>book);
 const deps=sources({persistHardcoverEdition});
 expect(await resolveSeriesEdition({...hardcover,editions:[
  {title:hardcover.title,isbn_13:first,language:{code2:'en'},physical_format:'Audiobook'},
  {title:hardcover.title,isbn_13:second,physical_format:'Paperback'},
 ]},series.id,deps)).toBeNull();
 expect(persistHardcoverEdition).not.toHaveBeenCalled();
});
