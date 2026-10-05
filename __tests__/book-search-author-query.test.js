const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const book=(id,author,title='The Perfect Son')=>({id,volumeInfo:{title,authors:[author],language:'en',imageLinks:{thumbnail:'https://covers.test/'+id}},saleInfo:{country:'US'}});
function load(items,responses={},popularity={}){
 const exports={};const calls=[];exports.searchCalls=calls;exports.popularityCalls=[];
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/book-search.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 exports,console,URL,Date,Math,Map,Set,Promise,require:name=>{
 if(name.includes('book-edition-metadata'))return require('../supabase/functions/_shared/book-edition-metadata');
 if(name.includes('canonical-book-covers'))return{getCanonicalBookCover:()=>null,publishCatalogCovers:()=>{},resolveCanonicalBookCover:async()=>null};
 if(name==='./supabase')return{supabase:{functions:{invoke:async(name,{body})=>{if(name==='hardcover-search-popularity'){exports.popularityCalls.push(body);if(popularity instanceof Error)throw popularity;return{data:{popularity}};}return{data:{ok:true,data:{covers:{}}}};}}}};
 if(name==='./google-books')return{fetchGoogleBooksJson:async url=>{const query=new URL(url).searchParams.get('q');calls.push(query);if(responses[query] instanceof Error)throw responses[query];return{ok:true,status:200,data:{items:JSON.parse(JSON.stringify(responses[query]??items))}}}};
 if(name==='./book-covers')return{getBookCoverPlan:({imageLinks,existingCoverUrl})=>({primaryUrl:existingCoverUrl??imageLinks?.medium??imageLinks?.thumbnail??null})};
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

test('same-title author conflicts rank established matched readership first without merging identities or covers',async()=>{
 const weak=book('lookalike','H.E. Carlton','Hunting Adeline');const original=book('original','H. D. Carlton','Hunting Adeline');
 const api=load([weak,original],{},{original:{usersCount:12000,rating:4.3,ratingsCount:9000}});
 const rows=await api.searchNovoriBooks('hunting Adeline');
 expect(rows.map(b=>b.id)).toEqual(['original','lookalike']);expect(rows[0].volumeInfo.imageLinks.thumbnail).toBe(original.volumeInfo.imageLinks.thumbnail);
 expect(rows[0].novoriWork.googleBookIds).toEqual(['original']);expect(rows[1].novoriWork.googleBookIds).toEqual(['lookalike']);
 expect(api.popularityCalls).toHaveLength(1);expect(api.popularityCalls[0].allowTitleFallback).toBe(true);expect(api.popularityCalls[0].books).toHaveLength(2);
});
test('unambiguous searches do not add a Hardcover popularity lookup',async()=>{
 const api=load([book('original','H. D. Carlton','Hunting Adeline')]);await api.searchNovoriBooks('hunting Adeline');expect(api.popularityCalls).toHaveLength(0);
});
test('failure to resolve ambiguous author popularity preserves both results',async()=>{
 const api=load([book('a','H.E. Carlton','Hunting Adeline'),book('b','H. D. Carlton','Hunting Adeline')],{},Error('Network unavailable'));
 expect((await api.searchNovoriBooks('hunting Adeline')).map(b=>b.id)).toEqual(['a','b']);expect(api.popularityCalls).toHaveLength(1);
});

test('ISBNdb surname-first print edition replaces the MP3 CD representative without borrowing its narrator cover',async()=>{
 const audio={...book('audio','Freida McFadden'),source:{provider:'isbndb'},volumeInfo:{...book('audio','Freida McFadden').volumeInfo,pageCount:1,publishedDate:'2022',description:'MP3 CD Format "Mrs. Cass..."'}};
 const print={...book('print','McFadden, Freida'),source:{provider:'isbndb'},novoriEdition:{binding:'Paperback'},volumeInfo:{...book('print','McFadden, Freida').volumeInfo,pageCount:308,publishedDate:'2024-08-06'}};
 const rows=await load([audio,print]).searchNovoriBooks('The Perfect Son Freida');
 expect(rows).toHaveLength(1);expect(rows[0].id).toBe('print');
 expect(rows[0].volumeInfo.authors).toEqual(['Freida McFadden']);expect(rows[0].volumeInfo.pageCount).toBe(308);
 expect(rows[0].novoriWork.canonicalCoverUrl).toBe('https://covers.test/print');
 expect(rows[0].novoriWork.googleBookIds.sort()).toEqual(['audio','print']);
});
test('ISBNdb audio-only results remain searchable and never show audio disc counts as pages',async()=>{
 const audio={...book('audio','Freida McFadden'),source:{provider:'isbndb'},novoriEdition:{binding:'MP3 CD'},volumeInfo:{...book('audio','Freida McFadden').volumeInfo,pageCount:1}};
 const rows=await load([audio]).searchNovoriBooks('The Perfect Son Freida');
 expect(rows).toHaveLength(1);expect(rows[0].id).toBe('audio');expect(rows[0].volumeInfo.pageCount).toBeUndefined();
});
