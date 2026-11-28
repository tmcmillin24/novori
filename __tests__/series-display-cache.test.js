const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/app/book/[id]/index.tsx'),'utf8');
const code=source.slice(source.indexOf('  async function loadSeries('),source.indexOf('  async function saveReadingStatus('));
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

test('a series tap navigates immediately without waiting on an edition lookup',()=>{
 const openCode=source.slice(source.indexOf('  function openSeriesBook('),source.indexOf('  const displayBook:'));
 const router={push:jest.fn()};
 const row={id:24,title:'Bleed The Vow',authors:['Emily Blackwood'],position:3,releaseDate:'2026-11-25',isbns:[]};
 const seriesOpeningSnapshots=new Map();
 const exports={};
 vm.runInNewContext(ts.transpileModule(openCode+'\nexports.openSeriesBook=openSeriesBook;',
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,router,source:'library',series:{id:7,name:'Mystics of Ashora',currentPosition:1},seriesBooks:[row],
    seriesOpeningSnapshots,getDisplayTitle:value=>value,displayBookTitle:value=>value,
    secureGoogleBooksImageUrl:value=>value,
 });
 expect(exports.openSeriesBook(row)).toBeUndefined();
 expect(router.push).toHaveBeenCalledWith({pathname:'/book/[id]',params:expect.objectContaining({
  id:'hc_series_24',clickedTitle:'Bleed The Vow',seriesPreviewPosition:'3',seriesLookupId:'7',
 })});
 expect(seriesOpeningSnapshots.get('hc_series_24').series.currentPosition).toBe(3);
});

test('the destination keeps its book visible during lookup and enables details only after verification',async()=>{
 const routeCode=source.slice(source.indexOf('function SeriesBookOpeningRoute('),source.indexOf('export default function BookDetailsRoute('));
 const states=[], effects=[], exports={};
 let cursor=0;
 const params={id:'hc_series_24',source:'library',clickedTitle:'Curse The Heart',seriesPreviewName:'Mystics of Ashora',
  clickedAuthors:'["Emily Blackwood"]',seriesLookupId:'7',seriesLookupIsbns:'9781958968123'};
 const snapshot={series:{id:7,name:'Mystics of Ashora',currentPosition:2},books:[]};
 const book={id:'nv_9781958968123',volumeInfo:{title:'Curse The Heart',authors:['Emily Blackwood'],language:'en'}};
 let finish;
 const response=new Promise(resolve=>{finish=resolve;});
 const supabase={functions:{invoke:jest.fn(()=>response)}};
 vm.runInNewContext(ts.transpileModule(routeCode+'\nexports.open=SeriesBookOpeningRoute;',
  {fileName:'route.tsx',compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
   exports,supabase,peekNovoriBookSearch:jest.fn(),useRouter:()=>({}),useMemo:fn=>fn(),useEffect:fn=>effects.push(fn),
   useState(initial){const key=cursor++; if(!(key in states)) states[key]=typeof initial==='function'?initial():initial;return [states[key],value=>{states[key]=value;}];},
   React:{createElement:(type,props)=>({type,props})},
   seriesOpeningSnapshots:new Map([[params.id,snapshot]]),openingAuthors:JSON.parse,
   BookDetailLoading:'loading',SeriesBookPreview:'preview',BookDetailsScreen:'details',
   readSeriesEdition:(_key,load)=>load(),resolveSeriesOpening:(_member,_series,_search,load)=>load(),
   secureGoogleBooksImageUrl:value=>value,getValidatedHighResolutionCover:()=>undefined,getBookISBN:()=> '9781958968123',
 });
 const initial=exports.open({params});
 expect(initial).toMatchObject({type:'loading',props:{title:'Curse The Heart'}});
 expect(supabase.functions.invoke).not.toHaveBeenCalled();
 effects.shift()();
 expect(supabase.functions.invoke.mock.calls[0][1].body).toEqual({mode:'resolve-edition',seriesId:7,bookId:24});
 finish({data:{book}});
 for(let n=0;n<10;n++)await Promise.resolve();
 cursor=0;
 expect(exports.open({params})).toMatchObject({type:'details',props:{initialSeries:snapshot,params:{id:book.id,clickedIsbn:'9781958968123'}}});
});
