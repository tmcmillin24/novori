import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { NovoriColors } from '../../../constants/novori-theme';
import BookCoverImage from '../../../components/BookCoverImage';
import {
  getBookCoverPlan,
  resolveBookCoverUrl,
} from '../../../lib/book-covers';
import { useNovoriTheme } from '../../../context/theme-context';
import {
  fetchGoogleBooksJson,
  resolveGoogleBooksIdentity,
} from '../../../lib/google-books';
import { supabase } from '../../../lib/supabase';
import {
  resolveHardcoverRating,
} from '../../../lib/book-search';
import {
  CommunityBookReview,
  getCommunityBookReviews,
} from '../../../lib/feed';
import {
  addBookToCart,
  getBookCartItem,
  removeBookFromCart,
} from '../../../lib/book-cart';
import {
  getUserBook,
  removeUserBook,
  saveUserBook,
  updateBookReadingDates,
  updateUserBookOwned,
  UserBook,
  UserBookStatus,
} from '../../../lib/user-books';
import {
  shareBookLink,
} from '../../../lib/share-links';
import {
  transitionReadingJourney,
} from '../../../lib/reading-details';

type GoogleBook = {
  id: string;
  novoriWork?: {
    key: string;
    canonicalTitle: string;
    primaryAuthor: string;
    googleBookIds: string[];
    isbns: string[];
    canonicalCoverUrl?: string | null;
  };
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    pageCount?: number;
    categories?: string[];
    industryIdentifiers?: {
      type: string;
      identifier: string;
    }[];
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
    averageRating?: number;
    ratingsCount?: number;
  };
};

type HardcoverSeriesBook = {
  position: number;
  id: number;
  title: string;
  slug?: string | null;
  releaseDate?: string | null;
  imageUrl?: string | null;
  authors: string[];
  isbns: string[];
};

type HardcoverSeries = {
  id: number;
  name: string;
  slug?: string | null;
  currentPosition?: number | null;
};

type HardcoverSeriesResponse = {
  series: HardcoverSeries | null;
  books: HardcoverSeriesBook[];
  error?: string;
  details?: unknown;
};

type GoogleSearchResponse = {
  totalItems?: number;
  items?: GoogleBook[];
};

function cleanDescription(description?: string) {
  if (!description) {
    return '';
  }

  return description
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getBookISBN(book: GoogleBook) {
  const identifiers = book.volumeInfo.industryIdentifiers ?? [];

  const isbn13 = identifiers.find(
    (item) => item.type === 'ISBN_13'
  )?.identifier;

  if (isbn13) {
    return isbn13;
  }

  const isbn10 = identifiers.find(
    (item) => item.type === 'ISBN_10'
  )?.identifier;

  return isbn10;
}

function normalizeTitle(title?: string) {
  return title?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
}

function normalizeSeriesWorkTitle(
  title?: string
) {
  if (
    !title
  ) {
    return '';
  }

  const cleanTitle =
    getSeriesWorkSearchTitle(
      title
    ) ||
    title;

  const baseTitle =
    cleanTitle
      .split(':')[0]
      ?.trim() ??
    cleanTitle;

  return normalizeTitle(
    baseTitle
  );
}

function getSeriesWorkSearchTitle(
  title?: string
) {
  if (!title) {
    return '';
  }

  return title
    .trim()
    .replace(
      /\s*[\[(][^\])]*(?:edition|collector|deluxe|special|exclusive|anniversary|movie tie|tv tie|paperback|hardcover|mass market|large print|book\s*\d+|volume\s*\d+|vol\.?\s*\d+|series|#\s*\d+|,\s*\d+)[^\])]*[\])]\s*$/i,
      ''
    )
    .replace(
      /\s*[-–—]\s*(?:a\s+)?(?:terminal\s+list\s+)?thriller.*$/i,
      ''
    )
    .replace(
      /\s*:\s*(?:a\s+)?(?:terminal\s+list\s+)?thriller.*$/i,
      ''
    )
    .trim();
}



function normalizeAuthorName(
  author?: string
) {
  return (
    author
      ?.toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ''
      ) ?? ''
  );
}

function bookMatchesClickedIdentity(
  candidate: GoogleBook,
  clickedTitle:
    string | undefined,
  clickedAuthors:
    string[]
) {
  if (!clickedTitle) {
    return true;
  }

  const titleMatches =
    normalizeTitle(
      candidate.volumeInfo
        .title
    ) ===
    normalizeTitle(
      clickedTitle
    );

  if (!titleMatches) {
    return false;
  }

  if (
    clickedAuthors.length ===
    0
  ) {
    return true;
  }

  const candidateAuthors =
    candidate.volumeInfo
      .authors ?? [];

  return clickedAuthors.some(
    (clickedAuthor) => {
      const wanted =
        normalizeAuthorName(
          clickedAuthor
        );

      return candidateAuthors.some(
        (
          candidateAuthor
        ) => {
          const actual =
            normalizeAuthorName(
              candidateAuthor
            );

          return (
            actual === wanted ||
            actual.includes(
              wanted
            ) ||
            wanted.includes(
              actual
            )
          );
        }
      );
    }
  );
}

function bookMatchesClickedWork(
  candidate: GoogleBook,
  clickedTitle:
    string | undefined,
  clickedAuthors:
    string[]
) {
  if (!clickedTitle) {
    return true;
  }

  const titleMatches =
    normalizeSeriesWorkTitle(
      candidate.volumeInfo
        .title
    ) ===
    normalizeSeriesWorkTitle(
      clickedTitle
    );

  if (!titleMatches) {
    return false;
  }

  if (
    clickedAuthors.length ===
      0
  ) {
    return true;
  }

  const candidateAuthors =
    candidate.volumeInfo
      .authors ??
    [];

  return clickedAuthors.some(
    (
      clickedAuthor
    ) => {
      const wanted =
        normalizeAuthorName(
          clickedAuthor
        );

      return candidateAuthors.some(
        (
          candidateAuthor
        ) => {
          const actual =
            normalizeAuthorName(
              candidateAuthor
            );

          return (
            actual === wanted ||
            actual.includes(
              wanted
            ) ||
            wanted.includes(
              actual
            )
          );
        }
      );
    }
  );
}


async function resolveClickedDiscoverBook(
  initialBook: GoogleBook,
  clickedTitle:
    string | undefined,
  clickedAuthors:
    string[],
  clickedIsbn:
    string | undefined,
  canonicalizeWork =
    false
) {
  if (
    canonicalizeWork &&
    clickedTitle
  ) {
    try {
      const identity =
        await resolveGoogleBooksIdentity({
          title:
            clickedTitle,
          author:
            clickedAuthors[0],
          isbn:
            clickedIsbn,
        });

      if (
        identity.ok &&
        identity.googleBookId
      ) {
        if (
          identity.googleBookId ===
            initialBook.id &&
          bookMatchesClickedWork(
            initialBook,
            clickedTitle,
            clickedAuthors
          )
        ) {
          return initialBook;
        }

        const detail =
          await fetchGoogleBooksJson<
            GoogleBook
          >(
            `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(
              identity.googleBookId
            )}`
          );

        if (
          detail.ok &&
          detail.data &&
          bookMatchesClickedWork(
            detail.data,
            clickedTitle,
            clickedAuthors
          )
        ) {
          return detail.data;
        }
      }

      if (
        identity.status ===
          429
      ) {
        return null;
      }
    } catch {
      // Fall through to the clicked edition and targeted lookups.
    }
  }

  if (
    bookMatchesClickedIdentity(
      initialBook,
      clickedTitle,
      clickedAuthors
    )
  ) {
    return initialBook;
  }

  if (
    clickedTitle &&
    !canonicalizeWork
  ) {
    try {
      const identity =
        await resolveGoogleBooksIdentity({
          title:
            clickedTitle,
          author:
            clickedAuthors[0],
          isbn:
            clickedIsbn,
        });

      if (
        identity.ok &&
        identity.googleBookId
      ) {
        const detail =
          await fetchGoogleBooksJson<
            GoogleBook
          >(
            `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(
              identity.googleBookId
            )}`
          );

        if (
          detail.ok &&
          detail.data &&
          bookMatchesClickedWork(
            detail.data,
            clickedTitle,
            clickedAuthors
          )
        ) {
          return detail.data;
        }
      }

      if (
        identity.status ===
          429
      ) {
        return null;
      }
    } catch {
      // Fall through to the existing targeted searches.
    }
  }

  const queries: string[] =
    [];

  if (clickedIsbn) {
    queries.push(
      `isbn:${clickedIsbn}`
    );
  }

  if (clickedTitle) {
    const titleAndAuthor = [
      `intitle:"${clickedTitle}"`,
    ];

    if (
      clickedAuthors[0]
    ) {
      titleAndAuthor.push(
        `inauthor:"${clickedAuthors[0]}"`
      );
    }

    queries.push(
      titleAndAuthor.join(
        ' '
      )
    );
  }

  for (
    const query of queries
  ) {
    try {
      const response =
        await fetchGoogleBooksJson<
          GoogleSearchResponse
        >(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
            query
          )}&maxResults=20&printType=books&projection=full`
        );

      if (
        !response.ok ||
        !response.data
      ) {
        continue;
      }

      const matchingBook =
        (
          response.data.items ??
          []
        ).find(
          (
            candidate
          ) =>
            canonicalizeWork
              ? bookMatchesClickedWork(
                  candidate,
                  clickedTitle,
                  clickedAuthors
                )
              : bookMatchesClickedIdentity(
                  candidate,
                  clickedTitle,
                  clickedAuthors
                )
        );

      if (
        matchingBook
      ) {
        return matchingBook;
      }
    } catch {
      // Try the next identity lookup.
    }
  }

  return null;
}

function googleBooksCoverMatchesVolume(
  coverUrl:
    | string
    | undefined,
  googleBookId:
    string
) {
  if (
    !coverUrl ||
    !googleBookId
  ) {
    return false;
  }

  try {
    const parsed =
      new URL(
        coverUrl
      );

    return (
      parsed.searchParams.get(
        'id'
      ) ===
        googleBookId &&
      (
        !parsed.searchParams.get(
          'printsec'
        ) ||
        parsed.searchParams.get(
          'printsec'
        ) ===
          'frontcover'
      )
    );
  } catch {
    return false;
  }
}

function getYear(date?: string | null) {
  if (!date) {
    return null;
  }

  const year = date.substring(0, 4);

  if (!/^\d{4}$/.test(year)) {
    return null;
  }

  return year;
}

function formatPublishedDate(date?: string) {
  if (!date) {
    return undefined;
  }

  if (/^\d{4}$/.test(date)) {
    return date;
  }

  if (/^\d{4}-\d{2}$/.test(date)) {
    const [year, month] = date.split('-');
    const monthIndex = Number(month) - 1;

    if (monthIndex >= 0 && monthIndex <= 11) {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: 'numeric',
      }).format(
        new Date(
          Number(year),
          monthIndex,
          1
        )
      );
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] =
      date.split('-');

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(
      new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
      )
    );
  }

  return date;
}


function formatReadingDate(
  value?: string | null
) {
  if (!value) {
    return 'Not recorded';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 'Not recorded';
  }

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  ).format(date);
}

function dateInputFromIso(
  value?: string | null
) {
  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return '';
  }

  const month =
    `${date.getMonth() + 1}`.padStart(
      2,
      '0'
    );

  const day =
    `${date.getDate()}`.padStart(
      2,
      '0'
    );

  return `${month}/${day}/${date.getFullYear()}`;
}

function parseDateInput(
  value: string
) {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return null;
  }

  const match =
    trimmed.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

  if (!match) {
    throw new Error(
      'Use MM/DD/YYYY for reading dates.'
    );
  }

  const month =
    Number(match[1]);

  const day =
    Number(match[2]);

  const year =
    Number(match[3]);

  const date =
    new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0
    );

  if (
    date.getFullYear() !==
      year ||
    date.getMonth() !==
      month - 1 ||
    date.getDate() !==
      day
  ) {
    throw new Error(
      'Enter a valid calendar date.'
    );
  }

  return date.toISOString();
}

function getDisplayTitle(
  title?: string
) {
  if (
    title &&
    title.trim() &&
    title.trim().toLowerCase() !== 'untitled'
  ) {
    return title;
  }

  return 'Unannounced';
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
    reference.split('?')[0] ===
    candidate.split('?')[0]
  );
}

function getValidatedHighResolutionCover(
  referenceCoverUrl:
    string | undefined,
  imageLinks:
    | GoogleBook['volumeInfo']['imageLinks']
    | undefined
) {
  const reference =
    secureGoogleBooksImageUrl(
      referenceCoverUrl
    ) ||
    secureGoogleBooksImageUrl(
      imageLinks?.thumbnail
    ) ||
    secureGoogleBooksImageUrl(
      imageLinks?.smallThumbnail
    );

  if (!reference) {
    return (
      secureGoogleBooksImageUrl(
        imageLinks?.extraLarge
      ) ||
      secureGoogleBooksImageUrl(
        imageLinks?.large
      ) ||
      secureGoogleBooksImageUrl(
        imageLinks?.medium
      ) ||
      secureGoogleBooksImageUrl(
        imageLinks?.small
      )
    );
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
        Boolean(candidate)
    );

  const matchingCandidate =
    higherResolutionCandidates.find(
      (candidate) =>
        isSameGoogleBooksCover(
          reference,
          candidate
        )
    );

  return (
    matchingCandidate ||
    reference
  );
}

export default function BookDetailsScreen() {
  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const router = useRouter();

  const {
    id,
    source,
    coverUrl: discoverCoverUrl,
    clickedTitle,
    clickedAuthors,
    clickedIsbn,
    canonicalizeWork,
    trustedCover,
  } = useLocalSearchParams<{
    id: string;
    source?: string;
    coverUrl?: string;
    clickedTitle?: string;
    clickedAuthors?: string;
    clickedIsbn?: string;
    canonicalizeWork?: string;
    trustedCover?: string;
  }>();

  const discoverClickedAuthors =
    (() => {
      if (!clickedAuthors) {
        return [] as string[];
      }

      try {
        const parsed =
          JSON.parse(
            clickedAuthors
          );

        return Array.isArray(
          parsed
        )
          ? parsed.filter(
              (
                author
              ): author is string =>
                typeof author ===
                'string'
            )
          : [];
      } catch {
        return [];
      }
    })();

  const [book, setBook] = useState<GoogleBook | null>(null);
  const [
    selectedWorkCoverUrl,
    setSelectedWorkCoverUrl,
  ] =
    useState<string | null>(
      null
    );
  const [
    seriesWorkCoverUrl,
    setSeriesWorkCoverUrl,
  ] =
    useState<string | null>(
      null
    );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [descriptionExpanded, setDescriptionExpanded] =
    useState(false);
  const [readingStatus, setReadingStatus] =
    useState<UserBookStatus | null>(null);
  const [savedBook, setSavedBook] =
    useState<UserBook | null>(null);
  const [dateEditorVisible, setDateEditorVisible] =
    useState(false);
  const [startedDateInput, setStartedDateInput] =
    useState('');
  const [endedDateInput, setEndedDateInput] =
    useState('');
  const [savingDates, setSavingDates] =
    useState(false);
  const [savingStatus, setSavingStatus] =
    useState<UserBookStatus | null>(null);
  const [removingBook, setRemovingBook] =
    useState(false);
  const [savingOwned, setSavingOwned] =
    useState(false);
  const [series, setSeries] =
    useState<HardcoverSeries | null>(null);
  const [seriesBooks, setSeriesBooks] =
    useState<HardcoverSeriesBook[]>([]);
  const [seriesLoading, setSeriesLoading] =
    useState(false);
  const [seriesExpanded, setSeriesExpanded] =
    useState(false);
  const [openingSeriesBookId, setOpeningSeriesBookId] =
    useState<number | null>(null);

  const [
    hardcoverRating,
    setHardcoverRating,
  ] =
    useState<
      number | null
    >(null);

  const [
    hardcoverRatingsCount,
    setHardcoverRatingsCount,
  ] =
    useState<
      number | null
    >(null);

  const [
    hardcoverRatingLoading,
    setHardcoverRatingLoading,
  ] =
    useState(false);

  const [
    inBookCart,
    setInBookCart,
  ] =
    useState(false);

  const [
    bookCartBusy,
    setBookCartBusy,
  ] =
    useState(false);

  const [
    communityReviews,
    setCommunityReviews,
  ] =
    useState<
      CommunityBookReview[]
    >([]);

  const [
    communityReviewsLoading,
    setCommunityReviewsLoading,
  ] =
    useState(false);

  const [
    expandedCommunityReviewIds,
    setExpandedCommunityReviewIds,
  ] =
    useState<
      string[]
    >([]);

  const isSharedBookContext =
    source === 'shared';

  const isSavedBookContext =
    source === 'library' ||
    source === 'profile' ||
    (
      isSharedBookContext &&
      Boolean(
        savedBook
      )
    );

  const backLabel =
    source === 'library'
      ? 'Library'
      : source === 'currently-reading'
      ? 'Currently Reading'
      : source === 'profile'
      ? 'Profile'
      : source === 'cart'
      ? 'Book Cart'
      : source === 'discover'
      ? 'Discover'
      : source === 'author'
      ? 'Author'
      : isSharedBookContext
      ? savedBook
        ? 'Library'
        : 'Discover'
      : 'Back';

  function openAuthorPage(
    authorName: string
  ) {
    if (
      !book
    ) {
      return;
    }

    router.push({
      pathname:
        '/author/[name]',
      params: {
        name:
          authorName,
        currentBookId:
          book.id,
        currentTitle:
          book.volumeInfo
            .title ??
          '',
      },
    });
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (source === 'library') {
      router.replace('/(tabs)/library');
      return;
    }

    if (source === 'currently-reading') {
      router.replace('/currently-reading');
      return;
    }

    if (source === 'profile') {
      router.replace('/(tabs)/profile');
      return;
    }

    if (source === 'cart') {
      router.replace('/book-cart');
      return;
    }

    if (source === 'discover') {
      router.replace('/(tabs)/discover');
      return;
    }

    if (source === 'author') {
      router.replace('/(tabs)/discover');
      return;
    }

    if (source === 'shared') {
      router.replace(
        savedBook
          ? '/(tabs)/library'
          : '/(tabs)/discover'
      );
      return;
    }

    router.replace('/(tabs)/discover');
  }

  useEffect(() => {
    async function loadBook() {
      if (!id) {
        return;
      }

      try {
        setLoading(true);
        setError('');
        setSelectedWorkCoverUrl(
          null
        );
        setSeriesWorkCoverUrl(
          null
        );
        setSeries(null);
        setSeriesBooks([]);
        setSeriesExpanded(false);

        try {
          const existingSavedBook =
            await getUserBook(
              id
            );

          setSavedBook(
            existingSavedBook
          );
          setReadingStatus(
            existingSavedBook
              ?.status ??
            null
          );
        } catch (
          savedLookupError
        ) {
          console.warn(
            'Could not check saved book status:',
            savedLookupError
          );
        }

        const response =
          await fetchGoogleBooksJson<
            GoogleBook
          >(
            `https://www.googleapis.com/books/v1/volumes/${id}`
          );

        if (
          !response.ok ||
          !response.data
        ) {
          throw new Error(
            `Google Books request failed: ${response.status}`
          );
        }

        const data =
          response.data;

        const shouldCanonicalizeWork =
          canonicalizeWork ===
            '1';

        const resolvedBook =
          shouldCanonicalizeWork
            ? await resolveClickedDiscoverBook(
                data,
                clickedTitle,
                discoverClickedAuthors,
                clickedIsbn,
                true
              )
            : source ===
                'discover'
              ? await resolveClickedDiscoverBook(
                  data,
                  clickedTitle,
                  discoverClickedAuthors,
                  clickedIsbn,
                  false
                )
              : data;

        if (!resolvedBook) {
          throw new Error(
            'Google Books returned conflicting metadata for this search result. Please choose another edition.'
          );
        }

        setBook(
          resolvedBook
        );

        let verifiedWorkCoverUrl:
          string | null =
          null;

        if (
          source ===
            'discover'
        ) {
          try {
            const {
              data:
                coverSelectionData,
              error:
                coverSelectionError,
            } =
              await supabase.functions.invoke(
                'book-cover-selection',
                {
                  body: {
                    volumeId:
                      resolvedBook.id,
                  },
                }
              );

            if (
              coverSelectionError
            ) {
              console.warn(
                'Could not load verified Novori work cover:',
                coverSelectionError
              );
            } else {
              const selection =
                coverSelectionData as
                  | {
                      ok?: boolean;
                      data?: {
                        locked?: boolean;
                        authoritative?: boolean;
                        url?:
                          | string
                          | null;
                      };
                    }
                  | null;

              const selectedUrl =
                selection?.ok ===
                  true &&
                selection.data
                  ?.locked ===
                  true &&
                selection.data
                  ?.authoritative ===
                  true &&
                typeof selection.data
                  ?.url ===
                  'string'
                  ? selection.data.url
                      .trim()
                  : '';

              if (
                selectedUrl
              ) {
                verifiedWorkCoverUrl =
                  selectedUrl
                    .replace(
                      'http://',
                      'https://'
                    );

                setSelectedWorkCoverUrl(
                  verifiedWorkCoverUrl
                );
              }
            }
          } catch (
            coverSelectionError
          ) {
            console.warn(
              'Could not load verified Novori work cover:',
              coverSelectionError
            );
          }
        }

        // Resolve series identity before revealing Discover details.
        // This does not add another Hardcover request; it moves the existing
        // series lookup earlier so a verified series cover can participate in
        // the first visible paint.
        const discoveredSeriesCoverUrl =
          source ===
            'discover'
            ? await loadSeries(
                resolvedBook
              )
            : null;

        if (
          source ===
            'discover'
        ) {
          const trustedIncomingCover =
            trustedCover ===
              '1'
              ? discoverCoverUrl ??
                null
              : null;

          let finalDiscoverCover =
            verifiedWorkCoverUrl ??
            trustedIncomingCover ??
            discoveredSeriesCoverUrl ??
            null;

          if (
            !finalDiscoverCover
          ) {
            finalDiscoverCover =
              await resolveBookCoverUrl({
                imageLinks:
                  resolvedBook
                    .volumeInfo
                    .imageLinks,
                isbn:
                  getBookISBN(
                    resolvedBook
                  ) ??
                  null,
                existingCoverUrl:
                  discoverCoverUrl ??
                  null,
              });
          }

          if (
            finalDiscoverCover
          ) {
            setSelectedWorkCoverUrl(
              finalDiscoverCover
            );
          }
        }

        // The first visible Discover paint now uses the already-resolved cover
        // instead of showing one image and swapping it after mount.
        setLoading(
          false
        );

        try {
          const cartItem =
            await getBookCartItem(
              resolvedBook.id
            );

          setInBookCart(
            Boolean(
              cartItem
            )
          );
        } catch (
          cartError
        ) {
          console.error(
            'Could not load Book Cart status:',
            cartError
          );

          setInBookCart(
            false
          );
        }

        setHardcoverRatingLoading(
          true
        );

        try {
          const resolvedRating =
            await resolveHardcoverRating({
              googleBookId:
                resolvedBook.id,
              title:
                resolvedBook.volumeInfo
                  .title ??
                clickedTitle ??
                '',
              authors:
                resolvedBook.volumeInfo
                  .authors ??
                discoverClickedAuthors,
              isbns:
                (
                  resolvedBook.volumeInfo
                    .industryIdentifiers ??
                  []
                ).map(
                  (
                    identifier
                  ) =>
                    identifier.identifier
                ),
              allowGoogleLookup:
                false,
            });

          setHardcoverRating(
            resolvedRating?.rating ??
            null
          );

          setHardcoverRatingsCount(
            resolvedRating?.ratingsCount ??
            null
          );
        } catch (
          ratingError
        ) {
          console.error(
            'Could not load Hardcover rating:',
            ratingError
          );

          setHardcoverRating(
            null
          );

          setHardcoverRatingsCount(
            null
          );
        } finally {
          setHardcoverRatingLoading(
            false
          );
        }

        setCommunityReviewsLoading(
          true
        );

        try {
          const reviews =
            await getCommunityBookReviews(
              resolvedBook.id,
              resolvedBook.volumeInfo
                .title,
              30
            );

          setCommunityReviews(
            reviews
          );
        } catch (
          reviewError
        ) {
          console.error(
            'Could not load community reviews:',
            reviewError
          );

          setCommunityReviews(
            []
          );
        } finally {
          setCommunityReviewsLoading(
            false
          );
        }

        try {
          const savedBook = await getUserBook(
            resolvedBook.id
          );
          setSavedBook(savedBook);
          setReadingStatus(savedBook?.status ?? null);
        } catch (statusError) {
          console.error(
            'Could not load saved reading status:',
            statusError
          );
          setSavedBook(null);
          setReadingStatus(null);
        }

        if (
          source !==
            'discover'
        ) {
          await loadSeries(
            resolvedBook
          );
        }

      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Could not load this book.';

        if (
          message.includes(
            'Google Books request failed: 429'
          )
        ) {
          console.warn(
            'Google Books is temporarily rate-limiting Novori.'
          );
          setError(
            'Google Books is temporarily unavailable. Please try again shortly.'
          );
        } else {
          console.error(
            'Book loading error:',
            err
          );
          setError(
            message
          );
        }
      } finally {
        setLoading(false);
      }
    }

    loadBook();
  }, [
    id,
    source,
    clickedTitle,
    clickedAuthors,
    clickedIsbn,
    canonicalizeWork,
    trustedCover,
  ]);

  useFocusEffect(
    useCallback(
      () => {
        if (
          !id ||
          !isSavedBookContext
        ) {
          return;
        }

        let active =
          true;

        void getUserBook(
          id
        )
          .then(
            (
              refreshedBook
            ) => {
              if (
                !active
              ) {
                return;
              }

              setSavedBook(
                refreshedBook
              );
              setReadingStatus(
                refreshedBook
                  ?.status ??
                  null
              );
            }
          )
          .catch(
            (
              refreshError
            ) => {
              console.error(
                'Could not refresh saved review:',
                refreshError
              );
            }
          );

        return () => {
          active =
            false;
        };
      },
      [
        id,
        source,
        isSavedBookContext,
      ]
    )
  );

  async function shareCurrentBook() {
    if (!book) {
      return;
    }

    try {
      await shareBookLink({
        googleBookId:
          book.id,
        title:
          book.volumeInfo.title,
      });
    } catch (
      shareError
    ) {
      console.error(
        'Could not share book:',
        shareError
      );

      Alert.alert(
        'Could not share book',
        'Please try again.'
      );
    }
  }

  function openReadingDetails() {
    if (
      !savedBook ||
      !savedBook.status ||
      savedBook.status ===
        'want_to_read'
    ) {
      return;
    }

    router.push({
      pathname:
        '/reading-details/[id]',
      params: {
        id:
          savedBook.google_book_id,
      },
    });
  }

  async function startSavedReadingJourney() {
    if (
      !savedBook ||
      savedBook.status !==
        'want_to_read' ||
      savingStatus
    ) {
      return;
    }

    try {
      setSavingStatus(
        'reading'
      );

      const session =
        await transitionReadingJourney(
          savedBook.google_book_id,
          'start'
        );

      const updatedBook:
        UserBook = {
          ...savedBook,
          status:
            'reading',
          started_at:
            session.started_at,
          finished_at:
            null,
          dnf_at:
            null,
          updated_at:
            new Date()
              .toISOString(),
        };

      setSavedBook(
        updatedBook
      );

      setReadingStatus(
        'reading'
      );

      router.push({
        pathname:
          '/reading-details/[id]',
        params: {
          id:
            updatedBook.google_book_id,
        },
      });
    } catch (
      startError
    ) {
      console.error(
        'Could not start reading journey:',
        startError
      );

      Alert.alert(
        'Could not start reading',
        startError instanceof
          Error
          ? startError.message
          : 'Novori had trouble starting this reading journey. Please try again.'
      );
    } finally {
      setSavingStatus(
        null
      );
    }
  }

  function openRateReview() {
    if (
      !savedBook ||
      (
        savedBook.status !==
          'read' &&
        savedBook.status !==
          'dnf'
      )
    ) {
      return;
    }

    router.push({
      pathname:
        '/rate-review',
      params: {
        googleBookId:
          savedBook.google_book_id,
      },
    });
  }

  function shareSavedReview() {
    if (
      !savedBook ||
      savedBook.status !==
        'read' ||
      !savedBook.review_text
        ?.trim()
    ) {
      return;
    }

    router.push({
      pathname:
        '/create-review',
      params: {
        bookId:
          savedBook.google_book_id,
        rating:
          savedBook.rating !==
          null
            ? String(
                savedBook.rating
              )
            : '',
        review:
          savedBook.review_text
            .trim(),
      },
    });
  }

  async function toggleBookCart() {
    if (
      !book ||
      bookCartBusy
    ) {
      return;
    }

    const info =
      book.volumeInfo;

    const coverUrl =
      getValidatedHighResolutionCover(
        source ===
          'discover'
          ? selectedWorkCoverUrl ??
            discoverCoverUrl
          : savedBook
              ?.cover_url ??
            undefined,
        info.imageLinks
      ) ??
      null;

    try {
      setBookCartBusy(
        true
      );

      if (
        inBookCart
      ) {
        await removeBookFromCart(
          book.id
        );

        setInBookCart(
          false
        );
      } else {
        await addBookToCart({
          googleBookId:
            book.id,
          title:
            info.title ??
            'Untitled',
          authors:
            info.authors ??
            [],
          coverUrl,
          isbn:
            getBookISBN(
              book
            ) ??
            null,
        });

        setInBookCart(
          true
        );
      }
    } catch (
      cartError
    ) {
      console.error(
        'Could not update Book Cart:',
        cartError
      );

      Alert.alert(
        'Book Cart',
        'Novori could not update your Book Cart. Please try again.'
      );
    } finally {
      setBookCartBusy(
        false
      );
    }
  }

  async function loadSeries(
    currentBook: GoogleBook
  ) {
    const exactIsbn =
      getBookISBN(
        currentBook
      );

    const isbns =
      Array.from(
        new Set(
          (
            currentBook
              .volumeInfo
              .industryIdentifiers ??
            []
          )
            .map(
              (
                identifier
              ) =>
                identifier.identifier
            )
            .filter(Boolean)
        )
      );

    const title =
      currentBook.volumeInfo
        .title ??
      '';

    const authors =
      currentBook.volumeInfo
        .authors ??
      [];

    if (
      isbns.length ===
        0 &&
      !title
    ) {
      return null;
    }

    try {
      setSeriesLoading(true);
      setSeries(null);
      setSeriesBooks([]);

      const {
        data,
        error:
          functionError,
      } =
        await supabase.functions.invoke(
          'hardcover-series',
          {
            body: {
              isbn:
                exactIsbn ??
                isbns[0] ??
                null,
              isbns,
              title,
              authors,
            },
          }
        );

      if (
        functionError
      ) {
        setSeries(null);
        setSeriesBooks([]);
        return null;
      }

      const response =
        data as
          HardcoverSeriesResponse;

      if (
        response.error
      ) {
        setSeries(null);
        setSeriesBooks([]);
        return null;
      }

      const resolvedSeries =
        response.series ??
          null;

      const resolvedSeriesBooks =
        response.books ??
          [];

      setSeries(
        resolvedSeries
      );
      setSeriesBooks(
        resolvedSeriesBooks
      );

      const currentSeriesBook =
        resolvedSeries
          ?.currentPosition !==
            null &&
        resolvedSeries
          ?.currentPosition !==
            undefined
          ? resolvedSeriesBooks.find(
              (
                seriesBook
              ) =>
                seriesBook.position ===
                resolvedSeries
                  .currentPosition
            )
          : null;

      const seriesCoverUrl =
        secureGoogleBooksImageUrl(
          currentSeriesBook
            ?.imageUrl ??
            undefined
        ) ??
        null;

      if (
        seriesCoverUrl
      ) {
        setSeriesWorkCoverUrl(
          seriesCoverUrl
        );
      }

      return seriesCoverUrl;
    } catch {
      setSeries(null);
      setSeriesBooks([]);
      return null;
    } finally {
      setSeriesLoading(false);
    }
  }

  async function findGoogleBookForSeries(
    seriesBook: HardcoverSeriesBook
  ): Promise<GoogleBook | null> {
    const author =
      seriesBook.authors?.[0];

    const wantedTitle =
      normalizeSeriesWorkTitle(
        seriesBook.title
      );

    const wantedIsbns =
      (
        seriesBook.isbns ??
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
        .filter(Boolean);

    const normalizedAuthor =
      normalizeAuthorName(
        author
      );


    type RankedSeriesCandidate = {
      result: GoogleBook;
      exactTitle: boolean;
      titleMatches: boolean;
      authorMatches: boolean;
      isbnMatches: boolean;
      hasPages: boolean;
      hasCover: boolean;
      score: number;
    };

    function rankResults(
      results: GoogleBook[]
    ): RankedSeriesCandidate[] {
      return results
        .map(
          (
            result
          ): RankedSeriesCandidate => {
            const resultTitle =
              normalizeSeriesWorkTitle(
                result.volumeInfo
                  .title
              );

            const exactTitle =
              resultTitle ===
                wantedTitle;

            const titleMatches =
              exactTitle ||
              resultTitle.includes(
                wantedTitle
              ) ||
              wantedTitle.includes(
                resultTitle
              );

            const resultAuthors =
              result.volumeInfo
                .authors ??
              [];

            const authorMatches =
              !author ||
              resultAuthors.some(
                (
                  resultAuthor
                ) => {
                  const normalizedResultAuthor =
                    normalizeAuthorName(
                      resultAuthor
                    );

                  return (
                    normalizedResultAuthor ===
                      normalizedAuthor ||
                    normalizedResultAuthor.includes(
                      normalizedAuthor
                    ) ||
                    normalizedAuthor.includes(
                      normalizedResultAuthor
                    )
                  );
                }
              );

            const resultIsbns =
              (
                result.volumeInfo
                  .industryIdentifiers ??
                []
              )
                .map(
                  (
                    identifier
                  ) =>
                    identifier.identifier
                      .replace(
                        /[^0-9Xx]/g,
                        ''
                      )
                      .toUpperCase()
                )
                .filter(Boolean);

            const isbnMatches =
              wantedIsbns.some(
                (
                  wanted
                ) =>
                  resultIsbns.includes(
                    wanted
                  )
              );

            const cover =
              getValidatedHighResolutionCover(
                undefined,
                result.volumeInfo
                  .imageLinks
              );

            const hasPages =
              typeof result
                .volumeInfo
                .pageCount ===
                'number' &&
              result.volumeInfo
                .pageCount >
                0;

            let score = 0;

            if (
              exactTitle
            ) {
              score += 400;
            } else if (
              titleMatches
            ) {
              score += 220;
            }

            if (
              authorMatches
            ) {
              score += 180;
            }

            if (
              isbnMatches
            ) {
              score += 180;
            }

            if (
              cover
            ) {
              score += 160;
            }

            if (
              hasPages
            ) {
              score += 160;
            }

            return {
              result,
              exactTitle,
              titleMatches,
              authorMatches,
              isbnMatches,
              hasPages,
              hasCover:
                Boolean(
                  cover
                ),
              score,
            };
          }
        )
        .filter(
          (
            candidate
          ) =>
            candidate
              .titleMatches &&
            (
              candidate
                .authorMatches ||
              candidate
                .isbnMatches
            )
        )
        .sort(
          (
            a,
            b
          ) =>
            b.score -
              a.score ||
            Number(
              b.hasCover
            ) -
              Number(
                a.hasCover
              ) ||
            Number(
              b.hasPages
            ) -
              Number(
                a.hasPages
              ) ||
            Number(
              b.isbnMatches
            ) -
              Number(
                a.isbnMatches
              )
        );
    }

    try {
      const identity =
        await resolveGoogleBooksIdentity({
          title:
            seriesBook.title,
          author,
          isbn:
            wantedIsbns[0],
        });

      if (
        identity.ok &&
        identity.googleBookId
      ) {
        const detail =
          await fetchGoogleBooksJson<
            GoogleBook
          >(
            `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(
              identity.googleBookId
            )}`
          );

        if (
          detail.ok &&
          detail.data
        ) {
          const [
            identityCandidate,
          ] =
            rankResults([
              detail.data,
            ]);

          if (
            identityCandidate &&
            (
              identityCandidate
                .isbnMatches ||
              (
                identityCandidate
                  .exactTitle &&
                identityCandidate
                  .authorMatches
              )
            )
          ) {
            return detail.data;
          }
        }
      }

      if (
        identity.status ===
          429
      ) {
        return null;
      }
    } catch {
      // Fall through to the progressive series searches.
    }

    const queries =
      [
        ...wantedIsbns.map(
          (
            isbn
          ) => ({
            kind:
              'isbn' as const,
            query:
              `isbn:${isbn}`,
          })
        ),
        ...(author
          ? [
              {
                kind:
                  'titleAuthor' as const,
                query:
                  `intitle:"${seriesBook.title}" inauthor:"${author}"`,
              },
            ]
          : []),
        {
          kind:
            'title' as const,
          query:
            `intitle:"${seriesBook.title}"`,
        },
        {
          kind:
            'broad' as const,
          query:
            seriesBook.title,
        },
      ].filter(
        (
          entry,
          index,
          all
        ) =>
          all.findIndex(
            (
              candidate
            ) =>
              candidate.query ===
              entry.query
          ) === index
      );

    let bestFallback:
      RankedSeriesCandidate | null =
      null;

    for (
      const {
        kind,
        query,
      } of queries
    ) {
      try {
        const response =
          await fetchGoogleBooksJson<
            GoogleSearchResponse
          >(
            `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
              query
            )}&maxResults=40&printType=books&projection=full`
          );

        if (
          !response.ok ||
          !response.data
        ) {
          continue;
        }

        const candidates =
          rankResults(
            response.data.items ??
              []
          );

        const best =
          candidates[0];

        if (!best) {
          continue;
        }

        if (
          !bestFallback ||
          best.score >
            bestFallback.score
        ) {
          bestFallback =
            best;
        }

        if (
          kind ===
            'isbn' &&
          best.isbnMatches
        ) {
          return best.result;
        }

        if (
          kind ===
            'titleAuthor' &&
          best.authorMatches &&
          (
            best.exactTitle ||
            best.isbnMatches
          )
        ) {
          return best.result;
        }

        if (
          kind ===
            'title' &&
          best.exactTitle &&
          best.authorMatches
        ) {
          return best.result;
        }

        if (
          kind ===
            'broad'
        ) {
          return best.result;
        }
      } catch {
        // Try the next increasingly broad query.
      }
    }

    return (
      bestFallback
        ?.result ??
      null
    );
  }

  async function saveReadingStatus(
    status: UserBookStatus
  ) {
    if (!book || savingStatus) {
      return;
    }

    const info = book.volumeInfo;

    const coverUrl =
      await resolveBookCoverUrl({
        imageLinks:
          info.imageLinks,
        isbn:
          getBookISBN(
            book
          ) ??
          null,
        existingCoverUrl:
          source ===
            'discover'
            ? selectedWorkCoverUrl ??
              discoverCoverUrl
            : savedBook
                ?.cover_url ??
              null,
      });

    try {
      setSavingStatus(status);

      const updatedBook =
        await saveUserBook({
          googleBookId: book.id,
          title: info.title ?? 'Untitled',
          authors: info.authors ?? [],
          coverUrl,
          isbn: getBookISBN(book) ?? null,
          publishedDate: info.publishedDate ?? null,
          status,
        });

      setSavedBook(updatedBook);
      setReadingStatus(updatedBook.status);

      if (
        status === 'read' ||
        status === 'dnf'
      ) {
        router.push({
          pathname: '/rate-review',
          params: {
            googleBookId: book.id,
          },
        });
      }
    } catch (saveError) {
      console.error(
        'Could not save book status:',
        saveError
      );

      Alert.alert(
        'Could not save book',
        'Novori had trouble updating your library. Please try again.'
      );
    } finally {
      setSavingStatus(null);
    }
  }

  async function toggleOwned() {
    if (
      !book ||
      savingOwned
    ) {
      return;
    }

    const info =
      book.volumeInfo;

    try {
      setSavingOwned(
        true
      );

      let updatedBook:
        UserBook;

      if (
        savedBook
      ) {
        updatedBook =
          await updateUserBookOwned(
            book.id,
            !savedBook.owned
          );
      } else {
        const coverUrl =
          await resolveBookCoverUrl({
            imageLinks:
              info.imageLinks,
            isbn:
              getBookISBN(
                book
              ) ??
              null,
            existingCoverUrl:
              source ===
                'discover'
                ? selectedWorkCoverUrl ??
                  discoverCoverUrl
                : null,
          });

        updatedBook =
          await saveUserBook({
            googleBookId:
              book.id,
            title:
              info.title ??
              'Untitled',
            authors:
              info.authors ??
              [],
            coverUrl,
            isbn:
              getBookISBN(
                book
              ) ??
              null,
            publishedDate:
              info.publishedDate ??
              null,
            status:
              null,
            owned:
              true,
          });
      }

      setSavedBook(
        updatedBook
      );
      setReadingStatus(
        updatedBook.status
      );

      if (
        updatedBook.owned &&
        inBookCart
      ) {
        try {
          await removeBookFromCart(
            book.id
          );
          setInBookCart(
            false
          );
        } catch (
          cartError
        ) {
          console.warn(
            'Could not remove owned book from Book Cart:',
            cartError
          );
        }
      }
    } catch (
      ownedError
    ) {
      console.error(
        'Could not update book ownership:',
        ownedError
      );

      Alert.alert(
        'Could not update ownership',
        'Please try again.'
      );
    } finally {
      setSavingOwned(
        false
      );
    }
  }

  function confirmRemoveFromLibrary() {
    if (
      !book ||
      savingStatus ||
      removingBook
    ) {
      return;
    }

    const hasReadingDetails =
      Boolean(
        savedBook?.status &&
        savedBook.status !==
          'want_to_read'
      );

    const removalMessage =
      hasReadingDetails
        ? `Remove ${book.volumeInfo.title ?? 'this book'} from your Novori library? This permanently deletes its private Reading Details — including summary, notes, and checkpoints — along with its saved rating and review.`
        : `Remove ${book.volumeInfo.title ?? 'this book'} from your Novori library? This will also remove its saved rating and review.`;

    Alert.alert(
      'Remove from Library?',
      removalMessage,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: removeFromLibrary,
        },
      ]
    );
  }

  async function removeFromLibrary() {
    if (
      !book ||
      removingBook
    ) {
      return;
    }

    try {
      setRemovingBook(true);

      await removeUserBook(
        book.id
      );

      setSavedBook(null);
      setReadingStatus(null);
    } catch (removeError) {
      console.error(
        'Could not remove book from library:',
        removeError
      );

      Alert.alert(
        'Could not remove book',
        'Novori had trouble removing this book from your library. Please try again.'
      );
    } finally {
      setRemovingBook(false);
    }
  }

  function openReadingDateEditor() {
    if (
      !savedBook ||
      !savedBook.status ||
      savedBook.status ===
        'want_to_read'
    ) {
      return;
    }

    setStartedDateInput(
      dateInputFromIso(
        savedBook.started_at
      )
    );

    if (
      savedBook.status ===
      'read'
    ) {
      setEndedDateInput(
        dateInputFromIso(
          savedBook.finished_at
        )
      );
    } else if (
      savedBook.status ===
      'dnf'
    ) {
      setEndedDateInput(
        dateInputFromIso(
          savedBook.dnf_at
        )
      );
    } else {
      setEndedDateInput(
        ''
      );
    }

    setDateEditorVisible(
      true
    );
  }

  function closeReadingDateEditor() {
    if (savingDates) {
      return;
    }

    setDateEditorVisible(
      false
    );
  }

  async function saveReadingDates() {
    if (
      !book ||
      !savedBook ||
      savingDates
    ) {
      return;
    }

    try {
      const startedAt =
        parseDateInput(
          startedDateInput
        );

      let finishedAt =
        savedBook.finished_at;

      let dnfAt =
        savedBook.dnf_at;

      if (
        savedBook.status ===
        'reading'
      ) {
        finishedAt =
          null;
        dnfAt =
          null;
      }

      if (
        savedBook.status ===
        'read'
      ) {
        finishedAt =
          parseDateInput(
            endedDateInput
          );

        if (!finishedAt) {
          throw new Error(
            'A finished date is required for a book marked Read.'
          );
        }

        dnfAt =
          null;
      }

      if (
        savedBook.status ===
        'dnf'
      ) {
        dnfAt =
          parseDateInput(
            endedDateInput
          );

        if (!dnfAt) {
          throw new Error(
            'A stopped date is required for a DNF book.'
          );
        }

        finishedAt =
          null;
      }

      const endDate =
        savedBook.status ===
        'read'
          ? finishedAt
          : savedBook.status ===
            'dnf'
          ? dnfAt
          : null;

      if (
        startedAt &&
        endDate &&
        new Date(endDate).getTime() <
          new Date(startedAt).getTime()
      ) {
        throw new Error(
          'The ending date cannot be before the started date.'
        );
      }

      setSavingDates(
        true
      );

      const updatedBook =
        await updateBookReadingDates({
          googleBookId:
            book.id,
          startedAt,
          finishedAt,
          dnfAt,
        });

      setSavedBook(
        updatedBook
      );

      setDateEditorVisible(
        false
      );
    } catch (dateError) {
      const message =
        dateError instanceof Error
          ? dateError.message
          : 'Novori could not update these dates.';

      Alert.alert(
        'Check reading dates',
        message
      );
    } finally {
      setSavingDates(
        false
      );
    }
  }

  async function openSeriesBook(
    seriesBook: HardcoverSeriesBook
  ) {
    if (
      series?.currentPosition ===
        seriesBook.position
    ) {
      return;
    }

    const displayTitle =
      getDisplayTitle(
        seriesBook.title
      );

    if (
      displayTitle ===
        'Unannounced'
    ) {
      Alert.alert(
        displayTitle,
        'This book does not have a usable title yet.'
      );
      return;
    }

    try {
      setOpeningSeriesBookId(
        seriesBook.id
      );

      const resolved =
        await findGoogleBookForSeries(
          seriesBook
        );

      if (
        !resolved
      ) {
        Alert.alert(
          'Book not found',
          'Novori could not find this book in Google Books yet.'
        );
        return;
      }

      const resolvedCover =
        resolved.novoriWork
          ?.canonicalCoverUrl ??
        secureGoogleBooksImageUrl(
          seriesBook.imageUrl
        ) ??
        getValidatedHighResolutionCover(
          undefined,
          resolved.volumeInfo
            .imageLinks
        ) ??
        undefined;

      router.push({
        pathname:
          '/book/[id]',
        params: {
          id:
            resolved.id,
          ...(source
            ? {
                source,
              }
            : {}),
          ...(resolvedCover
            ? {
                coverUrl:
                  resolvedCover,
                trustedCover:
                  '1',
              }
            : {}),
          canonicalizeWork:
            '1',
          clickedTitle:
            resolved.volumeInfo
              .title ??
            seriesBook.title,
          clickedAuthors:
            JSON.stringify(
              resolved.volumeInfo
                .authors ??
              seriesBook.authors ??
              []
            ),
          ...(getBookISBN(
            resolved
          )
            ? {
                clickedIsbn:
                  getBookISBN(
                    resolved
                  ),
              }
            : {}),
        },
      });
    } catch (err) {
      console.error(
        'Could not open series book:',
        err
      );

      Alert.alert(
        'Could not open book',
        'Novori had trouble finding this book. Please try again.'
      );
    } finally {
      setOpeningSeriesBookId(
        null
      );
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.gold} />
        <Text style={styles.loadingText}>Opening book...</Text>
      </View>
    );
  }

  if (error || !book) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>
          {error || 'Book not found.'}
        </Text>

        <Pressable
          style={styles.backButtonLarge}
          onPress={handleBack}
        >
          <Text style={styles.backButtonLargeText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const info = book.volumeInfo;

  const isCanonicalWorkPage =
    canonicalizeWork ===
      '1';

  const exactRouteCoverUrl =
    googleBooksCoverMatchesVolume(
      discoverCoverUrl,
      book.id
    )
      ? discoverCoverUrl
      : null;

  const trustedRouteCoverUrl =
    trustedCover ===
      '1'
      ? discoverCoverUrl ??
        null
      : null;

  const canonicalRouteCoverUrl =
    trustedRouteCoverUrl ??
    exactRouteCoverUrl ??
    discoverCoverUrl ??
    null;

  const displayExistingCoverUrl =
    selectedWorkCoverUrl ??
    savedBook?.cover_url ??
    trustedRouteCoverUrl ??
    seriesWorkCoverUrl ??
    (
      isCanonicalWorkPage
        ? canonicalRouteCoverUrl
        : discoverCoverUrl ??
          null
    );

  const preferExistingCover =
    Boolean(
      selectedWorkCoverUrl ||
      savedBook?.cover_url ||
      trustedRouteCoverUrl
    );

  const coverPlan =
    getBookCoverPlan({
      imageLinks:
        info.imageLinks,
      isbn:
        getBookISBN(
          book
        ) ??
        null,
      existingCoverUrl:
        displayExistingCoverUrl,
    });

  const cover =
    coverPlan.primaryUrl ??
    coverPlan.fallbackUrl;

  const categories =
    info.categories
      ?.slice(0, 2)
      .join(' • ');

  const publishedDate =
    formatPublishedDate(
      info.publishedDate
    );

  const description =
    cleanDescription(
      info.description
    );

  const statuses: {
    value: UserBookStatus;
    label: string;
    icon:
      keyof typeof Ionicons.glyphMap;
  }[] = [
    {
      value: 'want_to_read',
      label: 'TBR',
      icon: 'bookmark-outline',
    },
    {
      value: 'reading',
      label: 'Reading',
      icon: 'book-outline',
    },
    {
      value: 'read',
      label: 'Read',
      icon: 'checkmark-circle-outline',
    },
    {
      value: 'dnf',
      label: 'DNF',
      icon: 'close-circle-outline',
    },
  ];

  const selectedStatusLabel =
    statuses.find(
      (status) => status.value === readingStatus
    )?.label ?? null;

  const savedReadingPresentation =
    !savedBook?.status
      ? {
          title:
            'Choose a status',
          badge:
            null,
          icon:
            'library-outline' as keyof typeof Ionicons.glyphMap,
        }
      : savedBook.status ===
        'want_to_read'
      ? {
          title:
            'Ready when you are',
          badge:
            'TBR',
          icon:
            'bookmark-outline' as keyof typeof Ionicons.glyphMap,
        }
      : savedBook.status ===
        'reading'
      ? {
          title:
            'Currently reading',
          badge:
            'READING',
          icon:
            'book-outline' as keyof typeof Ionicons.glyphMap,
        }
      : savedBook.status ===
        'read'
      ? {
          title:
            'Journey complete',
          badge:
            'FINISHED',
          icon:
            'checkmark-circle-outline' as keyof typeof Ionicons.glyphMap,
        }
      : {
          title:
            'Reading stopped',
          badge:
            'DNF',
          icon:
            'close-circle-outline' as keyof typeof Ionicons.glyphMap,
        };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backButton}
          onPress={handleBack}
        >
          <Ionicons
            name="chevron-back"
            size={25}
            color={colors.text}
          />
          <Text style={styles.backText}>{backLabel}</Text>
        </Pressable>

        <Pressable
          onPress={() =>
            void shareCurrentBook()
          }
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Share book"
          style={({ pressed }) => [
            styles.shareBookButton,
            pressed &&
              styles.shareBookButtonPressed,
          ]}
        >
          <Ionicons
            name="share-social-outline"
            size={21}
            color={colors.gold}
          />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {isSavedBookContext ? (
          <>
            <View
              style={
                styles.libraryBookHero
              }
            >
            {cover ? (
              <BookCoverImage
                imageLinks={
                  info.imageLinks
                }
                isbn={
                  getBookISBN(
                    book
                  ) ??
                  null
                }
                existingCoverUrl={
                  displayExistingCoverUrl
                }
                preferExistingCover={
                  preferExistingCover
                }
                style={
                  styles.libraryBookCover
                }
                resizeMode="cover"
              />
            ) : (
              <View
                style={
                  styles.libraryBookCoverPlaceholder
                }
              >
                <Ionicons
                  name="book-outline"
                  size={34}
                  color={
                    colors.mutedText
                  }
                />
              </View>
            )}

            <View
              style={
                styles.libraryBookHeroCopy
              }
            >
              <Text
                style={
                  styles.libraryBookTitle
                }
                numberOfLines={
                  3
                }
              >
                {info.title ??
                  'Untitled'}
              </Text>

              <Text
                style={
                  styles.libraryBookAuthor
                }
                numberOfLines={
                  2
                }
              >
                {info.authors?.length
                  ? info.authors.map(
                      (
                        author,
                        index
                      ) => (
                        <Text
                          key={
                            author
                          }
                          onPress={() =>
                            openAuthorPage(
                              author
                            )
                          }
                          style={
                            styles.authorLink
                          }
                        >
                          {index >
                          0
                            ? ', '
                            : ''}
                          {author}
                        </Text>
                      )
                    )
                  : 'Unknown author'}
              </Text>

              <View
                style={[
                  styles.externalRatingRow,
                  styles.libraryExternalRatingRow,
                ]}
              >
                {hardcoverRatingLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.gold
                    }
                  />
                ) : hardcoverRating !==
                  null ? (
                  <>
                    <View
                      style={
                        styles.externalRatingStars
                      }
                    >
                      {[1,2,3,4,5].map(
                        (
                          star
                        ) => (
                          <Ionicons
                            key={
                              star
                            }
                            name={
                              hardcoverRating >=
                              star
                                ? 'star'
                                : hardcoverRating >=
                                  star -
                                    0.5
                                  ? 'star-half'
                                  : 'star-outline'
                            }
                            size={16}
                            color={
                              colors.gold
                            }
                          />
                        )
                      )}
                    </View>

                    <Text
                      style={
                        styles.externalRatingText
                      }
                    >
                      {hardcoverRating.toFixed(
                        2
                      )}
                      {hardcoverRatingsCount !==
                        null &&
                      hardcoverRatingsCount >
                        0
                        ? ` · ${hardcoverRatingsCount.toLocaleString()} ratings`
                        : ''}
                    </Text>
                  </>
                ) : null}
              </View>

              {series ? (
                <View
                  style={
                    styles.libraryHeroMetaRow
                  }
                >
                  <Text
                    style={
                      styles.librarySeriesMeta
                    }
                  >
                    {series.currentPosition
                      ? `Book ${series.currentPosition}`
                      : series.name}
                  </Text>
                </View>
              ) : null}


            </View>
          </View>

            <View
              style={
                styles.libraryOwnershipRow
              }
            >
              <Pressable
                onPress={() =>
                  void toggleOwned()
                }
                disabled={
                  savingOwned
                }
                style={({ pressed }) => [
                  styles.libraryCartButton,
                  savedBook?.owned &&
                    styles.bookCartButtonActive,
                  pressed &&
                    styles.bookCartButtonPressed,
                  savingOwned &&
                    styles.bookCartButtonDisabled,
                ]}
              >
                {savingOwned ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.gold
                    }
                  />
                ) : (
                  <Ionicons
                    name={
                      savedBook?.owned
                        ? 'checkmark-circle'
                        : 'checkmark-circle-outline'
                    }
                    size={16}
                    color={
                      colors.gold
                    }
                  />
                )}

                <Text
                  style={
                    styles.libraryCartButtonText
                  }
                  numberOfLines={
                    1
                  }
                >
                  {savedBook?.owned
                    ? 'Owned'
                    : 'Mark as Owned'}
                </Text>
              </Pressable>

              {!savedBook?.owned ? (
                <Pressable
                  onPress={() =>
                    void toggleBookCart()
                  }
                  disabled={
                    bookCartBusy
                  }
                  style={({ pressed }) => [
                    styles.libraryCartButton,
                    inBookCart &&
                      styles.bookCartButtonActive,
                    pressed &&
                      styles.bookCartButtonPressed,
                    bookCartBusy &&
                      styles.bookCartButtonDisabled,
                  ]}
                >
                  {bookCartBusy ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        colors.gold
                      }
                    />
                  ) : (
                    <Ionicons
                      name={
                        inBookCart
                          ? 'cart'
                          : 'cart-outline'
                      }
                      size={16}
                      color={
                        colors.gold
                      }
                    />
                  )}

                  <Text
                    style={
                      styles.libraryCartButtonText
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {inBookCart
                      ? 'In Book Cart'
                      : 'Add to Cart'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <View
            style={
              styles.hero
            }
          >
            {cover ? (
              <BookCoverImage
                imageLinks={
                  info.imageLinks
                }
                isbn={
                  getBookISBN(
                    book
                  ) ??
                  null
                }
                existingCoverUrl={
                  displayExistingCoverUrl
                }
                preferExistingCover={
                  preferExistingCover
                }
                style={
                  styles.cover
                }
                resizeMode="cover"
              />
            ) : (
              <View
                style={
                  styles.coverPlaceholder
                }
              >
                <Ionicons
                  name="book-outline"
                  size={44}
                  color={
                    colors.mutedText
                  }
                />
                <Text
                  style={
                    styles.noCoverText
                  }
                >
                  No Cover
                </Text>
              </View>
            )}

            <Text
              style={
                styles.title
              }
            >
              {info.title ??
                'Untitled'}
            </Text>

            {info.subtitle ? (
              <Text
                style={
                  styles.subtitle
                }
              >
                {info.subtitle}
              </Text>
            ) : null}

            <Text
              style={
                styles.author
              }
            >
              {info.authors?.length
                ? info.authors.map(
                    (
                      author,
                      index
                    ) => (
                      <Text
                        key={
                          author
                        }
                        onPress={() =>
                          openAuthorPage(
                            author
                          )
                        }
                        style={
                          styles.authorLink
                        }
                      >
                        {index >
                        0
                          ? ', '
                          : ''}
                        {author}
                      </Text>
                    )
                  )
                : 'Unknown author'}
            </Text>

            <View
              style={
                styles.externalRatingRow
              }
            >
              {hardcoverRatingLoading ? (
                <ActivityIndicator
                  size="small"
                  color={
                    colors.gold
                  }
                />
              ) : hardcoverRating !==
                null ? (
                <>
                  <View
                    style={
                      styles.externalRatingStars
                    }
                  >
                    {[1,2,3,4,5].map(
                      (
                        star
                      ) => (
                        <Ionicons
                          key={
                            star
                          }
                          name={
                            hardcoverRating >=
                            star
                              ? 'star'
                              : hardcoverRating >=
                                star -
                                  0.5
                                ? 'star-half'
                                : 'star-outline'
                          }
                          size={16}
                          color={
                            colors.gold
                          }
                        />
                      )
                    )}
                  </View>

                  <Text
                    style={
                      styles.externalRatingText
                    }
                  >
                    {hardcoverRating.toFixed(
                      2
                    )}
                    {hardcoverRatingsCount !==
                      null &&
                    hardcoverRatingsCount >
                      0
                      ? ` · ${hardcoverRatingsCount.toLocaleString()} ratings`
                      : ''}
                  </Text>
                </>
              ) : null}
            </View>

            <View
              style={
                styles.bookOwnershipRow
              }
            >
              <Pressable
                onPress={() =>
                  void toggleOwned()
                }
                disabled={
                  savingOwned
                }
                style={({ pressed }) => [
                  styles.bookCartButton,
                  savedBook?.owned &&
                    styles.bookCartButtonActive,
                  pressed &&
                    styles.bookCartButtonPressed,
                  savingOwned &&
                    styles.bookCartButtonDisabled,
                ]}
              >
                {savingOwned ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.gold
                    }
                  />
                ) : (
                  <Ionicons
                    name={
                      savedBook?.owned
                        ? 'checkmark-circle'
                        : 'checkmark-circle-outline'
                    }
                    size={18}
                    color={
                      colors.gold
                    }
                  />
                )}

                <Text
                  style={
                    styles.bookCartButtonText
                  }
                  numberOfLines={
                    1
                  }
                >
                  {savedBook?.owned
                    ? 'Owned'
                    : 'Mark as Owned'}
                </Text>
              </Pressable>

              {!savedBook?.owned ? (
                <Pressable
                  onPress={() =>
                    void toggleBookCart()
                  }
                  disabled={
                    bookCartBusy
                  }
                  style={({ pressed }) => [
                    styles.bookCartButton,
                    inBookCart &&
                      styles.bookCartButtonActive,
                    pressed &&
                      styles.bookCartButtonPressed,
                    bookCartBusy &&
                      styles.bookCartButtonDisabled,
                  ]}
                >
                  {bookCartBusy ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        colors.gold
                      }
                    />
                  ) : (
                    <Ionicons
                      name={
                        inBookCart
                          ? 'cart'
                          : 'cart-outline'
                      }
                      size={18}
                      color={
                        colors.gold
                      }
                    />
                  )}

                  <Text
                    style={
                      styles.bookCartButtonText
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {inBookCart
                      ? 'In Book Cart'
                      : 'Add to Cart'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {series ? (
              <View
                style={
                  styles.seriesBadge
                }
              >
                <Text
                  style={
                    styles.seriesBadgeText
                  }
                >
                  {series.currentPosition
                    ? `Book ${series.currentPosition}`
                    : series.name}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {savedBook &&
        (
          savedBook.status ===
            'read' ||
          savedBook.status ===
            'dnf'
        ) ? (
          <View
            style={
              styles.reviewSection
            }
          >
            <Text
              style={
                styles.sectionLabel
              }
            >
              YOUR REVIEW
            </Text>

            {savedBook.rating !==
              null ||
            Boolean(
              savedBook.review_text
                ?.trim()
            ) ? (
              <View
                style={
                  styles.reviewContent
                }
              >
                <View
                  style={
                    styles.reviewRatingRow
                  }
                >
                  <View
                    style={
                      styles.reviewStars
                    }
                  >
                    {[
                      1,
                      2,
                      3,
                      4,
                      5,
                    ].map(
                      (
                        starNumber
                      ) => {
                        let icon:
                          | 'star'
                          | 'star-half'
                          | 'star-outline' =
                          'star-outline';

                        if (
                          savedBook.rating !==
                            null &&
                          savedBook.rating >=
                            starNumber
                        ) {
                          icon =
                            'star';
                        } else if (
                          savedBook.rating !==
                            null &&
                          savedBook.rating >=
                            starNumber -
                              0.5
                        ) {
                          icon =
                            'star-half';
                        }

                        return (
                          <Ionicons
                            key={
                              starNumber
                            }
                            name={
                              icon
                            }
                            size={
                              21
                            }
                            color={
                              colors.gold
                            }
                          />
                        );
                      }
                    )}
                  </View>

                  {savedBook.rating !==
                  null ? (
                    <Text
                      style={
                        styles.reviewRatingValue
                      }
                    >
                      {savedBook.rating.toFixed(
                        1
                      )}
                    </Text>
                  ) : null}
                </View>

                {savedBook.review_text
                  ?.trim() ? (
                  <Text
                    style={
                      styles.reviewBody
                    }
                  >
                    {
                      savedBook.review_text
                    }
                  </Text>
                ) : (
                  <Text
                    style={
                      styles.reviewEmptyText
                    }
                  >
                    You rated this book but haven’t added a written review yet.
                  </Text>
                )}

                <View
                  style={
                    styles.reviewActions
                  }
                >
                  <Pressable
                    onPress={
                      openRateReview
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.reviewPrimaryButton,
                      pressed &&
                        styles.reviewButtonPressed,
                    ]}
                  >
                    <Ionicons
                      name="create-outline"
                      size={
                        17
                      }
                      color={
                        colors.background
                      }
                    />
                    <Text
                      style={
                        styles.reviewPrimaryButtonText
                      }
                    >
                      {savedBook.review_text
                        ?.trim()
                        ? 'Edit Review'
                        : 'Add Review'}
                    </Text>
                  </Pressable>

                  {savedBook.status ===
                    'read' &&
                  Boolean(
                    savedBook.review_text
                      ?.trim()
                  ) ? (
                    <Pressable
                      onPress={
                        shareSavedReview
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.reviewSecondaryButton,
                        pressed &&
                          styles.reviewButtonPressed,
                      ]}
                    >
                      <Ionicons
                        name="share-social-outline"
                        size={
                          17
                        }
                        color={
                          colors.gold
                        }
                      />
                      <Text
                        style={
                          styles.reviewSecondaryButtonText
                        }
                      >
                        Share Review
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : (
              <Pressable
                onPress={
                  openRateReview
                }
                style={({
                  pressed,
                }) => [
                  styles.reviewEmptyAction,
                  pressed &&
                    styles.reviewButtonPressed,
                ]}
              >
                <View
                  style={
                    styles.reviewEmptyActionIcon
                  }
                >
                  <Ionicons
                    name="star-outline"
                    size={17}
                    color={
                      colors.secondaryText
                    }
                  />
                </View>

                <Text
                  style={
                    styles.reviewEmptyActionText
                  }
                >
                  Rate & Review
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={
                    colors.mutedText
                  }
                />
              </Pressable>
            )}
          </View>
        ) : null}

        {isSavedBookContext &&
        savedBook ? (
          <View
            style={
              styles.libraryReadingPanel
            }
          >
            <View
              style={
                styles.libraryReadingStatusHeader
              }
            >
              <View
                style={
                  styles.libraryReadingStatusIcon
                }
              >
                <Ionicons
                  name={
                    savedReadingPresentation.icon
                  }
                  size={18}
                  color={
                    colors.gold
                  }
                />
              </View>

              <View
                style={
                  styles.libraryReadingStatusCopy
                }
              >
                <Text
                  style={
                    styles.sectionLabel
                  }
                >
                  MY READING
                </Text>

                <Text
                  style={
                    styles.libraryReadingPanelTitle
                  }
                >
                  {
                    savedReadingPresentation.title
                  }
                </Text>
              </View>

              {savedReadingPresentation.badge ? (
                <View
                  style={
                    styles.libraryReadingStatusBadge
                  }
                >
                  <Text
                    style={
                      styles.libraryReadingStatusBadgeText
                    }
                  >
                    {
                      savedReadingPresentation.badge
                    }
                  </Text>
                </View>
              ) : null}
            </View>

            {!savedBook.status ? (
              <>
                <Text
                  style={
                    styles.libraryReadingSupportingText
                  }
                >
                  Choose where this book belongs. Future journey changes will live in Reading Details.
                </Text>

                <View
                  style={
                    styles.libraryStatusSelector
                  }
                >
                  {statuses.map(
                    (
                      status
                    ) => {
                      const saving =
                        savingStatus ===
                        status.value;

                      return (
                        <Pressable
                          key={
                            status.value
                          }
                          disabled={
                            savingStatus !==
                            null
                          }
                          onPress={() =>
                            saveReadingStatus(
                              status.value
                            )
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.libraryStatusChoice,
                            pressed &&
                              savingStatus ===
                                null &&
                              styles.libraryStatusChoicePressed,
                          ]}
                        >
                          {saving ? (
                            <ActivityIndicator
                              size="small"
                              color={
                                colors.gold
                              }
                            />
                          ) : (
                            <>
                              <View
                                style={
                                  styles.libraryStatusChoiceIcon
                                }
                              >
                                <Ionicons
                                  name={
                                    status.icon
                                  }
                                  size={
                                    16
                                  }
                                  color={
                                    colors.gold
                                  }
                                />
                              </View>

                              <Text
                                style={
                                  styles.libraryStatusChoiceText
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                {
                                  status.label
                                }
                              </Text>
                            </>
                          )}
                        </Pressable>
                      );
                    }
                  )}
                </View>
              </>
            ) : (
              <>
                <Text
                  style={
                    styles.libraryReadingSupportingText
                  }
                >
                  {savedBook.status ===
                  'want_to_read'
                    ? 'Saved to your TBR. Start whenever you are ready.'
                    : savedBook.status ===
                      'read'
                    ? savedBook.finished_at
                      ? `Finished ${formatReadingDate(savedBook.finished_at)} · Your full journey is saved.`
                      : 'Reading dates not added · Add them in Reading Details.'
                    : savedBook.status ===
                      'dnf'
                    ? savedBook.dnf_at
                      ? `Stopped ${formatReadingDate(savedBook.dnf_at)} · Your reading history is preserved.`
                      : 'Reading dates not added · Add them in Reading Details.'
                    : savedBook.started_at
                    ? `Started ${formatReadingDate(savedBook.started_at)} · Keep your journey moving.`
                    : 'Your active reading journey is ready to update.'}
                </Text>

                <Pressable
                  onPress={
                    savedBook.status ===
                      'want_to_read'
                      ? () =>
                          void startSavedReadingJourney()
                      : openReadingDetails
                  }
                  disabled={
                    savingStatus !==
                    null
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.readingDetailsButton,
                    savedBook.status ===
                      'want_to_read' &&
                      styles.readingDetailsButtonPrimary,
                    (
                      pressed ||
                      savingStatus !==
                        null
                    ) &&
                      styles.readingDetailsButtonPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.readingDetailsButtonIcon,
                      savedBook.status ===
                        'want_to_read' &&
                        styles.readingDetailsButtonIconPrimary,
                    ]}
                  >
                    {savingStatus ===
                    'reading' &&
                    savedBook.status ===
                      'want_to_read' ? (
                      <ActivityIndicator
                        size="small"
                        color={
                          colors.background
                        }
                      />
                    ) : (
                      <Ionicons
                        name={
                          savedBook.status ===
                            'want_to_read'
                            ? 'play'
                            : 'reader-outline'
                        }
                        size={18}
                        color={
                          savedBook.status ===
                            'want_to_read'
                            ? colors.background
                            : colors.gold
                        }
                      />
                    )}
                  </View>

                  <View
                    style={
                      styles.readingDetailsButtonCopy
                    }
                  >
                    <Text
                      style={[
                        styles.readingDetailsButtonTitle,
                        savedBook.status ===
                          'want_to_read' &&
                          styles.readingDetailsButtonTitlePrimary,
                      ]}
                    >
                      {savedBook.status ===
                      'want_to_read'
                        ? 'Start Reading'
                        : 'View Reading Details'}
                    </Text>

                    <Text
                      style={[
                        styles.readingDetailsButtonSubtitle,
                        savedBook.status ===
                          'want_to_read' &&
                          styles.readingDetailsButtonSubtitlePrimary,
                      ]}
                    >
                      {savedBook.status ===
                      'want_to_read'
                        ? 'Begin your first reading journey'
                        : 'Progress · dates · notes · journey history'}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={
                      savedBook.status ===
                        'want_to_read'
                        ? colors.background
                        : colors.gold
                    }
                  />
                </Pressable>
              </>
            )}
          </View>
        ) : null}

        {!isSavedBookContext ? (
          source ===
            'discover' &&
          readingStatus &&
          selectedStatusLabel ? (
            <View
              style={
                styles.discoverLibraryConfirmation
              }
            >
              <View
                style={
                  styles.discoverLibraryConfirmationIcon
                }
              >
                <Ionicons
                  name="checkmark"
                  size={24}
                  color={colors.background}
                />
              </View>

              <View
                style={
                  styles.discoverLibraryConfirmationCopy
                }
              >
                <Text
                  style={
                    styles.discoverLibraryConfirmationTitle
                  }
                >
                  Added to your library
                </Text>

                <Text
                  style={
                    styles.discoverLibraryConfirmationText
                  }
                >
                  {`Marked as ${selectedStatusLabel}. You can manage this book anytime from your Library.`}
                </Text>
              </View>
            </View>
          ) : (
            <View
              style={
                styles.statusSection
              }
            >
              <View
                style={
                  styles.statusHeadingRow
                }
              >
                <View>
                  <Text
                    style={
                      styles.statusHeading
                    }
                  >
                    Your Reading Status
                  </Text>

                  <Text
                    style={
                      styles.statusSubheading
                    }
                  >
                    Keep this book organized in your library.
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.statusGrid
                }
              >
                {statuses.map(
                  (
                    status
                  ) => {
                    const saving =
                      savingStatus ===
                      status.value;

                    return (
                      <Pressable
                        key={
                          status.value
                        }
                        disabled={
                          savingStatus !==
                          null
                        }
                        onPress={() =>
                          saveReadingStatus(
                            status.value
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.statusButton,
                          pressed &&
                            savingStatus ===
                              null &&
                            styles.statusButtonPressed,
                          savingStatus !==
                            null &&
                            !saving &&
                            styles.statusButtonDisabled,
                        ]}
                      >
                        {saving ? (
                          <ActivityIndicator
                            size="small"
                            color={
                              colors.gold
                            }
                          />
                        ) : (
                          <>
                            <View
                              style={
                                styles.statusIconWrap
                              }
                            >
                              <Ionicons
                                name={
                                  status.icon
                                }
                                size={
                                  18
                                }
                                color={
                                  colors.secondaryText
                                }
                              />
                            </View>

                            <Text
                              style={
                                styles.statusButtonText
                              }
                              numberOfLines={
                                1
                              }
                            >
                              {
                                status.label
                              }
                            </Text>
                          </>
                        )}
                      </Pressable>
                    );
                  }
                )}
              </View>
            </View>
          )
        ) : null}

        {!isSavedBookContext &&
        source !==
          'discover' &&
        savedBook &&
        savedBook.status &&
        savedBook.status !==
          'want_to_read' ? (
          <View
            style={[
              styles.readingDatesSection,
              isSavedBookContext &&
                styles.libraryReadingDatesSection,
            ]}
          >
            <View style={styles.readingDatesHeader}>
              <View>
                <Text style={styles.sectionLabel}>
                  READING ACTIVITY
                </Text>

                <Text style={styles.readingDatesTitle}>
                  Your reading dates
                </Text>
              </View>

              <Pressable
                onPress={
                  openReadingDateEditor
                }
                hitSlop={8}
                style={({ pressed }) => [
                  styles.editDatesButton,
                  pressed &&
                    styles.editDatesButtonPressed,
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={15}
                  color={colors.gold}
                />

                <Text style={styles.editDatesText}>
                  Edit
                </Text>
              </Pressable>
            </View>

            <View
              style={[
                styles.readingDatesCard,
                isSavedBookContext &&
                  styles.libraryReadingDatesCard,
              ]}
            >
              <View
                style={[
                  styles.readingDateItem,
                  isSavedBookContext &&
                    styles.libraryReadingDateItem,
                ]}
              >
                <View style={styles.readingDateIcon}>
                  <Ionicons
                    name="play-outline"
                    size={17}
                    color={colors.gold}
                  />
                </View>

                <View style={styles.readingDateText}>
                  <Text style={styles.readingDateLabel}>
                    Started
                  </Text>

                  <Text style={styles.readingDateValue}>
                    {formatReadingDate(
                      savedBook.started_at
                    )}
                  </Text>
                </View>
              </View>

              {savedBook.status ===
              'read' ? (
                <>
                  <View style={styles.readingDateDivider} />

                  <View
                    style={[
                      styles.readingDateItem,
                      source ===
                        'library' &&
                        styles.libraryReadingDateItem,
                    ]}
                  >
                    <View style={styles.readingDateIcon}>
                      <Ionicons
                        name="checkmark-outline"
                        size={17}
                        color={colors.gold}
                      />
                    </View>

                    <View style={styles.readingDateText}>
                      <Text style={styles.readingDateLabel}>
                        Finished
                      </Text>

                      <Text style={styles.readingDateValue}>
                        {formatReadingDate(
                          savedBook.finished_at
                        )}
                      </Text>
                    </View>
                  </View>
                </>
              ) : null}

              {savedBook.status ===
              'dnf' ? (
                <>
                  <View style={styles.readingDateDivider} />

                  <View
                    style={[
                      styles.readingDateItem,
                      source ===
                        'library' &&
                        styles.libraryReadingDateItem,
                    ]}
                  >
                    <View style={styles.readingDateIcon}>
                      <Ionicons
                        name="stop-outline"
                        size={17}
                        color={colors.gold}
                      />
                    </View>

                    <View style={styles.readingDateText}>
                      <Text style={styles.readingDateLabel}>
                        Stopped
                      </Text>

                      <Text style={styles.readingDateValue}>
                        {formatReadingDate(
                          savedBook.dnf_at
                        )}
                      </Text>
                    </View>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        ) : null}

        <View
          style={[
            styles.detailsSection,
            source ===
              'library' &&
              styles.libraryDetailsSection,
          ]}
        >
          <Text style={styles.sectionLabel}>
            BOOK DETAILS
          </Text>

          <View
            style={[
              styles.metadataCard,
              isSavedBookContext &&
                styles.libraryMetadataCard,
            ]}
          >
            <View style={styles.metadataTopRow}>
              <View style={styles.metadataStat}>
                <View style={styles.metadataIconWrap}>
                  <Ionicons
                    name="calendar-outline"
                    size={17}
                    color={colors.gold}
                  />
                </View>

                <Text style={styles.metadataLabel}>
                  Published
                </Text>

                <Text
                  style={styles.metadataStatValue}
                  numberOfLines={1}
                >
                  {publishedDate ?? '—'}
                </Text>
              </View>

              <View style={styles.metadataVerticalDivider} />

              <View style={styles.metadataStat}>
                <View style={styles.metadataIconWrap}>
                  <Ionicons
                    name="document-text-outline"
                    size={17}
                    color={colors.gold}
                  />
                </View>

                <Text style={styles.metadataLabel}>
                  Pages
                </Text>

                <Text
                  style={styles.metadataStatValue}
                  numberOfLines={1}
                >
                  {info.pageCount
                    ? `${info.pageCount}`
                    : '—'}
                </Text>
              </View>
            </View>

            {categories ? (
              <>
                <View style={styles.metadataHorizontalDivider} />

                <View style={styles.genreRow}>
                  <View style={styles.genreIconWrap}>
                    <Ionicons
                      name="pricetag-outline"
                      size={17}
                      color={colors.gold}
                    />
                  </View>

                  <View style={styles.genreTextWrap}>
                    <Text style={styles.metadataLabel}>
                      Genre
                    </Text>

                    <Text
                      style={styles.genreValue}
                      numberOfLines={2}
                    >
                      {categories}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {seriesLoading ? (
          <View style={styles.seriesSection}>
            <Text style={styles.sectionHeading}>Series</Text>
            <View style={styles.seriesLoading}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.seriesLoadingText}>
                Checking series...
              </Text>
            </View>
          </View>
        ) : series && seriesBooks.length > 0 ? (
          <View style={styles.seriesSection}>
            <Text style={styles.sectionHeading}>Series</Text>

            <Pressable
              onPress={() =>
                setSeriesExpanded((current) => !current)
              }
              style={({ pressed }) => [
                styles.seriesToggle,
                pressed && styles.seriesTogglePressed,
              ]}
            >
              <View style={styles.seriesToggleIcon}>
                <Ionicons
                  name="library-outline"
                  size={21}
                  color={colors.gold}
                />
              </View>

              <View style={styles.seriesToggleText}>
                <Text style={styles.seriesToggleName}>
                  {series.name}
                </Text>

                <Text style={styles.seriesToggleMeta}>
                  {seriesBooks.length}{' '}
                  {seriesBooks.length === 1 ? 'book' : 'books'}
                  {series.currentPosition
                    ? ` • Current: Book ${series.currentPosition}`
                    : ''}
                </Text>
              </View>

              <Ionicons
                name={
                  seriesExpanded
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={20}
                color={colors.softGold}
              />
            </Pressable>

            {seriesExpanded ? (
              <View
                style={[
                  styles.seriesCard,
                  isSavedBookContext &&
                    styles.librarySeriesCard,
                ]}
              >
                {seriesBooks.map((seriesBook, index) => {
                  const isCurrent =
                    series.currentPosition ===
                    seriesBook.position;

                  const isOpening =
                    openingSeriesBookId === seriesBook.id;

                  const year = getYear(seriesBook.releaseDate);

                  const displayTitle = getDisplayTitle(
                    seriesBook.title
                  );

                  const hasUsableTitle =
                    displayTitle !== 'Unannounced';

                  return (
                    <Pressable
                      key={seriesBook.id}
                      disabled={
                        isCurrent ||
                        isOpening ||
                        !hasUsableTitle
                      }
                      onPress={() => openSeriesBook(seriesBook)}
                      style={({ pressed }) => [
                        styles.seriesRow,
                        index === seriesBooks.length - 1 &&
                          styles.seriesRowLast,
                        pressed &&
                          !isCurrent &&
                          hasUsableTitle &&
                          styles.seriesRowPressed,
                      ]}
                    >
                      {seriesBook.imageUrl ? (
                        <Image
                          source={{ uri: seriesBook.imageUrl }}
                          style={styles.seriesCover}
                        />
                      ) : (
                        <View
                          style={styles.seriesCoverPlaceholder}
                        >
                          <Ionicons
                            name="book-outline"
                            size={20}
                            color={colors.mutedText}
                          />
                        </View>
                      )}

                      <View style={styles.seriesBookText}>
                        <View style={styles.seriesTitleRow}>
                          <Text style={styles.seriesNumber}>
                            {seriesBook.position}.
                          </Text>

                          <Text
                            style={[
                              styles.seriesBookTitle,
                              isCurrent &&
                                styles.seriesBookTitleCurrent,
                              !hasUsableTitle &&
                                styles.seriesBookTitleUnavailable,
                            ]}
                            numberOfLines={2}
                          >
                            {displayTitle}
                          </Text>
                        </View>

                        {isCurrent ? (
                          <View style={styles.currentBookRow}>
                            <Ionicons
                              name="eye-outline"
                              size={13}
                              color={colors.softGold}
                            />
                            <Text style={styles.currentBookLabel}>
                              Currently viewing
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.seriesBookMeta}>
                            {year
                              ? year
                              : hasUsableTitle
                              ? 'View book'
                              : 'Details not announced'}
                          </Text>
                        )}
                      </View>

                      {isOpening ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.gold}
                        />
                      ) : !isCurrent && hasUsableTitle ? (
                        <Ionicons
                          name="chevron-forward"
                          size={19}
                          color={colors.mutedText}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.descriptionSection}>
          <Text style={styles.sectionHeading}>About this book</Text>

          {description ? (
            <>
              <Text
                style={styles.description}
                numberOfLines={
                  descriptionExpanded ? undefined : 7
                }
              >
                {description}
              </Text>

              <Pressable
                onPress={() =>
                  setDescriptionExpanded(!descriptionExpanded)
                }
              >
                <Text style={styles.readMore}>
                  {descriptionExpanded
                    ? 'Show less'
                    : 'Read more'}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.noDescription}>
              No description is available for this edition.
            </Text>
          )}
        </View>

        <View
          style={
            styles.communityReviewsSection
          }
        >
          <View
            style={
              styles.communityReviewsHeader
            }
          >
            <View>
              <Text
                style={
                  styles.sectionHeading
                }
              >
                Community Reviews
              </Text>

              <Text
                style={
                  styles.communityReviewsSubtitle
                }
              >
                What Novori readers are saying.
              </Text>
            </View>

            {communityReviews.length >
            0 ? (
              <View
                style={
                  styles.communityReviewCount
                }
              >
                <Text
                  style={
                    styles.communityReviewCountText
                  }
                >
                  {
                    communityReviews.length
                  }
                </Text>
              </View>
            ) : null}
          </View>

          <View
            style={
              styles.spoilerWarning
            }
          >
            <Ionicons
              name="warning-outline"
              size={17}
              color={
                colors.gold
              }
            />

            <Text
              style={
                styles.spoilerWarningText
              }
            >
              Community reviews can contain spoilers. Review text stays collapsed until you choose to read it.
            </Text>
          </View>

          {communityReviewsLoading ? (
            <View
              style={
                styles.communityReviewsLoading
              }
            >
              <ActivityIndicator
                size="small"
                color={
                  colors.gold
                }
              />

              <Text
                style={
                  styles.communityReviewsLoadingText
                }
              >
                Loading community reviews…
              </Text>
            </View>
          ) : communityReviews.length >
            0 ? (
            <View
              style={
                styles.communityReviewList
              }
            >
              {communityReviews.map(
                (
                  review
                ) => {
                  const expanded =
                    expandedCommunityReviewIds.includes(
                      review.id
                    );

                  const displayName =
                    review.author_display_name
                      ?.trim() ||
                    review.author_username
                      ?.trim() ||
                    'Novori Reader';

                  const initial =
                    displayName
                      .charAt(0)
                      .toUpperCase();

                  const reviewDate =
                    review.created_at
                      ? new Date(
                          review.created_at
                        ).toLocaleDateString(
                          undefined,
                          {
                            month:
                              'short',
                            day:
                              'numeric',
                            year:
                              'numeric',
                          }
                        )
                      : '';

                  return (
                    <View
                      key={
                        review.id
                      }
                      style={
                        styles.communityReviewCard
                      }
                    >
                      <View
                        style={
                          styles.communityReviewIdentity
                        }
                      >
                        {review.author_avatar_url ? (
                          <Image
                            source={{
                              uri:
                                review.author_avatar_url,
                            }}
                            style={
                              styles.communityReviewAvatar
                            }
                          />
                        ) : (
                          <View
                            style={
                              styles.communityReviewAvatarFallback
                            }
                          >
                            <Text
                              style={
                                styles.communityReviewAvatarText
                              }
                            >
                              {
                                initial
                              }
                            </Text>
                          </View>
                        )}

                        <View
                          style={
                            styles.communityReviewIdentityCopy
                          }
                        >
                          <Text
                            style={
                              styles.communityReviewName
                            }
                            numberOfLines={
                              1
                            }
                          >
                            {
                              displayName
                            }
                          </Text>

                          <Text
                            style={
                              styles.communityReviewMeta
                            }
                          >
                            {review.author_username
                              ?.trim()
                              ? `@${review.author_username.trim()} · `
                              : ''}
                            {reviewDate}
                          </Text>
                        </View>

                        {review.rating !==
                        null ? (
                          <View
                            style={
                              styles.communityReviewRating
                            }
                          >
                            <Ionicons
                              name="star"
                              size={13}
                              color={
                                colors.gold
                              }
                            />

                            <Text
                              style={
                                styles.communityReviewRatingText
                              }
                            >
                              {review.rating.toFixed(
                                1
                              )}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {expanded ? (
                        <>
                          <Text
                            style={
                              styles.communityReviewBody
                            }
                          >
                            {
                              review.body
                            }
                          </Text>

                          <Pressable
                            onPress={() =>
                              setExpandedCommunityReviewIds(
                                (
                                  current
                                ) =>
                                  current.filter(
                                    (
                                      reviewId
                                    ) =>
                                      reviewId !==
                                      review.id
                                  )
                              )
                            }
                            style={({ pressed }) => [
                              styles.communityReviewToggle,
                              pressed &&
                                styles.reviewButtonPressed,
                            ]}
                          >
                            <Text
                              style={
                                styles.communityReviewToggleText
                              }
                            >
                              Hide review
                            </Text>
                          </Pressable>
                        </>
                      ) : (
                        <Pressable
                          onPress={() =>
                            setExpandedCommunityReviewIds(
                              (
                                current
                              ) => [
                                ...current,
                                review.id,
                              ]
                            )
                          }
                          style={({ pressed }) => [
                            styles.communityReviewReveal,
                            pressed &&
                              styles.reviewButtonPressed,
                          ]}
                        >
                          <View
                            style={
                              styles.communityReviewRevealIcon
                            }
                          >
                            <Ionicons
                              name="eye-outline"
                              size={16}
                              color={
                                colors.gold
                              }
                            />
                          </View>

                          <View
                            style={
                              styles.communityReviewRevealCopy
                            }
                          >
                            <Text
                              style={
                                styles.communityReviewRevealTitle
                              }
                            >
                              Read review
                            </Text>

                            <Text
                              style={
                                styles.communityReviewRevealSubtitle
                              }
                            >
                              May contain spoilers
                            </Text>
                          </View>

                          <Ionicons
                            name="chevron-down"
                            size={17}
                            color={
                              colors.mutedText
                            }
                          />
                        </Pressable>
                      )}
                    </View>
                  );
                }
              )}
            </View>
          ) : (
            <View
              style={
                styles.communityReviewsEmpty
              }
            >
              <Ionicons
                name="chatbubbles-outline"
                size={23}
                color={
                  colors.gold
                }
              />

              <View
                style={
                  styles.communityReviewsEmptyCopy
                }
              >
                <Text
                  style={
                    styles.communityReviewsEmptyTitle
                  }
                >
                  No shared reviews yet
                </Text>

                <Text
                  style={
                    styles.communityReviewsEmptyText
                  }
                >
                  Reviews shared to Novori will appear here.
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={dateEditorVisible}
        transparent
        animationType="fade"
        onRequestClose={
          closeReadingDateEditor
        }
      >
        <View style={styles.dateModalBackdrop}>
          <View style={styles.dateModalCard}>
            <View style={styles.dateModalHeader}>
              <View style={styles.dateModalHeaderText}>
                <Text style={styles.dateModalTitle}>
                  Edit Reading Dates
                </Text>

                <Text
                  style={styles.dateModalSubtitle}
                  numberOfLines={2}
                >
                  {book?.volumeInfo.title ??
                    'Book'}
                </Text>
              </View>

              <Pressable
                onPress={
                  closeReadingDateEditor
                }
                hitSlop={8}
                disabled={savingDates}
                style={({ pressed }) => [
                  styles.dateModalClose,
                  pressed &&
                    styles.dateModalClosePressed,
                ]}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={colors.mutedText}
                />
              </Pressable>
            </View>

            <View style={styles.dateField}>
              <Text style={styles.dateFieldLabel}>
                Started
              </Text>

              <TextInput
                value={startedDateInput}
                onChangeText={
                  setStartedDateInput
                }
                placeholder="MM/DD/YYYY"
                placeholderTextColor={
                  colors.mutedText
                }
                keyboardType="numbers-and-punctuation"
                autoCorrect={false}
                style={styles.dateInput}
              />

              <Text style={styles.dateFieldHint}>
                Leave blank if you do not know the start date.
              </Text>
            </View>

            {savedBook?.status ===
              'read' ||
            savedBook?.status ===
              'dnf' ? (
              <View style={styles.dateField}>
                <Text style={styles.dateFieldLabel}>
                  {savedBook.status ===
                  'read'
                    ? 'Finished'
                    : 'Stopped'}
                </Text>

                <TextInput
                  value={endedDateInput}
                  onChangeText={
                    setEndedDateInput
                  }
                  placeholder="MM/DD/YYYY"
                  placeholderTextColor={
                    colors.mutedText
                  }
                  keyboardType="numbers-and-punctuation"
                  autoCorrect={false}
                  style={styles.dateInput}
                />
              </View>
            ) : null}

            <View style={styles.dateModalActions}>
              <Pressable
                onPress={
                  closeReadingDateEditor
                }
                disabled={savingDates}
                style={({ pressed }) => [
                  styles.dateCancelButton,
                  pressed &&
                    styles.dateActionPressed,
                ]}
              >
                <Text style={styles.dateCancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={
                  saveReadingDates
                }
                disabled={savingDates}
                style={({ pressed }) => [
                  styles.dateSaveButton,
                  pressed &&
                    styles.dateActionPressed,
                  savingDates &&
                    styles.dateSaveButtonDisabled,
                ]}
              >
                {savingDates ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.background}
                  />
                ) : (
                  <Text style={styles.dateSaveText}>
                    Save Dates
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  loadingText: {
    color: colors.secondaryText,
    fontFamily: 'Inter_400Regular',
    marginTop: 14,
  },

  topBar: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  shareBookButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent:
      'center',
    backgroundColor:
      colors.surface,
    borderWidth: 1,
    borderColor:
      colors.border,
  },

  shareBookButtonPressed: {
    opacity: 0.7,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingRight: 10,
  },

  backText: {
    color: colors.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    marginLeft: 1,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },

  hero: {
    alignItems: 'center',
    paddingTop: 12,
  },

  cover: {
    width: 155,
    height: 232,
    borderRadius: 10,
    backgroundColor: colors.elevated,
  },

  coverPlaceholder: {
    width: 155,
    height: 232,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noCoverText: {
    color: colors.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 8,
  },

  title: {
    color: colors.text,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 30,
    lineHeight: 37,
    textAlign: 'center',
    marginTop: 24,
  },

  subtitle: {
    color: colors.secondaryText,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    textAlign: 'center',
    marginTop: 5,
  },

  author: {
    color: colors.softGold,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
  },

  authorLink: {
    color:
      colors.gold,
    textDecorationLine:
      'underline',
  },

  externalRatingRow: {
    flexDirection:
      'row',
    alignItems:
      'center',
    justifyContent:
      'center',
    gap: 8,
    minHeight: 20,
    marginTop: 10,
  },

  libraryExternalRatingRow: {
    justifyContent:
      'flex-start',
    alignSelf:
      'stretch',
  },

  externalRatingStars: {
    flexDirection:
      'row',
    alignItems:
      'center',
    gap: 2,
  },

  externalRatingText: {
    color:
      colors.secondaryText,
    fontFamily:
      'Inter_500Medium',
    fontSize: 12,
  },

  libraryOwnershipRow: {
    width:
      '100%',
    flexDirection:
      'row',
    alignItems:
      'stretch',
    gap: 10,
    marginTop: 12,
    marginBottom: 4,
  },

  libraryCartButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    flexDirection:
      'row',
    alignItems:
      'center',
    justifyContent:
      'center',
    gap: 6,
    borderWidth: 1,
    borderColor:
      colors.gold,
    borderRadius: 11,
    paddingHorizontal: 8,
    backgroundColor:
      colors.surface,
  },

  libraryCartButtonText: {
    color:
      colors.gold,
    fontFamily:
      'Inter_700Bold',
    fontSize: 11,
  },

  bookOwnershipRow: {
    width:
      '100%',
    flexDirection:
      'row',
    alignItems:
      'stretch',
    gap: 10,
    marginTop: 12,
  },

  bookCartButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    flexDirection:
      'row',
    alignItems:
      'center',
    justifyContent:
      'center',
    gap: 7,
    borderWidth: 1,
    borderColor:
      colors.gold,
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor:
      colors.surface,
  },

  bookCartButtonActive: {
    backgroundColor:
      colors.elevated,
  },

  bookCartButtonText: {
    color:
      colors.gold,
    fontFamily:
      'Inter_700Bold',
    fontSize: 12,
  },

  bookCartButtonPressed: {
    opacity: 0.72,
  },

  bookCartButtonDisabled: {
    opacity: 0.55,
  },

  seriesBadge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 12,
  },

  seriesBadgeText: {
    color: colors.gold,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },

  libraryHero: {
    paddingTop: 4,
  },

  libraryCover: {
    width: 132,
    height: 198,
  },

  libraryTitle: {
    fontSize: 27,
    lineHeight: 33,
    marginTop: 17,
  },

  libraryStatusSection: {
    marginTop: 20,
  },





  libraryReadingDatesSection: {
    marginTop: 18,
  },





  libraryStatusButton: {
    minHeight: 46,
    paddingVertical: 4,
    backgroundColor:
      'transparent',
    borderWidth: 0,
    borderRadius: 0,
  },

  libraryStatusButtonSelected: {
    backgroundColor:
      'transparent',
    borderWidth: 0,
    borderBottomWidth: 2,
    borderBottomColor:
      colors.gold,
  },

  libraryStatusIconWrap: {
    width: 25,
    height: 25,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor:
      'transparent',
    borderWidth: 0,
  },

  libraryStatusIconWrapSelected: {
    backgroundColor:
      'transparent',
    borderWidth: 0,
  },

  libraryReadingDatesCard: {
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor:
      'transparent',
    paddingHorizontal: 0,
  },

  libraryReadingDateItem: {
    minHeight: 46,
    paddingHorizontal: 0,
  },

  libraryMetadataCard: {
    marginTop: 8,
    backgroundColor:
      'transparent',
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },

  librarySeriesCard: {
    backgroundColor:
      'transparent',
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 0,
  },

  libraryBookHero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },

  libraryBookCover: {
    width: 108,
    height: 162,
    borderRadius: 12,
    backgroundColor:
      colors.surface,
  },

  libraryBookCoverPlaceholder: {
    width: 108,
    height: 162,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent:
      'center',
    backgroundColor:
      colors.surface,
    borderWidth: 1,
    borderColor:
      colors.border,
  },

  libraryBookHeroCopy: {
    flex: 1,
    minWidth: 0,
    paddingTop: 5,
  },

  libraryBookTitle: {
    color:
      colors.text,
    fontFamily:
      'PlayfairDisplay_700Bold',
    fontSize: 27,
    lineHeight: 32,
  },

  libraryBookAuthor: {
    color:
      colors.secondaryText,
    fontFamily:
      'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },

  libraryHeroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },

  librarySeriesMeta: {
    color:
      colors.mutedText,
    fontFamily:
      'Inter_500Medium',
    fontSize: 11,
  },

  libraryReadingPanel: {
    marginTop: 22,
    backgroundColor:
      colors.surface,
    borderWidth: 1,
    borderColor:
      colors.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  libraryReadingPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  libraryReadingStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  libraryReadingStatusIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      colors.elevated,
    borderWidth:
      StyleSheet.hairlineWidth,
    borderColor:
      colors.border,
    marginRight: 11,
  },

  libraryReadingStatusCopy: {
    flex: 1,
    minWidth: 0,
  },

  libraryReadingStatusBadge: {
    minHeight: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    marginLeft: 10,
    backgroundColor:
      colors.elevated,
    borderWidth: 1,
    borderColor:
      colors.gold,
  },

  libraryReadingStatusBadgeText: {
    color:
      colors.softGold,
    fontFamily:
      'Inter_700Bold',
    fontSize: 9.5,
    letterSpacing: 0.75,
  },

  libraryReadingSupportingText: {
    color:
      colors.secondaryText,
    fontFamily:
      'Inter_400Regular',
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 11,
  },

  readingDetailsButton: {
    minHeight: 58,
    flexDirection:
      'row',
    alignItems:
      'center',
    gap: 11,
    marginTop: 13,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor:
      colors.gold,
    borderRadius: 14,
    backgroundColor:
      colors.elevated,
  },

  readingDetailsButtonPrimary: {
    backgroundColor:
      colors.gold,
    borderColor:
      colors.gold,
  },

  readingDetailsButtonPressed: {
    opacity: 0.7,
  },

  readingDetailsButtonIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems:
      'center',
    justifyContent:
      'center',
    backgroundColor:
      colors.surface,
  },

  readingDetailsButtonIconPrimary: {
    backgroundColor:
      colors.softGold,
  },

  readingDetailsButtonCopy: {
    flex: 1,
    minWidth: 0,
  },

  readingDetailsButtonTitle: {
    color:
      colors.softGold,
    fontFamily:
      'Inter_700Bold',
    fontSize: 13.5,
  },

  readingDetailsButtonTitlePrimary: {
    color:
      colors.background,
  },

  readingDetailsButtonSubtitle: {
    color:
      colors.secondaryText,
    fontFamily:
      'Inter_400Regular',
    fontSize: 10.5,
    marginTop: 3,
  },

  readingDetailsButtonSubtitlePrimary: {
    color:
      colors.background,
  },

  libraryReadingPanelTitle: {
    color:
      colors.text,
    fontFamily:
      'Inter_700Bold',
    fontSize: 16,
    marginTop: 2,
  },

  libraryReadingEdit: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor:
      colors.elevated,
  },

  libraryReadingEditText: {
    color:
      colors.gold,
    fontFamily:
      'Inter_700Bold',
    fontSize: 11.5,
  },

  libraryStatusSelector: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 5,
    marginTop: 14,
  },

  libraryStatusChoice: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    alignItems: 'center',
    justifyContent:
      'center',
    gap: 4,
    borderRadius: 11,
    backgroundColor:
      colors.background,
    borderWidth: 1,
    borderColor:
      colors.border,
    paddingHorizontal: 3,
  },

  libraryStatusChoiceIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      colors.elevated,
  },

  libraryStatusChoiceSelected: {
    borderColor:
      colors.gold,
    backgroundColor:
      colors.surface,
  },

  libraryStatusChoicePressed: {
    opacity: 0.68,
    borderColor:
      colors.gold,
  },

  libraryStatusChoiceText: {
    color:
      colors.mutedText,
    fontFamily:
      'Inter_600SemiBold',
    fontSize: 9.5,
  },

  libraryStatusChoiceTextSelected: {
    color:
      colors.gold,
  },

  libraryDateSummary: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor:
      colors.border,
  },

  libraryDateSummaryItem: {
    flex: 1,
  },

  libraryDateSummaryDivider: {
    width: 1,
    backgroundColor:
      colors.border,
    marginHorizontal: 14,
  },

  libraryDateSummaryLabel: {
    color:
      colors.mutedText,
    fontFamily:
      'Inter_600SemiBold',
    fontSize: 9.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  libraryDateSummaryValue: {
    color:
      colors.text,
    fontFamily:
      'Inter_600SemiBold',
    fontSize: 12.5,
    marginTop: 4,
  },

  libraryTbrHint: {
    color:
      colors.secondaryText,
    fontFamily:
      'Inter_400Regular',
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor:
      colors.border,
  },

  statusSection: {
    marginTop: 30,
  },

  statusHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  statusHeading: {
    color: colors.text,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 20,
  },

  statusSubheading: {
    color: colors.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },

  sectionLabel: {
    color: colors.mutedText,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 11,
  },

  statusGrid: {
    flexDirection: 'row',
    gap: 7,
  },

  statusButton: {
    flex: 1,
    minHeight: 74,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 9,
  },

  statusButtonSelected: {
    backgroundColor: colors.elevated,
    borderColor: colors.gold,
    borderWidth: 1.5,
  },

  statusButtonPressed: {
    opacity: 0.72,
  },

  statusButtonDisabled: {
    opacity: 0.42,
  },

  statusIconWrap: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },

  statusIconWrapSelected: {
    backgroundColor: colors.background,
  },

  statusButtonText: {
    color: colors.secondaryText,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },

  statusButtonTextSelected: {
    color: colors.softGold,
  },

  statusFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
    marginTop: 7,
  },

  savedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusConfirmation: {
    color: colors.softGold,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginLeft: 5,
  },

  removeLibraryIconButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  removeLibraryIconButtonPressed: {
    backgroundColor: colors.elevated,
  },

  removeLibraryIconButtonDisabled: {
    opacity: 0.4,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 28,
  },

  readingDatesSection: {
    marginTop: 23,
  },

  readingDatesHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  readingDatesTitle: {
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginTop: -4,
  },

  editDatesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 1,
  },

  editDatesButtonPressed: {
    backgroundColor: colors.elevated,
  },

  editDatesText: {
    color: colors.gold,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    marginLeft: 4,
  },

  readingDatesCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    paddingHorizontal: 14,
  },

  readingDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 62,
  },

  readingDateIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  readingDateText: {
    flex: 1,
  },

  readingDateLabel: {
    color: colors.mutedText,
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
  },

  readingDateValue: {
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    marginTop: 3,
  },

  readingDateDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 45,
  },

  dateModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },

  dateModalCard: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 18,
  },

  dateModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 19,
  },

  dateModalHeaderText: {
    flex: 1,
    marginRight: 12,
  },

  dateModalTitle: {
    color: colors.text,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 21,
  },

  dateModalSubtitle: {
    color: colors.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },

  dateModalClose: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dateModalClosePressed: {
    backgroundColor: colors.elevated,
  },

  dateField: {
    marginBottom: 15,
  },

  dateFieldLabel: {
    color: colors.secondaryText,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    marginBottom: 7,
  },

  dateInput: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.background,
    color: colors.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    paddingHorizontal: 13,
  },

  dateFieldHint: {
    color: colors.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 6,
  },

  dateModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 9,
    marginTop: 2,
  },

  dateCancelButton: {
    minWidth: 88,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  dateSaveButton: {
    minWidth: 110,
    height: 42,
    borderRadius: 11,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  dateSaveButtonDisabled: {
    opacity: 0.55,
  },

  dateActionPressed: {
    opacity: 0.72,
  },

  dateCancelText: {
    color: colors.secondaryText,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },

  dateSaveText: {
    color: colors.background,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },

  reviewSection: {
    marginTop: 16,
    paddingHorizontal: 2,
  },

  reviewContent: {
    marginTop: 7,
    paddingBottom: 4,
  },

  reviewRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  reviewStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  reviewRatingValue: {
    color:
      colors.softGold,
    fontFamily:
      'Inter_700Bold',
    fontSize: 13,
  },

  reviewBody: {
    color:
      colors.text,
    fontFamily:
      'Inter_400Regular',
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 10,
  },

  reviewEmptyText: {
    color:
      colors.secondaryText,
    fontFamily:
      'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 13,
  },

  reviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 12,
  },

  reviewPrimaryButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor:
      colors.gold,
    borderRadius: 13,
    paddingHorizontal: 15,
  },

  reviewPrimaryButtonText: {
    color:
      colors.background,
    fontFamily:
      'Inter_700Bold',
    fontSize: 13,
  },

  reviewSecondaryButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor:
      colors.elevated,
    borderWidth: 1,
    borderColor:
      colors.gold,
    borderRadius: 13,
    paddingHorizontal: 15,
  },

  reviewSecondaryButtonText: {
    color:
      colors.gold,
    fontFamily:
      'Inter_700Bold',
    fontSize: 13,
  },

  reviewButtonPressed: {
    opacity: 0.72,
  },

  reviewEmptyAction: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 8,
    paddingHorizontal: 11,
    borderRadius: 12,
    backgroundColor:
      colors.surface,
    borderWidth:
      StyleSheet.hairlineWidth,
    borderColor:
      colors.border,
  },

  reviewEmptyActionIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      colors.elevated,
  },

  reviewEmptyActionText: {
    flex: 1,
    color:
      colors.secondaryText,
    fontFamily:
      'Inter_600SemiBold',
    fontSize: 12.5,
  },

  libraryDetailsSection: {
    marginTop: 24,
  },

  detailsSection: {
    marginTop: 24,
  },

  metadataCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 17,
    padding: 15,
  },

  metadataTopRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  metadataStat: {
    flex: 1,
    alignItems: 'center',
    minHeight: 76,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  metadataIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },

  metadataVerticalDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  metadataHorizontalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 13,
  },

  metadataLabel: {
    color: colors.mutedText,
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    letterSpacing: 0.25,
  },

  metadataStatValue: {
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },

  genreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  genreIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  genreTextWrap: {
    flex: 1,
  },

  genreValue: {
    color: colors.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },

  seriesSection: {
    marginTop: 30,
  },

  seriesLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  seriesLoadingText: {
    color: colors.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginLeft: 10,
  },

  seriesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },

  seriesTogglePressed: {
    opacity: 0.72,
  },

  seriesToggleIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },


  discoverLibraryConfirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 18,
    paddingHorizontal: 17,
    paddingVertical: 16,
    marginTop: 24,
  },

  discoverLibraryConfirmationIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  discoverLibraryConfirmationCopy: {
    flex: 1,
  },

  discoverLibraryConfirmationTitle: {
    color: colors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },

  discoverLibraryConfirmationText: {
    color: colors.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  seriesToggleText: {
    flex: 1,
    marginRight: 10,
  },

  seriesToggleName: {
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },

  seriesToggleMeta: {
    color: colors.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 4,
  },

  seriesCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 10,
  },

  seriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  seriesRowLast: {
    borderBottomWidth: 0,
  },

  seriesRowPressed: {
    opacity: 0.65,
  },

  seriesCover: {
    width: 46,
    height: 69,
    borderRadius: 5,
    backgroundColor: colors.elevated,
    marginRight: 12,
  },

  seriesCoverPlaceholder: {
    width: 46,
    height: 69,
    borderRadius: 5,
    backgroundColor: colors.elevated,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  seriesBookText: {
    flex: 1,
    marginRight: 8,
  },

  seriesTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  seriesNumber: {
    color: colors.gold,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    marginRight: 6,
    marginTop: 1,
  },

  seriesBookTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    lineHeight: 19,
  },

  seriesBookTitleCurrent: {
    color: colors.softGold,
  },

  seriesBookTitleUnavailable: {
    color: colors.mutedText,
    fontStyle: 'italic',
  },

  seriesBookMeta: {
    color: colors.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 5,
  },

  currentBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  currentBookLabel: {
    color: colors.softGold,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginLeft: 4,
  },

  descriptionSection: {
    marginTop: 30,
  },

  sectionHeading: {
    color: colors.text,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 25,
    marginBottom: 12,
  },

  description: {
    color: colors.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 24,
  },

  noDescription: {
    color: colors.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 22,
  },

  readMore: {
    color: colors.gold,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginTop: 10,
  },

  communityReviewsSection: {
    marginTop: 32,
  },

  communityReviewsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  communityReviewsSubtitle: {
    color: colors.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    marginTop: -5,
  },

  communityReviewCount: {
    minWidth: 30,
    height: 26,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.elevated,
    paddingHorizontal: 8,
    marginTop: 3,
  },

  communityReviewCountText: {
    color: colors.secondaryText,
    fontFamily: 'Inter_700Bold',
    fontSize: 10.5,
  },

  spoilerWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 13,
    backgroundColor: colors.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },

  spoilerWarningText: {
    flex: 1,
    color: colors.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },

  communityReviewsLoading: {
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  communityReviewsLoadingText: {
    color: colors.mutedText,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },

  communityReviewList: {
    gap: 11,
    marginTop: 14,
  },

  communityReviewCard: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },

  communityReviewIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  communityReviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.elevated,
  },

  communityReviewAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.elevated,
  },

  communityReviewAvatarText: {
    color: colors.text,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 14,
  },

  communityReviewIdentityCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },

  communityReviewName: {
    color: colors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 12.5,
  },

  communityReviewMeta: {
    color: colors.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 9.5,
    marginTop: 2,
  },

  communityReviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 10,
  },

  communityReviewRatingText: {
    color: colors.softGold,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },

  communityReviewBody: {
    color: colors.text,
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 13,
  },

  communityReviewReveal: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 11,
    borderRadius: 12,
    backgroundColor: colors.elevated,
  },

  communityReviewRevealIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },

  communityReviewRevealCopy: {
    flex: 1,
    marginLeft: 10,
  },

  communityReviewRevealTitle: {
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11.5,
  },

  communityReviewRevealSubtitle: {
    color: colors.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 9.5,
    marginTop: 1,
  },

  communityReviewToggle: {
    alignSelf: 'flex-start',
    marginTop: 10,
    minHeight: 30,
    justifyContent: 'center',
  },

  communityReviewToggleText: {
    color: colors.gold,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },

  communityReviewsEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    padding: 15,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },

  communityReviewsEmptyCopy: {
    flex: 1,
    marginLeft: 12,
  },

  communityReviewsEmptyTitle: {
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
  },

  communityReviewsEmptyText: {
    color: colors.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 10.5,
    marginTop: 2,
  },

  errorTitle: {
    color: colors.text,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 25,
  },

  errorText: {
    color: colors.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },

  backButtonLarge: {
    backgroundColor: colors.gold,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },

  backButtonLargeText: {
    color: colors.background,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  });
}
