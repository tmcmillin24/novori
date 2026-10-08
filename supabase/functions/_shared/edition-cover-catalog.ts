import { cachedEditionCover } from './catalog-metadata-covers.ts';
import { matchesSeriesCatalogEdition } from './series-book-catalog.ts';
import { preferredCoverIsbn } from './catalog-cover-preferences.ts';
import { audioEditionPenalty } from './book-edition-metadata.ts';
import { catalogCoverAliases } from './catalog-cover-aliases.ts';

// One edition is one cover identity. Work membership only supplies verified
// alternatives when that edition has no usable artwork. This reader never
// rewrites selections, reader IDs, provider caches or ratings.
export function editionCoverChoices(seed: any, editions: any[], manual?: any) {
  if (manual?.url) return [{ url: manual.url, bookId: seed.provider_book_id, provider: manual.provider, locked: true }];
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
  return matching.flatMap(row => {
    const url = cachedEditionCover(row)!;
    if (seen.has(url)) return [];
    seen.add(url);
    return [{ url, bookId: row.provider_book_id, provider: row.provider, locked: false }];
  }).slice(0, 8);
}

export async function readEditionCovers(admin: any, seeds: any[]) {
  const aliases = await catalogCoverAliases(admin, seeds);
  const workIds = [...new Set<string>(seeds.flatMap(row => aliases.get(row.work_id) ?? [row.work_id]).filter(Boolean))];
  const editions: any[] = [...seeds];
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
    const choices = editionCoverChoices(seed, editions.filter(row => allowed.includes(row.work_id)), manual.get(seed.work_id));
    return [seed.provider_book_id, choices] as const;
  }));
}
