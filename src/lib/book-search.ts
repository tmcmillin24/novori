import { bookWorkDetails } from './book-work-details';
import { createBookReadCache } from './book-read-cache';
import { rememberBookPublications } from './book-publication';
import { normalizeIsbnDbEdition, cleanCatalogBookTitle, displayBookTitle, audioEditionPenalty, validPublicationDate, isCatalogCollection, isCatalogSupplement } from '../../supabase/functions/_shared/book-edition-metadata';
import { getCanonicalBookCover, getCanonicalBookCoverRevision, publishCatalogCovers, resolveCanonicalBookCover } from './canonical-book-covers';
import { supabase } from './supabase';
import { fetchGoogleBooksJson } from './google-books';
import {
  getBookCoverPlan,
} from './book-covers';

export type GoogleBookSearchItem = {
  novoriDetails?: { bookId: string; isbns: string[] };
  novoriPublication?: { title: string; authors?: string[]; releaseDate?: string | null };
  id: string;
  source?: { provider?: string };
  novoriEdition?: { binding?: string; format?: string; originalTitle?: string };
  novoriWork?: {
    key: string;
    canonicalTitle: string;
    primaryAuthor: string;
    googleBookIds: string[];
    isbns: string[];
    hardcoverRating?: number | null;
    hardcoverRatingsCount?: number | null;
    canonicalCoverUrl?: string | null;
  };
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    publisher?: string;
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
  saleInfo?: {
    country?: string;
  };
};

type GoogleBooksResponse = {
  totalItems?: number;
  items?: GoogleBookSearchItem[];
};

export function getNovoriSearchBookIsbn(
  book: GoogleBookSearchItem
) {
  const identifiers =
    book.volumeInfo
      .industryIdentifiers ??
    [];

  return (
    identifiers.find(
      (
        identifier
      ) =>
        identifier.type ===
        'ISBN_13'
    )?.identifier ??
    identifiers.find(
      (
        identifier
      ) =>
        identifier.type ===
        'ISBN_10'
    )?.identifier ??
    book.novoriWork
      ?.isbns?.[0] ??
    null
  );
}

export function getNovoriSearchBookCover(
  book: GoogleBookSearchItem
) {
  const canonicalCover =
    getCanonicalBookCover({ googleBookId: book.id }) ??
    book.novoriWork
      ?.canonicalCoverUrl ??
    null;

  const plan =
    getBookCoverPlan({
      imageLinks:
        book.volumeInfo
          .imageLinks,
      isbn:
        getNovoriSearchBookIsbn(
          book
        ),
      existingCoverUrl:
        canonicalCover,
    });

  return (
    canonicalCover ??
    plan.primaryUrl ??
    plan.fallbackUrl ??
    null
  );
}

export async function resolveNovoriSearchBookCover(
  book: GoogleBookSearchItem
) {
  const canonicalCover =
    book.novoriWork
      ?.canonicalCoverUrl ??
    null;

  return (
    await resolveCanonicalBookCover({
      googleBookId: book.id,
      imageLinks:
        book.volumeInfo
          .imageLinks,
      isbn:
        getNovoriSearchBookIsbn(
          book
        ),
      existingCoverUrl:
        canonicalCover,
    })
  ) ??
    getNovoriSearchBookCover(
      book
    );
}

async function fetchSharedGoogleBooksSearch(
  searchTerm: string, startIndex = 0
) {
  return fetchGoogleBooksJson<
    GoogleBooksResponse
  >(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
      searchTerm
    )}&startIndex=${startIndex}&maxResults=40&printType=books&projection=full`
  );
}

async function attachCatalogSearchCovers(
  books: GoogleBookSearchItem[]
) {
  if (
    books.length ===
    0
  ) {
    return;
  }

  try {
    const volumeIds =
      books.map(
        (
          book
        ) =>
          book.id
      );

    const readRevision = getCanonicalBookCoverRevision();
    const {
      data,
      error,
    } =
      await supabase.functions.invoke(
        'book-cover-selection',
        {
          body: {
            volumeIds,
          },
        }
      );

    if (error) {
      console.warn(
        'Could not load catalog search covers:',
        error
      );
      return;
    }

    const response =
      data as
        | {
            ok?: boolean;
            data?: {
              covers?: Record<
                string,
                | string
                | null
              >;
            };
          }
        | null;

    if (
      response?.ok !==
      true
    ) {
      return;
    }

    const covers = response.data?.covers ?? {};
    const publications = (data as any)?.data?.publications ?? {};
    rememberBookPublications(Object.values(publications));
    for (const book of books) {
      if (publications[book.id]) book.novoriPublication = publications[book.id];
    }
    publishCatalogCovers(covers, (data as any)?.data?.details ?? {}, readRevision);

    for (
      const book of
        books
    ) {
      const selectedCover = getCanonicalBookCover({ googleBookId: book.id });

      if (
        !selectedCover ||
        !book.novoriWork
      ) {
        continue;
      }

      book.novoriWork = {
        ...book.novoriWork,
        canonicalCoverUrl:
          selectedCover,
      };
    }
  } catch (
    error
  ) {
    console.warn(
      'Could not load catalog search covers:',
      error
    );
  }
}

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
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getTrigramSimilarity(
  left: string,
  right: string
) {
  if (
    !left ||
    !right
  ) {
    return 0;
  }

  if (
    left === right
  ) {
    return 1;
  }

  const makeTrigrams = (
    value: string
  ) => {
    const padded =
      `  ${value} `;

    const trigrams:
      string[] = [];

    for (
      let index = 0;
      index <=
      padded.length -
        3;
      index += 1
    ) {
      trigrams.push(
        padded.slice(
          index,
          index + 3
        )
      );
    }

    return trigrams;
  };

  const leftTrigrams =
    makeTrigrams(
      left
    );
  const rightTrigrams =
    makeTrigrams(
      right
    );

  const rightCounts =
    new Map<
      string,
      number
    >();

  for (
    const trigram of
      rightTrigrams
  ) {
    rightCounts.set(
      trigram,
      (
        rightCounts.get(
          trigram
        ) ??
        0
      ) + 1
    );
  }

  let overlap =
    0;

  for (
    const trigram of
      leftTrigrams
  ) {
    const count =
      rightCounts.get(
        trigram
      ) ??
      0;

    if (
      count <=
      0
    ) {
      continue;
    }

    overlap += 1;
    rightCounts.set(
      trigram,
      count - 1
    );
  }

  return (
    2 *
    overlap
  ) /
    (
      leftTrigrams.length +
      rightTrigrams.length
    );
}

function getFuzzyTextSimilarity(
  query: string,
  candidate: string
) {
  if (
    !query ||
    !candidate
  ) {
    return 0;
  }

  const trigram =
    getTrigramSimilarity(
      query,
      candidate
    );

  const queryWords =
    query
      .split(' ')
      .filter(Boolean);

  const candidateWords =
    candidate
      .split(' ')
      .filter(Boolean);

  if (
    queryWords.length ===
      0 ||
    candidateWords.length ===
      0
  ) {
    return trigram;
  }

  let matchedWords =
    0;

  for (
    const queryWord of
      queryWords
  ) {
    const bestWordMatch =
      Math.max(
        0,
        ...candidateWords.map(
          (
            candidateWord
          ) =>
            getTrigramSimilarity(
              queryWord,
              candidateWord
            )
        )
      );

    if (
      bestWordMatch >=
      0.72
    ) {
      matchedWords +=
        1;
    }
  }

  const wordCoverage =
    matchedWords /
    queryWords.length;

  return Math.max(
    trigram,
    wordCoverage *
      0.92
  );
}

const DERIVATIVE_TITLE_PREFIXES = [
  'summary of ',
  'summary for ',
  'summary ',
  'book summary ',
  'workbook for ',
  'workbook ',
  'study guide for ',
  'study guide ',
  'analysis of ',
  'analysis for ',
  'review and analysis of ',
  'review and analysis ',
  'key takeaways from ',
  'key takeaways ',
  'companion to ',
  'unofficial guide to ',
  'unofficial summary ',
  'journal for ',
  'guided journal for ',
  'companion journal for ',
  'planner for ',
  'coloring book for ',
  'official coloring book for ',
  'activity book for ',
  'puzzle book for ',
];

function stripLeadingTitleArticle(
  value: string
) {
  return value.replace(
    /^(?:the|a|an)\s+/,
    ''
  );
}

function hasDerivativeSearchIntent(
  normalizedQuery: string
) {
  const queryWithoutArticle =
    stripLeadingTitleArticle(
      normalizedQuery
    );

  return (
    DERIVATIVE_TITLE_PREFIXES.some(
      (
        prefix
      ) =>
        queryWithoutArticle.startsWith(
          prefix.trim()
        )
    ) ||
    /\b(?:colou?ring book|activity book|puzzle book|workbook|study guide|book summary|companion journal|guided journal|planner|calendar|dramatized adaptation|dramatised adaptation)\b/.test(
      normalizedQuery
    )
  );
}

function isLikelyDerivativeTitle(
  book: GoogleBookSearchItem
) {
  if (isCatalogSupplement(book)) return true;
  const title =
    normalizeTitle(
      book.volumeInfo.title
    );

  const titleWithoutArticle =
    stripLeadingTitleArticle(
      title
    );

  if (
    DERIVATIVE_TITLE_PREFIXES.some(
      (
        prefix
      ) =>
        titleWithoutArticle.startsWith(
          prefix
        )
    )
  ) {
    return true;
  }

  const derivativeSuffixes = [
    ' summary',
    ' workbook',
    ' study guide',
    ' journal',
    ' guided journal',
    ' companion journal',
    ' companion',
    ' planner',
    ' key takeaways',
    ' review and analysis',
    ' coloring book',
    ' official coloring book',
    ' activity book',
    ' puzzle book',
  ];

  if (
    derivativeSuffixes.some(
      (
        suffix
      ) =>
        title.endsWith(
          suffix
        )
    )
  ) {
    return true;
  }

  const categories =
    (
      book.volumeInfo
        .categories ??
      []
    )
      .map(
        normalizeTitle
      )
      .join(' ');

  return (
    categories.includes(
      'study aids book notes'
    ) ||
    categories.includes(
      'study aids'
    ) &&
    (
      title.includes(
        'summary'
      ) ||
      title.includes(
        'workbook'
      ) ||
      title.includes(
        'study guide'
      ) ||
      title.includes(
        'journal'
      )
    )
  );
}

function isLikelyExactTitleExpansionNoise(
  book: GoogleBookSearchItem,
  normalizedQuery: string
) {
  const title =
    normalizeTitle(
      book.volumeInfo.title
    );

  const canonicalTitle =
    getCanonicalWorkTitleForBook(
      book
    );

  const candidates =
    Array.from(
      new Set([
        title,
        canonicalTitle,
      ])
    ).filter(Boolean);

  for (
    const candidateTitle of
      candidates
  ) {
    if (
      candidateTitle ===
        normalizedQuery ||
      !candidateTitle.startsWith(
        `${normalizedQuery} `
      )
    ) {
      continue;
    }

    const suffix =
      candidateTitle
        .slice(
          normalizedQuery.length
        )
        .trim();

    if (
      /^(?:(?:the\s+)?official\s+)?(?:coloring|activity|puzzle)\s+book\b/.test(
        suffix
      ) ||
      /^part\s+(?:\d+|[ivxlcdm]+)\b/.test(
        suffix
      ) ||
      /^(?:book|volume|vol)\s+(?:\d+|[ivxlcdm]+)\b/.test(
        suffix
      ) ||
      /^(?:\d+|ii|iii|iv|v|vi|vii|viii|ix|x)\b/.test(
        suffix
      )
    ) {
      return true;
    }
  }

  return false;
}

function filterExactTitleSearchNoise(
  books: GoogleBookSearchItem[],
  normalizedQuery: string
) {
  if (
    !normalizedQuery ||
    hasDerivativeSearchIntent(
      normalizedQuery
    ) ||
    hasCollectionSearchIntent(
      normalizedQuery
    ) ||
    hasEditionSearchIntent(
      normalizedQuery
    )
  ) {
    return books;
  }

  const exactMatches =
    books.filter(
      (
        book
      ) =>
        getTitleSearchRelevance(
          book,
          normalizedQuery
        ) === 400
    );

  if (
    exactMatches.length ===
      0
  ) {
    return books;
  }

  const exactAuthor =
    normalizeTitle(
      exactMatches.find(
        (
          book
        ) =>
          Boolean(
            book.volumeInfo
              .authors?.[0]
          )
      )?.volumeInfo
        .authors?.[0]
    );

  return books.filter(
    (
      book
    ) => {
      const relevance =
        getTitleSearchRelevance(
          book,
          normalizedQuery
        );

      if (
        relevance < 100
      ) {
        return false;
      }

      if (
        relevance === 400
      ) {
        return true;
      }

      if (
        isLikelyExactTitleExpansionNoise(
          book,
          normalizedQuery
        )
      ) {
        return false;
      }

      const title =
        normalizeTitle(
          book.volumeInfo.title
        );

      const canonicalTitle =
        getCanonicalWorkTitleForBook(
          book
        );

      const expandsExactTitle =
        title.startsWith(
          `${normalizedQuery} `
        ) ||
        canonicalTitle.startsWith(
          `${normalizedQuery} `
        );

      if (
        expandsExactTitle &&
        exactAuthor
      ) {
        const candidateAuthor =
          normalizeTitle(
            book.volumeInfo
              .authors?.[0]
          );

        if (
          !candidateAuthor ||
          candidateAuthor !==
            exactAuthor
        ) {
          return false;
        }
      }

      return true;
    }
  );
}

function filterDerivativeSearchResults(
  books:
    GoogleBookSearchItem[],
  normalizedQuery: string
) {
  if (
    hasDerivativeSearchIntent(
      normalizedQuery
    )
  ) {
    return books;
  }

  const primaryResults =
    books.filter(
      (
        book
      ) =>
        !isLikelyDerivativeTitle(
          book
        )
    );

  return primaryResults.length >
    0
    ? primaryResults
    : books;
}

function getSearchClassificationText(
  book: GoogleBookSearchItem
) {
  return normalizeTitle(
    [
      book.volumeInfo.title,
      book.volumeInfo.subtitle,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function hasCollectionSearchIntent(
  normalizedQuery: string
) {
  return (
    /\b(?:box set|boxed set|boxset|trilogy|omnibus|collection|bundle)\b/.test(
      normalizedQuery
    ) ||
    /\bcomplete\s+(?:series|trilogy|collection)\b/.test(
      normalizedQuery
    ) ||
    /\b(?:books?|volumes?)\s+\d+\s+(?:to|through|and)\s+\d+\b/.test(
      normalizedQuery
    )
  );
}

function isLikelyCollectionTitle(
  book: GoogleBookSearchItem
) {
  if (isCatalogCollection(book)) return true;
  const text =
    getSearchClassificationText(
      book
    );

  return (
    /\b(?:box set|boxed set|boxset|trilogy|omnibus|collection set|book bundle|series bundle)\b/.test(
      text
    ) ||
    /\bcomplete\s+(?:series|trilogy|collection)\b/.test(
      text
    ) ||
    /\b\d+\s+book\s+(?:set|collection|series)\b/.test(
      text
    ) ||
    /\b(?:books?|volumes?)\s+\d+\s+(?:to|through|and)\s+\d+\b/.test(
      text
    ) ||
    /\b(?:books?|volumes?)\s+\d+\s*[-–—]\s*\d+\b/.test(
      text
    )
  );
}

function hasEditionSearchIntent(
  normalizedQuery: string
) {
  return (
    /\b(?:edition|version)\b/.test(
      normalizedQuery
    ) ||
    /\b(?:anniversary|revised|updated|collector|collectors|deluxe|special|exclusive|hardcover|hardback|paperback|ebook|kindle|large print|mass market)\b/.test(
      normalizedQuery
    )
  );
}

function isLikelyEditionVariant(
  book: GoogleBookSearchItem
) {
  const text =
    getSearchClassificationText(
      book
    );

  const rawTitle =
    book.volumeInfo.title ??
    '';

  return (
    /\b(?:anniversary|revised|updated|collector|collectors|deluxe|special|exclusive)\b/.test(
      text
    ) ||
    /\b(?:hardcover|hardback|paperback|ebook|kindle|large print|mass market)\s+(?:edition|version)\b/.test(
      text
    ) ||
    /\b(?:edition|version)\b/.test(
      text
    ) &&
    /\b(?:special|collector|collectors|deluxe|anniversary|revised|updated|exclusive|hardcover|hardback|paperback|ebook|kindle|large print|mass market)\b/.test(
      text
    ) ||
    /\([A-Z0-9]+(?:-[A-Z0-9]+)+\)\s*$/.test(
      rawTitle
    )
  );
}

function hasObviousNonLatinMetadata(
  book: GoogleBookSearchItem
) {
  const metadata =
    [
      book.volumeInfo.title,
      ...(book.volumeInfo.authors ?? []),
    ]
      .filter(Boolean)
      .join(' ');

  return /[\u0370-\u03FF\u0400-\u052F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(
    metadata
  );
}

function filterCollectionSearchResults(
  books:
    GoogleBookSearchItem[],
  normalizedQuery: string
) {
  if (
    hasCollectionSearchIntent(
      normalizedQuery
    )
  ) {
    return books;
  }

  const singleBookResults =
    books.filter(
      (
        book
      ) =>
        !isLikelyCollectionTitle(
          book
        )
    );

  return singleBookResults.length >
    0
    ? singleBookResults
    : books;
}

function filterLocaleNoise(
  books:
    GoogleBookSearchItem[],
  searchTerm: string
) {
  const queryHasNonLatin =
    /[\u0370-\u03FF\u0400-\u052F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(
      searchTerm
    );

  if (
    queryHasNonLatin
  ) {
    return books;
  }

  const latinResults =
    books.filter(
      (
        book
      ) =>
        !hasObviousNonLatinMetadata(
          book
        )
    );

  return latinResults.length >
    0
    ? latinResults
    : books;
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
  hardcoverPopularity: Record<string, { usersCount: number; rating: number | null; reviewsCount?: number | null }>
) {
  const left = hardcoverPopularity[a.id], right = hardcoverPopularity[b.id];
  return (right?.usersCount ?? 0) - (left?.usersCount ?? 0)
    || (right?.reviewsCount ?? 0) - (left?.reviewsCount ?? 0);
}

function matchesTitleAndAuthorQuery(book: GoogleBookSearchItem, normalizedQuery: string) {
  const title = getCanonicalWorkTitleForBook(book);
  if (!title || !normalizedQuery.startsWith(`${title} `)) return false;
  const authorTerms = normalizedQuery.slice(title.length + 1).split(' ').filter(Boolean);
  return authorTerms.length > 0 && (book.volumeInfo.authors ?? []).some(author => {
    const words = normalizeTitle(author).split(' ');
    return authorTerms.every(term => words.some(word => word.startsWith(term)));
  });
}

function getTitleAuthorRefinementQuery(books: GoogleBookSearchItem[], normalizedQuery: string) {
  if (hasDerivativeSearchIntent(normalizedQuery) || hasCollectionSearchIntent(normalizedQuery) || hasEditionSearchIntent(normalizedQuery)) return null;
  const titles = books.map(getCanonicalWorkTitleForBook)
    .filter(title => title.split(' ').length >= 2 && normalizedQuery.startsWith(`${title} `))
    .sort((a, b) => b.length - a.length);
  const title = titles[0];
  if (!title) return null;
  const author = normalizedQuery.slice(title.length + 1);
  const terms = author.split(' ').filter(Boolean);
  if (terms.length < 1 || terms.length > 4 || terms.some(term => term.length < 2)) return null;
  return `intitle:"${title}" inauthor:"${author}"`;
}

function getTitleSearchRelevance(
  book: GoogleBookSearchItem,
  normalizedQuery: string
) {
  const title =
    normalizeTitle(
      book.volumeInfo.title
    );

  const canonicalTitle =
    getCanonicalWorkTitleForBook(
      book
    );

  if (
    !title ||
    !normalizedQuery
  ) {
    return 0;
  }

  if (matchesTitleAndAuthorQuery(book, normalizedQuery)) return 400;

  if (
    title ===
      normalizedQuery ||
    canonicalTitle ===
      normalizedQuery ||
    stripLeadingTitleArticle(canonicalTitle) === stripLeadingTitleArticle(normalizedQuery)
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

  const fuzzySimilarity =
    Math.max(
      getFuzzyTextSimilarity(
        normalizedQuery,
        title
      ),
      getFuzzyTextSimilarity(
        normalizedQuery,
        canonicalTitle
      )
    );

  if (
    fuzzySimilarity >=
      0.82
  ) {
    return 90;
  }

  if (
    fuzzySimilarity >=
      0.70
  ) {
    return 70;
  }

  if (
    fuzzySimilarity >=
      0.58
  ) {
    return 50;
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
      continue;
    }

    const fuzzySimilarity =
      getFuzzyTextSimilarity(
        normalizedQuery,
        normalizedAuthor
      );

    if (
      fuzzySimilarity >=
        0.82
    ) {
      best =
        Math.max(
          best,
          90
        );
    } else if (
      fuzzySimilarity >=
        0.70
    ) {
      best =
        Math.max(
          best,
          70
        );
    } else if (
      fuzzySimilarity >=
        0.58
    ) {
      best =
        Math.max(
          best,
          50
        );
    }
  }

  return best;
}

// Adaptations are distinct works, not editions of the prose novel.
function isGraphicAdaptation(book: GoogleBookSearchItem) {
  return /\b(?:graphic novel|graphic adaptation|comic adaptation|manga adaptation)\b/i.test(
    [book.volumeInfo.title, book.volumeInfo.subtitle].filter(Boolean).join(' ')
  );
}

// Product tier precedes popularity, so companion products cannot displace books.
function searchProductTier(book: GoogleBookSearchItem) {
  return Number(isLikelyDerivativeTitle(book) || isCatalogCollection(book));
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
      const tierDifference = searchProductTier(a) - searchProductTier(b);
      if (tierDifference) return tierDifference;
      if (!/\b(?:graphic|comic|manga)\b/i.test(searchTerm)) {
        const adaptationDifference = Number(isGraphicAdaptation(a)) - Number(isGraphicAdaptation(b));
        if (adaptationDifference) return adaptationDifference;
      }
      const popularityDifference = compareBookPopularity(a, b, hardcoverPopularity);
      if (popularityDifference) return popularityDifference;
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

      return a.id.localeCompare(b.id);
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
        const tierDifference = searchProductTier(a) - searchProductTier(b);
        if (tierDifference) return tierDifference;
        const popularityDifference = compareBookPopularity(a, b, hardcoverPopularity);
        if (popularityDifference) return popularityDifference;
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

  if (/\b(?:graphic novel|graphic adaptation|comic adaptation|manga adaptation)\b/i.test(raw)) return normalizeTitle(raw);

  // Remove bracketed/parenthetical edition and series labels.
  raw =
    raw.replace(
      /\s*[\[(][^\])]*(?:edition|collector|deluxe|special|exclusive|anniversary|movie tie|tv tie|paperback|hardcover|mass market|large print|book\s*\d+|volume\s*\d+|vol\.?\s*\d+|series|#\s*\d+|,\s*\d+)[^\])]*[\])]/gi,
      ''
    );

  // Strip common edition/marketing suffixes after a colon/dash while
  // preserving meaningful subtitles. The sequel/prequel pattern is kept
  // deliberately narrow so ordinary subtitles are not collapsed.
  raw =
    raw.replace(
      /\s*[:\-–—]\s*(?:(?:limited\s+)?(?:special|deluxe|collector'?s|collectors|anniversary|exclusive)\s+edition(?:\s+(?:hardcover|hardback|paperback))?(?:\s*[:\-–—]\s*(?:a novel|the novel|(?:the\s+)?(?:sunday times|new york times) bestseller))?|a novel|the novel|movie tie[- ]?in edition|tv tie[- ]?in edition|hardcover edition|hardback edition|paperback edition|mass market paperback|large print edition|(?:an?\s+|the\s+)?(?:(?:gma|good morning america|reese'?s|oprah'?s|read with jenna)\s+)?book club (?:pick|selection)|(?:the\s+)?(?:gripping|thrilling|stunning|bestselling|best-selling|highly anticipated|must-read)\s+(?:sequel|prequel)\s+to\b.*|.*(?:series|book\s*\d+|volume\s*\d+|vol\.?\s*\d+|#\s*\d+).*)$/i,
      ''
    );

  let title =
    normalizeTitle(
      raw
    );

  title =
    title
      .replace(
        /\s+(?:revised(?:\s+and)?\s+updated)(?:\s+edition)?$/i,
        ''
      )
      .replace(
        /\s+(?:(?:\d+)(?:st|nd|rd|th)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+anniversary\b.*$/i,
        ''
      )
      .trim();

  const removableSuffixes = [
    ' limited edition',
    ' deluxe edition',
    ' special edition',
    ' collectors edition',
    ' collector s edition',
    ' exclusive edition',
    ' anniversary edition',
    ' hardcover edition',
    ' hardback edition',
    ' paperback edition',
    ' ebook edition',
    ' kindle edition',
    ' hardcover version',
    ' hardback version',
    ' paperback version',
    ' ebook version',
    ' kindle version',
    ' international edition',
    ' movie tie in edition',
    ' tv tie in edition',
    ' mass market paperback',
    ' large print edition',
    ' uncut edition',
    ' illustrated edition',
    ' gift edition',
    ' trade paperback',
    ' revised and updated',
    ' revised updated',
    ' updated edition',
    ' revised edition',
    ' a novel',
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

function getEditionLocaleScore(
  book: GoogleBookSearchItem
) {
  const language =
    (
      book.volumeInfo
        .language ??
      ''
    )
      .trim()
      .toLowerCase();

  const country =
    (
      book.saleInfo
        ?.country ??
      ''
    )
      .trim()
      .toUpperCase();

  let score =
    0;

  if (
    language ===
      'en' ||
    language ===
      'eng' ||
    language.startsWith(
      'en-'
    )
  ) {
    score +=
      100;
  }

  if (
    country ===
      'US'
  ) {
    score +=
      50;
  }

  return score;
}

function isEligibleAlternateEdition(
  book: GoogleBookSearchItem
) {
  const language =
    (
      book.volumeInfo
        .language ??
      ''
    )
      .trim()
      .toLowerCase();

  const country =
    (
      book.saleInfo
        ?.country ??
      ''
    )
      .trim()
      .toUpperCase();

  const explicitlyEnglish =
    language ===
      'en' ||
    language ===
      'eng' ||
    language.startsWith(
      'en-'
    );

  const explicitlyNonEnglish =
    Boolean(
      language
    ) &&
    !explicitlyEnglish;

  // A US storefront entry is not proof that the edition is English.
  // Never borrow artwork from an edition Google explicitly identifies
  // as non-English, even when it is sold in the US.
  if (
    explicitlyNonEnglish
  ) {
    return false;
  }

  return (
    explicitlyEnglish ||
    (
      !language &&
      country ===
        'US'
    )
  );
}

function getGoogleCoverTier(
  imageLinks:
    | GoogleBookSearchItem[
        'volumeInfo'
      ]['imageLinks']
    | undefined
) {
  if (
    imageLinks?.extraLarge
  ) {
    return 6;
  }

  if (
    imageLinks?.large
  ) {
    return 5;
  }

  if (
    imageLinks?.medium
  ) {
    return 4;
  }

  if (
    imageLinks?.small
  ) {
    return 3;
  }

  if (
    imageLinks?.thumbnail
  ) {
    return 2;
  }

  if (
    imageLinks?.smallThumbnail
  ) {
    return 1;
  }

  return 0;
}

function getBestEligibleGoogleWorkCover(
  editions:
    GoogleBookSearchItem[]
) {
  const eligible =
    editions.filter(edition => !audioEditionPenalty(edition) || !editions.some(other => !audioEditionPenalty(other) && isEligibleAlternateEdition(other))).filter(
      isEligibleAlternateEdition
    );

  const ranked =
    eligible
      .map(
        (
          edition
        ) => ({
          edition,
          localeScore:
            getEditionLocaleScore(
              edition
            ),
          tier:
            getGoogleCoverTier(
              edition.volumeInfo
                .imageLinks
            ),
          cover:
            getBestSearchCover(
              edition.volumeInfo
                .imageLinks
            ),
        })
      )
      .filter(
        (
          candidate
        ) =>
          Boolean(
            candidate.cover
          )
      )
      .sort(
        (
          a,
          b
        ) => {
          const localeDifference =
            b.localeScore -
            a.localeScore;

          if (
            localeDifference !==
              0
          ) {
            return localeDifference;
          }

          const tierDifference = b.tier - a.tier;
          if (tierDifference !== 0) return tierDifference;
          const labelPenalty = (book: GoogleBookSearchItem) =>
            Number(Boolean(book.novoriEdition?.originalTitle && book.novoriEdition.originalTitle !== book.volumeInfo.title));
          return labelPenalty(a.edition) - labelPenalty(b.edition);
        }
      );

  return (
    ranked[0]
      ?.cover ??
    null
  );
}

function normalizeSearchCensorshipTokens(
  value?: string
) {
  if (
    !value
  ) {
    return value;
  }

  // Preserve the fact that a word was intentionally censored before
  // punctuation normalization erases the symbols. This stays generic:
  // F*ck, S#it, #@%!, etc. become the same search-only placeholder.
  return value.replace(
    /(?:[A-Za-z]+[*#@%]+[A-Za-z]+|[A-Za-z]+[*#@%]{2,}|[*#@%]{2,}[A-Za-z]+|[*#@%!]{2,})/g,
    ' censoredtoken '
  );
}

function getSearchWorkIdentityTitle(
  book: GoogleBookSearchItem
) {
  const titleForIdentity =
    normalizeSearchCensorshipTokens(
      book.volumeInfo.title
    )
      ?.replace(
        /\s*\([A-Z0-9]+(?:-[A-Z0-9]+)+\)\s*$/,
        ''
      );

  const identityBook:
    GoogleBookSearchItem = {
      ...book,
      volumeInfo: {
        ...book.volumeInfo,
        title:
          titleForIdentity,
      },
    };

  let title =
    getCanonicalWorkTitleForBook(
      identityBook
    );

  // "Bleep" is another storefront-safe substitute used in otherwise
  // identical titles. Treat it as the same search-only censored token.
  title =
    title.replace(
      /\bbleep\b/g,
      'censoredtoken'
    );

  const removableSearchSuffixes = [
    ' revised and updated',
    ' revised updated',
    ' revised edition',
    ' updated edition',
    ' revised and updated edition',
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
        removableSearchSuffixes
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

  return stripLeadingTitleArticle(title);
}

function getSearchTitleStem(
  book: GoogleBookSearchItem
) {
  const rawTitle =
    normalizeSearchCensorshipTokens(
      book.volumeInfo.title
    ) ??
    '';

  const stem =
    rawTitle
      .split(
        /\s*(?::|\/|\s[-–—]\s)\s*/
      )[0];

  return stripLeadingTitleArticle(
    normalizeTitle(
      stem
    )
  );
}

function authorsMatchOrCandidateMissing(
  reference: GoogleBookSearchItem,
  candidate: GoogleBookSearchItem
) {
  const referenceAuthor =
    normalizeTitle(
      reference.volumeInfo
        .authors?.[0]
    );

  const candidateAuthor =
    normalizeTitle(
      candidate.volumeInfo
        .authors?.[0]
    );

  if (
    referenceAuthor
  ) {
    return (
      !candidateAuthor ||
      candidateAuthor ===
        referenceAuthor
    );
  }

  return !candidateAuthor;
}

function isLikelySameSearchWork(
  reference: GoogleBookSearchItem,
  candidate: GoogleBookSearchItem
) {
  const referenceTitle =
    getSearchWorkIdentityTitle(
      reference
    );

  const candidateTitle =
    getSearchWorkIdentityTitle(
      candidate
    );

  if (
    !referenceTitle ||
    !candidateTitle
  ) {
    return false;
  }

  const comparableReferenceTitle =
    stripLeadingTitleArticle(
      referenceTitle
    );

  const comparableCandidateTitle =
    stripLeadingTitleArticle(
      candidateTitle
    );

  if (
    comparableReferenceTitle ===
      comparableCandidateTitle
  ) {
    return authorsMatchOrCandidateMissing(
      reference,
      candidate
    );
  }

  if (
    !authorsMatchOrCandidateMissing(
      reference,
      candidate
    )
  ) {
    return false;
  }

  const referenceStem =
    getSearchTitleStem(
      reference
    );

  const candidateStem =
    getSearchTitleStem(
      candidate
    );

  // Google sometimes returns both a short title and the same title with
  // its subtitle/alternate rendering appended after a colon, dash, or slash.
  return (
    comparableReferenceTitle ===
      candidateStem ||
    comparableCandidateTitle ===
      referenceStem
  );
}

function filterEditionSearchResults(
  books:
    GoogleBookSearchItem[],
  normalizedQuery: string
) {
  if (
    hasEditionSearchIntent(
      normalizedQuery
    )
  ) {
    return books;
  }

  const primaryCandidates =
    books
      .filter(
        (
          book
        ) =>
          !isLikelyDerivativeTitle(
            book
          ) &&
          !isLikelyCollectionTitle(
            book
          ) &&
          !isLikelyEditionVariant(
            book
          ) &&
          getTitleSearchRelevance(
            book,
            normalizedQuery
          ) >= 200
      );

  if (
    primaryCandidates.length ===
      0
  ) {
    return books;
  }

  return books.filter(
    (
      book
    ) => {
      if (
        !isLikelyEditionVariant(
          book
        )
      ) {
        return true;
      }

      return !primaryCandidates.some(
        (
          primary
        ) =>
          isLikelySameSearchWork(
            primary,
            book
          )
      );
    }
  );
}

function filterNearCopySearchResults(
  books:
    GoogleBookSearchItem[],
  normalizedQuery: string
) {
  if (
    !normalizedQuery ||
    hasDerivativeSearchIntent(
      normalizedQuery
    )
  ) {
    return books;
  }

  const primaryCandidates =
    books.filter(
      (
        book
      ) =>
        !isLikelyDerivativeTitle(
          book
        ) &&
        getTitleSearchRelevance(
          book,
          normalizedQuery
        ) >= 200
    );

  if (
    primaryCandidates.length ===
      0
  ) {
    return books;
  }

  const bestPrimary =
    [...primaryCandidates]
      .sort(
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

          const authorDifference =
            Number(
              Boolean(
                b.volumeInfo
                  .authors?.[0]
              )
            ) -
            Number(
              Boolean(
                a.volumeInfo
                  .authors?.[0]
              )
            );

          if (
            authorDifference !==
              0
          ) {
            return authorDifference;
          }

          return (
            getGoogleBookPopularity(
              b
            ).ratingsCount -
            getGoogleBookPopularity(
              a
            ).ratingsCount
          );
        }
      )[0];

  const baseTitle =
    getSearchWorkIdentityTitle(
      bestPrimary
    );

  if (
    !baseTitle
  ) {
    return books;
  }

  const baseWords =
    new Set(
      baseTitle
        .split(' ')
        .filter(Boolean)
    );

  return books.filter(
    (
      book
    ) => {
      if (
        book.id ===
        bestPrimary.id
      ) {
        return true;
      }

      if (
        isLikelyDerivativeTitle(
          book
        )
      ) {
        return false;
      }

      const candidateTitle =
        getSearchWorkIdentityTitle(
          book
        );

      if (
        candidateTitle ===
        baseTitle
      ) {
        const candidateAuthor =
          normalizeTitle(
            book.volumeInfo
              .authors?.[0]
          );

        const primaryAuthor =
          normalizeTitle(
            bestPrimary.volumeInfo
              .authors?.[0]
          );

        // When Google returns the exact same work twice, prefer the
        // complete record over an otherwise identical unknown-author row.
        if (
          primaryAuthor &&
          !candidateAuthor
        ) {
          return false;
        }

        return true;
      }

      const candidateWords =
        candidateTitle
          .split(' ')
          .filter(Boolean);

      const sharedWords =
        candidateWords.filter(
          (
            word
          ) =>
            baseWords.has(
              word
            )
        ).length;

      const overlap =
        baseWords.size >
          0
          ? sharedWords /
            baseWords.size
          : 0;

      // Keep legitimate same/similar titles by different known authors.
      // Derivatives, collections, and edition variants are classified
      // separately before this stage.
      void overlap;

      return true;
    }
  );
}

function getSearchEditionVariantPenalty(
  book: GoogleBookSearchItem
) {
  return isLikelyEditionVariant(
    book
  )
    ? 1
    : 0;
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

  const preferredLocaleResults =
    books.filter(
      isEligibleAlternateEdition
    );

  // Never fall back to explicitly foreign-language editions for
  // duplicate/work selection. If Google cannot identify an English or
  // US-with-unknown-language edition, leave those editions out instead
  // of borrowing foreign artwork.
  const candidates =
    preferredLocaleResults;

  const exactIdentityKeys =
    new Set(
      candidates.map(
        (
          book
        ) => {
          const title =
            getSearchWorkIdentityTitle(
              book
            );

          const author =
            normalizeTitle(
              book.volumeInfo
                .authors?.[0]
            );

          return `${title}::${author}`;
        }
      )
    );

  const groups =
    new Map<
      string,
      GoogleBookSearchItem[]
    >();

  for (
    const book of
      candidates
  ) {
    let canonicalTitle =
      getSearchWorkIdentityTitle(
        book
      );

    const primaryAuthor =
      normalizeTitle(
        book.volumeInfo.authors?.[0]
      );

    if (
      !canonicalTitle
    ) {
      continue;
    }

    const titleStem =
      getSearchTitleStem(
        book
      );

    if (
      !isGraphicAdaptation(book) &&
      titleStem &&
      titleStem !==
        canonicalTitle &&
      exactIdentityKeys.has(
        `${titleStem}::${primaryAuthor}`
      )
    ) {
      canonicalTitle =
        titleStem;
    }

    const identity =
      `${searchProductTier(book)}::${canonicalTitle}::${primaryAuthor}`;

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
              const formatDifference = audioEditionPenalty(a) - audioEditionPenalty(b);
              if (formatDifference !== 0) return formatDifference;

              // Prefer the plain-title record to normalized marketing/edition labels.
              const titleLabelPenalty = (book: GoogleBookSearchItem) =>
                book.novoriEdition?.originalTitle && cleanCatalogBookTitle(book.novoriEdition.originalTitle) !== book.novoriEdition.originalTitle ? 1 : 0;
              const titleLabelDifference = titleLabelPenalty(a) - titleLabelPenalty(b);
              if (titleLabelDifference !== 0) return titleLabelDifference;

              const editionVariantDifference =
                getSearchEditionVariantPenalty(
                  a
                ) -
                getSearchEditionVariantPenalty(
                  b
                );

              if (
                editionVariantDifference !==
                  0
              ) {
                return editionVariantDifference;
              }

              const aExact =
                stripLeadingTitleArticle(
                  normalizeTitle(
                    a.volumeInfo.title
                  )
                ) ===
                stripLeadingTitleArticle(
                  normalizedQuery
                )
                  ? 1
                  : 0;

              const bExact =
                stripLeadingTitleArticle(
                  normalizeTitle(
                    b.volumeInfo.title
                  )
                ) ===
                stripLeadingTitleArticle(
                  normalizedQuery
                )
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

              const localeDifference =
                getEditionLocaleScore(
                  b
                ) -
                getEditionLocaleScore(
                  a
                );

              if (
                localeDifference !==
                  0
              ) {
                return localeDifference;
              }

              // A complete edition should beat a same-work record lacking a
              // publication date, independent of the query's leading article.
              const dateDifference = Number(Boolean(validPublicationDate(b.volumeInfo.publishedDate))) -
                Number(Boolean(validPublicationDate(a.volumeInfo.publishedDate)));
              if (dateDifference !== 0) return dateDifference;

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
                aHasCover || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
              );
            }
          );

        const representative =
          sorted[0];

        const canonicalTitle =
          getSearchWorkIdentityTitle(
            representative
          );

        const primaryAuthor =
          normalizeTitle(
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

        representative.novoriWork = {
          key:
            `${canonicalTitle}::${primaryAuthor}${searchProductTier(representative) ? "::supplement" : ""}`,
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

export function getBestSearchCover(imageLinks: GoogleBookSearchItem['volumeInfo']['imageLinks']) {
  return getBookCoverPlan({ imageLinks }).primaryUrl ?? undefined;
}

function getAmbiguousTitleBooks(books: GoogleBookSearchItem[]) {
  const groups = new Map<string, GoogleBookSearchItem[]>();
  for (const book of books) {
    const title = getCanonicalWorkTitleForBook(book);
    const author = normalizeTitle(book.volumeInfo.authors?.[0]);
    if (!title || !author) continue;
    const group = groups.get(title) ?? [];
    group.push(book);
    groups.set(title, group);
  }
  return [...groups.values()].filter(group =>
    new Set(group.map(book => normalizeTitle(book.volumeInfo.authors?.[0]))).size > 1
  ).flat();
}

const searchQueryKey = (term: string) => term.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const searchPageTotals = new Map<string, number>();
export function hasMoreBookSearchResults(term: string, startIndex: number) {
 return startIndex < Math.min(searchPageTotals.get(searchQueryKey(term)) ?? 0, 1000);
}

const readCompletedSearch = createBookReadCache<GoogleBookSearchItem[]>();

export function searchNovoriBooks(searchTerm: string, startIndex = 0) {
  const key = searchQueryKey(searchTerm);
  return readCompletedSearch(`${key}:${startIndex}`, () => loadNovoriBooks(searchTerm, startIndex));
}

async function loadNovoriBooks(searchTerm: string, startIndex = 0) {
  const response =
    await fetchSharedGoogleBooksSearch(
      searchTerm, startIndex
    );

  if (
    !response.ok ||
    !response.data
  ) {
    throw new Error(
      `Google Books request failed: ${response.status}`
    );
  }

  searchPageTotals.set(searchQueryKey(searchTerm), response.data.totalItems ?? (startIndex + (response.data.items?.length ?? 0)));
  while (searchPageTotals.size > 150) searchPageTotals.delete(searchPageTotals.keys().next().value!);
  let initialResults: GoogleBookSearchItem[] =
    (response.data.items ?? []).map(normalizeIsbnDbEdition).map(book => ({ ...book, volumeInfo: { ...book.volumeInfo, title: book.volumeInfo.title ? displayBookTitle(book.volumeInfo.title) : undefined } }));

  const normalizedQuery =
    normalizeTitle(
      searchTerm
    );

  // Provider searches can omit an article and return an incomplete edition.
  // Only repair exact, multiword title matches missing a valid date; ordinary
  // searches keep their existing request count and cache keys.
  const incompleteMatches = initialResults.filter(book =>
    normalizeTitle(book.volumeInfo.title) === normalizedQuery &&
    !validPublicationDate(book.volumeInfo.publishedDate));
  if (startIndex === 0 && normalizedQuery.split(' ').length >= 3 &&
      stripLeadingTitleArticle(normalizedQuery) === normalizedQuery &&
      incompleteMatches.length > 0 &&
      !hasDerivativeSearchIntent(normalizedQuery) &&
      !hasCollectionSearchIntent(normalizedQuery) &&
      !hasEditionSearchIntent(normalizedQuery)) {
    const repairs = await Promise.all(['a', 'an', 'the'].map(async article => {
      const alternate = await fetchSharedGoogleBooksSearch(`${article} ${normalizedQuery}`).catch(() => null);
      return alternate?.ok ? (alternate.data?.items ?? []).map(normalizeIsbnDbEdition)
        .filter(candidate => validPublicationDate(candidate.volumeInfo.publishedDate) &&
          incompleteMatches.some(original =>
            getSearchWorkIdentityTitle(candidate) === getSearchWorkIdentityTitle(original) &&
            authorsMatchOrCandidateMissing(original, candidate) &&
            Boolean(candidate.volumeInfo.authors?.length))) : [];
    }));
    initialResults = [...new Map([...initialResults, ...repairs.flat()].map(book => [book.id, book])).values()];
  }

  let authorQualifiedResults = initialResults.filter(book => matchesTitleAndAuthorQuery(book, normalizedQuery));
  if (startIndex === 0 && authorQualifiedResults.length === 0) {
    const refinement = getTitleAuthorRefinementQuery(initialResults, normalizedQuery);
    if (refinement) {
      // One bounded, shared-cache-backed fallback; never discard usable results on failure.
      const refined = await fetchSharedGoogleBooksSearch(refinement).catch(() => null);
      if (refined?.ok) authorQualifiedResults = (refined.data?.items ?? []).map(normalizeIsbnDbEdition)
        .filter(book => matchesTitleAndAuthorQuery(book, normalizedQuery));
    }
  }
  if (authorQualifiedResults.length > 0) initialResults = authorQualifiedResults;

  const normalizedSearchIsbn =
    searchTerm
      .replace(
        /[^0-9Xx]/g,
        ''
      )
      .toUpperCase();

  const looksLikeIsbnSearch =
    /^(?:[0-9]{9}[0-9X]|[0-9]{13})$/.test(
      normalizedSearchIsbn
    );

  let strongestTitleMatch =
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

  let strongestAuthorMatch =
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

  let looksLikeAuthorSearch =
    strongestAuthorMatch >
    strongestTitleMatch;

  if (
    initialResults.length ===
    0
  ) {
    return [];
  }

  const relevantResults =
    looksLikeAuthorSearch ||
    looksLikeIsbnSearch
      ? initialResults
      : initialResults.filter(
          (
            book
          ) =>
            getTitleSearchRelevance(
              book,
              normalizedQuery
            ) >
            0
        );

  const exactTitleFilteredResults =
    looksLikeAuthorSearch ||
    looksLikeIsbnSearch
      ? relevantResults
      : filterExactTitleSearchNoise(
          relevantResults,
          normalizedQuery
        );

  const qualityFilteredResults =
    looksLikeAuthorSearch ||
    looksLikeIsbnSearch
      ? exactTitleFilteredResults
      : filterNearCopySearchResults(
          filterEditionSearchResults(
            filterCollectionSearchResults(
              filterDerivativeSearchResults(
                filterLocaleNoise(
                  exactTitleFilteredResults,
                  searchTerm
                ),
                normalizedQuery
              ),
              normalizedQuery
            ),
            normalizedQuery
          ),
          normalizedQuery
        );

  // Preserve relevant English companion products below the ordinary books.
  const supplements = looksLikeIsbnSearch ? [] : filterLocaleNoise(relevantResults, searchTerm)
    .filter(book => searchProductTier(book) > 0 && !qualityFilteredResults.some(row => row.id === book.id));
  const rankedResults = [...qualityFilteredResults, ...supplements];
  const sorted =
    looksLikeAuthorSearch
      ? sortAuthorSearchResults(
          rankedResults,
          searchTerm,
          {}
        )
      : sortTitleSearchResults(
          rankedResults,
          searchTerm,
          {}
        );

  const collapsed =
    collapseDuplicateEditions(
      sorted,
      searchTerm,
      {}
    );

  // Reuse the existing cached, quota-controlled popularity endpoint. A single
  // result needs no ranking request. Provider failures keep usable catalog results.
  const primaryBooks = collapsed.filter(book => searchProductTier(book) === 0);
  const ambiguityPopularity = primaryBooks.length > 1
    ? getHardcoverPopularity(primaryBooks, true)
    : Promise.resolve({});

  await Promise.all(
    collapsed.map(
      async (
        representative
      ) => {
        const work =
          representative
            .novoriWork;

        if (
          !work
        ) {
          return;
        }

        const workIdSet =
          new Set(
            work.googleBookIds
          );

        const siblingEditions =
          initialResults.filter(
            (
              candidate
            ) =>
              workIdSet.has(
                candidate.id
              )
          );

        const canonicalGoogleCover =
          getBestEligibleGoogleWorkCover(
            [representative]
          );

        representative.novoriWork = {
          ...work,
          canonicalCoverUrl:
            canonicalGoogleCover,
        };
      }
    )
  );

  await attachCatalogSearchCovers(
    collapsed
  );

  const popularity = await ambiguityPopularity;
  bookWorkDetails.remember(searchTerm, collapsed);
  return looksLikeAuthorSearch
    ? sortAuthorSearchResults(collapsed, searchTerm, popularity)
    : sortTitleSearchResults(collapsed, searchTerm, popularity);
}

export type AuthorBookResult = {
  book: GoogleBookSearchItem;
  usersCount: number;
  ratingsCount: number;
  reviewsCount: number;
  rating: number | null;
};

export function compareAuthorBookPopularity(a: AuthorBookResult, b: AuthorBookResult) {
  return b.usersCount - a.usersCount || b.reviewsCount - a.reviewsCount
    || a.book.id.localeCompare(b.book.id);
}

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

  return resolvedBooks.sort(compareAuthorBookPopularity);
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
                    poolSize: 100,
                  }
                : {
                    months: 18,
                    poolSize: 150,
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
