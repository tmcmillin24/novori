import { audioEditionPenalty, catalogWorkTitleKey, cleanCatalogBookTitle, isCatalogCollection,
  isCatalogSupplement, normalizeCatalogAuthor } from '../../supabase/functions/_shared/book-edition-metadata';
import { isEnglishBookLanguage } from '../../supabase/functions/_shared/book-language';
import { seriesIdentityMatches } from '../../supabase/functions/_shared/series-lookup';
import { matchesSeriesCatalogEdition } from '../../supabase/functions/_shared/series-book-catalog';

type SeriesMember = {title: string; authors?: string[]; isbns?: string[]};
type Edition = {
  id: string;
  source?: {isbn13?: string; provider?: string};
  novoriEdition?: {originalTitle?: string; binding?: string; format?: string};
  volumeInfo: {title?: string; authors?: string[]; language?: string; subtitle?: string; description?: string;
    pageCount?: number; industryIdentifiers?: {identifier: string}[]};
};
type Search<T> = (query: string, offset: number, options: {onProgress: (rows: T[]) => void}) => Promise<T[]>;

function isbnKey(value?: string) {
  const isbn = value?.replace(/[\s-]/g, '').toUpperCase() ?? '';
  const checksum = (digits: string) => [...digits].reduce((sum,digit,i)=>sum + Number(digit)*(i%2 ? 3 : 1),0);
  if (/^(978|979)\d{10}$/.test(isbn)) return checksum(isbn)%10 === 0 ? isbn : null;
  if (!/^\d{9}[\dX]$/.test(isbn) ||
      [...isbn].reduce((sum,digit,i)=>sum+(digit==='X'?10:Number(digit))*(10-i),0)%11 !== 0) return null;
  const base='978'+isbn.slice(0,9);
  return base + ((10-checksum(base)%10)%10);
}

function unknownLanguage(value?: string) {
  return !value || /^(?:und|unknown|undetermined)$/i.test(value.trim()) || !value.trim();
}

const authorKey=(name:string)=>normalizeCatalogAuthor(name).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
const identityTitle=(value:string)=>catalogWorkTitleKey(value.trim().replace(/^(?:the|an|a)\s+/i,''));
const derivativeLabel=/\b(?:companion|study guide|workbook|graphic novel|summary|adaptation)\b/i;

function isVerifiedReadingEdition(member: SeriesMember, edition: Edition, seriesName: string, englishIsbns: Set<string>) {
  if (audioEditionPenalty(edition) || isCatalogCollection(edition) || isCatalogSupplement(edition)) return false;
  const info=edition.volumeInfo;
  if (!derivativeLabel.test(member.title) && derivativeLabel.test([info.title,info.subtitle,edition.novoriEdition?.originalTitle].filter(Boolean).join(' '))) return false;
  const english=isEnglishBookLanguage(info.language);
  if (!english && !unknownLanguage(info.language)) return false;
  const isbnMatches = [edition.source?.isbn13, ...(info.industryIdentifiers ?? []).map(row=>row.identifier)]
    .some(value=>{const isbn=isbnKey(value);return isbn!==null && englishIsbns.has(isbn);});
  // The series endpoint includes ISBNs only from explicitly English Hardcover editions.
  // Use that proof for the same ISBN when ISBNdb omits language, never for a translation.
  if (!english && !isbnMatches) return false;
  if (matchesSeriesCatalogEdition(member,{metadata:edition})) return true;

  const wantedAuthors=member.authors ?? [];
  const actualAuthors=info.authors ?? [];
  const wanted={title:member.title,authors:wantedAuthors};
  const candidate={title:info.title ?? '',authors:actualAuthors};
  if (seriesIdentityMatches(candidate,wanted,seriesName)) return true;
  if (!isbnMatches || !candidate.title) return false;
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

export async function resolveSeriesOpening<T extends Edition>(
  member: SeriesMember, seriesName: string, search: Search<T>,
): Promise<T | null> {
  const isbns = [...new Set((member.isbns ?? []).map(isbnKey).filter((isbn): isbn is string=>isbn!==null))];
  const englishIsbns = new Set(isbns);
  const find = (rows: T[]) => rows.find(row=>isVerifiedReadingEdition(member,row,seriesName,englishIsbns)) ?? null;

  function lookup(query: string) {
    return new Promise<T|null>(resolve=>{
      let done=false;
      const timer=setTimeout(()=>finish(null),8000);
      function finish(value:T|null) {
        if(done)return;
        done=true;
        clearTimeout(timer);
        resolve(value);
      }
      void Promise.resolve().then(()=>search(query,0,{
        onProgress: rows => { if (!done && rows.length) finish(find(rows)); },
      })).then(rows=>finish(find(rows)),()=>finish(null));
    });
  }

  // Keep the same verified representative Discover would normally open.
  const primary=await lookup(member.title);
  if (primary) return primary;
  const author=member.authors?.[0];
  const title=cleanCatalogBookTitle(member.title);
  const alternatives=[author ? `${title} ${normalizeCatalogAuthor(author)}` : title, ...isbns.slice(0,3).map(isbn=>`isbn:${isbn}`)]
    .filter((query,index,all)=>query && query!==member.title && all.indexOf(query)===index);
  // At most two requests at once, using the existing shared cache and quotas.
  // Resolve immediately when one returns a verified edition.
  for(let offset=0;offset<alternatives.length;offset+=2) {
    const batch=alternatives.slice(offset,offset+2);
    const match=await new Promise<T|null>(resolve=>{
      let remaining=batch.length;
      for(const query of batch) void lookup(query).then(row=>{
        if(row || --remaining===0) resolve(row);
      });
    });
    if(match)return match;
  }
  return null;
}
