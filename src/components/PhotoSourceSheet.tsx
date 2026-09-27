import { Ionicons } from '@expo/vector-icons';
import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    Animated,
    ColorValue,
    Easing,
    Modal,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import {
    SafeAreaView,
    useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
    NovoriColors,
} from '../constants/novori-theme';

type PhotoSourceColors = {
  [Key in keyof NovoriColors]: ColorValue;
};

type PhotoSourceSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  colors: PhotoSourceColors;
  onClose: () => void;
  onTakePhoto: () => void | Promise<void>;
  onChooseLibrary: () => void | Promise<void>;
};

export default function PhotoSourceSheet({
  visible,
  title,
  subtitle = 'Choose where your photo comes from.',
  colors,
  onClose,
  onTakePhoto,
  onChooseLibrary,
}: PhotoSourceSheetProps) {
  const insets =
    useSafeAreaInsets();

  const styles =
    useMemo(
      () =>
        createStyles(
          colors
        ),
      [
        colors,
      ]
    );

  const [
    mounted,
    setMounted,
  ] =
    useState(
      visible
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
    useRef(
      0
    );

  const closing =
    useRef(
      false
    );

  const gestureClosing =
    useRef(
      false
    );

  const animateIn =
    useMemo(
      () => () => {
        closing.current =
          false;
        gestureClosing.current =
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
      },
      [
        backdropOpacity,
        sheetOpacity,
        translateY,
      ]
    );

  useEffect(
    () => {
      if (
        visible
      ) {
        setMounted(
          true
        );
        return;
      }

      if (
        mounted &&
        !closing.current &&
        !gestureClosing.current
      ) {
        setMounted(
          false
        );
      }
    },
    [
      mounted,
      visible,
    ]
  );

  useEffect(
    () => {
      if (
        mounted &&
        visible
      ) {
        animateIn();
      }
    },
    [
      animateIn,
      mounted,
      visible,
    ]
  );

  function finishClose() {
    closing.current =
      false;
    gestureClosing.current =
      false;
    setMounted(
      false
    );
    onClose();
  }

  function closeSmoothly(
    afterClose?: () => void
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
    ]).start(
      ({
        finished,
      }) => {
        if (
          finished
        ) {
          finishClose();

          if (
            afterClose
          ) {
            requestAnimationFrame(
              afterClose
            );
          }
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
      Animated.timing(
        sheetOpacity,
        {
          toValue:
            0,
          duration:
            150,
          easing:
            Easing.out(
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
          finishClose();
        } else {
          gestureClosing.current =
            false;
        }
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
    action: () =>
      void |
      Promise<void>
  ) {
    closeSmoothly(
      () => {
        void action();
      }
    );
  }

  if (
    !mounted
  ) {
    return null;
  }

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={() =>
        closeSmoothly()
      }
    >
      <SafeAreaView
        style={
          styles.modalRoot
        }
        edges={[
          'top',
          'left',
          'right',
        ]}
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

              <Text
                style={
                  styles.title
                }
              >
                {title}
              </Text>

              <Text
                style={
                  styles.subtitle
                }
              >
                {subtitle}
              </Text>

              <View
                style={
                  styles.actions
                }
              >
                <Pressable
                  onPress={() =>
                    runAction(
                      onTakePhoto
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.actionRow,
                    pressed &&
                      styles.actionPressed,
                  ]}
                >
                  <View
                    style={
                      styles.iconWrap
                    }
                  >
                    <Ionicons
                      name="camera-outline"
                      size={
                        21
                      }
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
                      Take Photo
                    </Text>

                    <Text
                      style={
                        styles.actionText
                      }
                    >
                      Use your camera to take a new photo.
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={
                      18
                    }
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
                      onChooseLibrary
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.actionRow,
                    pressed &&
                      styles.actionPressed,
                  ]}
                >
                  <View
                    style={
                      styles.iconWrap
                    }
                  >
                    <Ionicons
                      name="images-outline"
                      size={
                        21
                      }
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
                      Choose from Library
                    </Text>

                    <Text
                      style={
                        styles.actionText
                      }
                    >
                      Pick a photo with the system photo picker.
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={
                      18
                    }
                    color={
                      colors.mutedText
                    }
                  />
                </Pressable>
              </View>

              <Pressable
                onPress={() =>
                  closeSmoothly()
                }
                style={({
                  pressed,
                }) => [
                  styles.cancelButton,
                  pressed &&
                    styles.actionPressed,
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
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(
  colors: PhotoSourceColors
) {
  return StyleSheet.create({
    modalRoot: {
      flex:
        1,
    },

    backdrop: {
      flex:
        1,
      justifyContent:
        'flex-end',
    },

    backdropVisual: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        'rgba(0,0,0,0.58)',
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
      borderWidth:
        1,
      borderBottomWidth:
        0,
      borderColor:
        colors.border,
      paddingHorizontal:
        18,
      paddingTop:
        10,
    },

    handle: {
      width:
        38,
      height:
        4,
      borderRadius:
        2,
      alignSelf:
        'center',
      backgroundColor:
        colors.border,
      marginBottom:
        16,
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

    subtitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      lineHeight:
        18,
      textAlign:
        'center',
      marginTop:
        5,
      marginBottom:
        17,
    },

    actions: {
      overflow:
        'hidden',
      borderRadius:
        16,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.elevated,
    },

    actionRow: {
      minHeight:
        72,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        14,
      paddingVertical:
        12,
    },

    actionPressed: {
      opacity:
        0.68,
    },

    iconWrap: {
      width:
        40,
      height:
        40,
      borderRadius:
        12,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.background,
      marginRight:
        12,
    },

    actionCopy: {
      flex:
        1,
      paddingRight:
        10,
    },

    actionTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        14,
    },

    actionText: {
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

    divider: {
      height:
        1,
      backgroundColor:
        colors.border,
      marginLeft:
        66,
    },

    cancelButton: {
      minHeight:
        48,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop:
        10,
    },

    cancelText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        14,
    },
  });
}
