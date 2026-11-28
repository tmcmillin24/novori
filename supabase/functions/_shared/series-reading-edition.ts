import { audioEditionPenalty, catalogWorkTitleKey, isCatalogCollection,
  isCatalogSupplement, normalizeCatalogAuthor } from './book-edition-metadata.ts';
import { isEnglishBookLanguage } from './book-language.ts';
import { seriesIdentityMatches } from './series-lookup.ts';
import { matchesSeriesCatalogEdition } from './series-book-catalog.ts';

export type SeriesMember = {title: string; authors?: string[]; isbns?: string[]};
export type ReadingEdition = {
  id: string;
  source?: {isbn13?: string; provider?: string};
  novoriEdition?: {originalTitle?: string; binding?: string; format?: string};
  volumeInfo: {title?: string; authors?: string[]; language?: string; subtitle?: string; description?: string;
    pageCount?: number; industryIdentifiers?: {identifier: string}[]};
};
export function seriesIsbnKey(value?: string) {
  const isbn = value?.replace(/[\s-]/g, '').toUpperCase() ?? '';
  const checksum = (digits: string) => [...digits].reduce((sum,digit,i)=>sum + Number(digit)*(i%2 ? 3 : 1),0);
  if (/^(978|979)\d{10}$/.test(isbn)) return checksum(isbn)%10 === 0 ? isbn : null;
  if (!/^\d{9}[\dX]$/.test(isbn) ||
      [...isbn].reduce((sum,digit,i)=>sum+(digit==='X'?10:Number(digit))*(10-i),0)%11 !== 0) return null;
  const base='978'+isbn.slice(0,9);
  return base + ((10-checksum(base)%10)%10);
}

export function unknownSeriesLanguage(value?: string) {
  return !value || /^(?:und|unknown|undetermined)$/i.test(value.trim()) || !value.trim();
}

const authorKey=(name:string)=>normalizeCatalogAuthor(name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
const identityTitle=(value:string)=>catalogWorkTitleKey(value.trim().replace(/^(?:the|an|a)\s+/i,''));
const derivativeLabel=/\b(?:companion|study guide|workbook|graphic novel|summary|adaptation)\b/i;

export function isVerifiedReadingEdition(member: SeriesMember, edition: ReadingEdition, seriesName: string,
  englishIsbns: ReadonlySet<string>, linkedIsbns: ReadonlySet<string> = englishIsbns) {
  if (audioEditionPenalty(edition) || isCatalogCollection(edition) || isCatalogSupplement(edition)) return false;
  const info=edition.volumeInfo;
  if (!derivativeLabel.test(member.title) && derivativeLabel.test([info.title,info.subtitle,edition.novoriEdition?.originalTitle].filter(Boolean).join(' '))) return false;
  const english=isEnglishBookLanguage(info.language);
  if (!english && !unknownSeriesLanguage(info.language)) return false;
  const editionIsbns = [edition.source?.isbn13, ...(info.industryIdentifiers ?? []).map(row => row.identifier)]
    .map(seriesIsbnKey).filter((isbn): isbn is string => isbn !== null);
  // Only a known English printing can supply language proof missing from this record.
  if (!english && !editionIsbns.some(isbn => englishIsbns.has(isbn))) return false;
  if (matchesSeriesCatalogEdition(member,{metadata:edition})) return true;

  const wantedAuthors=member.authors ?? [];
  const actualAuthors=info.authors ?? [];
  const wanted={title:member.title,authors:wantedAuthors};
  const candidate={title:info.title ?? '',authors:actualAuthors};
  if (seriesIdentityMatches(candidate,wanted,seriesName)) return true;
  if (!editionIsbns.some(isbn => linkedIsbns.has(isbn)) || !candidate.title) return false;
  if (wantedAuthors.length && actualAuthors.length && !actualAuthors.some(name=>
    wantedAuthors.some(other=>authorKey(name) && authorKey(name)===authorKey(other)))) return false;
  const sameTitle=identityTitle(candidate.title) === identityTitle(wanted.title);
  if (sameTitle) return true;
  // A publisher subtitle can differ between catalogs. Only relax it for an exact ISBN
  // with corroborating authors; never treat an arbitrary prefix result as the same work.
  return wantedAuthors.length > 0 && actualAuthors.length > 0 &&
    identityTitle(candidate.title.split(':',1)[0]) === identityTitle(wanted.title.split(':',1)[0]) &&
    !derivativeLabel.test(candidate.title);
}
