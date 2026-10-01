import {
  Ionicons,
} from '@expo/vector-icons';
import {
  Image as ExpoImage,
} from 'expo-image';
import {
  useFocusEffect,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';
import {
  Easing as ReanimatedEasing,
  cancelAnimation,
  scrollTo,
  useAnimatedRef,
  useDerivedValue,
  useScrollOffset,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import ReadingMonthCharmArtwork from '../components/ReadingMonthCharmArtwork';
import ReadingMonthCustomizeSheet from '../components/ReadingMonthCustomizeSheet';
import {
  NovoriColors,
} from '../constants/novori-theme';
import {
  useNovoriTheme,
} from '../context/theme-context';
import {
  getReadingActivityMonth,
  ReadingActivityBook,
  ReadingActivityDay,
  ReadingActivityMonth,
} from '../lib/reading-activity';
import {
  getLocalDateKey,
} from '../lib/reading-checkins';
import {
  getReadingMonthPersonalization,
  ReadingMonthPersonalization,
  saveReadingMonthPersonalization,
} from '../lib/reading-month-personalization';

const ORBIT_EDGE_GUTTER =
  14;

const MAX_ORBIT_SIZE =
  460;

const ORBIT_DECOR_VERTICAL_PADDING =
  88;

const CHARM_ROTATIONS = [
  '-8deg',
  '5deg',
  '-3deg',
  '7deg',
  '-6deg',
  '4deg',
  '-4deg',
  '6deg',
] as const;

function getMonthLabel(
  year:
    number,
  monthIndex:
    number
) {
  return new Date(
    year,
    monthIndex,
    1
  ).toLocaleDateString(
    undefined,
    {
      month:
        'long',
      year:
        'numeric',
    }
  );
}

function getDayTitle(
  dateKey:
    string
) {
  const [
    year,
    month,
    day,
  ] =
    dateKey
      .split('-')
      .map(Number);

  return new Date(
    year,
    month - 1,
    day
  ).toLocaleDateString(
    undefined,
    {
      weekday:
        'long',
      month:
        'long',
      day:
        'numeric',
    }
  );
}

function padPart(
  value:
    number
) {
  return String(
    value
  ).padStart(
    2,
    '0'
  );
}

function getDateKey(
  year:
    number,
  monthIndex:
    number,
  day:
    number
) {
  return `${year}-${padPart(
    monthIndex +
      1
  )}-${padPart(
    day
  )}`;
}

function emptyDay(
  date:
    string
): ReadingActivityDay {
  return {
    date,
    checkedIn:
      false,
    checkinSource:
      null,
    books:
      [],
    checkinBooks:
      [],
    readingUpdates:
      [],
    journeyEvents:
      [],
  };
}

export default function ReadingActivityScreen() {
  const router =
    useRouter();

  const {
    width:
      windowWidth,
    height:
      windowHeight,
  } =
    useWindowDimensions();

  const scrollViewRef =
    useAnimatedRef<ScrollView>();

  const dayDetailsYRef =
    useRef<number | null>(
      null
    );

  const shouldAutoScrollRef =
    useRef(
      false
    );

  const scrollOffset =
    useScrollOffset(
      scrollViewRef
    );

  const animatedScrollY =
    useSharedValue(
      0
    );

  const autoScrollActive =
    useSharedValue(
      false
    );

  useDerivedValue(
    () => {
      if (
        autoScrollActive.value
      ) {
        scrollTo(
          scrollViewRef,
          0,
          animatedScrollY.value,
          false
        );
      }
    },
    [
      animatedScrollY,
      autoScrollActive,
      scrollViewRef,
    ]
  );

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

  const now =
    new Date();

  const todayKey =
    getLocalDateKey(
      now
    );

  const [
    displayedMonth,
    setDisplayedMonth,
  ] =
    useState({
      year:
        now.getFullYear(),
      monthIndex:
        now.getMonth(),
    });

  const [
    selectedDateKey,
    setSelectedDateKey,
  ] =
    useState<
      string | null
    >(
      null
    );

  const fullOrbitSize =
    Math.min(
      Math.max(
        windowWidth -
          ORBIT_EDGE_GUTTER *
            2,
        260
      ),
      MAX_ORBIT_SIZE
    );

  const activeOrbitSize =
    fullOrbitSize;

  const orbitCenter =
    activeOrbitSize /
    2;

  const dayMarkerSize =
    24;

  const dayTouchSize =
    32;

  const orbitRadius =
    activeOrbitSize /
      2 -
    (
      dayMarkerSize /
        2 +
      10
    );

  const outerHaloInset =
    Math.max(
      14,
      activeOrbitSize *
        0.045
    );

  const innerHaloInset =
    activeOrbitSize *
    0.17;

  const centerInset =
    activeOrbitSize *
    0.29;

  const [
    monthData,
    setMonthData,
  ] =
    useState<
      ReadingActivityMonth | null
    >(
      null
    );

  const [
    personalization,
    setPersonalization,
  ] =
    useState<ReadingMonthPersonalization>({
      charms:
        [],
    });

  const monthCharmPlacements =
    useMemo(
      () => {
        const topCharms =
          personalization.charms.slice(
            0,
            4
          );

        const bottomCharms =
          personalization.charms.slice(
            4,
            8
          );

        const centerX =
          activeOrbitSize /
          2;

        const centerY =
          ORBIT_DECOR_VERTICAL_PADDING +
          activeOrbitSize /
            2;

        const outerCircleRadius =
          activeOrbitSize /
            2 -
          outerHaloInset;

        const slotAngles: Record<
          number,
          number[]
        > = {
          1: [
            0,
          ],
          2: [
            -20,
            20,
          ],
          3: [
            -34,
            0,
            34,
          ],
          4: [
            -42,
            -14,
            14,
            42,
          ],
        };

        function placeCharm(
          charm:
            ReadingMonthPersonalization['charms'][number],
          index:
            number,
          count:
            number,
          top:
            boolean,
          rotationIndex:
            number
        ) {
          const offsets =
            slotAngles[
              Math.min(
                4,
                Math.max(
                  1,
                  count
                )
              )
            ];

          const degreesFromVertical =
            offsets[
              index
            ] ??
            0;

          const angle =
            (
              top
                ? -90 +
                  degreesFromVertical
                : 90 -
                  degreesFromVertical
            ) *
            Math.PI /
            180;

          const size =
            rotationIndex %
              3 ===
            0
              ? 54
              : 50;

          const stickerCenterRadius =
            outerCircleRadius +
            size /
              2 +
            10;

          const verticalNudge =
            top
              ? -26
              : 26;

          return {
            charm,
            size,
            left:
              centerX +
              Math.cos(
                angle
              ) *
                stickerCenterRadius -
              size /
                2,
            top:
              centerY +
              Math.sin(
                angle
              ) *
                stickerCenterRadius -
              size /
                2 +
              verticalNudge,
            rotate:
              CHARM_ROTATIONS[
                rotationIndex %
                  CHARM_ROTATIONS.length
              ],
          };
        }

        return [
          ...topCharms.map(
            (
              charm,
              index
            ) =>
              placeCharm(
                charm,
                index,
                topCharms.length,
                true,
                index
              )
          ),
          ...bottomCharms.map(
            (
              charm,
              index
            ) =>
              placeCharm(
                charm,
                index,
                bottomCharms.length,
                false,
                index +
                  4
              )
          ),
        ];
      },
      [
        activeOrbitSize,
        outerHaloInset,
        personalization.charms,
      ]
    );

  const [
    customizeVisible,
    setCustomizeVisible,
  ] =
    useState(
      false
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState('');

  const loadMonth =
    useCallback(
      async (
        showRefresh =
          false
      ) => {
        try {
          if (
            showRefresh
          ) {
            setRefreshing(
              true
            );
          } else {
            setLoading(
              true
            );
          }

          setError(
            ''
          );

          const [
            next,
            nextPersonalization,
          ] =
            await Promise.all([
              getReadingActivityMonth(
                displayedMonth.year,
                displayedMonth.monthIndex
              ),
              getReadingMonthPersonalization(
                displayedMonth.year,
                displayedMonth.monthIndex
              ),
            ]);

          setMonthData(
            next
          );

          setPersonalization(
            nextPersonalization
          );

          setSelectedDateKey(
            null
          );

          dayDetailsYRef.current =
            null;
        } catch (
          loadError
        ) {
          console.error(
            'Could not load reading activity:',
            loadError
          );

          setError(
            'Reading activity is temporarily unavailable.'
          );
        } finally {
          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      [
        displayedMonth.monthIndex,
        displayedMonth.year,
        todayKey,
      ]
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadMonth();
      },
      [
        loadMonth,
      ]
    )
  );

  const selectedDay =
    selectedDateKey
      ? monthData
          ?.days[
            selectedDateKey
          ] ??
        emptyDay(
          selectedDateKey
        )
      : null;

  const selectedDayBooks =
    selectedDay
      ? selectedDay.checkinBooks.length >
        0
        ? selectedDay.checkinBooks
        : selectedDay.books
      : [];

  const monthOrbitDots =
    useMemo(
      () => {
        if (
          !monthData
        ) {
          return [];
        }

        const checked =
          new Set(
            monthData.checkedDates
          );

        const daysInMonth =
          new Date(
            displayedMonth.year,
            displayedMonth.monthIndex +
              1,
            0
          ).getDate();

        return Array.from(
          {
            length:
              daysInMonth,
          },
          (
            _,
            index
          ) => {
            const day =
              index +
              1;

            const dateKey =
              getDateKey(
                displayedMonth.year,
                displayedMonth.monthIndex,
                day
              );

            const angle =
              -Math.PI /
                2 +
              (
                index /
                daysInMonth
              ) *
                Math.PI *
                2;

            return {
              day,
              dateKey,
              checked:
                checked.has(
                  dateKey
                ),
              today:
                dateKey ===
                todayKey,
              left:
                orbitCenter +
                Math.cos(
                  angle
                ) *
                  orbitRadius,
              top:
                orbitCenter +
                Math.sin(
                  angle
                ) *
                  orbitRadius,
            };
          }
        );
      },
      [
        displayedMonth.monthIndex,
        displayedMonth.year,
        monthData,
        orbitCenter,
        orbitRadius,
        todayKey,
      ]
    );

  const currentMonthStart =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).getTime();

  const displayedMonthStart =
    new Date(
      displayedMonth.year,
      displayedMonth.monthIndex,
      1
    ).getTime();

  const canGoForward =
    displayedMonthStart <
    currentMonthStart;

  function moveMonth(
    direction:
      -1 | 1
  ) {
    const next =
      new Date(
        displayedMonth.year,
        displayedMonth.monthIndex +
          direction,
        1
      );

    if (
      next.getTime() >
      currentMonthStart
    ) {
      return;
    }

    setMonthData(
      null
    );

    setSelectedDateKey(
      null
    );

    dayDetailsYRef.current =
      null;

    setDisplayedMonth({
      year:
        next.getFullYear(),
      monthIndex:
        next.getMonth(),
    });
  }

  function openBook(
    book:
      ReadingActivityBook
  ) {
    if (
      !book.googleBookId
    ) {
      return;
    }

    router.push({
      pathname:
        '/book/[id]',
      params: {
        id:
          book.googleBookId,
        source:
          'library',
      },
    });
  }

  async function saveMonthPersonalization(
    value:
      ReadingMonthPersonalization
  ) {
    const saved =
      await saveReadingMonthPersonalization(
        displayedMonth.year,
        displayedMonth.monthIndex,
        value
      );

    setPersonalization(
      saved
    );
  }

  function stopDayScrollAnimation() {
    cancelAnimation(
      animatedScrollY
    );

    autoScrollActive.value =
      false;
  }

  function scrollToDayDetails(
    y:
      number
  ) {
    const revealOffset =
      Math.min(
        310,
        Math.max(
          215,
          windowHeight *
            0.42
        )
      );

    const targetY =
      Math.max(
        0,
        y -
          revealOffset
      );

    stopDayScrollAnimation();

    animatedScrollY.value =
      scrollOffset.value;

    autoScrollActive.value =
      true;

    animatedScrollY.value =
      withTiming(
        targetY,
        {
          duration:
            760,
          easing:
            ReanimatedEasing.bezier(
              0.45,
              0,
              0.2,
              1
            ),
        },
        (
          finished
        ) => {
          if (
            finished
          ) {
            autoScrollActive.value =
              false;
          }
        }
      );
  }

  function handleOrbitDayPress(
    dateKey:
      string
  ) {
    if (
      selectedDateKey ===
      dateKey
    ) {
      shouldAutoScrollRef.current =
        false;
      dayDetailsYRef.current =
        null;

      stopDayScrollAnimation();

      setSelectedDateKey(
        null
      );
      return;
    }

    shouldAutoScrollRef.current =
      true;

    setSelectedDateKey(
      dateKey
    );

    if (
      dayDetailsYRef.current !==
      null
    ) {
      shouldAutoScrollRef.current =
        false;

      scrollToDayDetails(
        dayDetailsYRef.current
      );
    }
  }

  const hasSelectedActivity =
    Boolean(
      selectedDay &&
      (
        selectedDay.checkedIn ||
        selectedDay.books.length >
          0 ||
        selectedDay.readingUpdates.length >
          0 ||
        selectedDay.journeyEvents.length >
          0
      )
    );

  return (
    <>
      <SafeAreaView
      style={
        styles.safeArea
      }
      edges={[
        'top',
      ]}
    >
      <ScrollView
        ref={
          scrollViewRef
        }
        showsVerticalScrollIndicator={
          false
        }
        scrollEventThrottle={
          16
        }
        onScrollBeginDrag={
          stopDayScrollAnimation
        }
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() =>
              void loadMonth(
                true
              )
            }
            tintColor={
              colors.gold
            }
            colors={[
              colors.gold,
            ]}
            progressBackgroundColor={
              colors.surface
            }
          />
        }
      >
        <View
          style={
            styles.headerRow
          }
        >
          <Pressable
            onPress={() =>
              router.back()
            }
            hitSlop={
              8
            }
            style={({
              pressed,
            }) => [
              styles.backButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={
                20
              }
              color={
                colors.mutedText
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
                styles.heading
              }
            >
              Reading Activity
            </Text>

            <Text
              style={
                styles.subheading
              }
            >
              A record of the reading life you’re building.
            </Text>
          </View>
        </View>

        <View
          style={
            styles.monthHeader
          }
        >
          <Pressable
            onPress={() =>
              moveMonth(
                -1
              )
            }
            style={({
              pressed,
            }) => [
              styles.monthButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={
                18
              }
              color={
                colors.gold
              }
            />
          </Pressable>

          <Text
            style={
              styles.monthTitle
            }
          >
            {getMonthLabel(
              displayedMonth.year,
              displayedMonth.monthIndex
            )}
          </Text>

          <Pressable
            disabled={
              !canGoForward
            }
            onPress={() =>
              moveMonth(
                1
              )
            }
            style={({
              pressed,
            }) => [
              styles.monthButton,
              !canGoForward &&
                styles.monthButtonDisabled,
              pressed &&
                canGoForward &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="chevron-forward"
              size={
                18
              }
              color={
                canGoForward
                  ? colors.gold
                  : colors.mutedText
              }
            />
          </Pressable>
        </View>

        {loading &&
        !monthData ? (
          <View
            style={
              styles.loadingCard
            }
          >
            <ActivityIndicator
              size="small"
              color={
                colors.gold
              }
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Loading your reading month...
            </Text>
          </View>
        ) : error ? (
          <View
            style={
              styles.errorCard
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={
                24
              }
              color={
                colors.danger
              }
            />

            <Text
              style={
                styles.errorTitle
              }
            >
              Couldn’t load activity
            </Text>

            <Text
              style={
                styles.errorText
              }
            >
              {error}
            </Text>

            <Pressable
              onPress={() =>
                void loadMonth()
              }
              style={({
                pressed,
              }) => [
                styles.retryButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.retryText
                }
              >
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : monthData ? (
          <>
            <View
              style={
                styles.orbitHero
              }
            >
              <View
                style={
                  styles.orbitIntro
                }
              >
                <View
                  style={
                    styles.orbitEyebrowRow
                  }
                >
                  <Text
                    style={
                      styles.orbitEyebrow
                    }
                  >
                    YOUR MONTH
                  </Text>

                  <Ionicons
                    name="sparkles"
                    size={
                      11
                    }
                    color={
                      colors.gold
                    }
                  />
                </View>

                <View
                  style={
                    styles.orbitHeadingRow
                  }
                >
                  <View
                    style={
                      styles.orbitIntroCopy
                    }
                  >
                    <Text
                      style={
                        styles.orbitTitle
                      }
                    >
                      Reading in motion
                    </Text>

                    <Text
                      style={
                        styles.orbitSubtitle
                      }
                    >
                      Every reading day leaves a mark.
                    </Text>
                  </View>

                  <Pressable
                    onPress={() =>
                      setCustomizeVisible(
                        true
                      )
                    }
                    hitSlop={
                      8
                    }
                    accessibilityRole="button"
                    accessibilityLabel="Personalize this reading month"
                    style={({
                      pressed,
                    }) => [
                      styles.personalizeButton,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="color-palette-outline"
                      size={
                        14
                      }
                      color={
                        colors.background
                      }
                    />

                    <Text
                      style={
                        styles.personalizeButtonText
                      }
                    >
                      Personalize
                    </Text>
                  </Pressable>
                </View>

                <View
                  style={
                    styles.orbitAccentLine
                  }
                />
              </View>

              <View
                style={[
                  styles.orbitDecorStage,
                  {
                    width:
                      activeOrbitSize,
                    height:
                      activeOrbitSize +
                      ORBIT_DECOR_VERTICAL_PADDING *
                        2,
                  },
                ]}
              >
              <View
                style={[
                  styles.orbitStage,
                  {
                    top:
                      ORBIT_DECOR_VERTICAL_PADDING,
                    width:
                      activeOrbitSize,
                    height:
                      activeOrbitSize,
                  },
                ]}
              >
                <View
                  style={[
                    styles.orbitHaloOuter,
                    {
                      left:
                        outerHaloInset,
                      top:
                        outerHaloInset,
                      width:
                        activeOrbitSize -
                        outerHaloInset *
                          2,
                      height:
                        activeOrbitSize -
                        outerHaloInset *
                          2,
                      borderRadius:
                        (
                          activeOrbitSize -
                          outerHaloInset *
                            2
                        ) /
                        2,
                    },
                  ]}
                />

                <View
                  style={[
                    styles.orbitHaloInner,
                    {
                      left:
                        innerHaloInset,
                      top:
                        innerHaloInset,
                      width:
                        activeOrbitSize -
                        innerHaloInset *
                          2,
                      height:
                        activeOrbitSize -
                        innerHaloInset *
                          2,
                      borderRadius:
                        (
                          activeOrbitSize -
                          innerHaloInset *
                            2
                        ) /
                        2,
                    },
                  ]}
                />

                {monthOrbitDots.map(
                  (
                    dot
                  ) => {
                    const selected =
                      dot.dateKey ===
                      selectedDateKey;

                    return (
                      <Pressable
                        key={
                          dot.dateKey
                        }
                        onPress={() =>
                          handleOrbitDayPress(
                            dot.dateKey
                          )
                        }
                        hitSlop={
                          3
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`${getDayTitle(
                          dot.dateKey
                        )}${dot.checked ? ', reading day' : ', no reading logged'}`}
                        accessibilityState={{
                          selected,
                        }}
                        style={({
                          pressed,
                        }) => [
                          styles.orbitDayTouch,
                          {
                            width:
                              dayTouchSize,
                            height:
                              dayTouchSize,
                            borderRadius:
                              dayTouchSize /
                              2,
                            left:
                              dot.left -
                              dayTouchSize /
                                2,
                            top:
                              dot.top -
                              dayTouchSize /
                                2,
                          },
                          pressed &&
                            styles.orbitDayTouchPressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.orbitDayCircle,
                            {
                              width:
                                dayMarkerSize,
                              height:
                                dayMarkerSize,
                              borderRadius:
                                dayMarkerSize /
                                2,
                            },
                            dot.checked &&
                              styles.orbitDayRead,
                            dot.today &&
                              styles.orbitDayToday,
                            selected &&
                              styles.orbitDaySelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.orbitDayNumber,
                              dot.checked &&
                                styles.orbitDayNumberRead,
                              selected &&
                                styles.orbitDayNumberSelected,
                            ]}
                          >
                            {
                              dot.day
                            }
                          </Text>
                        </View>
                      </Pressable>
                    );
                  }
                )}

                <View
                  pointerEvents="none"
                  style={[
                    styles.orbitCenter,
                    {
                      left:
                        centerInset,
                      top:
                        centerInset,
                      width:
                        activeOrbitSize -
                        centerInset *
                          2,
                      height:
                        activeOrbitSize -
                        centerInset *
                          2,
                      borderRadius:
                        (
                          activeOrbitSize -
                          centerInset *
                            2
                        ) /
                        2,
                    },
                  ]}
                >
                  <Ionicons
                    name="book-outline"
                    size={
                      26
                    }
                    color={
                      colors.gold
                    }
                  />

                  <Text
                    style={
                      styles.orbitHint
                    }
                  >
                    TAP A DAY
                  </Text>
                </View>

              </View>

              {monthCharmPlacements.map(
                (
                  placement
                ) => (
                  <View
                    key={
                      placement.charm
                    }
                    pointerEvents="none"
                    style={[
                      styles.orbitCharm,
                      {
                        width:
                          placement.size +
                          8,
                        height:
                          placement.size +
                          8,
                        left:
                          placement.left -
                          4,
                        top:
                          placement.top -
                          4,
                        transform: [
                          {
                            rotate:
                              placement.rotate,
                          },
                        ],
                      },
                    ]}
                  >
                    <ReadingMonthCharmArtwork
                      charm={
                        placement.charm
                      }
                      size={
                        placement.size
                      }
                    />
                  </View>
                )
              )}
            </View>

            </View>

            {selectedDateKey &&
            selectedDay ? (
              <View
                onLayout={(
                  event
                ) => {
                  const y =
                    event.nativeEvent.layout.y;

                  dayDetailsYRef.current =
                    y;

                  if (
                    shouldAutoScrollRef.current
                  ) {
                    shouldAutoScrollRef.current =
                      false;

                    scrollToDayDetails(
                      y
                    );
                  }
                }}
              >
            <View
              style={
                styles.dayMemorySection
              }
            >
              <View
                style={
                  styles.dayMemoryEyebrowRow
                }
              >
                <Text
                  style={
                    styles.sectionEyebrow
                  }
                >
                  ON THIS DAY
                </Text>

                <View
                  style={
                    styles.dayMemoryEyebrowLine
                  }
                />
              </View>

              <View
                style={
                  styles.dayDetailHeader
                }
              >
                <View
                  style={
                    styles.dayDetailCopy
                  }
                >
                  <Text
                    style={
                      styles.dayDetailTitle
                    }
                  >
                    {getDayTitle(
                      selectedDateKey
                    )}
                  </Text>

                  <Text
                    style={
                      styles.dayDetailSubtitle
                    }
                  >
                    {selectedDay.checkedIn
                      ? 'A day you showed up for your reading.'
                      : hasSelectedActivity
                      ? 'A little piece of your reading history.'
                      : 'A quiet day in your reading story.'}
                  </Text>
                </View>

                {selectedDay.checkedIn ? (
                  <View
                    style={
                      styles.readBadge
                    }
                  >
                    <View
                      style={
                        styles.readBadgeDot
                      }
                    />

                    <Text
                      style={
                        styles.readBadgeText
                      }
                    >
                      Reading day
                    </Text>
                  </View>
                ) : null}
              </View>

              <View
                style={
                  styles.dayMemoryRule
                }
              />

              {!hasSelectedActivity ? (
                <View
                  style={
                    styles.emptyDay
                  }
                >
                  <Ionicons
                    name="book-outline"
                    size={
                      20
                    }
                    color={
                      colors.gold
                    }
                  />

                  <View
                    style={
                      styles.emptyDayCopy
                    }
                  >
                    <Text
                      style={
                        styles.emptyDayTitle
                      }
                    >
                      Nothing logged this day
                    </Text>

                    <Text
                      style={
                        styles.emptyDayText
                      }
                    >
                      Reading activity and journey moments will collect here over time.
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  {selectedDayBooks.length >
                  0 ? (
                    <View
                      style={
                        styles.detailSection
                      }
                    >
                      <Text
                        style={
                          styles.detailLabel
                        }
                      >
                        BOOKS
                      </Text>

                      <View
                        style={
                          styles.bookList
                        }
                      >
                        {selectedDayBooks.map(
                          (
                            book,
                            index
                          ) => (
                            <ActivityBookRow
                              key={
                                book.userBookId ??
                                book.googleBookId ??
                                `${book.title}-${index}`
                              }
                              book={
                                book
                              }
                              colors={
                                colors
                              }
                              styles={
                                styles
                              }
                              onPress={() =>
                                openBook(
                                  book
                                )
                              }
                            />
                          )
                        )}
                      </View>
                    </View>
                  ) : null}

                  {selectedDay.journeyEvents.length >
                  0 ? (
                    <View
                      style={
                        styles.detailSection
                      }
                    >
                      <Text
                        style={
                          styles.detailLabel
                        }
                      >
                        JOURNEY MOMENTS
                      </Text>

                      <View
                        style={
                          styles.milestoneList
                        }
                      >
                        {selectedDay.journeyEvents.map(
                          (
                            event
                          ) => (
                            <View
                              key={
                                event.id
                              }
                              style={
                                styles.milestoneRow
                              }
                            >
                              <View
                                style={
                                  styles.milestoneIcon
                                }
                              >
                                <Ionicons
                                  name={
                                    event.type ===
                                    'finished'
                                      ? 'checkmark'
                                      : 'flag-outline'
                                  }
                                  size={
                                    15
                                  }
                                  color={
                                    colors.gold
                                  }
                                />
                              </View>

                              <View
                                style={
                                  styles.milestoneCopy
                                }
                              >
                                <Text
                                  style={
                                    styles.milestoneTitle
                                  }
                                >
                                  {event.type ===
                                  'finished'
                                    ? 'Finished'
                                    : 'Marked DNF'}
                                </Text>

                                {event.book ? (
                                  <Text
                                    style={
                                      styles.milestoneBook
                                    }
                                    numberOfLines={
                                      1
                                    }
                                  >
                                    {
                                      event.book
                                        .title
                                    }
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          )
                        )}
                      </View>
                    </View>
                  ) : null}
                </>
              )}
            </View>

              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>

      <ReadingMonthCustomizeSheet
        visible={
          customizeVisible
        }
        value={
          personalization
        }
        monthLabel={
          getMonthLabel(
            displayedMonth.year,
            displayedMonth.monthIndex
          )
        }
        monthIndex={
          displayedMonth.monthIndex
        }
        onDismiss={() =>
          setCustomizeVisible(
            false
          )
        }
        onSave={
          saveMonthPersonalization
        }
      />
    </>
  );
}

function ActivityBookRow({
  book,
  colors,
  styles,
  onPress,
}: {
  book:
    ReadingActivityBook;
  colors:
    NovoriColors;
  styles:
    ReturnType<
      typeof createStyles
    >;
  onPress:
    () => void;
}) {
  const canOpen =
    Boolean(
      book.googleBookId
    );

  return (
    <Pressable
      disabled={
        !canOpen
      }
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.bookRow,
        pressed &&
          canOpen &&
          styles.pressed,
      ]}
    >
      {book.coverUrl ? (
        <ExpoImage
          source={
            book.coverUrl
          }
          style={
            styles.bookCover
          }
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={
            0
          }
          recyclingKey={
            book.coverUrl
          }
        />
      ) : (
        <View
          style={
            styles.bookCoverPlaceholder
          }
        >
          <Ionicons
            name="book-outline"
            size={
              18
            }
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

        {book.authors.length >
        0 ? (
          <Text
            style={
              styles.bookAuthor
            }
            numberOfLines={
              1
            }
          >
            {book.authors.join(
              ', '
            )}
          </Text>
        ) : null}
      </View>

      {canOpen ? (
        <Ionicons
          name="chevron-forward"
          size={
            16
          }
          color={
            colors.mutedText
          }
        />
      ) : null}
    </Pressable>
  );
}

function createStyles(
  colors:
    NovoriColors
) {
  return StyleSheet.create({
    safeArea: {
      flex:
        1,
      backgroundColor:
        colors.background,
    },
    content: {
      width:
        '100%',
      maxWidth:
        720,
      alignSelf:
        'center',
      paddingHorizontal:
        20,
      paddingTop:
        18,
      paddingBottom:
        70,
    },
    headerRow: {
      position:
        'relative',
      alignItems:
        'center',
      justifyContent:
        'center',
      minHeight:
        66,
      paddingHorizontal:
        38,
    },
    backButton: {
      position:
        'absolute',
      left:
        0,
      top:
        7,
      width:
        34,
      height:
        34,
      borderRadius:
        17,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    headerCopy: {
      width:
        '100%',
      alignItems:
        'center',
    },
    heading: {
      color:
        colors.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        31,
      letterSpacing:
        0.1,
      textAlign:
        'center',
    },
    subheading: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      marginTop:
        3,
      textAlign:
        'center',
    },
    monthHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      alignSelf:
        'center',
      gap:
        7,
      marginTop:
        24,
      marginBottom:
        16,
      paddingHorizontal:
        7,
      paddingVertical:
        6,
      borderRadius:
        999,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
    },
    monthButton: {
      width:
        32,
      height:
        32,
      borderRadius:
        16,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    monthButtonDisabled: {
      opacity:
        0.45,
    },
    monthTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        21,
    },
    orbitHero: {
      marginBottom:
        26,
    },
    orbitIntro: {
      marginBottom:
        8,
      paddingHorizontal:
        2,
    },
    orbitEyebrowRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        5,
      marginBottom:
        4,
    },
    orbitHeadingRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap:
        14,
    },
    orbitIntroCopy: {
      flex:
        1,
    },
    orbitAccentLine: {
      width:
        42,
      height:
        2,
      borderRadius:
        999,
      backgroundColor:
        colors.gold,
      opacity:
        0.68,
      marginTop:
        11,
    },
    orbitEyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        8.5,
      letterSpacing:
        1.3,
    },
    orbitTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        25,
      letterSpacing:
        0.1,
    },
    orbitSubtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
      marginTop:
        3,
    },
    personalizeButton: {
      minHeight:
        34,
      borderRadius:
        999,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        5,
      paddingHorizontal:
        11,
      backgroundColor:
        colors.gold,
    },
    personalizeButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        9.5,
    },
    orbitStage: {
      position:
        'absolute',
      left:
        0,
    },
    orbitHaloOuter: {
      position:
        'absolute',
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    orbitHaloInner: {
      position:
        'absolute',
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    orbitDayTouch: {
      position:
        'absolute',
      alignItems:
        'center',
      justifyContent:
        'center',
      zIndex:
        6,
    },
    orbitDayTouchPressed: {
      transform: [
        {
          scale:
            1.12,
        },
      ],
    },
    orbitDayCircle: {
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    orbitDayRead: {
      backgroundColor:
        colors.gold,
      borderColor:
        colors.gold,
    },
    orbitDayToday: {
      borderWidth:
        1.5,
      borderColor:
        colors.gold,
    },
    orbitDaySelected: {
      borderWidth:
        2,
      borderColor:
        colors.softGold,
      backgroundColor:
        colors.elevated,
    },
    orbitDayNumber: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        8.5,
      lineHeight:
        10,
    },
    orbitDayNumberRead: {
      color:
        colors.background,
    },
    orbitDayNumberSelected: {
      color:
        colors.gold,
    },
    orbitCenter: {
      position:
        'absolute',
      alignItems:
        'center',
      justifyContent:
        'center',
      zIndex:
        3,
    },
    orbitHint: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        8,
      letterSpacing:
        1.45,
      marginTop:
        7,
    },
    orbitDecorStage: {
      alignSelf:
        'center',
      position:
        'relative',
      overflow:
        'visible',
    },
    orbitCharm: {
      position:
        'absolute',
      alignItems:
        'center',
      justifyContent:
        'center',
      zIndex:
        4,
    },
    sectionIntro: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap:
        12,
      marginBottom:
        9,
      paddingHorizontal:
        2,
    },
    sectionEyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        8.5,
      letterSpacing:
        1.2,
    },
    sectionIntroTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      fontSize:
        17,
      marginTop:
        2,
    },
    dayMemorySection: {
      marginTop:
        20,
      paddingHorizontal:
        2,
      paddingBottom:
        6,
    },
    dayMemoryEyebrowRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        9,
      marginBottom:
        7,
    },
    dayMemoryEyebrowLine: {
      flex:
        1,
      height:
        1,
      backgroundColor:
        colors.gold,
      opacity:
        0.3,
    },
    dayDetailHeader: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
      gap:
        12,
    },
    dayDetailCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    dayDetailTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        23,
      lineHeight:
        29,
    },
    dayDetailSubtitle: {
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
    readBadge: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        6,
      paddingHorizontal:
        9,
      paddingVertical:
        6,
      borderRadius:
        999,
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
      marginTop:
        2,
    },
    readBadgeDot: {
      width:
        6,
      height:
        6,
      borderRadius:
        3,
      backgroundColor:
        colors.gold,
    },
    readBadgeText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        9.5,
    },
    dayMemoryRule: {
      height:
        1,
      backgroundColor:
        colors.border,
      marginTop:
        14,
    },
    detailSection: {
      marginTop:
        18,
    },
    detailLabel: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        8.5,
      letterSpacing:
        1.15,
      marginBottom:
        7,
    },
    bookList: {
      gap:
        0,
    },
    bookRow: {
      minHeight:
        76,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        11,
      paddingVertical:
        8,
      borderBottomWidth:
        1,
      borderBottomColor:
        colors.border,
    },
    bookCover: {
      width:
        36,
      height:
        54,
      borderRadius:
        6,
      backgroundColor:
        colors.elevated,
    },
    bookCoverPlaceholder: {
      width:
        36,
      height:
        54,
      borderRadius:
        6,
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
      minWidth:
        0,
    },
    bookTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
      lineHeight:
        16,
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
    milestoneList: {
      gap:
        0,
    },
    milestoneRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        10,
      paddingVertical:
        10,
      borderBottomWidth:
        1,
      borderBottomColor:
        colors.border,
    },
    milestoneIcon: {
      width:
        30,
      height:
        30,
      borderRadius:
        15,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    milestoneCopy: {
      flex:
        1,
    },
    milestoneTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11.5,
    },
    milestoneBook: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      marginTop:
        2,
    },
    emptyDay: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      gap:
        11,
      paddingVertical:
        17,
    },
    emptyDayCopy: {
      flex:
        1,
    },
    emptyDayTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
    },
    emptyDayText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      lineHeight:
        15,
      marginTop:
        3,
      maxWidth:
        280,
    },
    loadingCard: {
      minHeight:
        180,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        18,
      backgroundColor:
        colors.surface,
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        10,
    },
    loadingText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        11.5,
    },
    errorCard: {
      alignItems:
        'center',
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        18,
      backgroundColor:
        colors.surface,
      padding:
        22,
    },
    errorTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
      marginTop:
        8,
    },
    errorText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
      textAlign:
        'center',
      marginTop:
        4,
    },
    retryButton: {
      minHeight:
        38,
      borderRadius:
        11,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        16,
      marginTop:
        13,
    },
    retryText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        11,
    },
    pressed: {
      opacity:
        0.72,
    },
  });
}
