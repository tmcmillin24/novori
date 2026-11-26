import { catalogWorkTitleKey, cleanCatalogBookTitle, normalizeCatalogAuthor } from './book-edition-metadata.ts';

type Identity = { title: string; authors: string[] };
type HardcoverBook = { id: number; title: string; compilation?: boolean; contributions?: { author?: { name?: string } }[];
  book_series?: { position?: number | null; series?: { id: number; name: string } }[] };

const authorKey = (name: string) => normalizeCatalogAuthor(name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
const stripArticle = (value: string) => value.replace(/^(?:the|an|a)\s+/i, '');
const titleKey = (value: string) => catalogWorkTitleKey(stripArticle(value.trim()));
const literal = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function titleWithoutSeries(title: string, series: string) {
  if (!series) return title;
  const suffix = literal(series) + '(?:\\s*[,#:]?\\s*(?:books?|vol(?:ume)?\\.?|#)?\\s*\\d+(?:\\.\\d+)?)?';
  return title.replace(new RegExp('(?:\\s*\\(\\s*' + suffix + '\\s*\\)|\\s*[:–—]\\s*' + suffix + ')\\s*$', 'i'), '').trim();
}

export function seriesIdentityMatches(candidate: Identity, wanted: Identity, seriesName = '') {
  const candidateKey = titleKey(titleWithoutSeries(candidate.title, seriesName));
  const wantedKey = titleKey(titleWithoutSeries(wanted.title, seriesName));
  return Boolean(candidateKey && candidateKey === wantedKey &&
    wanted.authors.some(name => candidate.authors.some(other => authorKey(name) && authorKey(name) === authorKey(other))));
}

function bookIdentity(book: HardcoverBook): Identity {
  return {title: book.title, authors: (book.contributions ?? []).flatMap(row => row.author?.name ? [row.author.name] : [])};
}

export function verifiedSeriesMembership(book: HardcoverBook | null, wanted: Identity, exactEdition = false) {
  if (!book || book.compilation) return undefined;
  const candidate = bookIdentity(book);
  const matches = book.book_series?.filter(row => {
    if (!row.series?.id || !row.series.name?.trim()) return false;
    if (seriesIdentityMatches(candidate, wanted, row.series.name)) return true;
    // A verified exact ISBN is sufficient when the catalog omitted one side of the identity.
    // Conflicting authors, and a conflicting title without author corroboration, still fail.
    if (!exactEdition) return false;
    const authorsAgree = wanted.authors.some(name => candidate.authors.some(other => authorKey(name) && authorKey(name) === authorKey(other)));
    if (wanted.authors.length && candidate.authors.length && !authorsAgree) return false;
    const sameTitle = titleKey(titleWithoutSeries(wanted.title, row.series.name)) === titleKey(titleWithoutSeries(candidate.title, row.series.name));
    if (!wanted.title || sameTitle) return true;
    if (!authorsAgree) return false;
    // ISBN plus author can bridge a publisher's subtitle without treating arbitrary alternate titles as the same work.
    const base = (title: string) => titleKey(titleWithoutSeries(title, row.series!.name).split(/[:–—]/, 1)[0]);
    return Boolean(base(wanted.title) && base(wanted.title) === base(candidate.title));
  });
  return matches?.find(row=>row.position != null) ?? matches?.[0];
}

type SearchDocument = {id?: number | string; title?: string; author_names?: string[]};
export async function findSeriesBookByTitle<T extends HardcoverBook>(wanted: Identity, queries: {
  search: (query: string) => Promise<SearchDocument[]>;
  byIds: (ids: number[]) => Promise<T[]>;
  byExactTitle: (titles: string[]) => Promise<T[]>;
}): Promise<T | null> {
  if (!wanted.title || !wanted.authors.length) return null;
  const title = cleanCatalogBookTitle(wanted.title);
  const author = normalizeCatalogAuthor(wanted.authors[0]);
  const tried = new Set<number>();
  let failure: unknown;
  for (const phrase of new Set([`${title} ${author}`.trim(), title])) {
    try {
      const hits = await queries.search(phrase);
      const ranked = hits.map(row => {
        const candidate = row.title ?? '';
        const key = titleKey(candidate), wantedKey = titleKey(title);
        const sameAuthor = (row.author_names ?? []).some(name => wanted.authors.some(other => authorKey(name) && authorKey(name) === authorKey(other)));
        const base = (text: string) => titleKey(text.split(/\s*[:(–—]/,1)[0]);
        return { id: Number(row.id), score: sameAuthor ? key === wantedKey ? 2 : base(candidate) === base(title) ? 1 : 0 : 0 };
      }).filter(row => row.score && Number.isSafeInteger(row.id) && row.id > 0 && !tried.has(row.id))
        .sort((a,b) => b.score-a.score);
      const ids = [...new Set(ranked.map(row=>row.id))].slice(0,8);
      if (!ids.length) continue;
      ids.forEach(id=>tried.add(id));
      const books = await queries.byIds(ids);
      for (const id of ids) {
        const book = books.find(row=>row.id===id);
        if (book && verifiedSeriesMembership(book,wanted)) return book;
      }
    } catch (error) { failure = error; }
  }
  // The text search index can omit a work entirely. Query exact titles in the source table,
  // limited to books with a series link. Verify title and author again on the returned record.
  const exact = await queries.byExactTitle([...new Set([wanted.title,title,stripArticle(title)])]);
  const match = exact.find(book=>verifiedSeriesMembership(book,wanted));
  if (!match && failure) throw failure;
  return match ?? null;
}

export const seriesResultLifetime = (found: boolean) => found
  ? {freshMs:14 * 86400000, staleMs:90 * 86400000}
  : {freshMs:3600000, staleMs:3600000};
