import { audioEditionPenalty, cleanCatalogBookTitle, isCatalogCollection, isCatalogSupplement,
  normalizeCatalogAuthor } from './book-edition-metadata.ts';
import { hardcoverTextEdition } from './hardcover-discovery-policy.ts';
import { validPageCount } from './page-count.ts';
import { isEnglishBookLanguage } from './book-language.ts';
import { isVerifiedReadingEdition, seriesIsbnKey, unknownSeriesLanguage, type ReadingEdition } from './series-reading-edition.ts';

type HardcoverEdition = {
  title?: string;
  pages?: number;
  release_date?: string;
  isbn_13?: string;
  isbn_10?: string;
  compilation?: boolean;
  audio_seconds?: number;
  reading_format_id?: number;
  physical_format?: string;
  reading_format?: {format?: string};
  language?: {code2?: string; code3?: string; language?: string};
};

type HardcoverMember = {
  id: number;
  title: string;
  compilation?: boolean;
  contributions?: {author?: {name?: string}}[];
  book_series?: {series?: {id: number; name: string}}[];
  editions?: HardcoverEdition[];
};

export async function resolveSeriesEdition<T extends ReadingEdition>(book: HardcoverMember, seriesId: number, sources: {
  catalog: (isbns: string[]) => Promise<T[]>;
  byIsbn: (isbn: string) => Promise<T | null>;
  byTitle: (query: string) => Promise<T[]>;
  persistHardcoverEdition?: (book: HardcoverReadingEdition) => Promise<T>;
}): Promise<T | null> {
  const series = book.book_series?.find(row => row.series?.id === seriesId)?.series;
  if (!series || !book.title || book.compilation) return null;
  const member = { title: book.title, authors: (book.contributions ?? []).flatMap(row => row.author?.name ? [row.author.name] : []) };
  const product = {volumeInfo: member};
  if (audioEditionPenalty(product) || isCatalogCollection(product) || isCatalogSupplement(product)) return null;

  const english = new Set<string>();
  const hardcoverEditions = new Map<string,HardcoverEdition>();
  const conflicts = new Set<string>();
  const untagged = new Set<string>();
  for (const row of book.editions ?? []) {
    if (row.compilation || Number(row.audio_seconds) > 0 || row.reading_format_id === 2 ||
      /audio|spoken|mp3|cassette/i.test(`${row.reading_format?.format ?? ''} ${row.physical_format ?? ''}`)) continue;
    const languages = [row.language?.code2, row.language?.code3, row.language?.language];
    if (languages.some(language => !unknownSeriesLanguage(language) && !isEnglishBookLanguage(language))) continue;
    const isbn = seriesIsbnKey(row.isbn_13) ?? seriesIsbnKey(row.isbn_10);
    if (!isbn) continue;
    (languages.some(isEnglishBookLanguage) ? english : untagged).add(isbn);
    if (!hardcoverEditions.has(isbn) && hardcoverTextEdition(row, member.title, '9999-12-31')) {
      hardcoverEditions.set(isbn, row);
    }
  }
  // Give both lists room: provider A can omit a language or list several unavailable printings.
  const candidates = [...new Set([...Array.from(english).slice(0,3), ...Array.from(untagged).slice(0,3)])];
  const linked = new Set([...english, ...untagged]);
  const matches = (edition: T) => isVerifiedReadingEdition(member, edition, series.name, english, linked);
  const exact = (edition: T, isbn: string) =>
    [edition.source?.isbn13, ...(edition.volumeInfo.industryIdentifiers ?? []).map(row => row.identifier)]
      .some(value => seriesIsbnKey(value) === isbn) && matches(edition);
  let failed = false;
  async function attempt<V>(lookup: () => Promise<V>, empty: V) {
    try { return await lookup(); } catch { failed = true; return empty; }
  }
  const catalog = linked.size ? await attempt(() => sources.catalog([...linked]), []) : [];
  for (const isbn of linked) {
    const cached = catalog.find(edition => exact(edition, isbn));
    if (cached) return cached;
    if (catalog.some(edition => seriesIsbnKey(edition.source?.isbn13) === isbn)) conflicts.add(isbn);
  }

  const title = cleanCatalogBookTitle(member.title);
  const author = member.authors[0] ? normalizeCatalogAuthor(member.authors[0]) : '';
  let settled = false;
  async function search(): Promise<T | null> {
    // Keep edition rows separate; Discover's work grouping can discard the verified printing.
    for (const query of new Set([(title + ' ' + author).trim(), title])) {
      if (settled) return null;
      if (query.length < 2 || query.length > 150) continue;
      const rows = await attempt(() => sources.byTitle(query), []);
      const match = rows.find(matches);
      if (match) return match;
    }
    return null;
  }
  async function lookupIsbns(): Promise<T | null> {
    for (let offset = 0; offset < candidates.length; offset += 2) {
      if (settled) return null;
      const batch = candidates.slice(offset, offset + 2);
      const match = await firstMatch(batch.map(async isbn => {
        const edition = await attempt(() => sources.byIsbn(isbn), null);
        if (!edition) return null;
        if (exact(edition, isbn)) return edition;
        conflicts.add(isbn);
        return null;
      }));
      if (match) return match;
    }
    return null;
  }
  function firstMatch(promises: Promise<T | null>[]): Promise<T | null> {
    return new Promise(resolve => {
      let remaining = promises.length;
      function complete(match: T | null) {
        if (match || --remaining === 0) resolve(match);
      }
      for (const promise of promises) void promise.then(complete, () => {
        failed = true;
        complete(null);
      });
    });
  }
  // Slow or empty text search cannot hold up a successful exact ISBN lookup.
  const result = await firstMatch([lookupIsbns(), search()]);
  settled = true;
  if (result) return result;
  const persist = sources.persistHardcoverEdition;
  if (persist && member.authors.length) for (const [isbn, row] of hardcoverEditions) {
    if (conflicts.has(isbn)) continue;
    const edition: HardcoverReadingEdition = {
      id: `nv_${isbn}`, source:{provider:'hardcover',isbn13:isbn},
      volumeInfo:{
        ...member, language:'en', pageCount:validPageCount(row.pages),
        publishedDate:row.release_date ?? undefined,
        industryIdentifiers:[{type:'ISBN_13',identifier:isbn}],
      },
    };
    return await persist(edition);
  }
  if (failed) throw new Error('One or more edition sources could not be checked.');
  return null;
}

type HardcoverReadingEdition = ReadingEdition & {
  source:{provider:'hardcover';isbn13:string};
  volumeInfo: ReadingEdition['volumeInfo'] & {
    publishedDate?: string;
    industryIdentifiers:{type:'ISBN_13';identifier:string}[];
  };
};
