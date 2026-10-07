const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
test('the actual Recent Releases filter retains books whose publisher covers are still loading',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/app/(tabs)/discover.tsx'),'utf8');
 const start=source.indexOf('  const recentReleaseCandidates =');
 const end=source.indexOf('  const recentReleaseBooks:',start);
 const exported={};
 const rows=Array.from({length:15},(_,i)=>({id:i+1,title:'Book '+i,authors:['Writer '+i],rank:i+1,coverUrl:i<2?'https://covers/book.jpg':null,releaseDate:'2026-09-01'}));
 const compiled=ts.transpileModule(source.slice(start,end)+'\nexports.rows=recentReleaseCandidates;',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(compiled,{exports:exported,recentReleasePool:rows,fixedTrendingIds:new Set([1]),libraryBooks:[],isDiscoverBookInLibrary:book=>book.id===2});
 expect(exported.rows).toHaveLength(13);
 expect(exported.rows.every(book=>book.coverUrl===null)).toBe(true);
});
