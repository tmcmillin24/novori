import { findSeriesBookByTitle, preferredSeriesWork, seriesResultLifetime, verifiedPreferredSeriesRows, verifiedSeriesMembership } from '../supabase/functions/_shared/series-lookup';

const series = {id:72,name:'Harbor Mysteries'};
const wanted = {title:'The Bell at Low Tide',authors:['Mara Flores']};
const book = (id: number, title: string, name = 'Mara Flores') => ({
  id,title,contributions:[{author:{name}}],book_series:[{position:2,series}],
});

test('recovers a sparsely indexed series book by title without accepting a same-title book by a different author',async()=>{
  const duplicate={...book(1,'The Bell at Low Tide'),book_series:[]};
  const member=book(2,'Bell at Low Tide (Harbor Mysteries, Book 2)','Flores, Mara');
  const search=jest.fn(async(query: string)=> query.includes('Mara Flores')
    ? [{id:1,title:wanted.title,author_names:wanted.authors}]
    : [{id:2,title:member.title,author_names:['Flores, Mara']},{id:3,title:wanted.title,author_names:['Someone Else']}]);
  const byIds=jest.fn(async(ids:number[])=>ids.includes(1)?[duplicate]:[member]);
  const byExactTitle=jest.fn(async()=>[]);
  expect(await findSeriesBookByTitle(wanted,{search,byIds,byExactTitle})).toEqual(member);
  expect(byIds.mock.calls).toEqual([[[1]],[[2]]]);
  expect(byExactTitle).not.toHaveBeenCalled();
});

test('checks the source catalog when text search misses and requires matching title and author',async()=>{
  const member=book(4,'Bell at Low Tide');
  const search=jest.fn(async()=>[]);
  const byExactTitle=jest.fn(async(_titles: string[])=>[book(3,wanted.title,'Another writer'),member]);
  expect(await findSeriesBookByTitle(wanted,{search,byIds:async()=>[],byExactTitle})).toEqual(member);
  expect(byExactTitle).toHaveBeenCalledWith(['The Bell at Low Tide','Bell at Low Tide']);
});

test('a provider failure with no successful match remains a failure, not a cached miss',async()=>{
  const offline=new Error('Provider unavailable');
  await expect(findSeriesBookByTitle(wanted,{search:async()=>{throw offline;},byIds:async()=>[],byExactTitle:async()=>[]})).rejects.toThrow(offline);
  expect(seriesResultLifetime(false)).toEqual({freshMs:3600000,staleMs:3600000});
  expect(seriesResultLifetime(true).freshMs).toBeGreaterThan(seriesResultLifetime(false).freshMs);
});

test('exact edition matching tolerates a missing author or a publisher subtitle, but rejects conflicts and compilations',()=>{
  expect(verifiedSeriesMembership(book(1,wanted.title),{title:wanted.title,authors:[]},true)?.position).toBe(2);
  expect(verifiedSeriesMembership(book(1,wanted.title),{...wanted,title:'The Bell at Low Tide: A harbor mystery'},true)?.position).toBe(2);
  expect(verifiedSeriesMembership(book(1,wanted.title,'Wrong Author'),wanted,true)).toBeUndefined();
  expect(verifiedSeriesMembership(book(1,'The Bell at High Tide'),wanted,true)).toBeUndefined();
  expect(verifiedSeriesMembership({...book(1,wanted.title),compilation:true},wanted,true)).toBeUndefined();
});

test('the Original Trilogy retains its three novels and two supplemental works', () => {
  const sanderson = ['Brandon Sanderson'];
  const preferred = preferredSeriesWork({title: 'The Final Empire', authors: sanderson});
  const titles = ['Mistborn: The Final Empire', 'The Eleventh Metal', 'The Well of Ascension', 'The Hero of Ages', 'Mistborn: Secret History'];
  const rows = titles.map((title, index) => ({book: book(index + 1, title, sanderson[0])}));
  const candidates = [...rows, {book: book(20, 'The Lost Metal', sanderson[0])},
    {book: {...book(21, 'Mistborn', sanderson[0]), compilation: true}},
    {book: book(22, 'The Final Empire', 'Someone Else')}];

  expect(preferred).toEqual({slug: 'the-mistborn-saga-the-original-trilogy', position: 1});
  expect(verifiedPreferredSeriesRows(candidates, preferred!.slug).map(({position, book}) => [position, book.title]))
    .toEqual(titles.map((title, index) => [[1, 1.5, 2, 3, 3.5][index], title]));
  expect(preferredSeriesWork({title: 'Mistborn: The Final Empire', authors: ['Someone Else']})).toBeUndefined();
  expect(preferredSeriesWork({title: 'Mistborn: The Final Empire Graphic Novel', authors: sanderson})).toBeUndefined();
});
