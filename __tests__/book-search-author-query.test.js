const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const book=(id,author,title='The Perfect Son')=>({id,volumeInfo:{title,authors:[author],language:'en',imageLinks:{thumbnail:'https://covers.test/'+id}},saleInfo:{country:'US'}});
function load(items,responses={}){
 const exports={};const calls=[];exports.searchCalls=calls;
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/book-search.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 exports,console,URL,Date,Math,Map,Set,Promise,require:name=>{
 if(name.includes('canonical-book-covers'))return{getCanonicalBookCover:()=>null,publishCatalogCovers:()=>{},resolveCanonicalBookCover:async()=>null};
 if(name==='./supabase')return{supabase:{functions:{invoke:async()=>({data:{ok:true,data:{covers:{}}}})}}};
 if(name==='./google-books')return{fetchGoogleBooksJson:async url=>{const query=new URL(url).searchParams.get('q');calls.push(query);if(responses[query] instanceof Error)throw responses[query];return{ok:true,status:200,data:{items:JSON.parse(JSON.stringify(responses[query]??items))}}}};
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

test('a partial author missing from broad results gets one scoped title/author search',async()=>{
 const scoped='intitle:"the perfect son" inauthor:"freida"';
 const api=load([book('wrong1','Other Author'),book('wrong2','Another Author')],{[scoped]:[book('freida','Freida McFadden')]});
 expect((await api.searchNovoriBooks('the perfect son Freida')).map(b=>b.id)).toEqual(['freida']);
 expect(api.searchCalls).toEqual(['the perfect son Freida',scoped]);
});
test('scoped-search failure preserves the original usable results',async()=>{
 const scoped='intitle:"the perfect son" inauthor:"freida"';
 const api=load([book('wrong1','Other Author')],{[scoped]:Error('Offline')});
 expect((await api.searchNovoriBooks('the perfect son Freida')).map(b=>b.id)).toEqual(['wrong1']);
 expect(api.searchCalls).toHaveLength(2);
});
test('a scoped result from another author cannot replace the original results',async()=>{
 const api=load([book('original','Other Author')],{'intitle:"the perfect son" inauthor:"freida"':[book('irrelevant','Another Author')]});
 expect((await api.searchNovoriBooks('the perfect son freida')).map(b=>b.id)).toEqual(['original']);
});
test('a matching first-name result avoids any extra search',async()=>{
 const api=load([book('freida','Freida McFadden')]);await api.searchNovoriBooks('the perfect son freida');expect(api.searchCalls).toHaveLength(1);
});
test('ordinary titles and explicit edition intent do not trigger author fallback',async()=>{
 const api=load([book('freida','Freida McFadden')]);
 await api.searchNovoriBooks('the perfect son');await api.searchNovoriBooks('the perfect son special edition');expect(api.searchCalls).toHaveLength(2);
});
