import { Ionicons } from '@expo/vector-icons';
import {
  Image as ExpoImage,
} from 'expo-image';
import {
  useMemo,
  useRef,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  NovoriColors,
} from '../constants/novori-theme';
import {
  useNovoriTheme,
} from '../context/theme-context';
import {
  UserBook,
} from '../lib/user-books';

type DailyCheckinSheetProps = {
  visible: boolean;
  books: UserBook[];
  selectedBookIds: string[];
  busy?: boolean;
  editing?: boolean;
  onToggleBook: (
    googleBookId:
      string
  ) => void;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
};

export default function DailyCheckinSheet({
  visible,
  books,
  selectedBookIds,
  busy = false,
  editing = false,
  onToggleBook,
  onConfirm,
  onDismiss,
}: DailyCheckinSheetProps) {
  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const insets =
    useSafeAreaInsets();

  const translateY =
    useRef(
      new Animated.Value(
        12
      )
    ).current;

  const sheetOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const backdropOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const sheetHeight =
    useRef(
      0
    );

  const closing =
    useRef(
      false
    );

  const selected =
    useMemo(
      () =>
        new Set(
          selectedBookIds
        ),
      [
        selectedBookIds,
      ]
    );

  function finishDismiss() {
    closing.current =
      false;

    translateY.setValue(
      12
    );

    sheetOpacity.setValue(
      0
    );

    backdropOpacity.setValue(
      0
    );

    onDismiss();
  }

  function animateIn() {
    closing.current =
      false;

    translateY.stopAnimation();
    sheetOpacity.stopAnimation();
    backdropOpacity.stopAnimation();

    translateY.setValue(
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
        translateY,
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

  function closeSmoothly() {
    if (
      closing.current ||
      busy
    ) {
      return;
    }

    closing.current =
      true;

    Animated.parallel([
      Animated.timing(
        translateY,
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
    ]).start(
      ({
        finished,
      }) => {
        if (
          finished
        ) {
          finishDismiss();
        } else {
          closing.current =
            false;
        }
      }
    );
  }

  async function confirm() {
    if (
      busy ||
      closing.current ||
      selectedBookIds.length ===
        0
    ) {
      return;
    }

    await onConfirm();
  }

  const panResponder =
    useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (
            _event,
            gesture
          ) =>
            visible &&
            !busy &&
            !closing.current &&
            gesture.dy >
              6 &&
            Math.abs(
              gesture.dy
            ) >
              Math.abs(
                gesture.dx
              ),
          onPanResponderMove: (
            _event,
            gesture
          ) => {
            translateY.setValue(
              Math.max(
                0,
                gesture.dy
              )
            );
          },
          onPanResponderRelease: (
            _event,
            gesture
          ) => {
            if (
              gesture.dy >
                Math.max(
                  78,
                  sheetHeight.current *
                    0.2
                ) ||
              gesture.vy >
                1.1
            ) {
              closeSmoothly();
              return;
            }

            Animated.spring(
              translateY,
              {
                toValue:
                  0,
                useNativeDriver:
                  true,
                damping:
                  20,
                stiffness:
                  220,
                mass:
                  0.8,
              }
            ).start();
          },
        }),
      [
        busy,
        translateY,
        visible,
      ]
    );

  return (
    <Modal
      visible={
        visible
      }
      transparent
      animationType="none"
      onShow={
        animateIn
      }
      onRequestClose={
        closeSmoothly
      }
    >
      <Pressable
        style={
          styles.backdrop
        }
        onPress={
          closeSmoothly
        }
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.backdropVisual,
            {
              opacity:
                backdropOpacity,
            },
          ]}
        />

        <Animated.View
          {...panResponder.panHandlers}
          onLayout={(
            event
          ) => {
            sheetHeight.current =
              event.nativeEvent.layout.height;
          }}
          style={[
            styles.sheet,
            {
              paddingBottom:
                Math.max(
                  22,
                  insets.bottom +
                    12
                ),
              opacity:
                sheetOpacity,
              transform: [
                {
                  translateY,
                },
              ],
            },
          ]}
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
                styles.handle
              }
            />

            <View
              style={
                styles.iconWrap
              }
            >
              <Ionicons
                name={
                  books.length >
                    0
                    ? 'book-outline'
                    : 'alert-circle-outline'
                }
                size={23}
                color={
                  colors.gold
                }
              />
            </View>

            <Text
              style={
                styles.title
              }
            >
              {books.length >
                0
                ? editing
                  ? 'Edit today’s books'
                  : 'What did you read today?'
                : 'Start a book first'}
            </Text>

            <Text
              style={
                styles.message
              }
            >
              {books.length >
                0
                ? editing
                  ? 'Update the books attached to today’s check-in. Your streak stays exactly the same.'
                  : 'Select every book you read today. It still counts as one daily check-in.'
                : 'Add a book to your Library and mark it as Reading before checking in.'}
            </Text>

            {books.length >
            0 ? (
            <ScrollView
              style={
                styles.bookScroll
              }
              contentContainerStyle={
                styles.bookList
              }
              showsVerticalScrollIndicator={
                false
              }
            >
              {books.map(
                (
                  book
                ) => {
                  const isSelected =
                    selected.has(
                      book.google_book_id
                    );

                  return (
                    <Pressable
                      key={
                        book.id
                      }
                      disabled={
                        busy
                      }
                      onPress={() =>
                        onToggleBook(
                          book.google_book_id
                        )
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.bookRow,
                        isSelected &&
                          styles.bookRowSelected,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      {book.cover_url ? (
                        <ExpoImage
                          source={
                            book.cover_url
                          }
                          style={
                            styles.cover
                          }
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={0}
                          recyclingKey={
                            book.cover_url
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
                            size={17}
                            color={
                              colors.gold
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
                          {
                            book.title
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
                          {book.authors?.join(
                            ', '
                          ) ||
                            'Unknown author'}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.selectCircle,
                          isSelected &&
                            styles.selectCircleSelected,
                        ]}
                      >
                        {isSelected ? (
                          <Ionicons
                            name="checkmark"
                            size={15}
                            color={
                              colors.background
                            }
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                }
              )}
            </ScrollView>
            ) : null}

            {books.length >
            0 ? (
            <View
              style={
                styles.actions
              }
            >
              <Pressable
                disabled={
                  busy
                }
                onPress={
                  closeSmoothly
                }
                style={({
                  pressed,
                }) => [
                  styles.cancelButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.cancelText
                  }
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                disabled={
                  busy ||
                  selectedBookIds.length ===
                    0
                }
                onPress={() =>
                  void confirm()
                }
                style={({
                  pressed,
                }) => [
                  styles.confirmButton,
                  (
                    pressed ||
                    busy ||
                    selectedBookIds.length ===
                      0
                  ) &&
                    styles.disabled,
                ]}
              >
                {busy ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.background
                    }
                  />
                ) : (
                  <>
                    <Ionicons
                      name={
                        editing
                          ? 'save-outline'
                          : 'checkmark-circle-outline'
                      }
                      size={17}
                      color={
                        colors.background
                      }
                    />

                    <Text
                      style={
                        styles.confirmText
                      }
                    >
                      {editing
                        ? 'Save changes'
                        : 'Check in'}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
            ) : (
              <Pressable
                onPress={
                  closeSmoothly
                }
                style={({
                  pressed,
                }) => [
                  styles.singleCloseButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.singleCloseText
                  }
                >
                  Got it
                </Text>
              </Pressable>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function createStyles(
  colors:
    NovoriColors
) {
  return StyleSheet.create({
    backdrop: {
      flex:
        1,
      justifyContent:
        'flex-end',
      backgroundColor:
        'transparent',
    },
    backdropVisual: {
      backgroundColor:
        'rgba(0, 0, 0, 0.52)',
    },
    sheet: {
      width:
        '100%',
      backgroundColor:
        colors.surface,
      borderTopLeftRadius:
        24,
      borderTopRightRadius:
        24,
      paddingHorizontal:
        18,
      paddingTop:
        9,
    },
    handle: {
      width:
        38,
      height:
        4,
      borderRadius:
        2,
      backgroundColor:
        colors.border,
      alignSelf:
        'center',
      marginBottom:
        15,
    },
    iconWrap: {
      width:
        48,
      height:
        48,
      borderRadius:
        24,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      alignSelf:
        'center',
      marginBottom:
        12,
    },
    title: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        21,
      textAlign:
        'center',
    },
    message: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12.5,
      lineHeight:
        18,
      textAlign:
        'center',
      marginTop:
        6,
      marginBottom:
        14,
    },
    bookScroll: {
      maxHeight:
        330,
    },
    bookList: {
      gap:
        9,
      paddingBottom:
        4,
    },
    bookRow: {
      minHeight:
        70,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        14,
      backgroundColor:
        colors.background,
      padding:
        9,
    },
    bookRowSelected: {
      borderColor:
        colors.gold,
      backgroundColor:
        colors.elevated,
    },
    cover: {
      width:
        34,
      height:
        50,
      borderRadius:
        5,
      backgroundColor:
        colors.elevated,
    },
    coverPlaceholder: {
      width:
        34,
      height:
        50,
      borderRadius:
        5,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    bookCopy: {
      flex:
        1,
      marginLeft:
        10,
      marginRight:
        10,
    },
    bookTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
      lineHeight:
        17,
    },
    bookAuthor: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      marginTop:
        3,
    },
    selectCircle: {
      width:
        24,
      height:
        24,
      borderRadius:
        12,
      borderWidth:
        1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    selectCircleSelected: {
      backgroundColor:
        colors.gold,
      borderColor:
        colors.gold,
    },
    actions: {
      flexDirection:
        'row',
      gap:
        10,
      marginTop:
        16,
    },
    cancelButton: {
      flex:
        1,
      minHeight:
        46,
      borderRadius:
        14,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.background,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    cancelText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
    },
    confirmButton: {
      flex:
        1,
      minHeight:
        46,
      borderRadius:
        14,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
      flexDirection:
        'row',
      gap:
        7,
    },
    confirmText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        12.5,
    },
    singleCloseButton: {
      minHeight:
        46,
      borderRadius:
        14,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop:
        2,
    },
    singleCloseText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        12.5,
    },
    pressed: {
      opacity:
        0.8,
    },
    disabled: {
      opacity:
        0.48,
    },
  });
}
