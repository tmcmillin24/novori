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

import ReadingMonthCharmArtwork from './ReadingMonthCharmArtwork';
import {
  NovoriColors,
} from '../constants/novori-theme';
import {
  useNovoriTheme,
} from '../context/theme-context';
import {
  ReadingMonthCharm,
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

const CHARM_OPTIONS: Array<{
  value:
    ReadingMonthCharm;
  label:
    string;
}> = [
  {
    value:
      'plant',
    label:
      'Plant',
  },
  {
    value:
      'sun',
    label:
      'Sun',
  },
  {
    value:
      'mug',
    label:
      'Mug',
  },
  {
    value:
      'moon',
    label:
      'Moon',
  },
  {
    value:
      'headphones',
    label:
      'Audio',
  },
  {
    value:
      'flower',
    label:
      'Flower',
  },
  {
    value:
      'cat',
    label:
      'Cat',
  },
  {
    value:
      'globe',
    label:
      'Globe',
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
    charms,
    setCharms,
  ] =
    useState<
      ReadingMonthCharm[]
    >(
      value.charms
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
        visible
      ) {
        setCharms(
          value.charms
        );
      }
    },
    [
      value.charms,
      visible,
    ]
  );

  function animateIn() {
    closing.current =
      false;

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

  function toggleCharm(
    item:
      ReadingMonthCharm
  ) {
    setCharms(
      (
        current
      ) => {
        if (
          current.includes(
            item
          )
        ) {
          return current.filter(
            (
              value
            ) =>
              value !==
                item
          );
        }

        if (
          current.length >=
          8
        ) {
          return current;
        }

        return [
          ...current,
          item,
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
        charms,
      });

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
          ) =>
            visible &&
            !saving &&
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
                  name="color-palette-outline"
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
                  styles.headerCopy
                }
              >
                <Text
                  style={
                    styles.title
                  }
                >
                  Personalize {monthLabel}
                </Text>

                <Text
                  style={
                    styles.subtitle
                  }
                >
                  Pick up to eight little charms for this month.
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
                MONTH CHARMS
              </Text>

              <Text
                style={
                  styles.counter
                }
              >
                {charms.length}/8
              </Text>
            </View>

            <View
              style={
                styles.charmGrid
              }
            >
              {CHARM_OPTIONS.map(
                (
                  option
                ) => {
                  const selected =
                    charms.includes(
                      option.value
                    );

                  const disabled =
                    !selected &&
                    charms.length >=
                      8;

                  return (
                    <Pressable
                      key={
                        option.value
                      }
                      disabled={
                        disabled
                      }
                      onPress={() =>
                        toggleCharm(
                          option.value
                        )
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.charmChoice,
                        selected &&
                          styles.charmChoiceSelected,
                        disabled &&
                          styles.charmChoiceDisabled,
                        pressed &&
                          !disabled &&
                          styles.pressed,
                      ]}
                    >
                      <View
                        style={
                          styles.charmArtworkWrap
                        }
                      >
                        <ReadingMonthCharmArtwork
                          charm={
                            option.value
                          }
                          size={
                            34
                          }
                        />
                      </View>

                      <Text
                        style={[
                          styles.charmLabel,
                          selected &&
                            styles.charmLabelSelected,
                        ]}
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
              style={
                styles.helperText
              }
            >
              Charms float around your monthly reading orbit and can change every month.
            </Text>

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
                    : 'Save Charms'}
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
      backgroundColor:
        'rgba(0, 0, 0, 0.55)',
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
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginBottom:
        9,
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
    charmGrid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        8,
    },
    charmChoice: {
      width:
        '23%',
      minHeight:
        76,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingVertical:
        7,
      opacity:
        0.86,
    },
    charmChoiceSelected: {
      opacity:
        1,
    },
    charmChoiceDisabled: {
      opacity:
        0.28,
    },
    charmArtworkWrap: {
      width:
        42,
      height:
        42,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom:
        6,
    },
    charmLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        9.5,
      textAlign:
        'center',
      paddingBottom:
        3,
      borderBottomWidth:
        1,
      borderBottomColor:
        'transparent',
    },
    charmLabelSelected: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      borderBottomColor:
        colors.gold,
    },
    helperText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      lineHeight:
        15,
      marginTop:
        13,
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
