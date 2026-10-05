const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const book=(id,author,title='The Perfect Son')=>({id,volumeInfo:{title,authors:[author],language:'en',imageLinks:{thumbnail:'https://covers.test/'+id}},saleInfo:{country:'US'}});
function load(items){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/book-search.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 exports,console,URL,Date,Math,Map,Set,Promise,require:name=>{
 if(name.includes('canonical-book-covers'))return{getCanonicalBookCover:()=>null,publishCatalogCovers:()=>{},resolveCanonicalBookCover:async()=>null};
 if(name==='./supabase')return{supabase:{functions:{invoke:async()=>({data:{ok:true,data:{covers:{}}}})}}};
 if(name==='./google-books')return{fetchGoogleBooksJson:async()=>({ok:true,status:200,data:{items:JSON.parse(JSON.stringify(items))}})};
 if(name==='./book-covers')return{getBookCoverPlan:()=>({primaryUrl:null})};
 throw Error(name);
 }});return exports;
}
test.each(['the perfect son freida','the perfect son freida mcfadden','the perfect son mcfadden'])('title plus author query keeps the intended book: %s',async query=>{
 const api=load([book('wrong1','Other Author'),book('freida','Freida McFadden'),book('wrong2','Another Author')]);
 const rows=await api.searchNovoriBooks(query);expect(rows.map(b=>b.id)).toEqual(['freida']);
});
test('title-only searches retain distinct books with the same title',async()=>{
 const api=load([book('wrong1','Other Author'),book('freida','Freida McFadden')]);
 expect((await api.searchNovoriBooks('the perfect son')).map(b=>b.id).sort()).toEqual(['freida','wrong1']);
});
