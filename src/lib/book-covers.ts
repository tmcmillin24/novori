import {
  Image,
} from 'react-native';

export type BookImageLinks = {
  smallThumbnail?: string;
  thumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
  extraLarge?: string;
};

export type BookCoverSource =
  | 'google'
  | 'open-library'
  | 'existing'
  | 'none';

export type BookCoverResolution = {
  url: string | null;
  source: BookCoverSource;
  width: number | null;
  height: number | null;
};

const MIN_SATISFACTORY_WIDTH =
  400;

const MIN_SATISFACTORY_HEIGHT =
  600;

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

function uniqueUrls(
  values:
    (
      | string
      | null
      | undefined
    )[]
) {
  return Array.from(
    new Set(
      values
        .map(
          secureUrl
        )
        .filter(
          (
            value
          ): value is string =>
            Boolean(
              value
            )
        )
    )
  );
}

export function getGoogleCoverCandidates(
  imageLinks?: BookImageLinks
) {
  return uniqueUrls([
    imageLinks?.extraLarge,
    imageLinks?.large,
    imageLinks?.medium,
    imageLinks?.small,
    imageLinks?.thumbnail,
    imageLinks?.smallThumbnail,
  ]);
}

export function getHighestQualityGoogleCover(
  imageLinks?: BookImageLinks
) {
  return (
    getGoogleCoverCandidates(
      imageLinks
    )[0] ??
    null
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

function getImageSize(
  url: string
): Promise<{
  width: number;
  height: number;
} | null> {
  return new Promise(
    (
      resolve
    ) => {
      Image.getSize(
        url,
        (
          width,
          height
        ) => {
          if (
            Number.isFinite(
              width
            ) &&
            Number.isFinite(
              height
            ) &&
            width >
              0 &&
            height >
              0
          ) {
            resolve({
              width,
              height,
            });
            return;
          }

          resolve(
            null
          );
        },
        () => {
          resolve(
            null
          );
        }
      );
    }
  );
}

function area(
  size:
    | {
        width: number;
        height: number;
      }
    | null
) {
  return size
    ? size.width *
        size.height
    : 0;
}

function isSatisfactory(
  size:
    | {
        width: number;
        height: number;
      }
    | null
) {
  return Boolean(
    size &&
    size.width >=
      MIN_SATISFACTORY_WIDTH &&
    size.height >=
      MIN_SATISFACTORY_HEIGHT
  );
}

async function resolveBestGoogleCandidate(
  imageLinks?: BookImageLinks
) {
  const candidates =
    getGoogleCoverCandidates(
      imageLinks
    );

  let best:
    | {
        url: string;
        width: number;
        height: number;
      }
    | null =
    null;

  for (
    const url of
      candidates
  ) {
    const size =
      await getImageSize(
        url
      );

    if (
      !size
    ) {
      continue;
    }

    const candidate = {
      url,
      ...size,
    };

    if (
      !best ||
      area(
        candidate
      ) >
        area(
          best
        )
    ) {
      best =
        candidate;
    }

    // Google already gave us an objectively good cover.
    // Do not spend an Open Library ISBN request unless needed.
    if (
      isSatisfactory(
        candidate
      )
    ) {
      break;
    }
  }

  return best;
}

export async function resolveBestWorkCover({
  editions,
  existingCoverUrl,
}: {
  editions: {
    imageLinks?: BookImageLinks;
    isbn?: string | null;
  }[];
  existingCoverUrl?: string | null;
}): Promise<BookCoverResolution> {
  const googleCandidates =
    uniqueUrls(
      editions.map(
        (
          edition
        ) =>
          getHighestQualityGoogleCover(
            edition.imageLinks
          )
      )
    );

  let bestGoogle:
    | {
        url: string;
        width: number;
        height: number;
      }
    | null =
    null;

  for (
    const url of
      googleCandidates
  ) {
    const size =
      await getImageSize(
        url
      );

    if (
      !size
    ) {
      continue;
    }

    const candidate = {
      url,
      ...size,
    };

    if (
      !bestGoogle ||
      area(
        candidate
      ) >
        area(
          bestGoogle
        )
    ) {
      bestGoogle =
        candidate;
    }
  }

  const existing =
    secureUrl(
      existingCoverUrl
    );

  let bestExisting:
    | {
        url: string;
        width: number;
        height: number;
      }
    | null =
    null;

  if (
    existing
  ) {
    const size =
      await getImageSize(
        existing
      );

    if (
      size
    ) {
      bestExisting = {
        url:
          existing,
        ...size,
      };
    }
  }

  let currentBest =
    bestGoogle;

  if (
    bestExisting &&
    (
      !currentBest ||
      area(
        bestExisting
      ) >
        area(
          currentBest
        )
    )
  ) {
    currentBest =
      bestExisting;
  }

  const isbnCandidates =
    Array.from(
      new Set(
        editions
          .map(
            (
              edition
            ) =>
              normalizeIsbn(
                edition.isbn
              )
          )
          .filter(
            (
              isbn
            ): isbn is string =>
              Boolean(
                isbn
              )
          )
      )
    );

  let bestOpenLibrary:
    | {
        url: string;
        width: number;
        height: number;
      }
    | null =
    null;

  for (
    const isbn of
      isbnCandidates
  ) {
    const url =
      getOpenLibraryLargeCoverUrl(
        isbn
      );

    if (
      !url
    ) {
      continue;
    }

    const size =
      await getImageSize(
        url
      );

    if (
      !size
    ) {
      continue;
    }

    const candidate = {
      url,
      ...size,
    };

    if (
      !bestOpenLibrary ||
      area(
        candidate
      ) >
        area(
          bestOpenLibrary
        )
    ) {
      bestOpenLibrary =
        candidate;
    }
  }

  if (
    bestOpenLibrary
  ) {
    // Work-level cover art is allowed to come from another verified
    // edition. Prefer Open Library's original large cover over a Google
    // rendition when one exists, because Google frequently reports
    // server-resized dimensions that can make a blurry source look
    // artificially "larger" than it really is.
    return {
      url:
        bestOpenLibrary.url,
      source:
        'open-library',
      width:
        bestOpenLibrary.width,
      height:
        bestOpenLibrary.height,
    };
  }

  if (
    currentBest
  ) {
    return {
      url:
        currentBest.url,
      source:
        bestExisting &&
        currentBest.url ===
          bestExisting.url
          ? 'existing'
          : 'google',
      width:
        currentBest.width,
      height:
        currentBest.height,
    };
  }

  return {
    url:
      null,
    source:
      'none',
    width:
      null,
    height:
      null,
  };
}

export async function resolveBestBookCover({
  imageLinks,
  isbn,
  existingCoverUrl,
}: {
  imageLinks?: BookImageLinks;
  isbn?: string | null;
  existingCoverUrl?: string | null;
}): Promise<BookCoverResolution> {
  const google =
    await resolveBestGoogleCandidate(
      imageLinks
    );

  const existing =
    secureUrl(
      existingCoverUrl
    );

  const existingSize =
    existing
      ? await getImageSize(
          existing
        )
      : null;

  let currentBest:
    | {
        url: string;
        width: number;
        height: number;
        source:
          | 'google'
          | 'existing';
      }
    | null =
    null;

  if (
    google
  ) {
    currentBest = {
      ...google,
      source:
        'google',
    };
  }

  if (
    existing &&
    existingSize &&
    (
      !currentBest ||
      area(
        existingSize
      ) >
        area(
          currentBest
        )
    )
  ) {
    currentBest = {
      url:
        existing,
      width:
        existingSize.width,
      height:
        existingSize.height,
      source:
        'existing',
    };
  }

  const openLibraryUrl =
    getOpenLibraryLargeCoverUrl(
      isbn
    );

  const openLibrarySize =
    openLibraryUrl
      ? await getImageSize(
          openLibraryUrl
        )
      : null;

  if (
    openLibraryUrl &&
    openLibrarySize &&
    (
      !currentBest ||
      area(
        openLibrarySize
      ) >
        area(
          currentBest
        )
    )
  ) {
    return {
      url:
        openLibraryUrl,
      source:
        'open-library',
      width:
        openLibrarySize.width,
      height:
        openLibrarySize.height,
    };
  }

  if (
    currentBest
  ) {
    return {
      url:
        currentBest.url,
      source:
        currentBest.source,
      width:
        currentBest.width,
      height:
        currentBest.height,
    };
  }

  return {
    url:
      null,
    source:
      'none',
    width:
      null,
    height:
      null,
  };
}

export async function resolveBookCoverUrl(
  input: {
    imageLinks?: BookImageLinks;
    isbn?: string | null;
    existingCoverUrl?: string | null;
  }
) {
  return (
    await resolveBestBookCover(
      input
    )
  ).url;
}

// Synchronous initial choice for first paint. BookCoverImage immediately
// replaces this after measuring the real remote image dimensions.
export function getBookCoverPlan({
  imageLinks,
  isbn,
  existingCoverUrl,
}: {
  imageLinks?: BookImageLinks;
  isbn?: string | null;
  existingCoverUrl?: string | null;
}) {
  const googleCover =
    getHighestQualityGoogleCover(
      imageLinks
    );

  const openLibraryCover =
    getOpenLibraryLargeCoverUrl(
      isbn
    );

  return {
    primaryUrl:
      googleCover ??
      openLibraryCover ??
      secureUrl(
        existingCoverUrl
      ),
    fallbackUrl:
      openLibraryCover ??
      secureUrl(
        existingCoverUrl
      ),
  };
}
