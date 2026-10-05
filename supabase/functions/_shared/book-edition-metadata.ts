type EditionBook = {
 source?: { provider?: string };
 novoriEdition?: { binding?: string; format?: string };
 volumeInfo: { title?: string; description?: string; authors?: string[]; pageCount?: number };
};

export function normalizeCatalogAuthor(name: string) {
 const parts = name.trim().split(',').map(part => part.trim());
 if (parts.length !== 2 || !parts.every(Boolean) || /^(?:jr\.?|sr\.?|ii|iii|iv|inc\.?|ltd\.?)$/i.test(parts[1]) || /[&\d]/.test(name)) return name.trim();
 return `${parts[1]} ${parts[0]}`;
}

export function editionFormat(book: EditionBook): 'audio' | 'print' | 'ebook' | 'unknown' {
 if (['audio','print','ebook'].includes(book.novoriEdition?.format ?? '')) return book.novoriEdition!.format as 'audio' | 'print' | 'ebook';
 const binding = book.novoriEdition?.binding ?? '';
 if (/\b(?:audio(?:book)?|mp3|cassette|spoken word)\b|^cd$/i.test(binding)) return 'audio';
 if (/\b(?:ebook|e-book|kindle|digital text)\b/i.test(binding)) return 'ebook';
 if (/\b(?:paperback|hardcover|hardback|board book|mass market|binding)\b/i.test(binding)) return 'print';
 // Legacy ISBNdb responses omitted binding. Use explicit format labels only,
 // not a plot's incidental mention of a CD, narrator, or audiobook.
 if (/^\s*(?:mp3\s+cd\s+format|audio\s+cd\s+format|audiobook\s+(?:format|edition))\b/i.test(book.volumeInfo.description ?? '')
   || /\((?:unabridged\s+)?(?:audiobook|audio\s+cd|mp3\s+cd)\)\s*$/i.test(book.volumeInfo.title ?? '')) return 'audio';
 return 'unknown';
}

export function normalizeIsbnDbEdition<T extends EditionBook>(book: T): T {
 if (book.source?.provider !== 'isbndb') return book;
 const format = editionFormat(book);
 return { ...book, novoriEdition: { ...book.novoriEdition, format }, volumeInfo: {
  ...book.volumeInfo,
  authors: book.volumeInfo.authors?.map(normalizeCatalogAuthor),
  // Audio disc counts are not reading pages. Preserve valid short print books.
  pageCount: format === 'audio' ? undefined : book.volumeInfo.pageCount,
 } };
}

export const audioEditionPenalty = (book: EditionBook) => editionFormat(book) === 'audio' ? 1 : 0;
