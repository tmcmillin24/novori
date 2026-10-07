// Provider metadata supplies candidates; the shared catalog selects artwork.
// These synchronous helpers are only for fallback metadata before a work has a
// saved selection. Rendering and saving use canonical-book-covers.ts.
export type BookImageLinks = {
  smallThumbnail?: string;
  thumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
  extraLarge?: string;
};

function secure(url?: string | null) {
  return url?.trim().replace(/^http:\/\//i, 'https://') || null;
}

export function getGoogleCoverCandidates(imageLinks?: BookImageLinks) {
  return [...new Set([
    imageLinks?.extraLarge, imageLinks?.large, imageLinks?.medium,
    imageLinks?.small, imageLinks?.thumbnail, imageLinks?.smallThumbnail,
  ].map(secure).filter((url): url is string => Boolean(url)))];
}

export function getHighestQualityGoogleCover(imageLinks?: BookImageLinks) {
  return getGoogleCoverCandidates(imageLinks)[0] ?? null;
}

export function getBookCoverPlan(input: { imageLinks?: BookImageLinks; isbn?: string | null; existingCoverUrl?: string | null }) {
  return {
    primaryUrl: secure(input.existingCoverUrl) ?? getHighestQualityGoogleCover(input.imageLinks),
    fallbackUrl: null,
  };
}
