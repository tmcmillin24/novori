const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/app/book/[id]/index.tsx'),'utf8');
const code=source.slice(source.indexOf('  async function loadSeries('),source.indexOf('  function findGoogleBookForSeries('));
test('cached series labels display before cover reads finish and cannot replay stale artwork/pages',async()=>{
 let finish;const cover=new Promise(resolve=>{finish=resolve;});
 const deps={getBookISBN:()=> '9780000000002',publicBookCache:{read:jest.fn(async()=>({fromCache:true,value:{series:{id:1,name:'Series'},books:[{id:2,title:'Book',authors:['Different Series Author'],coverBookId:'edition',coverUrl:'https://old/snapshot.jpg'}],pageCounts:{edition:{isbn:'9780000000002',pageCount:50}}}}))},bookExtraKey:()=> 'series:edition',validSeriesExtras:()=>true,
  normalizeCatalogAuthor:value=>value,setSeriesLoading:jest.fn(),setSeries:jest.fn(),setSeriesBooks:jest.fn(),rememberEditionPages:jest.fn(),rememberBookPublications:jest.fn(),publishCatalogCovers:jest.fn(),resolveCanonicalBookCover:jest.fn(()=>cover),setSeriesWorkCoverUrl:jest.fn(),setSelectedWorkCoverUrl:jest.fn(),supabase:{functions:{invoke:jest.fn()}},__DEV__:false};
 const exports={};vm.runInNewContext(ts.transpileModule(code+'\nexports.loadSeries=loadSeries;',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{...deps,exports});
 const pending=exports.loadSeries({id:'edition',volumeInfo:{title:'Book',authors:['Writer'],industryIdentifiers:[]}});
 for(let n=0;n<10;n++)await Promise.resolve();
 expect(deps.setSeries).toHaveBeenCalledWith(expect.objectContaining({name:'Series'}));expect(deps.setSeriesLoading).toHaveBeenLastCalledWith(false);
 expect(deps.setSeriesBooks).toHaveBeenCalledWith([expect.objectContaining({authors:['Different Series Author']})]);
 expect(deps.publishCatalogCovers).not.toHaveBeenCalled();expect(deps.rememberEditionPages).not.toHaveBeenCalled();expect(deps.rememberBookPublications).not.toHaveBeenCalled();expect(deps.supabase.functions.invoke).not.toHaveBeenCalled();
 finish('https://art/current-manual.jpg');await pending;expect(deps.setSelectedWorkCoverUrl).toHaveBeenCalledWith('https://art/current-manual.jpg');
});

test('series lookup starts without aliases and retries only a real miss with newly learned ISBNs', async()=>{
 const initial={id:'nv_9781958968123',volumeInfo:{title:'A Book',authors:['Writer']}};
 let complete;const work = new Promise(resolve=>{complete=resolve;});
 const results=[{series:null,books:[]},{series:{id:7,name:'Series'},books:[]}];
 const deps={getBookISBN:()=>null,publicBookCache:{read:async(_key,load)=>({value:await load(),fromCache:false})},
  bookExtraKey:()=> 'series:edition',validSeriesExtras:()=>true,
  normalizeCatalogAuthor:value=>value,setSeriesLoading:jest.fn(),setSeries:jest.fn(),setSeriesBooks:jest.fn(),
  rememberEditionPages:jest.fn(),rememberBookPublications:jest.fn(),publishCatalogCovers:jest.fn(),
  resolveCanonicalBookCover:jest.fn(async()=>null),setSeriesWorkCoverUrl:jest.fn(),setSelectedWorkCoverUrl:jest.fn(),
  supabase:{functions:{invoke:jest.fn(async()=>({data:results.shift()}))}},__DEV__:false};
 const exports={};vm.runInNewContext(ts.transpileModule(code+'\nexports.loadSeries=loadSeries;',
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{...deps,exports});
 const pending=exports.loadSeries(initial,()=>true,work);
 for(let n=0;n<10;n++)await Promise.resolve();
 expect(deps.supabase.functions.invoke).toHaveBeenCalledTimes(1);
 expect(deps.supabase.functions.invoke.mock.calls[0][1].body.isbns).toEqual(['9781958968123']);
 complete({...initial,novoriDetails:{isbns:['9781250214713']}});
 await pending;
 expect(deps.supabase.functions.invoke.mock.calls[1][1].body.isbns).toEqual(['9781958968123','9781250214713']);
 expect(deps.setSeries).toHaveBeenCalledWith({id:7,name:'Series'});
});

test('a known series entry still opens when there is no verified reading edition',async()=>{
 const openCode=source.slice(source.indexOf('  async function openSeriesBook('),source.indexOf('  const displayBook:'));
 const router={push:jest.fn()}, alert=jest.fn();
 const row={id:24,title:'Bleed The Vow',authors:['Emily Blackwood'],position:3,releaseDate:'2026-11-25'};
 const exports={};
 vm.runInNewContext(ts.transpileModule(openCode+'\nexports.openSeriesBook=openSeriesBook;',
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,router,Alert:{alert},series:{id:7,name:'Mystics of Ashora',currentPosition:1},
    getDisplayTitle:value=>value,displayBookTitle:value=>value,findGoogleBookForSeries:async()=>null,
    secureGoogleBooksImageUrl:value=>value,setOpeningSeriesBookId:jest.fn(),
 });
 await exports.openSeriesBook(row);
 expect(router.push).toHaveBeenCalledWith({pathname:'/book/[id]',params:expect.objectContaining({
  id:'hc_series_24',clickedTitle:'Bleed The Vow',seriesPreviewPosition:'3',
 })});
 expect(alert).not.toHaveBeenCalled();
});
