const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/app/book/[id]/index.tsx'),'utf8');
const code=source.slice(source.indexOf('  async function loadSeries('),source.indexOf('  async function findGoogleBookForSeries('));
test('cached series labels display before cover reads finish and cannot replay stale artwork/pages',async()=>{
 let finish;const cover=new Promise(resolve=>{finish=resolve;});
 const deps={getBookISBN:()=> '9780000000002',publicBookCache:{read:jest.fn(async()=>({fromCache:true,value:{series:{id:1,name:'Series'},books:[{id:2,title:'Book',authors:['Writer'],coverBookId:'edition',coverUrl:'https://old/snapshot.jpg'}],pageCounts:{edition:{isbn:'9780000000002',pageCount:50}}}}))},bookExtraKey:()=> 'series:edition',validSeriesExtras:()=>true,
  normalizeCatalogAuthor:value=>value,setSeriesLoading:jest.fn(),setSeries:jest.fn(),setSeriesBooks:jest.fn(),rememberEditionPages:jest.fn(),rememberBookPublications:jest.fn(),publishCatalogCovers:jest.fn(),resolveCanonicalBookCover:jest.fn(()=>cover),setSeriesWorkCoverUrl:jest.fn(),setSelectedWorkCoverUrl:jest.fn(),supabase:{functions:{invoke:jest.fn()}},__DEV__:false};
 const exports={};vm.runInNewContext(ts.transpileModule(code+'\nexports.loadSeries=loadSeries;',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{...deps,exports});
 const pending=exports.loadSeries({id:'edition',volumeInfo:{title:'Book',authors:['Writer'],industryIdentifiers:[]}});
 for(let n=0;n<10;n++)await Promise.resolve();
 expect(deps.setSeries).toHaveBeenCalledWith(expect.objectContaining({name:'Series'}));expect(deps.setSeriesLoading).toHaveBeenLastCalledWith(false);
 expect(deps.publishCatalogCovers).not.toHaveBeenCalled();expect(deps.rememberEditionPages).not.toHaveBeenCalled();expect(deps.rememberBookPublications).not.toHaveBeenCalled();expect(deps.supabase.functions.invoke).not.toHaveBeenCalled();
 finish('https://art/current-manual.jpg');await pending;expect(deps.setSelectedWorkCoverUrl).toHaveBeenCalledWith('https://art/current-manual.jpg');
});
