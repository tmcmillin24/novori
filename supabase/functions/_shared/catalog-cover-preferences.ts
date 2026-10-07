import { cleanCatalogBookTitle, normalizeCatalogAuthor } from './book-edition-metadata.ts';
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
// Explicit owner choices identify an edition, never an invented artwork URL.
const preferences = [{ title: 'Threshing Day', author: 'Rebecca Yarros', isbn: '9781682818527' }];
export function preferredCoverIsbn(book: { title?: string; authors?: string[] }) {
 return preferences.find(row => key(cleanCatalogBookTitle(book.title ?? '')) === key(row.title) &&
  (book.authors ?? []).some(author => key(normalizeCatalogAuthor(author)) === key(row.author)))?.isbn ?? null;
}
