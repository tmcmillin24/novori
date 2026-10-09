import { cachedEditionCover } from '../../supabase/functions/_shared/catalog-metadata-covers';
import { matchesSeriesCatalogEdition } from '../../supabase/functions/_shared/series-book-catalog';

type SeriesRow = { id: number; title: string; authors?: string[]; coverBookId?: string | null; coverUrl?: string | null; coverFallback?: boolean };
type SearchBook = { id: string; volumeInfo: { title?: string; authors?: string[]; language?: string; imageLinks?: Record<string, string> } };

/** Resolve missing rows sequentially through the shared search cache, without opening a book. */
export async function loadMissingSeriesCovers<T extends SeriesRow>(
 rows: T[],
 search: (title: string) => Promise<SearchBook[]>,
 publish: (row: T, bookId: string) => void,
 active: () => boolean,
) {
 for (const row of rows) {
  if (!active()) return;
  if ((row.coverUrl && !row.coverFallback) || !row.authors?.length || !row.title || /^(?:unannounced|untitled|tba|tbd)$/i.test(row.title.trim())) continue;
  try {
   const results = await search(row.title);
   if (!active()) return;
   const match = results.find(result => matchesSeriesCatalogEdition(row, { metadata: result }) && cachedEditionCover({provider:'isbndb', metadata:result}));
   if (match) publish(row, match.id);
  } catch {
   // A failed optional cover must not prevent the other rows from loading.
  }
 }
}
