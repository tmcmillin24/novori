import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cleanCatalogBookTitle } from './book-edition-metadata.ts';
import { matchesSeriesCatalogEdition } from './series-book-catalog.ts';
const titleKey = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Legacy catalog rows may split one work by author spelling or edition label.
 * Read-only cover aliases: never merge reader IDs, editions, ratings or shelves.
 * Both sides require the same cleaned title, author and explicit English language.
 */
export async function catalogCoverAliases(admin: SupabaseClient, requested: any[]) {
 const seeds = requested.filter(row => row.work_id && row.metadata?.volumeInfo &&
  matchesSeriesCatalogEdition(row.metadata.volumeInfo, row));
 const aliases = new Map<string, string[]>();
 const titles = [...new Set<string>(seeds.flatMap(row => {
  const title = row.metadata.volumeInfo.title;
  return [titleKey(title), titleKey(cleanCatalogBookTitle(title))];
 }).filter(Boolean))];
 if (!titles.length) return aliases;
 const works: any[] = [];
 for (let offset = 0; offset < titles.length; offset += 100) {
  const { data, error } = await admin.from('book_works').select('id').in('normalized_title', titles.slice(offset, offset + 100));
  if (error) throw error;
  works.push(...(data ?? []));
 }
 const ids = [...new Set(works.map(work => work.id))];
 const editions: any[] = [...seeds];
 for (let offset = 0; offset < ids.length; offset += 100) {
  for (let page = 0; ; page += 1000) {
   const { data, error } = await admin.from('book_editions').select('id,work_id,language,metadata')
    .in('provider', ['google_books', 'isbndb']).in('work_id', ids.slice(offset, offset + 100)).order('id').range(page, page + 999);
   if (error) throw error;
   editions.push(...(data ?? []));
   if ((data ?? []).length < 1000) break;
  }
 }
 for (const seed of seeds) {
  const matching = editions.filter(row => matchesSeriesCatalogEdition(seed.metadata.volumeInfo, row));
  aliases.set(seed.work_id, [...new Set<string>(matching.map(row => row.work_id))].sort());
 }
 return aliases;
}
