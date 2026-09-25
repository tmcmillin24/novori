import { Ionicons } from '@expo/vector-icons';
import {
    useEffect,
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

type Props = {
  visible: boolean;
  readerName: string;
  mode?: 'block' | 'unblock';
  message?: string;
  busy?: boolean;
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
};

export default function BlockReaderConfirmSheet({
  visible,
  readerName,
  mode = 'block',
  message,
  busy = false,
  onConfirm,
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

  function resetAndDismiss() {
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
  }

  function closeSmoothly() {
    if (
      busy ||
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
        resetAndDismiss();
      } else {
        closing.current =
          false;
      }
    });
  }

  function dismissByGesture() {
    if (
      busy ||
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
            !busy &&
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
            !busy &&
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
        busy,
        translateY,
        visible,
      ]
    );

  async function confirm() {
    if (
      busy ||
      closing.current ||
      gestureClosing.current
    ) {
      return;
    }

    try {
      await onConfirm();

      closeSmoothly();
    } catch {
      // Parent owns its error presentation.
    }
  }

  const isUnblock =
    mode ===
    'unblock';

  const title =
    isUnblock
      ? `Unblock ${readerName}?`
      : `Block ${readerName}?`;

  const body =
    message ??
    (
      isUnblock
        ? 'They will be able to interact with you again. Previous follow relationships will not be restored automatically.'
        : 'Their posts and comments will be hidden from you, and any follow relationship between you will be removed. You can unblock them later in Settings.'
    );

  return (
    <Modal
      visible={
        visible
      }
      transparent
      animationType="none"
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
                styles.icon
              }
            >
              <Ionicons
                name={
                  isUnblock
                    ? 'person-add-outline'
                    : 'ban-outline'
                }
                size={
                  24
                }
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
              {title}
            </Text>

            <Text
              style={
                styles.message
              }
            >
              {body}
            </Text>

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
                style={({ pressed }) => [
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
                  void confirm()
                }
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed &&
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
                      styles.primaryText
                    }
                  >
                    {isUnblock
                      ? 'Unblock'
                      : 'Block'}
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
        18,
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
    icon: {
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
      marginTop:
        6,
      marginBottom:
        14,
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
        19,
      textAlign:
        'center',
      marginTop:
        7,
    },
    actions: {
      flexDirection:
        'row',
      gap:
        10,
      marginTop:
        20,
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
    primaryButton: {
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
        colors.elevated,
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
    primaryText: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        12.5,
    },
    pressed: {
      opacity:
        0.78,
    },
  });
}
