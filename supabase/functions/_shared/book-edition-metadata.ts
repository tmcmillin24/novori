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
  .replace(/\s*\((?:the )?[^()]+\b(?:saga|series)\)\s*$/i, '')
  // Confirmed series-name label used by the Empyrean catalog editions.
  .replace(/\s*\((?:the )?Empyrean\)\s*$/i, '')
  .replace(/\s*[\[(][^\])]*(?:\b(?:edition|collector|deluxe|special|anniversary|book\s*\d+|volume\s*\d+|vol\.?\s*\d+|series)|#\s*\d+|,\s*\d+)[^\])]*[\])]\s*$/i, '')
  .replace(/\s*(?:[:–—-]\s*)?\b(?:limited\s+)?(?:collector[’']?s?|collectors|deluxe|special|exclusive|anniversary|standard|international|hardcover|paperback|large print)\s+edition(?:\s*[:–—-]\s*(?:a novel|the novel))?\s*$/i, '')
  .replace(/\s*[:–—]\s*[^:–—]*(?:\bbook\s*\d+|\bvolume\s*\d+|#\s*\d+)\s*$/i, '')
  .replace(/[\s:–—]+$/, '').trim() || title.trim();
}

/** Compare work titles without conflating adaptations, recordings or arbitrary subtitles. */
export function catalogWorkTitleKey(title: string, originalTitle = title) {
 const product = /\b(?:graphic novel|comic|manga|live in concert|dramatized|dramatised|audiobook|audio cd)\b/i.test(originalTitle);
 const clean = product ? originalTitle : cleanCatalogBookTitle(title);
 if (product) return clean.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
 return clean.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/,\s+or[,:]?\s+.+$/i, '')
  .replace(/\s*[:–—]\s*(?:a novel|a thriller|the novel)\s*$/i, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '')
  .replace(/^thehobbitor(?:thereandbackagain)$/, 'thehobbit');
}

/** Work labels are independent of edition ISBN, release date and artwork. */
export function displayBookTitle(title: string) {
 const clean = cleanCatalogBookTitle(title);
 const minor = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'to', 'with', 'vs']);
 const words = [...clean.matchAll(/[\p{L}\p{N}]+(?:[’'][\p{L}]+)*/gu)];
 const allCaps = clean === clean.toUpperCase();
 let index = 0;
 return clean.replace(/[\p{L}\p{N}]+(?:[’'][\p{L}]+)*/gu, word => {
  const position = index++;
  const lower = word.toLowerCase();
  const startsPhrase = position === 0 || /[(:—–]\s*$/.test(clean.slice(0, words[position].index));
  if (!startsPhrase && position < words.length - 1 && minor.has(lower)) return lower;
  // Preserve acronyms and deliberately mixed-case names inside a title.
  if (!allCaps && /[A-Z].*[A-Z]|[a-z][A-Z]/.test(word)) return word;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
 });
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
 const cleanTitle = book.volumeInfo.title ? displayBookTitle(book.volumeInfo.title) : book.volumeInfo.title;
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

type Book = {
 novoriPublication?: BookPublicationRecord;
 volumeInfo: { title?: string; authors?: string[]; publishedDate?: string; description?: string; subtitle?: string };
};
export type BookPublicationRecord = { title: string; authors?: string[]; releaseDate?: string | null; position?: number | null };
const key = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function validPublicationDate(value?: string | null): string | undefined {
 if (!value || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) return undefined;
 const [year, month = 1, day = 1] = value.split('-').map(Number);
 if (year < 1000 || month < 1 || month > 12 || day < 1) return undefined;
 const date = new Date(Date.UTC(year, month - 1, day));
 return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : undefined;
}

/** Work release dates and ISBN edition dates describe different publications. */
export function resolveBookPublication(book: Book, seriesBooks: BookPublicationRecord[], currentPosition?: number | null) {
 const editionDate = validPublicationDate(book.volumeInfo.publishedDate);
 const title = key(cleanCatalogBookTitle(book.volumeInfo.title ?? ''));
 const authors = (book.volumeInfo.authors ?? []).map(author => key(normalizeCatalogAuthor(author)));
 const matched = title && authors.length && !isCatalogCollection(book) && !isCatalogSupplement(book)
  ? [...seriesBooks, ...(book.novoriPublication ? [book.novoriPublication] : [])].find(row => (currentPosition == null || (row.position == null || row.position === currentPosition)) &&
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

export function bookPublicationKeys(book: { title?: string; authors?: string[] }) {
 const title = key(cleanCatalogBookTitle(book.title ?? ""));
 return title ? [...new Set((book.authors ?? []).map(author => key(normalizeCatalogAuthor(author))).filter(Boolean))].map(author => `publication:v1:${title}::${author}`) : [];
}
