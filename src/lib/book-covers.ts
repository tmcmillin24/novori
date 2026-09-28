export type BookImageLinks = {
  smallThumbnail?: string;
  thumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
  extraLarge?: string;
};

export type BookCoverPlan = {
  primaryUrl: string | null;
  fallbackUrl: string | null;
  source: 'google' | 'open-library' | 'none';
};

function secureUrl(
  url?: string | null
) {
  return (
    url?.replace(
      'http://',
      'https://'
    ) ??
    null
  );
}

export function normalizeIsbn(
  value?: string | null
) {
  const normalized =
    (
      value ??
      ''
    )
      .replace(
        /[^0-9Xx]/g,
        ''
      )
      .toUpperCase();

  return (
    normalized.length === 10 ||
    normalized.length === 13
  )
    ? normalized
    : null;
}

export function getHighestQualityGoogleCover(
  imageLinks?: BookImageLinks
) {
  return (
    secureUrl(
      imageLinks?.extraLarge
    ) ??
    secureUrl(
      imageLinks?.large
    ) ??
    secureUrl(
      imageLinks?.medium
    ) ??
    secureUrl(
      imageLinks?.small
    ) ??
    secureUrl(
      imageLinks?.thumbnail
    ) ??
    secureUrl(
      imageLinks?.smallThumbnail
    )
  );
}

export function hasSatisfactoryGoogleCover(
  imageLinks?: BookImageLinks
) {
  return Boolean(
    secureUrl(
      imageLinks?.extraLarge
    ) ||
    secureUrl(
      imageLinks?.large
    ) ||
    secureUrl(
      imageLinks?.medium
    )
  );
}

export function getOpenLibraryLargeCoverUrl(
  isbn?: string | null
) {
  const normalized =
    normalizeIsbn(
      isbn
    );

  if (
    !normalized
  ) {
    return null;
  }

  return `https://covers.openlibrary.org/b/isbn/${normalized}-L.jpg?default=false`;
}

export function getBookCoverPlan({
  imageLinks,
  isbn,
  existingCoverUrl,
}: {
  imageLinks?: BookImageLinks;
  isbn?: string | null;
  existingCoverUrl?: string | null;
}): BookCoverPlan {
  const googleCover =
    getHighestQualityGoogleCover(
      imageLinks
    );

  const openLibraryCover =
    getOpenLibraryLargeCoverUrl(
      isbn
    );

  if (
    hasSatisfactoryGoogleCover(
      imageLinks
    )
  ) {
    return {
      primaryUrl:
        googleCover,
      fallbackUrl:
        openLibraryCover,
      source:
        googleCover
          ? 'google'
          : openLibraryCover
          ? 'open-library'
          : 'none',
    };
  }

  if (
    openLibraryCover
  ) {
    return {
      primaryUrl:
        openLibraryCover,
      fallbackUrl:
        googleCover ??
        secureUrl(
          existingCoverUrl
        ),
      source:
        'open-library',
    };
  }

  const existing =
    secureUrl(
      existingCoverUrl
    );

  return {
    primaryUrl:
      googleCover ??
      existing,
    fallbackUrl:
      null,
    source:
      googleCover
        ? 'google'
        : existing
        ? 'google'
        : 'none',
  };
}
