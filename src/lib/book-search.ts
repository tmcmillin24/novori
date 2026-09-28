import { supabase } from './supabase';
import { fetchGoogleBooksJson } from './google-books';

export type GoogleBookSearchItem = {
  id: string;
  novoriWork?: {
    key: string;
    canonicalTitle: string;
    primaryAuthor: string;
    googleBookIds: string[];
    isbns: string[];
    hardcoverRating?: number | null;
    hardcoverRatingsCount?: number | null;
  };
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
    industryIdentifiers?: {
      type: string;
      identifier: string;
    }[];
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    ratingsCount?: number;
    language?: string;
  };
};

type GoogleBooksResponse = {
  totalItems?: number;
  items?: GoogleBookSearchItem[];
};

type HardcoverSearchPopularityResponse = {
  popularity?: Record<
    string,
    {
      usersCount: number;
      rating: number | null;
      ratingsCount?: number | null;
      reviewsCount?: number | null;
    }
  >;
  error?: string;
};

function normalizeTitle(value?: string) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getGoogleBookPopularity(
  book: GoogleBookSearchItem
) {
  return {
    ratingsCount:
      book.volumeInfo.ratingsCount ??
      0,
    averageRating:
      book.volumeInfo.averageRating ??
      0,
  };
}

function getBookIsbns(
  book: GoogleBookSearchItem
) {
  return (
    book.volumeInfo
      .industryIdentifiers ??
    []
  )
    .map(
      (identifier) =>
        identifier.identifier
          ?.replace(
            /[^0-9Xx]/g,
            ''
          )
          .toUpperCase()
    )
    .filter(
      (
        value
      ): value is string =>
        Boolean(value)
    );
}

async function getHardcoverPopularity(
  books: GoogleBookSearchItem[],
  allowTitleFallback = false
) {
  const preparedBooks =
    books
      .map((book) => ({
        googleBookId:
          book.id,
        title:
          book.volumeInfo.title ??
          '',
        authors:
          book.volumeInfo.authors ??
          [],
        isbns:
          Array.from(
            new Set([
              ...(
                book.novoriWork
                  ?.isbns ??
                []
              ),
              ...getBookIsbns(
                book
              ),
            ])
          ),
      }))
      .filter(
        (book) =>
          allowTitleFallback
            ? Boolean(
                book.title
              )
            : book.isbns.length >
              0
      );

  if (
    preparedBooks.length ===
    0
  ) {
    return {};
  }

  const mergedPopularity:
    HardcoverSearchPopularityResponse['popularity'] =
    {};

  const batches:
    typeof preparedBooks[] =
    [];

  for (
    let index = 0;
    index <
    preparedBooks.length;
    index += 40
  ) {
    batches.push(
      preparedBooks.slice(
        index,
        index + 40
      )
    );
  }

  for (
    const batch of
    batches
  ) {
    try {
      const {
        data,
        error:
          functionError,
      } =
        await supabase.functions.invoke(
          'hardcover-search-popularity',
          {
            body: {
              books:
                batch,
              allowTitleFallback,
            },
          }
        );

      if (
        functionError
      ) {
        continue;
      }

      const response =
        data as
          HardcoverSearchPopularityResponse;

      if (
        response?.error
      ) {
        continue;
      }

      Object.assign(
        mergedPopularity,
        response?.popularity ??
        {}
      );
    } catch {
      // Preserve any successfully resolved batches.
    }
  }

  return (
    mergedPopularity ??
    {}
  );
}

function compareBookPopularity(
  a: GoogleBookSearchItem,
  b: GoogleBookSearchItem,
  hardcoverPopularity: Record<
    string,
    {
      usersCount: number;
      rating: number | null;
    }
  >
) {
  const aHardcover =
    hardcoverPopularity[
      a.id
    ];

  const bHardcover =
    hardcoverPopularity[
      b.id
    ];

  const aUsersCount =
    aHardcover?.usersCount ??
    0;

  const bUsersCount =
    bHardcover?.usersCount ??
    0;

  if (
    bUsersCount !==
    aUsersCount
  ) {
    return (
      bUsersCount -
      aUsersCount
    );
  }

  const aGoogle =
    getGoogleBookPopularity(
      a
    );

  const bGoogle =
    getGoogleBookPopularity(
      b
    );

  if (
    bGoogle.ratingsCount !==
    aGoogle.ratingsCount
  ) {
    return (
      bGoogle.ratingsCount -
      aGoogle.ratingsCount
    );
  }

  const aHardcoverRating =
    aHardcover?.rating ??
    0;

  const bHardcoverRating =
    bHardcover?.rating ??
    0;

  if (
    bHardcoverRating !==
    aHardcoverRating
  ) {
    return (
      bHardcoverRating -
      aHardcoverRating
    );
  }

  if (
    bGoogle.averageRating !==
    aGoogle.averageRating
  ) {
    return (
      bGoogle.averageRating -
      aGoogle.averageRating
    );
  }

  return 0;
}

function getTitleSearchRelevance(
  book: GoogleBookSearchItem,
  normalizedQuery: string
) {
  const title =
    normalizeTitle(
      book.volumeInfo.title
    );

  if (
    !title ||
    !normalizedQuery
  ) {
    return 0;
  }

  if (
    title ===
    normalizedQuery
  ) {
    return 400;
  }

  if (
    title.startsWith(
      `${normalizedQuery} `
    )
  ) {
    return 300;
  }

  if (
    title.includes(
      normalizedQuery
    )
  ) {
    return 200;
  }

  const queryWords =
    normalizedQuery
      .split(' ')
      .filter(Boolean);

  if (
    queryWords.length > 0 &&
    queryWords.every(
      (word) =>
        title.includes(
          word
        )
    )
  ) {
    return 100;
  }

  return 0;
}

function getAuthorSearchRelevance(
  book: GoogleBookSearchItem,
  normalizedQuery: string
) {
  const authors =
    book.volumeInfo.authors ??
    [];

  let best =
    0;

  for (
    const author of authors
  ) {
    const normalizedAuthor =
      normalizeTitle(
        author
      );

    if (
      !normalizedAuthor
    ) {
      continue;
    }

    if (
      normalizedAuthor ===
      normalizedQuery
    ) {
      best =
        Math.max(
          best,
          400
        );
      continue;
    }

    if (
      normalizedAuthor.startsWith(
        `${normalizedQuery} `
      ) ||
      normalizedQuery.startsWith(
        `${normalizedAuthor} `
      )
    ) {
      best =
        Math.max(
          best,
          300
        );
      continue;
    }

    if (
      normalizedAuthor.includes(
        normalizedQuery
      ) ||
      normalizedQuery.includes(
        normalizedAuthor
      )
    ) {
      best =
        Math.max(
          best,
          200
        );
      continue;
    }

    const queryWords =
      normalizedQuery
        .split(' ')
        .filter(Boolean);

    if (
      queryWords.length > 0 &&
      queryWords.every(
        (word) =>
          normalizedAuthor.includes(
            word
          )
      )
    ) {
      best =
        Math.max(
          best,
          100
        );
    }
  }

  return best;
}

function sortTitleSearchResults(
  books:
    GoogleBookSearchItem[],
  searchTerm: string,
  hardcoverPopularity: Record<
    string,
    {
      usersCount: number;
      rating: number | null;
    }
  >
) {
  const normalizedQuery =
    normalizeTitle(
      searchTerm
    );

  return [
    ...books,
  ].sort(
    (
      a,
      b
    ) => {
      const relevanceDifference =
        getTitleSearchRelevance(
          b,
          normalizedQuery
        ) -
        getTitleSearchRelevance(
          a,
          normalizedQuery
        );

      if (
        relevanceDifference !==
        0
      ) {
        return relevanceDifference;
      }

      return compareBookPopularity(
        a,
        b,
        hardcoverPopularity
      );
    }
  );
}

function sortAuthorSearchResults(
  books:
    GoogleBookSearchItem[],
  searchTerm: string,
  hardcoverPopularity: Record<
    string,
    {
      usersCount: number;
      rating: number | null;
    }
  >
) {
  const normalizedQuery =
    normalizeTitle(
      searchTerm
    );

  return [
    ...books,
  ]
    .filter(
      (book) =>
        getAuthorSearchRelevance(
          book,
          normalizedQuery
        ) >
        0
    )
    .sort(
      (
        a,
        b
      ) => {
        const relevanceDifference =
          getAuthorSearchRelevance(
            b,
            normalizedQuery
          ) -
          getAuthorSearchRelevance(
            a,
            normalizedQuery
          );

        if (
          relevanceDifference !==
          0
        ) {
          return relevanceDifference;
        }

        return compareBookPopularity(
          a,
          b,
          hardcoverPopularity
        );
      }
    );
}

function getCanonicalWorkTitle(
  value?: string
) {
  if (
    !value
  ) {
    return '';
  }

  let raw =
    value
      .normalize('NFKD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .trim();

  // Remove bracketed/parenthetical edition and series labels.
  raw =
    raw.replace(
      /\s*[\[(][^\])]*(?:edition|collector|deluxe|special|exclusive|anniversary|movie tie|tv tie|paperback|hardcover|mass market|large print|book\s*\d+|volume\s*\d+|vol\.?\s*\d+|series|#\s*\d+|,\s*\d+)[^\])]*[\])]/gi,
      ''
    );

  // Strip common edition suffixes after a colon/dash while preserving
  // meaningful subtitles unless the suffix clearly looks like packaging.
  raw =
    raw.replace(
      /\s*[:\-–—]\s*(?:a novel|the novel|special edition|deluxe edition|collector'?s edition|collectors edition|anniversary edition|movie tie[- ]?in edition|tv tie[- ]?in edition|hardcover edition|paperback edition|mass market paperback|large print edition|.*(?:series|book\s*\d+|volume\s*\d+|vol\.?\s*\d+|#\s*\d+).*)$/i,
      ''
    );

  let title =
    normalizeTitle(
      raw
    );

  const removableSuffixes = [
    ' limited edition',
    ' deluxe edition',
    ' special edition',
    ' collectors edition',
    ' collector s edition',
    ' exclusive edition',
    ' anniversary edition',
    ' hardcover edition',
    ' paperback edition',
    ' international edition',
    ' movie tie in edition',
    ' tv tie in edition',
    ' mass market paperback',
    ' large print edition',
    ' uncut edition',
    ' illustrated edition',
    ' gift edition',
    ' ebook edition',
    ' kindle edition',
    ' trade paperback',
    ' a novel',
    ' a thriller',
    ' a memoir',
  ];

  let changed =
    true;

  while (
    changed
  ) {
    changed =
      false;

    for (
      const suffix of
        removableSuffixes
    ) {
      if (
        title.endsWith(
          suffix
        )
      ) {
        title =
          title
            .slice(
              0,
              -suffix.length
            )
            .trim();

        changed =
          true;
      }
    }
  }

  return title;
}

function getCanonicalWorkTitleForBook(
  book: GoogleBookSearchItem
) {
  let title =
    getCanonicalWorkTitle(
      book.volumeInfo.title
    );

  const primaryAuthor =
    normalizeTitle(
      book.volumeInfo.authors?.[0]
    );

  if (
    title &&
    primaryAuthor
  ) {
    const authorPrefix =
      `${primaryAuthor} s `;

    if (
      title.startsWith(
        authorPrefix
      )
    ) {
      title =
        title
          .slice(
            authorPrefix.length
          )
          .trim();
    }
  }

  return title;
}

function getLooseWorkTitle(
  book: GoogleBookSearchItem
) {
  let title =
    getCanonicalWorkTitleForBook(
      book
    );

  title =
    title.replace(
      /^(?:the|a|an)\s+/,
      ''
    );

  title =
    title.replace(
      /\s+(?:book|volume|vol)\s*(?:one|1)$/i,
      ''
    );

  title =
    title.replace(
      /\s+(?:series)\s*(?:book\s*)?(?:one|1)?$/i,
      ''
    );

  return title.trim();
}

function getAuthorIdentity(
  value?: string
) {
  const normalized =
    normalizeTitle(
      value
    )
      .replace(
        /\b(?:author|editor|illustrator|narrator)\b/g,
        ''
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();

  const tokens =
    normalized
      .split(
        ' '
      )
      .filter(Boolean);

  if (
    tokens.length <
    2
  ) {
    return normalized;
  }

  return [
    ...tokens,
  ]
    .sort()
    .join(' ');
}

function getGoogleBooksImageParamFromUrl(
  url?: string
) {
  if (
    !url
  ) {
    return null;
  }

  const match =
    url.match(
      /[?&]printsec=([^&]+)/i
    );

  return match?.[1]
    ? decodeURIComponent(
        match[1]
      ).toLowerCase()
    : null;
}

function isUsableCoverUrl(
  url?: string
) {
  if (
    !url
  ) {
    return false;
  }

  const printSec =
    getGoogleBooksImageParamFromUrl(
      url
    );

  return (
    !printSec ||
    printSec ===
      'frontcover'
  );
}

function getCoverQuality(
  book: GoogleBookSearchItem
) {
  const links =
    book.volumeInfo
      .imageLinks;

  const candidates = [
    {
      url:
        links?.extraLarge,
      score: 60,
    },
    {
      url:
        links?.large,
      score: 50,
    },
    {
      url:
        links?.medium,
      score: 40,
    },
    {
      url:
        links?.small,
      score: 30,
    },
    {
      url:
        links?.thumbnail,
      score: 20,
    },
    {
      url:
        links?.smallThumbnail,
      score: 10,
    },
  ].filter(
    (
      candidate
    ) =>
      isUsableCoverUrl(
        candidate.url
      )
  );

  const best =
    candidates[0];

  if (
    !best
  ) {
    return 0;
  }

  const printSec =
    getGoogleBooksImageParamFromUrl(
      best.url
    );

  return (
    best.score +
    (
      printSec ===
        'frontcover'
        ? 5
        : 0
    )
  );
}

function chooseBestCoverBook(
  group: GoogleBookSearchItem[]
) {
  return [
    ...group,
  ].sort(
    (
      a,
      b
    ) =>
      getCoverQuality(
        b
      ) -
      getCoverQuality(
        a
      )
  )[0];
}

function collapseDuplicateEditions(
  books:
    GoogleBookSearchItem[],
  searchTerm: string,
  hardcoverPopularity: Record<
    string,
    {
      usersCount: number;
      rating: number | null;
    }
  > = {}
) {
  const normalizedQuery =
    normalizeTitle(
      searchTerm
    );

  const englishResults =
    books.filter(
      (book) =>
        !book.volumeInfo.language ||
        book.volumeInfo.language ===
          'en'
    );

  const candidates =
    englishResults.length >
    0
      ? englishResults
      : books;

  const groups =
    new Map<
      string,
      GoogleBookSearchItem[]
    >();

  for (
    const book of
      candidates
  ) {
    const canonicalTitle =
      getLooseWorkTitle(
        book
      );

    const primaryAuthor =
      getAuthorIdentity(
        book.volumeInfo.authors?.[0]
      );

    if (
      !canonicalTitle
    ) {
      continue;
    }

    const identity =
      `${canonicalTitle}::${primaryAuthor}`;

    const existing =
      groups.get(
        identity
      ) ?? [];

    existing.push(
      book
    );

    groups.set(
      identity,
      existing
    );
  }

  const representativeBooks =
    Array.from(
      groups.values()
    ).map(
      (
        group
      ) => {
        const sorted =
          [...group].sort(
            (
              a,
              b
            ) => {
              const aHardcover =
                hardcoverPopularity[
                  a.id
                ];

              const bHardcover =
                hardcoverPopularity[
                  b.id
                ];

              const hardcoverUserDifference =
                (
                  bHardcover?.usersCount ??
                  0
                ) -
                (
                  aHardcover?.usersCount ??
                  0
                );

              if (
                hardcoverUserDifference !==
                0
              ) {
                return hardcoverUserDifference;
              }

              const aGoogle =
                getGoogleBookPopularity(
                  a
                );

              const bGoogle =
                getGoogleBookPopularity(
                  b
                );

              if (
                bGoogle.ratingsCount !==
                aGoogle.ratingsCount
              ) {
                return (
                  bGoogle.ratingsCount -
                  aGoogle.ratingsCount
                );
              }

              const aExact =
                normalizeTitle(
                  a.volumeInfo.title
                ) ===
                normalizedQuery
                  ? 1
                  : 0;

              const bExact =
                normalizeTitle(
                  b.volumeInfo.title
                ) ===
                normalizedQuery
                  ? 1
                  : 0;

              if (
                bExact !==
                aExact
              ) {
                return (
                  bExact -
                  aExact
                );
              }

              const aHasCover =
                a.volumeInfo.imageLinks
                  ?.thumbnail
                  ? 1
                  : 0;

              const bHasCover =
                b.volumeInfo.imageLinks
                  ?.thumbnail
                  ? 1
                  : 0;

              return (
                bHasCover -
                aHasCover
              );
            }
          );

        const representative =
          sorted[0];

        const bestCoverBook =
          chooseBestCoverBook(
            group
          );

        const bestImageLinks =
          bestCoverBook
            ?.volumeInfo
            .imageLinks;

        if (
          bestImageLinks &&
          getCoverQuality(
            bestCoverBook
          ) >
            0
        ) {
          for (
            const sibling of
              group
          ) {
            sibling.volumeInfo =
              {
                ...sibling.volumeInfo,
                imageLinks:
                  bestImageLinks,
              };
          }
        }

        const canonicalTitle =
          getLooseWorkTitle(
            representative
          );

        const primaryAuthor =
          getAuthorIdentity(
            representative.volumeInfo
              .authors?.[0]
          );

        const isbns =
          Array.from(
            new Set(
              group.flatMap(
                (
                  book
                ) =>
                  getBookIsbns(
                    book
                  )
              )
            )
          );

        const workMetadata = {
          key:
            `${canonicalTitle}::${primaryAuthor}`,
          canonicalTitle,
          primaryAuthor,
          googleBookIds:
            group.map(
              (
                book
              ) =>
                book.id
            ),
          isbns,
        };

        for (
          const sibling of
            group
        ) {
          sibling.novoriWork =
            workMetadata;
        }

        return representative;
      }
    );

  return representativeBooks;
}

async function attachCanonicalHardcoverRatings(
  books: GoogleBookSearchItem[]
) {
  if (
    books.length ===
    0
  ) {
    return books;
  }

  const popularity =
    await getHardcoverPopularity(
      books,
      true
    );

  return books.map(
    (
      book
    ) => {
      const resolved =
        popularity[
          book.id
        ];

      if (
        book.novoriWork
      ) {
        book.novoriWork = {
          ...book.novoriWork,
          hardcoverRating:
            resolved?.rating ??
            null,
          hardcoverRatingsCount:
            resolved?.ratingsCount ??
            null,
        };
      }

      return book;
    }
  );
}

function mergeGoogleBookResults(
  ...groups:
    GoogleBookSearchItem[][]
) {
  const byId =
    new Map<
      string,
      GoogleBookSearchItem
    >();

  for (
    const group of groups
  ) {
    for (
      const book of group
    ) {
      if (
        !byId.has(
          book.id
        )
      ) {
        byId.set(
          book.id,
          book
        );
      }
    }
  }

  return Array.from(
    byId.values()
  );
}

function secureGoogleBooksImageUrl(
  url?: string
) {
  return url?.replace(
    'http://',
    'https://'
  );
}

function getGoogleBooksImageParam(
  url: string,
  key: string
) {
  const match =
    url.match(
      new RegExp(
        `[?&]${key}=([^&]+)`,
        'i'
      )
    );

  return match?.[1]
    ? decodeURIComponent(
        match[1]
      )
    : null;
}

function isSameGoogleBooksCover(
  referenceUrl: string,
  candidateUrl: string
) {
  const reference =
    secureGoogleBooksImageUrl(
      referenceUrl
    );

  const candidate =
    secureGoogleBooksImageUrl(
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

export function shouldFrameBookCover(
  url?: string | null
) {
  if (
    !url
  ) {
    return false;
  }

  try {
    const parsed =
      new URL(
        url
      );

    if (
      !parsed.hostname.includes(
        'google'
      )
    ) {
      return false;
    }

    const zoom =
      Number(
        parsed.searchParams.get(
          'zoom'
        ) ??
        ''
      );

    return (
      Number.isFinite(
        zoom
      ) &&
      zoom > 0 &&
      zoom <= 1
    );
  } catch {
    return false;
  }
}

export function getBestSearchCover(
  imageLinks:
    | GoogleBookSearchItem[
        'volumeInfo'
      ]['imageLinks']
    | undefined
) {
  const thumbnail =
    secureGoogleBooksImageUrl(
      imageLinks?.thumbnail
    ) ||
    secureGoogleBooksImageUrl(
      imageLinks?.smallThumbnail
    );

  if (
    !thumbnail
  ) {
    return undefined;
  }

  const higherResolutionCandidates = [
    imageLinks?.extraLarge,
    imageLinks?.large,
    imageLinks?.medium,
    imageLinks?.small,
  ]
    .map(
      secureGoogleBooksImageUrl
    )
    .filter(
      (
        candidate
      ): candidate is string =>
        Boolean(
          candidate
        )
    );

  const matchingCandidate =
    higherResolutionCandidates.find(
      (
        candidate
      ) =>
        isSameGoogleBooksCover(
          thumbnail,
          candidate
        )
    );

  return (
    matchingCandidate ||
    thumbnail
  );
}

export async function searchNovoriBooks(
  searchTerm: string
) {
  const encodedQuery =
    encodeURIComponent(
      searchTerm
    );

  const response =
    await fetchGoogleBooksJson<
      GoogleBooksResponse
    >(
      `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=40&printType=books&projection=full`
    );

  if (
    !response.ok ||
    !response.data
  ) {
    throw new Error(
      `Google Books request failed: ${response.status}`
    );
  }

  const initialResults =
    response.data.items ??
    [];

  if (
    initialResults.length ===
    0
  ) {
    return [];
  }

  const normalizedQuery =
    normalizeTitle(
      searchTerm
    );

  const strongestTitleMatch =
    Math.max(
      0,
      ...initialResults.map(
        (
          book
        ) =>
          getTitleSearchRelevance(
            book,
            normalizedQuery
          )
      )
    );

  const strongestAuthorMatch =
    Math.max(
      0,
      ...initialResults.map(
        (
          book
        ) =>
          getAuthorSearchRelevance(
            book,
            normalizedQuery
          )
      )
    );

  const looksLikeAuthorSearch =
    strongestAuthorMatch >
    strongestTitleMatch;

  const sorted =
    looksLikeAuthorSearch
      ? sortAuthorSearchResults(
          initialResults,
          searchTerm,
          {}
        )
      : sortTitleSearchResults(
          initialResults,
          searchTerm,
          {}
        );

  return collapseDuplicateEditions(
    sorted,
    searchTerm,
    {}
  );
}

export type AuthorBookResult = {
  book: GoogleBookSearchItem;
  usersCount: number;
  ratingsCount: number;
  reviewsCount: number;
  rating: number | null;
};

export async function searchAuthorBooks(
  authorName: string,
  options?: {
    excludeGoogleBookId?: string | null;
    excludeTitle?: string | null;
    onProgress?: (
      results:
        AuthorBookResult[]
    ) => void;
  }
): Promise<AuthorBookResult[]> {
  const cleanAuthor =
    authorName.trim();

  if (!cleanAuthor) {
    return [];
  }

  const query =
    encodeURIComponent(
      `inauthor:"${cleanAuthor}"`
    );

  const pageIndexes =
    [0];

  const responses =
    await Promise.all(
      pageIndexes.map(
        async (
          startIndex
        ) => {
          const response =
            await fetchGoogleBooksJson<
              GoogleBooksResponse
            >(
              `https://www.googleapis.com/books/v1/volumes?q=${query}&startIndex=${startIndex}&maxResults=40&printType=books&projection=full`
            );

          if (
            !response.ok ||
            !response.data
          ) {
            return [] as GoogleBookSearchItem[];
          }

          return (
            response.data.items ??
            []
          );
        }
      )
    );

  const merged =
    mergeGoogleBookResults(
      ...responses
    );

  const normalizedAuthor =
    normalizeTitle(
      cleanAuthor
    );

  const exactAuthorBooks =
    merged.filter(
      (
        book
      ) =>
        (
          book.volumeInfo
            .authors ??
          []
        ).some(
          (
            author
          ) =>
            normalizeTitle(
              author
            ) ===
            normalizedAuthor
        )
    );

  const candidates =
    exactAuthorBooks.length >
    0
      ? exactAuthorBooks
      : merged.filter(
          (
            book
          ) =>
            getAuthorSearchRelevance(
              book,
              normalizedAuthor
            ) >
            0
        );

  const popularity:
    Record<
      string,
      {
        usersCount: number;
        rating: number | null;
      }
    > =
    {};

  const collapsed =
    collapseDuplicateEditions(
      sortAuthorSearchResults(
        candidates,
        cleanAuthor,
        popularity
      ),
      cleanAuthor,
      popularity
    );

  const excludedWorkTitle =
    getCanonicalWorkTitle(
      options?.excludeTitle ??
      undefined
    );

  const filtered =
    collapsed.filter(
      (
        book
      ) => {
        if (
          options?.excludeGoogleBookId &&
          (
            book.id ===
              options.excludeGoogleBookId ||
            book.novoriWork?.googleBookIds.includes(
              options.excludeGoogleBookId
            )
          )
        ) {
          return false;
        }

        if (
          excludedWorkTitle &&
          getCanonicalWorkTitleForBook(
            book
          ) ===
            excludedWorkTitle
        ) {
          return false;
        }

        return true;
      }
    );

  const fastPopularity =
    await getHardcoverPopularity(
      filtered,
      false
    );

  const initialBooks:
    AuthorBookResult[] =
    filtered.map(
      (
        book
      ) => {
        const fastResolved =
          fastPopularity[
            book.id
          ];

        return {
          book,
          usersCount:
            fastResolved
              ?.usersCount ??
            0,
          ratingsCount:
            fastResolved
              ?.ratingsCount ??
            book.novoriWork
              ?.hardcoverRatingsCount ??
            book.volumeInfo
              .ratingsCount ??
            0,
          reviewsCount:
            fastResolved
              ?.reviewsCount ??
            0,
          rating:
            fastResolved
              ?.rating ??
            book.novoriWork
              ?.hardcoverRating ??
            book.volumeInfo
              .averageRating ??
            null,
        };
      }
    );

  options?.onProgress?.(
    initialBooks
  );

  const resolvedBooks =
    initialBooks;

  return resolvedBooks
    .sort(
      (
        a,
        b
      ) => {
        if (
          b.ratingsCount !==
          a.ratingsCount
        ) {
          return (
            b.ratingsCount -
            a.ratingsCount
          );
        }

        if (
          b.reviewsCount !==
          a.reviewsCount
        ) {
          return (
            b.reviewsCount -
            a.reviewsCount
          );
        }

        if (
          b.usersCount !==
          a.usersCount
        ) {
          return (
            b.usersCount -
            a.usersCount
          );
        }

        const ratingDifference =
          (
            b.rating ??
            0
          ) -
          (
            a.rating ??
            0
          );

        if (
          ratingDifference !==
          0
        ) {
          return ratingDifference;
        }

        const bYear =
          Number(
            (
              b.book.volumeInfo
                .publishedDate ??
              ''
            ).slice(
              0,
              4
            )
          ) ||
          0;

        const aYear =
          Number(
            (
              a.book.volumeInfo
                .publishedDate ??
              ''
            ).slice(
              0,
              4
            )
          ) ||
          0;

        return (
          bYear -
          aYear
        );
      }
    );
}


export type ResolvedGoogleBookRating = {
  averageRating: number;
  ratingsCount: number;
  volumeId: string;
};

function titlesRepresentSameWork(
  a?: string | null,
  b?: string | null
) {
  const left =
    getCanonicalWorkTitle(
      a ?? undefined
    );

  const right =
    getCanonicalWorkTitle(
      b ?? undefined
    );

  if (
    !left ||
    !right
  ) {
    return false;
  }

  return (
    left ===
      right ||
    left.startsWith(
      `${right} `
    ) ||
    right.startsWith(
      `${left} `
    )
  );
}

function authorsRepresentSameWork(
  expectedAuthors:
    string[],
  candidateAuthors:
    string[]
) {
  if (
    expectedAuthors.length ===
      0 ||
    candidateAuthors.length ===
      0
  ) {
    return true;
  }

  const expected =
    expectedAuthors
      .map(
        normalizeTitle
      )
      .filter(Boolean);

  const candidate =
    candidateAuthors
      .map(
        normalizeTitle
      )
      .filter(Boolean);

  return expected.some(
    (
      expectedAuthor
    ) =>
      candidate.some(
        (
          candidateAuthor
        ) =>
          candidateAuthor ===
            expectedAuthor ||
          candidateAuthor.includes(
            expectedAuthor
          ) ||
          expectedAuthor.includes(
            candidateAuthor
          )
      )
  );
}

export async function resolveGoogleBookRating(input: {
  googleBookId?: string | null;
  title: string;
  authors?: string[];
}): Promise<
  ResolvedGoogleBookRating | null
> {
  const cleanTitle =
    input.title.trim();

  if (
    !cleanTitle
  ) {
    return null;
  }

  const expectedAuthors =
    input.authors ??
    [];

  const requests:
    Promise<
      GoogleBookSearchItem[]
    >[] = [];

  if (
    input.googleBookId
  ) {
    requests.push(
      fetchGoogleBooksJson<
        GoogleBookSearchItem
      >(
        `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(
          input.googleBookId
        )}`
      )
        .then(
          (
            response
          ) => {
            if (
              !response.ok ||
              !response.data
            ) {
              return [];
            }

            return [
              response.data,
            ];
          }
        )
        .catch(
          () => []
        )
    );
  }

  const primaryAuthor =
    expectedAuthors[0]
      ?.trim() ??
    '';

  const query =
    primaryAuthor
      ? `intitle:"${cleanTitle}" inauthor:"${primaryAuthor}"`
      : `intitle:"${cleanTitle}"`;

  requests.push(
    fetchGoogleBooksJson<
      GoogleBooksResponse
    >(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
        query
      )}&maxResults=40&printType=books&projection=full`
    )
      .then(
        (
          response
        ) => {
          if (
            !response.ok ||
            !response.data
          ) {
            return [];
          }

          return (
            response.data.items ??
            []
          );
        }
      )
      .catch(
        () => []
      )
  );

  const groups =
    await Promise.all(
      requests
    );

  const candidates =
    mergeGoogleBookResults(
      ...groups
    )
      .filter(
        (
          book
        ) =>
          titlesRepresentSameWork(
            cleanTitle,
            book.volumeInfo
              .title
          ) &&
          authorsRepresentSameWork(
            expectedAuthors,
            book.volumeInfo
              .authors ??
              []
          )
      )
      .filter(
        (
          book
        ) => {
          const rating =
            Number(
              book.volumeInfo
                .averageRating
            );

          const count =
            Number(
              book.volumeInfo
                .ratingsCount
            );

          return (
            Number.isFinite(
              rating
            ) &&
            rating >
              0 &&
            Number.isFinite(
              count
            ) &&
            count >
              0
          );
        }
      )
      .sort(
        (
          a,
          b
        ) =>
          (
            b.volumeInfo
              .ratingsCount ??
            0
          ) -
          (
            a.volumeInfo
              .ratingsCount ??
            0
          )
      );

  const best =
    candidates[0];

  if (
    !best
  ) {
    return null;
  }

  return {
    averageRating:
      Number(
        best.volumeInfo
          .averageRating
      ),
    ratingsCount:
      Number(
        best.volumeInfo
          .ratingsCount
      ),
    volumeId:
      best.id,
  };
}


type HardcoverDiscoveryBook = {
  title: string;
  rating: number | null;
  usersCount: number | null;
  authors: string[];
};

type HardcoverDiscoveryResponse = {
  books?: HardcoverDiscoveryBook[];
  error?: string;
};

async function findHardcoverDiscoveryMatch(
  title: string,
  authors: string[]
): Promise<ResolvedHardcoverRating | null> {
  const functionNames = [
    'hardcover-trending',
    'hardcover-recent-releases',
  ];

  for (
    const functionName of
    functionNames
  ) {
    try {
      const {
        data,
        error,
      } =
        await supabase.functions.invoke(
          functionName,
          {
            body:
              functionName ===
              'hardcover-trending'
                ? {
                    days: 90,
                    poolSize: 150,
                  }
                : {
                    months: 24,
                    poolSize: 200,
                  },
          }
        );

      if (
        error
      ) {
        continue;
      }

      const response =
        data as
          HardcoverDiscoveryResponse;

      const match =
        (
          response?.books ??
          []
        ).find(
          (
            book
          ) =>
            titlesRepresentSameWork(
              title,
              book.title
            ) &&
            authorsRepresentSameWork(
              authors,
              book.authors ??
              []
            ) &&
            book.rating !==
              null &&
            Number.isFinite(
              book.rating
            ) &&
            book.rating >
              0
        );

      if (
        match &&
        match.rating !==
          null
      ) {
        return {
          rating:
            Number(
              match.rating
            ),
          ratingsCount:
            null,
          reviewsCount:
            null,
          usersCount:
            null,
          googleBookId:
            '',
        };
      }
    } catch {
      // Try the next existing Hardcover discovery source.
    }
  }

  return null;
}

export type ResolvedHardcoverRating = {
  rating: number;
  ratingsCount: number | null;
  reviewsCount: number | null;
  usersCount: number | null;
  googleBookId: string;
};

export async function resolveHardcoverRating(input: {
  googleBookId?: string | null;
  title: string;
  authors?: string[];
  isbns?: string[];
  allowGoogleLookup?: boolean;
}): Promise<
  ResolvedHardcoverRating | null
> {
  const allowGoogleLookup =
    input.allowGoogleLookup !==
    false;

  const cleanTitle =
    input.title.trim();

  if (
    !cleanTitle
  ) {
    return null;
  }

  const expectedAuthors =
    input.authors ??
    [];

  const providedIsbns =
    Array.from(
      new Set(
        (
          input.isbns ??
          []
        )
          .map(
            (
              isbn
            ) =>
              isbn
                .replace(
                  /[^0-9Xx]/g,
                  ''
                )
                .toUpperCase()
          )
          .filter(
            Boolean
          )
      )
    );

  const groups:
    GoogleBookSearchItem[][] =
    [];

  if (
    providedIsbns.length ===
      0 &&
    allowGoogleLookup &&
    input.googleBookId
  ) {
    try {
      const response =
        await fetchGoogleBooksJson<
          GoogleBookSearchItem
        >(
          `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(
            input.googleBookId
          )}`
        );

      if (
        response.ok &&
        response.data
      ) {
        groups.push([
          response.data,
        ]);
      }
    } catch {
      // Fall through to the work-level search.
    }
  }

  if (
    providedIsbns.length ===
      0 &&
    allowGoogleLookup
  ) {
    const primaryAuthor =
      expectedAuthors[0]
        ?.trim() ??
      '';

    const query =
      primaryAuthor
        ? `intitle:"${cleanTitle}" inauthor:"${primaryAuthor}"`
        : `intitle:"${cleanTitle}"`;

    try {
      const response =
        await fetchGoogleBooksJson<
          GoogleBooksResponse
        >(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
            query
          )}&maxResults=40&printType=books&projection=full`
        );

      if (
        response.ok &&
        response.data
      ) {
        groups.push(
          response.data.items ??
          []
        );
      }
    } catch {
      // Use any exact-volume data already collected.
    }
  }

  const matchingBooks =
    mergeGoogleBookResults(
      ...groups
    )
      .filter(
        (
          book
        ) =>
          titlesRepresentSameWork(
            cleanTitle,
            book.volumeInfo
              .title
          ) &&
          authorsRepresentSameWork(
            expectedAuthors,
            book.volumeInfo
              .authors ??
              []
          )
      );

  const allIsbns =
    Array.from(
      new Set([
        ...providedIsbns,
        ...matchingBooks.flatMap(
          (
            book
          ) =>
            getBookIsbns(
              book
            )
        ),
      ])
    );

  const requestKey =
    input.googleBookId ??
    matchingBooks[0]?.id ??
    `${getCanonicalWorkTitle(
      cleanTitle
    )}::${normalizeTitle(
      expectedAuthors[0]
    )}`;

  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      'hardcover-search-popularity',
      {
        body: {
          allowTitleFallback:
            true,
          books: [
            {
              googleBookId:
                requestKey,
              title:
                cleanTitle,
              authors:
                expectedAuthors,
              isbns:
                allIsbns,
            },
          ],
        },
      }
    );

  if (
    error
  ) {
    return null;
  }

  const response =
    data as
      HardcoverSearchPopularityResponse;

  const resolved =
    response?.popularity?.[
      requestKey
    ];

  if (
    !resolved ||
    resolved.rating ===
      null ||
    !Number.isFinite(
      resolved.rating
    ) ||
    resolved.rating <=
      0
  ) {
    return null;
  }

  return {
    rating:
      resolved.rating,
    ratingsCount:
      resolved.ratingsCount ??
      null,
    reviewsCount:
      resolved.reviewsCount ??
      null,
    usersCount:
      resolved.usersCount ??
      null,
    googleBookId:
      requestKey,
  };
}
