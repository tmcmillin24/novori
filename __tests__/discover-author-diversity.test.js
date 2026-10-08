jest.mock('../src/lib/resolve-discovery-book',()=>({resolveDiscoveryBook:jest.fn()}));
jest.mock('../src/lib/canonical-book-covers',()=>({publishCatalogCovers:jest.fn(),resolveCanonicalBookCover:jest.fn()}));
const fs=require('fs'),vm=require('vm'),ts=require('typescript');
const {discoveryAuthorKey}=require('../src/lib/validated-discovery');
function diversify(){
 const source=fs.readFileSync(require('path').join(__dirname,'../src/app/(tabs)/discover.tsx'),'utf8');
 const start=source.indexOf('function diversifyByAuthor('),end=source.indexOf('\nfunction normalizeTitle',start);
 const context={exports:{},discoveryAuthorKey};
 vm.runInNewContext(ts.transpileModule(source.slice(start,end)+'\nexports.select=diversifyByAuthor;',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return context.exports.select;
}
test('twenty-card selection never fills spare slots with repeat primary authors',()=>{
 const books=Array.from({length:45},(_,id)=>({id,authors:[id<10?'J. K. Rowling':`Writer ${id}`]}));
 const rows=diversify()(books);
 expect(rows).toHaveLength(20);
 expect(rows.filter(book=>book.authors[0]==='J. K. Rowling')).toHaveLength(1);
 expect(rows.map(book=>book.id)).toEqual([0,...Array.from({length:19},(_,i)=>10+i)]);
});
test('punctuation and casing variants cannot count as different authors',()=>{
 expect(diversify()([{id:1,authors:['J. K. Rowling']},{id:2,authors:['JK ROWLING']},{id:3,authors:['Another Writer']}]).map(book=>book.id)).toEqual([1,3]);
});
