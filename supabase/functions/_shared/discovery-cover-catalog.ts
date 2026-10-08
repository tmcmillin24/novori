import { safeHardcoverCoverUrl } from './hardcover-discovery-covers.ts';
import { attachSeriesCatalogIdentities } from './series-book-catalog.ts';
import { readEditionCovers } from './edition-cover-catalog.ts';

/** Discovery and every book screen use the same edition cover reader. */
export async function attachDiscoveryCatalogCovers(admin: any, payload: any) {
  const verified = await attachSeriesCatalogIdentities(admin, payload);
  const ids = [...new Set((verified.books ?? []).map((book: any) => book.coverBookId).filter(Boolean))];
  if (!ids.length) return { ...verified, books: verified.books.map(discoveryArtOnly) };
  const { data: editions, error } = await admin.from('book_editions')
    .select('id,provider,provider_book_id,work_id,isbn_10,isbn_13,language,metadata')
    .in('provider', ['google_books', 'isbndb']).in('provider_book_id', ids);
  if (error) throw error;
  const choices = await readEditionCovers(admin, editions ?? [], payload.books ?? []);
  return { ...verified, books: verified.books.flatMap((book: any) => {
    const candidates = choices.get(book.coverBookId) ?? [];
    const cover = candidates[0];
    if (!cover) return [discoveryArtOnly(book)];
    return [{ ...book, coverBookId: cover.bookId, coverUrl: cover.url,
      coverAlternatives: candidates, coverPolicyVersion: 7,
      coverProvider: cover.provider, coverAliases: cover.aliases, coverWorkId: cover.workId ?? `edition:${cover.bookId}`,
      genres: cover.genres?.length ? cover.genres : book.genres }];
  }) };
}

export function discoveryArtOnly(book: any) {
 const proof = book.coverProof;
 const valid = proof?.version === 2 && proof.source === 'hardcover_work_image' &&
  proof.hardcoverBookId === book.id && proof.title === book.title && Boolean(safeHardcoverCoverUrl(proof.url));
 return {...book, coverUrl: valid ? proof.url : null, coverProvider: valid ? 'hardcover' : undefined,
  coverWorkId: valid ? `hardcover:${book.id}` : undefined, coverPolicyVersion:7};
}
