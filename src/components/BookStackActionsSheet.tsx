import { Ionicons } from '@expo/vector-icons';
import {
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
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

type Props = {
  visible: boolean;
  stackName?: string | null;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
  onDismiss: () => void;
};

export default function BookStackActionsSheet({
  visible,
  stackName,
  onEdit,
  onShare,
  onDelete,
  onDismiss,
}: Props) {
  const {
    colors,
  } =
    useNovoriTheme();

  const insets =
    useSafeAreaInsets();

  const styles =
    createStyles(
      colors
    );

  const translateY =
    useRef(
      new Animated.Value(
        14
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
    useRef(0);

  const closing =
    useRef(false);

  const gestureClosing =
    useRef(false);

  useEffect(
    () => {
      if (
        !visible
      ) {
        return;
      }

      closing.current =
        false;
      gestureClosing.current =
        false;

      translateY.stopAnimation();
      sheetOpacity.stopAnimation();
      backdropOpacity.stopAnimation();

      translateY.setValue(
        14
      );
      sheetOpacity.setValue(
        0
      );
      backdropOpacity.setValue(
        0
      );

      const frame =
        requestAnimationFrame(
          () => {
            Animated.parallel([
              Animated.timing(
                translateY,
                {
                  toValue: 0,
                  duration: 145,
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
                  toValue: 1,
                  duration: 115,
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
                  toValue: 1,
                  duration: 130,
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
        );

      return () =>
        cancelAnimationFrame(
          frame
        );
    },
    [
      backdropOpacity,
      sheetOpacity,
      translateY,
      visible,
    ]
  );

  function finishDismiss(
    after?: () => void
  ) {
    translateY.setValue(
      14
    );
    sheetOpacity.setValue(
      0
    );
    backdropOpacity.setValue(
      0
    );

    closing.current =
      false;
    gestureClosing.current =
      false;

    onDismiss();
    after?.();
  }

  function closeSmoothly(
    after?: () => void
  ) {
    if (
      closing.current ||
      gestureClosing.current
    ) {
      return;
    }

    closing.current =
      true;

    Animated.parallel([
      Animated.timing(
        translateY,
        {
          toValue: 14,
          duration: 120,
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
          toValue: 0,
          duration: 105,
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
          toValue: 0,
          duration: 125,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(
      ({ finished }) => {
        if (
          finished
        ) {
          finishDismiss(
            after
          );
        } else {
          closing.current =
            false;
        }
      }
    );
  }

  function dismissByGesture() {
    if (
      closing.current ||
      gestureClosing.current
    ) {
      return;
    }

    gestureClosing.current =
      true;

    const offscreenY =
      Math.max(
        sheetHeight.current +
          36,
        420
      );

    Animated.parallel([
      Animated.timing(
        translateY,
        {
          toValue:
            offscreenY,
          duration: 190,
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
          toValue: 0,
          duration: 190,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(
      ({ finished }) => {
        gestureClosing.current =
          false;

        if (
          !finished
        ) {
          return;
        }

        finishDismiss();
      }
    );
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
            !closing.current &&
            !gestureClosing.current &&
            gesture.dy > 6 &&
            Math.abs(
              gesture.dy
            ) >
              Math.abs(
                gesture.dx
              ) *
                1.05,

          onMoveShouldSetPanResponderCapture: (
            _event,
            gesture
          ) =>
            visible &&
            !closing.current &&
            !gestureClosing.current &&
            gesture.dy > 10 &&
            Math.abs(
              gesture.dy
            ) >
              Math.abs(
                gesture.dx
              ) *
                1.12,

          onPanResponderMove: (
            _event,
            gesture
          ) => {
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
            if (
              gesture.dy > 88 ||
              gesture.vy > 0.72
            ) {
              dismissByGesture();
              return;
            }

            Animated.parallel([
              Animated.spring(
                translateY,
                {
                  toValue: 0,
                  damping: 24,
                  stiffness: 220,
                  mass: 0.9,
                  useNativeDriver:
                    true,
                }
              ),
              Animated.timing(
                backdropOpacity,
                {
                  toValue: 1,
                  duration: 120,
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

          onPanResponderTerminate:
            () => {
              Animated.parallel([
                Animated.spring(
                  translateY,
                  {
                    toValue: 0,
                    damping: 24,
                    stiffness: 220,
                    mass: 0.9,
                    useNativeDriver:
                      true,
                  }
                ),
                Animated.timing(
                  backdropOpacity,
                  {
                    toValue: 1,
                    duration: 120,
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
        translateY,
        visible,
      ]
    );

  function runAction(
    action: () => void
  ) {
    closeSmoothly(
      action
    );
  }

  return (
    <Modal
      visible={
        visible
      }
      transparent
      animationType="none"
      onRequestClose={() =>
        closeSmoothly()
      }
    >
      <Pressable
        style={
          styles.backdrop
        }
        onPress={() =>
          closeSmoothly()
        }
      >
        <Animated.View
          pointerEvents="none"
          style={[
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
                  20,
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
                styles.header
              }
            >
              <View
                style={
                  styles.headerText
                }
              >
                <Text
                  style={
                    styles.title
                  }
                  numberOfLines={2}
                >
                  {stackName?.trim() ||
                    'Book Stack'}
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  closeSmoothly()
                }
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed &&
                    styles.rowPressed,
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

            <View
              style={
                styles.actions
              }
            >
              <Pressable
                onPress={() =>
                  runAction(
                    onEdit
                  )
                }
                style={({ pressed }) => [
                  styles.row,
                  pressed &&
                    styles.rowPressed,
                ]}
              >
                <View
                  style={
                    styles.rowIcon
                  }
                >
                  <Ionicons
                    name="create-outline"
                    size={20}
                    color={
                      colors.gold
                    }
                  />
                </View>

                <View
                  style={
                    styles.rowText
                  }
                >
                  <Text
                    style={
                      styles.rowTitle
                    }
                  >
                    Edit Stack
                  </Text>

                  <Text
                    style={
                      styles.rowSubtitle
                    }
                  >
                    Change the name, books, or order
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
                  runAction(
                    onShare
                  )
                }
                style={({ pressed }) => [
                  styles.row,
                  pressed &&
                    styles.rowPressed,
                ]}
              >
                <View
                  style={
                    styles.rowIcon
                  }
                >
                  <Ionicons
                    name="share-social-outline"
                    size={20}
                    color={
                      colors.gold
                    }
                  />
                </View>

                <View
                  style={
                    styles.rowText
                  }
                >
                  <Text
                    style={
                      styles.rowTitle
                    }
                  >
                    Share Stack
                  </Text>

                  <Text
                    style={
                      styles.rowSubtitle
                    }
                  >
                    Share this Book Stack with others
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
                  styles.divider
                }
              />

              <Pressable
                onPress={() =>
                  runAction(
                    onDelete
                  )
                }
                style={({ pressed }) => [
                  styles.row,
                  pressed &&
                    styles.rowPressed,
                ]}
              >
                <View
                  style={[
                    styles.rowIcon,
                    styles.dangerIcon,
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
                    styles.rowText
                  }
                >
                  <Text
                    style={
                      styles.dangerText
                    }
                  >
                    Delete Stack
                  </Text>

                  <Text
                    style={
                      styles.rowSubtitle
                    }
                  >
                    Permanently remove this Book Stack
                  </Text>
                </View>
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
      flex: 1,
      justifyContent:
        'flex-end',
    },

    backdropVisual: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor:
        'rgba(0, 0, 0, 0.52)',
    },

    sheet: {
      width: '100%',
      alignSelf: 'center',
      backgroundColor:
        colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
      paddingHorizontal: 18,
      paddingTop: 9,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
    },

    handle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor:
        colors.border,
      alignSelf: 'center',
      marginBottom: 15,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingBottom: 15,
    },

    headerText: {
      flex: 1,
      marginRight: 10,
      paddingVertical: 6,
    },

    title: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 15,
      lineHeight: 20,
    },

    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },

    actions: {
      borderTopWidth: 1,
      borderTopColor:
        colors.border,
      paddingTop: 7,
    },

    row: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },

    rowPressed: {
      backgroundColor:
        colors.elevated,
    },

    rowIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.elevated,
      marginRight: 11,
    },

    dangerIcon: {
      backgroundColor:
        colors.background,
    },

    rowText: {
      flex: 1,
      marginRight: 8,
    },

    rowTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
    },

    rowSubtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      lineHeight: 16,
      marginTop: 3,
    },

    divider: {
      height: 1,
      backgroundColor:
        colors.border,
      marginVertical: 5,
    },

    dangerText: {
      color:
        colors.danger,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
    },
  });
}
