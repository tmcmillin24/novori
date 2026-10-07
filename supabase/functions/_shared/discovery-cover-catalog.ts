import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { selectCanonicalGoogleCoversForWorkIds } from './book-cover-selector.ts';
import { attachSeriesCatalogIdentities } from './series-book-catalog.ts';

/** Catalog-only artwork overlay, with the same title/author checks as series. */
export async function attachDiscoveryCatalogCovers(admin: SupabaseClient, payload: any) {
  const verified = await attachSeriesCatalogIdentities(admin, payload);
  const ids = [...new Set<string>((verified.books ?? []).map((book: any) => book.coverBookId).filter(Boolean))];
  if (!ids.length) return { ...verified, books: verified.books.map((book: any) => ({ ...book, coverUrl: null })) };
  const { data: editions, error } = await admin.from('book_editions')
    .select('provider_book_id,work_id,metadata').in('provider', ['google_books', 'isbndb']).in('provider_book_id', ids);
  if (error) throw error;
  const works = [...new Set<string>((editions ?? []).map((row: any) => row.work_id).filter(Boolean))];
  await selectCanonicalGoogleCoversForWorkIds(admin, works);
  const { data: selections, error: selectionError } = await admin.from('book_cover_selections')
    .select('work_id,candidate_id,locked').eq('status', 'selected').in('work_id', works);
  if (selectionError) throw selectionError;
  const candidateIds = [...new Set<string>((selections ?? []).map((row: any) => row.candidate_id).filter(Boolean))];
  let candidates: any[] = [];
  if (candidateIds.length) {
    const result = await admin.from('book_cover_candidates').select('id,url,provider').in('id', candidateIds);
    if (result.error) throw result.error;
    candidates = result.data ?? [];
  }
  const urls = new Map(candidates.map(row => [row.id, row]));
  const selected = new Map((selections ?? []).map((row: any) => {
    const candidate: any = urls.get(row.candidate_id);
    return [row.work_id, candidate && (row.locked || candidate.provider !== 'hardcover') ? candidate.url : null];
  }));
  const byId = new Map((editions ?? []).map((row: any) => [row.provider_book_id, row]));
  return { ...verified, books: verified.books.map((book: any) => {
    const edition: any = byId.get(book.coverBookId);
    const links = edition?.metadata?.volumeInfo?.imageLinks;
    const coverUrl = selected.get(edition?.work_id) ?? links?.extraLarge ?? links?.large ?? links?.medium ?? links?.thumbnail;
    return { ...book, coverUrl: coverUrl ? String(coverUrl).replace(/^http:\/\//i, 'https://') : null };
  }) };
}
