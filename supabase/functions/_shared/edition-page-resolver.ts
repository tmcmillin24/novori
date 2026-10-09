import { editionIsbn, readEditionPages, samePageEdition, validPageCount } from './edition-pages.ts';
import { audioEditionPenalty } from './book-edition-metadata.ts';
import { cachedHardcoverFetch, cachedProviderValue } from './provider-cache.ts';
const DAY=86400000;
export function hardcoverPageFact(book: any, rows: any[]) {
 const isbn=editionIsbn(book);
 for(const row of rows) {
  const format=row.reading_format?.format ?? '';
  if(row.isbn_13!==isbn || row.compilation || Number(row.audio_seconds)>0 || row.reading_format_id===2 ||
   !/physical|print|paper|hardcover|hardback|ebook|digital|e-book/i.test(format) || /audio/i.test(format))continue;
  const candidate={source:{isbn13:row.isbn_13},volumeInfo:{title:row.book?.title,authors:(row.book?.contributions ?? []).map((item:any)=>item.author?.name).filter(Boolean),pageCount:validPageCount(row.pages)}};
  if(candidate.volumeInfo.pageCount && samePageEdition(book,candidate))return candidate.volumeInfo.pageCount;
 }
 return null;
}
export async function resolveEditionPageCount(admin:any,row:any,token:string|undefined) {
 const book=row.metadata;const isbn=editionIsbn(book);
 if(!isbn || !book || audioEditionPenalty(book))return null;
 const cached=await readEditionPages(admin,[row],{persist:false});
 let count=cached[row.provider_book_id]?.pageCount;
 if(!count && token) {
  const fact:any=await cachedProviderValue({admin,provider:'hardcover_series',key:`page-lookup:v1:${isbn}`,freshMs:30*DAY,staleMs:60*DAY,leaseSeconds:60,
   valueLifetime:value=>value===null?{freshMs:6*3600000,staleMs:6*3600000}:{freshMs:30*DAY,staleMs:60*DAY},
   load:async()=>{
    const query=`query NovoriEditionPages($isbn: String!) { editions(where: {isbn_13: {_eq: $isbn}}, limit: 10) { isbn_13 pages compilation audio_seconds reading_format_id reading_format { format } book { title contributions { author { name } } } } }`;
    const response=await cachedHardcoverFetch(admin,'https://api.hardcover.app/v1/graphql',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({query,variables:{isbn}})},6*3600000,6*3600000,'hardcover_series');
    const raw=await response.json();
    const pages=hardcoverPageFact(book,raw.data?.editions ?? []);
    return pages?{source:{isbn13:isbn},volumeInfo:{title:book.volumeInfo.title,authors:book.volumeInfo.authors,pageCount:pages}}:null;
   }});
  count=fact && samePageEdition(book,fact)?validPageCount(fact.volumeInfo.pageCount):undefined;
 }
 if(!count)return null;
 // Persist before reporting success, so recaps and every cached detail agree.
 const {data,error}=await admin.rpc('novori_store_edition_pages',{p_book_id:row.provider_book_id,p_isbn:isbn,p_page_count:count});
 if(error || !validPageCount(data))throw new Error('Could not persist edition pages.');
 return {isbn,pageCount:Number(data)};
}
