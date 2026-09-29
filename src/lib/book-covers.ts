import {
  Image,
} from 'react-native';

import {
  supabase,
} from './supabase';

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

function getGoogleBooksImageParam(
  url: string,
  key: string
) {
  try {
    const parsed =
      new URL(
        url
      );

    return parsed.searchParams.get(
      key
    );
  } catch {
    return null;
  }
}

function isSameGoogleBooksCover(
  referenceUrl: string,
  candidateUrl: string
) {
  const reference =
    secureUrl(
      referenceUrl
    );

  const candidate =
    secureUrl(
      candidateUrl
    );

  if (
    !reference ||
    !candidate
  ) {
    return false;
  }

  const referenceId =
    getGoogleBooksImageParam(
      reference,
      'id'
    );

  const candidateId =
    getGoogleBooksImageParam(
      candidate,
      'id'
    );

  if (
    referenceId &&
    candidateId &&
    referenceId !==
      candidateId
  ) {
    return false;
  }

  const referencePrintSec =
    getGoogleBooksImageParam(
      reference,
      'printsec'
    );

  const candidatePrintSec =
    getGoogleBooksImageParam(
      candidate,
      'printsec'
    );

  if (
    referencePrintSec &&
    candidatePrintSec &&
    referencePrintSec !==
      candidatePrintSec
  ) {
    return false;
  }

  if (
    referencePrintSec ===
      'frontcover' &&
    candidatePrintSec &&
    candidatePrintSec !==
      'frontcover'
  ) {
    return false;
  }

  if (
    referenceId &&
    candidateId
  ) {
    return true;
  }

  return (
    reference.split(
      '?'
    )[0] ===
    candidate.split(
      '?'
    )[0]
  );
}

export function getGoogleCoverCandidates(
  imageLinks?: BookImageLinks
) {
  const thumbnail =
    secureUrl(
      imageLinks?.thumbnail ??
      imageLinks?.smallThumbnail
    );

  const higherResolution =
    uniqueUrls([
      imageLinks?.extraLarge,
      imageLinks?.large,
      imageLinks?.medium,
      imageLinks?.small,
    ]);

  const matchingHigherResolution =
    thumbnail
      ? higherResolution.filter(
          (
            candidate
          ) =>
            isSameGoogleBooksCover(
              thumbnail,
              candidate
            )
        )
      : higherResolution;

  return uniqueUrls([
    ...matchingHigherResolution,
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

export function getOpenLibraryCoverIdUrl(
  coverId?:
    | number
    | null
) {
  if (
    !coverId ||
    !Number.isFinite(
      coverId
    )
  ) {
    return null;
  }

  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`;
}

function normalizeWorkLookupText(
  value?: string | null
) {
  return (
    value ??
    ''
  )
    .toLowerCase()
    .normalize('NFKD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-z0-9]+/g,
      ' '
    )
    .trim();
}

type OpenLibrarySearchResponse = {
  docs?: {
    key?: string;
    title?: string;
    author_name?: string[];
    cover_i?: number;
    isbn?: string[];
  }[];
};

type OpenLibraryWorkResponse = {
  covers?: number[];
};


type SharedOpenLibraryWorkCoverEnvelope = {
  ok?: boolean;
  status?: number;
  data?: {
    kind?: 'work-cover';
    matchFound?: boolean;
    workKey?: string | null;
    coverIds?: number[];
  } | null;
  error?: string;
  reason?: string;
  cache?: {
    status?:
      | 'hit'
      | 'miss'
      | 'stale'
      | 'bypass';
    openLibraryRequestsMade?: number;
    expiresAt?: string;
    reason?: string;
  };
};

async function fetchSharedOpenLibraryCoverIds({
  title,
  author,
}: {
  title: string;
  author: string;
}): Promise<
  | {
      handled: true;
      coverIds: number[];
    }
  | {
      handled: false;
      coverIds: [];
    }
> {
  try {
    const {
      data,
      error,
    } =
      await supabase.functions.invoke(
        'open-library-work-cover',
        {
          body: {
            title,
            author,
          },
        }
      );

    if (
      error
    ) {
      console.warn(
        'Shared Open Library resolver unavailable; using direct fallback:',
        error
      );

      return {
        handled: false,
        coverIds: [],
      };
    }

    const response =
      data as
        SharedOpenLibraryWorkCoverEnvelope;

    if (
      response?.ok ===
        true &&
      response.data
    ) {
      if (
        __DEV__
      ) {
        console.log(
          '[Novori Open Library cache]',
          {
            cache:
              response.cache
                ?.status ??
              'unknown',
            openLibraryRequestsMade:
              response.cache
                ?.openLibraryRequestsMade ??
              0,
          }
        );
      }

      return {
        handled: true,
        coverIds:
          (
            response.data
              .coverIds ??
            []
          ).filter(
            (
              coverId
            ) =>
              Number.isFinite(
                coverId
              ) &&
              coverId >
                0
          ),
      };
    }

    if (
      response?.ok ===
        false &&
      (
        response.status ??
        500
      ) <
        500
    ) {
      return {
        handled: true,
        coverIds: [],
      };
    }

    console.warn(
      'Shared Open Library resolver failed; using direct fallback:',
      response?.error ??
        response?.status ??
        'unexpected response'
    );

    return {
      handled: false,
      coverIds: [],
    };
  } catch (
    error
  ) {
    console.warn(
      'Shared Open Library resolver failed; using direct fallback:',
      error
    );

    return {
      handled: false,
      coverIds: [],
    };
  }
}

async function fetchOpenLibraryCoverIdsDirect({
  title,
  author,
}: {
  title: string;
  author: string;
}) {
  const params =
    new URLSearchParams();

  params.set(
    'title',
    title
  );

  if (
    author
  ) {
    params.set(
      'author',
      author
    );
  }

  params.set(
    'fields',
    'key,title,author_name,cover_i,isbn'
  );

  params.set(
    'limit',
    '10'
  );

  const response =
    await fetch(
      `https://openlibrary.org/search.json?${params.toString()}`
    );

  if (
    !response.ok
  ) {
    return [];
  }

  const payload =
    await response.json() as
      OpenLibrarySearchResponse;

  const wantedTitle =
    normalizeWorkLookupText(
      title
    );

  const wantedAuthor =
    normalizeWorkLookupText(
      author
    );

  const candidate =
    (
      payload.docs ??
      []
    ).find(
      (
        doc
      ) => {
        const candidateTitle =
          normalizeWorkLookupText(
            doc.title
          );

        const titleMatches =
          candidateTitle ===
            wantedTitle ||
          candidateTitle.startsWith(
            `${wantedTitle} `
          ) ||
          wantedTitle.startsWith(
            `${candidateTitle} `
          );

        const candidateAuthors =
          (
            doc.author_name ??
            []
          ).map(
            normalizeWorkLookupText
          );

        const authorMatches =
          !wantedAuthor ||
          candidateAuthors.some(
            (
              candidateAuthor
            ) =>
              candidateAuthor ===
                wantedAuthor ||
              candidateAuthor.includes(
                wantedAuthor
              ) ||
              wantedAuthor.includes(
                candidateAuthor
              )
          );

        return (
          titleMatches &&
          authorMatches &&
          Boolean(
            doc.cover_i
          )
        );
      }
    );

  if (
    !candidate
  ) {
    return [];
  }

  const workKey =
    (
      candidate.key ??
      ''
    )
      .replace(
        /^\/works\//,
        ''
      )
      .trim();

  const coverIds =
    new Set<number>();

  if (
    candidate.cover_i
  ) {
    coverIds.add(
      candidate.cover_i
    );
  }

  if (
    workKey
  ) {
    try {
      const workResponse =
        await fetch(
          `https://openlibrary.org/works/${encodeURIComponent(
            workKey
          )}.json`
        );

      if (
        workResponse.ok
      ) {
        const work =
          await workResponse.json() as
            OpenLibraryWorkResponse;

        for (
          const coverId of
            work.covers ??
            []
        ) {
          if (
            Number.isFinite(
              coverId
            ) &&
            coverId >
              0
          ) {
            coverIds.add(
              coverId
            );
          }
        }
      }
    } catch {
      // The search-result cover remains a valid fallback.
    }
  }

  return Array.from(
    coverIds
  );
}

export async function resolveOpenLibraryWorkCover({
  title,
  authors,
}: {
  title?: string | null;
  authors?: string[];
}): Promise<BookCoverResolution> {
  const cleanTitle =
    title?.trim() ??
    '';

  const primaryAuthor =
    authors?.[0]?.trim() ??
    '';

  if (
    !cleanTitle
  ) {
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

  try {
    const shared =
      await fetchSharedOpenLibraryCoverIds({
        title:
          cleanTitle,
        author:
          primaryAuthor,
      });

    const resolvedCoverIds =
      shared.handled
        ? shared.coverIds
        : await fetchOpenLibraryCoverIdsDirect({
            title:
              cleanTitle,
            author:
              primaryAuthor,
          });

    let best:
      | {
          url: string;
          width: number;
          height: number;
        }
      | null =
      null;

    for (
      const coverId of
        resolvedCoverIds
    ) {
      const url =
        getOpenLibraryCoverIdUrl(
          coverId
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

      const candidateCover = {
        url,
        ...size,
      };

      if (
        !best ||
        area(
          candidateCover
        ) >
          area(
            best
          )
      ) {
        best =
          candidateCover;
      }
    }

    if (
      !best
    ) {
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

    return {
      url:
        best.url,
      source:
        'open-library',
      width:
        best.width,
      height:
        best.height,
    };
  } catch {
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

  // Google/existing is the normal path. Do not contact Open Library
  // unless there is no usable cover at all.
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
    openLibrarySize
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

  const existing =
    secureUrl(
      existingCoverUrl
    );

  const openLibraryCover =
    getOpenLibraryLargeCoverUrl(
      isbn
    );

  return {
    primaryUrl:
      googleCover ??
      existing,
    fallbackUrl:
      openLibraryCover,
  };
}
