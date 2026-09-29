import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useRouter,
} from 'expo-router';
import type {
  ReactNode,
} from 'react';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  PanResponder,
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
import {
  getUserBook,
  saveUserBook,
  updateUserBookOwned,
} from '../lib/user-books';

const SWIPE_REMOVE_MIN_DISTANCE =
  92;

const SWIPE_REMOVE_MAX_DISTANCE =
  118;

const SWIPE_REMOVE_WIDTH_RATIO =
  0.29;

type SwipeCartRowProps = {
  onRemove: () => void;
  styles: ReturnType<
    typeof createStyles
  >;
  children: ReactNode;
};

function SwipeCartRow({
  onRemove,
  styles,
  children,
}: SwipeCartRowProps) {
  const translateX =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const [
    rowWidth,
    setRowWidth,
  ] =
    useState(1);

  const removingRef =
    useRef(false);

  const resetRow =
    useCallback(
      () => {
        Animated.timing(
          translateX,
          {
            toValue: 0,
            duration: 190,
            easing:
              Easing.bezier(
                0.22,
                1,
                0.36,
                1
              ),
            useNativeDriver:
              true,
          }
        ).start();
      },
      [
        translateX,
      ]
    );

  const completeRemove =
    useCallback(
      () => {
        if (
          removingRef.current
        ) {
          return;
        }

        removingRef.current =
          true;

        Animated.timing(
          translateX,
          {
            toValue:
              -Math.max(
                rowWidth,
                360
              ),
            duration: 205,
            easing:
              Easing.bezier(
                0.22,
                1,
                0.36,
                1
              ),
            useNativeDriver:
              true,
          }
        ).start(
          () => {
            onRemove();
          }
        );
      },
      [
        onRemove,
        rowWidth,
        translateX,
      ]
    );

  const panResponder =
    useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (
            _event,
            gesture
          ) => {
            const horizontal =
              Math.abs(
                gesture.dx
              );

            const vertical =
              Math.abs(
                gesture.dy
              );

            return (
              gesture.dx <
                -4 &&
              horizontal >=
                5 &&
              (
                horizontal >
                  vertical *
                    0.62 ||
                (
                  gesture.vx <
                    -0.2 &&
                  horizontal >
                    vertical *
                      0.5
                )
              )
            );
          },

          onMoveShouldSetPanResponderCapture: (
            _event,
            gesture
          ) => {
            const horizontal =
              Math.abs(
                gesture.dx
              );

            const vertical =
              Math.abs(
                gesture.dy
              );

            return (
              gesture.dx <
                -6 &&
              horizontal >=
                7 &&
              (
                horizontal >
                  vertical *
                    0.74 ||
                (
                  gesture.vx <
                    -0.27 &&
                  horizontal >
                    vertical *
                      0.62
                )
              )
            );
          },

          onPanResponderMove: (
            _event,
            gesture
          ) => {
            if (
              removingRef.current
            ) {
              return;
            }

            translateX.setValue(
              Math.min(
                0,
                gesture.dx
              )
            );
          },

          onPanResponderRelease: (
            _event,
            gesture
          ) => {
            if (
              removingRef.current
            ) {
              return;
            }

            const distance =
              Math.abs(
                Math.min(
                  0,
                  gesture.dx
                )
              );

            const commitDistance =
              Math.min(
                SWIPE_REMOVE_MAX_DISTANCE,
                Math.max(
                  SWIPE_REMOVE_MIN_DISTANCE,
                  rowWidth *
                    SWIPE_REMOVE_WIDTH_RATIO
                )
              );

            const shouldRemove =
              distance >=
                commitDistance ||
              (
                distance >=
                  48 &&
                gesture.vx <=
                  -0.62
              );

            if (
              shouldRemove
            ) {
              completeRemove();
              return;
            }

            resetRow();
          },

          onPanResponderTerminationRequest:
            () => false,

          onPanResponderTerminate:
            resetRow,
        }),
      [
        completeRemove,
        resetRow,
        rowWidth,
        translateX,
      ]
    );

  return (
    <View
      onLayout={(
        event
      ) =>
        setRowWidth(
          event.nativeEvent.layout.width
        )
      }
      style={
        styles.swipeRow
      }
    >
      <View
        pointerEvents="none"
        style={
          styles.removeReveal
        }
      >
        <Ionicons
          name="close"
          size={25}
          color="#FFFFFF"
        />

        <Text
          style={
            styles.removeRevealText
          }
        >
          Remove
        </Text>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.swipeForeground,
          {
            transform: [
              {
                translateX,
              },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

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

  const [
    owningId,
    setOwningId,
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

  async function markItemOwned(
    item: BookCartItem
  ) {
    if (
      owningId ||
      removingId
    ) {
      return;
    }

    try {
      setOwningId(
        item.id
      );

      const existing =
        await getUserBook(
          item.google_book_id
        );

      if (
        existing
      ) {
        await updateUserBookOwned(
          existing.google_book_id,
          true
        );
      } else {
        await saveUserBook({
          googleBookId:
            item.google_book_id,
          title:
            item.title,
          authors:
            item.authors ??
              [],
          coverUrl:
            item.cover_url,
          isbn:
            item.isbn,
          publishedDate:
            null,
          status:
            null,
          owned:
            true,
        });
      }

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
        'Could not mark Book Cart item as owned:',
        error
      );
    } finally {
      setOwningId(
        null
      );
    }
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
            <SwipeCartRow
              onRemove={() =>
                void removeItem(
                  item
                )
              }
              styles={
                styles
              }
            >
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

              <View
                style={
                  styles.cardActions
                }
              >
                <Pressable
                  onPress={(
                    event
                  ) => {
                    event.stopPropagation();

                    void markItemOwned(
                      item
                    );
                  }}
                  disabled={
                    owningId ===
                      item.id ||
                    removingId !==
                      null
                  }
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Mark as owned"
                  style={({ pressed }) => [
                    styles.ownedButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  {owningId ===
                  item.id ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        colors.gold
                      }
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={17}
                        color={
                          colors.gold
                        }
                      />
                      <Text
                        style={
                          styles.ownedButtonText
                        }
                      >
                        Own
                      </Text>
                    </>
                  )}
                </Pressable>

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
              </View>
              </Pressable>
            </SwipeCartRow>
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

    swipeRow: {
      position:
        'relative',
      overflow:
        'hidden',
      borderRadius:
        17,
      backgroundColor:
        colors.danger,
    },

    swipeForeground: {
      backgroundColor:
        colors.background,
      borderRadius:
        17,
    },

    removeReveal: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        colors.danger,
      alignItems:
        'flex-end',
      justifyContent:
        'center',
      paddingRight:
        23,
      gap:
        1,
    },

    removeRevealText: {
      width:
        48,
      color:
        '#FFFFFF',
      fontFamily:
        'Inter_700Bold',
      fontSize:
        10,
      textAlign:
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

    cardActions: {
      alignItems:
        'center',
      gap: 6,
    },

    ownedButton: {
      minWidth: 48,
      height: 36,
      paddingHorizontal: 7,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 4,
      borderRadius: 10,
      backgroundColor:
        colors.elevated,
    },

    ownedButtonText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 9,
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
