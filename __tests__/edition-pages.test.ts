import {validPageCount,readEditionPages,samePageEdition,cacheSeriesEditionPages} from '../supabase/functions/_shared/edition-pages';
import {rememberEditionPages,applyEditionPages} from '../src/lib/edition-pages';
const book: any = {id:'print-id',source:{provider:'isbndb',isbn13:'9781496764751'},volumeInfo:{title:'A Fate So Dark and Delicate',authors:['Sophia St. Germain'],industryIdentifiers:[{type:'ISBN_13',identifier:'9781496764751'}]}};
function database(tables:Record<string,any[]>) {
 const admin = {from(table:string){ let rows=(tables[table] ?? []).slice(); const q:any={select(){return q;},eq(k:string,v:any){rows=rows.filter(row=>row[k]===v);return q;},in(k:string,v:any[]){rows=rows.filter(row=>v.includes(row[k]));return q;},gt(k:string,v:any){rows=rows.filter(row=>row[k]>v);return q;},upsert(input:any[]){tables[table]??=[];for(const row of input){const old=tables[table].find(item=>item.request_key===row.request_key);if(old)Object.assign(old,row);else tables[table].push(row);}return Promise.resolve({error:null});},then(resolve:any){return Promise.resolve({data:rows,error:null}).then(resolve);}};return q;}};return admin;
}
test('page parsing accepts integral numeric text but rejects missing, ranges, fractions and disc counts',()=>{
 expect(validPageCount(' 416 ')).toBe(416);
 for(const value of [null,'','0',0,-1,4.5,'320 pages','320-400','iv, 320',Infinity,100001])expect(validPageCount(value)).toBeUndefined();
});
test('same-ISBN page enrichment rejects other editions and wrong authors; preserves cover metadata',async()=>{
 const input={provider_book_id:book.id,metadata:book};
 const original=JSON.stringify(book);
 const admin=database({book_editions:[
  {provider:'isbndb',isbn_13:'9781496764751',metadata:{...book,volumeInfo:{...book.volumeInfo,pageCount:'416'}}},
  {provider:'isbndb',isbn_13:'9781496764898',metadata:{...book,source:{...book.source,isbn13:'9781496764898'},volumeInfo:{...book.volumeInfo,pageCount:999}}}
 ]});
 expect(await readEditionPages(admin,[input])).toEqual({'print-id':{isbn:'9781496764751',pageCount:416}});
 expect(JSON.stringify(book)).toBe(original);
 expect(samePageEdition(book,{...book,volumeInfo:{...book.volumeInfo,authors:['Other Author']}})).toBe(false);
});
test('cached Hardcover facts fill only matching editions and never replace a valid ISBNdb count',async()=>{
 const admin=database({book_api_cache:[{provider:'hardcover_series',request_key:'edition-pages:v1:9781496764751',stale_until:'2099-01-01',response_json:{...book,volumeInfo:{...book.volumeInfo,pageCount:432}}}]});
 expect((await readEditionPages(admin,[{provider_book_id:book.id,metadata:book}]))[book.id].pageCount).toBe(432);
 expect((await readEditionPages(admin,[{provider_book_id:book.id,metadata:{...book,volumeInfo:{...book.volumeInfo,pageCount:416}}}]))[book.id].pageCount).toBe(416);
 rememberEditionPages({[book.id]:{isbn:'9781496764751',pageCount:416}});
 expect(applyEditionPages(book).volumeInfo.pageCount).toBe(416);
 expect(applyEditionPages({...book,source:{provider:'isbndb',isbn13:'9781496764898'}}).volumeInfo.pageCount).toBeUndefined();
});
test('series page index excludes audio and unrelated edition titles, and does not renew source expiry',async()=>{
 const tables:any={};const admin=database(tables);const expiry=Date.now()+86400000;
 const edition={isbn_13:'9781496764751',title:book.volumeInfo.title,pages:416,reading_format:{format:'physical'},language:{code2:'en'}};
 const works=[{title:book.volumeInfo.title,contributions:[{author:{name:'Sophia St. Germain'}}],editions:[edition,{...edition,isbn_13:'9781496764898',reading_format:{format:'audio'}}]}];
 await cacheSeriesEditionPages(admin,works,expiry);
 expect(tables.book_api_cache).toHaveLength(1);
 expect(tables.book_api_cache[0].expires_at).toBe(new Date(expiry).toISOString());
 await cacheSeriesEditionPages(admin,works,expiry);
 expect(tables.book_api_cache).toHaveLength(1);
});

test('legacy metadata without identifiers reuses the exact stored ISBN and generic numeric page counts',async()=>{
 const legacy={...book,id:'legacy-id',source:undefined,volumeInfo:{title:book.volumeInfo.title,authors:book.volumeInfo.authors}};
 const admin=database({book_edition_page_facts:[{isbn_13:'9781496764751',title:book.volumeInfo.title,authors:book.volumeInfo.authors,page_count:480}]});
 expect(await readEditionPages(admin,[{provider_book_id:legacy.id,isbn_13:'9781496764751',metadata:legacy}])).toEqual({'legacy-id':{isbn:'9781496764751',pageCount:480}});
 expect(legacy.volumeInfo).not.toHaveProperty('industryIdentifiers');
});
