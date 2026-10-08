const fs=require('fs'),vm=require('vm'),ts=require('typescript');
function harness() {
 const source=fs.readFileSync(require('path').join(__dirname,'../src/app/(tabs)/discover.tsx'),'utf8');
 const start=source.indexOf('  async function loadMoreBooks()');
 const end=source.indexOf('  function searchImmediately()',start);
 const ctx={initialBookSearchPending:{current:null},loading:false,loadingBookPage:{current:false},visibleBookCount:10,books:Array.from({length:25},(_,i)=>({id:String(i)})),activeBookSearch:{current:'novel'},nextBookPage:{current:40},latestRequestRef:{current:1},hasMoreBookSearchResults:()=>true,searchNovoriBooks:jest.fn(async()=>[{id:'24'},{id:'new'}]),setLoadingMoreBooks:()=>{},exports:{}};
 ctx.setVisibleBookCount=fn=>{ctx.visibleBookCount=fn(ctx.visibleBookCount);};
 ctx.setBooks=fn=>{ctx.books=fn(ctx.books);};
 vm.runInNewContext(ts.transpileModule(source.slice(start,end)+'\nexports.loadMore=loadMoreBooks;',{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,ctx);
 return ctx;
}
test('scroll reveals ten cached results at a time before fetching another provider page, then removes duplicates',async()=>{
 const h=harness();
 await h.exports.loadMore();expect(h.visibleBookCount).toBe(20);
 await h.exports.loadMore();expect(h.visibleBookCount).toBe(25);expect(h.searchNovoriBooks).not.toHaveBeenCalled();
 await h.exports.loadMore();expect(h.searchNovoriBooks).toHaveBeenCalledWith('novel',40);expect(h.books).toHaveLength(26);expect(h.nextBookPage.current).toBe(80);
});
test('a late page from the previous query cannot contaminate the new search',async()=>{
 const h=harness();h.visibleBookCount=25;
 h.searchNovoriBooks.mockImplementation(async()=>{h.latestRequestRef.current++;return[{id:'stale'}];});
 await h.exports.loadMore();expect(h.books.some(b=>b.id==='stale')).toBe(false);expect(h.nextBookPage.current).toBe(40);
});

test('preview can reveal already loaded books but cannot fetch another page before ranking completes',async()=>{
 const h=harness();h.initialBookSearchPending.current=1;
 await h.exports.loadMore();expect(h.visibleBookCount).toBe(20);
 h.visibleBookCount=25;
 await h.exports.loadMore();expect(h.searchNovoriBooks).not.toHaveBeenCalled();
});
