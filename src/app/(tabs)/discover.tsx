import { useFocusEffect, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../constants/novori-theme';

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

const SEARCH_DELAY_MS = 350;
const MIN_SEARCH_LENGTH = 2;

export default function DiscoverScreen() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<GoogleBookItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const debounceTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const latestRequestRef =
    useRef(0);

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (
          debounceTimerRef.current
        ) {
          clearTimeout(
            debounceTimerRef.current
          );
        }

        latestRequestRef.current += 1;
        setQuery('');
        setBooks([]);
        setError('');
        setLoading(false);
      };
    }, [])
  );

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

  function openBook(
    bookId: string
  ) {
    router.push({
      pathname:
        '/book/[id]',
      params: {
        id: bookId,
        source: 'discover',
      },
    });
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

  const hasSearchText =
    query.trim().length >=
    MIN_SEARCH_LENGTH;

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
              styles.searchContainer
            }
          >
            <TextInput
              style={
                styles.input
              }
              placeholder="Title, author, or ISBN"
              placeholderTextColor={
                COLORS.mutedText
              }
              value={query}
              onChangeText={
                setQuery
              }
              returnKeyType="search"
              onSubmitEditing={
                searchImmediately
              }
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              blurOnSubmit={false}
            />

            {loading ? (
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

          {error ? (
            <Text
              style={
                styles.error
              }
            >
              {error}
            </Text>
          ) : null}
        </View>

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
                      : 'Search the catalog'}
                  </Text>

                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    {hasSearchText
                      ? 'Try a different title, author, or ISBN.'
                      : 'Results will appear here automatically as you type.'}
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
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
