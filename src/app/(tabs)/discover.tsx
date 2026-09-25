import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../constants/novori-theme';
import {
  cancelFollowRequest,
  followReader,
  unfollowReader,
} from '../../lib/feed';
import {
  ReaderConnection,
  searchReaders,
} from '../../lib/social';
import { supabase } from '../../lib/supabase';

type GoogleBookItem = {
  id: string;

  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;

    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };

    industryIdentifiers?: {
      type: string;
      identifier: string;
    }[];

    pageCount?: number;
    categories?: string[];
  };
};

type GoogleBooksResponse = {
  totalItems?: number;
  items?: GoogleBookItem[];
};

type TrendingBook = {
  rank: number;
  id: number;
  title: string;
  slug: string | null;
  releaseDate?: string | null;
  releaseYear: number | null;
  rating: number | null;
  usersCount: number | null;
  coverUrl: string | null;
  authors: string[];
  isbns: string[];
  genres: string[];
};

type TrendingResponse = {
  books?: TrendingBook[];
  windowDays?: number;
  source?: string;
  cache?: {
    status?: string;
    refreshedAt?: string;
    ttlSeconds?: number;
  };
  error?: string;
  details?: unknown;
};

type RecentReleasesResponse = {
  books?: TrendingBook[];
  windowMonths?: number;
  source?: string;
  cache?: {
    status?: string;
    refreshedAt?: string;
    ttlSeconds?: number;
  };
  error?: string;
  details?: unknown;
};

const SEARCH_DELAY_MS = 350;
const MIN_SEARCH_LENGTH = 2;
const DISCOVER_AUTO_REFRESH_MS =
  3 * 60 * 60 * 1000;
const READER_SEARCH_DELAY_MS = 300;
const MIN_READER_SEARCH_LENGTH = 2;

type DiscoverMode =
  | 'books'
  | 'readers';

type GenreNode = {
  key: string;
  label: string;
  shortLabel?: string;
  terms: string[];
  allTerms?: string[];
  excludeTerms?: string[];
  children?: GenreNode[];
};

// Discover intentionally exposes only two levels:
// broad genre -> subgenre. Hardcover still supplies the
// underlying tags, while Novori owns the cleaner navigation.
const GENRE_TREE: GenreNode[] = [
  {
    key: 'fantasy',
    label: 'Fantasy',
    terms: ['fantasy'],
    children: [
      {
        key: 'epic-fantasy',
        label: 'Epic Fantasy',
        shortLabel: 'Epic',
        terms: ['epic fantasy', 'high fantasy'],
      },
      {
        key: 'romantic-fantasy',
        label: 'Romantic Fantasy',
        shortLabel: 'Romantic',
        terms: ['romantic fantasy', 'fantasy romance', 'romantasy'],
        allTerms: ['fantasy', 'romance'],
      },
      {
        key: 'dark-fantasy',
        label: 'Dark Fantasy',
        shortLabel: 'Dark',
        terms: ['dark fantasy'],
      },
      {
        key: 'urban-fantasy',
        label: 'Urban Fantasy',
        shortLabel: 'Urban',
        terms: ['urban fantasy'],
      },
      {
        key: 'cozy-fantasy',
        label: 'Cozy Fantasy',
        shortLabel: 'Cozy',
        terms: ['cozy fantasy'],
      },
      {
        key: 'historical-fantasy',
        label: 'Historical Fantasy',
        shortLabel: 'Historical',
        terms: ['historical fantasy'],
      },
    ],
  },
  {
    key: 'romance',
    label: 'Romance',
    terms: ['romance'],
    excludeTerms: [
      'fantasy',
      'romantasy',
      'romantic fantasy',
      'fantasy romance',
    ],
    children: [
      {
        key: 'contemporary-romance',
        label: 'Contemporary Romance',
        shortLabel: 'Contemporary',
        terms: ['contemporary romance'],
        allTerms: ['contemporary', 'romance'],
      },
      {
        key: 'historical-romance',
        label: 'Historical Romance',
        shortLabel: 'Historical',
        terms: ['historical romance'],
        allTerms: ['historical', 'romance'],
      },
      {
        key: 'romantic-comedy',
        label: 'Romantic Comedy',
        shortLabel: 'Rom-Com',
        terms: ['romantic comedy', 'romcom', 'rom com'],
      },
      {
        key: 'dark-romance',
        label: 'Dark Romance',
        shortLabel: 'Dark',
        terms: ['dark romance'],
        allTerms: ['dark', 'romance'],
      },
      {
        key: 'sports-romance',
        label: 'Sports Romance',
        shortLabel: 'Sports',
        terms: ['sports romance'],
        allTerms: ['sports', 'romance'],
      },
    ],
  },
  {
    key: 'mystery-thriller',
    label: 'Mystery & Thriller',
    terms: ['mystery', 'thriller', 'crime', 'suspense'],
    children: [
      {
        key: 'mystery',
        label: 'Mystery',
        terms: ['mystery'],
      },
      {
        key: 'thriller',
        label: 'Thriller',
        terms: ['thriller'],
      },
      {
        key: 'crime',
        label: 'Crime',
        terms: ['crime'],
      },
      {
        key: 'cozy-mystery',
        label: 'Cozy Mystery',
        shortLabel: 'Cozy',
        terms: ['cozy mystery'],
      },
      {
        key: 'psychological-thriller',
        label: 'Psychological Thriller',
        shortLabel: 'Psychological',
        terms: ['psychological thriller'],
      },
    ],
  },
  {
    key: 'science-fiction',
    label: 'Science Fiction',
    terms: ['science fiction', 'sci fi'],
    children: [
      {
        key: 'space-opera',
        label: 'Space Opera',
        terms: ['space opera'],
      },
      {
        key: 'dystopian',
        label: 'Dystopian',
        terms: ['dystopian', 'dystopia'],
      },
      {
        key: 'cyberpunk',
        label: 'Cyberpunk',
        terms: ['cyberpunk'],
      },
      {
        key: 'time-travel',
        label: 'Time Travel',
        terms: ['time travel'],
      },
      {
        key: 'military-science-fiction',
        label: 'Military Sci-Fi',
        shortLabel: 'Military',
        terms: ['military science fiction', 'military sci fi'],
      },
    ],
  },
  {
    key: 'horror',
    label: 'Horror',
    terms: ['horror'],
    children: [
      {
        key: 'gothic-horror',
        label: 'Gothic Horror',
        shortLabel: 'Gothic',
        terms: ['gothic horror', 'gothic'],
      },
      {
        key: 'psychological-horror',
        label: 'Psychological Horror',
        shortLabel: 'Psychological',
        terms: ['psychological horror'],
      },
      {
        key: 'supernatural-horror',
        label: 'Supernatural Horror',
        shortLabel: 'Supernatural',
        terms: ['supernatural horror'],
      },
      {
        key: 'cosmic-horror',
        label: 'Cosmic Horror',
        shortLabel: 'Cosmic',
        terms: ['cosmic horror'],
      },
    ],
  },
  {
    key: 'historical',
    label: 'Historical',
    terms: ['historical fiction'],
    children: [
      {
        key: 'historical-fiction',
        label: 'Historical Fiction',
        shortLabel: 'Fiction',
        terms: ['historical fiction'],
      },
      {
        key: 'historical-mystery',
        label: 'Historical Mystery',
        shortLabel: 'Mystery',
        terms: ['historical mystery'],
        allTerms: ['historical', 'mystery'],
      },
    ],
  },
  {
    key: 'young-adult',
    label: 'Young Adult',
    terms: ['young adult', 'ya'],
    children: [
      {
        key: 'ya-fantasy',
        label: 'YA Fantasy',
        shortLabel: 'Fantasy',
        terms: ['young adult fantasy', 'ya fantasy'],
        allTerms: ['young adult', 'fantasy'],
      },
      {
        key: 'ya-romance',
        label: 'YA Romance',
        shortLabel: 'Romance',
        terms: ['young adult romance', 'ya romance'],
        allTerms: ['young adult', 'romance'],
      },
      {
        key: 'ya-thriller',
        label: 'YA Thriller',
        shortLabel: 'Thriller',
        terms: ['young adult thriller', 'ya thriller'],
        allTerms: ['young adult', 'thriller'],
      },
    ],
  },
  {
    key: 'nonfiction',
    label: 'Nonfiction',
    terms: ['nonfiction', 'non fiction', 'memoir', 'biography'],
    children: [
      {
        key: 'memoir',
        label: 'Memoir',
        terms: ['memoir'],
      },
      {
        key: 'biography',
        label: 'Biography',
        terms: ['biography'],
      },
      {
        key: 'history-nonfiction',
        label: 'History',
        terms: ['history'],
      },
      {
        key: 'science-nonfiction',
        label: 'Science',
        terms: ['science'],
      },
      {
        key: 'true-crime',
        label: 'True Crime',
        terms: ['true crime'],
      },
      {
        key: 'self-help',
        label: 'Self-Help',
        terms: ['self help', 'self improvement'],
      },
    ],
  },
];

function normalizeGenre(value?: string) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tagContainsTerm(
  normalizedTags: string[],
  rawTerm: string
) {
  const term = normalizeGenre(rawTerm);

  return normalizedTags.some(
    (tag) =>
      tag === term ||
      tag.includes(term)
  );
}

function bookMatchesGenreNode(
  book: TrendingBook,
  node: GenreNode | null
) {
  if (!node) {
    return true;
  }

  const normalizedTags =
    (book.genres ?? []).map(
      normalizeGenre
    );

  if (
    node.excludeTerms?.some(
      (term) =>
        tagContainsTerm(
          normalizedTags,
          term
        )
    )
  ) {
    return false;
  }

  const matchesAnyTerm =
    node.terms.some(
      (term) =>
        tagContainsTerm(
          normalizedTags,
          term
        )
    );

  const matchesAllTerms =
    node.allTerms?.length
      ? node.allTerms.every(
          (term) =>
            tagContainsTerm(
              normalizedTags,
              term
            )
        )
      : false;

  return (
    matchesAnyTerm ||
    matchesAllTerms
  );
}

function diversifyByAuthor(
  books: TrendingBook[],
  limit = 12
) {
  const result: TrendingBook[] = [];
  const addedIds = new Set<number>();
  const authorCounts =
    new Map<string, number>();

  // First pass: one book per primary author.
  // Second pass: allow one additional book per
  // author if the genre still needs more titles.
  for (const maxPerAuthor of [1, 2]) {
    for (const book of books) {
      if (result.length >= limit) {
        return result;
      }

      if (addedIds.has(book.id)) {
        continue;
      }

      const primaryAuthor =
        book.authors?.[0]
          ?.trim()
          .toLowerCase() ||
        `unknown-${book.id}`;

      const currentCount =
        authorCounts.get(
          primaryAuthor
        ) ?? 0;

      if (
        currentCount >=
        maxPerAuthor
      ) {
        continue;
      }

      result.push(book);
      addedIds.add(book.id);
      authorCounts.set(
        primaryAuthor,
        currentCount + 1
      );
    }
  }

  return result;
}

function normalizeTitle(value?: string) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export default function DiscoverScreen() {
  const router = useRouter();

  const preserveDiscoverStateOnNextBlur =
    useRef(false);


  const [
    discoverMode,
    setDiscoverMode,
  ] =
    useState<DiscoverMode>(
      'books'
    );

  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<GoogleBookItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [
    readerQuery,
    setReaderQuery,
  ] =
    useState('');
  const [
    readerResults,
    setReaderResults,
  ] =
    useState<ReaderConnection[]>(
      []
    );
  const [
    readerLoading,
    setReaderLoading,
  ] =
    useState(false);
  const [
    readerError,
    setReaderError,
  ] =
    useState('');
  const [
    readerFollowBusyId,
    setReaderFollowBusyId,
  ] =
    useState<string | null>(
      null
    );

  const [trendingBooks, setTrendingBooks] =
    useState<TrendingBook[]>([]);
  const [trendingLoading, setTrendingLoading] =
    useState(true);
  const [trendingError, setTrendingError] =
    useState('');
  const [recentReleasePool, setRecentReleasePool] =
    useState<TrendingBook[]>([]);
  const [recentReleasesLoading, setRecentReleasesLoading] =
    useState(true);
  const [recentReleasesError, setRecentReleasesError] =
    useState('');
  const [discoverRefreshing, setDiscoverRefreshing] =
    useState(false);
  const [openingTrendingBookId, setOpeningTrendingBookId] =
    useState<number | null>(null);
  const [activeTrendingGenreKey, setActiveTrendingGenreKey] =
    useState<string>('all');
  const [genrePath, setGenrePath] =
    useState<GenreNode[]>([]);
  const [genreMenuVisible, setGenreMenuVisible] =
    useState(false);
  const [genreDropdownScrollY, setGenreDropdownScrollY] =
    useState(0);
  const [genreDropdownContentHeight, setGenreDropdownContentHeight] =
    useState(0);
  const [genreDropdownViewportHeight, setGenreDropdownViewportHeight] =
    useState(0);

  const debounceTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const latestRequestRef =
    useRef(0);

  const readerDebounceTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const latestReaderRequestRef =
    useRef(0);

  const trendingListRef =
    useRef<ScrollView | null>(null);

  const genreChipsScrollRef =
    useRef<ScrollView | null>(null);

  const lastDiscoverRefreshRef =
    useRef(0);

  const discoverRefreshInFlightRef =
    useRef(false);

  useFocusEffect(
    useCallback(
      () => {
        return () => {
          if (
            preserveDiscoverStateOnNextBlur.current
          ) {
            preserveDiscoverStateOnNextBlur.current =
              false;
            return;
          }

          setDiscoverMode(
            'books'
          );

          setQuery(
            ''
          );
          setBooks(
            []
          );
          setLoading(
            false
          );
          setError(
            ''
          );

          setReaderQuery(
            ''
          );
          setReaderResults(
            []
          );
          setReaderLoading(
            false
          );
          setReaderError(
            ''
          );
          setReaderFollowBusyId(
            null
          );

          setActiveTrendingGenreKey(
            'all'
          );
          setGenrePath(
            []
          );
          setGenreMenuVisible(
            false
          );
          setOpeningTrendingBookId(
            null
          );

          latestRequestRef.current +=
            1;
          latestReaderRequestRef.current +=
            1;

          if (
            debounceTimerRef.current
          ) {
            clearTimeout(
              debounceTimerRef.current
            );
            debounceTimerRef.current =
              null;
          }

          if (
            readerDebounceTimerRef.current
          ) {
            clearTimeout(
              readerDebounceTimerRef.current
            );
            readerDebounceTimerRef.current =
              null;
          }
        };
      },
      []
    )
  );

  useEffect(() => {
    refreshDiscoverData(
      false,
      false,
      false
    );

    const refreshInterval =
      setInterval(() => {
        if (
          Date.now() -
            lastDiscoverRefreshRef.current >=
          DISCOVER_AUTO_REFRESH_MS
        ) {
          refreshDiscoverData(
            true,
            false,
            false
          );
        }
      }, DISCOVER_AUTO_REFRESH_MS);

    const appStateSubscription =
      AppState.addEventListener(
        'change',
        (nextAppState) => {
          if (
            nextAppState === 'active' &&
            Date.now() -
              lastDiscoverRefreshRef.current >=
              DISCOVER_AUTO_REFRESH_MS
          ) {
            refreshDiscoverData(
              true,
              false,
              false
            );
          }
        }
      );

    return () => {
      clearInterval(
        refreshInterval
      );
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    // Keep the book carousel visually anchored while users
    // narrow their genre. Only reset the subgenre strip when
    // the broad genre itself changes.
    const frame = requestAnimationFrame(() => {
      genreChipsScrollRef.current?.scrollTo({
        x: 0,
        y: 0,
        animated: false,
      });
    });

    return () =>
      cancelAnimationFrame(frame);
  }, [genrePath[0]?.key]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(
        debounceTimerRef.current
      );
    }

    const trimmedQuery =
      query.trim();

    if (
      trimmedQuery.length <
      MIN_SEARCH_LENGTH
    ) {
      latestRequestRef.current += 1;
      setBooks([]);
      setError('');
      setLoading(false);
      return;
    }

    const requestId =
      ++latestRequestRef.current;

    debounceTimerRef.current =
      setTimeout(() => {
        performSearch(
          trimmedQuery,
          requestId
        );
      }, SEARCH_DELAY_MS);

    return () => {
      if (
        debounceTimerRef.current
      ) {
        clearTimeout(
          debounceTimerRef.current
        );
      }
    };
  }, [query]);

  useEffect(() => {
    if (
      readerDebounceTimerRef.current
    ) {
      clearTimeout(
        readerDebounceTimerRef.current
      );
    }

    const trimmedQuery =
      readerQuery
        .trim();

    if (
      trimmedQuery.length <
      MIN_READER_SEARCH_LENGTH
    ) {
      latestReaderRequestRef.current += 1;
      setReaderResults(
        []
      );
      setReaderError(
        ''
      );
      setReaderLoading(
        false
      );
      return;
    }

    const requestId =
      ++latestReaderRequestRef.current;

    readerDebounceTimerRef.current =
      setTimeout(() => {
        performReaderSearch(
          trimmedQuery,
          requestId
        );
      }, READER_SEARCH_DELAY_MS);

    return () => {
      if (
        readerDebounceTimerRef.current
      ) {
        clearTimeout(
          readerDebounceTimerRef.current
        );
      }
    };
  }, [
    readerQuery,
  ]);

  async function loadTrendingBooks(
    silent = false,
    forceRefresh = false
  ) {
    try {
      if (!silent) {
        setTrendingLoading(true);
        setTrendingError('');
      }

      const {
        data,
        error: functionError,
      } = await supabase.functions.invoke(
        'hardcover-trending',
        {
          body: {
            days: 90,
            poolSize: 100,
            forceRefresh,
          },
        }
      );

      if (functionError) {
        throw functionError;
      }

      const response =
        data as TrendingResponse;

      if (response?.error) {
        throw new Error(
          response.error
        );
      }

      setTrendingBooks(
        response?.books ?? []
      );
      setTrendingError('');
    } catch (err) {
      console.error(
        'Could not load trending books:',
        err
      );

      if (!silent) {
        setTrendingBooks([]);
        setTrendingError(
          'Trending books are unavailable right now.'
        );
      }
    } finally {
      if (!silent) {
        setTrendingLoading(false);
      }
    }
  }

  async function loadRecentReleases(
    silent = false,
    forceRefresh = false
  ) {
    try {
      if (!silent) {
        setRecentReleasesLoading(true);
        setRecentReleasesError('');
      }

      const {
        data,
        error: functionError,
      } = await supabase.functions.invoke(
        'hardcover-recent-releases',
        {
          body: {
            months: 18,
            poolSize: 150,
            forceRefresh,
          },
        }
      );

      if (functionError) {
        throw functionError;
      }

      const response =
        data as RecentReleasesResponse;

      if (response?.error) {
        throw new Error(
          response.error
        );
      }

      setRecentReleasePool(
        response?.books ?? []
      );
      setRecentReleasesError('');
    } catch (err) {
      console.error(
        'Could not load recent releases:',
        err
      );

      if (!silent) {
        setRecentReleasePool([]);
        setRecentReleasesError(
          'Recent releases are unavailable right now.'
        );
      }
    } finally {
      if (!silent) {
        setRecentReleasesLoading(false);
      }
    }
  }

  async function refreshDiscoverData(
    silent: boolean,
    forceRefresh: boolean,
    showPullSpinner: boolean
  ) {
    if (
      discoverRefreshInFlightRef.current
    ) {
      return;
    }

    discoverRefreshInFlightRef.current =
      true;

    if (showPullSpinner) {
      setDiscoverRefreshing(true);
    }

    try {
      await Promise.all([
        loadTrendingBooks(
          silent,
          forceRefresh
        ),
        loadRecentReleases(
          silent,
          forceRefresh
        ),
      ]);

      lastDiscoverRefreshRef.current =
        Date.now();
    } finally {
      discoverRefreshInFlightRef.current =
        false;

      if (showPullSpinner) {
        setDiscoverRefreshing(false);
      }
    }
  }

  function handleDiscoverRefresh() {
    refreshDiscoverData(
      true,
      true,
      true
    );
  }

  async function performReaderSearch(
    searchTerm: string,
    requestId: number
  ) {
    try {
      setReaderLoading(
        true
      );
      setReaderError(
        ''
      );

      const results =
        await searchReaders(
          searchTerm
        );

      if (
        requestId !==
        latestReaderRequestRef.current
      ) {
        return;
      }

      setReaderResults(
        results
      );
    } catch (
      err
    ) {
      if (
        requestId !==
        latestReaderRequestRef.current
      ) {
        return;
      }

      console.error(
        'Reader search error:',
        err
      );

      setReaderError(
        'Could not search readers. Please try again.'
      );
      setReaderResults(
        []
      );
    } finally {
      if (
        requestId ===
        latestReaderRequestRef.current
      ) {
        setReaderLoading(
          false
        );
      }
    }
  }

  function searchReadersImmediately() {
    if (
      readerDebounceTimerRef.current
    ) {
      clearTimeout(
        readerDebounceTimerRef.current
      );
    }

    const trimmedQuery =
      readerQuery
        .trim();

    if (
      trimmedQuery.length <
      MIN_READER_SEARCH_LENGTH
    ) {
      return;
    }

    const requestId =
      ++latestReaderRequestRef.current;

    performReaderSearch(
      trimmedQuery,
      requestId
    );
  }

  async function performSearch(
    searchTerm: string,
    requestId: number
  ) {
    try {
      setLoading(true);
      setError('');

      const apiKey =
        process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;

      if (!apiKey) {
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
          `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=40&printType=books&key=${apiKey}`
        );

      if (!response.ok) {
        throw new Error(
          `Google Books request failed: ${response.status}`
        );
      }

      const data:
        GoogleBooksResponse =
        await response.json();

      if (
        requestId !==
        latestRequestRef.current
      ) {
        return;
      }

      setBooks(
        data.items ?? []
      );
    } catch (err) {
      if (
        requestId !==
        latestRequestRef.current
      ) {
        return;
      }

      console.error(
        'Google Books search error:',
        err
      );

      setError(
        'Could not search books. Please try again.'
      );

      setBooks([]);
    } finally {
      if (
        requestId ===
        latestRequestRef.current
      ) {
        setLoading(false);
      }
    }
  }

  function searchImmediately() {
    if (
      debounceTimerRef.current
    ) {
      clearTimeout(
        debounceTimerRef.current
      );
    }

    const trimmedQuery =
      query.trim();

    if (
      trimmedQuery.length <
      MIN_SEARCH_LENGTH
    ) {
      return;
    }

    const requestId =
      ++latestRequestRef.current;

    performSearch(
      trimmedQuery,
      requestId
    );
  }

  function openReader(
    readerId: string
  ) {
    preserveDiscoverStateOnNextBlur.current =
      true;

    router.push({
      pathname:
        '/reader/[id]',
      params: {
        id:
          readerId,
      },
    });
  }

  async function toggleReaderFollow(
    reader:
      ReaderConnection
  ) {
    if (
      reader.is_self
    ) {
      return;
    }

    try {
      setReaderFollowBusyId(
        reader.id
      );

      if (
        reader.is_following
      ) {
        await unfollowReader(
          reader.id
        );
      } else if (
        reader.follow_request_pending
      ) {
        await cancelFollowRequest(
          reader.id
        );
      } else {
        await followReader(
          reader.id
        );
      }

      const searchTerm =
        readerQuery
          .trim();

      if (
        searchTerm.length >=
        MIN_READER_SEARCH_LENGTH
      ) {
        const requestId =
          ++latestReaderRequestRef.current;

        await performReaderSearch(
          searchTerm,
          requestId
        );
      }
    } catch (
      followError
    ) {
      console.error(
        'Could not update follow from Discover:',
        followError
      );

      Alert.alert(
        'Could not update follow',
        'Please try again.'
      );
    } finally {
      setReaderFollowBusyId(
        null
      );
    }
  }

  function openBook(
    bookId: string
  ) {
    preserveDiscoverStateOnNextBlur.current =
      true;

    router.push({
      pathname:
        '/book/[id]',
      params: {
        id: bookId,
        source: 'discover',
      },
    });
  }

  async function findGoogleBookIdForTrending(
    trendingBook: TrendingBook
  ) {
    const apiKey =
      process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;

    if (!apiKey) {
      throw new Error(
        'Google Books API key is missing.'
      );
    }

    for (
      const isbn of trendingBook.isbns.slice(0, 6)
    ) {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
          `isbn:${isbn}`
        )}&maxResults=5&printType=books&key=${apiKey}`
      );

      if (!response.ok) {
        continue;
      }

      const data:
        GoogleBooksResponse =
        await response.json();

      const results =
        data.items ?? [];

      const exactIsbnMatch =
        results.find(
          (result) =>
            result.volumeInfo
              .industryIdentifiers
              ?.some(
                (identifier) =>
                  identifier.identifier ===
                  isbn
              )
        );

      if (exactIsbnMatch) {
        return exactIsbnMatch.id;
      }

      if (results[0]?.id) {
        return results[0].id;
      }
    }

    const author =
      trendingBook.authors?.[0];

    const queryParts = [
      `intitle:"${trendingBook.title}"`,
    ];

    if (author) {
      queryParts.push(
        `inauthor:"${author}"`
      );
    }

    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
        queryParts.join(' ')
      )}&maxResults=20&printType=books&key=${apiKey}`
    );

    if (!response.ok) {
      throw new Error(
        `Google Books search failed: ${response.status}`
      );
    }

    const data:
      GoogleBooksResponse =
      await response.json();

    const results =
      data.items ?? [];

    if (results.length === 0) {
      return null;
    }

    const wantedTitle =
      normalizeTitle(
        trendingBook.title
      );

    const exactTitle =
      results.find(
        (result) =>
          normalizeTitle(
            result.volumeInfo.title
          ) === wantedTitle
      );

    if (exactTitle) {
      return exactTitle.id;
    }

    const titleAndAuthor =
      results.find(
        (result) => {
          const resultTitle =
            normalizeTitle(
              result.volumeInfo.title
            );

          const resultAuthors =
            result.volumeInfo
              .authors ?? [];

          const titleMatches =
            resultTitle.includes(
              wantedTitle
            ) ||
            wantedTitle.includes(
              resultTitle
            );

          const authorMatches =
            !author ||
            resultAuthors.some(
              (resultAuthor) =>
                resultAuthor
                  .toLowerCase()
                  .includes(
                    author.toLowerCase()
                  ) ||
                author
                  .toLowerCase()
                  .includes(
                    resultAuthor.toLowerCase()
                  )
            );

          return (
            titleMatches &&
            authorMatches
          );
        }
      );

    return (
      titleAndAuthor?.id ??
      results[0]?.id ??
      null
    );
  }

  async function openTrendingBook(
    trendingBook: TrendingBook
  ) {
    if (openingTrendingBookId !== null) {
      return;
    }

    try {
      setOpeningTrendingBookId(
        trendingBook.id
      );

      const googleBookId =
        await findGoogleBookIdForTrending(
          trendingBook
        );

      if (!googleBookId) {
        Alert.alert(
          'Book not found',
          'Novori could not find this book in Google Books yet.'
        );
        return;
      }

      openBook(
        googleBookId
      );
    } catch (err) {
      console.error(
        'Could not open trending book:',
        err
      );

      Alert.alert(
        'Could not open book',
        'Novori had trouble finding this book. Please try again.'
      );
    } finally {
      setOpeningTrendingBookId(
        null
      );
    }
  }

  function selectBroadGenre(
    node: GenreNode | null
  ) {
    setGenreMenuVisible(false);

    if (!node) {
      setGenrePath([]);
      setActiveTrendingGenreKey('all');
      return;
    }

    // Broad genre selection always resets any prior subgenre.
    setGenrePath([node]);
    setActiveTrendingGenreKey(node.key);
  }

  function selectSubgenre(
    node: GenreNode | null
  ) {
    const broadGenre =
      genrePath[0];

    if (!broadGenre) {
      return;
    }

    if (!node) {
      setGenrePath([broadGenre]);
      setActiveTrendingGenreKey(
        broadGenre.key
      );
      return;
    }

    // Keep the path intentionally capped at two levels.
    setGenrePath([
      broadGenre,
      node,
    ]);
    setActiveTrendingGenreKey(
      node.key
    );
  }

  function showAllGenres() {
    selectBroadGenre(null);
  }

  function renderBook({
    item,
  }: {
    item: GoogleBookItem;
  }) {
    const info =
      item.volumeInfo;

    const cover =
      info.imageLinks
        ?.thumbnail
        ?.replace(
          'http://',
          'https://'
        ) ||
      info.imageLinks
        ?.smallThumbnail
        ?.replace(
          'http://',
          'https://'
        );

    return (
      <Pressable
        style={({
          pressed,
        }) => [
          styles.bookCard,
          pressed &&
            styles.bookCardPressed,
        ]}
        onPress={() =>
          openBook(
            item.id
          )
        }
      >
        {cover ? (
          <Image
            source={{
              uri: cover,
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
            <Text
              style={
                styles.coverPlaceholderText
              }
            >
              No Cover
            </Text>
          </View>
        )}

        <View
          style={
            styles.bookInfo
          }
        >
          <Text
            style={
              styles.bookTitle
            }
            numberOfLines={2}
          >
            {info.title ??
              'Untitled'}
          </Text>

          <Text
            style={
              styles.author
            }
            numberOfLines={1}
          >
            {info.authors
              ?.join(', ') ??
              'Unknown author'}
          </Text>

          {info.publishedDate ? (
            <Text
              style={
                styles.meta
              }
            >
              {
                info.publishedDate
              }
            </Text>
          ) : null}

          {info.pageCount ? (
            <Text
              style={
                styles.meta
              }
            >
              {
                info.pageCount
              }{' '}
              pages
            </Text>
          ) : null}

          <Text
            style={
              styles.viewDetails
            }
          >
            View details →
          </Text>
        </View>
      </Pressable>
    );
  }

  function renderReader({
    item,
  }: {
    item:
      ReaderConnection;
  }) {
    const displayName =
      item.display_name
        ?.trim() ||
      item.username
        ?.trim() ||
      'Novori Reader';

    const username =
      item.username
        ?.trim()
        ? `@${item.username.trim()}`
        : '';

    const initial =
      displayName
        .charAt(0)
        .toUpperCase();

    const isBusy =
      readerFollowBusyId ===
      item.id;

    return (
      <View
        style={
          styles.readerCard
        }
      >
        <Pressable
          onPress={() =>
            openReader(
              item.id
            )
          }
          style={({ pressed }) => [
            styles.readerMain,
            pressed &&
              styles.readerPressed,
          ]}
        >
          {item.avatar_url ? (
            <Image
              source={{
                uri:
                  item.avatar_url,
              }}
              style={
                styles.readerAvatar
              }
            />
          ) : (
            <View
              style={
                styles.readerAvatarFallback
              }
            >
              <Text
                style={
                  styles.readerAvatarText
                }
              >
                {initial}
              </Text>
            </View>
          )}

          <View
            style={
              styles.readerCopy
            }
          >
            <Text
              style={
                styles.readerName
              }
              numberOfLines={
                1
              }
            >
              {displayName}
            </Text>

            {username ? (
              <Text
                style={
                  styles.readerUsername
                }
                numberOfLines={
                  1
                }
              >
                {username}
              </Text>
            ) : null}

            <Text
              style={
                styles.readerViewProfile
              }
            >
              View profile
            </Text>
          </View>
        </Pressable>

        {item.is_self ? (
          <View
            style={
              styles.readerYouBadge
            }
          >
            <Text
              style={
                styles.readerYouBadgeText
              }
            >
              You
            </Text>
          </View>
        ) : (
          <Pressable
            disabled={
              isBusy
            }
            onPress={() =>
              toggleReaderFollow(
                item
              )
            }
            style={({ pressed }) => [
              item.is_following ||
              item.follow_request_pending
                ? styles.readerFollowingButton
                : styles.readerFollowButton,
              pressed &&
                !isBusy &&
                styles.readerPressed,
            ]}
          >
            {isBusy ? (
              <ActivityIndicator
                size="small"
                color={
                  item.is_following ||
                  item.follow_request_pending
                    ? COLORS.text
                    : COLORS.background
                }
              />
            ) : (
              <Text
                style={
                  item.is_following ||
                  item.follow_request_pending
                    ? styles.readerFollowingButtonText
                    : styles.readerFollowButtonText
                }
              >
                {item.is_following
                  ? 'Following'
                  : item.follow_request_pending
                  ? 'Requested'
                  : item.is_private
                  ? 'Request'
                  : 'Follow'}
              </Text>
            )}
          </Pressable>
        )}
      </View>
    );
  }

  function renderTrendingBook({
    item,
  }: {
    item: TrendingBook;
  }) {
    const isOpening =
      openingTrendingBookId ===
      item.id;

    return (
      <Pressable
        onPress={() =>
          openTrendingBook(
            item
          )
        }
        style={({ pressed }) => [
          styles.trendingCard,
          (pressed || isOpening) &&
            styles.bookCardPressed,
        ]}
      >
        <View
          style={
            styles.trendingCoverWrap
          }
        >
          {item.coverUrl ? (
            <Image
              source={{
                uri: item.coverUrl,
              }}
              style={
                styles.trendingCover
              }
            />
          ) : (
            <View
              style={
                styles.trendingCoverPlaceholder
              }
            >
              <Text
                style={
                  styles.coverPlaceholderText
                }
              >
                No Cover
              </Text>
            </View>
          )}

          {isOpening ? (
            <View
              style={
                styles.trendingLoadingOverlay
              }
            >
              <ActivityIndicator
                size="small"
                color={COLORS.gold}
              />
            </View>
          ) : null}
        </View>

        <Text
          style={
            styles.trendingTitle
          }
          numberOfLines={2}
        >
          {item.title}
        </Text>

        <Text
          style={
            styles.trendingAuthor
          }
          numberOfLines={1}
        >
          {item.authors?.[0] ??
            'Unknown author'}
        </Text>

        {typeof item.rating ===
        'number' ? (
          <Text
            style={
              styles.trendingRating
            }
          >
            ★ {item.rating.toFixed(1)}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  function renderRecentReleaseBook(
    item: TrendingBook
  ) {
    const isOpening =
      openingTrendingBookId ===
      item.id;

    return (
      <Pressable
        onPress={() =>
          openTrendingBook(item)
        }
        style={({ pressed }) => [
          styles.newReleaseCard,
          (pressed || isOpening) &&
            styles.bookCardPressed,
        ]}
      >
        <View
          style={
            styles.newReleaseCoverWrap
          }
        >
          {item.coverUrl ? (
            <Image
              source={{
                uri: item.coverUrl,
              }}
              style={
                styles.newReleaseCover
              }
            />
          ) : (
            <View
              style={
                styles.newReleaseCoverPlaceholder
              }
            >
              <Text
                style={
                  styles.coverPlaceholderText
                }
              >
                No Cover
              </Text>
            </View>
          )}

          {isOpening ? (
            <View
              style={
                styles.newReleaseLoadingOverlay
              }
            >
              <ActivityIndicator
                size="small"
                color={COLORS.gold}
              />
            </View>
          ) : null}
        </View>

        <Text
          style={
            styles.newReleaseTitle
          }
          numberOfLines={2}
        >
          {item.title}
        </Text>

        <Text
          style={
            styles.newReleaseAuthor
          }
          numberOfLines={1}
        >
          {item.authors?.[0] ??
            'Unknown author'}
        </Text>

        {item.releaseYear ? (
          <Text
            style={
              styles.newReleaseDate
            }
          >
            {item.releaseYear}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  const trimmedQuery =
    query.trim();

  const trimmedReaderQuery =
    readerQuery
      .trim();

  const hasReaderSearchText =
    trimmedReaderQuery.length >=
    MIN_READER_SEARCH_LENGTH;

  const hasSearchText =
    trimmedQuery.length >=
    MIN_SEARCH_LENGTH;

  const showDiscoverHome =
    trimmedQuery.length === 0;

  const activeBroadGenreNode =
    genrePath[0] ?? null;

  const activeSubgenreNode =
    genrePath[1] ?? null;

  const activeTrendingGenreNode =
    activeSubgenreNode ??
    activeBroadGenreNode;

  const visibleSubgenres =
    activeBroadGenreNode?.children ?? [];

  // Keep the overall Trending row strict, but allow genre and
  // subgenre views to search the full Hardcover trending pool.
  //
  // All Genres:
  //   top 40 only -> strongest overall trends
  //
  // Genre / Subgenre:
  //   full top 100 -> filter first, preserve Hardcover rank,
  //   then diversify authors
  //
  // This prevents narrow categories such as Romantic Fantasy from
  // appearing empty simply because their first qualifying book sits
  // below the global top 40.
  const globallyRankedTrendingBooks =
    [...trendingBooks].sort(
      (a, b) =>
        a.rank - b.rank
    );

  const coreTrendingPool =
    globallyRankedTrendingBooks.slice(
      0,
      40
    );

  const trendingCandidatePool =
    activeTrendingGenreNode
      ? globallyRankedTrendingBooks
      : coreTrendingPool;

  const genreTrendingBooks =
    trendingCandidatePool.filter(
      (book) =>
        bookMatchesGenreNode(
          book,
          activeTrendingGenreNode
        )
    );

  const visibleTrendingBooks =
    diversifyByAuthor(
      genreTrendingBooks,
      12
    );

  // Recent Releases comes from its own release-date query and does
  // not depend on the genre/subgenre currently selected in Trending.
  // Keep the fixed global top 40 out of this row so the two sections
  // do not repeat the same covers.
  const fixedTrendingIds =
    new Set(
      coreTrendingPool.map(
        (book) => book.id
      )
    );

  const recentReleaseCandidates =
    [...recentReleasePool]
      .filter(
        (book) =>
          !!book.coverUrl &&
          !!book.authors?.[0] &&
          !fixedTrendingIds.has(
            book.id
          )
      )
      .sort((a, b) => {
        const aDate =
          a.releaseDate
            ? new Date(
                `${a.releaseDate}T00:00:00`
              ).getTime()
            : 0;

        const bDate =
          b.releaseDate
            ? new Date(
                `${b.releaseDate}T00:00:00`
              ).getTime()
            : 0;

        if (bDate !== aDate) {
          return bDate - aDate;
        }

        const readerDifference =
          (b.usersCount ?? 0) -
          (a.usersCount ?? 0);

        if (readerDifference !== 0) {
          return readerDifference;
        }

        return a.rank - b.rank;
      });

  const recentReleaseBooks:
    TrendingBook[] = [];

  const recentReleaseAuthors =
    new Set<string>();

  const recentReleaseTitles =
    new Set<string>();

  // First pass: one fresh title for each broad Novori genre when
  // Hardcover has a qualifying match.
  for (const genre of GENRE_TREE) {
    const genrePick =
      recentReleaseCandidates.find(
        (book) => {
          const primaryAuthor =
            book.authors[0]
              .trim()
              .toLowerCase();

          const normalizedBookTitle =
            normalizeTitle(
              book.title
            );

          return (
            !recentReleaseAuthors.has(
              primaryAuthor
            ) &&
            !recentReleaseTitles.has(
              normalizedBookTitle
            ) &&
            bookMatchesGenreNode(
              book,
              genre
            )
          );
        }
      );

    if (!genrePick) {
      continue;
    }

    recentReleaseAuthors.add(
      genrePick.authors[0]
        .trim()
        .toLowerCase()
    );

    recentReleaseTitles.add(
      normalizeTitle(
        genrePick.title
      )
    );

    recentReleaseBooks.push(
      genrePick
    );
  }

  // Second pass: fill any remaining slots with the newest qualifying
  // releases while keeping one book per primary author.
  for (
    const book of
    recentReleaseCandidates
  ) {
    if (
      recentReleaseBooks.length >= 10
    ) {
      break;
    }

    const primaryAuthor =
      book.authors[0]
        .trim()
        .toLowerCase();

    const normalizedBookTitle =
      normalizeTitle(
        book.title
      );

    if (
      recentReleaseAuthors.has(
        primaryAuthor
      ) ||
      recentReleaseTitles.has(
        normalizedBookTitle
      )
    ) {
      continue;
    }

    recentReleaseAuthors.add(
      primaryAuthor
    );

    recentReleaseTitles.add(
      normalizedBookTitle
    );

    recentReleaseBooks.push(
      book
    );
  }

  const genreScrollbarVisible =
    genreDropdownContentHeight >
    genreDropdownViewportHeight + 1;

  const genreScrollbarTrackHeight =
    Math.max(
      genreDropdownViewportHeight - 8,
      0
    );

  const genreScrollbarThumbHeight =
    genreScrollbarVisible
      ? Math.max(
          32,
          Math.min(
            genreScrollbarTrackHeight,
            genreScrollbarTrackHeight *
              (genreDropdownViewportHeight /
                genreDropdownContentHeight)
          )
        )
      : 0;

  const genreScrollbarMaxScroll =
    Math.max(
      genreDropdownContentHeight -
        genreDropdownViewportHeight,
      1
    );

  const genreScrollbarMaxTravel =
    Math.max(
      genreScrollbarTrackHeight -
        genreScrollbarThumbHeight,
      0
    );

  const genreScrollbarThumbTop =
    genreScrollbarVisible
      ? Math.min(
          genreScrollbarMaxTravel,
          Math.max(
            0,
            (genreDropdownScrollY /
              genreScrollbarMaxScroll) *
              genreScrollbarMaxTravel
          )
        )
      : 0;

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
      edges={['top']}
    >
      <View
        style={
          styles.screen
        }
        onTouchStart={() => {
          if (genreMenuVisible) {
            setGenreMenuVisible(false);
          }
        }}
      >
        <View
          style={
            styles.headerArea
          }
        >
          <View
            style={
              styles.header
            }
          >
            <Text
              style={
                styles.heading
              }
            >
              Discover
            </Text>

            <Text
              style={
                styles.subheading
              }
            >
              Find your next read.
            </Text>
          </View>

          <View
            style={
              styles.discoverModeRow
            }
          >
            <Pressable
              onPress={() => {
                setDiscoverMode(
                  'books'
                );
                setGenreMenuVisible(
                  false
                );
              }}
              style={[
                styles.discoverModeButton,
                discoverMode ===
                  'books' &&
                  styles.discoverModeButtonActive,
              ]}
            >
              <Ionicons
                name="book-outline"
                size={
                  15
                }
                color={
                  discoverMode ===
                  'books'
                    ? COLORS.gold
                    : COLORS.mutedText
                }
              />

              <Text
                style={[
                  styles.discoverModeText,
                  discoverMode ===
                    'books' &&
                    styles.discoverModeTextActive,
                ]}
              >
                Books
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setDiscoverMode(
                  'readers'
                );
                setGenreMenuVisible(
                  false
                );
              }}
              style={[
                styles.discoverModeButton,
                discoverMode ===
                  'readers' &&
                  styles.discoverModeButtonActive,
              ]}
            >
              <Ionicons
                name="people-outline"
                size={
                  15
                }
                color={
                  discoverMode ===
                  'readers'
                    ? COLORS.gold
                    : COLORS.mutedText
                }
              />

              <Text
                style={[
                  styles.discoverModeText,
                  discoverMode ===
                    'readers' &&
                    styles.discoverModeTextActive,
                ]}
              >
                Readers
              </Text>
            </Pressable>
          </View>

          <View
            style={
              styles.searchContainer
            }
          >
            <TextInput
              style={
                styles.input
              }
              placeholder={
                discoverMode ===
                'books'
                  ? 'Title, author, or ISBN'
                  : 'Name or @username'
              }
              placeholderTextColor={
                COLORS.mutedText
              }
              value={
                discoverMode ===
                'books'
                  ? query
                  : readerQuery
              }
              onChangeText={
                discoverMode ===
                'books'
                  ? setQuery
                  : setReaderQuery
              }
              returnKeyType="search"
              onSubmitEditing={
                discoverMode ===
                'books'
                  ? searchImmediately
                  : searchReadersImmediately
              }
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              blurOnSubmit={false}
            />

            {(discoverMode ===
              'books'
                ? loading
                : readerLoading) ? (
              <ActivityIndicator
                size="small"
                color={
                  COLORS.gold
                }
                style={
                  styles.searchSpinner
                }
              />
            ) : null}
          </View>

          {(discoverMode ===
          'books'
            ? error
            : readerError) ? (
            <Text
              style={
                styles.error
              }
            >
              {discoverMode ===
              'books'
                ? error
                : readerError}
            </Text>
          ) : null}
        </View>

        {discoverMode ===
        'readers' ? (
          <View
            style={
              styles.resultsArea
            }
          >
            <FlatList
              style={
                styles.list
              }
              data={
                readerResults
              }
              keyExtractor={(
                item
              ) => item.id}
              renderItem={
                renderReader
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={[
                styles.readerListContent,
                readerResults.length ===
                  0 &&
                  styles.listContentEmpty,
              ]}
              ListHeaderComponent={
                trimmedReaderQuery.length ===
                  0 ? (
                  <View
                    style={
                      styles.readerIntro
                    }
                  >
                    <View
                      style={
                        styles.readerIntroIcon
                      }
                    >
                      <Ionicons
                        name="people-outline"
                        size={
                          25
                        }
                        color={
                          COLORS.gold
                        }
                      />
                    </View>

                    <Text
                      style={
                        styles.readerIntroTitle
                      }
                    >
                      Find your people.
                    </Text>

                    <Text
                      style={
                        styles.readerIntroText
                      }
                    >
                      Search Novori by display name or @username, then open a reader’s profile or follow them directly.
                    </Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                !readerLoading &&
                !readerError &&
                trimmedReaderQuery.length >
                  0 ? (
                  <View
                    style={
                      styles.emptyState
                    }
                  >
                    <Text
                      style={
                        styles.emptyTitle
                      }
                    >
                      {hasReaderSearchText
                        ? 'No readers found'
                        : 'Keep typing'}
                    </Text>

                    <Text
                      style={
                        styles.emptyText
                      }
                    >
                      {hasReaderSearchText
                        ? 'Try a different name or @username.'
                        : 'Enter at least two characters to search.'}
                    </Text>
                  </View>
                ) : null
              }
            />
          </View>
        ) : showDiscoverHome ? (
          <ScrollView
            style={
              styles.discoverHome
            }
            contentContainerStyle={
              styles.discoverHomeContent
            }
            refreshControl={
              <RefreshControl
                refreshing={
                  discoverRefreshing
                }
                onRefresh={
                  handleDiscoverRefresh
                }
                tintColor={
                  COLORS.gold
                }
                colors={[
                  COLORS.gold,
                ]}
                progressBackgroundColor={
                  COLORS.surface
                }
              />
            }
            showsVerticalScrollIndicator={
              false
            }
            nestedScrollEnabled
            directionalLockEnabled
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={
                styles.sectionHeader
              }
            >
              <View
                style={
                  styles.trendingHeaderRow
                }
              >
                <View
                  style={
                    styles.trendingHeaderCopy
                  }
                >
                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    Trending Now
                  </Text>

                  <Text
                    style={
                      styles.sectionSubtitle
                    }
                  >
                    Popular with readers right now.
                  </Text>
                </View>

                {!trendingLoading &&
                trendingBooks.length > 0 ? (
                  <View
                    style={
                      styles.genreSelectorWrap
                    }
                    onTouchStart={(
                      event
                    ) =>
                      event.stopPropagation()
                    }
                  >
                    <Pressable
                      onPress={() =>
                        setGenreMenuVisible(
                          (current) => !current
                        )
                      }
                      style={({ pressed }) => [
                        styles.genreSelectorBar,
                        pressed &&
                          styles.genreControlPressed,
                        genreMenuVisible &&
                          styles.genreSelectorBarOpen,
                      ]}
                    >
                      <View
                        style={
                          styles.genreSelectorCopy
                        }
                      >
                        <Text
                          style={
                            styles.genreSelectorCaption
                          }
                        >
                          Genre
                        </Text>

                        <View
                          style={
                            styles.genreSelectorDivider
                          }
                        />

                        <Text
                          style={
                            styles.genreSelectorText
                          }
                          numberOfLines={1}
                        >
                          {activeBroadGenreNode?.label ??
                            'All Genres'}
                        </Text>
                      </View>

                      <Ionicons
                        name={
                          genreMenuVisible
                            ? 'chevron-up'
                            : 'chevron-down'
                        }
                        size={16}
                        color={COLORS.gold}
                      />
                    </Pressable>

                    {genreMenuVisible ? (
                      <View
                        style={
                          styles.genreDropdown
                        }
                      >
                        <Text
                          style={
                            styles.genreDropdownTitle
                          }
                        >
                          Choose a genre
                        </Text>

                        <View
                          style={
                            styles.genreDropdownScrollWrap
                          }
                        >
                          <ScrollView
                            style={
                              styles.genreDropdownList
                            }
                            contentContainerStyle={
                              styles.genreDropdownListContent
                            }
                            showsVerticalScrollIndicator={
                              false
                            }
                            nestedScrollEnabled
                            scrollEventThrottle={16}
                            onLayout={(event) =>
                              setGenreDropdownViewportHeight(
                                event.nativeEvent.layout.height
                              )
                            }
                            onContentSizeChange={(
                              _width,
                              height
                            ) =>
                              setGenreDropdownContentHeight(
                                height
                              )
                            }
                            onScroll={(event) =>
                              setGenreDropdownScrollY(
                                event.nativeEvent.contentOffset.y
                              )
                            }
                          >
                            <Pressable
                              onPress={showAllGenres}
                              style={({ pressed }) => [
                                styles.genreDropdownRow,
                                !activeBroadGenreNode &&
                                  styles.genreDropdownRowActive,
                                pressed &&
                                  styles.genreMenuRowPressed,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.genreDropdownRowText,
                                  !activeBroadGenreNode &&
                                    styles.genreDropdownRowTextActive,
                                ]}
                              >
                                All Genres
                              </Text>

                              {!activeBroadGenreNode ? (
                                <Ionicons
                                  name="checkmark"
                                  size={18}
                                  color={COLORS.gold}
                                />
                              ) : null}
                            </Pressable>

                            <View
                              style={
                                styles.genreDropdownSeparator
                              }
                            />

                            {GENRE_TREE.map(
                              (node, index) => {
                                const isActive =
                                  activeBroadGenreNode?.key ===
                                  node.key;

                                return (
                                  <View
                                    key={node.key}
                                  >
                                    <Pressable
                                      onPress={() =>
                                        selectBroadGenre(
                                          node
                                        )
                                      }
                                      style={({ pressed }) => [
                                        styles.genreDropdownRow,
                                        isActive &&
                                          styles.genreDropdownRowActive,
                                        pressed &&
                                          styles.genreMenuRowPressed,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.genreDropdownRowText,
                                          isActive &&
                                            styles.genreDropdownRowTextActive,
                                        ]}
                                      >
                                        {node.label}
                                      </Text>

                                      {isActive ? (
                                        <Ionicons
                                          name="checkmark"
                                          size={18}
                                          color={COLORS.gold}
                                        />
                                      ) : null}
                                    </Pressable>

                                    {index <
                                    GENRE_TREE.length - 1 ? (
                                      <View
                                        style={
                                          styles.genreDropdownDivider
                                        }
                                      />
                                    ) : null}
                                  </View>
                                );
                              }
                            )}
                          </ScrollView>

                          {genreScrollbarVisible ? (
                            <View
                              pointerEvents="none"
                              style={
                                styles.genreScrollbarTrack
                              }
                            >
                              <View
                                style={[
                                  styles.genreScrollbarThumb,
                                  {
                                    height:
                                      genreScrollbarThumbHeight,
                                    transform: [
                                      {
                                        translateY:
                                          genreScrollbarThumbTop,
                                      },
                                    ],
                                  },
                                ]}
                              />
                            </View>
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View
                style={
                  styles.subgenreSlot
                }
                onTouchStart={(
                  event
                ) =>
                  event.stopPropagation()
                }
              >
                {!trendingLoading &&
                trendingBooks.length > 0 ? (
                  <ScrollView
                    ref={
                      genreChipsScrollRef
                    }
                    horizontal
                    nestedScrollEnabled
                    directionalLockEnabled
                    canCancelContentTouches
                    showsHorizontalScrollIndicator={false}
                    style={
                      styles.subgenreTabsScroll
                    }
                    contentContainerStyle={
                      styles.subgenreTabs
                    }
                  >
                    <Pressable
                      onPress={() =>
                        activeBroadGenreNode
                          ? selectSubgenre(null)
                          : showAllGenres()
                      }
                      style={[
                        styles.subgenreTab,
                        !activeSubgenreNode &&
                          styles.subgenreTabActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.subgenreTabText,
                          !activeSubgenreNode &&
                            styles.subgenreTabTextActive,
                        ]}
                      >
                        {activeBroadGenreNode
                          ? `All ${activeBroadGenreNode.label}`
                          : 'All Books'}
                      </Text>
                    </Pressable>

                    {activeBroadGenreNode
                      ? visibleSubgenres.map(
                          (node) => {
                            const isActive =
                              activeSubgenreNode?.key ===
                              node.key;

                            return (
                              <Pressable
                                key={node.key}
                                onPress={() =>
                                  selectSubgenre(
                                    node
                                  )
                                }
                                style={[
                                  styles.subgenreTab,
                                  isActive &&
                                    styles.subgenreTabActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.subgenreTabText,
                                    isActive &&
                                      styles.subgenreTabTextActive,
                                  ]}
                                >
                                  {node.shortLabel ??
                                    node.label}
                                </Text>
                              </Pressable>
                            );
                          }
                        )
                      : null}
                  </ScrollView>
                ) : null}
              </View>
            </View>

            {trendingLoading ? (
              <View
                style={
                  styles.trendingLoading
                }
              >
                <ActivityIndicator
                  size="small"
                  color={COLORS.gold}
                />
                <Text
                  style={
                    styles.trendingLoadingText
                  }
                >
                  Loading trending books...
                </Text>
              </View>
            ) : trendingError ? (
              <Pressable
                onPress={() =>
                  loadTrendingBooks(
                    false,
                    true
                  )
                }
                style={
                  styles.trendingErrorCard
                }
              >
                <Text
                  style={
                    styles.trendingErrorText
                  }
                >
                  {trendingError}
                </Text>
                <Text
                  style={
                    styles.retryText
                  }
                >
                  Tap to retry
                </Text>
              </Pressable>
            ) : visibleTrendingBooks.length === 0 ? (
              <View
                style={
                  styles.genreEmptyCard
                }
              >
                <Text
                  style={
                    styles.genreEmptyTitle
                  }
                >
                  Nothing trending here yet
                </Text>

                <Text
                  style={
                    styles.genreEmptyText
                  }
                >
                  Try the full genre or choose a different genre.
                </Text>

                <Pressable
                  onPress={
                    activeSubgenreNode
                      ? () => selectSubgenre(null)
                      : showAllGenres
                  }
                  style={({ pressed }) => [
                    styles.genreEmptyButton,
                    pressed &&
                      styles.genreControlPressed,
                  ]}
                >
                  <Text
                    style={
                      styles.genreEmptyButtonText
                    }
                  >
                    {activeTrendingGenreNode
                      ? 'Go Broader'
                      : 'Show All'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                ref={
                  trendingListRef
                }
                horizontal
                scrollEnabled
                nestedScrollEnabled
                directionalLockEnabled
                canCancelContentTouches
                alwaysBounceHorizontal
                decelerationRate="fast"
                showsHorizontalScrollIndicator={
                  false
                }
                style={
                  styles.trendingCarousel
                }
                contentContainerStyle={
                  styles.trendingList
                }
              >
                {visibleTrendingBooks.map(
                  (item) => (
                    <View
                      key={String(item.id)}
                    >
                      {renderTrendingBook({
                        item,
                      })}
                    </View>
                  )
                )}
              </ScrollView>
            )}

            <View
              style={
                styles.newReleasesSection
              }
            >
              <View
                style={
                  styles.newReleasesHeader
                }
              >
                <Text
                  style={
                    styles.newReleasesTitle
                  }
                >
                  Recent Releases
                </Text>

                <Text
                  style={
                    styles.newReleasesSubtitle
                  }
                >
                  Recent standouts across genres.
                </Text>
              </View>

              {recentReleasesLoading ? (
                <View
                  style={
                    styles.newReleasesLoading
                  }
                >
                  <ActivityIndicator
                    size="small"
                    color={COLORS.gold}
                  />
                </View>
              ) : recentReleasesError ? (
                <Pressable
                  onPress={() =>
                    loadRecentReleases(
                      false,
                      true
                    )
                  }
                  style={
                    styles.newReleasesError
                  }
                >
                  <Text
                    style={
                      styles.newReleasesErrorText
                    }
                  >
                    Recent releases are unavailable. Tap to retry.
                  </Text>
                </Pressable>
              ) : recentReleaseBooks.length > 0 ? (
                <ScrollView
                  horizontal
                  scrollEnabled
                  nestedScrollEnabled
                  directionalLockEnabled
                  canCancelContentTouches
                  alwaysBounceHorizontal
                  decelerationRate="fast"
                  showsHorizontalScrollIndicator={
                    false
                  }
                  style={
                    styles.newReleasesCarousel
                  }
                  contentContainerStyle={
                    styles.newReleasesList
                  }
                >
                  {recentReleaseBooks.map(
                    (item) => (
                      <View
                        key={String(item.id)}
                      >
                        {renderRecentReleaseBook(
                          item
                        )}
                      </View>
                    )
                  )}
                </ScrollView>
              ) : (
                <View
                  style={
                    styles.newReleasesEmpty
                  }
                >
                  <Text
                    style={
                      styles.newReleasesEmptyText
                    }
                  >
                    No recent releases to show right now.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        ) : (
          <View
            style={
              styles.resultsArea
            }
          >
            <FlatList
              style={
                styles.list
              }
              data={books}
              keyExtractor={(
                item
              ) => item.id}
              renderItem={
                renderBook
              }
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                [
                  styles.listContent,
                  books.length ===
                    0 &&
                    styles.listContentEmpty,
                ]
              }
              ListEmptyComponent={
                !loading &&
                !error ? (
                  <View
                    style={
                      styles.emptyState
                    }
                  >
                    <Text
                      style={
                        styles.emptyTitle
                      }
                    >
                      {hasSearchText
                        ? 'No books found'
                        : 'Keep typing'}
                    </Text>

                    <Text
                      style={
                        styles.emptyText
                      }
                    >
                      {hasSearchText
                        ? 'Try a different title, author, or ISBN.'
                        : 'Enter at least two characters to search.'}
                    </Text>
                  </View>
                ) : null
              }
            />
          </View>
        )}
      </View>

    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },

    screen: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },

    headerArea: {
      width: '100%',
      maxWidth: 720,
      alignSelf:
        'center',
      paddingHorizontal:
        20,
      paddingBottom: 10,
    },

    header: {
      paddingTop: 22,
      paddingBottom:
        18,
    },

    heading: {
      color:
        COLORS.gold,
      fontSize: 34,
      fontFamily:
        'PlayfairDisplay_700Bold',
    },

    subheading: {
      color:
        COLORS.secondaryText,
      fontSize: 15,
      fontFamily:
        'Inter_400Regular',
      marginTop: 3,
    },

    discoverModeRow: {
      flexDirection:
        'row',
      alignSelf:
        'flex-start',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 13,
      padding: 3,
      marginBottom: 10,
      gap: 2,
    },

    discoverModeButton: {
      minHeight: 34,
      minWidth: 92,
      borderRadius: 10,
      paddingHorizontal: 13,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 6,
    },

    discoverModeButtonActive: {
      backgroundColor:
        COLORS.elevated,
    },

    discoverModeText: {
      color:
        COLORS.mutedText,
      fontSize: 12,
      fontFamily:
        'Inter_600SemiBold',
    },

    discoverModeTextActive: {
      color:
        COLORS.gold,
      fontFamily:
        'Inter_700Bold',
    },

    searchContainer: {
      position:
        'relative',
      justifyContent:
        'center',
    },

    input: {
      minHeight: 50,
      backgroundColor:
        COLORS.surface,
      color:
        COLORS.text,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 14,
      paddingLeft: 14,
      paddingRight: 46,
      fontSize: 15,
      fontFamily:
        'Inter_400Regular',
    },

    searchSpinner: {
      position:
        'absolute',
      right: 15,
    },

    error: {
      color:
        COLORS.danger,
      marginTop: 10,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
    },

    discoverHome: {
      flex: 1,
      width: '100%',
      maxWidth: 720,
      alignSelf:
        'center',
    },

    discoverHomeContent: {
      paddingTop: 24,
      paddingBottom: 32,
    },

    sectionHeader: {
      position: 'relative',
      paddingHorizontal: 20,
      marginBottom: 8,
      zIndex: 30,
    },

    trendingHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },

    trendingHeaderCopy: {
      flex: 1,
      minWidth: 0,
    },

    sectionTitle: {
      color: COLORS.text,
      fontSize: 24,
      fontFamily: 'PlayfairDisplay_700Bold',
    },

    sectionSubtitle: {
      color: COLORS.mutedText,
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      marginTop: 2,
    },

    genreSelectorWrap: {
      position: 'relative',
      width: 158,
      flexShrink: 0,
      zIndex: 50,
    },

    genreSelectorBar: {
      height: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.background,
    },

    genreSelectorBarOpen: {
      borderColor: COLORS.gold,
      backgroundColor: COLORS.surface,
    },

    genreSelectorCopy: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
    },

    genreSelectorCaption: {
      color: COLORS.mutedText,
      fontSize: 8,
      fontFamily: 'Inter_600SemiBold',
      textTransform: 'uppercase',
      letterSpacing: 0.55,
    },

    genreSelectorDivider: {
      width: 1,
      height: 13,
      marginHorizontal: 7,
      backgroundColor: COLORS.border,
    },

    genreSelectorText: {
      flex: 1,
      color: COLORS.text,
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
    },

    genreDropdown: {
      position: 'absolute',
      top: 44,
      right: 0,
      width: 260,
      paddingTop: 12,
      paddingHorizontal: 10,
      paddingBottom: 8,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
      zIndex: 100,
      elevation: 12,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 14,
      shadowOffset: {
        width: 0,
        height: 7,
      },
    },

    genreDropdownTitle: {
      color: COLORS.mutedText,
      fontSize: 10,
      fontFamily: 'Inter_600SemiBold',
      textTransform: 'uppercase',
      letterSpacing: 0.75,
      paddingHorizontal: 10,
      paddingBottom: 7,
    },

    genreDropdownScrollWrap: {
      position: 'relative',
    },

    genreDropdownList: {
      maxHeight: 348,
    },

    genreDropdownListContent: {
      paddingBottom: 2,
      paddingRight: 10,
    },

    genreScrollbarTrack: {
      position: 'absolute',
      top: 4,
      right: 1,
      bottom: 4,
      width: 4,
      borderRadius: 2,
      backgroundColor: COLORS.border,
      opacity: 0.72,
      overflow: 'hidden',
    },

    genreScrollbarThumb: {
      width: 4,
      borderRadius: 2,
      backgroundColor: COLORS.gold,
    },

    genreDropdownRow: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      borderRadius: 9,
    },

    genreDropdownRowActive: {
      backgroundColor: COLORS.elevated,
    },

    genreDropdownRowText: {
      flex: 1,
      color: COLORS.secondaryText,
      fontSize: 13,
      fontFamily: 'Inter_500Medium',
    },

    genreDropdownRowTextActive: {
      color: COLORS.gold,
      fontFamily: 'Inter_700Bold',
    },

    genreDropdownSeparator: {
      height: 1,
      marginVertical: 5,
      marginHorizontal: 10,
      backgroundColor: COLORS.border,
    },

    genreDropdownDivider: {
      height: 1,
      marginHorizontal: 10,
      backgroundColor: COLORS.border,
      opacity: 0.55,
    },

    subgenreSlot: {
      height: 38,
      justifyContent: 'center',
      marginTop: 6,
      zIndex: 10,
    },

    subgenreTabsScroll: {
      flexGrow: 0,
    },

    subgenreTabs: {
      alignItems: 'center',
      gap: 7,
      paddingRight: 8,
    },

    subgenreTab: {
      minHeight: 30,
      justifyContent: 'center',
      paddingHorizontal: 11,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: 'transparent',
    },

    subgenreTabActive: {
      borderColor: COLORS.gold,
      backgroundColor: COLORS.elevated,
    },

    subgenreTabText: {
      color: COLORS.mutedText,
      fontSize: 11,
      fontFamily: 'Inter_600SemiBold',
    },

    subgenreTabTextActive: {
      color: COLORS.gold,
      fontFamily: 'Inter_700Bold',
    },

    genreControlPressed: {
      opacity: 0.7,
    },

    genreMenuRowPressed: {
      opacity: 0.65,
    },

    genreEmptyCard: {
      marginHorizontal: 20,
      padding: 22,
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      backgroundColor:
        COLORS.surface,
    },

    genreEmptyTitle: {
      color:
        COLORS.text,
      fontSize: 18,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
    },

    genreEmptyText: {
      color:
        COLORS.mutedText,
      fontSize: 13,
      lineHeight: 19,
      fontFamily:
        'Inter_400Regular',
      marginTop: 5,
    },

    genreEmptyButton: {
      alignSelf: 'flex-start',
      marginTop: 14,
    },

    genreEmptyButtonText: {
      color:
        COLORS.gold,
      fontSize: 12,
      fontFamily:
        'Inter_600SemiBold',
    },
    trendingCarousel: {
      flexGrow: 0,
      width: '100%',
    },

    trendingList: {
      paddingHorizontal: 20,
      paddingRight: 8,
    },

    trendingCard: {
      width: 122,
      marginRight: 14,
    },

    trendingCoverWrap: {
      position: 'relative',
      width: 122,
      height: 183,
      marginBottom: 9,
    },

    trendingCover: {
      width: 122,
      height: 183,
      borderRadius: 10,
      backgroundColor:
        COLORS.elevated,
    },

    trendingCoverPlaceholder: {
      width: 122,
      height: 183,
      borderRadius: 10,
      backgroundColor:
        COLORS.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    trendingLoadingOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(0, 0, 0, 0.42)',
      borderRadius: 10,
    },

    trendingTitle: {
      color:
        COLORS.text,
      fontSize: 14,
      lineHeight: 18,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      minHeight: 36,
    },

    trendingAuthor: {
      color:
        COLORS.mutedText,
      fontSize: 11,
      fontFamily:
        'Inter_400Regular',
      marginTop: 3,
    },

    trendingRating: {
      color:
        COLORS.softGold,
      fontSize: 11,
      fontFamily:
        'Inter_600SemiBold',
      marginTop: 5,
    },

    trendingLoading: {
      minHeight: 210,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },

    trendingLoadingText: {
      color:
        COLORS.mutedText,
      fontSize: 13,
      fontFamily:
        'Inter_400Regular',
      marginTop: 10,
    },

    trendingErrorCard: {
      marginHorizontal: 20,
      padding: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      backgroundColor:
        COLORS.surface,
      alignItems: 'center',
    },

    trendingErrorText: {
      color:
        COLORS.secondaryText,
      fontSize: 13,
      textAlign: 'center',
      fontFamily:
        'Inter_400Regular',
    },

    retryText: {
      color:
        COLORS.softGold,
      fontSize: 12,
      fontFamily:
        'Inter_600SemiBold',
      marginTop: 8,
    },

    newReleasesSection: {
      marginTop: 24,
      paddingTop: 0,
    },

    newReleasesHeader: {
      paddingHorizontal: 20,
      marginBottom: 14,
    },

    newReleasesTitle: {
      color: COLORS.text,
      fontSize: 22,
      fontFamily: 'PlayfairDisplay_700Bold',
    },

    newReleasesSubtitle: {
      color: COLORS.mutedText,
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      marginTop: 3,
    },

    newReleasesCarousel: {
      flexGrow: 0,
      width: '100%',
    },

    newReleasesList: {
      paddingLeft: 20,
      paddingRight: 8,
    },

    newReleaseCard: {
      width: 112,
      marginRight: 13,
    },

    newReleaseCoverWrap: {
      position: 'relative',
      width: 112,
      height: 168,
      marginBottom: 8,
    },

    newReleaseCover: {
      width: 112,
      height: 168,
      borderRadius: 9,
      backgroundColor: COLORS.elevated,
    },

    newReleaseCoverPlaceholder: {
      width: 112,
      height: 168,
      borderRadius: 9,
      backgroundColor: COLORS.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
    },

    newReleaseLoadingOverlay: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        'rgba(0, 0, 0, 0.42)',
      borderRadius: 9,
    },

    newReleaseTitle: {
      color: COLORS.text,
      fontSize: 13,
      lineHeight: 17,
      fontFamily: 'PlayfairDisplay_600SemiBold',
      minHeight: 34,
    },

    newReleaseAuthor: {
      color: COLORS.mutedText,
      fontSize: 10,
      fontFamily: 'Inter_400Regular',
      marginTop: 2,
    },

    newReleaseDate: {
      color: COLORS.softGold,
      fontSize: 10,
      fontFamily: 'Inter_500Medium',
      marginTop: 4,
    },

    newReleasesLoading: {
      height: 190,
      alignItems: 'center',
      justifyContent: 'center',
    },

    newReleasesError: {
      marginHorizontal: 20,
      paddingVertical: 14,
    },

    newReleasesErrorText: {
      color: COLORS.mutedText,
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
    },

    newReleasesEmpty: {
      minHeight: 72,
      justifyContent: 'center',
      paddingHorizontal: 20,
    },

    newReleasesEmptyText: {
      color: COLORS.mutedText,
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
    },

    readerListContent: {
      paddingHorizontal:
        20,
      paddingBottom:
        28,
    },

    readerIntro: {
      alignItems:
        'center',
      paddingHorizontal:
        22,
      paddingTop: 34,
      paddingBottom: 28,
    },

    readerIntroIcon: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    readerIntroTitle: {
      color:
        COLORS.text,
      fontSize: 22,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      marginTop: 14,
      textAlign:
        'center',
    },

    readerIntroText: {
      color:
        COLORS.mutedText,
      fontSize: 13,
      lineHeight: 19,
      fontFamily:
        'Inter_400Regular',
      textAlign:
        'center',
      marginTop: 7,
      maxWidth: 430,
    },

    readerCard: {
      width: '100%',
      minHeight: 76,
      backgroundColor:
        COLORS.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      paddingHorizontal: 11,
      paddingVertical: 10,
      marginBottom: 10,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 10,
    },

    readerMain: {
      flex: 1,
      minWidth: 0,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    readerAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor:
        COLORS.elevated,
      marginRight: 11,
    },

    readerAvatarFallback: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },

    readerAvatarText: {
      color:
        COLORS.gold,
      fontSize: 19,
      fontFamily:
        'PlayfairDisplay_700Bold',
    },

    readerCopy: {
      flex: 1,
      minWidth: 0,
    },

    readerName: {
      color:
        COLORS.text,
      fontSize: 14,
      fontFamily:
        'Inter_700Bold',
    },

    readerUsername: {
      color:
        COLORS.mutedText,
      fontSize: 11,
      fontFamily:
        'Inter_400Regular',
      marginTop: 2,
    },

    readerViewProfile: {
      color:
        COLORS.softGold,
      fontSize: 10,
      fontFamily:
        'Inter_600SemiBold',
      marginTop: 5,
    },

    readerFollowButton: {
      minWidth: 76,
      minHeight: 34,
      borderRadius: 11,
      backgroundColor:
        COLORS.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 10,
    },

    readerFollowButtonText: {
      color:
        COLORS.background,
      fontSize: 10,
      fontFamily:
        'Inter_700Bold',
    },

    readerFollowingButton: {
      minWidth: 76,
      minHeight: 34,
      borderRadius: 11,
      backgroundColor:
        COLORS.elevated,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 10,
    },

    readerFollowingButtonText: {
      color:
        COLORS.text,
      fontSize: 10,
      fontFamily:
        'Inter_700Bold',
    },

    readerYouBadge: {
      minWidth: 54,
      minHeight: 30,
      borderRadius: 10,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 9,
    },

    readerYouBadgeText: {
      color:
        COLORS.mutedText,
      fontSize: 10,
      fontFamily:
        'Inter_700Bold',
    },

    readerPressed: {
      opacity: 0.68,
    },

    resultsArea: {
      flex: 1,
      width: '100%',
      maxWidth: 720,
      alignSelf:
        'center',
      marginTop: 14,
    },

    list: {
      flex: 1,
    },

    listContent: {
      paddingHorizontal:
        20,
      paddingBottom:
        28,
    },

    listContentEmpty: {
      flexGrow: 1,
    },

    bookCard: {
      flexDirection:
        'row',
      width: '100%',
      backgroundColor:
        COLORS.surface,
      borderRadius: 16,
      padding: 12,
      marginBottom: 14,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    bookCardPressed: {
      opacity: 0.72,
    },

    cover: {
      width: 75,
      height: 112,
      borderRadius: 8,
      backgroundColor:
        COLORS.elevated,
    },

    coverPlaceholder: {
      width: 75,
      height: 112,
      borderRadius: 8,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    coverPlaceholderText: {
      color:
        COLORS.mutedText,
      fontSize: 11,
      fontFamily:
        'Inter_400Regular',
    },

    bookInfo: {
      flex: 1,
      marginLeft: 14,
      justifyContent:
        'center',
    },

    bookTitle: {
      color:
        COLORS.text,
      fontSize: 18,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      marginBottom: 5,
    },

    author: {
      color:
        COLORS.secondaryText,
      fontSize: 13,
      fontFamily:
        'Inter_500Medium',
      marginBottom: 7,
    },

    meta: {
      color:
        COLORS.mutedText,
      fontSize: 12,
      fontFamily:
        'Inter_400Regular',
      marginBottom: 2,
    },

    viewDetails: {
      color:
        COLORS.softGold,
      fontSize: 12,
      fontFamily:
        'Inter_600SemiBold',
      marginTop: 7,
    },

    emptyState: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        30,
      paddingBottom:
        90,
    },

    emptyTitle: {
      color:
        COLORS.text,
      fontSize: 22,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      textAlign:
        'center',
    },

    emptyText: {
      color:
        COLORS.mutedText,
      fontSize: 14,
      lineHeight: 20,
      fontFamily:
        'Inter_400Regular',
      textAlign:
        'center',
      marginTop: 8,
    },
  });
