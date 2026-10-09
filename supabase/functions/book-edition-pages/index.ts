import { providerTrace, noteProviderCache } from '../_shared/provider-observability.ts';
import { createCacheAdmin, requireReader } from '../_shared/provider-cache.ts';
import { resolveEditionPageCount } from '../_shared/edition-page-resolver.ts';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Content-Type':'application/json','Cache-Control':'no-store'};
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers});
 if(request.method!=='POST')return new Response(JSON.stringify({ok:false}),{status:405,headers});
 try {
  const admin=createCacheAdmin();
  try {await requireReader(admin,request);} catch {return new Response(JSON.stringify({ok:false,error:'Sign in to view book pages.'}),{status:401,headers});}
  const {volumeId}=await request.json();
  if(typeof volumeId!=='string' || !/^[A-Za-z0-9_-]{1,200}$/.test(volumeId))return new Response(JSON.stringify({ok:false}),{status:400,headers});
  const {data,error}=await admin.from('book_editions').select('provider,provider_book_id,isbn_13,page_count,metadata').eq('provider_book_id',volumeId).in('provider',['isbndb','google_books']).limit(20);
  if(error)throw error;
  const edition=data?.find((row:any)=>row.provider==='isbndb' && row.metadata?.volumeInfo?.title) ?? data?.find((row:any)=>row.metadata?.volumeInfo?.title);
  const fact=edition?await resolveEditionPageCount(admin,edition,Deno.env.get('HARDCOVER_API_TOKEN')):null;
  if(fact && !Object.keys(providerTrace(admin).upstream).length)noteProviderCache(admin,'edition_pages','hit-catalog',volumeId);
  return new Response(JSON.stringify({ok:true,cacheTrace:providerTrace(admin),pageCounts:fact?{[volumeId]:fact}:{}}),{headers});
 } catch {return new Response(JSON.stringify({ok:false,error:'Page count is temporarily unavailable.'}),{status:503,headers});}
});
