import { Ionicons } from '@expo/vector-icons';
import {
    useFocusEffect,
    useRouter,
} from 'expo-router';
import {
    useCallback,
    useState,
} from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import {
    NovoriColors,
} from '../constants/novori-theme';
import {
    useNovoriTheme,
} from '../context/theme-context';
import {
    getUserBooks,
    UserBook,
} from '../lib/user-books';

export default function CurrentlyReadingScreen() {
  const router = useRouter();

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const [
    books,
    setBooks,
  ] =
    useState<UserBook[]>(
      []
    );

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

  useFocusEffect(
    useCallback(() => {
      let active =
        true;

      async function loadBooks() {
        try {
          setLoading(
            true
          );

          setError('');

          const data =
            await getUserBooks(
              'reading'
            );

          if (
            active
          ) {
            setBooks(
              data
            );
          }
        } catch (
          loadError
        ) {
          console.error(
            'Could not load currently reading books:',
            loadError
          );

          if (
            active
          ) {
            setBooks(
              []
            );

            setError(
              'Could not load your currently reading books.'
            );
          }
        } finally {
          if (
            active
          ) {
            setLoading(
              false
            );
          }
        }
      }

      loadBooks();

      return () => {
        active =
          false;
      };
    }, [])
  );

  function goBack() {
    if (
      router.canGoBack()
    ) {
      router.back();
      return;
    }

    router.replace(
      '/(tabs)/profile'
    );
  }

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
          'currently-reading',
      },
    });
  }

  function renderBook({
    item,
  }: {
    item: UserBook;
  }) {
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
        style={({
          pressed,
        }) => [
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
                size={
                  34
                }
                color={
                  colors.gold
                }
              />
            </View>
          )}

          <View
            style={
              styles.readingBadge
            }
          >
            <Text
              style={
                styles.readingBadgeText
              }
            >
              Reading
            </Text>
          </View>
        </View>

        <Text
          style={
            styles.bookTitle
          }
          numberOfLines={
            2
          }
        >
          {
            item.title
          }
        </Text>

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
      </Pressable>
    );
  }

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
          styles.topBar
        }
      >
        <Pressable
          onPress={
            goBack
          }
          hitSlop={
            10
          }
          style={({
            pressed,
          }) => [
            styles.backButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={
              25
            }
            color={
              colors.text
            }
          />

          <Text
            style={
              styles.backText
            }
          >
            Profile
          </Text>
        </Pressable>
      </View>

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
          Currently Reading
        </Text>

        <Text
          style={
            styles.subheading
          }
        >
          Books you’re reading right now.
        </Text>
      </View>

      {loading ? (
        <View
          style={
            styles.centered
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
      ) : error ? (
        <View
          style={
            styles.centered
          }
        >
          <Ionicons
            name="alert-circle-outline"
            size={
              30
            }
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
      ) : (
        <FlatList
          data={
            books
          }
          keyExtractor={(
            item
          ) =>
            item.id
          }
          renderItem={
            renderBook
          }
          numColumns={
            2
          }
          columnWrapperStyle={
            styles.gridRow
          }
          contentContainerStyle={[
            styles.listContent,
            books.length ===
              0 &&
              styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={
            false
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
                  name="book-outline"
                  size={
                    28
                  }
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
                Nothing here yet
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Books you mark as Reading will appear here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
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

    topBar: {
      paddingHorizontal:
        14,
      paddingTop: 4,
      paddingBottom:
        2,
    },

    backButton: {
      flexDirection:
        'row',
      alignItems:
        'center',
      alignSelf:
        'flex-start',
      paddingVertical:
        8,
      paddingRight:
        10,
    },

    backText: {
      color:
        colors.text,
      fontFamily:
        'Inter_500Medium',
      fontSize: 15,
      marginLeft: 1,
    },

    header: {
      width: '100%',
      maxWidth: 720,
      alignSelf:
        'center',
      paddingHorizontal:
        20,
      paddingTop: 8,
      paddingBottom:
        18,
    },

    heading: {
      color:
        colors.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 34,
      lineHeight: 41,
    },

    subheading: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 14,
      marginTop: 4,
    },

    listContent: {
      width: '100%',
      maxWidth: 720,
      alignSelf:
        'center',
      paddingHorizontal:
        20,
      paddingBottom:
        50,
    },

    emptyListContent: {
      flexGrow: 1,
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
      overflow:
        'hidden',
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      position:
        'relative',
    },

    cover: {
      width: '100%',
      height: '100%',
      resizeMode:
        'cover',
    },

    coverPlaceholder: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
    },

    readingBadge: {
      position:
        'absolute',
      left: 8,
      bottom: 8,
      borderRadius:
        999,
      backgroundColor:
        colors.background,
      borderWidth: 1,
      borderColor:
        colors.border,
      paddingHorizontal:
        8,
      paddingVertical:
        5,
    },

    readingBadgeText: {
      color:
        colors.softGold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 9,
      letterSpacing:
        0.25,
    },

    bookTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
      lineHeight: 19,
      marginTop: 9,
    },

    bookAuthor: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      marginTop: 3,
    },

    centered: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        30,
    },

    loadingText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      marginTop: 12,
    },

    errorTitle: {
      color:
        colors.text,
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
      lineHeight: 20,
      textAlign:
        'center',
      marginTop: 5,
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
        60,
    },

    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    emptyTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 16,
      marginTop: 14,
    },

    emptyText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      lineHeight: 19,
      textAlign:
        'center',
      marginTop: 5,
    },

    pressed: {
      opacity: 0.68,
    },
  });
}
