type EditionBook = {
 source?: { provider?: string };
 novoriEdition?: { binding?: string; format?: string; originalTitle?: string; productKind?: string };
 volumeInfo: { title?: string; subtitle?: string; description?: string; authors?: string[]; pageCount?: number };
};

/** Classify the product, not incidental mentions of sets inside a novel's plot. */
export function isCatalogCollection(book: EditionBook): boolean {
 const title = [book.novoriEdition?.originalTitle, book.volumeInfo.title, book.volumeInfo.subtitle].filter(Boolean).join(' ');
 if (/\b(?:box(?:ed)?\s*set|omnibus|(?:e[- ]?book|book|series)\s+bundle|\d+[- ]books?\s+(?:collection|set)|collection\s+set)\b/i.test(title) ||
     /\b(?:books?|volumes?|series)\s+\d+\s*[-–—]\s*\d+\b/i.test(title)) return true;
 const intro = (book.volumeInfo.description ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
 return /^(?:all|the first|the complete)\s+(?:\d+|two|three|four|five|six|seven|eight|nine|ten)\b.{0,160}\b(?:books?|hardcovers?|novels?|volumes?)\b/i.test(intro) ||
   /^(?:this|a)\b.{0,100}\b(?:box(?:ed)?\s*set|\d+[- ]book\s+(?:set|collection))\b/i.test(intro);
}

export function isCatalogSupplement(book: EditionBook): boolean {
 const text = [book.volumeInfo.title, book.volumeInfo.subtitle, book.novoriEdition?.binding].filter(Boolean).join(' ');
 return /\b(?:calendar|colou?ring book|activity book|puzzle book|dramatized adaptation|dramatised adaptation)\b/i.test(text);
}

// Strip explicit catalog marketing/edition labels, never arbitrary subtitles.
export function cleanCatalogBookTitle(title: string) {
 return title.trim()
  .replace(/\s*(?:[:–—]\s*)?\bdiscover the (?:follow[- ]up|sequel) to the (?:global|worldwide) phenomenons?\b[\s\S]*$/i, '')
  .replace(/\s*\((?:Standard Edition|English(?:[- ]language)? edition|Engelstalige editie)\)\s*$/i, '')
  // Confirmed series-name label used by the Empyrean catalog editions.
  .replace(/\s*\((?:the )?Empyrean\)\s*$/i, '')
  .replace(/[\s:–—]+$/, '').trim() || title.trim();
}

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
 const collection = isCatalogCollection(book);
 const cleanTitle = book.volumeInfo.title ? cleanCatalogBookTitle(book.volumeInfo.title) : book.volumeInfo.title;
 // Provider short titles can hide an entire set under the first novel's name.
 // Keep its ISBN/pages intact but give the product a distinct work identity.
 const title = collection && cleanTitle && !/\b(?:box(?:ed)?\s*set|bundle|omnibus|collection|\d+\s*[-–—]\s*\d+)\b/i.test(cleanTitle)
   ? `${cleanTitle} (Box Set)` : cleanTitle;
 return { ...book, novoriEdition: { ...book.novoriEdition, format, productKind: collection ? 'collection' : isCatalogSupplement(book) ? 'supplement' : 'book', originalTitle: book.novoriEdition?.originalTitle ?? book.volumeInfo.title }, volumeInfo: {
  ...book.volumeInfo,
  title,
  description: book.volumeInfo.description?.replace(/\s*\[Bokinfo\]\s*$/i, '').trim(),
  authors: book.volumeInfo.authors?.map(normalizeCatalogAuthor),
  // Audio disc counts are not reading pages. Preserve valid short print books.
  pageCount: format === 'audio' ? undefined : book.volumeInfo.pageCount,
 } };
}

export const audioEditionPenalty = (book: EditionBook) => editionFormat(book) === 'audio' ? 1 : 0;
