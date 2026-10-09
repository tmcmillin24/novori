import { cleanCatalogBookTitle, normalizeCatalogAuthor } from './book-edition-metadata.ts';
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
// Explicit owner choices identify an edition, never an invented artwork URL.
const preferences = [{ title: 'Threshing Day', author: 'Rebecca Yarros', isbn: '9781682818527' },
 { title: "Harry Potter and the Philosopher's Stone", author: 'J. K. Rowling', isbn: '9781781100219' },
 { title: 'Piranesi', author: 'Susanna Clarke', isbn: '9781432895082' },
 { title: 'A Promise So Bold and Broken', author: 'Sophia St. Germain', isbn: '9781496764737' },
 { title: 'Scion', author: 'James Islington', isbn: '9781668239261' }];
export function preferredCoverIsbn(book: { title?: string; authors?: string[] }) {
 return preferences.find(row => key(cleanCatalogBookTitle(book.title ?? '')) === key(row.title) &&
  (book.authors ?? []).some(author => key(normalizeCatalogAuthor(author)) === key(row.author)))?.isbn ?? null;
}

export function isPreferredCoverIsbn(isbn: string) { return preferences.some(row => row.isbn === isbn); }
