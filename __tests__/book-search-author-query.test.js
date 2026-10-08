const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const book=(id,author,title='The Perfect Son')=>({id,volumeInfo:{title,authors:[author],language:'en',imageLinks:{thumbnail:'https://covers.test/'+id}},saleInfo:{country:'US'}});
function load(items,responses={},popularity={}){
 const exports={};const calls=[];exports.searchCalls=calls;exports.popularityCalls=[];
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/book-search.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 exports,console,URL,Date,Math,Map,Set,Promise,require:name=>{
 if(name.includes('book-work-details'))return require('../src/lib/book-work-details');
 if(name.includes('book-read-cache'))return require('../src/lib/book-read-cache');
 if(name.includes('book-publication'))return require('../src/lib/book-publication');
 if(name.includes('book-edition-metadata'))return require('../supabase/functions/_shared/book-edition-metadata');
 if(name.includes('canonical-book-covers'))return{getCanonicalBookCoverRevision:()=>0,getCanonicalBookCover:()=>null,publishCatalogCovers:()=>{},resolveCanonicalBookCover:async()=>null};
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

test('Discover and book pickers reuse completed normalized search results without sharing mutable selections',async()=>{
 const api=load([book('freida','Freida McFadden')]);
 const first=await api.searchNovoriBooks('The Perfect Son Freida');
 first[0].volumeInfo.title='Selection mutated';
 const next=await api.searchNovoriBooks('  the perfect son   freida  ');
 expect(next[0].volumeInfo.title).toBe('The Perfect Son');
 expect(api.searchCalls).toHaveLength(1);
});

test('Onyx Storm screenshot editions collapse into the plain-title result with its existing cover',async()=>{
 const titles=['Onyx Storm','Onyx Storm (Empyrean)','Onyx Storm (Engelstalige editie)','Onyx Storm DISCOVER THE FOLLOW-UP TO THE GLOBAL PHENOMENONS, FOURTH WING AND IRON FLAME!'];
 const items=titles.map((title,i)=>({...book('onyx'+i,'Rebecca Yarros',title),source:{provider:'isbndb'}}));
 const rows=await load([...items].reverse()).searchNovoriBooks('onyx storm');
 expect(rows).toHaveLength(1);expect(rows[0].id).toBe('onyx0');
 expect(rows[0].volumeInfo.title).toBe('Onyx Storm');
 expect(rows[0].novoriWork.googleBookIds).toHaveLength(4);
 expect(rows[0].novoriWork.canonicalCoverUrl).toBe('https://covers.test/onyx0');
});


test('exported ACOTAR catalog keeps products below the novel without merging product ISBNs',async()=>{
 const api=load(require('./fixtures/acotar-catalog.json'));
 const rows=await api.searchNovoriBooks('a court of thorns and roses');
 expect(rows.length).toBeGreaterThan(0);
 expect(rows[0].volumeInfo.title.toLowerCase()).toBe('a court of thorns and roses');
 expect(rows[0].volumeInfo.pageCount).toBeGreaterThanOrEqual(419);
 expect(rows[0].volumeInfo.pageCount).toBeLessThan(1000);
 expect(rows[0].novoriWork.isbns).not.toContain('9781635577716');
 expect(rows[0].novoriWork.isbns).not.toContain('9781526635204');
 expect(/calendar|colou?ring|dramatized|box set|roses [67]$/i.test(rows[0].volumeInfo.title)).toBe(false);
});
test('supplements and sets remain searchable when explicitly requested',async()=>{
 const api=load(require('./fixtures/acotar-catalog.json'));
 expect((await api.searchNovoriBooks('a court of thorns and roses calendar')).some(b=>/calendar/i.test(b.volumeInfo.title))).toBe(true);
 expect((await api.searchNovoriBooks('a court of thorns and roses box set')).some(b=>/box set/i.test(b.volumeInfo.title))).toBe(true);
});

 test('missing leading article repairs an incomplete same-author edition through cached searches',async()=>{
  const weak=book('weak','Sarah J. Maas','Court of Thorns and Roses');
  const complete=book('complete','Sarah J. Maas','A Court of Thorns and Roses');
  complete.volumeInfo.publishedDate='2015-05-05';
  const other=book('other','Other Author','A Court of Thorns and Roses');
  other.volumeInfo.publishedDate='2020';
  const api=load([weak],{'a court of thorns and roses':[complete,other],'an court of thorns and roses':[],'the court of thorns and roses':[]});
  const rows=await api.searchNovoriBooks('court of thorns and roses');
  expect(rows.map(row=>row.id)).toEqual(['complete']);
  expect(rows[0].volumeInfo.publishedDate).toBe('2015-05-05');
  expect(rows[0].novoriWork.canonicalCoverUrl).toBe('https://covers.test/complete');
  expect((await api.searchNovoriBooks('a court of thorns and roses'))[0].id).toBe('complete');
 });
 test('complete title matches avoid article repair requests',async()=>{
  const complete=book('complete','Sarah J. Maas','Court of Thorns and Roses');
  complete.volumeInfo.publishedDate='2015';
  const api=load([complete]);await api.searchNovoriBooks('court of thorns and roses');
  expect(api.searchCalls).toHaveLength(1);
 });
 test('article repair failure preserves the original usable edition',async()=>{
  const weak=book('weak','Sarah J. Maas','Court of Thorns and Roses');
  const api=load([weak],{'a court of thorns and roses':Error('Offline'),'an court of thorns and roses':[],'the court of thorns and roses':[]});
  expect((await api.searchNovoriBooks('court of thorns and roses'))[0].id).toBe('weak');
 });

 test('equal-ranked editions and results keep the same order when provider order changes', async()=>{
 const a=book('a','Freida McFadden'),z=book('z','Freida McFadden');
 const other=book('other','Another Author');
 const first=await load([z,other,a]).searchNovoriBooks('the perfect son');
 const second=await load([a,other,z]).searchNovoriBooks('the perfect son');
 expect(first.map(b=>b.id)).toEqual(second.map(b=>b.id));
 expect(first.some(b=>b.id==='a')).toBe(true);
 });


test('relevant novels rank by readership while journals remain below them',async()=>{
 const items=[book('journal','Publisher','Hunger Games Companion Journal'),book('less-read','Suzanne Collins','Hunger Games Catching Fire'),book('popular','Suzanne Collins','The Hunger Games')];
 const api=load(items,{}, {'journal':{usersCount:999999,rating:5},'less-read':{usersCount:100,rating:4},'popular':{usersCount:50000,rating:4}});
 const rows=await api.searchNovoriBooks('hunger games');
 expect(rows.map(row=>row.id)).toEqual(['popular','less-read','journal']);
 expect(api.popularityCalls[0].books.map(row=>row.googleBookId)).not.toContain('journal');
 await api.searchNovoriBooks('hunger games');
 expect(api.popularityCalls).toHaveLength(1);
});

test('popularity drives relevant broad title results ahead of lexical closeness',async()=>{
 const api=load([book('exact','Writer','Court'),book('popular','Writer','Court of Dreams')],{}, {exact:{usersCount:10,rating:4},popular:{usersCount:10000,rating:4}});
 expect((await api.searchNovoriBooks('court')).map(row=>row.id)).toEqual(['popular','exact']);
});

test('original Fourth Wing precedes its distinct graphic adaptation even when the adaptation is popular',async()=>{
 const novel=book('novel','Rebecca Yarros','Fourth Wing');
 novel.volumeInfo.publishedDate='2023-05-02';
 novel.volumeInfo.industryIdentifiers=[{type:'ISBN_13',identifier:'9781649374042'}];
 const graphic=book('graphic','Rebecca Yarros','Fourth Wing, the Graphic Novel: Volume One');
 graphic.volumeInfo.publishedDate='2026-05-05';
 graphic.volumeInfo.industryIdentifiers=[{type:'ISBN_13',identifier:'9781649379993'}];
 const api=load([graphic,novel],{}, {novel:{usersCount:50000,rating:4},graphic:{usersCount:90000,rating:5}});
 const rows=await api.searchNovoriBooks('fourth wing');
 expect(rows.map(row=>row.id)).toEqual(['novel','graphic']);
 expect(rows[0].novoriWork.key).not.toBe(rows[1].novoriWork.key);
 expect(rows[0].novoriWork.isbns).not.toEqual(rows[1].novoriWork.isbns);
});
test('explicit graphic novel searches preserve the adaptation identity',async()=>{
 const graphic=book('graphic','Rebecca Yarros','Fourth Wing, the Graphic Novel: Volume One');
 const rows=await load([graphic]).searchNovoriBooks('fourth wing graphic novel');
 expect(rows[0].volumeInfo.title).toContain('Graphic Novel');
});
