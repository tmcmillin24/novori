import { Ionicons } from '@expo/vector-icons';
import {
  Image as ExpoImage,
} from 'expo-image';
import {
  useFocusEffect,
  useNavigation,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  NovoriColors,
} from '../../constants/novori-theme';

import {
  useNovoriTheme,
} from '../../context/theme-context';

import RemoveBookConfirmSheet from '../../components/RemoveBookConfirmSheet';

import {
  getUserBooks,
  getLibraryMutationVersion,
  removeUserBook,
  saveUserBook,
  updateUserBookOwned,
  UserBook,
  UserBookStatus,
} from '../../lib/user-books';

import {
  getBookCart,
  getBookCartMutationVersion,
} from '../../lib/book-cart';

import {
  transitionReadingJourney,
} from '../../lib/reading-details';

type LibraryFilter =
  | 'all'
  | UserBookStatus;

type OwnershipFilter =
  | 'all'
  | 'owned'
  | 'not_owned';

type SortMode =
  | 'recent'
  | 'title'
  | 'author';

type FilterOption = {
  value: LibraryFilter;
  label: string;
};

const FILTERS: FilterOption[] = [
  {
    value: 'all',
    label: 'All',
  },
  {
    value: 'reading',
    label: 'Reading',
  },
  {
    value: 'want_to_read',
    label: 'TBR',
  },
  {
    value: 'read',
    label: 'Read',
  },
  {
    value: 'dnf',
    label: 'DNF',
  },
];

const STATUS_LABELS:
  Record<UserBookStatus, string> = {
    reading: 'Reading',
    want_to_read: 'TBR',
    read: 'Read',
    dnf: 'DNF',
  };

const STATUS_ORDER:
  Record<UserBookStatus, number> = {
    reading: 0,
    want_to_read: 1,
    read: 2,
    dnf: 3,
  };

const STATUS_ICONS:
  Record<
    UserBookStatus,
    keyof typeof Ionicons.glyphMap
  > = {
    reading: 'book-outline',
    want_to_read: 'bookmark-outline',
    read: 'checkmark-circle-outline',
    dnf: 'close-circle-outline',
  };


const LIBRARY_STALE_MS =
  5 * 60 * 1000;

let librarySessionCache:
  | {
      books: UserBook[];
      cartCount: number;
      refreshedAt: number;
      mutationVersion: number;
      cartMutationVersion: number;
    }
  | null =
  null;

function normalizeLibrarySearch(
  value: string
) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^a-z0-9]+/g,
      ''
    );
}

export default function LibraryScreen() {
  const router = useRouter();
  const navigation =
    useNavigation();

  const libraryFocusedRef =
    useRef(false);

  const lastSeenLibraryMutationRef =
    useRef(
      librarySessionCache
        ?.mutationVersion ??
      getLibraryMutationVersion()
    );

  const lastSeenCartMutationRef =
    useRef(
      librarySessionCache
        ?.cartMutationVersion ??
      getBookCartMutationVersion()
    );

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(colors);

  const [
    books,
    setBooks,
  ] =
    useState<UserBook[]>(
      librarySessionCache
        ?.books ??
      []
    );

  const [
    cartCount,
    setCartCount,
  ] =
    useState(
      librarySessionCache
        ?.cartCount ??
      0
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      !librarySessionCache
    );

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState('');

  const [
    activeFilter,
    setActiveFilter,
  ] =
    useState<LibraryFilter>(
      'all'
    );

  const [
    ownershipFilter,
    setOwnershipFilter,
  ] =
    useState<OwnershipFilter>(
      'all'
    );

  const [
    sortMode,
    setSortMode,
  ] =
    useState<SortMode>(
      'recent'
    );

  const [
    updatingBookId,
    setUpdatingBookId,
  ] =
    useState<string | null>(
      null
    );

  const [
    selectedBook,
    setSelectedBook,
  ] =
    useState<UserBook | null>(
      null
    );

  const [
    removeConfirmBook,
    setRemoveConfirmBook,
  ] =
    useState<UserBook | null>(
      null
    );

  const [
    actionSheetMode,
    setActionSheetMode,
  ] =
    useState<
      'actions' | 'status'
    >('actions');

  const insets = useSafeAreaInsets();
  const sheetTranslateY = useRef(new Animated.Value(12)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(0);
  const sheetShown = useRef(false);
  const sheetStarted = useRef(false);
  const sheetClosing = useRef(false);
  const afterSheetDismiss = useRef<(() => void) | null>(null);

  function animateBookSheetIn() {
    if (
      !sheetShown.current ||
      !sheetHeight.current ||
      sheetStarted.current ||
      sheetClosing.current
    ) {
      return;
    }

    sheetStarted.current =
      true;

    sheetTranslateY.stopAnimation();
    sheetOpacity.stopAnimation();
    backdropOpacity.stopAnimation();

    sheetTranslateY.setValue(
      12
    );
    sheetOpacity.setValue(
      0
    );
    backdropOpacity.setValue(
      0
    );

    Animated.parallel([
      Animated.timing(
        sheetTranslateY,
        {
          toValue:
            0,
          duration:
            135,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        sheetOpacity,
        {
          toValue:
            1,
          duration:
            105,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        backdropOpacity,
        {
          toValue:
            1,
          duration:
            125,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start();
  }

  function handleBookSheetDismiss() {
    sheetShown.current = false;
    sheetClosing.current = false;
    setActionSheetMode('actions');
    const action = afterSheetDismiss.current;
    afterSheetDismiss.current = null;
    action?.();
  }

  function dismissBookSheet(
    afterDismiss?: () => void
  ) {
    if (
      sheetClosing.current
    ) {
      return;
    }

    sheetClosing.current =
      true;

    afterSheetDismiss.current =
      afterDismiss ??
      null;

    sheetTranslateY.stopAnimation();
    sheetOpacity.stopAnimation();
    backdropOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(
        sheetTranslateY,
        {
          toValue:
            12,
          duration:
            115,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        sheetOpacity,
        {
          toValue:
            0,
          duration:
            100,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        backdropOpacity,
        {
          toValue:
            0,
          duration:
            120,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(({
      finished,
    }) => {
      if (
        !finished
      ) {
        return;
      }

      sheetTranslateY.setValue(
        12
      );
      sheetOpacity.setValue(
        0
      );

      setSelectedBook(
        null
      );

      if (
        Platform.OS !==
        'ios'
      ) {
        handleBookSheetDismiss();
      }
    });
  }

  const libraryListRef =
    useRef<FlatList<UserBook> | null>(
      null
    );

  const libraryScrollOffsetRef =
    useRef(0);

  const restoreLibraryScrollRef =
    useRef(false);

  const hasLoadedLibraryRef =
    useRef(
      Boolean(
        librarySessionCache
      )
    );

  const lastLibraryRefreshRef =
    useRef(
      librarySessionCache
        ?.refreshedAt ??
      0
    );

  function restoreLibraryScrollPosition() {
    requestAnimationFrame(
      () => {
        libraryListRef.current?.scrollToOffset({
          offset:
            libraryScrollOffsetRef.current,
          animated: false,
        });
      }
    );
  }

  const filterScrollRef =
    useRef<ScrollView | null>(
      null
    );

  const filterScrollOffsetRef =
    useRef(0);

  function restoreFilterScrollPosition() {
    requestAnimationFrame(
      () => {
        filterScrollRef.current?.scrollTo({
          x:
            filterScrollOffsetRef.current,
          animated: false,
        });
      }
    );
  }

  useFocusEffect(
    useCallback(() => {
      libraryFocusedRef.current =
        true;

      let active = true;

      const currentLibraryMutationVersion =
        getLibraryMutationVersion();

      const currentCartMutationVersion =
        getBookCartMutationVersion();

      const libraryChanged =
        currentLibraryMutationVersion !==
        lastSeenLibraryMutationRef.current;

      const cartChanged =
        currentCartMutationVersion !==
        lastSeenCartMutationRef.current;

      const libraryIsFresh =
        hasLoadedLibraryRef.current &&
        Date.now() -
          lastLibraryRefreshRef.current <
          LIBRARY_STALE_MS;

      if (
        libraryIsFresh &&
        !libraryChanged &&
        !cartChanged
      ) {
        return () => {
          active = false;
          libraryFocusedRef.current =
            false;
        };
      }

      async function loadLibrary() {
        const isFirstLoad =
          !hasLoadedLibraryRef.current;

        try {
          if (isFirstLoad) {
            setLoading(true);
          }

          setError('');

          const [
            data,
            cartItems,
          ] =
            await Promise.all([
              getUserBooks(),
              getBookCart(),
            ]);

          if (active) {
            setCartCount(
              cartItems.length
            );
            if (!isFirstLoad) {
              restoreLibraryScrollRef.current =
                true;
            }

            const refreshedAt =
              Date.now();

            setBooks(data);
            lastSeenLibraryMutationRef.current =
              currentLibraryMutationVersion;
            lastSeenCartMutationRef.current =
              currentCartMutationVersion;
            hasLoadedLibraryRef.current =
              true;
            lastLibraryRefreshRef.current =
              refreshedAt;

            librarySessionCache = {
              books:
                data,
              cartCount:
                cartItems.length,
              refreshedAt,
              mutationVersion:
                currentLibraryMutationVersion,
              cartMutationVersion:
                currentCartMutationVersion,
            };

            if (!isFirstLoad) {
              restoreLibraryScrollPosition();
            }
          }
        } catch (loadError) {
          console.error(
            'Could not load library:',
            loadError
          );

          if (active) {
            setError(
              'Could not load your library.'
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      loadLibrary();

      return () => {
        active = false;
        libraryFocusedRef.current =
          false;
      };
    }, [])
  );

  useEffect(
    () => {
      const unsubscribe =
        (navigation as any).addListener(
          'tabPress',
          () => {
            if (
              !libraryFocusedRef.current
            ) {
              return;
            }

            if (
              libraryScrollOffsetRef.current >
              24
            ) {
              libraryScrollOffsetRef.current =
                0;

              libraryListRef.current?.scrollToOffset({
                offset: 0,
                animated: true,
              });
              return;
            }

            // Keep the in-memory Library snapshot. A book mutation
            // or the five-minute TTL will refresh it automatically.
          }
        );

      return unsubscribe;
    },
    [
      navigation,
    ]
  );

  const counts =
    useMemo(() => {
      return {
        all:
          books.length,

        reading:
          books.filter(
            (book) =>
              book.status ===
              'reading'
          ).length,

        want_to_read:
          books.filter(
            (book) =>
              book.status ===
              'want_to_read'
          ).length,

        read:
          books.filter(
            (book) =>
              book.status ===
              'read'
          ).length,

        dnf:
          books.filter(
            (book) =>
              book.status ===
              'dnf'
          ).length,
      };
    }, [books]);

  const visibleBooks =
    useMemo(() => {
      const normalizedSearch =
        normalizeLibrarySearch(
          searchQuery
        );

      const filtered =
        (
          activeFilter ===
          'all'
            ? [...books]
            : books.filter(
                (
                  book
                ) =>
                  book.status ===
                  activeFilter
              )
        )
          .filter(
            (
              book
            ) =>
              ownershipFilter ===
                'all' ||
              (
                ownershipFilter ===
                  'owned'
                  ? Boolean(
                      book.owned
                    )
                  : !book.owned
              )
          )
          .filter(
          (
            book
          ) => {
            if (
              !normalizedSearch
            ) {
              return true;
            }

            const title =
              normalizeLibrarySearch(
                book.title
              );

            const authors =
              normalizeLibrarySearch(
                (
                  book.authors ??
                  []
                ).join(' ')
              );

            return (
              title.includes(
                normalizedSearch
              ) ||
              authors.includes(
                normalizedSearch
              )
            );
          }
        );

      filtered.sort(
        (a, b) => {
          if (
            activeFilter ===
            'all'
          ) {
            const statusDifference =
              (
                a.status
                  ? STATUS_ORDER[
                      a.status
                    ]
                  : 4
              ) -
              (
                b.status
                  ? STATUS_ORDER[
                      b.status
                    ]
                  : 4
              );

            if (
              statusDifference !==
              0
            ) {
              return statusDifference;
            }
          }

          if (
            sortMode ===
            'title'
          ) {
            return a.title.localeCompare(
              b.title
            );
          }

          if (
            sortMode ===
            'author'
          ) {
            const aAuthor =
              a.authors?.[0] ??
              '';

            const bAuthor =
              b.authors?.[0] ??
              '';

            return aAuthor.localeCompare(
              bAuthor
            );
          }

          const aTime =
            new Date(
              a.updated_at
            ).getTime();

          const bTime =
            new Date(
              b.updated_at
            ).getTime();

          return bTime - aTime;
        }
      );

      return filtered;
    }, [
      activeFilter,
      books,
      ownershipFilter,
      searchQuery,
      sortMode,
    ]);

  const sortLabel =
    sortMode === 'title'
      ? 'Title'
      : sortMode ===
        'author'
      ? 'Author'
      : 'Recently Updated';

  function openBook(
    googleBookId: string
  ) {
    router.push({
      pathname:
        '/book/[id]',
      params: {
        id:
          googleBookId,
        source:
          'library',
      },
    });
  }

  function openSortMenu() {
    Alert.alert(
      'Sort Library',
      undefined,
      [
        {
          text:
            'Recently Updated',
          onPress: () =>
            setSortMode(
              'recent'
            ),
        },
        {
          text: 'Title',
          onPress: () =>
            setSortMode(
              'title'
            ),
        },
        {
          text: 'Author',
          onPress: () =>
            setSortMode(
              'author'
            ),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  }

  function showBookActions(
    book: UserBook
  ) {
    if (selectedBook || sheetClosing.current) return;
    sheetShown.current = false;
    sheetStarted.current = false;
    sheetHeight.current = 0;
    sheetTranslateY.stopAnimation();
    sheetOpacity.stopAnimation();
    backdropOpacity.stopAnimation();
    sheetTranslateY.setValue(12);
    sheetOpacity.setValue(0);
    backdropOpacity.setValue(0);
    setSelectedBook(
      book
    );

    setActionSheetMode(
      'actions'
    );
  }

  function closeBookActions() {
    if (updatingBookId) {
      return;
    }

    dismissBookSheet();
  }

  function openSelectedBook() {
    if (!selectedBook) {
      return;
    }

    const googleBookId =
      selectedBook.google_book_id;

    dismissBookSheet(() => openBook(googleBookId));
  }

  function openSelectedReadingDetails() {
    if (
      !selectedBook ||
      !selectedBook.status ||
      selectedBook.status ===
        'want_to_read'
    ) {
      return;
    }

    const googleBookId = selectedBook.google_book_id;
    dismissBookSheet(() => {
      router.push({
        pathname: '/reading-details/[id]',
        params: { id: googleBookId },
      });
    });
  }

  function openSelectedReview() {
    if (
      !selectedBook ||
      (
        selectedBook.status !==
          'read' &&
        selectedBook.status !==
          'dnf'
      )
    ) {
      return;
    }

    const googleBookId =
      selectedBook.google_book_id;

    dismissBookSheet(() => {
      router.push({
        pathname:
          '/rate-review',
        params: {
          googleBookId,
        },
      });
    });
  }

  function shareSelectedReview() {
    if (
      !selectedBook ||
      selectedBook.status !==
        'read' ||
      !selectedBook.review_text
        ?.trim()
    ) {
      return;
    }

    const book =
      selectedBook;

    dismissBookSheet(() => {
      router.push({
        pathname:
          '/create-review',
        params: {
          bookId:
            book.google_book_id,
          rating:
            book.rating !==
            null
              ? String(
                  book.rating
                )
              : '',
          review:
            book.review_text
              ?.trim() ??
            '',
        },
      });
    });
  }

  function removeSelectedBook() {
    if (!selectedBook) {
      return;
    }

    const book =
      selectedBook;

    dismissBookSheet(() => confirmRemove(book));
  }

  async function changeBookStatus(
    book: UserBook,
    status: UserBookStatus
  ) {
    if (updatingBookId) {
      return;
    }

    try {
      setUpdatingBookId(
        book.id
      );

      const updatedBook =
        await saveUserBook({
          googleBookId:
            book.google_book_id,
          title:
            book.title,
          authors:
            book.authors ?? [],
          coverUrl:
            book.cover_url,
          isbn:
            book.isbn,
          publishedDate:
            book.published_date,
          status,
        });

      setBooks(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              book.id
                ? updatedBook
                : item
          )
      );

      dismissBookSheet(() => {
        if (status === 'read' || status === 'dnf') {
          router.push({ pathname: '/rate-review', params: { googleBookId: book.google_book_id } });
        }
      });
    } catch (updateError) {
      console.error(
        'Could not update book status:',
        updateError
      );

      Alert.alert(
        'Could not update book',
        'Novori had trouble changing this book status. Please try again.'
      );
    } finally {
      setUpdatingBookId(
        null
      );
    }
  }

  async function startSelectedReadingJourney() {
    if (
      !selectedBook ||
      selectedBook.status !==
        'want_to_read' ||
      updatingBookId
    ) {
      return;
    }

    const book =
      selectedBook;

    try {
      setUpdatingBookId(
        book.id
      );

      const session =
        await transitionReadingJourney(
          book.google_book_id,
          'start'
        );

      const updatedBook:
        UserBook = {
          ...book,
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

      setBooks(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              book.id
                ? updatedBook
                : item
          )
      );

      setSelectedBook(
        updatedBook
      );

      dismissBookSheet(
        () => {
          router.push({
            pathname:
              '/reading-details/[id]',
            params: {
              id:
                book.google_book_id,
            },
          });
        }
      );
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
      setUpdatingBookId(
        null
      );
    }
  }

  async function toggleBookOwned(
    book: UserBook
  ) {
    if (
      updatingBookId
    ) {
      return;
    }

    try {
      setUpdatingBookId(
        book.id
      );

      const updatedBook =
        await updateUserBookOwned(
          book.google_book_id,
          !book.owned
        );

      setBooks(
        (
          current
        ) =>
          current.map(
            (
              item
            ) =>
              item.id ===
                book.id
                ? updatedBook
                : item
          )
      );

      setSelectedBook(
        updatedBook
      );
    } catch (
      updateError
    ) {
      console.error(
        'Could not update book ownership:',
        updateError
      );

      Alert.alert(
        'Could not update ownership',
        'Please try again.'
      );
    } finally {
      setUpdatingBookId(
        null
      );
    }
  }

  function confirmRemove(
    book: UserBook
  ) {
    setRemoveConfirmBook(
      book
    );
  }

  async function removeBook(
    book: UserBook
  ) {
    if (updatingBookId) {
      return;
    }

    try {
      setUpdatingBookId(
        book.id
      );

      await removeUserBook(
        book.google_book_id
      );

      setBooks(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              book.id
          )
      );
    } catch (removeError) {
      console.error(
        'Could not remove book:',
        removeError
      );

      Alert.alert(
        'Could not remove book',
        'Novori had trouble removing this book from your library. Please try again.'
      );

      throw removeError;
    } finally {
      setUpdatingBookId(
        null
      );
    }
  }

  function getEmptyTitle() {
    if (
      ownershipFilter ===
        'owned'
    ) {
      return 'No owned books yet.';
    }

    if (
      ownershipFilter ===
        'not_owned'
    ) {
      return 'No not-owned books here.';
    }

    if (
      activeFilter ===
      'all'
    ) {
      return 'Your library is empty.';
    }

    if (
      activeFilter ===
      'want_to_read'
    ) {
      return 'No TBR books yet.';
    }

    return `No ${STATUS_LABELS[
      activeFilter
    ].toLowerCase()} books yet.`;
  }

  function renderHeader() {
    return (
      <>
        <View
          style={
            styles.header
          }
        >
          <View
            style={
              styles.headerTopRow
            }
          >
            <Text
              style={
                styles.heading
              }
            >
              Library
            </Text>

            <Pressable
              onPress={() =>
                router.push(
                  '/book-cart'
                )
              }
              hitSlop={8}
              style={({ pressed }) => [
                styles.cartButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="cart-outline"
                size={22}
                color={
                  colors.gold
                }
              />

              {cartCount >
              0 ? (
                <View
                  style={
                    styles.cartBadge
                  }
                >
                  <Text
                    style={
                      styles.cartBadgeText
                    }
                  >
                    {
                      cartCount
                    }
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <Text
            style={
              styles.subheading
            }
          >
            Your books, shelves,
            and reading history.
          </Text>
        </View>

        <View
          style={
            styles.searchWrap
          }
        >
          <Ionicons
            name="search-outline"
            size={19}
            color={
              colors.mutedText
            }
          />

          <TextInput
            value={
              searchQuery
            }
            onChangeText={
              setSearchQuery
            }
            placeholder="Search your library"
            placeholderTextColor={
              colors.mutedText
            }
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="never"
            style={
              styles.searchInput
            }
          />

          {searchQuery ? (
            <Pressable
              onPress={() =>
                setSearchQuery(
                  ''
                )
              }
              hitSlop={8}
              style={({ pressed }) => [
                styles.searchClear,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="close-circle"
                size={19}
                color={
                  colors.mutedText
                }
              />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          ref={
            filterScrollRef
          }
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.filterRow
          }
          style={
            styles.filterScroll
          }
          onScroll={(event) => {
            filterScrollOffsetRef.current =
              event.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={
            16
          }
          onLayout={
            restoreFilterScrollPosition
          }
          onContentSizeChange={
            restoreFilterScrollPosition
          }
        >
          {FILTERS.map(
            (filter) => {
              const selected =
                activeFilter ===
                filter.value;

              return (
                <Pressable
                  key={
                    filter.value
                  }
                  onPress={() =>
                    setActiveFilter(
                      filter.value
                    )
                  }
                  style={[
                    styles.filterChip,
                    selected &&
                      styles.filterChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selected &&
                        styles.filterChipTextSelected,
                    ]}
                  >
                    {
                      filter.label
                    }
                  </Text>

                  <View
                    style={[
                      styles.filterCount,
                      selected &&
                        styles.filterCountSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterCountText,
                        selected &&
                          styles.filterCountTextSelected,
                      ]}
                    >
                      {
                        counts[
                          filter.value
                        ]
                      }
                    </Text>
                  </View>
                </Pressable>
              );
            }
          )}
        </ScrollView>

        <View
          style={
            styles.ownershipFilterWrap
          }
        >
          <Text
            style={
              styles.ownershipFilterLabel
            }
          >
            Ownership
          </Text>

          <View
            style={
              styles.ownershipSegment
            }
          >
            {(
              [
                {
                  value:
                    'all',
                  label:
                    'All',
                },
                {
                  value:
                    'owned',
                  label:
                    'Owned',
                },
                {
                  value:
                    'not_owned',
                  label:
                    'Not Owned',
                },
              ] as Array<{
                value:
                  OwnershipFilter;
                label:
                  string;
              }>
            ).map(
              (
                option
              ) => {
                const selected =
                  ownershipFilter ===
                  option.value;

                return (
                  <Pressable
                    key={
                      option.value
                    }
                    onPress={() =>
                      setOwnershipFilter(
                        option.value
                      )
                    }
                    style={[
                      styles.ownershipSegmentButton,
                      selected &&
                        styles.ownershipSegmentButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.ownershipSegmentText,
                        selected &&
                          styles.ownershipSegmentTextActive,
                      ]}
                    >
                      {
                        option.label
                      }
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>
        </View>

        <View
          style={
            styles.toolbar
          }
        >
          <Text
            style={
              styles.resultsText
            }
          >
            {visibleBooks.length}{' '}
            {visibleBooks.length ===
            1
              ? 'book'
              : 'books'}
          </Text>

          <Pressable
            onPress={
              openSortMenu
            }
            style={({ pressed }) => [
              styles.sortButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="swap-vertical-outline"
              size={16}
              color={
                colors.gold
              }
            />

            <Text
              style={
                styles.sortText
              }
            >
              {sortLabel}
            </Text>

            <Ionicons
              name="chevron-down"
              size={14}
              color={
                colors.mutedText
              }
            />
          </Pressable>
        </View>
      </>
    );
  }

  function renderBook({
    item,
  }: {
    item: UserBook;
  }) {
    const updating =
      updatingBookId ===
      item.id;

    const author =
      item.authors?.length
        ? item.authors.join(
            ', '
          )
        : 'Unknown author';

    return (
      <Pressable
        onPress={() =>
          openBook(
            item.google_book_id
          )
        }
        style={({ pressed }) => [
          styles.bookCard,
          pressed &&
            styles.pressed,
        ]}
      >
        <View
          style={
            styles.coverWrap
          }
        >
          {item.cover_url ? (
            <ExpoImage
              source={
                item.cover_url
              }
              style={
                styles.cover
              }
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
              recyclingKey={
                item.cover_url
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
                size={32}
                color={
                  colors.mutedText
                }
              />
            </View>
          )}

          {item.status ? (
            <View
              style={
                styles.statusBadge
              }
            >
              <Text
                style={
                  styles.statusBadgeText
                }
                numberOfLines={
                  1
                }
              >
                {
                  STATUS_LABELS[
                    item.status
                  ]
                }
              </Text>
            </View>
          ) : null}

        </View>

        <View
          style={
            styles.titleRow
          }
        >
          <Text
            style={
              styles.bookTitle
            }
            numberOfLines={
              2
            }
          >
            {item.title}
          </Text>

          <Pressable
            accessibilityLabel={
              `Manage ${item.title}`
            }
            hitSlop={8}
            disabled={
              updating
            }
            onPress={(
              event
            ) => {
              event.stopPropagation();

              showBookActions(
                item
              );
            }}
            style={({ pressed }) => [
              styles.inlineManageButton,
              pressed &&
                styles.inlineManageButtonPressed,
            ]}
          >
            {updating ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.gold
                }
              />
            ) : (
              <Ionicons
                name="ellipsis-horizontal"
                size={18}
                color={
                  colors.gold
                }
              />
            )}
          </Pressable>
        </View>

        <View
          style={
            styles.authorRow
          }
        >
          <Text
            style={
              styles.bookAuthor
            }
            numberOfLines={
              1
            }
          >
            {author}
          </Text>

          {item.owned ? (
            <Ionicons
              name="checkmark-circle"
              size={15}
              color={
                colors.gold
              }
            />
          ) : null}
        </View>

        {item.rating !==
        null ? (
          <View
            style={
              styles.ratingRow
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
                styles.ratingText
              }
            >
              {
                item.rating
              }
            </Text>
          </View>
        ) : (
          <View
            style={
              styles.ratingSpacer
            }
          />
        )}
      </Pressable>
    );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
        edges={[
          'top',
        ]}
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            size="large"
            color={
              colors.gold
            }
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading your books...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
        edges={[
          'top',
        ]}
      >
        <View
          style={
            styles.contentShell
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
              Library
            </Text>

            <Text
              style={
                styles.subheading
              }
            >
              Your books, shelves,
              and reading history.
            </Text>
          </View>

          <View
            style={
              styles.errorCard
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={26}
              color={
                colors.danger
              }
            />

            <Text
              style={
                styles.errorTitle
              }
            >
              Something went wrong
            </Text>

            <Text
              style={
                styles.errorText
              }
            >
              {error}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView
        style={
          styles.safeArea
        }
        edges={[
          'top',
        ]}
      >
        <FlatList
          ref={
            libraryListRef
          }
          data={
            visibleBooks
          }
          keyExtractor={(
            item
          ) =>
            item.id
          }
          renderItem={
            renderBook
          }
          numColumns={2}
          columnWrapperStyle={
            styles.gridRow
          }
          ListHeaderComponent={
            renderHeader()
          }
          ListEmptyComponent={
            <View
              style={
                styles.emptyState
              }
            >
              <View
                style={
                  styles.emptyIcon
                }
              >
                <Ionicons
                  name="library-outline"
                  size={27}
                  color={
                    colors.gold
                  }
                />
              </View>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                {searchQuery.trim()
                  ? 'No matching books'
                  : getEmptyTitle()}
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                {searchQuery.trim()
                  ? 'Try a different title or author.'
                  : 'Books you save will appear here.'}
              </Text>
            </View>
          }
          contentContainerStyle={
            styles.listContent
          }
          onScroll={(event) => {
            libraryScrollOffsetRef.current =
              event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={
            16
          }
          onContentSizeChange={() => {
            if (
              restoreLibraryScrollRef.current
            ) {
              restoreLibraryScrollRef.current =
                false;

              restoreLibraryScrollPosition();
            }
          }}
          showsVerticalScrollIndicator={
            false
          }
        />
      </SafeAreaView>

      <RemoveBookConfirmSheet
        visible={
          removeConfirmBook !==
          null
        }
        bookTitle={
          removeConfirmBook
            ?.title ??
          ''
        }
        hasReadingDetails={
          Boolean(
            removeConfirmBook &&
            Boolean(
              removeConfirmBook.status &&
              removeConfirmBook.status !==
                'want_to_read'
            )
          )
        }
        busy={
          Boolean(
            removeConfirmBook &&
            updatingBookId ===
              removeConfirmBook.id
          )
        }
        onDismiss={() =>
          setRemoveConfirmBook(
            null
          )
        }
        onConfirm={async () => {
          if (
            !removeConfirmBook
          ) {
            return;
          }

          await removeBook(
            removeConfirmBook
          );
        }}
      />

      <Modal
        visible={
          selectedBook !==
          null
        }
        transparent
        animationType="none"
        onShow={() => {
          sheetShown.current = true;
          animateBookSheetIn();
        }}
        onDismiss={handleBookSheetDismiss}
        onRequestClose={
          closeBookActions
        }
      >
        <Pressable
          style={
            styles.sheetBackdrop
          }
          onPress={
            closeBookActions
          }
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.sheetBackdropVisual, { opacity: backdropOpacity }]}
          />
          <Animated.View
            onLayout={(event) => {
              sheetHeight.current = event.nativeEvent.layout.height;
              animateBookSheetIn();
            }}
            style={[styles.actionSheet, {
              paddingBottom: Math.max(18, insets.bottom + 12),
              opacity: sheetOpacity,
              transform: [{ translateY: sheetTranslateY }],
            }]}
          >
          <Pressable
            onPress={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <View
              style={
                styles.sheetHandle
              }
            />

            {selectedBook ? (
              <>
                <View
                  style={
                    styles.sheetHeader
                  }
                >
                  {selectedBook.cover_url ? (
                    <ExpoImage
                      source={
                        selectedBook.cover_url
                      }
                      style={
                        styles.sheetCover
                      }
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={0}
                      recyclingKey={
                        selectedBook.cover_url
                      }
                    />
                  ) : (
                    <View
                      style={
                        styles.sheetCoverPlaceholder
                      }
                    >
                      <Ionicons
                        name="book-outline"
                        size={20}
                        color={
                          colors.gold
                        }
                      />
                    </View>
                  )}

                  <View
                    style={
                      styles.sheetHeaderText
                    }
                  >
                    <Text
                      style={
                        styles.sheetTitle
                      }
                      numberOfLines={
                        2
                      }
                    >
                      {
                        selectedBook.title
                      }
                    </Text>

                    <View
                      style={
                        styles.sheetStatusPill
                      }
                    >
                      <Text
                        style={
                          styles.sheetStatusText
                        }
                      >
                        {
                          STATUS_LABELS[
                            selectedBook.status
                          ]
                        }
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={
                      closeBookActions
                    }
                    hitSlop={8}
                    style={({
                      pressed,
                    }) => [
                      styles.sheetCloseButton,
                      pressed &&
                        styles.sheetRowPressed,
                    ]}
                  >
                    <Ionicons
                      name="close"
                      size={20}
                      color={
                        colors.mutedText
                      }
                    />
                  </Pressable>
                </View>

                {actionSheetMode ===
                'actions' ? (
                  <View
                    style={
                      styles.sheetActions
                    }
                  >
                    {(
                      selectedBook.status ===
                        'read' ||
                      selectedBook.status ===
                        'dnf'
                    ) ? (
                      <>
                        {selectedBook.rating !==
                          null ||
                        Boolean(
                          selectedBook.review_text
                            ?.trim()
                        ) ? (
                          <View
                            style={
                              styles.reviewPreviewCard
                            }
                          >
                            <View
                              style={
                                styles.reviewPreviewTop
                              }
                            >
                              <View
                                style={
                                  styles.reviewStarsRow
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
                                      selectedBook.rating !==
                                        null &&
                                      selectedBook.rating >=
                                        starNumber
                                    ) {
                                      icon =
                                        'star';
                                    } else if (
                                      selectedBook.rating !==
                                        null &&
                                      selectedBook.rating >=
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
                                          16
                                        }
                                        color={
                                          colors.gold
                                        }
                                      />
                                    );
                                  }
                                )}
                              </View>

                              {selectedBook.rating !==
                              null ? (
                                <Text
                                  style={
                                    styles.reviewRatingText
                                  }
                                >
                                  {selectedBook.rating.toFixed(
                                    1
                                  )}
                                </Text>
                              ) : null}
                            </View>

                            <Text
                              style={
                                styles.reviewPreviewLabel
                              }
                            >
                              YOUR REVIEW
                            </Text>

                            <Text
                              style={
                                styles.reviewPreviewText
                              }
                              numberOfLines={
                                3
                              }
                            >
                              {selectedBook.review_text
                                ?.trim() ||
                                'You rated this book but have not added a written review yet.'}
                            </Text>
                          </View>
                        ) : null}

                        <Pressable
                          onPress={
                            openSelectedReview
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.sheetRow,
                            pressed &&
                              styles.sheetRowPressed,
                          ]}
                        >
                          <View
                            style={
                              styles.sheetRowIcon
                            }
                          >
                            <Ionicons
                              name={
                                selectedBook.rating !==
                                  null ||
                                Boolean(
                                  selectedBook.review_text
                                    ?.trim()
                                )
                                  ? 'create-outline'
                                  : 'star-outline'
                              }
                              size={
                                20
                              }
                              color={
                                colors.gold
                              }
                            />
                          </View>

                          <View
                            style={
                              styles.sheetRowText
                            }
                          >
                            <Text
                              style={
                                styles.sheetRowTitle
                              }
                            >
                              {selectedBook.rating !==
                                null ||
                              Boolean(
                                selectedBook.review_text
                                  ?.trim()
                              )
                                ? selectedBook.review_text
                                    ?.trim()
                                  ? 'Edit Review'
                                  : 'Add Review'
                                : 'Rate & Review'}
                            </Text>

                            <Text
                              style={
                                styles.sheetRowSubtitle
                              }
                            >
                              {selectedBook.rating !==
                                null ||
                              Boolean(
                                selectedBook.review_text
                                  ?.trim()
                              )
                                ? 'Update your saved rating or review'
                                : 'Add your rating and thoughts whenever you are ready'}
                            </Text>
                          </View>

                          <Ionicons
                            name="chevron-forward"
                            size={
                              18
                            }
                            color={
                              colors.mutedText
                            }
                          />
                        </Pressable>

                        {selectedBook.status ===
                          'read' &&
                        Boolean(
                          selectedBook.review_text
                            ?.trim()
                        ) ? (
                          <Pressable
                            onPress={
                              shareSelectedReview
                            }
                            style={({
                              pressed,
                            }) => [
                              styles.sheetRow,
                              pressed &&
                                styles.sheetRowPressed,
                            ]}
                          >
                            <View
                              style={
                                styles.sheetRowIcon
                              }
                            >
                              <Ionicons
                                name="share-social-outline"
                                size={
                                  20
                                }
                                color={
                                  colors.gold
                                }
                              />
                            </View>

                            <View
                              style={
                                styles.sheetRowText
                              }
                            >
                              <Text
                                style={
                                  styles.sheetRowTitle
                                }
                              >
                                Share Review
                              </Text>

                              <Text
                                style={
                                  styles.sheetRowSubtitle
                                }
                              >
                                Share this saved review to your Feed or a Club
                              </Text>
                            </View>

                            <Ionicons
                              name="chevron-forward"
                              size={
                                18
                              }
                              color={
                                colors.mutedText
                              }
                            />
                          </Pressable>
                        ) : null}

                        <View
                          style={
                            styles.sheetDivider
                          }
                        />
                      </>
                    ) : null}

                    <Pressable
                      onPress={
                        openSelectedBook
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.sheetRow,
                        pressed &&
                          styles.sheetRowPressed,
                      ]}
                    >
                      <View
                        style={
                          styles.sheetRowIcon
                        }
                      >
                        <Ionicons
                          name="book-outline"
                          size={20}
                          color={
                            colors.gold
                          }
                        />
                      </View>

                      <View
                        style={
                          styles.sheetRowText
                        }
                      >
                        <Text
                          style={
                            styles.sheetRowTitle
                          }
                        >
                          Open Book
                        </Text>

                        <Text
                          style={
                            styles.sheetRowSubtitle
                          }
                        >
                          View details and your saved activity
                        </Text>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={
                          colors.mutedText
                        }
                      />
                    </Pressable>

                    {selectedBook.status ===
                    'want_to_read' ? (
                      <Pressable
                        onPress={() =>
                          void startSelectedReadingJourney()
                        }
                        disabled={
                          updatingBookId !==
                          null
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.sheetRow,
                          pressed &&
                            styles.sheetRowPressed,
                        ]}
                      >
                        <View
                          style={
                            styles.sheetRowIcon
                          }
                        >
                          {updatingBookId ===
                          selectedBook.id ? (
                            <ActivityIndicator
                              size="small"
                              color={
                                colors.gold
                              }
                            />
                          ) : (
                            <Ionicons
                              name="play-outline"
                              size={20}
                              color={
                                colors.gold
                              }
                            />
                          )}
                        </View>

                        <View
                          style={
                            styles.sheetRowText
                          }
                        >
                          <Text
                            style={
                              styles.sheetRowTitle
                            }
                          >
                            Start Reading
                          </Text>

                          <Text
                            style={
                              styles.sheetRowSubtitle
                            }
                          >
                            Begin a new reading journey
                          </Text>
                        </View>

                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={
                            colors.mutedText
                          }
                        />
                      </Pressable>
                    ) : selectedBook.status ? (
                      <Pressable
                        onPress={
                          openSelectedReadingDetails
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.sheetRow,
                          pressed &&
                            styles.sheetRowPressed,
                        ]}
                      >
                        <View
                          style={
                            styles.sheetRowIcon
                          }
                        >
                          <Ionicons
                            name="journal-outline"
                            size={20}
                            color={
                              colors.gold
                            }
                          />
                        </View>

                        <View
                          style={
                            styles.sheetRowText
                          }
                        >
                          <Text
                            style={
                              styles.sheetRowTitle
                            }
                          >
                            View Reading Details
                          </Text>

                          <Text
                            style={
                              styles.sheetRowSubtitle
                            }
                          >
                            Manage progress, dates, pause or resume, and history
                          </Text>
                        </View>

                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={
                            colors.mutedText
                          }
                        />
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() =>
                          setActionSheetMode(
                            'status'
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.sheetRow,
                          pressed &&
                            styles.sheetRowPressed,
                        ]}
                      >
                        <View
                          style={
                            styles.sheetRowIcon
                          }
                        >
                          <Ionicons
                            name="bookmark-outline"
                            size={20}
                            color={
                              colors.gold
                            }
                          />
                        </View>

                        <View
                          style={
                            styles.sheetRowText
                          }
                        >
                          <Text
                            style={
                              styles.sheetRowTitle
                            }
                          >
                            Choose Reading Status
                          </Text>

                          <Text
                            style={
                              styles.sheetRowSubtitle
                            }
                          >
                            Set the initial place for this book
                          </Text>
                        </View>

                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={
                            colors.mutedText
                          }
                        />
                      </Pressable>
                    )}

                    <Pressable
                      onPress={() =>
                        void toggleBookOwned(
                          selectedBook
                        )
                      }
                      disabled={
                        updatingBookId !==
                        null
                      }
                      style={({ pressed }) => [
                        styles.sheetRow,
                        pressed &&
                          styles.sheetRowPressed,
                      ]}
                    >
                      <View
                        style={
                          styles.sheetRowIcon
                        }
                      >
                        <Ionicons
                          name={
                            selectedBook.owned
                              ? 'checkmark-circle'
                              : 'checkmark-circle-outline'
                          }
                          size={20}
                          color={
                            colors.gold
                          }
                        />
                      </View>

                      <View
                        style={
                          styles.sheetRowText
                        }
                      >
                        <Text
                          style={
                            styles.sheetRowTitle
                          }
                        >
                          {selectedBook.owned
                            ? 'Remove Owned'
                            : 'Mark as Owned'}
                        </Text>

                        <Text
                          style={
                            styles.sheetRowSubtitle
                          }
                        >
                          {selectedBook.owned
                            ? 'This book will stay in your Library'
                            : 'Mark this as a book you own'}
                        </Text>
                      </View>
                    </Pressable>

                    <View
                      style={
                        styles.sheetDivider
                      }
                    />

                    <Pressable
                      onPress={
                        removeSelectedBook
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.sheetRow,
                        pressed &&
                          styles.sheetRowPressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.sheetRowIcon,
                          styles.sheetDangerIcon,
                        ]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color={
                            colors.danger
                          }
                        />
                      </View>

                      <View
                        style={
                          styles.sheetRowText
                        }
                      >
                        <Text
                          style={
                            styles.sheetDangerText
                          }
                        >
                          Remove from Library
                        </Text>

                        <Text
                          style={
                            styles.sheetRowSubtitle
                          }
                        >
                          Removes the saved rating and review too
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                ) : (
                  <View
                    style={
                      styles.sheetActions
                    }
                  >
                    <Pressable
                      onPress={() =>
                        setActionSheetMode(
                          'actions'
                        )
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.statusBackRow,
                        pressed &&
                          styles.sheetRowPressed,
                      ]}
                    >
                      <Ionicons
                        name="chevron-back"
                        size={18}
                        color={
                          colors.gold
                        }
                      />

                      <Text
                        style={
                          styles.statusBackText
                        }
                      >
                        Change Status
                      </Text>
                    </Pressable>

                    {(
                      [
                        'reading',
                        'want_to_read',
                        'read',
                        'dnf',
                      ] as UserBookStatus[]
                    ).map(
                      (
                        status
                      ) => {
                        const isCurrent =
                          status ===
                          selectedBook.status;

                        return (
                          <Pressable
                            key={
                              status
                            }
                            disabled={
                              isCurrent ||
                              updatingBookId !==
                                null
                            }
                            onPress={() =>
                              changeBookStatus(
                                selectedBook,
                                status
                              )
                            }
                            style={({
                              pressed,
                            }) => [
                              styles.statusOption,
                              isCurrent &&
                                styles.statusOptionCurrent,
                              pressed &&
                                !isCurrent &&
                                styles.sheetRowPressed,
                            ]}
                          >
                            <View
                              style={
                                styles.sheetRowIcon
                              }
                            >
                              <Ionicons
                                name={
                                  STATUS_ICONS[
                                    status
                                  ]
                                }
                                size={20}
                                color={
                                  isCurrent
                                    ? colors.gold
                                    : colors.secondaryText
                                }
                              />
                            </View>

                            <Text
                              style={[
                                styles.statusOptionText,
                                isCurrent &&
                                  styles.statusOptionTextCurrent,
                              ]}
                            >
                              {
                                STATUS_LABELS[
                                  status
                                ]
                              }
                            </Text>

                            {isCurrent ? (
                              <Ionicons
                                name="checkmark"
                                size={19}
                                color={
                                  colors.gold
                                }
                              />
                            ) : null}
                          </Pressable>
                        );
                      }
                    )}
                  </View>
                )}
              </>
            ) : null}
          </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    listContent: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 120,
    },

    contentShell: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 22,
    },

    header: {
      marginBottom: 22,
    },

    headerTopRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    cartButton: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      position:
        'relative',
    },

    cartBadge: {
      position:
        'absolute',
      top: -5,
      right: -5,
      minWidth: 19,
      height: 19,
      paddingHorizontal: 5,
      borderRadius: 10,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.gold,
      borderWidth: 2,
      borderColor:
        colors.background,
    },

    cartBadgeText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 9,
    },

    heading: {
      color: colors.gold,
      fontSize: 43,
      fontFamily:
        'PlayfairDisplay_700Bold',
      letterSpacing: 0.2,
    },

    subheading: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 15,
      marginTop: 5,
      letterSpacing: 0.15,
    },

    searchWrap: {
      minHeight: 48,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 10,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 14,
      paddingHorizontal: 13,
      marginBottom: 14,
    },

    searchInput: {
      flex: 1,
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize: 14,
      paddingVertical: 0,
    },

    searchClear: {
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    filterScroll: {
      marginHorizontal: -20,
    },

    filterRow: {
      paddingHorizontal: 20,
      gap: 8,
    },

    filterChip: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 999,
      paddingLeft: 13,
      paddingRight: 8,
      gap: 7,
    },

    filterChipSelected: {
      backgroundColor:
        colors.gold,
      borderColor:
        colors.gold,
    },

    filterChipText: {
      color: colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12,
    },

    filterChipTextSelected: {
      color:
        colors.background,
    },

    filterCount: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor:
        colors.elevated,
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal: 6,
    },

    filterCountSelected: {
      backgroundColor:
        colors.background,
    },

    filterCountText: {
      color: colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10,
    },

    filterCountTextSelected: {
      color: colors.gold,
    },

    ownershipFilterWrap: {
      marginTop: 10,
    },

    ownershipFilterLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_700Bold',
      fontSize: 9,
      letterSpacing: 1,
      textTransform:
        'uppercase',
      marginBottom: 6,
      paddingHorizontal: 2,
    },

    ownershipSegment: {
      alignSelf:
        'flex-start',
      flexDirection:
        'row',
      padding: 3,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
    },

    ownershipSegmentButton: {
      minHeight: 31,
      paddingHorizontal: 11,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderRadius: 9,
    },

    ownershipSegmentButtonActive: {
      backgroundColor:
        colors.elevated,
    },

    ownershipSegmentText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
    },

    ownershipSegmentTextActive: {
      color:
        colors.gold,
    },

    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginTop: 20,
      marginBottom: 14,
    },

    resultsText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 12,
    },

    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 11,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 6,
    },

    sortText: {
      color: colors.text,
      fontFamily:
        'Inter_500Medium',
      fontSize: 11,
    },

    gridRow: {
      justifyContent:
        'space-between',
      gap: 14,
    },

    bookCard: {
      width: '48%',
      marginBottom: 24,
    },

    coverWrap: {
      width: '100%',
      aspectRatio: 0.67,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      position: 'relative',
    },

    cover: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },

    coverPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
    },

    statusBadge: {
      position: 'absolute',
      left: 8,
      bottom: 8,
      maxWidth: '72%',
      backgroundColor:
        colors.background,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor:
        colors.border,
    },

    statusBadgeText: {
      color: colors.softGold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 9,
      letterSpacing: 0.25,
    },

    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 8,
      gap: 4,
    },

    inlineManageButton: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent:
        'center',
      marginTop: -3,
      marginRight: -3,
    },

    inlineManageButtonPressed: {
      backgroundColor:
        colors.elevated,
    },

    bookTitle: {
      flex: 1,
      color: colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
      lineHeight: 19,
    },

    authorRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 5,
      marginTop: 3,
    },

    bookAuthor: {
      flex: 1,
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
    },

    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
    },

    ratingText: {
      color: colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
      marginLeft: 4,
    },

    ratingSpacer: {
      height: 19,
      marginTop: 6,
    },

    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: 30,
    },

    emptyIcon: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    emptyTitle: {
      color: colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 16,
      textAlign: 'center',
      marginTop: 14,
    },

    emptyText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      textAlign: 'center',
      marginTop: 5,
    },

    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    loadingText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      marginTop: 12,
    },

    errorCard: {
      alignItems: 'center',
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 18,
      padding: 28,
    },

    errorTitle: {
      color: colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 16,
      marginTop: 10,
    },

    errorText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      textAlign: 'center',
      marginTop: 5,
    },

    sheetBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'transparent',
    },
    sheetBackdropVisual: {
      ...StyleSheet.absoluteFill,
      backgroundColor: 'rgba(0, 0, 0, 0.52)',
    },

    actionSheet: {
      width: '100%',
      alignSelf: 'center',
      backgroundColor:
        colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
      paddingHorizontal: 18,
      paddingTop: 9,
      paddingBottom: 34,
    },

    sheetHandle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor:
        colors.border,
      alignSelf: 'center',
      marginBottom: 15,
    },

    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 15,
    },

    sheetCover: {
      width: 42,
      height: 62,
      borderRadius: 6,
      backgroundColor:
        colors.elevated,
    },

    sheetCoverPlaceholder: {
      width: 42,
      height: 62,
      borderRadius: 6,
      backgroundColor:
        colors.elevated,
      alignItems: 'center',
      justifyContent:
        'center',
      borderWidth: 1,
      borderColor:
        colors.border,
    },

    sheetHeaderText: {
      flex: 1,
      marginLeft: 12,
      marginRight: 10,
    },

    sheetTitle: {
      color: colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 15,
      lineHeight: 20,
    },

    sheetStatusPill: {
      alignSelf: 'flex-start',
      backgroundColor:
        colors.elevated,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginTop: 7,
    },

    sheetStatusText: {
      color: colors.softGold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 10,
    },

    sheetCloseButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    sheetActions: {
      borderTopWidth: 1,
      borderTopColor:
        colors.border,
      paddingTop: 7,
    },

    reviewPreviewCard: {
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        14,
      paddingHorizontal:
        13,
      paddingVertical:
        12,
      marginHorizontal:
        4,
      marginTop:
        3,
      marginBottom:
        5,
    },

    reviewPreviewTop: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginBottom:
        8,
    },

    reviewStarsRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        2,
    },

    reviewRatingText: {
      color:
        colors.softGold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        12,
    },

    reviewPreviewLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        9.5,
      letterSpacing:
        1.15,
      marginBottom:
        4,
    },

    reviewPreviewText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      lineHeight:
        18,
    },

    sheetRow: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },

    sheetRowPressed: {
      backgroundColor:
        colors.elevated,
    },

    sheetRowIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      marginRight: 11,
    },

    sheetDangerIcon: {
      backgroundColor:
        colors.background,
    },

    sheetRowText: {
      flex: 1,
      marginRight: 8,
    },

    sheetRowTitle: {
      color: colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
    },

    sheetRowSubtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      lineHeight: 16,
      marginTop: 3,
    },

    sheetDivider: {
      height: 1,
      backgroundColor:
        colors.border,
      marginVertical: 5,
    },

    sheetDangerText: {
      color:
        colors.danger,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
    },

    statusBackRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingRight: 10,
      marginBottom: 5,
    },

    statusBackText: {
      color: colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 13,
      marginLeft: 2,
    },

    statusOption: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },

    statusOptionCurrent: {
      backgroundColor:
        colors.elevated,
    },

    statusOptionText: {
      flex: 1,
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
    },

    statusOptionTextCurrent: {
      color:
        colors.gold,
    },

    pressed: {
      opacity: 0.68,
    },
  });
}
