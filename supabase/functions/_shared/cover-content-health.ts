// ISBNdb sometimes serves a successful JPEG containing its missing-cover graphic.
// Reject only an identified provider placeholder, never a grayscale/low-detail book.
export const ISBNDB_PLACEHOLDER_SHA256 = '7630cf533baa09196736692b89ca6114190c7219dc8492efdf836f14359f993b';
const memory = new Map<string, { status: string; expires_at: string }>();
const flights = new Map<string, Promise<string | null>>();
function trusted(url: string) {
 try { const u = new URL(url); return u.protocol === 'https:' && u.hostname === 'images.isbndb.com' && !u.username && !u.password && /^\/covers\//.test(u.pathname); } catch { return false; }
}
export async function coverContentStatus(bytes: Uint8Array): Promise<'placeholder' | 'image' | null> {
 const image = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ||
  bytes.slice(0,8).join(',') === '137,80,78,71,13,10,26,10' ||
  new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP';
 if (!image) return null;
 const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource))].map(value=>value.toString(16).padStart(2,'0')).join('');
 return hash === ISBNDB_PLACEHOLDER_SHA256 ? 'placeholder' : 'image';
}
async function probe(admin: any, url: string, fetcher: typeof fetch) {
 const running=flights.get(url); if(running)return running;
 const flight=(async()=>{
  try {
   const response=await fetcher(url,{signal:AbortSignal.timeout(2000),redirect:'error'});
   // A timeout, authorization failure or CDN outage is not a permanent art rejection.
   if(!response.ok){
    await response.body?.cancel();
    if(response.status!==404 && response.status!==410)return null;
    const row={url,status:'missing',expires_at:new Date(Date.now()+15*60_000).toISOString()};
    memory.set(url,row);await admin.from('book_cover_content_health').upsert(row,{onConflict:'url'});return 'missing';
   }
   const reader=response.body?.getReader(); if(!reader)return null;
   const chunks:Uint8Array[]=[]; let size=0;
   try { for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>256_000){await reader.cancel();return null;}chunks.push(part.value);} }
   finally {reader.releaseLock();}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const status=await coverContentStatus(bytes);if(!status)return null;
   const row={url,status,expires_at:new Date(Date.now()+(status==='placeholder'?7:30)*86400_000).toISOString()};
   memory.set(url,row);while(memory.size>2000)memory.delete(memory.keys().next().value!);
   const {error}=await admin.from('book_cover_content_health').upsert(row,{onConflict:'url'});
   if(error)console.warn('Could not cache cover content verification');
   return status;
  }catch{return null;}
 })();flights.set(url,flight);
 try{return await flight;}finally{flights.delete(url);}
}
/** Cached CDN-byte checks, not book-provider API calls. Manual/Hardcover art is excluded. */
export async function rejectedCoverContent(admin:any, urls:string[], fetcher:typeof fetch=fetch):Promise<Set<string>> {
 const unique=[...new Set(urls.filter(trusted))];const rejected=new Set<string>();if(!unique.length)return rejected;
 const now=Date.now();const unresolved:string[]=[];
 for(const url of unique){const row=memory.get(url);if(row && Date.parse(row.expires_at)>now){if(row.status!=='image')rejected.add(url);}else unresolved.push(url);}
 if(!unresolved.length)return rejected;
 try {
  // Fail open when migration/storage is unavailable; never blank healthy covers.
  const {data,error}=await admin.from('book_cover_content_health').select('url,status,expires_at').in('url',unresolved).gt('expires_at',new Date(now).toISOString());
  if(error)return rejected;
  const cached=new Set<string>();for(const row of data??[]){if(Date.parse(row.expires_at)<=now)continue;cached.add(row.url);memory.set(row.url,row);if(row.status!=='image')rejected.add(row.url);}
  // Bound cold work for large catalogs; later reads verify remaining candidates.
  await Promise.all(unresolved.filter(url=>!cached.has(url)).slice(0,16).map(async url=>{const status=await probe(admin,url,fetcher);if(status==='placeholder'||status==='missing')rejected.add(url);}));
 }catch{/* Verification failure must not erase existing artwork. */}
 return rejected;
}
