/** Development diagnostics only; never log request bodies, searches or credentials. */
export function localCacheLog(kind:string,status:string){if(__DEV__)console.log(`[Novori cache] ${kind} ${status}`);}
export function createCacheLoggedFetch(transport:typeof fetch):typeof fetch{
 return async(input,init)=>{
  const response=await transport(input,init);
  if(__DEV__){
   const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
   const endpoint=/\/functions\/v1\/([^/?]+)/.exec(url)?.[1];
   if(endpoint && /^(google-books-|hardcover-|book-edition-pages|book-cover-selection)/.test(endpoint)){
    try{
     void response.clone().json().then(data=>{const trace=data.cacheTrace;
     const upstream=trace?.upstream??{};const calls=Object.values(upstream).reduce<number>((sum,value)=>sum+Number(value),0);
     console.log(`[Novori cache] ${endpoint} ${trace ? (calls ? 'PROVIDER CALL' : trace.hits ? 'CACHE HIT' : 'NO PROVIDER CALL') : data.cache?.status?.toUpperCase()??(endpoint==='book-cover-selection'?'CATALOG READ · 0 provider calls':'UNREPORTED')}`,trace?{httpStatus:response.status,hits:trace.hits,misses:trace.misses,upstream,decisions:trace.decisions}:undefined);
     }).catch(()=>{});
    }catch{/* The diagnostic must not alter response handling. */}
   }
  }
  return response;
 };
}
