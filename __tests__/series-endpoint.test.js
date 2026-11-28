const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const source = fs.readFileSync('supabase/functions/hardcover-series/index.ts','utf8');
const compiled = ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
if (compiled.diagnostics?.length) throw new Error('Could not compile Hardcover series handler');
const lookup = require('../supabase/functions/_shared/series-lookup');
const metadata = require('../supabase/functions/_shared/book-edition-metadata');

function handler(incompleteSeries = false) {
 const calls=[];
 const series={id:18,name:'The Lantern Archives',slug:'lantern-archives'};
 const member={id:71,title:'The Lantern Below',contributions:[{author:{name:'Lena Stone'}}],book_series:[{position:2,series}],editions:[]};
 const admin={};
 const attachDiscoveryCatalogCovers=jest.fn(async(_admin,payload)=>payload);
 let serve;
 vm.runInNewContext(compiled.outputText,{
  exports:{},Deno:{env:{get:name=>name==='HARDCOVER_API_TOKEN'?'fixture-token':undefined},serve:fn=>{serve=fn;}},
  Request,Response,console,
  require(name){
   if (name.endsWith('/series-lookup.ts'))return lookup;
   if (name.endsWith('/verified-series-corrections.ts'))return require('../supabase/functions/_shared/verified-series-corrections');
   if (name.endsWith('/book-edition-metadata.ts'))return metadata;
   if (name.endsWith('/provider-cache.ts')) return {
    createCacheAdmin:()=>admin,requireReader:async()=>{},
    cachedProviderValue:async options=>options.load(),
    cachedHardcoverFetch:async(_admin,_url,init)=>{
     const {query,variables}=JSON.parse(init.body);
     calls.push({query,variables});
     let data;
     if(query.includes('FindSeriesBooksByISBN'))data={editions:[]};
     else if(query.includes('HardcoverSearch'))data={search:{results:{hits:[]}}};
     else if(query.includes('ExactSeriesTitle'))data={books:[member]};
     else if(query.includes('GetSeries'))data=incompleteSeries ? {series_by_pk:null} : {series_by_pk:{...series,book_series:[]}};
     else throw Error('Unexpected provider request');
     return new Response(JSON.stringify({data}));
    }
   };
   if(name.endsWith('/provider-observability.ts'))return {providerTrace:()=>({})};
   if(name.endsWith('/series-membership-cache.ts'))return {readSeriesMembership:async()=>null,cacheSeriesMembership:async()=>{}};
   if(name.endsWith('/supabase-keys.mjs'))return {getServerKey:()=>null};
   if(name.endsWith('/edition-pages.ts'))return {cacheSeriesEditionPages:async()=>{}};
   if(name.endsWith('/book-publication-cache.ts'))return {cacheSeriesPublications:async()=>{}};
   if(name.endsWith('/discovery-cover-catalog.ts'))return {attachDiscoveryCatalogCovers};
   if(name.endsWith('/verified-series-covers.ts'))return {verifiedEnglishSeriesArt:()=>null};
   if(name.endsWith('/book-language.ts'))return {englishEditionIsbns:()=>[],isEnglishBookLanguage:()=>false};
   if(name.endsWith('/isbndb.ts'))return {isbnDbEnabled:()=>true};
   return {};
  }
 });
 return {calls,serve,attachDiscoveryCatalogCovers,member};
}

test('the series endpoint looks past an unmatched ISBN and empty text search to a verified catalog relationship',async()=>{
 const h=handler();
 const response=await h.serve(new Request('https://fixture.test/series',{method:'POST',body:JSON.stringify({
   isbn:'9781250214713',title:h.member.title,authors:['Lena Stone'],
 })}));
 const payload=await response.json();
 expect(response.status).toBe(200);
 expect(payload.series).toMatchObject({id:18,name:'The Lantern Archives',currentPosition:2});
 expect(h.calls.map(row=>row.query.match(/query (\w+)/)?.[1])).toEqual([
   'FindSeriesBooksByISBN','HardcoverSearch','HardcoverSearch','ExactSeriesTitle','GetSeries',
 ]);
 expect(h.attachDiscoveryCatalogCovers).toHaveBeenCalledTimes(1);
});

test('an incomplete series response is a retryable error rather than a cacheable empty series',async()=>{
 const h=handler(true);
 const response=await h.serve(new Request('https://fixture.test/series',{method:'POST',body:JSON.stringify({
   title:h.member.title,authors:['Lena Stone'],
 })}));
 expect(response.status).toBe(500);
 expect((await response.json()).details).toContain('series response was incomplete');
 expect(h.attachDiscoveryCatalogCovers).not.toHaveBeenCalled();
});
