const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/app/(tabs)/discover.tsx'),'utf8');
function context(){
 const h={latestRequestRef:{current:1},initialBookSearchPending:{current:null},activeBookSearch:{current:''},nextBookPage:{current:40},books:[],loading:false,error:'',visible:10,console,exports:{}};
 h.setBooks=rows=>{h.books=rows;};h.setLoading=value=>{h.loading=value;};h.setError=value=>{h.error=value;};h.setVisibleBookCount=value=>{h.visible=value;};return h;
}
test('Discover shows previews without waiting and ignores enrichment after leaving',async()=>{
 const h=context();let finish,publish;
 h.searchNovoriBooks=jest.fn((_term,_page,options)=>{publish=options.onProgress;return new Promise(resolve=>{finish=resolve;});});
 const start=source.indexOf('  async function performSearch('),end=source.indexOf('  async function loadMoreBooks()',start);
 vm.runInNewContext(ts.transpileModule(source.slice(start,end)+'\nexports.search=performSearch;',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,h);
 const request=h.exports.search('novel',1);
 publish([{id:'preview'}]);expect(h.books).toEqual([{id:'preview'}]);expect(h.loading).toBe(false);
 h.latestRequestRef.current++;h.books=[];
 publish([{id:'late-preview'}]);finish([{id:'late-final'}]);await request;
 expect(h.books).toEqual([]);
});
test('returning to Discover clears search, invalidates late results, and leaves loaded feed untouched',()=>{
 const h=context();h.books=[{id:'searched'}];h.query='old query';h.loading=true;
 h.debounceTimerRef={current:123};h.clearTimeout=jest.fn();h.setQuery=value=>{h.query=value;};
 h.discoverSearchInputRef={current:{blur:jest.fn()}};h.Keyboard={dismiss:jest.fn()};h.setDiscoverSearchFocused=jest.fn();
 h.trendingBooks=[{id:'trending'}];h.recentReleases=[{id:'recent'}];
 const start=source.indexOf('        // Returning from details'),end=source.indexOf('        let active =',start);
 vm.runInNewContext(ts.transpileModule(source.slice(start,end),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,h);
 expect(h.query).toBe('');expect(h.books).toEqual([]);expect(h.loading).toBe(false);expect(h.latestRequestRef.current).toBe(2);
 expect(h.trendingBooks).toEqual([{id:'trending'}]);expect(h.recentReleases).toEqual([{id:'recent'}]);expect(h.clearTimeout).toHaveBeenCalledWith(123);
});
