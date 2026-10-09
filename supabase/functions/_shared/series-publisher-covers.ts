import { isPreferredCoverIsbn as isRegisteredAnchor, preferredArtworkIsbn, preferredCoverIsbn } from './catalog-cover-preferences.ts';
import { matchesSeriesCatalogEdition } from './series-book-catalog.ts';
import { cachedEditionCover } from './catalog-metadata-covers.ts';

export const SERIES_PUBLISHER_VARIANT = 'series_publisher_preference_v1';
export const publisherKey = (value: string) => value.toLowerCase().replace(/\([^)]*\)/g, '')
  .replace(/\b(?:publishing|publishers?|corp(?:oration)?|replenishment|titles)\b/g, '')
  .replace(/[^a-z0-9]/g, '');
const paperback = (row: any) => /paperback/i.test(row.metadata?.novoriEdition?.binding ?? '') &&
  !/mass market|large print/i.test(row.metadata?.novoriEdition?.binding ?? '') &&
  !/\b(?:deluxe|collector|limited edition|large print)\b/i.test(row.metadata?.novoriEdition?.originalTitle ?? row.metadata?.volumeInfo?.title ?? '');

/** An explicit edition choice anchors a series family; publisher names alone
 * never imply image quality or change unrelated books. No upstream requests. */
export function seriesPublisherCandidates(editions: any[], books: any[], seriesId: number) {
  if (!Number.isSafeInteger(seriesId) || seriesId <= 0) return [];
  const anchors = books.flatMap(book => {
    const isbn = preferredCoverIsbn(book);
    const row = editions.find(row => row.provider === 'isbndb' && row.isbn_13 === isbn &&
      matchesSeriesCatalogEdition(book, row) && cachedEditionCover(row) && paperback(row));
    const publisher = publisherKey(row?.metadata?.volumeInfo?.publisher ?? '');
    return row && publisher ? [{isbn, publisher}] : [];
  });
  // Conflicting explicit choices must not force a family on the remaining books.
  if (!anchors.length || new Set(anchors.map(row => row.publisher)).size !== 1) return [];
  const anchor = anchors[0];
  return books.flatMap(book => {
    const matches = editions.filter(row => row.id && row.work_id && row.provider === 'isbndb' &&
      matchesSeriesCatalogEdition(book, row) && paperback(row) && cachedEditionCover(row) &&
      publisherKey(row.metadata.volumeInfo.publisher ?? '') === anchor.publisher);
    matches.sort((a,b) => String(a.isbn_13).localeCompare(String(b.isbn_13)));
    // An explicit artwork ISBN may use an ebook cover without changing the
    // publisher/format preference used for the other siblings.
    const explicit = editions.find(row => row.id && row.work_id && row.provider === 'isbndb' &&
      (row.isbn_13 === (preferredArtworkIsbn(book) ?? preferredCoverIsbn(book))) && matchesSeriesCatalogEdition(book,row) && cachedEditionCover(row));
    const row = explicit ?? matches[0];
    if (!row) return [];
    const workIds = [...new Set(editions.filter(edition => edition.work_id && matchesSeriesCatalogEdition(book, edition)).map(edition => edition.work_id))];
    return workIds.map(workId => ({work_id:workId,edition_id:editions.find(edition => edition.work_id === workId && matchesSeriesCatalogEdition(book, edition))!.id,provider:'isbndb',source_variant:SERIES_PUBLISHER_VARIANT,
      scope:'work',source_kind:'image_link',external_id:String(seriesId),url:cachedEditionCover(row),
      candidate_key:`isbndb:${seriesId}:${workId}:${SERIES_PUBLISHER_VARIANT}`,
      discovery_source:'series_publisher_preference',last_seen_at:new Date().toISOString(),
      source_metadata:{seriesId,anchorIsbn:anchor.isbn,publisher:anchor.publisher,isbn:row.isbn_13,identityIsbn:matches[0]?.isbn_13 ?? row.isbn_13,
        title:book.title,authors:book.authors}}));
  });
}

export function verifiedSeriesPublisherEdition(seed: any, candidate: any, editions: any[]) {
  const proof = candidate.source_metadata;
  if (candidate.provider !== 'isbndb' || candidate.source_variant !== SERIES_PUBLISHER_VARIANT ||
      !Number.isSafeInteger(proof?.seriesId) || proof.seriesId <= 0 || !proof.publisher ||
      !matchesSeriesCatalogEdition(proof, seed)) return null;
  const anchor = editions.find(row => row.isbn_13 === proof.anchorIsbn &&
    preferredCoverIsbn(row.metadata?.volumeInfo ?? {}) === proof.anchorIsbn && paperback(row) &&
    publisherKey(row.metadata?.volumeInfo?.publisher ?? '') === proof.publisher);
  // The anchor may belong to another work and is checked when persisting the
  // server-only proof. On later reads its registered ISBN is checked below.
  if (!anchor && !isRegisteredAnchor(proof.anchorIsbn)) return null;
  return editions.find(row => row.provider === 'isbndb' && row.isbn_13 === proof.isbn &&
    matchesSeriesCatalogEdition(seed.metadata?.volumeInfo ?? {}, row) &&
    (paperback(row) || (preferredArtworkIsbn(row.metadata?.volumeInfo ?? {}) ?? preferredCoverIsbn(row.metadata?.volumeInfo ?? {})) === row.isbn_13) &&
    publisherKey(row.metadata.volumeInfo.publisher ?? '') === proof.publisher && cachedEditionCover(row) === candidate.url) ?? null;
}
