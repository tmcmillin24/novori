import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useRouter,
} from 'expo-router';
import {
  useCallback,
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
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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

import {
  getUserBooks,
  removeUserBook,
  saveUserBook,
  UserBook,
  UserBookStatus,
} from '../../lib/user-books';

type LibraryFilter =
  | 'all'
  | UserBookStatus;

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

export default function LibraryScreen() {
  const router = useRouter();

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
    useState<UserBook[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
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
    actionSheetMode,
    setActionSheetMode,
  ] =
    useState<
      'actions' | 'status'
    >('actions');

  const insets = useSafeAreaInsets();
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(0);
  const sheetShown = useRef(false);
  const sheetStarted = useRef(false);
  const sheetClosing = useRef(false);
  const afterSheetDismiss = useRef<(() => void) | null>(null);

  function animateBookSheetIn() {
    if (!sheetShown.current || !sheetHeight.current || sheetStarted.current || sheetClosing.current) return;
    sheetStarted.current = true;
    sheetTranslateY.setValue(sheetHeight.current + 24);
    sheetOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: 0, duration: 320,
        easing: Easing.bezier(0.22, 0.68, 0.30, 1), useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1, duration: 320,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
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

  function dismissBookSheet(afterDismiss?: () => void) {
    if (sheetClosing.current) return;
    sheetClosing.current = true;
    afterSheetDismiss.current = afterDismiss ?? null;
    sheetTranslateY.stopAnimation();
    backdropOpacity.stopAnimation();
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: sheetHeight.current + 24, duration: 245,
        easing: Easing.bezier(0.32, 0, 0.67, 1), useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0, duration: 245,
        easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      // Keep the sheet offscreen until the native modal finishes dismissing.
      setSelectedBook(null);
      if (Platform.OS !== 'ios') handleBookSheetDismiss();
    });
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
      let active = true;

      async function loadLibrary() {
        try {
          setLoading(true);
          setError('');

          const data =
            await getUserBooks();

          if (active) {
            setBooks(data);
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
      };
    }, [])
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
      const filtered =
        activeFilter === 'all'
          ? [...books]
          : books.filter(
              (book) =>
                book.status ===
                activeFilter
            );

      filtered.sort(
        (a, b) => {
          if (
            activeFilter ===
            'all'
          ) {
            const statusDifference =
              STATUS_ORDER[
                a.status
              ] -
              STATUS_ORDER[
                b.status
              ];

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

  function confirmRemove(
    book: UserBook
  ) {
    Alert.alert(
      'Remove from Library?',
      `Remove ${book.title} from your Novori library? This will also remove its saved rating and review.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            removeBook(
              book
            ),
        },
      ]
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
    } finally {
      setUpdatingBookId(
        null
      );
    }
  }

  function getEmptyTitle() {
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
            <Image
              source={{
                uri:
                  item.cover_url,
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
                size={32}
                color={
                  colors.mutedText
                }
              />
            </View>
          )}

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
                {
                  getEmptyTitle()
                }
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Books you save will
                appear here.
              </Text>
            </View>
          }
          contentContainerStyle={
            styles.listContent
          }
          showsVerticalScrollIndicator={
            false
          }
        />
      </SafeAreaView>

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
                    <Image
                      source={{
                        uri:
                          selectedBook.cover_url,
                      }}
                      style={
                        styles.sheetCover
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
                          name="swap-horizontal-outline"
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
                          Change Status
                        </Text>

                        <Text
                          style={
                            styles.sheetRowSubtitle
                          }
                        >
                          Currently {
                            STATUS_LABELS[
                              selectedBook.status
                            ]
                          }
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
      paddingTop: 12,
      paddingBottom: 120,
    },

    contentShell: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
    },

    header: {
      marginBottom: 22,
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
        'Inter_400Regular',
      fontSize: 15,
      lineHeight: 22,
      marginTop: 5,
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

    bookAuthor: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      marginTop: 3,
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
