import { matchesSeriesCatalogEdition } from './series-book-catalog.ts';
import { audioEditionPenalty } from './book-edition-metadata.ts';
import { preferredCoverIsbn } from './catalog-cover-preferences.ts';
/** Recover publisher artwork already cached in edition metadata; no upstream calls. */
export function cachedEditionCover(edition: any): string | null {
 if (!['isbndb', 'google_books'].includes(edition.provider)) return null;
 const info = edition.metadata?.volumeInfo;
 if (!info || !matchesSeriesCatalogEdition(info, edition)) return null;
 const links = info.imageLinks ?? {};
 for (const variant of ['extraLarge', 'large', 'medium', 'small', 'thumbnail', 'smallThumbnail']) {
  try { const url = new URL(links[variant]);
   if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password &&
       !/placeholder|no[-_]?image|no[-_]?cover/i.test(url.pathname)) { url.protocol = 'https:'; return url.toString(); }
  } catch { /* Missing images are normal. */ }
 }
 return null;
}
export function cachedWorkCovers(editions: any[]) {
 const choices = new Map<string, any>();
 const isPreferred = (row: any) => {
  const isbn = preferredCoverIsbn(row.metadata.volumeInfo);
  return Boolean(isbn && isbn === row.isbn_13);
 };
 const rank = (row: any) => [Number(!isPreferred(row)),
  audioEditionPenalty(row.metadata), Number(row.provider !== 'isbndb')];
 for (const row of [...editions].filter(row => row.work_id && cachedEditionCover(row)).sort((a,b) => {
  const left = rank(a), right = rank(b);
  for (let i=0;i<left.length;i++) if (left[i] !== right[i]) return left[i]-right[i];
  return String(a.id ?? a.provider_book_id).localeCompare(String(b.id ?? b.provider_book_id));
 })) if (!choices.has(row.work_id)) choices.set(row.work_id, { url: cachedEditionCover(row), provider: row.provider, scope: 'edition', source_variant: 'cached_metadata', preferred: isPreferred(row), score: isPreferred(row) ? 1000 : 0 });
 return choices;
}
