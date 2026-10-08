const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
function harness(workDetails) {
  const storage=new Map(),calls=[];let catalog=null;
  const asyncStorage={
    getItem:async key=>storage.get(key)??null,
    removeItem:async key=>{storage.delete(key);},
    multiSet:async values=>{for(const [key,value] of values)storage.set(key,value);},
    multiRemove:async keys=>{for(const key of keys)storage.delete(key);},
  };
  const supabase={ functions:{invoke:async(name,{body})=>{
    calls.push({name,body});
    await new Promise(resolve=>setTimeout(resolve,5));
    return {data:{ok:true,status:200,data:name==='google-books-detail'?{id:body.volumeId,volumeInfo:{title:'Known',pageCount:100}}:{items:[{id:'a'}]},cache:{status:'miss'}}};
  }},from:()=>{
    const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:catalog}),upsert:async()=>({error:null})};return q;
  }};
  function load(){
    const exports={};const source=fs.readFileSync(path.join(__dirname,'../src/lib/google-books.ts'),'utf8');
    const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(compiled+";exports.cacheSizes=()=>[memoryCache.size,volumeMemoryCache.size];",{exports,URL,Date,Promise,console,__DEV__:false,require:name=>name.includes('book-work-details')?(workDetails?{bookWorkDetails:workDetails}:require('../src/lib/book-work-details')):name.includes('book-read-cache')?require('../src/lib/book-read-cache'):name.includes('book-edition-metadata')?require('../supabase/functions/_shared/book-edition-metadata'):name.startsWith('@react-native')?{__esModule:true,default:asyncStorage}:{supabase}});
    return exports;
  }
  return {storage,calls,load,setCatalog:value=>{catalog=value;}};
}
const detail=id=>'https://www.googleapis.com/books/v1/volumes/'+id;
const flush=()=>new Promise(resolve=>setTimeout(resolve,10));

test('concurrent equivalent detail URLs share one request and preserve every persistent index entry',async()=>{
  const h=harness(),api=h.load();
  await Promise.all([api.fetchGoogleBooksJson(detail('a')),api.fetchGoogleBooksJson(detail('a')+'?projection=full'),api.fetchGoogleBooksJson(detail('b'))]);
  await flush();
  expect(h.calls.length).toBe(2);
  expect(JSON.parse(h.storage.get('novori:google-books:detail-index:v5')).map(entry=>entry.id).sort()).toEqual(['a','b']);
});

test('device cache survives restart and reads never extend the original expiry',async()=>{
  const h=harness();
  const key='novori:google-books:detail:v5:a',savedAt=Date.now()-86400000;
  h.storage.set(key,JSON.stringify({id:'a',savedAt,data:{id:'a',volumeInfo:{title:'Saved'}}}));
  let api=h.load();expect((await api.fetchGoogleBooksJson(detail('a'))).fromCache).toBe(true);
  await api.fetchGoogleBooksJson(detail('a')+'?projection=full');await flush();
  expect(JSON.parse(h.storage.get(key)).savedAt).toBe(savedAt);expect(h.calls.length).toBe(0);
  h.storage.set(key,JSON.stringify({id:'a',savedAt:Date.now()-31*86400000,data:{id:'a'}}));
  api=h.load();await api.fetchGoogleBooksJson(detail('a'));expect(h.calls.length).toBe(1);
});

test('valid catalog details avoid API requests but expired or incomplete entries do not',async()=>{
  const h=harness();h.setCatalog({detail_complete:true,fetched_at:new Date().toISOString(),metadata:{id:'a',volumeInfo:{title:'Catalog'}}});
  expect((await h.load().fetchGoogleBooksJson(detail('a'))).fromCache).toBe(true);expect(h.calls.length).toBe(0);
  h.setCatalog({detail_complete:true,fetched_at:new Date(Date.now()-91*86400000).toISOString(),metadata:{id:'b'}});
  await h.load().fetchGoogleBooksJson(detail('b'));expect(h.calls.length).toBe(1);
  h.setCatalog({detail_complete:false,fetched_at:new Date().toISOString(),metadata:{id:'c'}});
  await h.load().fetchGoogleBooksJson(detail('c'));expect(h.calls.length).toBe(2);
});

test('query formatting shares a request and pagination is forwarded separately',async()=>{
  const h=harness(),api=h.load();
  await Promise.all([api.fetchGoogleBooksJson('https://www.googleapis.com/books/v1/volumes?q=Shared%20Title'),api.fetchGoogleBooksJson('https://www.googleapis.com/books/v1/volumes?q=shared%20%20title&maxResults=40')]);
  expect(h.calls.length).toBe(1);
  await api.fetchGoogleBooksJson('https://www.googleapis.com/books/v1/volumes?q=Shared%20Title&startIndex=40');
  expect(h.calls.length).toBe(2);expect(h.calls[1].body.startIndex).toBe(40);
});

test('corrupt or mismatched device entries cannot masquerade as cache hits',async()=>{
  for(const entry of [{id:'wrong',savedAt:Date.now(),data:{id:'wrong'}},{id:'a',data:{id:'a'}},{id:'a',savedAt:Date.now()+86400000,data:{id:'a'}}]){
    const h=harness();h.storage.set('novori:google-books:detail:v5:a',JSON.stringify(entry));
    await h.load().fetchGoogleBooksJson(detail('a'));expect(h.calls.length).toBe(1);
  }
});

test('old persistent editions pass through shared work metadata without new detail API calls or rewritten cover caches', async()=>{
 const {createBookWorkDetails}=require('../src/lib/book-work-details');
 const representative={id:'search',volumeInfo:{title:'Dune',authors:['Frank Herbert'],language:'en',pageCount:412,description:'Canonical description'}};
 const search=jest.fn(async()=>[representative]);
 const h=harness(createBookWorkDetails(search));
 for(const id of ['trending','library','series']) {
  h.storage.set('novori:google-books:detail:v5:'+id,JSON.stringify({id,savedAt:Date.now(),data:{id,volumeInfo:{title:'Dune',authors:['Frank Herbert'],language:'en',pageCount:600,imageLinks:{thumbnail:'https://covers/'+id}}}}));
 }
 const before=new Map(h.storage);
 const api=h.load();
 const results=await Promise.all(['trending','library','series'].map(id=>api.fetchGoogleBooksJson(detail(id))));
 expect(results.map(result=>result.data.volumeInfo.pageCount)).toEqual([600,600,600]);
 expect(results.map(result=>result.data.volumeInfo.imageLinks.thumbnail)).toEqual(['https://covers/trending','https://covers/library','https://covers/series']);
 expect(search).toHaveBeenCalledTimes(1);
 expect(h.calls).toHaveLength(0);
 expect(h.storage).toEqual(before);
});

test('cached-first details return while work enrichment is pending, without rewriting caches or repeating searches', async () => {
 const {createBookWorkDetails}=require('../src/lib/book-work-details');
 let finish;
 const search=jest.fn(() => new Promise(resolve => { finish=resolve; }));
 const h=harness(createBookWorkDetails(search));
 const edition={id:'saved',volumeInfo:{title:'Dune',authors:['Frank Herbert'],language:'en',pageCount:600,imageLinks:{thumbnail:'https://covers/saved'}}};
 h.storage.set('novori:google-books:detail:v5:saved',JSON.stringify({id:'saved',savedAt:Date.now(),data:edition}));
 const before=new Map(h.storage),onWorkDetails=jest.fn(),api=h.load();
 const first=await api.fetchGoogleBooksJson(detail('saved'),{cachedFirst:true,onWorkDetails});
 const second=await api.fetchGoogleBooksJson(detail('saved'),{cachedFirst:true});
 expect(first.data.volumeInfo.pageCount).toBe(600);
 expect(second.fromCache).toBe(true);
 expect(onWorkDetails).not.toHaveBeenCalled();
 expect(search).toHaveBeenCalledTimes(1);
 finish([{id:'representative',volumeInfo:{title:'Dune',authors:['Frank Herbert'],language:'en',pageCount:412}}]);
 await flush();
 expect(onWorkDetails.mock.calls[0][0].volumeInfo.pageCount).toBe(600);
 expect(onWorkDetails.mock.calls[0][0].volumeInfo.imageLinks).toEqual(edition.volumeInfo.imageLinks);
 const warm=await api.fetchGoogleBooksJson(detail('saved'),{cachedFirst:true});
 expect(warm.data.volumeInfo.pageCount).toBe(600);
 expect(search).toHaveBeenCalledTimes(1);
 expect(h.calls).toHaveLength(0);
 expect(h.storage).toEqual(before);
});

test('catalog cache carries original source age into device persistence',async()=>{
 const h=harness(),savedAt=Date.now()-29*86400000;
 h.setCatalog({detail_complete:true,fetched_at:new Date(savedAt).toISOString(),metadata:{id:'aged',volumeInfo:{title:'Source age',imageLinks:{thumbnail:'https://covers/original'}}}});
 await h.load().fetchGoogleBooksJson(detail('aged')); await flush();
 expect(JSON.parse(h.storage.get('novori:google-books:detail:v5:aged')).savedAt).toBe(savedAt);
 expect(h.calls).toHaveLength(0);
});
test('catalog and persistent fast paths cannot grow either raw memory map past capacity',async()=>{
 const h=harness(),api=h.load();
 for(let i=0;i<310;i++) {
  const id='bounded-'+i;
  h.setCatalog({detail_complete:true,fetched_at:new Date().toISOString(),metadata:{id,volumeInfo:{title:'Book '+i}}});
  await api.fetchGoogleBooksJson(detail(id));
 }
 expect(api.cacheSizes()).toEqual([300,300]);
 expect(h.calls).toHaveLength(0);
});
