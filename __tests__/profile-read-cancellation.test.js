const fs=require('fs'),vm=require('vm'),ts=require('typescript');
const flush=()=>require('node:timers/promises').setImmediate();
const source=fs.readFileSync('src/app/(tabs)/profile.tsx','utf8');
const start=source.indexOf('        async function loadProfileAndBooks()');
const end=source.indexOf('            try {\n                const savedBooksPromise',start);
function harness(cachePending=false){
 let releaseCache;const controller=new AbortController();const calls=[];
 const query={select(){return this},eq(){return this},abortSignal(signal){calls.push(signal);return this},single(){return new Promise(resolve=>controller.signal.addEventListener('abort',()=>resolve({data:null,error:{message:'cancelled'}})))}};
 const ctx={exports:{},isMounted:true,profileReadController:controller,profileSessionCache:null,libraryChanged:false,postsChanged:false,PROFILE_STALE_MS:60000,Date,
  supabase:{auth:{getSession:async()=>({data:{session:{user:{id:'me'}}}})},from:()=>{calls.push('query');return query}},
  readProfileCache:()=>cachePending?new Promise(resolve=>releaseCache=resolve):Promise.resolve(null),
  setProfileHydrated:jest.fn(),console:{warn:jest.fn(),error:jest.fn()},router:{replace:jest.fn()}};
 vm.runInNewContext(ts.transpileModule(source.slice(start,end)+'}\nexports.run=loadProfileAndBooks;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,ctx);
 return {ctx,calls,controller,releaseCache:()=>releaseCache(null)};
}
it('does not start the profile query after navigating away during cache hydration',async()=>{
 const h=harness(true);const request=h.ctx.exports.run();await flush();h.ctx.isMounted=false;h.controller.abort();h.releaseCache();await request;expect(h.calls).toEqual([]);
});
it('aborts the in-flight profile query and ignores its result after blur',async()=>{
 const h=harness();const request=h.ctx.exports.run();await flush();expect(h.calls).toContain(h.controller.signal);
 h.ctx.isMounted=false;h.controller.abort();await request;expect(h.ctx.console.warn).not.toHaveBeenCalled();expect(h.ctx.console.error).not.toHaveBeenCalled();
});
