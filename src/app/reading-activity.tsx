import BookCoverImage from '../components/BookCoverImage';
import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useFocusEffect,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
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

const MAX_ORBIT_DECOR_VERTICAL_PADDING =
  88;

const MIN_ORBIT_DECOR_VERTICAL_PADDING =
  58;

const MIN_ORBIT_SIZE =
  240;

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

function getOrbitDayLabel(
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
      month:
        'long',
      day:
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

  const orbitFormationProgress =
    useRef(
      new Animated.Value(
        1
      )
    ).current;

  const {
    width:
      windowWidth,
    height:
      windowHeight,
  } =
    useWindowDimensions();

  const insets =
    useSafeAreaInsets();

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

  const widthOrbitSize =
    Math.min(
      Math.max(
        windowWidth -
          ORBIT_EDGE_GUTTER *
            2,
        260
      ),
      MAX_ORBIT_SIZE
    );

  const usableHeight =
    Math.max(
      480,
      windowHeight -
        insets.top
    );

  const compactHeight =
    usableHeight <
    700;

  const topChromeBudget =
    compactHeight
      ? 126
      : 164;

  const heroHeightBudget =
    Math.max(
      360,
      usableHeight -
        topChromeBudget
    );

  const orbitDecorVerticalPadding =
    Math.min(
      MAX_ORBIT_DECOR_VERTICAL_PADDING,
      Math.max(
        MIN_ORBIT_DECOR_VERTICAL_PADDING,
        (
          heroHeightBudget -
          widthOrbitSize
        ) /
          2
      )
    );

  const heightOrbitBudget =
    Math.max(
      MIN_ORBIT_SIZE,
      heroHeightBudget -
        orbitDecorVerticalPadding *
          2
    );

  const activeOrbitSize =
    Math.min(
      widthOrbitSize,
      heightOrbitBudget
    );

  const charmScale =
    Math.min(
      1,
      Math.max(
        0.82,
        orbitDecorVerticalPadding /
          74
      )
    );

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
    0.27;

  const centerCoverWidth =
    Math.min(
      44,
      Math.max(
        36,
        activeOrbitSize *
          0.12
      )
    );

  const centerCoverHeight =
    centerCoverWidth *
    1.5;

  const showCenterAuthor =
    activeOrbitSize >=
    300;

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
          orbitDecorVerticalPadding +
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
            (
              rotationIndex %
                3 ===
              0
                ? 54
                : 50
            ) *
            charmScale;

          const stickerCenterRadius =
            outerCircleRadius +
            size /
              2 +
            10;

          const verticalNudge =
            (
              top
                ? -26
                : 26
            ) *
            charmScale;

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
        charmScale,
        orbitDecorVerticalPadding,
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
        } catch (
          loadError
        ) {
          console.error(
            'Could not load reading tracker:',
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

  useEffect(
    () => {
      if (
        monthOrbitDots.length ===
        0
      ) {
        return;
      }

      orbitFormationProgress.stopAnimation();
      orbitFormationProgress.setValue(
        0
      );

      const animation =
        Animated.timing(
          orbitFormationProgress,
          {
            toValue:
              1,
            duration:
              1500,
            easing:
              Easing.out(
                Easing.cubic
              ),
            useNativeDriver:
              true,
          }
        );

      animation.start();

      return () => {
        animation.stop();
      };
    },
    [
      displayedMonth.monthIndex,
      displayedMonth.year,
      monthData,
      monthOrbitDots.length,
      orbitFormationProgress,
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

    setDisplayedMonth({
      year:
        next.getFullYear(),
      monthIndex:
        next.getMonth(),
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

  function dismissSelectedDay() {
    if (
      !selectedDateKey
    ) {
      return;
    }

    setSelectedDateKey(
      null
    );
  }

  function handleOrbitDayPress(
    dateKey:
      string
  ) {
    setSelectedDateKey(
      (
        current
      ) =>
        current ===
        dateKey
          ? null
          : dateKey
    );
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
        showsVerticalScrollIndicator={
          false
        }
        scrollEventThrottle={
          16
        }
        contentContainerStyle={[
          styles.content,
          compactHeight &&
            styles.contentCompact,
        ]}
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
          style={[
            styles.headerRow,
            compactHeight &&
              styles.headerRowCompact,
          ]}
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
              style={[
                styles.heading,
                compactHeight &&
                  styles.headingCompact,
              ]}
            >
              Reading Tracker
            </Text>

            <Text
              style={[
                styles.subheading,
                compactHeight &&
                  styles.subheadingCompact,
              ]}
            >
              A record of the reading life you’re building.
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.monthToolbar,
            compactHeight &&
              styles.monthToolbarCompact,
          ]}
        >
          <View
            style={
              styles.monthNav
            }
          >
            <Pressable
              onPress={() =>
                moveMonth(
                  -1
                )
              }
              hitSlop={
                8
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
                  17
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
              hitSlop={
                8
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
                  17
                }
                color={
                  canGoForward
                    ? colors.gold
                    : colors.mutedText
                }
              />
            </Pressable>
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
              styles.personalizeIconButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="color-palette-outline"
              size={
                17
              }
              color={
                colors.gold
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
              style={[
                styles.orbitHero,
                compactHeight &&
                  styles.orbitHeroCompact,
              ]}
            >
              <View
                style={[
                  styles.orbitDecorStage,
                  {
                    width:
                      activeOrbitSize,
                    height:
                      activeOrbitSize +
                      orbitDecorVerticalPadding *
                        2,
                  },
                ]}
              >
              <View
                style={[
                  styles.orbitStage,
                  {
                    top:
                      orbitDecorVerticalPadding,
                    width:
                      activeOrbitSize,
                    height:
                      activeOrbitSize,
                  },
                ]}
              >
                <View
                  pointerEvents="none"
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
                  pointerEvents="none"
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
                    dot,
                    index
                  ) => {
                    const selected =
                      dot.dateKey ===
                      selectedDateKey;

                    const count =
                      Math.max(
                        1,
                        monthOrbitDots.length
                      );

                    const revealStart =
                      count ===
                      1
                        ? 0
                        : (
                            index /
                            (
                              count -
                              1
                            )
                          ) *
                          0.8;

                    const revealEnd =
                      Math.min(
                        1,
                        revealStart +
                          0.2
                      );

                    const opacity =
                      orbitFormationProgress.interpolate({
                        inputRange: [
                          revealStart,
                          revealEnd,
                        ],
                        outputRange: [
                          0,
                          1,
                        ],
                        extrapolate:
                          'clamp',
                      });

                    const scale =
                      orbitFormationProgress.interpolate({
                        inputRange: [
                          revealStart,
                          revealEnd,
                        ],
                        outputRange: [
                          0.55,
                          1,
                        ],
                        extrapolate:
                          'clamp',
                      });

                    const translateX =
                      orbitFormationProgress.interpolate({
                        inputRange: [
                          revealStart,
                          revealEnd,
                        ],
                        outputRange: [
                          (
                            orbitCenter -
                            dot.left
                          ) *
                            0.18,
                          0,
                        ],
                        extrapolate:
                          'clamp',
                      });

                    const translateY =
                      orbitFormationProgress.interpolate({
                        inputRange: [
                          revealStart,
                          revealEnd,
                        ],
                        outputRange: [
                          (
                            orbitCenter -
                            dot.top
                          ) *
                            0.18,
                          0,
                        ],
                        extrapolate:
                          'clamp',
                      });

                    return (
                      <Animated.View
                        key={
                          dot.dateKey
                        }
                        pointerEvents="box-none"
                        style={[
                          styles.orbitDayAnimatedSlot,
                          {
                            width:
                              dayTouchSize,
                            height:
                              dayTouchSize,
                            left:
                              dot.left -
                              dayTouchSize /
                                2,
                            top:
                              dot.top -
                              dayTouchSize /
                                2,
                            opacity,
                            transform: [
                              {
                                translateX,
                              },
                              {
                                translateY,
                              },
                              {
                                scale,
                              },
                            ],
                          },
                        ]}
                      >
                        <Pressable
                          onPress={() =>
                            handleOrbitDayPress(
                              dot.dateKey
                            )
                          }
                          accessibilityRole="button"
                          accessibilityLabel={
                            `${getDayTitle(
                              dot.dateKey
                            )}${dot.checked ? ', reading day' : ', no reading logged'}`
                          }
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
                      </Animated.View>
                    );
                  }
                )}

                <Pressable
                  onPress={
                    selectedDateKey
                      ? dismissSelectedDay
                      : undefined
                  }
                  disabled={
                    !selectedDateKey
                  }
                  accessibilityRole={
                    selectedDateKey
                      ? 'button'
                      : undefined
                  }
                  accessibilityLabel={
                    selectedDateKey
                      ? 'Close selected reading day'
                      : undefined
                  }
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
                  {selectedDateKey &&
                  selectedDay ? (
                    selectedDayBooks[0] ? (
                      <>
                        <View
                          style={
                            styles.orbitCenterEyebrowRow
                          }
                        >
                          <View
                            style={
                              styles.orbitCenterEyebrowDot
                            }
                          />

                          <Text
                            style={
                              styles.orbitCenterEyebrow
                            }
                          >
                            {selectedDay.checkedIn
                              ? 'READING DAY'
                              : 'READING TRACKER'}
                          </Text>
                        </View>

                        {(selectedDayBooks[0].googleBookId || selectedDayBooks[0]
                          .coverUrl) ? (
                          <BookCoverImage
                            googleBookId={selectedDayBooks[0].googleBookId}
                            existingCoverUrl={selectedDayBooks[0].coverUrl}
                            style={[
                              styles.orbitCenterCover,
                              {
                                width:
                                  centerCoverWidth,
                                height:
                                  centerCoverHeight,
                              },
                            ]}
                          />
                        ) : (
                          <View
                            style={[
                              styles.orbitCenterCoverPlaceholder,
                              {
                                width:
                                  centerCoverWidth,
                                height:
                                  centerCoverHeight,
                              },
                            ]}
                          >
                            <Ionicons
                              name="book-outline"
                              size={
                                17
                              }
                              color={
                                colors.gold
                              }
                            />
                          </View>
                        )}

                        <Text
                          style={
                            styles.orbitCenterBookTitle
                          }
                          numberOfLines={
                            2
                          }
                        >
                          {
                            selectedDayBooks[0]
                              .title
                          }
                        </Text>

                        {showCenterAuthor &&
                        selectedDayBooks[0]
                          .authors.length >
                          0 ? (
                          <Text
                            style={
                              styles.orbitCenterAuthor
                            }
                            numberOfLines={
                              1
                            }
                          >
                            {
                              selectedDayBooks[0]
                                .authors[0]
                            }
                          </Text>
                        ) : null}

                        <Text
                          style={
                            styles.orbitCenterDate
                          }
                        >
                          {getOrbitDayLabel(
                            selectedDateKey
                          )}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text
                          style={
                            styles.orbitCenterTitle
                          }
                        >
                          No book logged
                        </Text>

                        <Text
                          style={
                            styles.orbitCenterDate
                          }
                        >
                          {getOrbitDayLabel(
                            selectedDateKey
                          )}
                        </Text>
                      </>
                    )
                  ) : (
                    <>
                      <Text
                        style={
                          styles.orbitCenterTitle
                        }
                      >
                        Reading in motion
                      </Text>

                      <Text
                        style={
                          styles.orbitCenterMeta
                        }
                      >
                        {monthData.daysRead} reading {monthData.daysRead === 1 ? 'day' : 'days'}
                      </Text>

                      <Text
                        style={
                          styles.orbitHint
                        }
                      >
                        TAP A DAY
                      </Text>
                    </>
                  )}
                </Pressable>

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
      maxWidth: '100%',
      alignSelf:
        'center',
      paddingHorizontal:
        20,
      paddingTop:
        18,
      paddingBottom:
        70,
    },
    contentCompact: {
      paddingTop:
        10,
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
    headerRowCompact: {
      minHeight:
        58,
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
    headingCompact: {
      fontSize:
        28,
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
    subheadingCompact: {
      fontSize:
        11,
      marginTop:
        2,
    },
    monthToolbar: {
      position:
        'relative',
      minHeight:
        38,
      marginTop:
        14,
      marginBottom:
        2,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    monthToolbarCompact: {
      marginTop:
        8,
      marginBottom:
        0,
    },
    monthNav: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        5,
    },
    monthButton: {
      width:
        30,
      height:
        30,
      borderRadius:
        15,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    monthButtonDisabled: {
      opacity:
        0.38,
    },
    monthTitle: {
      minWidth:
        148,
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        20,
      textAlign:
        'center',
    },
    personalizeIconButton: {
      position:
        'absolute',
      right:
        0,
      width:
        34,
      height:
        34,
      borderRadius:
        17,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    orbitHero: {
      marginBottom:
        26,
    },
    orbitHeroCompact: {
      marginBottom:
        12,
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
    orbitDayAnimatedSlot: {
      position:
        'absolute',
      alignItems:
        'center',
      justifyContent:
        'center',
      zIndex:
        6,
    },
    orbitDayTouch: {
      alignItems:
        'center',
      justifyContent:
        'center',
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
      paddingHorizontal:
        10,
    },
    orbitCenterEyebrowRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        4,
      marginBottom:
        5,
    },
    orbitCenterEyebrowDot: {
      width:
        4,
      height:
        4,
      borderRadius:
        2,
      backgroundColor:
        colors.gold,
    },
    orbitCenterEyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        7,
      letterSpacing:
        1,
    },
    orbitCenterCover: {
      borderRadius:
        6,
      backgroundColor:
        colors.elevated,
      marginBottom:
        6,
    },
    orbitCenterCoverPlaceholder: {
      borderRadius:
        6,
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom:
        6,
    },
    orbitCenterBookTitle: {
      maxWidth:
        '94%',
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        11.5,
      lineHeight:
        14,
      textAlign:
        'center',
    },
    orbitCenterAuthor: {
      maxWidth:
        '88%',
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        7.5,
      marginTop:
        2,
      textAlign:
        'center',
    },
    orbitCenterDate: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        8,
      marginTop:
        3,
      textAlign:
        'center',
    },
    orbitCenterTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        17,
      lineHeight:
        21,
      textAlign:
        'center',
    },
    orbitCenterMeta: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        9.5,
      marginTop:
        4,
      textAlign:
        'center',
    },
    orbitHint: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        7.5,
      letterSpacing:
        1.2,
      marginTop:
        8,
      textAlign:
        'center',
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
