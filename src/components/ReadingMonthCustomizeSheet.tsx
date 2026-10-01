import {
  Ionicons,
} from '@expo/vector-icons';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  ReadingMonthIcon,
  ReadingMonthPersonalization,
} from '../lib/reading-month-personalization';

type Props = {
  visible: boolean;
  value:
    ReadingMonthPersonalization;
  monthLabel:
    string;
  onDismiss:
    () => void;
  onSave:
    (
      value:
        ReadingMonthPersonalization
    ) => Promise<void> | void;
};

const ICON_OPTIONS: Array<{
  value:
    ReadingMonthIcon;
  label:
    string;
}> = [
  {
    value:
      'coffee-outline',
    label:
      'Cozy',
  },
  {
    value:
      'moon-outline',
    label:
      'Late night',
  },
  {
    value:
      'headset-outline',
    label:
      'Audiobook',
  },
  {
    value:
      'rainy-outline',
    label:
      'Rainy',
  },
  {
    value:
      'airplane-outline',
    label:
      'Travel',
  },
  {
    value:
      'paw-outline',
    label:
      'Pet',
  },
  {
    value:
      'heart-outline',
    label:
      'Romance',
  },
  {
    value:
      'sparkles-outline',
    label:
      'Magic',
  },
  {
    value:
      'flame-outline',
    label:
      'On fire',
  },
  {
    value:
      'planet-outline',
    label:
      'Sci-fi',
  },
  {
    value:
      'leaf-outline',
    label:
      'Calm',
  },
  {
    value:
      'book-outline',
    label:
      'Bookish',
  },
];

export default function ReadingMonthCustomizeSheet({
  visible,
  value,
  monthLabel,
  onDismiss,
  onSave,
}: Props) {
  const {
    colors,
  } =
    useNovoriTheme();

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

  const insets =
    useSafeAreaInsets();

  const [
    icons,
    setIcons,
  ] =
    useState<
      ReadingMonthIcon[]
    >(
      value.icons
    );

  const [
    note,
    setNote,
  ] =
    useState(
      value.note
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );

  const translateY =
    useRef(
      new Animated.Value(
        18
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

  useEffect(
    () => {
      if (
        !visible
      ) {
        return;
      }

      setIcons(
        value.icons
      );

      setNote(
        value.note
      );
    },
    [
      value.icons,
      value.note,
      visible,
    ]
  );

  function animateIn() {
    closing.current =
      false;

    translateY.stopAnimation();
    sheetOpacity.stopAnimation();
    backdropOpacity.stopAnimation();

    translateY.setValue(
      18
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
            160,
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
            130,
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
            145,
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
      saving
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
            18,
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
            115,
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
        closing.current =
          false;

        if (
          finished
        ) {
          onDismiss();
        }
      }
    );
  }

  function toggleIcon(
    icon:
      ReadingMonthIcon
  ) {
    setIcons(
      (
        current
      ) => {
        if (
          current.includes(
            icon
          )
        ) {
          return current.filter(
            (
              item
            ) =>
              item !==
                icon
          );
        }

        if (
          current.length >=
          4
        ) {
          return current;
        }

        return [
          ...current,
          icon,
        ];
      }
    );
  }

  async function save() {
    if (
      saving
    ) {
      return;
    }

    try {
      setSaving(
        true
      );

      await onSave({
        icons,
        note:
          note
            .trim()
            .slice(
              0,
              80
            ),
      });

      closing.current =
        false;
      onDismiss();
    } finally {
      setSaving(
        false
      );
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
              !saving &&
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
                  80,
                  sheetHeight.current *
                    0.18
                ) ||
              gesture.vy >
                1.05
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

          onPanResponderTerminate: () => {
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
        saving,
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

        <KeyboardAvoidingView
          behavior={
            Platform.OS ===
            'ios'
              ? 'padding'
              : undefined
          }
        >
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
                    20,
                    insets.bottom +
                      10
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
                  styles.header
                }
              >
                <View
                  style={
                    styles.headerIcon
                  }
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={
                      20
                    }
                    color={
                      colors.gold
                    }
                  />
                </View>

                <View
                  style={
                    styles.headerCopy
                  }
                >
                  <Text
                    style={
                      styles.title
                    }
                  >
                    Make {monthLabel} yours
                  </Text>

                  <Text
                    style={
                      styles.subtitle
                    }
                  >
                    Pick up to four icons and leave yourself a tiny note.
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.sectionHeader
                }
              >
                <Text
                  style={
                    styles.sectionLabel
                  }
                >
                  YOUR ICONS
                </Text>

                <Text
                  style={
                    styles.counter
                  }
                >
                  {icons.length}/4
                </Text>
              </View>

              <View
                style={
                  styles.iconGrid
                }
              >
                {ICON_OPTIONS.map(
                  (
                    option
                  ) => {
                    const selected =
                      icons.includes(
                        option.value
                      );

                    const disabled =
                      !selected &&
                      icons.length >=
                        4;

                    return (
                      <Pressable
                        key={
                          option.value
                        }
                        disabled={
                          disabled
                        }
                        onPress={() =>
                          toggleIcon(
                            option.value
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.iconChoice,
                          selected &&
                            styles.iconChoiceSelected,
                          disabled &&
                            styles.iconChoiceDisabled,
                          pressed &&
                            !disabled &&
                            styles.pressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.iconBubble,
                            selected &&
                              styles.iconBubbleSelected,
                          ]}
                        >
                          <Ionicons
                            name={
                              option.value
                            }
                            size={
                              18
                            }
                            color={
                              selected
                                ? colors.gold
                                : colors.mutedText
                            }
                          />
                        </View>

                        <Text
                          style={[
                            styles.iconLabel,
                            selected &&
                              styles.iconLabelSelected,
                          ]}
                          numberOfLines={
                            1
                          }
                        >
                          {
                            option.label
                          }
                        </Text>
                      </Pressable>
                    );
                  }
                )}
              </View>

              <Text
                style={[
                  styles.sectionLabel,
                  styles.noteLabel,
                ]}
              >
                MONTH NOTE
              </Text>

              <View
                style={
                  styles.noteWrap
                }
              >
                <TextInput
                  value={
                    note
                  }
                  onChangeText={
                    setNote
                  }
                  maxLength={
                    80
                  }
                  placeholder="Thrillers, late nights, and way too much coffee."
                  placeholderTextColor={
                    colors.mutedText
                  }
                  multiline
                  textAlignVertical="top"
                  style={
                    styles.noteInput
                  }
                />

                <Text
                  style={
                    styles.noteCount
                  }
                >
                  {note.length}/80
                </Text>
              </View>

              <View
                style={
                  styles.actions
                }
              >
                <Pressable
                  disabled={
                    saving
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
                    saving
                  }
                  onPress={() =>
                    void save()
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.saveButton,
                    (
                      pressed ||
                      saving
                    ) &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={
                      styles.saveText
                    }
                  >
                    {saving
                      ? 'Saving...'
                      : 'Save Month'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
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
        'rgba(0, 0, 0, 0.55)',
    },
    sheet: {
      width:
        '100%',
      maxHeight:
        '88%',
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
    header: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        11,
      marginBottom:
        19,
    },
    headerIcon: {
      width:
        44,
      height:
        44,
      borderRadius:
        14,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    headerCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    title: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        20,
    },
    subtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11.5,
      lineHeight:
        16,
      marginTop:
        2,
    },
    sectionHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginBottom:
        8,
    },
    sectionLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        9,
      letterSpacing:
        1,
    },
    counter: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        10,
    },
    iconGrid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        8,
    },
    iconChoice: {
      width:
        '23%',
      minHeight:
        68,
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
      paddingHorizontal:
        5,
      paddingVertical:
        8,
    },
    iconChoiceSelected: {
      borderColor:
        colors.gold,
      backgroundColor:
        colors.elevated,
    },
    iconChoiceDisabled: {
      opacity:
        0.38,
    },
    iconBubble: {
      width:
        31,
      height:
        31,
      borderRadius:
        11,
      backgroundColor:
        colors.surface,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom:
        5,
    },
    iconBubbleSelected: {
      backgroundColor:
        colors.background,
    },
    iconLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        9,
      textAlign:
        'center',
    },
    iconLabelSelected: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
    },
    noteLabel: {
      marginTop:
        18,
      marginBottom:
        8,
    },
    noteWrap: {
      position:
        'relative',
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.background,
      borderRadius:
        15,
      padding:
        11,
      paddingBottom:
        26,
    },
    noteInput: {
      minHeight:
        58,
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      lineHeight:
        17,
      padding:
        0,
    },
    noteCount: {
      position:
        'absolute',
      right:
        10,
      bottom:
        8,
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        9,
    },
    actions: {
      flexDirection:
        'row',
      gap:
        9,
      marginTop:
        17,
    },
    cancelButton: {
      flex:
        1,
      minHeight:
        45,
      borderRadius:
        13,
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
        11.5,
    },
    saveButton: {
      flex:
        1.35,
      minHeight:
        45,
      borderRadius:
        13,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    saveText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        11.5,
    },
    pressed: {
      opacity:
        0.76,
    },
  });
}
