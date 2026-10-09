const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript');
const book=(id,author,title='The Perfect Son')=>({id,volumeInfo:{title,authors:[author],language:'en',imageLinks:{thumbnail:'https://covers.test/'+id}},saleInfo:{country:'US'}});
function load(items,responses={},popularity={}){
 const exports={};const calls=[];exports.searchCalls=calls;exports.popularityCalls=[];
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/book-search.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 exports,console,URL,Date,Math,Map,Set,Promise,require:name=>{
 if(name.includes('book-work-details'))return require('../src/lib/book-work-details');
 if(name.includes('book-read-cache'))return require('../src/lib/book-read-cache');
 if(name==='./edition-pages')return require('../src/lib/edition-pages');
 if(name.includes('book-publication'))return require('../src/lib/book-publication');
 if(name.includes('book-genres'))return require('../supabase/functions/_shared/book-genres');
 if(name.includes('book-edition-metadata'))return require('../supabase/functions/_shared/book-edition-metadata');
 if(name.includes('canonical-book-covers'))return{getCanonicalBookCoverRevision:()=>0,getCanonicalBookCover:()=>null,publishCatalogCovers:()=>{},resolveCanonicalBookCover:async()=>null};
 if(name==='./supabase')return{supabase:{functions:{invoke:async(name,{body})=>{if(name==='hardcover-search-popularity'){exports.popularityCalls.push(body);if(popularity instanceof Error)throw popularity;return{data:{popularity:typeof popularity==='function'?await popularity():popularity}};}return{data:{ok:true,data:{covers:{}}}};}}}};
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
test('unambiguous searches request cached Hardcover metadata for their ratings',async()=>{
 const api=load([book('original','H. D. Carlton','Hunting Adeline')]);await api.searchNovoriBooks('hunting Adeline');expect(api.popularityCalls).toHaveLength(1);
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
 expect(rows[0].novoriWork.googleBookIds.sort()).toEqual(['print']);
});
test('ISBNdb audio-only results are excluded from Discover search',async()=>{
 const audio={...book('audio','Freida McFadden'),source:{provider:'isbndb'},novoriEdition:{binding:'MP3 CD'},volumeInfo:{...book('audio','Freida McFadden').volumeInfo,pageCount:1}};
 const rows=await load([audio]).searchNovoriBooks('The Perfect Son Freida');
 expect(rows).toEqual([]);
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
 expect(api.popularityCalls[0].books.map(row=>row.googleBookId)).toContain('journal');
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

test('equal saves rank by reviews before star rating or provider rating counts',async()=>{
 const low=book('low','Writer','Court of Dreams'),high=book('high','Writer','Court of Stars');
 low.volumeInfo.ratingsCount=999999; low.volumeInfo.averageRating=5;
 const rows=await load([low,high],{}, {low:{usersCount:1000,reviewsCount:10,rating:5},high:{usersCount:1000,reviewsCount:50,rating:3}}).searchNovoriBooks('court');
 expect(rows.map(row=>row.id)).toEqual(['high','low']);
});
test('equal saves and reviews use query relevance before stable identifier order',async()=>{
 const rows=await load([book('a','Writer','Court of Stars'),book('z','Writer','Court')],{}, {a:{usersCount:1000,reviewsCount:50,rating:5},z:{usersCount:1000,reviewsCount:50,rating:3}}).searchNovoriBooks('court');
 expect(rows.map(row=>row.id)).toEqual(['z','a']);
});
test('author popularity uses the same save/review ordering and stable IDs',()=>{
 const api=load([]);
 const rows=[{book:book('ratings','Writer'),usersCount:10,reviewsCount:999,ratingsCount:999999,rating:5},{book:book('reviews','Writer'),usersCount:100,reviewsCount:50,ratingsCount:1,rating:3},{book:book('saves','Writer'),usersCount:200,reviewsCount:1,ratingsCount:1,rating:2}];
 expect(rows.sort(api.compareAuthorBookPopularity).map(row=>row.book.id)).toEqual(['saves','reviews','ratings']);
});
test('Hardcover review counts are attached to search results without treating rating counts as reviews',async()=>{
 const rows=await load([book('a','Writer','Court'),book('b','Writer','Court of Stars')],{}, {a:{usersCount:100,reviewsCount:1234,ratingsCount:99999,rating:4},b:{usersCount:10,reviewsCount:0,rating:3}}).searchNovoriBooks('court');
 expect(rows[0].novoriWork.hardcoverReviewsCount).toBe(1234);
 expect(rows[1].novoriWork.hardcoverReviewsCount).toBe(0);
});

test.each(['Dungeon Crawler Carl','The Hunger Games','1984','The Hobbit'])('equally ranked coverless lookalikes follow usable editions: %s',async title=>{
 const weak=book('a_missing','Wrong Writer',title);weak.volumeInfo.imageLinks=undefined;
 const good=book('z_correct','Original Writer',title);
 const rows=await load([weak,good]).searchNovoriBooks(title);
 expect(rows.map(row=>row.id)).toEqual(['z_correct','a_missing']);
 expect(rows[0].novoriWork.googleBookIds).toEqual(['z_correct']);
});
test('a single Hunger Games result receives the actual stars and rating count and is reused from cache',async()=>{
 const api=load([book('hg','Suzanne Collins','The Hunger Games')],{}, {hg:{usersCount:10000,ratingsCount:7123,reviewsCount:321,rating:4.2}});
 const first=await api.searchNovoriBooks('the hunger games');
 expect(first[0].novoriWork).toMatchObject({hardcoverRating:4.2,hardcoverRatingsCount:7123});
 const again=await api.searchNovoriBooks('THE HUNGER GAMES');
 expect(again[0].novoriWork.hardcoverRatingsCount).toBe(7123);
 expect(api.popularityCalls).toHaveLength(1);
});
test('usable-cover tie breaking never outranks a more popular matched work',async()=>{
 const popular=book('a_popular','Author One','A Novel');popular.volumeInfo.imageLinks=undefined;
 const pictured=book('z_pictured','Author Two','A Novel');
 const rows=await load([popular,pictured],{}, {a_popular:{usersCount:1000,reviewsCount:20,rating:4},z_pictured:{usersCount:2,reviewsCount:1,rating:5}}).searchNovoriBooks('a novel');
 expect(rows[0].id).toBe('a_popular');
});

test('author catalogs share normalized search results, Hardcover stats and work covers without a second popularity call',async()=>{
 const print={...book('author_book','Writer, Jane','A Novel'),source:{provider:'isbndb'},novoriEdition:{binding:'Paperback'}};
 const audio={...book('audio_book','Jane Writer','A Novel'),source:{provider:'isbndb'},novoriEdition:{binding:'Audio CD'}};
 const foreign={...book('wrong_author','Other Writer','A Novel')};
 const api=load([print,audio,foreign],{}, {author_book:{usersCount:1000,rating:4.2,ratingsCount:7000,reviewsCount:200}});
 const rows=await api.searchAuthorBooks('Jane Writer');
 expect(rows.map(row=>row.book.id)).toEqual(['author_book']);
 expect(rows[0]).toMatchObject({usersCount:1000,rating:4.2,ratingsCount:7000});
 expect(rows[0].book.novoriWork).toMatchObject({hardcoverRating:4.2,hardcoverRatingsCount:7000,hardcoverUsersCount:1000});
 expect(api.searchCalls).toEqual(['inauthor:"Jane Writer"']);expect(api.popularityCalls).toHaveLength(1);
 await api.searchAuthorBooks('Jane Writer');expect(api.searchCalls).toHaveLength(1);expect(api.popularityCalls).toHaveLength(1);
});
test('barcode and typed ISBN searches share the same enriched exact edition and reject unrelated hits',async()=>{
 const exact=book('exact','Jane Writer','A Novel');exact.volumeInfo.industryIdentifiers=[{type:'ISBN_13',identifier:'9780439023481'}];
 const wrong=book('wrong','Jane Writer','A Novel');wrong.volumeInfo.industryIdentifiers=[{type:'ISBN_13',identifier:'9780439023498'}];
 const api=load([wrong,exact],{}, {exact:{usersCount:1000,rating:4.1,ratingsCount:5000,reviewsCount:50}});
 const scan=await api.searchNovoriBookByIsbn('9780439023481');
 expect(scan.id).toBe('exact');expect(scan.novoriWork.hardcoverRatingsCount).toBe(5000);
 const typed=await api.searchNovoriBooks('9780439023481');expect(typed.map(row=>row.id)).toEqual(['exact']);
 expect(api.searchCalls).toHaveLength(1);expect(api.popularityCalls).toHaveLength(1);
 expect((await api.searchNovoriBookByIsbn('0439023483')).id).toBe('exact');
 expect(api.searchCalls).toHaveLength(1);
 expect(await api.searchNovoriBookByIsbn('invalid')).toBeNull();
});
test('available ratings are requested for every retained result rather than only the ordinary-product tier',async()=>{
 const journal=book('journal','Jane Writer','A Novel Companion Journal');
 const api=load([journal],{}, {journal:{usersCount:5,rating:3.5,ratingsCount:12,reviewsCount:1}});
 const rows=await api.searchNovoriBooks('a novel companion journal');
 expect(rows[0].novoriWork.hardcoverRatingsCount).toBe(12);
 expect(api.popularityCalls[0].books[0].googleBookId).toBe('journal');
});

test('failed rating enrichment does not cache an incomplete completed search', async()=>{
 const api=load([book('available','Jane Writer','Available Book')],{},new Error('offline'));
 expect((await api.searchNovoriBooks('Available Book'))).toHaveLength(1);
 expect((await api.searchNovoriBooks('Available Book'))).toHaveLength(1);
 expect(api.popularityCalls).toHaveLength(2);
});

test('cover-ready results arrive before deferred ratings, coalesce, and cache only final enrichment',async()=>{
 let finish;const stats=new Promise(resolve=>{finish=resolve;});
 const api=load([book('original','Jane Writer','The Book')],{},()=>stats);
 const progress=jest.fn(),late=jest.fn();
 let complete=false;
 const a=api.searchNovoriBooks('The Book',0,{onProgress:progress}).then(rows=>{complete=true;return rows;});
 for(let i=0;i<100&&!progress.mock.calls.length;i++)await Promise.resolve();
 expect(progress).toHaveBeenCalledTimes(1);expect(complete).toBe(false);
 const cover=api.getNovoriSearchBookCover(progress.mock.calls[0][0][0]);
 const b=api.searchNovoriBooks('The Book',0,{onProgress:late});
 expect(late).toHaveBeenCalledTimes(1);
 finish({original:{usersCount:200,rating:4.5,ratingsCount:100,reviewsCount:20}});
 const [rows,other]=await Promise.all([a,b]);
 expect(rows[0].novoriWork.hardcoverRatingsCount).toBe(100);
 expect(other).toEqual(rows);expect(api.getNovoriSearchBookCover(rows[0])).toBe(cover);
 expect(api.popularityCalls).toHaveLength(1);
 expect((await api.searchNovoriBooks('The Book'))[0].novoriWork.hardcoverRatingsCount).toBe(100);
 expect(api.popularityCalls).toHaveLength(1);
});
