import { cacheDiscoveryCoverChoices, verifiedHardcoverDiscoveryChoice, DISCOVERY_COVER_VARIANT } from './hardcover-discovery-covers.ts';
import { cachedEditionCover } from './catalog-metadata-covers.ts';
import { matchesSeriesCatalogEdition } from './series-book-catalog.ts';
import { preferredArtworkIsbn, preferredCoverIsbn } from './catalog-cover-preferences.ts';
import { audioEditionPenalty } from './book-edition-metadata.ts';
import { SERIES_PUBLISHER_VARIANT, seriesPublisherCandidates, verifiedSeriesPublisherEdition } from './series-publisher-covers.ts';
import { catalogCoverAliases } from './catalog-cover-aliases.ts';

export type EditionCoverChoice = { url: string; bookId: string; provider: string; locked: boolean;
 fallback?: boolean; workId?: string; genres?: string[]; reviewsCount?: number|null; aliases?: string[] };

// Verified Trending/Recent Hardcover artwork remains primary across matching editions.
// Other books use ISBNdb first, then verified series Hardcover art, then legacy artwork.
// Otherwise use edition artwork and verified alternatives. Reader IDs, edition
// metadata, provider response caches and ratings are never rewritten here.
export function editionCoverChoices(seed: any, editions: any[], manual?: any, hardcoverCandidates: any[] = [], publisherCandidates: any[] = []): EditionCoverChoice[] {
  if (manual?.url) return [{ url: manual.url, bookId: seed.provider_book_id, provider: manual.provider, locked: true }];
  if (audioEditionPenalty(seed.metadata ?? {volumeInfo:{}})) return [];
  const primaryWorks = new Set(hardcoverCandidates.filter(row => row.source_metadata?.coverOrigin !== 'series' && row.source_metadata?.coverProof?.version === 2 && verifiedHardcoverDiscoveryChoice(seed,row)).map(row => row.source_metadata.hardcoverBookId));
  const hardcover = hardcoverCandidates.filter(row => !primaryWorks.has(row.source_metadata?.hardcoverBookId) || row.source_metadata?.coverProof?.version === 2).map(row => verifiedHardcoverDiscoveryChoice(seed, row)).filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a: any,b: any) => b.usersCount-a.usersCount || a.workId.localeCompare(b.workId) || a.url.localeCompare(b.url));
  const info = seed.metadata?.volumeInfo ?? {};
  const preferred = preferredArtworkIsbn(info) ?? preferredCoverIsbn(info);
  const familyChoice = publisherCandidates.map(candidate => ({candidate,edition:verifiedSeriesPublisherEdition(seed,candidate,editions)})).filter(choice=>choice.edition).sort((a,b)=>Number(b.edition.isbn_13 === preferred)-Number(a.edition.isbn_13 === preferred) || String(a.edition.isbn_13).localeCompare(String(b.edition.isbn_13)))[0];
  const family = familyChoice?.edition;
  const identityEdition = preferredArtworkIsbn(info) ? editions.find(row=>row.isbn_13 === familyChoice?.candidate.source_metadata?.identityIsbn && matchesSeriesCatalogEdition(info,row)) : null;
  const matching = editions.filter(row => cachedEditionCover(row) && (matchesSeriesCatalogEdition(info, row) ||
    (row.provider === seed.provider && row.provider_book_id === seed.provider_book_id)));
  const rank = (row: any) => [
    preferred && row.isbn_13 === preferred ? 0 : 1,
    family && row.isbn_13 === family.isbn_13 ? 0 : 1,
    audioEditionPenalty(row.metadata), row.provider === 'isbndb' ? 0 : 1,
    row.provider_book_id === seed.provider_book_id ? 0 : 1,
  ];
  matching.sort((a, b) => {
    const aa = rank(a), bb = rank(b);
    for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return aa[i] - bb[i];
    return String(a.provider_book_id).localeCompare(String(b.provider_book_id));
  });
  const seen = new Set<string>();
  const catalog = matching.flatMap(row => {
    const url = cachedEditionCover(row)!;
    if (seen.has(url)) return [];
    seen.add(url);
    return [{ url, bookId: preferredArtworkIsbn(info) && row.isbn_13 === preferred ? identityEdition?.provider_book_id ?? seed.provider_book_id : row.provider_book_id, provider: row.provider, locked: false, ...(family && row.isbn_13 === family.isbn_13 ? {workId: `series-edition:${family.isbn_13}`, aliases: [...new Set(matching.map(item => item.provider_book_id))]} : {}) }];
  });
  return [...hardcover.filter(choice => !choice.fallback), ...catalog.filter(choice => choice.provider === 'isbndb'), ...hardcover.filter(choice => choice.fallback), ...catalog.filter(choice => choice.provider !== 'isbndb')].filter((row, index, all) => all.findIndex(choice => choice.url === row.url) === index).slice(0, 8);
}

export async function readEditionCovers(admin: any, seeds: any[], discoveryBooks: any[] = [], series?: {id:number;name:string}) {
  let promoted: any[] = [];
  try { promoted = await cacheDiscoveryCoverChoices(admin, seeds, discoveryBooks); }
  catch (error) { console.warn('Could not persist verified discovery artwork:', error); }
  if (series?.name) {
    const normalize = (value:string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const names = [...new Set([series.name,series.name.replace(/^the /i,'')])];
    const titles = [...new Set(discoveryBooks.flatMap(book => names.map(name => normalize(`${book.title} (${name})`))))];
    if (titles.length) {
      const {data:works,error} = await admin.from('book_works').select('id').in('normalized_title',titles);
      if (error) throw error;
      if (works?.length) {
        const {data:related,error} = await admin.from('book_editions').select('id,provider,provider_book_id,work_id,isbn_10,isbn_13,language,metadata')
          .in('provider',['isbndb','google_books']).in('work_id',works.map((row:any)=>row.id));
        if (error) throw error;
        seeds = [...seeds,...(related ?? []).filter((row:any)=>discoveryBooks.some(book=>matchesSeriesCatalogEdition(book,row)))];
      }
    }
  }
  const aliases = await catalogCoverAliases(admin, seeds);
  const workIds = [...new Set<string>(seeds.flatMap(row => aliases.get(row.work_id) ?? [row.work_id]).filter(Boolean))];
  const editions: any[] = [...seeds];
  const hardcoverCandidates: any[] = [...promoted];
  const publisherCandidates: any[] = [];
  const manual = new Map<string, any>();
  for (let offset = 0; offset < workIds.length; offset += 100) {
    const batch = workIds.slice(offset, offset + 100);
    for (let page = 0; ; page += 1000) {
      const { data, error } = await admin.from('book_editions')
        .select('id,provider,provider_book_id,work_id,isbn_10,isbn_13,language,metadata')
        .in('provider', ['isbndb', 'google_books']).in('work_id', batch).order('id').range(page, page + 999);
      if (error) throw error;
      editions.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }
    for (let page = 0; ; page += 1000) {
      const { data, error } = await admin.from('book_cover_candidates')
        .select('work_id,provider,source_variant,url,source_metadata').in('work_id',batch)
        .eq('provider','hardcover').eq('source_variant',DISCOVERY_COVER_VARIANT).order('id').range(page,page+999);
      if (error) throw error;
      hardcoverCandidates.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }
    const {data:preferences,error:preferenceError} = await admin.from('book_cover_candidates')
      .select('work_id,provider,source_variant,url,source_metadata').in('work_id',batch).eq('source_variant',SERIES_PUBLISHER_VARIANT);
    if (preferenceError) throw preferenceError;
    publisherCandidates.push(...(preferences ?? []));
    const { data: locks, error } = await admin.from('book_cover_selections')
      .select('work_id,candidate_id').in('work_id', batch).eq('locked', true).eq('status', 'selected');
    if (error) throw error;
    if (locks?.length) {
      const { data: candidates, error } = await admin.from('book_cover_candidates')
        .select('id,url,provider').in('id', locks.map((row: any) => row.candidate_id));
      if (error) throw error;
      for (const lock of locks) manual.set(lock.work_id, candidates?.find((row: any) => row.id === lock.candidate_id));
    }
  }
  const promotedFamilies = seriesPublisherCandidates(editions, discoveryBooks, series?.id ?? 0);
  if (promotedFamilies.length) {
    const changed = promotedFamilies.filter(row => !publisherCandidates.some(old => old.work_id === row.work_id && old.url === row.url &&
      old.source_metadata?.seriesId === row.source_metadata.seriesId && old.source_metadata?.anchorIsbn === row.source_metadata.anchorIsbn &&
      old.source_metadata?.isbn === row.source_metadata.isbn && old.source_metadata?.identityIsbn === row.source_metadata.identityIsbn && old.source_metadata?.publisher === row.source_metadata.publisher));
    if (changed.length) {
      const {error} = await admin.from('book_cover_candidates').upsert(changed,{onConflict:'candidate_key'});
      if (error) console.warn('Could not persist series publisher preference:', error);
    }
    publisherCandidates.push(...promotedFamilies);
  }
  const preferredIsbns = [...new Set(publisherCandidates.flatMap(row=>[row.source_metadata?.isbn,row.source_metadata?.identityIsbn]).filter(Boolean))].filter(isbn => !editions.some(row => row.provider === 'isbndb' && row.isbn_13 === isbn));
  if (preferredIsbns.length) {
    const {data:chosen,error} = await admin.from('book_editions').select('id,provider,provider_book_id,work_id,isbn_10,isbn_13,language,metadata')
      .eq('provider','isbndb').in('isbn_13',preferredIsbns);
    if (error) throw error;
    editions.push(...(chosen ?? []));
  }
  return new Map(seeds.map(seed => {
    const allowed = aliases.get(seed.work_id) ?? [seed.work_id];
    const choices = editionCoverChoices(seed, editions.filter(row => allowed.includes(row.work_id) || publisherCandidates.some(choice=>allowed.includes(choice.work_id) && [choice.source_metadata?.isbn,choice.source_metadata?.identityIsbn].includes(row.isbn_13))), allowed.map(id => manual.get(id)).find(Boolean), hardcoverCandidates.filter(row => allowed.includes(row.work_id)), publisherCandidates.filter(row=>allowed.includes(row.work_id)));
    const coverAliases = editions.filter(row => allowed.includes(row.work_id) && matchesSeriesCatalogEdition(seed.metadata?.volumeInfo ?? {}, row))
      .map(row => row.provider_book_id).filter((id: unknown): id is string => typeof id === 'string');
    return [seed.provider_book_id, choices.map(choice => choice.provider === 'hardcover' ? {...choice, aliases:[...new Set(coverAliases)]} : choice)] as const;
  }));
}
