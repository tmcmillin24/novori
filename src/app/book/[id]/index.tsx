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
import { useNovoriTheme } from '../../../context/theme-context';
import { supabase } from '../../../lib/supabase';
import {
  getUserBook,
  removeUserBook,
  saveUserBook,
  updateBookReadingDates,
  UserBook,
  UserBookStatus,
} from '../../../lib/user-books';

type GoogleBook = {
  id: string;
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

async function resolveClickedDiscoverBook(
  initialBook: GoogleBook,
  apiKey: string,
  clickedTitle:
    string | undefined,
  clickedAuthors:
    string[],
  clickedIsbn:
    string | undefined
) {
  if (
    bookMatchesClickedIdentity(
      initialBook,
      clickedTitle,
      clickedAuthors
    )
  ) {
    return initialBook;
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
        await fetch(
          `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
            query
          )}&maxResults=20&printType=books&projection=full&key=${apiKey}`
        );

      if (!response.ok) {
        continue;
      }

      const data:
        GoogleSearchResponse =
        await response.json();

      const matchingBook =
        (
          data.items ??
          []
        ).find(
          (candidate) =>
            bookMatchesClickedIdentity(
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
  } = useLocalSearchParams<{
    id: string;
    source?: string;
    coverUrl?: string;
    clickedTitle?: string;
    clickedAuthors?: string;
    clickedIsbn?: string;
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

  const backLabel =
    source === 'library'
      ? 'Library'
      : source === 'currently-reading'
      ? 'Currently Reading'
      : source === 'profile'
      ? 'Profile'
      : source === 'discover'
      ? 'Discover'
      : 'Back';

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

    if (source === 'discover') {
      router.replace('/(tabs)/discover');
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
        setSeries(null);
        setSeriesBooks([]);
        setSeriesExpanded(false);

        const apiKey =
          process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;

        if (!apiKey) {
          throw new Error('Google Books API key is missing.');
        }

        const response =
          await fetch(
            `https://www.googleapis.com/books/v1/volumes/${id}?key=${apiKey}`
          );

        if (
          !response.ok
        ) {
          throw new Error(
            `Google Books request failed: ${response.status}`
          );
        }

        const data:
          GoogleBook =
          await response.json();

        const resolvedBook =
          source ===
            'discover'
            ? await resolveClickedDiscoverBook(
                data,
                apiKey,
                clickedTitle,
                discoverClickedAuthors,
                clickedIsbn
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

        await loadSeries(
          resolvedBook
        );
      } catch (err) {
        console.error('Book loading error:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Could not load this book.'
        );
      } finally {
        setLoading(false);
      }
    }

    loadBook();
  }, [id]);

  useFocusEffect(
    useCallback(
      () => {
        if (
          !id ||
          source !==
            'library'
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
      ]
    )
  );

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

  async function loadSeries(currentBook: GoogleBook) {
    const isbn = getBookISBN(currentBook);

    if (!isbn) {
      console.log('No ISBN available for Hardcover lookup.');
      return;
    }

    try {
      setSeriesLoading(true);
      setSeries(null);
      setSeriesBooks([]);

      const { data, error: functionError } =
        await supabase.functions.invoke('hardcover-series', {
          body: { isbn },
        });

      if (functionError) {
        console.error(
          'Hardcover Edge Function error:',
          functionError
        );
        return;
      }

      const response = data as HardcoverSeriesResponse;

      if (response.error) {
        console.error(
          'Hardcover response error:',
          response.error,
          response.details
        );
        return;
      }

      setSeries(response.series ?? null);
      setSeriesBooks(response.books ?? []);
    } catch (err) {
      console.error('Series lookup failed:', err);
      setSeries(null);
      setSeriesBooks([]);
    } finally {
      setSeriesLoading(false);
    }
  }

  async function findGoogleBookId(
    seriesBook: HardcoverSeriesBook
  ) {
    const apiKey =
      process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;

    if (!apiKey) {
      throw new Error('Google Books API key is missing.');
    }

    const author = seriesBook.authors?.[0];
    const queryParts = [`intitle:"${seriesBook.title}"`];

    if (author) {
      queryParts.push(`inauthor:"${author}"`);
    }

    const query = queryParts.join(' ');

    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
        query
      )}&maxResults=20&key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(
        `Google Books search failed: ${response.status}`
      );
    }

    const data: GoogleSearchResponse = await response.json();
    const results = data.items ?? [];

    if (results.length === 0) {
      return null;
    }

    const wantedTitle = normalizeTitle(seriesBook.title);

    const exactTitle = results.find(
      (result) =>
        normalizeTitle(result.volumeInfo.title) === wantedTitle
    );

    if (exactTitle) {
      return exactTitle.id;
    }

    const titleAndAuthor = results.find((result) => {
      const resultTitle = normalizeTitle(result.volumeInfo.title);
      const resultAuthors = result.volumeInfo.authors ?? [];

      const titleMatches =
        resultTitle.includes(wantedTitle) ||
        wantedTitle.includes(resultTitle);

      const authorMatches =
        !author ||
        resultAuthors.some((resultAuthor) =>
          resultAuthor
            .toLowerCase()
            .includes(author.toLowerCase())
        );

      return titleMatches && authorMatches;
    });

    if (titleAndAuthor) {
      return titleAndAuthor.id;
    }

    return results[0]?.id ?? null;
  }

  async function saveReadingStatus(
    status: UserBookStatus
  ) {
    if (!book || savingStatus) {
      return;
    }

    const info = book.volumeInfo;

    const coverUrl =
      getValidatedHighResolutionCover(
        source === 'discover'
          ? discoverCoverUrl
          : savedBook?.cover_url ??
              undefined,
        info.imageLinks
      ) ??
      null;

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

  function confirmRemoveFromLibrary() {
    if (
      !book ||
      !readingStatus ||
      savingStatus ||
      removingBook
    ) {
      return;
    }

    const removalMessage =
      savedBook?.status ===
      'want_to_read'
        ? `Remove ${book.volumeInfo.title ?? 'this book'} from your Novori library? This will also remove its saved rating and review.`
        : `Remove ${book.volumeInfo.title ?? 'this book'} from your Novori library? This permanently deletes its private Reading Details — including summary, notes, and checkpoints — along with its saved rating and review.`;

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
    if (series?.currentPosition === seriesBook.position) {
      return;
    }

    const displayTitle = getDisplayTitle(
      seriesBook.title
    );

    if (displayTitle === 'Unannounced') {
      Alert.alert(
        displayTitle,
        'This book does not have a usable title yet.'
      );
      return;
    }

    try {
      setOpeningSeriesBookId(seriesBook.id);

      const googleBookId = await findGoogleBookId(seriesBook);

      if (!googleBookId) {
        Alert.alert(
          'Book not found',
          'Novori could not find this book in Google Books yet.'
        );
        return;
      }

      router.push({
        pathname: '/book/[id]',
        params: {
          id: googleBookId,
          ...(source
            ? {
                source,
              }
            : {}),
        },
      });
    } catch (err) {
      console.error('Could not open series book:', err);

      Alert.alert(
        'Could not open book',
        'Novori had trouble finding this book. Please try again.'
      );
    } finally {
      setOpeningSeriesBookId(null);
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

  const cover =
    getValidatedHighResolutionCover(
      source === 'discover'
        ? discoverCoverUrl
        : savedBook?.cover_url ??
            undefined,
      info.imageLinks
    );

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
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {source ===
        'library' ? (
          <View
            style={
              styles.libraryBookHero
            }
          >
            {cover ? (
              <Image
                source={{
                  uri:
                    cover,
                }}
                style={
                  styles.libraryBookCover
                }
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
                {info.authors?.join(
                  ', '
                ) ??
                  'Unknown author'}
              </Text>

              <View
                style={
                  styles.libraryHeroMetaRow
                }
              >
                {readingStatus ? (
                  <View
                    style={
                      styles.libraryStatusPill
                    }
                  >
                    <Text
                      style={
                        styles.libraryStatusPillText
                      }
                    >
                      {
                        statuses.find(
                          (
                            status
                          ) =>
                            status.value ===
                            readingStatus
                        )?.label
                      }
                    </Text>
                  </View>
                ) : null}

                {series ? (
                  <Text
                    style={
                      styles.librarySeriesMeta
                    }
                  >
                    {series.currentPosition
                      ? `Book ${series.currentPosition}`
                      : series.name}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        ) : (
          <View
            style={
              styles.hero
            }
          >
            {cover ? (
              <Image
                source={{
                  uri:
                    cover,
                }}
                style={
                  styles.cover
                }
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
              {info.authors?.join(
                ', '
              ) ??
                'Unknown author'}
            </Text>

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

        {source ===
          'library' &&
        savedBook &&
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
              <View
                style={
                  styles.reviewEmptyContent
                }
              >
                <View
                  style={
                    styles.reviewEmptyStars
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
                    ) => (
                      <Ionicons
                        key={
                          starNumber
                        }
                        name="star-outline"
                        size={
                          22
                        }
                        color={
                          colors.gold
                        }
                      />
                    )
                  )}
                </View>

                <Text
                  style={
                    styles.reviewEmptyTitle
                  }
                >
                  No review yet
                </Text>

                <Text
                  style={
                    styles.reviewEmptySubtitle
                  }
                >
                  Add one whenever you want — it stays with this book.
                </Text>

                <Pressable
                  onPress={
                    openRateReview
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.reviewPrimaryButton,
                    styles.reviewEmptyButton,
                    pressed &&
                      styles.reviewButtonPressed,
                  ]}
                >
                  <Ionicons
                    name="star-outline"
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
                    Rate & Review
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : null}

        {source ===
          'library' &&
        savedBook ? (
          <View
            style={
              styles.libraryReadingPanel
            }
          >
            <View
              style={
                styles.libraryReadingPanelHeader
              }
            >
              <View>
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
                  Reading record
                </Text>
              </View>

              {savedBook.status !==
                'want_to_read' ? (
                <Pressable
                  onPress={
                    openReadingDateEditor
                  }
                  hitSlop={
                    8
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.libraryReadingEdit,
                    pressed &&
                      styles.reviewButtonPressed,
                  ]}
                >
                  <Ionicons
                    name="create-outline"
                    size={
                      15
                    }
                    color={
                      colors.gold
                    }
                  />
                  <Text
                    style={
                      styles.libraryReadingEditText
                    }
                  >
                    Dates
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View
              style={
                styles.libraryStatusSelector
              }
            >
              {statuses.map(
                (
                  status
                ) => {
                  const selected =
                    readingStatus ===
                    status.value;

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
                        selected &&
                          styles.libraryStatusChoiceSelected,
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
                          <Ionicons
                            name={
                              status.icon
                            }
                            size={
                              16
                            }
                            color={
                              selected
                                ? colors.gold
                                : colors.mutedText
                            }
                          />

                          <Text
                            style={[
                              styles.libraryStatusChoiceText,
                              selected &&
                                styles.libraryStatusChoiceTextSelected,
                            ]}
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

            {savedBook.status !==
              'want_to_read' ? (
              <View
                style={
                  styles.libraryDateSummary
                }
              >
                <View
                  style={
                    styles.libraryDateSummaryItem
                  }
                >
                  <Text
                    style={
                      styles.libraryDateSummaryLabel
                    }
                  >
                    Started
                  </Text>
                  <Text
                    style={
                      styles.libraryDateSummaryValue
                    }
                  >
                    {formatReadingDate(
                      savedBook.started_at
                    )}
                  </Text>
                </View>

                <View
                  style={
                    styles.libraryDateSummaryDivider
                  }
                />

                <View
                  style={
                    styles.libraryDateSummaryItem
                  }
                >
                  <Text
                    style={
                      styles.libraryDateSummaryLabel
                    }
                  >
                    {savedBook.status ===
                    'dnf'
                      ? 'Stopped'
                      : savedBook.status ===
                        'read'
                      ? 'Finished'
                      : 'Status'}
                  </Text>
                  <Text
                    style={
                      styles.libraryDateSummaryValue
                    }
                  >
                    {savedBook.status ===
                    'read'
                      ? formatReadingDate(
                          savedBook.finished_at
                        )
                      : savedBook.status ===
                        'dnf'
                      ? formatReadingDate(
                          savedBook.dnf_at
                        )
                      : 'Reading'}
                  </Text>
                </View>
              </View>
            ) : (
              <Text
                style={
                  styles.libraryTbrHint
                }
              >
                Saved for later. Move it to Reading whenever you start.
              </Text>
            )}
          </View>
        ) : null}

        {source !==
          'library' ? (
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

        {source !==
          'library' &&
        source !==
          'discover' &&
        savedBook &&
        savedBook.status !==
          'want_to_read' ? (
          <View
            style={[
              styles.readingDatesSection,
              source ===
                'library' &&
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
                source ===
                  'library' &&
                  styles.libraryReadingDatesCard,
              ]}
            >
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
              source ===
                'library' &&
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
                  source ===
                    'library' &&
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

        <Pressable style={styles.communityCard}>
          <View style={styles.communityIcon}>
            <Ionicons
              name="chatbubbles-outline"
              size={24}
              color={colors.gold}
            />
          </View>

          <View style={styles.communityText}>
            <Text style={styles.communityTitle}>
              Discuss this book
            </Text>
            <Text style={styles.communityDescription}>
              Reviews, reactions, questions, and reader discussions.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={21}
            color={colors.mutedText}
          />
        </Pressable>
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

  libraryStatusPill: {
    minHeight: 27,
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor:
      colors.surface,
    borderWidth: 1,
    borderColor:
      colors.gold,
  },

  libraryStatusPillText: {
    color:
      colors.gold,
    fontFamily:
      'Inter_700Bold',
    fontSize: 10.5,
    letterSpacing: 0.2,
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

  libraryReadingPanelTitle: {
    color:
      colors.text,
    fontFamily:
      'Inter_700Bold',
    fontSize: 15,
    marginTop: 3,
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
      colors.elevated,
    borderWidth: 1,
    borderColor:
      'transparent',
    paddingHorizontal: 3,
  },

  libraryStatusChoiceSelected: {
    borderColor:
      colors.gold,
    backgroundColor:
      colors.surface,
  },

  libraryStatusChoicePressed: {
    opacity: 0.68,
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

  reviewEmptyContent: {
    marginTop: 7,
    alignItems: 'flex-start',
    paddingBottom: 3,
  },

  reviewEmptyStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  reviewEmptyTitle: {
    color:
      colors.text,
    fontFamily:
      'Inter_600SemiBold',
    fontSize: 13.5,
    marginTop: 8,
  },

  reviewEmptySubtitle: {
    color:
      colors.secondaryText,
    fontFamily:
      'Inter_400Regular',
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 3,
  },

  reviewEmptyButton: {
    marginTop: 12,
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

  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 17,
    marginTop: 32,
  },

  communityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  communityText: {
    flex: 1,
    marginLeft: 13,
    marginRight: 10,
  },

  communityTitle: {
    color: colors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },

  communityDescription: {
    color: colors.mutedText,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
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
