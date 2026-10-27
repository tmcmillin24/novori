/** Title/author searches work across regional editions that Amazon may not index by ISBN. */
export function amazonBookSearchUrl(book: { isbn?: string | null; title: string; authors?: string[] | null }) {
  const titleAndAuthor = [book.title.trim(), ...(book.authors ?? []).map(author => author.trim())].filter(Boolean).join(' ');
  const isbn = (book.isbn ?? '').replace(/[\s-]/g, '').toUpperCase();
  const query = titleAndAuthor || (/^(?:\d{13}|\d{9}[\dX])$/.test(isbn) ? isbn : 'books');
  return `https://www.amazon.com/s?i=stripbooks&k=${encodeURIComponent(query)}`;
}
