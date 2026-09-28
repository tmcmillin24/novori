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
                styles.headingRow
              }
            >
              <View
                style={
                  styles.headingIcon
                }
              >
                <Ionicons
                  name="albums-outline"
                  size={20}
                  color={
                    colors.gold
                  }
                />
              </View>

              <View
                style={
                  styles.headingCopy
                }
              >
                <Text
                  style={
                    styles.title
                  }
                >
                  Book Stack
                </Text>

                <Text
                  style={
                    styles.subtitle
                  }
                  numberOfLines={1}
                >
                  {stackName?.trim() ||
                    'Manage this stack'}
                </Text>
              </View>
            </View>

            <View
              style={
                styles.list
              }
            >
              <Pressable
                onPress={() =>
                  runAction(
                    onEdit
                  )
                }
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed &&
                    styles.actionRowPressed,
                ]}
              >
                <View
                  style={
                    styles.actionIcon
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
                    styles.actionCopy
                  }
                >
                  <Text
                    style={
                      styles.actionTitle
                    }
                  >
                    Edit Stack
                  </Text>
                  <Text
                    style={
                      styles.actionSubtitle
                    }
                  >
                    Change the name, books, or order.
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
                  styles.separator
                }
              />

              <Pressable
                onPress={() =>
                  runAction(
                    onShare
                  )
                }
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed &&
                    styles.actionRowPressed,
                ]}
              >
                <View
                  style={
                    styles.actionIcon
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
                    styles.actionCopy
                  }
                >
                  <Text
                    style={
                      styles.actionTitle
                    }
                  >
                    Share Stack
                  </Text>
                  <Text
                    style={
                      styles.actionSubtitle
                    }
                  >
                    Send this stack through Novori or another app.
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
                  styles.separator
                }
              />

              <Pressable
                onPress={() =>
                  runAction(
                    onDelete
                  )
                }
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed &&
                    styles.actionRowPressed,
                ]}
              >
                <View
                  style={[
                    styles.actionIcon,
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
                    styles.actionCopy
                  }
                >
                  <Text
                    style={
                      styles.dangerTitle
                    }
                  >
                    Delete Stack
                  </Text>
                  <Text
                    style={
                      styles.actionSubtitle
                    }
                  >
                    Permanently remove it from your profile.
                  </Text>
                </View>
              </Pressable>
            </View>

            <Pressable
              onPress={() =>
                closeSmoothly()
              }
              style={({ pressed }) => [
                styles.cancelButton,
                pressed &&
                  styles.cancelButtonPressed,
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
      backgroundColor:
        colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 18,
      paddingTop: 10,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
    },

    handle: {
      width: 42,
      height: 4,
      borderRadius: 999,
      backgroundColor:
        colors.border,
      alignSelf:
        'center',
      marginBottom: 18,
    },

    headingRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom: 18,
    },

    headingIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
      marginRight: 12,
    },

    headingCopy: {
      flex: 1,
      minWidth: 0,
    },

    title: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 21,
    },

    subtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      marginTop: 3,
    },

    list: {
      borderRadius: 18,
      overflow:
        'hidden',
      backgroundColor:
        colors.elevated,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
    },

    actionRow: {
      minHeight: 68,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },

    actionRowPressed: {
      opacity: 0.72,
    },

    actionIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.surface,
      marginRight: 12,
    },

    dangerIcon: {
      backgroundColor:
        colors.surface,
    },

    actionCopy: {
      flex: 1,
      minWidth: 0,
      marginRight: 10,
    },

    actionTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
    },

    dangerTitle: {
      color:
        colors.danger,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
    },

    actionSubtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      lineHeight: 15,
      marginTop: 3,
    },

    separator: {
      height:
        StyleSheet.hairlineWidth,
      backgroundColor:
        colors.border,
      marginLeft: 64,
    },

    cancelButton: {
      minHeight: 48,
      borderRadius: 14,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 12,
      backgroundColor:
        colors.elevated,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
    },

    cancelButtonPressed: {
      opacity: 0.72,
    },

    cancelText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 13,
    },
  });
}
