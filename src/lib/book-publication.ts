import { cleanCatalogBookTitle, normalizeCatalogAuthor, isCatalogCollection, isCatalogSupplement } from '../../supabase/functions/_shared/book-edition-metadata';

type Book = {
 volumeInfo: { title?: string; authors?: string[]; publishedDate?: string; description?: string; subtitle?: string };
};
type SeriesBook = { title: string; authors?: string[]; releaseDate?: string | null; position?: number | null };
const key = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function validPublicationDate(value?: string | null): string | undefined {
 if (!value || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) return undefined;
 const [year, month = 1, day = 1] = value.split('-').map(Number);
 if (year < 1000 || month < 1 || month > 12 || day < 1) return undefined;
 const date = new Date(Date.UTC(year, month - 1, day));
 return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : undefined;
}

/** Work release dates and ISBN edition dates describe different publications. */
export function getBookPublication(book: Book, seriesBooks: SeriesBook[], currentPosition?: number | null) {
 const editionDate = validPublicationDate(book.volumeInfo.publishedDate);
 const title = key(cleanCatalogBookTitle(book.volumeInfo.title ?? ''));
 const authors = (book.volumeInfo.authors ?? []).map(author => key(normalizeCatalogAuthor(author)));
 const matched = title && authors.length && !isCatalogCollection(book) && !isCatalogSupplement(book)
  ? seriesBooks.find(row => (currentPosition == null || row.position === currentPosition) &&
    key(cleanCatalogBookTitle(row.title)) === title &&
    row.authors?.some(author => authors.includes(key(normalizeCatalogAuthor(author)))))
  : undefined;
 const originalDate = validPublicationDate(matched?.releaseDate);
 // A later series date is not evidence of an earlier original publication.
 const precision = Math.min(originalDate?.length ?? 0, editionDate?.length ?? 0);
 const originalIsUsable = originalDate && (!editionDate || originalDate.slice(0, precision) <= editionDate.slice(0, precision));
 return originalIsUsable
  ? { date: originalDate, label: 'First published', editionDate }
  : { date: editionDate, label: 'Edition published', editionDate };
}
