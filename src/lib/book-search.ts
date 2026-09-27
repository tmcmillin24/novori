import { supabase } from './supabase';

export type GoogleBookSearchItem = {
  id: string;
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
  books: GoogleBookSearchItem[]
) {
  const booksWithIsbns =
    books
      .map((book) => ({
        googleBookId:
          book.id,
        isbns:
          getBookIsbns(
            book
          ),
      }))
      .filter(
        (book) =>
          book.isbns.length >
          0
      )
      .slice(0, 40);

  if (
    booksWithIsbns.length ===
    0
  ) {
    return {};
  }

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
              booksWithIsbns,
          },
        }
      );

    if (functionError) {
      return {};
    }

    const response =
      data as
        HardcoverSearchPopularityResponse;

    if (response?.error) {
      return {};
    }

    return (
      response?.popularity ??
      {}
    );
  } catch {
    return {};
  }
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
  let title =
    normalizeTitle(
      value
    );

  const editionMarkers = [
    'limited edition',
    'deluxe edition',
    'special edition',
    'collectors edition',
    'collector s edition',
    'exclusive edition',
    'anniversary edition',
    'hardcover edition',
    'paperback edition',
    'international edition',
    'movie tie in edition',
  ];

  for (
    const marker of
      editionMarkers
  ) {
    const markerIndex =
      title.indexOf(
        ` ${marker}`
      );

    if (
      markerIndex >
      0
    ) {
      title =
        title.slice(
          0,
          markerIndex
        );
    }
  }

  return title.trim();
}

function collapseDuplicateEditions(
  books:
    GoogleBookSearchItem[],
  searchTerm: string
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

  const exactTitleExists =
    candidates.some(
      (book) =>
        normalizeTitle(
          book.volumeInfo.title
        ) ===
        normalizedQuery
    );

  const seen =
    new Set<string>();

  return candidates.filter(
    (book) => {
      const title =
        normalizeTitle(
          book.volumeInfo.title
        );

      const canonicalTitle =
        getCanonicalWorkTitle(
          book.volumeInfo.title
        );

      const primaryAuthor =
        normalizeTitle(
          book.volumeInfo.authors?.[0]
        );

      if (
        exactTitleExists &&
        title !==
          normalizedQuery &&
        canonicalTitle ===
          normalizedQuery
      ) {
        return false;
      }

      const identity =
        `${canonicalTitle}::${primaryAuthor}`;

      if (
        !canonicalTitle ||
        seen.has(
          identity
        )
      ) {
        return false;
      }

      seen.add(
        identity
      );

      return true;
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
  const apiKey =
    process.env
      .EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;

  if (
    !apiKey
  ) {
    throw new Error(
      'Google Books API key is missing from the .env file.'
    );
  }

  const encodedQuery =
    encodeURIComponent(
      searchTerm
    );

  const response =
    await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=40&printType=books&projection=full&key=${apiKey}`
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `Google Books request failed: ${response.status}`
    );
  }

  const data:
    GoogleBooksResponse =
    await response.json();

  const initialResults =
    data.items ??
    [];

  const normalizedQuery =
    normalizeTitle(
      searchTerm
    );

  const authorMatches =
    initialResults.filter(
      (book) =>
        getAuthorSearchRelevance(
          book,
          normalizedQuery
        ) >=
        200
    );

  const exactAuthorMatch =
    initialResults.some(
      (book) =>
        getAuthorSearchRelevance(
          book,
          normalizedQuery
        ) >=
        400
    );

  const strongTitleMatch =
    initialResults.some(
      (book) =>
        getTitleSearchRelevance(
          book,
          normalizedQuery
        ) >=
        300
    );

  const looksLikeAuthorSearch =
    exactAuthorMatch ||
    (
      authorMatches.length >=
        2 &&
      !strongTitleMatch
    );

  if (
    looksLikeAuthorSearch
  ) {
    const authorResponse =
      await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
          `inauthor:"${searchTerm}"`
        )}&maxResults=40&printType=books&projection=full&key=${apiKey}`
      );

    let authorSpecificResults:
      GoogleBookSearchItem[] =
      [];

    if (
      authorResponse.ok
    ) {
      const authorData:
        GoogleBooksResponse =
        await authorResponse.json();

      authorSpecificResults =
        authorData.items ??
        [];
    }

    const merged =
      mergeGoogleBookResults(
        authorSpecificResults,
        initialResults
      );

    const hardcoverPopularity =
      await getHardcoverPopularity(
        merged
      );

    return collapseDuplicateEditions(
      sortAuthorSearchResults(
        merged,
        searchTerm,
        hardcoverPopularity
      ),
      searchTerm
    );
  }

  const hardcoverPopularity =
    await getHardcoverPopularity(
      initialResults
    );

  return collapseDuplicateEditions(
    sortTitleSearchResults(
      initialResults,
      searchTerm,
      hardcoverPopularity
    ),
    searchTerm
  );
}
