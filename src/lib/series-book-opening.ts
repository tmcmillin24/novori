import { cleanCatalogBookTitle, normalizeCatalogAuthor } from '../../supabase/functions/_shared/book-edition-metadata';
import { isVerifiedReadingEdition, seriesIsbnKey, type ReadingEdition, type SeriesMember } from '../../supabase/functions/_shared/series-reading-edition';

type Search<T> = (query: string, offset: number, options: {onProgress: (rows: T[]) => void}) => Promise<T[]>;

export async function resolveSeriesOpening<T extends ReadingEdition>(
  member: SeriesMember, seriesName: string, search: Search<T>,
  resolveEdition?: () => Promise<T | null>,
): Promise<T | null> {
  const isbns = [...new Set((member.isbns ?? []).map(seriesIsbnKey).filter((isbn): isbn is string=>isbn!==null))];
  const englishIsbns = new Set(isbns);
  const find = (rows: T[]) => rows.find(row=>isVerifiedReadingEdition(member,row,seriesName,englishIsbns)) ?? null;

  let stopPrimary: (() => void) | undefined;
  function lookup(query: string, timeoutMs = 8000, primary = false) {
    return new Promise<T|null>(resolve=>{
      let done=false;
      const timer=setTimeout(()=>finish(null),timeoutMs);
      function finish(value:T|null) {
        if(done)return;
        done=true;
        clearTimeout(timer);
        resolve(value);
      }
      if (primary) stopPrimary = () => finish(null);
      void Promise.resolve().then(()=>search(query,0,{
        onProgress: rows => {
          if (done) return;
          const edition = find(rows);
          if (edition) finish(edition);
        },
      })).then(rows => {
        if (!done) finish(find(rows));
      }).catch(() => finish(null));
    });
  }

  // Keep the same verified representative Discover would normally open.
  const primary = lookup(member.title, resolveEdition ? 5000 : 8000, true);
  if (resolveEdition) {
    // Give warm Discover results a head start without making a slow search
    // block the direct lookup. A late verified match can still win.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const quick = await Promise.race([primary, new Promise<null>(resolve => {
      timer = setTimeout(() => resolve(null), 400);
    })]);
    clearTimeout(timer);
    if (quick) return quick;
    const fallback = resolveEdition().then(edition => ({edition, failed: false}), () => ({edition: null, failed: true}));
    const first = await Promise.race([
      primary.then(edition => edition ? {edition, failed: false} : fallback),
      fallback.then(async result => result.edition ? result : {edition: await primary, failed: result.failed}),
    ]);
    stopPrimary?.();
    if (!first.edition && first.failed) throw new Error('Series edition lookup unavailable');
    return first.edition;
  }
  const found = await primary;
  if (found) return found;
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
