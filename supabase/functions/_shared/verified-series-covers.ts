import { hardcoverTextEdition } from './hardcover-discovery-policy.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { matchesSeriesCatalogEdition } from './series-book-catalog.ts';
import { cleanCatalogBookTitle, normalizeCatalogAuthor } from './book-edition-metadata.ts';
import { selectCanonicalGoogleCoversForWorkIds } from './book-cover-selector.ts';
import { isEnglishBookLanguage } from './book-language.ts';
const titleKey = (value: string) => cleanCatalogBookTitle(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const authorKey = (name: string) => normalizeCatalogAuthor(name).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Choose artwork from the same edition that supplies the language and title.
 * A work's cached_image is NOT evidence of English artwork.
 */
export function verifiedEnglishSeriesArt(book: any, releasedOnly = false) {
 const choices = [book?.default_cover_edition, ...(book?.editions ?? [])].filter(Boolean).filter((edition: any) =>
  Number.isSafeInteger(edition.id) && edition.id > 0 &&
  [edition.language?.code2, edition.language?.code3, edition.language?.language].some(isEnglishBookLanguage) &&
  typeof edition.title === 'string' && titleKey(edition.title) === titleKey(book.title ?? '') &&
  !edition.compilation && !/audio/i.test(edition.reading_format?.format ?? '') &&
  (!releasedOnly || hardcoverTextEdition(edition,book.title ?? '')) &&
  [edition.isbn_13, edition.isbn_10].some(value => typeof value === 'string' && /^(?:\d{13}|\d{9}[\dX])$/.test(value)) &&
  typeof edition.image?.url === 'string'
 ).sort((a: any, b: any) => {
  const primary = (e: any) => e.id === book.default_cover_edition?.id || e.image?.url === book.image?.url ? 0 : 1;
  const print = (e: any) => /physical|print|paperback|hardcover/i.test(e.reading_format?.format ?? '') ? 0 : 1;
  const date = (e: any) => /^\d{4}(?:-\d{2})?(?:-\d{2})?$/.test(e.release_date ?? '') ? e.release_date : '9999';
  return primary(a) - primary(b) || print(a) - print(b) || date(a).localeCompare(date(b)) || a.id - b.id;
 });
 for (const edition of choices) {
  try {
   const url = new URL(edition.image.url);
   if (url.protocol !== 'https:' || url.username || url.password || /placeholder|no[-_]?image|no[-_]?cover/i.test(url.pathname) || url.searchParams.has('Expires') || url.searchParams.has('X-Amz-Signature')) continue;
   return { version: 1, editionId: edition.id, title: edition.title, language: 'en',
    isbn: edition.isbn_13 || edition.isbn_10, url: url.toString(),
    format: edition.reading_format?.format ?? edition.physical_format ?? null,
    nonAudio: hardcoverTextEdition(edition, book.title ?? '') };
  } catch { /* An invalid edition image does not justify using the work image. */ }
 }
 return null;
}

/** Catalog-only identity verification before restoring Hardcover's series art.
 * No ISBN alone can attach artwork. Existing manual locks remain authoritative.
 */
export async function promoteVerifiedSeriesCovers(admin: SupabaseClient, payload: any, requestedAuthors: string[]) {
 if (!payload?.series || !Array.isArray(payload.books) || !requestedAuthors.length) return;
 const wanted = requestedAuthors.map(authorKey);
 const rows = payload.books.filter((row: any) => row?.authors?.some((name: string) => wanted.includes(authorKey(name))));
 const isbns = [...new Set<string>(rows.flatMap((row: any) => row.isbns ?? []))];
 const editions: any[] = [];
 for (const column of ['isbn_13', 'isbn_10']) {
  const values = isbns.filter(isbn => typeof isbn === 'string' && /^(?:\d{13}|\d{9}[\dX])$/.test(isbn) && isbn.length === (column === 'isbn_13' ? 13 : 10));
  if (!values.length) continue;
  const { data, error } = await admin.from('book_editions').select('id,work_id,provider_book_id,isbn_13,isbn_10,metadata,language')
   .in('provider', ['google_books', 'isbndb']).in(column, values);
  if (error) throw error;
  editions.push(...(data ?? []));
 }
 const ids = [...new Set<string>(rows.map((row: any) => row.coverBookId).filter(Boolean))];
 if (ids.length) {
  const { data, error } = await admin.from('book_editions').select('id,work_id,provider_book_id,isbn_13,isbn_10,metadata,language')
   .in('provider', ['google_books', 'isbndb']).in('provider_book_id', ids);
  if (error) throw error;
  editions.push(...(data ?? []));
 }
 const workIds: string[] = [];
 for (const row of rows) {
  const proof = row.coverEdition;
  if (proof?.version !== 1 || !Number.isSafeInteger(proof.editionId) || proof.editionId <= 0 || !isEnglishBookLanguage(proof.language) ||
      !/^(?:\d{13}|\d{9}[\dX])$/.test(proof.isbn ?? '') || !row.isbns?.includes(proof.isbn) ||
      !proof.title || titleKey(proof.title) !== titleKey(row.title) || proof.url !== row.imageUrl) continue;
  let url: URL;
  try { url = new URL(row.imageUrl); } catch { continue; }
  if (url.protocol !== 'https:' || url.username || url.password || /placeholder|no[-_]?image|no[-_]?cover/i.test(url.pathname) || url.searchParams.has('Expires') || url.searchParams.has('X-Amz-Signature')) continue;
  const edition = [...editions].sort((a, b) => Number(b.provider_book_id === row.coverBookId) - Number(a.provider_book_id === row.coverBookId)).find(edition => (row.coverBookId === edition.provider_book_id || row.isbns?.includes(edition.isbn_13) || row.isbns?.includes(edition.isbn_10)) && matchesSeriesCatalogEdition(row, edition));
  if (!edition?.work_id || !edition.id || !Number.isSafeInteger(row.id)) continue;
  const { error } = await admin.from('book_cover_candidates').upsert({
   work_id: edition.work_id, edition_id: edition.id, provider: 'hardcover', source_variant: 'series_verified',
   scope: 'edition', source_kind: 'series_cover', external_id: String(row.id), url: url.toString(),
   candidate_key: `hardcover:${row.id}:${edition.provider_book_id}:series_verified`,
   discovery_source: 'hardcover_series_verified', last_seen_at: new Date().toISOString(),
   source_metadata: { hardcoverBookId: row.id, seriesId: payload.series.id, seriesPosition: row.position, coverEdition: proof },
  }, { onConflict: 'candidate_key' });
  if (error) throw error;
  workIds.push(edition.work_id);
 }
 if (workIds.length) await selectCanonicalGoogleCoversForWorkIds(admin, [...new Set(workIds)]);
}
