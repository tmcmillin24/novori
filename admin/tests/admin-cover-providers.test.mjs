import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({entryPoints:[new URL('../../supabase/functions/_shared/admin-cover-providers.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm',plugins:[{
 name:'provider-test-adapters',setup(builder){
  builder.onResolve({filter:/provider-cache\.ts$|provider-observability\.ts$/},args=>({path:args.path,namespace:'mock'}));
  builder.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path.includes('provider-cache')?
   'export const cachedProviderValue=(...a)=>globalThis.__coverAdapters.cache(...a);export const cachedHardcoverFetch=(...a)=>globalThis.__coverAdapters.hardcover(...a);export const fetchJsonWithTimeout=(...a)=>globalThis.__coverAdapters.fetch(...a);':
   'export const finishProviderAttempt=(...a)=>globalThis.__coverAdapters.finish(...a);export const noteProviderUpstream=(...a)=>globalThis.__coverAdapters.upstream(...a);',loader:'js'}));
 }
}]});
const {findAdminBookCovers}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const snapshot={editions:[{metadata:{volumeInfo:{title:'Book',authors:['Writer']}}}]};
test('provider previews use cache and quota tracking, preserve edition labels and do not ingest catalog data',async()=>{
 const old=globalThis.Deno;globalThis.Deno={env:{get:()=> 'test-key'}};
 const calls=[];
 globalThis.__coverAdapters={
  cache:async options=>{calls.push(['cache',options.provider,options.key]);return options.load();},
  hardcover:async()=>new Response(JSON.stringify({data:{search:{results:{hits:[{document:{title:'Book',author_names:['Writer'],image:{url:'https://assets.hardcover.app/good.jpg'}}}]}}}})),
  fetch:async()=>new Response(JSON.stringify({books:[{title:'Book',isbn13:'9780008710248',publisher:'Publisher',image:'https://images.isbndb.com/good.jpg'},{title:'Bad',image:'https://evil.test/a'}]})),
  finish:async()=>{calls.push(['finish']);},upstream:()=>{calls.push(['upstream']);},
 };
 const admin={rpc:async(name)=>{assert.equal(name,'novori_begin_isbndb_request');calls.push(['quota']);return{data:{allowed:true}};},from:()=>{assert.fail('preview must not write catalog tables');}};
 try{
  const result=await findAdminBookCovers(admin,'reader',snapshot);
  assert.equal(result.options.length,2);assert.equal(result.warnings.length,0);
  assert.equal(result.options.find(o=>o.provider==='isbndb').publisher,'Publisher');
  assert.deepEqual(calls.map(c=>c[0]),['cache','quota','upstream','finish']);
 }finally{globalThis.Deno=old;delete globalThis.__coverAdapters;}
});
test('provider outages produce independent warnings while leaving cached choices usable',async()=>{
 const old=globalThis.Deno;globalThis.Deno={env:{get:()=>undefined}};
 try{const result=await findAdminBookCovers({},'reader',snapshot);assert.deepEqual(result.options,[]);assert.equal(result.warnings.length,2);}
 finally{globalThis.Deno=old;}
});
