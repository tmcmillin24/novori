export function amazonBookSearchUrl(book: { isbn?: string | null; title: string; authors?: string[] | null }) {
  const isbn = (book.isbn ?? '').replace(/[\s-]/g, '').toUpperCase();
  const query = /^(?:\d{13}|\d{9}[\dX])$/.test(isbn)
    ? isbn : [book.title.trim(), ...(book.authors ?? [])].filter(Boolean).join(' ');
  return `https://www.amazon.com/s?i=stripbooks&k=${encodeURIComponent(query)}`;
}
