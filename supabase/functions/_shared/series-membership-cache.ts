import { catalogWorkTitleKey, normalizeCatalogAuthor } from './book-edition-metadata.ts';
const authorKey = (name: string) => normalizeCatalogAuthor(name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
const titleKey = (title: string, seriesName = '') => {
 const suffix = seriesName ? new RegExp('\\s*\\(' + seriesName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '(?:,?\\s*(?:book\\s*)?\\d+(?:\\.\\d+)?)?\\)\\s*$','i') : null;
 return catalogWorkTitleKey(suffix ? title.replace(suffix,'') : title);
};
export function memberMatches(book: any, requested: any, seriesName = '') {
 return titleKey(book.title ?? '',seriesName) === titleKey(requested.title ?? '',seriesName) &&
  (requested.authors ?? []).some((name: string)=>(book.authors ?? []).some((other: string)=>authorKey(name) === authorKey(other)));
}
export function seriesMemberKeys(book: any) {
 return [...new Set([...(book.coverBookId ? [`membership:v1:id:${book.coverBookId}`] : []),
  ...(book.authors ?? []).map((author: string)=>`membership:v1:${titleKey(book.title ?? '')}::${authorKey(author)}`)])];
}
export async function readSeriesMembership(admin: any, requested: any) {
 try {
  const {data,error} = await admin.from('book_api_cache').select('response_json').eq('provider','hardcover_series').in('request_key',seriesMemberKeys(requested)).gt('expires_at',new Date().toISOString());
  if (error) return null;
  const verified = (data ?? []).map((row: any)=>row.response_json).filter((fact: any)=>Number.isSafeInteger(fact?.series?.id) && memberMatches(fact.member ?? {},requested,fact.series.name));
  const sourceKeys = [...new Set(verified.map((fact: any)=>fact.sourceKey).filter((key: any)=>typeof key === 'string' && key.startsWith('series:')))];
  if (!sourceKeys.length) return null;
  const {data:sources,error:sourceError} = await admin.from('book_api_cache').select('request_key,response_json').eq('provider','hardcover_series').in('request_key',sourceKeys).gt('expires_at',new Date().toISOString());
  if (sourceError) return null;
  for (const fact of verified) {
   const payload = sources?.find((row: any)=>row.request_key === fact.sourceKey)?.response_json;
   if (payload?.series?.id !== fact.series.id || !Array.isArray(payload.books)) continue;
   const member = payload.books.find((book: any)=>memberMatches(book,requested,payload.series.name));
   if (member && member.position != null) return {...payload,series:{...payload.series,currentPosition:member.position}};
  }
 } catch { /* Ordinary discovery remains available. */ }
 return null;
}
export async function cacheSeriesMembership(admin: any, payload: any, sourceKey: string) {
 if (!payload?.series?.id || !payload.books?.length) return;
 try {
  const {data:source,error} = await admin.from('book_api_cache').select('fetched_at,expires_at,stale_until').eq('provider','hardcover_series').eq('request_key',sourceKey).maybeSingle();
  if (error || !source || Date.parse(source.expires_at) <= Date.now()) return;
  const facts = new Map<string,any>();
  for (const book of payload.books) if (book.position != null && book.authors?.length) {
   for (const request_key of seriesMemberKeys(book)) facts.set(request_key,{series:payload.series,member:{title:book.title,authors:book.authors,position:book.position},sourceKey});
  }
  const keys = [...facts.keys()];
  if (!keys.length) return;
  const {data:existing,error:readError} = await admin.from('book_api_cache').select('request_key,response_json,expires_at').eq('provider','hardcover_series').in('request_key',keys);
  if (readError) return;
  const rows = [...facts].filter(([key,value])=>!(existing ?? []).some((row: any)=>row.request_key === key && row.expires_at === source.expires_at && JSON.stringify(row.response_json) === JSON.stringify(value)))
   .map(([request_key,response_json])=>({provider:'hardcover_series',request_key,response_json,fetched_at:source.fetched_at,expires_at:source.expires_at,stale_until:source.stale_until,status_code:200,schema_version:1,hit_count:0,last_hit_at:null}));
  if (rows.length) await admin.from('book_api_cache').upsert(rows,{onConflict:'provider,request_key'});
 } catch { /* Derived indexing does not block a successful series. */ }
}
