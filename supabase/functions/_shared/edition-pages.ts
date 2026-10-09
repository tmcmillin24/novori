import { audioEditionPenalty, catalogWorkTitleKey, normalizeCatalogAuthor } from './book-edition-metadata.ts';
import { validPageCount } from './page-count.ts';
export { validPageCount } from './page-count.ts';
export function editionIsbn(book: any): string | undefined {
 const values = [book?.source?.isbn13, ...(book?.volumeInfo?.industryIdentifiers ?? []).filter((id: any)=>id.type === 'ISBN_13' || id.type === 'ISBN_10').map((id: any)=>id.identifier)];
 for (const value of values) {
  if (typeof value !== 'string') continue;
  const isbn = value.replace(/[\s-]/g,'').toUpperCase();
  if (/^(978|979)\d{10}$/.test(isbn) && [...isbn].reduce((sum,digit,i)=>sum+Number(digit)*(i%2?3:1),0)%10 === 0) return isbn;
  if (/^\d{9}[\dX]$/.test(isbn) && [...isbn].reduce((sum,digit,i)=>sum+(digit === 'X'?10:Number(digit))*(10-i),0)%11 === 0) {
   const prefix = '978'+isbn.slice(0,9);
   const sum = [...prefix].reduce((total,digit,i)=>total+Number(digit)*(i%2?3:1),0);
   return prefix+((10-sum%10)%10);
  }
 }
 return undefined;
}
const authorKey = (name: string) => normalizeCatalogAuthor(name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
export function samePageEdition(book: any, candidate: any) {
 return Boolean(editionIsbn(book)) && editionIsbn(book) === editionIsbn(candidate) &&
  !audioEditionPenalty(book) && !audioEditionPenalty(candidate) &&
  catalogWorkTitleKey(book.volumeInfo?.title ?? '') === catalogWorkTitleKey(candidate.volumeInfo?.title ?? '') &&
  (book.volumeInfo?.authors ?? []).some((name: string)=>(candidate.volumeInfo?.authors ?? []).some((other: string)=>authorKey(name) === authorKey(other)));
}
/** Reuse exact-edition metadata only; artwork and work popularity are irrelevant. */
export async function readEditionPages(admin: any, editions: any[]) {
 const result: Record<string, any> = {};
 const missing = editions.filter(row=>row.metadata && !audioEditionPenalty(row.metadata) && !(validPageCount(row.metadata?.volumeInfo?.pageCount) ?? validPageCount(row.page_count)));
 let candidates: any[] = [];
 const isbns = [...new Set(missing.map(row=>editionIsbn(row.metadata)).filter(Boolean))];
 if (isbns.length) {
  try {
   const {data,error} = await admin.from('book_editions').select('provider,provider_book_id,isbn_13,page_count,metadata').in('isbn_13',isbns);
   if (!error) candidates = data ?? [];
   const {data:facts,error:factError} = await admin.from('book_api_cache').select('response_json').eq('provider','hardcover_series').in('request_key',isbns.map(isbn=>`edition-pages:v1:${isbn}`)).gt('stale_until',new Date().toISOString());
   if (!factError) candidates.push(...(facts ?? []).map((row: any)=>({provider:'hardcover',metadata:row.response_json})));
  } catch { /* Missing supplementary cache data never prevents opening a book. */ }
 }
 for (const row of editions) {
  const book = row.metadata;
  if (!book || audioEditionPenalty(book)) continue;
  const isbn = editionIsbn(book);
  if (!isbn) continue;
  let pages = validPageCount(book.volumeInfo?.pageCount) ?? validPageCount(row.page_count);
  if (!pages) {
   const matching = candidates.filter(candidate=>samePageEdition(book,candidate.metadata)).sort((a,b)=>Number(b.provider === 'isbndb')-Number(a.provider === 'isbndb'));
   pages = matching.map(candidate=>validPageCount(candidate.metadata?.volumeInfo?.pageCount) ?? validPageCount(candidate.page_count)).find(Boolean);
  }
  if (pages) result[row.provider_book_id] = {isbn,pageCount:pages};
 }
 return result;
}

/** Index pages learned during the existing series request, never fetch by artwork. */
export async function cacheSeriesEditionPages(admin: any, books: any[], sourceExpiresAt: number) {
 if (!Number.isFinite(sourceExpiresAt) || sourceExpiresAt <= Date.now()) return;
 const facts = new Map<string,any>();
 for (const book of books) {
  const authors = (book.contributions ?? []).map((item: any)=>item.author?.name).filter(Boolean);
  if (!authors.length) continue;
  for (const edition of book.editions ?? []) {
   const pages = validPageCount(edition.pages);
   const isbn = edition.isbn_13;
   const format = edition.reading_format?.format ?? '';
   if (!pages || !/^(978|979)\d{10}$/.test(isbn ?? '') || /audio|spoken|mp3/i.test(format) || edition.compilation ||
       !/physical|print|paper|hardcover|hardback|ebook|e-book|digital/i.test(format) ||
       ![edition.language?.code2,edition.language?.code3].some(value=>value === 'en' || value === 'eng') ||
       catalogWorkTitleKey(edition.title ?? '') !== catalogWorkTitleKey(book.title ?? '')) continue;
   facts.set(`edition-pages:v1:${isbn}`,{source:{provider:'hardcover',isbn13:isbn},volumeInfo:{title:book.title,authors,pageCount:pages,industryIdentifiers:[{type:'ISBN_13',identifier:isbn}]}});
  }
 }
 if (!facts.size) return;
 try {
  const {data,error} = await admin.from('book_api_cache').select('request_key,response_json,expires_at').eq('provider','hardcover_series').in('request_key',[...facts.keys()]);
  if (error) return;
  const expires_at = new Date(sourceExpiresAt).toISOString();
  const rows = [...facts].filter(([key,value])=>!(data ?? []).some((row: any)=>row.request_key === key && row.expires_at === expires_at && JSON.stringify(row.response_json) === JSON.stringify(value)))
   .map(([request_key,response_json])=>({provider:'hardcover_series',request_key,response_json,expires_at,fetched_at:new Date(sourceExpiresAt-14*86400000).toISOString(),stale_until:new Date(sourceExpiresAt+76*86400000).toISOString(),status_code:200,schema_version:1,hit_count:0,last_hit_at:null}));
  if (rows.length) await admin.from('book_api_cache').upsert(rows,{onConflict:'provider,request_key'});
 } catch { /* Optional page metadata cannot block series resolution. */ }
}
