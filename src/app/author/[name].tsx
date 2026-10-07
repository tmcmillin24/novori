import { displayBookTitle } from '../../lib/book-title';
import { SafeAreaView } from 'react-native-safe-area-context';
import BookCoverImage from '../../components/BookCoverImage';
import { Ionicons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { NovoriColors } from '../../constants/novori-theme';
import { useNovoriTheme } from '../../context/theme-context';
import {
  AuthorBookResult,
  searchAuthorBooks,
} from '../../lib/book-search';

function getCoverUrl(
  result: AuthorBookResult
) {
  const images =
    result.book.volumeInfo
      .imageLinks;

  return (
    images?.extraLarge ??
    images?.large ??
    images?.medium ??
    images?.thumbnail ??
    images?.smallThumbnail ??
    null
  )?.replace(
    'http://',
    'https://'
  ) ??
  null;
}

function formatCount(
  count: number
) {
  return new Intl.NumberFormat(
    'en-US',
    {
      notation:
        count >= 10000
          ? 'compact'
          : 'standard',
      maximumFractionDigits: 1,
    }
  ).format(
    count
  );
}

export default function AuthorScreen() {
  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const router =
    useRouter();

  const {
    name,
    currentBookId,
    currentTitle,
  } =
    useLocalSearchParams<{
      name: string;
      currentBookId?: string;
      currentTitle?: string;
    }>();

  const authorName =
    useMemo(
      () =>
        Array.isArray(
          name
        )
          ? name[0] ??
            ''
          : name ??
            '',
      [name]
    );

  const [
    books,
    setBooks,
  ] =
    useState<
      AuthorBookResult[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    error,
    setError,
  ] =
    useState(
      ''
    );

  const [
    sortMode,
    setSortMode,
  ] =
    useState<
      'popularity' |
      'newest'
    >(
      'popularity'
    );

  const sortedBooks =
    useMemo(
      () => {
        const sorted =
          [
            ...books,
          ];

        if (
          sortMode ===
          'popularity'
        ) {
          return sorted.sort(
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

              const bDate =
                new Date(
                  b.book
                    .volumeInfo
                    .publishedDate ??
                  '0000-01-01'
                ).getTime();

              const aDate =
                new Date(
                  a.book
                    .volumeInfo
                    .publishedDate ??
                  '0000-01-01'
                ).getTime();

              return (
                bDate -
                aDate
              );
            }
          );
        }

        return sorted.sort(
          (
            a,
            b
          ) => {
            const aDate =
              new Date(
                a.book
                  .volumeInfo
                  .publishedDate ??
                '0000-01-01'
              ).getTime();

            const bDate =
              new Date(
                b.book
                  .volumeInfo
                  .publishedDate ??
                '0000-01-01'
              ).getTime();

            if (
              bDate !==
              aDate
            ) {
              return (
                bDate -
                aDate
              );
            }

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

            return (
              b.usersCount -
              a.usersCount
            );
          }
        );
      },
      [
        books,
        sortMode,
      ]
    );

  useEffect(
    () => {
      let cancelled =
        false;

      async function load() {
        if (
          !authorName
        ) {
          setBooks(
            []
          );
          setLoading(
            false
          );
          return;
        }

        try {
          setLoading(
            true
          );
          setError(
            ''
          );

          const results =
            await searchAuthorBooks(
              authorName,
              {
                excludeGoogleBookId:
                  currentBookId,
                excludeTitle:
                  currentTitle,
                onProgress: (
                  progressiveResults
                ) => {
                  if (
                    cancelled
                  ) {
                    return;
                  }

                  setBooks(
                    progressiveResults
                  );
                  setLoading(
                    false
                  );
                },
              }
            );

          if (
            !cancelled
          ) {
            setBooks(
              results
            );
          }
        } catch (
          loadError
        ) {
          console.error(
            'Could not load author books:',
            loadError
          );

          if (
            !cancelled
          ) {
            setError(
              'Novori could not load this author’s books. Please try again.'
            );
          }
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false
            );
          }
        }
      }

      void load();

      return () => {
        cancelled =
          true;
      };
    },
    [
      authorName,
      currentBookId,
      currentTitle,
    ]
  );

  function openBook(
    result:
      AuthorBookResult
  ) {
    const book =
      result.book;

    const coverUrl =
      getCoverUrl(
        result
      );

    router.push({
      pathname:
        '/book/[id]',
      params: {
        id:
          book.id,
        source:
          'author',
        ...(coverUrl
          ? {
              coverUrl,
            }
          : {}),
        ...(book.volumeInfo
          .title
          ? {
              clickedTitle:
                book.volumeInfo
                  .title,
            }
          : {}),
        ...(book.volumeInfo
          .authors?.length
          ? {
              clickedAuthors:
                JSON.stringify(
                  book.volumeInfo
                    .authors
                ),
            }
          : {}),
      },
    });
  }

  function renderBook({
    item,
  }: {
    item:
      AuthorBookResult;
  }) {
    const info =
      item.book
        .volumeInfo;

    const coverUrl =
      getCoverUrl(
        item
      );

    return (
      <Pressable
        onPress={() =>
          openBook(
            item
          )
        }
        style={({ pressed }) => [
          styles.bookCard,
          pressed &&
            styles.pressed,
        ]}
      >
        {(item.book.id || coverUrl) ? (
          <BookCoverImage
            googleBookId={item.book.id}
            existingCoverUrl={coverUrl}
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
              size={28}
              color={
                colors.mutedText
              }
            />
          </View>
        )}

        <View
          style={
            styles.bookCopy
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
            {displayBookTitle(info.title ?? 'Untitled')}
          </Text>

          {info.publishedDate ? (
            <Text
              style={
                styles.published
              }
            >
              {info.publishedDate.slice(
                0,
                4
              )}
            </Text>
          ) : null}

          <View
            style={
              styles.metricRow
            }
          >
            {item.rating !==
            null ? (
              <>
                <View
                  style={
                    styles.starRow
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
                          item.rating! >=
                          star
                            ? 'star'
                            : item.rating! >=
                              star -
                                0.5
                              ? 'star-half'
                              : 'star-outline'
                        }
                        size={13}
                        color={
                          colors.gold
                        }
                      />
                    )
                  )}
                </View>

                <Text
                  style={
                    styles.metricText
                  }
                >
                  {item.rating.toFixed(
                    2
                  )}
                </Text>
              </>
            ) : null}

            <Text
              style={
                styles.metricText
              }
            >
              {formatCount(
                item.ratingsCount
              )}{' '}
              ratings
            </Text>

            <Text
              style={
                styles.metricText
              }
            >
              {formatCount(
                item.reviewsCount
              )}{' '}
              reviews
            </Text>
          </View>

          <Text
            style={
              styles.viewBook
            }
          >
            View book
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace(
                  '/(tabs)/discover'
                )
          }
          hitSlop={
            10
          }
          style={({ pressed }) => [
            styles.backButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={
              colors.gold
            }
          />
        </Pressable>

        <View
          style={
            styles.headerCopy
          }
        >
          <Text
            style={
              styles.eyebrow
            }
          >
            AUTHOR
          </Text>

          <Text
            style={
              styles.heading
            }
            numberOfLines={
              2
            }
          >
            {authorName}
          </Text>
        </View>
      </View>

      {loading ? (
        <View
          style={
            styles.centerState
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
              styles.stateText
            }
          >
            Finding books by{' '}
            {authorName}…
          </Text>
        </View>
      ) : error ? (
        <View
          style={
            styles.centerState
          }
        >
          <Text
            style={
              styles.stateTitle
            }
          >
            Couldn’t load books
          </Text>

          <Text
            style={
              styles.stateText
            }
          >
            {error}
          </Text>
        </View>
      ) : (
        <FlatList
          data={
            sortedBooks
          }
          keyExtractor={(
            item
          ) =>
            item.book.id
          }
          renderItem={
            renderBook
          }
          contentContainerStyle={[
            styles.listContent,
            sortedBooks.length ===
              0 &&
              styles.emptyList,
          ]}
          ListHeaderComponent={
            sortedBooks.length >
            0 ? (
              <View
                style={
                  styles.listHeader
                }
              >
                <Text
                  style={
                    styles.sortNote
                  }
                >
                  Other books
                </Text>

                <View
                  style={
                    styles.sortControl
                  }
                >
                  {(
                    [
                      'popularity',
                      'newest',
                    ] as const
                  ).map(
                    (
                      option
                    ) => {
                      const selected =
                        sortMode ===
                        option;

                      return (
                        <Pressable
                          key={
                            option
                          }
                          onPress={() =>
                            setSortMode(
                              option
                            )
                          }
                          style={[
                            styles.sortButton,
                            selected &&
                              styles.sortButtonActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.sortButtonText,
                              selected &&
                                styles.sortButtonTextActive,
                            ]}
                          >
                            {option ===
                            'popularity'
                              ? 'Popularity'
                              : 'Newest'}
                          </Text>
                        </Pressable>
                      );
                    }
                  )}
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View
              style={
                styles.centerState
              }
            >
              <Text
                style={
                  styles.stateTitle
                }
              >
                No other books found
              </Text>

              <Text
                style={
                  styles.stateText
                }
              >
                Novori didn’t find another distinct title for this author.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(
  colors:
    NovoriColors
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    header: {
      width: '100%',
      maxWidth: '100%',
      alignSelf:
        'center',
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      paddingHorizontal:
        20,
      paddingTop: 8,
      paddingBottom:
        14,
    },

    backButton: {
      width: 38,
      height: 38,
      borderRadius:
        12,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 8,
    },

    headerCopy: {
      flex: 1,
      minWidth: 0,
    },

    eyebrow: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_700Bold',
      fontSize: 9,
      letterSpacing:
        1.2,
      marginBottom: 3,
    },

    heading: {
      color:
        colors.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 30,
      lineHeight: 35,
    },

    listContent: {
      width: '100%',
      maxWidth: '100%',
      alignSelf:
        'center',
      paddingHorizontal:
        20,
      paddingBottom:
        48,
    },

    emptyList: {
      flexGrow: 1,
    },

    listHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap: 12,
      marginBottom: 12,
    },

    sortNote: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12,
      lineHeight: 17,
    },

    sortControl: {
      flexDirection:
        'row',
      padding: 3,
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
    },

    sortButton: {
      minHeight: 30,
      paddingHorizontal: 10,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderRadius: 8,
    },

    sortButtonActive: {
      backgroundColor:
        colors.elevated,
    },

    sortButtonText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 10.5,
    },

    sortButtonTextActive: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
    },

    bookCard: {
      flexDirection:
        'row',
      minHeight: 132,
      marginBottom: 12,
      padding: 11,
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
    },

    cover: {
      width: 76,
      height: 114,
      borderRadius: 8,
      backgroundColor:
        colors.elevated,
    },

    coverPlaceholder: {
      width: 76,
      height: 114,
      borderRadius: 8,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
    },

    bookCopy: {
      flex: 1,
      minWidth: 0,
      marginLeft: 13,
      justifyContent:
        'center',
    },

    bookTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      fontSize: 17,
      lineHeight: 21,
    },

    published: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      marginTop: 4,
    },

    metricRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      flexWrap:
        'wrap',
      gap: 6,
      marginTop: 9,
    },

    starRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 1,
    },

    metricText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 10.5,
    },

    viewBook: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
      marginTop: 9,
    },

    centerState: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        32,
      paddingBottom:
        80,
    },

    stateTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      fontSize: 21,
      textAlign:
        'center',
    },

    stateText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      lineHeight: 19,
      textAlign:
        'center',
      marginTop: 8,
    },

    pressed: {
      opacity: 0.68,
    },
  });
}
