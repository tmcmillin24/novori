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

  if (
    google &&
    isSatisfactory(
      google
    )
  ) {
    return {
      url:
        google.url,
      source:
        'google',
      width:
        google.width,
      height:
        google.height,
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
      !google ||
      area(
        openLibrarySize
      ) >
        area(
          google
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
    google
  ) {
    return {
      url:
        google.url,
      source:
        'google',
      width:
        google.width,
      height:
        google.height,
    };
  }

  const existing =
    secureUrl(
      existingCoverUrl
    );

  if (
    existing
  ) {
    const existingSize =
      await getImageSize(
        existing
      );

    return {
      url:
        existing,
      source:
        'existing',
      width:
        existingSize
          ?.width ??
        null,
      height:
        existingSize
          ?.height ??
        null,
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
