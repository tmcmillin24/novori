import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cleanCatalogBookTitle, normalizeCatalogAuthor, isCatalogCollection, isCatalogSupplement } from './book-edition-metadata.ts';
import { isEnglishBookLanguage } from './book-language.ts';

const key = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export function matchesSeriesCatalogEdition(book: any, edition: any): boolean {
 const info = edition.metadata?.volumeInfo;
 if (!info || !isEnglishBookLanguage(info.language ?? edition.language)) return false;
 if (isCatalogCollection(edition.metadata) || isCatalogSupplement(edition.metadata)) return false;
 if (key(cleanCatalogBookTitle(info.title ?? '')) !== key(cleanCatalogBookTitle(book.title ?? ''))) return false;
 const authors: string[] = book.authors ?? [];
 return authors.length > 0 && authors.some(author => (info.authors ?? []).some((candidate: string) =>
  key(normalizeCatalogAuthor(candidate)) === key(normalizeCatalogAuthor(author))));
}

/** Resolve artwork identities in the existing catalog, without upstream API requests. */
export async function attachSeriesCatalogIdentities(admin: SupabaseClient, payload: any) {
 if (!Array.isArray(payload?.books)) return payload;
 const isbns = [...new Set<string>(payload.books.flatMap((book: any) => book.isbns ?? []))];
 const rows: any[] = [];
 for (const column of ['isbn_13', 'isbn_10'] as const) {
  const wanted = isbns.filter(value => typeof value === 'string' && value.length === (column === 'isbn_13' ? 13 : 10));
  if (!wanted.length) continue;
  const { data, error } = await admin.from('book_editions')
   .select('provider_book_id,isbn_13,isbn_10,language,metadata')
   .in('provider', ['google_books', 'isbndb']).in(column, wanted);
  if (error) throw new Error('Could not verify series artwork identities: ' + error.message);
  rows.push(...(data ?? []));
 }
 const exactEdition = (book: any) => {
  const wanted = new Set(book.isbns ?? []);
  return rows.find(row => (wanted.has(row.isbn_13) || wanted.has(row.isbn_10)) && matchesSeriesCatalogEdition(book, row));
 };
 // Hardcover may list a different English printing than the one already cached.
 // Look up the work in bulk, then verify each edition's own title/author/language.
 const unresolved = payload.books.filter((book: any) => !exactEdition(book));
 const titles = [...new Set(unresolved.map((book: any) => key(cleanCatalogBookTitle(book.title ?? ''))).filter(Boolean))];
 const alternatives: any[] = [];
 if (titles.length) {
  const { data: works, error } = await admin.from('book_works').select('id').in('normalized_title', titles);
  if (error) throw new Error('Could not find cached series works: ' + error.message);
  if (works?.length) {
   const { data, error: editionError } = await admin.from('book_editions')
    .select('provider_book_id,isbn_13,isbn_10,language,metadata')
    .in('provider', ['google_books', 'isbndb']).in('work_id', works.map((work: any) => work.id));
   if (editionError) throw new Error('Could not verify cached series editions: ' + editionError.message);
   alternatives.push(...(data ?? []));
  }
 }
 return { ...payload, books: payload.books.map((book: any) => {
  const edition = exactEdition(book) ?? alternatives.find(row => matchesSeriesCatalogEdition(book, row));
  return { ...book, imageUrl: null, coverBookId: edition?.provider_book_id ?? null };
 }) };
}
