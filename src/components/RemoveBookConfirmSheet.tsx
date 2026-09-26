import { Ionicons } from '@expo/vector-icons';
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

type RemoveBookConfirmSheetProps = {
  visible: boolean;
  bookTitle: string;
  hasReadingDetails: boolean;
  busy?: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
};

export default function RemoveBookConfirmSheet({
  visible,
  bookTitle,
  hasReadingDetails,
  busy = false,
  onConfirm,
  onDismiss,
}: RemoveBookConfirmSheetProps) {
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

    translateY.stopAnimation();
    sheetOpacity.stopAnimation();
    backdropOpacity.stopAnimation();

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
    ]).start(({
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
    });
  }

  async function confirmRemove() {
    if (
      busy ||
      closing.current
    ) {
      return;
    }

    try {
      await onConfirm();

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
      ]).start(({
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
      });
    } catch {
      // Parent owns user-facing error handling.
    }
  }

  const panResponder =
    useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (
            _event,
            gesture
          ) => {
            const mostlyVertical =
              Math.abs(
                gesture.dy
              ) >
              Math.abs(
                gesture.dx
              );

            return (
              visible &&
              !busy &&
              !closing.current &&
              gesture.dy >
                6 &&
              mostlyVertical
            );
          },

          onPanResponderMove: (
            _event,
            gesture
          ) => {
            if (
              busy ||
              gesture.dy <
                0
            ) {
              return;
            }

            const nextY =
              Math.max(
                0,
                gesture.dy
              );

            translateY.setValue(
              nextY
            );

            backdropOpacity.setValue(
              Math.max(
                0.18,
                1 -
                  nextY /
                    520
              )
            );
          },

          onPanResponderRelease: (
            _event,
            gesture
          ) => {
            if (busy) {
              return;
            }

            const shouldDismiss =
              gesture.dy >
                88 ||
              gesture.vy >
                0.72;

            if (
              shouldDismiss
            ) {
              closing.current =
                true;

              const targetY =
                Math.max(
                  sheetHeight.current +
                    32,
                  420
                );

              Animated.parallel([
                Animated.timing(
                  translateY,
                  {
                    toValue:
                      targetY,
                    duration:
                      190,
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
                      0,
                    duration:
                      120,
                    easing:
                      Easing.out(
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
                  finished
                ) {
                  finishDismiss();
                } else {
                  closing.current =
                    false;
                }
              });

              return;
            }

            Animated.parallel([
              Animated.spring(
                translateY,
                {
                  toValue:
                    0,
                  damping:
                    24,
                  stiffness:
                    220,
                  mass:
                    0.9,
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
                    120,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver:
                    true,
                }
              ),
            ]).start();
          },

          onPanResponderTerminate: () => {
            if (busy) {
              return;
            }

            Animated.parallel([
              Animated.spring(
                translateY,
                {
                  toValue:
                    0,
                  damping:
                    24,
                  stiffness:
                    220,
                  mass:
                    0.9,
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
                    120,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver:
                    true,
                }
              ),
            ]).start();
          },
        }),
      [
        backdropOpacity,
        busy,
        translateY,
        visible,
      ]
    );

  const message =
    hasReadingDetails
      ? `Removing ${bookTitle} permanently deletes its private Reading Details, including your summary, notes, and checkpoints. Its saved rating and review will also be removed.`
      : `Removing ${bookTitle} removes it from your Library along with its saved rating and review.`;

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
          onLayout={(event) => {
            sheetHeight.current =
              event.nativeEvent.layout.height;
          }}
          style={[
            styles.sheet,
            {
              paddingBottom:
                Math.max(
                  18,
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
            onPress={(event) =>
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
                name="trash-outline"
                size={24}
                color={
                  colors.danger
                }
              />
            </View>

            <Text
              style={
                styles.title
              }
            >
              Remove from Library?
            </Text>

            <Text
              style={
                styles.bookTitle
              }
              numberOfLines={
                2
              }
            >
              {bookTitle}
            </Text>

            <Text
              style={
                styles.message
              }
            >
              {message}
            </Text>

            {hasReadingDetails ? (
              <View
                style={
                  styles.warningCard
                }
              >
                <Text
                  style={
                    styles.warningTitle
                  }
                >
                  This cannot be undone
                </Text>

                <Text
                  style={
                    styles.warningText
                  }
                >
                  Your private reading record will not return if you add the book again later.
                </Text>
              </View>
            ) : null}

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
                  busy
                }
                onPress={() =>
                  void confirmRemove()
                }
                style={({
                  pressed,
                }) => [
                  styles.removeButton,
                  (
                    pressed ||
                    busy
                  ) &&
                    styles.pressed,
                ]}
              >
                {busy ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.text
                    }
                  />
                ) : (
                  <Text
                    style={
                      styles.removeText
                    }
                  >
                    Remove
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function createStyles(
  colors: NovoriColors
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
      maxWidth:
        720,
      alignSelf:
        'center',
      backgroundColor:
        colors.surface,
      borderTopLeftRadius:
        24,
      borderTopRightRadius:
        24,
      overflow:
        'hidden',
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
        18,
    },
    iconWrap: {
      width:
        46,
      height:
        46,
      borderRadius:
        15,
      alignItems:
        'center',
      justifyContent:
        'center',
      alignSelf:
        'center',
      backgroundColor:
        colors.elevated,
      marginBottom:
        13,
    },
    title: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        18,
      textAlign:
        'center',
    },
    bookTitle: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
      lineHeight:
        18,
      textAlign:
        'center',
      marginTop:
        6,
    },
    message: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13,
      lineHeight:
        20,
      textAlign:
        'center',
      marginTop:
        12,
    },
    warningCard: {
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        13,
      paddingHorizontal:
        13,
      paddingVertical:
        11,
      marginTop:
        14,
    },
    warningTitle: {
      color:
        colors.danger,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11.5,
    },
    warningText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
      lineHeight:
        16,
      marginTop:
        3,
    },
    actions: {
      flexDirection:
        'row',
      gap:
        10,
      marginTop:
        18,
    },
    cancelButton: {
      flex:
        1,
      minHeight:
        46,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderRadius:
        13,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.elevated,
    },
    cancelText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
    },
    removeButton: {
      flex:
        1,
      minHeight:
        46,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderRadius:
        13,
      backgroundColor:
        colors.danger,
    },
    removeText: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        13,
    },
    pressed: {
      opacity:
        0.68,
    },
  });
}
