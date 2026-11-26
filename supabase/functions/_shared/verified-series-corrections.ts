import { seriesIdentityMatches } from './series-lookup.ts';
import { isVerifiedReadingEdition, seriesIsbnKey, type ReadingEdition } from './series-reading-edition.ts';

type Member = { id: number; position: number; title: string; authors: string[]; isbns: string[] };
type Correction = { id: number; name: string; sourceUrl: string; books: Member[] };

// Catalog corrections must cite an explicit numbered bibliography. IDs in
// this reserved range are Novori IDs, never Hardcover IDs or provider book IDs.
const corrections: Correction[] = [{
  id: 2_000_000_001,
  name: 'Ballad of Phoenix',
  sourceUrl: 'https://www.fantasticfiction.com/r/m-n-robbins/ballad-of-phoenix/',
  books: [
    {id:2_000_000_002, position:1, title:'The Ballad of Phoenix and Monsters', authors:['M. N. Robbins'], isbns:['9798266280014']},
    {id:2_000_000_003, position:2, title:'The Ballad of Phoenix and the Cursed Heirs', authors:['M. N. Robbins'], isbns:['9798196054730']},
    {id:2_000_000_004, position:3, title:'The Ballad of Phoenix and Fallen Kings', authors:['M. N. Robbins','Merry Robbins'], isbns:['9798996944910']},
  ],
}];

export function findCorrectedSeries(isbns: string[], title: string, authors: string[]) {
  const requested = new Set(isbns.map(seriesIsbnKey).filter(Boolean));
  const matches = corrections.flatMap(series => series.books
    .filter(member => member.isbns.some(isbn => requested.has(isbn)))
    .map(member => ({series,member})));
  if (matches.length !== 1) return null;
  const {series,member} = matches[0];
  if (title && !seriesIdentityMatches(member, {title, authors:authors.length ? authors : member.authors}, series.name)) return null;
  if (!title && authors.length && !seriesIdentityMatches(member, {title:member.title, authors}, series.name)) return null;

  return {
    series: {id:series.id,name:series.name,currentPosition:member.position,sourceUrl:series.sourceUrl},
    books: series.books.map(book => ({...book, coverOrigin:'series', formatPolicyVersion:1})),
  };
}

export function isCorrectedSeriesId(id: number) {
  return id >= 2_000_000_000;
}

export async function resolveCorrectedSeriesEdition<T extends ReadingEdition>(
  seriesId: number, bookId: number, read: (isbn: string) => Promise<T | null>,
): Promise<T | null> {
  const series = corrections.find(row => row.id === seriesId);
  const member = series?.books.find(row => row.id === bookId);
  if (!series || !member) return null;
  for (const isbn of member.isbns) {
    const edition = await read(isbn);
    if (!edition || seriesIsbnKey(edition.source?.isbn13) !== isbn ||
      !seriesIdentityMatches(member, {title:edition.volumeInfo.title ?? '',authors:edition.volumeInfo.authors ?? []}, series.name)) continue;
    if (isVerifiedReadingEdition(member, edition, series.name, new Set(member.isbns))) return edition;
  }
  return null;
}
