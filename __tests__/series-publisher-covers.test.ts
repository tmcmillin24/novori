import fixture from './fixtures/compelling-fates-editions.json';
import { seriesPublisherCandidates, publisherKey } from '../supabase/functions/_shared/series-publisher-covers';
import { editionCoverChoices } from '../supabase/functions/_shared/edition-cover-catalog';
const expected = ['9781496764720','9781496764737','9781496764744','9781496764751'];

test('exported series selects the confirmed publisher paperback family independent of row order',()=>{
 for (const editions of [fixture.editions,[...fixture.editions].reverse()]) {
  const candidates=seriesPublisherCandidates(editions,fixture.books,146527);
  for (let index=0;index<fixture.books.length;index++) {
   const book=fixture.books[index];
   const seed=editions.find(row=>row.metadata.volumeInfo.title.toLowerCase()===book.title.toLowerCase())!;
   expect(editionCoverChoices(seed,editions,undefined,[],candidates)[0].bookId).toBe(`nv_${expected[index]}`);
  }
 }
});
test('a persisted family choice works from an unrelated edition ID and preserves manual and feed artwork',()=>{
 const candidates=seriesPublisherCandidates(fixture.editions,fixture.books,146527);
 const seed=fixture.editions.find(row=>row.isbn_13==='9789199004150')!;
 const chosen=editionCoverChoices(seed,fixture.editions,undefined,[],candidates)[0];
 expect(chosen).toMatchObject({provider:'isbndb',bookId:'nv_9781496764744'});
 expect(chosen.aliases).toContain(seed.provider_book_id);
 expect(editionCoverChoices(seed,fixture.editions,{url:'https://art/manual.jpg',provider:'manual'},[],candidates)[0].locked).toBe(true);
 const url='https://assets.hardcover.app/feed.jpg';
 const feed={provider:'hardcover',source_variant:'discovery_verified_v1',url,source_metadata:{hardcoverBookId:1879294,title:fixture.books[2].title,authors:fixture.books[2].authors,coverProof:{version:2,source:'hardcover_work_image',hardcoverBookId:1879294,title:fixture.books[2].title,url}}};
 expect(editionCoverChoices(seed,fixture.editions,undefined,[feed],candidates)[0].url).toBe(url);
});
test('unanchored series and foreign or wrong-author editions cannot establish a publisher preference',()=>{
 expect(seriesPublisherCandidates(fixture.editions,[fixture.books[2]],146527)).toEqual([]);
 expect(seriesPublisherCandidates(fixture.editions,fixture.books.map(book=>({...book,authors:['Someone Else']})),146527)).toEqual([]);
 expect(seriesPublisherCandidates(fixture.editions.map(row=>({...row,metadata:{...row.metadata,volumeInfo:{...row.metadata.volumeInfo,language:'es'}}})),fixture.books,146527)).toEqual([]);
 expect(publisherKey('Kensington Replenishment Titles (KRT)')).toBe(publisherKey('Kensington Publishing Corp'));
});

import { attachDiscoveryCatalogCovers } from '../supabase/functions/_shared/discovery-cover-catalog';
import { readEditionCovers } from '../supabase/functions/_shared/edition-cover-catalog';
function harness() {
 const normalized=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const tables:Record<string,any[]>={book_editions:[...fixture.editions],book_works:fixture.editions.map(row=>({id:row.work_id,normalized_title:normalized(row.metadata.volumeInfo.title)})),book_cover_candidates:[],book_cover_selections:[],novori_discover_cache:[]};
 const writes=jest.fn();
 const admin:any={from(table:string){let rows=[...(tables[table]??[])];const q:any={select:()=>q,order:()=>q,
 range:(start:number,end:number)=>{rows=rows.slice(start,end+1);return q;},
 in:(key:string,values:any[])=>{rows=rows.filter(row=>values.includes(row[key]));return q;},
 eq:(key:string,value:any)=>{rows=rows.filter(row=>row[key]===value);return q;},
 upsert:async(records:any[])=>{writes(records);for(const record of records){const old=tables[table].find(row=>row.candidate_key===record.candidate_key);if(old)Object.assign(old,record);else tables[table].push(record);}return {error:null};},
 then:(resolve:any)=>Promise.resolve({data:rows,error:null}).then(resolve)};return q;}};
 return {admin,tables,writes};
}
test('actual series catalog overlay persists family choices for app-wide reads and avoids repeat writes',async()=>{
 const h=harness(),payload={series:{id:146527,name:'The Compelling Fates Saga'},books:fixture.books};
 const response=await attachDiscoveryCatalogCovers(h.admin,payload);
 expect(response.books.map((book:any)=>book.coverBookId)).toEqual(expected.map(isbn=>`nv_${isbn}`));
 expect(h.writes).toHaveBeenCalledTimes(1);
 await attachDiscoveryCatalogCovers(h.admin,payload);
 expect(h.writes).toHaveBeenCalledTimes(1);
 for(let index=1;index<fixture.books.length;index++){
  const book=fixture.books[index];
  const seed=fixture.editions.find(row=>row.metadata.volumeInfo.title.toLowerCase()===book.title.toLowerCase())!;
  expect((await readEditionCovers(h.admin,[seed])).get(seed.provider_book_id)![0].bookId).toBe(`nv_${expected[index]}`);
 }
});

test('missing publisher edition preserves the ordinary cover path instead of forcing another book',()=>{
 const editions=fixture.editions.filter(row=>row.isbn_13!=='9781496764744');
 const candidates=seriesPublisherCandidates(editions,fixture.books,146527);
 const seed=editions.find(row=>row.isbn_13==='9789199004150')!;
 expect(candidates.some(row=>row.source_metadata.title===fixture.books[2].title)).toBe(false);
 expect(editionCoverChoices(seed,editions,undefined,[],candidates)[0].bookId).toBe(seed.provider_book_id);
});
