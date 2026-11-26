import type { GoogleBookSearchItem } from './book-search';

export type BookDetailParams = {
  id: string;
  source?: string;
  coverUrl?: string;
  clickedTitle?: string;
  clickedSubtitle?: string;
  clickedAuthors?: string;
  clickedIsbn?: string;
  clickedRating?: string;
  clickedRatingsCount?: string;
  discoveryId?: string;
  canonicalizeWork?: string;
  trustedCover?: string;
  detailHandoff?: string;
  seriesPreviewName?: string;
  seriesPreviewPosition?: string;
  seriesPreviewDate?: string;
  seriesPreviewEditionCheckFailed?: string;
};

export function openingAuthors(raw?: string): string[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const authors: unknown = JSON.parse(raw);
    return Array.isArray(authors) ? authors.filter((name): name is string => typeof name === 'string' && !!name.trim()) : [];
  } catch { return []; }
}

// Display hints for this visit only. They must never be written into the detail cache
// or used in place of the catalog's verified edition for reports or library writes.
export function discoverOpening(params: BookDetailParams, authors: string[]) {
  if (params.source !== 'discover' || !params.id || typeof params.clickedTitle !== 'string' || !params.clickedTitle.trim()) return null;
  const isbn = !params.discoveryId && params.clickedIsbn;
  const book: Pick<GoogleBookSearchItem, 'id' | 'volumeInfo'> = {
    id: params.id,
    volumeInfo: {
      title: params.clickedTitle,
      subtitle: typeof params.clickedSubtitle === 'string' ? params.clickedSubtitle : undefined,
      authors,
      ...(isbn && /^(?:\d{13}|\d{9}[\dX])$/i.test(isbn) ? {
        industryIdentifiers: [{ type: isbn.length === 13 ? 'ISBN_13' : 'ISBN_10', identifier: isbn }],
      } : {}),
    },
  };
  const numberParam = (value?: string) => typeof value === 'string' && value.trim() ? Number(value) : NaN;
  const rating = numberParam(params.clickedRating);
  const count = numberParam(params.clickedRatingsCount);
  return {
    book,
    rating: rating >= 0 && rating <= 5 ? rating : null,
    ratingsCount: Number.isSafeInteger(count) && count >= 0 ? count : null,
  };
}
