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
  BookCartItem,
  getBookCart,
  removeBookFromCart,
} from '../lib/book-cart';

export default function BookCartScreen() {
  const router =
    useRouter();

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const [
    items,
    setItems,
  ] =
    useState<
      BookCartItem[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    removingId,
    setRemovingId,
  ] =
    useState<
      string | null
    >(null);

  useFocusEffect(
    useCallback(
      () => {
        let active =
          true;

        void getBookCart()
          .then(
            (
              cartItems
            ) => {
              if (
                active
              ) {
                setItems(
                  cartItems
                );
              }
            }
          )
          .catch(
            (
              error
            ) => {
              console.error(
                'Could not load Book Cart:',
                error
              );

              if (
                active
              ) {
                setItems(
                  []
                );
              }
            }
          )
          .finally(
            () => {
              if (
                active
              ) {
                setLoading(
                  false
                );
              }
            }
          );

        return () => {
          active =
            false;
        };
      },
      []
    )
  );

  function openBook(
    item: BookCartItem
  ) {
    router.push({
      pathname:
        '/book/[id]',
      params: {
        id:
          item.google_book_id,
        source:
          'cart',
      },
    });
  }

  async function removeItem(
    item: BookCartItem
  ) {
    if (
      removingId
    ) {
      return;
    }

    try {
      setRemovingId(
        item.id
      );

      await removeBookFromCart(
        item.google_book_id
      );

      setItems(
        (
          current
        ) =>
          current.filter(
            (
              cartItem
            ) =>
              cartItem.id !==
              item.id
          )
      );
    } catch (
      error
    ) {
      console.error(
        'Could not remove Book Cart item:',
        error
      );
    } finally {
      setRemovingId(
        null
      );
    }
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
          styles.header
        }
      >
        <Pressable
          onPress={() => {
            if (
              router.canGoBack()
            ) {
              router.back();
            } else {
              router.replace(
                '/(tabs)/library'
              );
            }
          }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.backButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={
              colors.text
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
            LIBRARY
          </Text>

          <Text
            style={
              styles.title
            }
          >
            Book Cart
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Books you want to buy later.
          </Text>
        </View>

        <View
          style={
            styles.countBadge
          }
        >
          <Ionicons
            name="cart-outline"
            size={15}
            color={
              colors.gold
            }
          />

          <Text
            style={
              styles.countText
            }
          >
            {
              items.length
            }
          </Text>
        </View>
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
            Loading your cart...
          </Text>
        </View>
      ) : (
        <FlatList
          data={
            items
          }
          keyExtractor={(
            item
          ) =>
            item.id
          }
          contentContainerStyle={
            [
              styles.listContent,
              items.length ===
                0 &&
                styles.emptyList,
            ]
          }
          renderItem={({
            item,
          }) => (
            <Pressable
              onPress={() =>
                openBook(
                  item
                )
              }
              style={({ pressed }) => [
                styles.card,
                pressed &&
                  styles.pressed,
              ]}
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
                    size={26}
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
                  numberOfLines={2}
                >
                  {
                    item.title
                  }
                </Text>

                <Text
                  style={
                    styles.bookAuthor
                  }
                  numberOfLines={1}
                >
                  {item.authors.join(
                    ', '
                  ) ||
                    'Unknown author'}
                </Text>

                <Text
                  style={
                    styles.viewText
                  }
                >
                  View book →
                </Text>
              </View>

              <Pressable
                onPress={(
                  event
                ) => {
                  event.stopPropagation();

                  void removeItem(
                    item
                  );
                }}
                disabled={
                  removingId ===
                  item.id
                }
                hitSlop={8}
                style={({ pressed }) => [
                  styles.removeButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                {removingId ===
                item.id ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.gold
                    }
                  />
                ) : (
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={
                      colors.mutedText
                    }
                  />
                )}
              </Pressable>
            </Pressable>
          )}
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
                  name="cart-outline"
                  size={31}
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
                Your Book Cart is empty
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Add books from a book page when you find something you want to buy.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={
            false
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

    header: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 18,
    },

    backButton: {
      width: 36,
      height: 36,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 5,
    },

    headerCopy: {
      flex: 1,
    },

    eyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 9,
      letterSpacing: 1.4,
    },

    title: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 31,
      marginTop: 3,
    },

    subtitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      marginTop: 4,
    },

    countBadge: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 5,
      minHeight: 34,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      marginTop: 5,
    },

    countText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12,
    },

    centered: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    loadingText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      marginTop: 12,
    },

    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 36,
      gap: 12,
    },

    emptyList: {
      flexGrow: 1,
      justifyContent:
        'center',
    },

    card: {
      flexDirection:
        'row',
      alignItems:
        'center',
      minHeight: 118,
      padding: 12,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 17,
      gap: 13,
    },

    cover: {
      width: 66,
      height: 98,
      borderRadius: 8,
      backgroundColor:
        colors.elevated,
    },

    coverPlaceholder: {
      width: 66,
      height: 98,
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
    },

    bookTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      fontSize: 17,
      lineHeight: 21,
    },

    bookAuthor: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      marginTop: 5,
    },

    viewText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
      marginTop: 10,
    },

    removeButton: {
      width: 36,
      height: 36,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderRadius: 10,
    },

    emptyState: {
      alignItems:
        'center',
      paddingHorizontal: 34,
    },

    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
    },

    emptyTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      fontSize: 20,
      marginTop: 16,
      textAlign:
        'center',
    },

    emptyText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      lineHeight: 19,
      marginTop: 7,
      textAlign:
        'center',
    },

    pressed: {
      opacity: 0.72,
    },
  });
}
