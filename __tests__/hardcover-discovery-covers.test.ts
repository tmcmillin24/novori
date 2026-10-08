import { readEditionCovers } from '../supabase/functions/_shared/edition-cover-catalog';
import { verifiedHardcoverDiscoveryChoice } from '../supabase/functions/_shared/hardcover-discovery-covers';
const title='A Novel',url='https://assets.hardcover.app/primary.jpg';
const seed={id:'edition-a',provider:'isbndb',provider_book_id:'nv_a',work_id:'work',isbn_13:'9781234567897',language:'en',metadata:{volumeInfo:{title,authors:['Writer'],language:'en',imageLinks:{medium:'https://images.isbndb.com/1998.jpg'}}}};
const proof={version:1,editionId:77,title,language:'en',isbn:'9781234567897',url,format:'Physical Book',nonAudio:true};
const feedBook={id:42,title,authors:['Writer'],isbns:[proof.isbn],coverUrl:url,coverEdition:proof,formatPolicyVersion:1,genres:['Fantasy','Fängelser'],usersCount:1000,reviewsCount:50};
function harness(){
 const tables: Record<string,any[]>={book_editions:[seed,{...seed,id:'edition-b',provider_book_id:'nv_b',isbn_13:'9781234567880'}],book_works:[{id:'work',normalized_title:'a novel'}],book_cover_candidates:[],book_cover_selections:[],novori_discover_cache:[{cache_key:'hardcover-trending:v7:90:100',refreshed_at:new Date().toISOString(),payload:{books:[feedBook]}}]};
 const writes=jest.fn();
 const admin:any={from(table:string){
  let rows=[...(tables[table]??[])];
  const q:any={select:()=>q,order:()=>q,range:(a:number,b:number)=>{rows=rows.slice(a,b+1);return q;},eq:(key:string,value:any)=>{rows=rows.filter(row=>row[key]===value);return q;},in:(key:string,values:any[])=>{rows=rows.filter(row=>values.includes(row[key]));return q;},
   upsert:async(records:any)=>{writes(records);for(const row of records){const old=tables[table].find(old=>old.candidate_key===row.candidate_key);if(old)Object.assign(old,row);else tables[table].push({...row,id:'candidate'});}return{error:null};},
   then:(resolve:any)=>Promise.resolve({data:rows,error:null}).then(resolve)};return q;
 }};return{admin,tables,writes};
}
test('a cold catalog identity adopts cached Hardcover cover without an upstream call and shares verified aliases',async()=>{
 const h=harness();
 const first=(await readEditionCovers(h.admin,[seed])).get('nv_a')![0];
 expect(first).toMatchObject({url,provider:'hardcover',workId:'hardcover:42',genres:['Fantasy'],reviewsCount:50,aliases:['nv_a','nv_b']});
 expect(h.writes).toHaveBeenCalledTimes(1);
 // JSONB key ordering must not cause writes on every cached cover read.
 const candidate=h.tables.book_cover_candidates[0];candidate.source_metadata=Object.fromEntries(Object.entries(candidate.source_metadata).reverse());
 const second=(await readEditionCovers(h.admin,[h.tables.book_editions[1]])).get('nv_b')![0];
 expect(second.url).toBe(url);expect(h.writes).toHaveBeenCalledTimes(1);
 h.tables.novori_discover_cache=[];
 expect((await readEditionCovers(h.admin,[seed])).get('nv_a')![0].url).toBe(url);
});
test('incorrect language, authors, adaptation titles, format proofs and temporary links never become canonical',()=>{
 const base={provider:'hardcover',source_variant:'discovery_verified_v1',url,source_metadata:{hardcoverBookId:42,title,authors:['Writer'],coverEdition:proof}};
 for(const bad of [{...base,source_metadata:{...base.source_metadata,authors:['Wrong Writer']}},{...base,source_metadata:{...base.source_metadata,title:'A Novel: Graphic Novel'}},{...base,source_metadata:{...base.source_metadata,coverEdition:{...proof,language:'es'}}},{...base,source_metadata:{...base.source_metadata,coverEdition:{...proof,nonAudio:false}}},{...base,url:url+'?Expires=123',source_metadata:{...base.source_metadata,coverEdition:{...proof,url:url+'?Expires=123'}}}])
  expect(verifiedHardcoverDiscoveryChoice(seed,bad)).toBeNull();
});
