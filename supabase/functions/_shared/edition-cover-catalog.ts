import { cacheDiscoveryCoverChoices, verifiedHardcoverDiscoveryChoice, DISCOVERY_COVER_VARIANT } from './hardcover-discovery-covers.ts';
import { cachedEditionCover } from './catalog-metadata-covers.ts';
import { matchesSeriesCatalogEdition } from './series-book-catalog.ts';
import { preferredCoverIsbn } from './catalog-cover-preferences.ts';
import { audioEditionPenalty } from './book-edition-metadata.ts';
import { catalogCoverAliases } from './catalog-cover-aliases.ts';

export type EditionCoverChoice = { url: string; bookId: string; provider: string; locked: boolean;
 fallback?: boolean; workId?: string; genres?: string[]; reviewsCount?: number|null; aliases?: string[] };

// Verified Trending/Recent Hardcover artwork remains primary across matching editions.
// Other books use ISBNdb first, then verified series Hardcover art, then legacy artwork.
// Otherwise use edition artwork and verified alternatives. Reader IDs, edition
// metadata, provider response caches and ratings are never rewritten here.
export function editionCoverChoices(seed: any, editions: any[], manual?: any, hardcoverCandidates: any[] = []): EditionCoverChoice[] {
  if (manual?.url) return [{ url: manual.url, bookId: seed.provider_book_id, provider: manual.provider, locked: true }];
  if (audioEditionPenalty(seed.metadata ?? {volumeInfo:{}})) return [];
  const primaryWorks = new Set(hardcoverCandidates.filter(row => row.source_metadata?.coverOrigin !== 'series' && row.source_metadata?.coverProof?.version === 2 && verifiedHardcoverDiscoveryChoice(seed,row)).map(row => row.source_metadata.hardcoverBookId));
  const hardcover = hardcoverCandidates.filter(row => !primaryWorks.has(row.source_metadata?.hardcoverBookId) || row.source_metadata?.coverProof?.version === 2).map(row => verifiedHardcoverDiscoveryChoice(seed, row)).filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a: any,b: any) => b.usersCount-a.usersCount || a.workId.localeCompare(b.workId) || a.url.localeCompare(b.url));
  const info = seed.metadata?.volumeInfo ?? {};
  const preferred = preferredCoverIsbn(info);
  const matching = editions.filter(row => matchesSeriesCatalogEdition(info, row) && cachedEditionCover(row));
  const rank = (row: any) => [
    preferred && row.isbn_13 === preferred ? 0 : 1,
    row.provider_book_id === seed.provider_book_id ? 0 : 1,
    audioEditionPenalty(row.metadata), row.provider === 'isbndb' ? 0 : 1,
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
    return [{ url, bookId: row.provider_book_id, provider: row.provider, locked: false }];
  });
  return [...hardcover.filter(choice => !choice.fallback), ...catalog.filter(choice => choice.provider === 'isbndb'), ...hardcover.filter(choice => choice.fallback), ...catalog.filter(choice => choice.provider !== 'isbndb')].filter((row, index, all) => all.findIndex(choice => choice.url === row.url) === index).slice(0, 8);
}

export async function readEditionCovers(admin: any, seeds: any[], discoveryBooks: any[] = []) {
  let promoted: any[] = [];
  try { promoted = await cacheDiscoveryCoverChoices(admin, seeds, discoveryBooks); }
  catch (error) { console.warn('Could not persist verified discovery artwork:', error); }
  const aliases = await catalogCoverAliases(admin, seeds);
  const workIds = [...new Set<string>(seeds.flatMap(row => aliases.get(row.work_id) ?? [row.work_id]).filter(Boolean))];
  const editions: any[] = [...seeds];
  const hardcoverCandidates: any[] = [...promoted];
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
  return new Map(seeds.map(seed => {
    const allowed = aliases.get(seed.work_id) ?? [seed.work_id];
    const choices = editionCoverChoices(seed, editions.filter(row => allowed.includes(row.work_id)), allowed.map(id => manual.get(id)).find(Boolean), hardcoverCandidates.filter(row => allowed.includes(row.work_id)));
    const coverAliases = editions.filter(row => allowed.includes(row.work_id) && matchesSeriesCatalogEdition(seed.metadata?.volumeInfo ?? {}, row))
      .map(row => row.provider_book_id).filter((id: unknown): id is string => typeof id === 'string');
    return [seed.provider_book_id, choices.map(choice => choice.provider === 'hardcover' ? {...choice, aliases:[...new Set(coverAliases)]} : choice)] as const;
  }));
}
