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
  isBlocked: boolean;
  canInviteToClub: boolean;
  onInviteToClub: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onReport: () => void;
  onShare: () => void;
  onDismiss: () => void;
};

export default function ReaderProfileActionsSheet({
  visible,
  isBlocked,
  canInviteToClub,
  onInviteToClub,
  onBlock,
  onUnblock,
  onReport,
  onShare,
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
        12
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
        );

      return () => {
        cancelAnimationFrame(
          frame
        );
      };
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
      12
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
        finishDismiss(
          after
        );
      } else {
        closing.current =
          false;
      }
    });
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

    translateY.stopAnimation();
    backdropOpacity.stopAnimation();

    const offscreenY =
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
            offscreenY,
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
            190,
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
      gestureClosing.current =
        false;

      if (
        !finished
      ) {
        return;
      }

      translateY.setValue(
        12
      );
      sheetOpacity.setValue(
        0
      );

      onDismiss();
    });
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
            gesture.dy >
              6 &&
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
            gesture.dy >
              10 &&
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
              gesture.dy >
                88 ||
              gesture.vy >
                0.72
            ) {
              dismissByGesture();
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

          onPanResponderTerminationRequest:
            () =>
              false,

          onPanResponderTerminate:
            () => {
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

            <Text
              style={
                styles.title
              }
            >
              Profile options
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Choose an action for this reader.
            </Text>

            <View
              style={
                styles.list
              }
            >
              {canInviteToClub &&
              !isBlocked ? (
                <Pressable
                  onPress={() =>
                    runAction(
                      onInviteToClub
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
                      name="mail-outline"
                      size={
                        18
                      }
                      color={
                        colors.gold
                      }
                    />
                  </View>

                  <Text
                    style={
                      styles.rowText
                    }
                  >
                    Invite to a club
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() =>
                  runAction(
                    isBlocked
                      ? onUnblock
                      : onBlock
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
                    name={
                      isBlocked
                        ? 'person-add-outline'
                        : 'ban-outline'
                    }
                    size={
                      18
                    }
                    color={
                      colors.gold
                    }
                  />
                </View>

                <Text
                  style={
                    styles.rowText
                  }
                >
                  {isBlocked
                    ? 'Unblock reader'
                    : 'Block reader'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  runAction(
                    onReport
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
                    name="flag-outline"
                    size={
                      18
                    }
                    color={
                      colors.gold
                    }
                  />
                </View>

                <Text
                  style={
                    styles.rowText
                  }
                >
                  Report reader
                </Text>
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
                    name="share-outline"
                    size={
                      18
                    }
                    color={
                      colors.gold
                    }
                  />
                </View>

                <Text
                  style={
                    styles.rowText
                  }
                >
                  Share profile
                </Text>
              </Pressable>
            </View>
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
    },
    backdropVisual: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        'rgba(0,0,0,0.48)',
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
        16,
      paddingTop:
        10,
      overflow:
        'hidden',
    },
    handle: {
      width:
        42,
      height:
        4,
      borderRadius:
        2,
      backgroundColor:
        colors.border,
      alignSelf:
        'center',
      marginBottom:
        13,
    },
    title: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        19,
    },
    subtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      lineHeight:
        18,
      marginTop:
        4,
      marginBottom:
        12,
    },
    list: {
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        16,
      overflow:
        'hidden',
      backgroundColor:
        colors.background,
    },
    row: {
      minHeight:
        58,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        12,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },
    rowPressed: {
      backgroundColor:
        colors.elevated,
    },
    rowIcon: {
      width:
        34,
      height:
        34,
      borderRadius:
        10,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        11,
    },
    rowText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
    },
  });
}
