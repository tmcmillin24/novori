import { bookPublicationKeys, resolveBookPublication, validPublicationDate } from './book-edition-metadata.ts';

/** Derived Hardcover facts reuse the existing cache; no upstream requests. */
export async function cacheSeriesPublications(admin: any, payload: any) {
 const facts = new Map<string, any>();
 for (const book of payload?.books ?? []) {
  if (!validPublicationDate(book.releaseDate)) continue;
  const fact = { title: book.title, authors: book.authors, releaseDate: book.releaseDate };
  for (const key of bookPublicationKeys(fact)) facts.set(key, fact);
 }
 if (!facts.size) return;
 try {
  const { data, error } = await admin.from('book_api_cache').select('request_key,response_json,stale_until')
   .eq('provider', 'hardcover_series').in('request_key', [...facts.keys()]);
  if (error) throw error;
  const existing = new Map((data ?? []).map((row: any) => [row.request_key, row]));
  const now = Date.now();
  const rows = [...facts].filter(([key, fact]) => {
   const previous: any = existing.get(key);
   return !previous || Date.parse(previous.stale_until) <= now || JSON.stringify(previous.response_json) !== JSON.stringify(fact);
  }).map(([request_key, response_json]) => ({ provider: 'hardcover_series', request_key, response_json,
   status_code: 200, fetched_at: new Date(now).toISOString(), expires_at: new Date(now + 14 * 86400000).toISOString(),
   stale_until: new Date(now + 90 * 86400000).toISOString(), schema_version: 1, hit_count: 0, last_hit_at: null }));
  if (rows.length) {
   const { error: writeError } = await admin.from('book_api_cache').upsert(rows, { onConflict: 'provider,request_key' });
   if (writeError) throw writeError;
  }
 } catch (error) {
  console.warn('Could not cache series publication dates:', error);
 }
}

export async function readCatalogPublications(admin: any, editions: any[]) {
 const keys = [...new Set(editions.flatMap(edition => bookPublicationKeys(edition.metadata?.volumeInfo ?? {})))];
 if (!keys.length) return {};
 // Existing series responses predate the derived index. Reuse exact cached
 // requests in this same lookup, so already-viewed books need no cache purge.
 const normalize = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
 const legacyKeys = editions.flatMap(edition => {
  const info = edition.metadata?.volumeInfo;
  if (!info?.title || !info.authors?.length) return [];
  const isbns = [...new Set<string>((info.industryIdentifiers ?? []).map((id: any) => String(id.identifier ?? '').replace(/[^0-9Xx]/g, '').toUpperCase()).filter(Boolean))].sort();
  return [['series:v2:english-isbns', isbns.join(','), normalize(info.title), info.authors.map(normalize).join('|')].join('::')];
 });
 try {
  const { data, error } = await admin.from('book_api_cache').select('request_key,response_json')
   .eq('provider', 'hardcover_series').in('request_key', [...new Set([...keys, ...legacyKeys])]).gt('stale_until', new Date().toISOString());
  if (error) throw error;
  const facts = new Map((data ?? []).map((row: any) => [row.request_key, row.response_json]));
  for (const row of data ?? []) {
   for (const book of row.response_json?.books ?? []) {
    if (!validPublicationDate(book.releaseDate)) continue;
    const fact = { title: book.title, authors: book.authors, releaseDate: book.releaseDate };
    for (const key of bookPublicationKeys(fact)) if (!facts.has(key)) facts.set(key, fact);
   }
  }
  const publications: Record<string, any> = {};
  for (const edition of editions) {
   const book = edition.metadata;
   if (!book?.volumeInfo) continue;
   const fact: any = bookPublicationKeys(book.volumeInfo).map(key => facts.get(key)).find(Boolean);
   if (fact && resolveBookPublication({ ...book, novoriPublication: fact }, []).label === 'First published')
    publications[edition.provider_book_id] = fact;
  }
  return publications;
 } catch (error) {
  console.warn('Could not read catalog publication dates:', error);
  return {};
 }
}
