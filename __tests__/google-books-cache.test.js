const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
function harness() {
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
    vm.runInNewContext(compiled,{exports,URL,Date,Promise,console,__DEV__:false,require:name=>name.startsWith('@react-native')?{__esModule:true,default:asyncStorage}:{supabase}});
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
  expect(JSON.parse(h.storage.get('novori:google-books:detail-index:v3')).map(entry=>entry.id).sort()).toEqual(['a','b']);
});

test('device cache survives restart and reads never extend the original expiry',async()=>{
  const h=harness();
  const key='novori:google-books:detail:v3:a',savedAt=Date.now()-86400000;
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
    const h=harness();h.storage.set('novori:google-books:detail:v3:a',JSON.stringify(entry));
    await h.load().fetchGoogleBooksJson(detail('a'));expect(h.calls.length).toBe(1);
  }
});
