import {cachedProviderValue,cachedHardcoverFetch,fetchJsonWithTimeout} from './provider-cache.ts';
import {finishProviderAttempt,noteProviderUpstream} from './provider-observability.ts';
import {safeAdminCover} from './admin-book-covers.mjs';
const DAY=86400000;
// Admin preview only: cache raw provider responses without ingesting catalog
// editions, changing identity mappings, or running any cover selector.
export async function findAdminBookCovers(admin:any,userId:string,snapshot:any,query?:unknown) {
 const info=snapshot.editions[0].metadata?.volumeInfo??{};
 const text=typeof query==='string'&&query.trim()?query.trim():`${info.title??''} ${info.authors?.[0]??''}`.trim();
 if(text.length<2||text.length>150) throw new Error('Use a title/author or ISBN up to 150 characters.');
 const options:any[]=[],warnings:string[]=[];
 const add=(url:unknown,detail:any)=>{const safe=safeAdminCover(url);if(safe)options.push({...detail,url:safe});};
 const results=await Promise.allSettled([
  (async()=>{
   const key=Deno.env.get('ISBNDB_API_KEY');if(!key)throw new Error('ISBNdb is not configured.');
   const isbn=/^\d{13}$/.test(text);
   const path=isbn?`/book/${text}`:`/books/${encodeURIComponent(text)}?page=1&pageSize=20`;
   const raw:any=await cachedProviderValue({admin,provider:'isbndb',key:`admin-cover-preview:v1:${text.toLowerCase()}`,freshMs:DAY,staleMs:7*DAY,load:async()=>{
    const requestId=crypto.randomUUID();
    const claim=await admin.rpc('novori_begin_isbndb_request',{p_user_id:userId,p_request_id:requestId,p_route:'admin_cover_preview'});
    if(claim.error||!(Array.isArray(claim.data)?claim.data[0]:claim.data)?.allowed)throw new Error('ISBNdb quota or rate limit reached. Try again shortly.');
    noteProviderUpstream(admin,'isbndb','admin_cover_preview');
    const response=await fetchJsonWithTimeout('https://api2.isbndb.com'+path,{headers:{Authorization:key}});
    await finishProviderAttempt(admin,requestId,response,'isbndb');
    if(response.status===404)return {};
    if(!response.ok)throw new Error('ISBNdb lookup failed.');return response.json();
   }});
   for(const b of raw.books??(raw.book?[raw.book]:[]))add(b.image,{provider:'isbndb',title:b.title,authors:b.authors,isbn:b.isbn13??b.isbn,publisher:b.publisher,publishedDate:b.date_published,language:b.language});
  })(),
  (async()=>{
   const token=Deno.env.get('HARDCOVER_API_TOKEN');if(!token)throw new Error('Hardcover is not configured.');
   const response=await cachedHardcoverFetch(admin,'https://api.hardcover.app/v1/graphql',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body:JSON.stringify({query:'query AdminCoverSearch($query:String!){search(query:$query,query_type:"Book",per_page:20,page:1){results}}',variables:{query:text}}),
   },DAY,7*DAY,'hardcover_admin_cover_preview');
   const payload=await response.json();let result=payload?.data?.search?.results;
   if(typeof result==='string')result=JSON.parse(result);
   for(const hit of result?.hits??[]) {const b=hit.document??hit;add(b.image?.url??b.image,{provider:'hardcover',title:b.title,authors:b.author_names,isbn:b.isbns?.[0]});}
  })(),
 ]);
 results.forEach((result,i)=>{if(result.status==='rejected')warnings.push(`${i===0?'ISBNdb':'Hardcover'} options unavailable. Cached options remain available.`);});
 return {options,warnings};
}
