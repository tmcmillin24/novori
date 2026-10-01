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

const COMPACT_ORBIT_MAX =
  276;

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
  } =
    useWindowDimensions();

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

  const compactOrbitSize =
    Math.min(
      fullOrbitSize *
        0.74,
      COMPACT_ORBIT_MAX
    );

  const activeOrbitSize =
    selectedDateKey
      ? compactOrbitSize
      : fullOrbitSize;

  const orbitCenter =
    activeOrbitSize /
    2;

  const dayMarkerSize =
    selectedDateKey
      ? 20
      : 24;

  const dayTouchSize =
    selectedDateKey
      ? 28
      : 32;

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
                22
              }
              color={
                colors.gold
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
                  styles.orbitTopRow
                }
              >
                <View>
                  <Text
                    style={
                      styles.orbitEyebrow
                    }
                  >
                    YOUR MONTH
                  </Text>

                  <Text
                    style={
                      styles.orbitTitle
                    }
                  >
                    Reading in motion
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
                      15
                    }
                    color={
                      colors.gold
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
                  styles.orbitDivider
                }
              />

              <View
                style={[
                  styles.charmScatter,
                  styles.charmScatterTop,
                ]}
              >
                {personalization.charms
                  .slice(
                    0,
                    4
                  )
                  .map(
                    (
                      charm,
                      index
                    ) => (
                      <View
                        key={
                          charm
                        }
                        style={[
                          styles.charmScatterItem,
                          {
                            transform: [
                              {
                                rotate:
                                  CHARM_ROTATIONS[
                                    index
                                  ],
                              },
                              {
                                translateY:
                                  index % 2 ===
                                  0
                                    ? 3
                                    : -3,
                              },
                            ],
                          },
                        ]}
                      >
                        <ReadingMonthCharmArtwork
                          charm={
                            charm
                          }
                          size={
                            index % 3 ===
                            0
                              ? 58
                              : 54
                          }
                        />
                      </View>
                    )
                  )}
              </View>

              <View
                style={[
                  styles.orbitStage,
                  {
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
                          setSelectedDateKey(
                            (
                              current
                            ) =>
                              current ===
                              dot.dateKey
                                ? null
                                : dot.dateKey
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
                              selectedDateKey &&
                                styles.orbitDayNumberCompact,
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

              {personalization.charms.length >
              4 ? (
                <View
                  style={[
                    styles.charmScatter,
                    styles.charmScatterBottom,
                  ]}
                >
                  {personalization.charms
                    .slice(
                      4,
                      8
                    )
                    .map(
                      (
                        charm,
                        index
                      ) => (
                        <View
                          key={
                            charm
                          }
                          style={[
                            styles.charmScatterItem,
                            {
                              transform: [
                                {
                                  rotate:
                                    CHARM_ROTATIONS[
                                      index +
                                      4
                                    ],
                                },
                                {
                                  translateY:
                                    index % 2 ===
                                    0
                                      ? -2
                                      : 4,
                                },
                              ],
                            },
                          ]}
                        >
                          <ReadingMonthCharmArtwork
                            charm={
                              charm
                            }
                            size={
                              index % 3 ===
                              0
                                ? 58
                                : 54
                            }
                          />
                        </View>
                      )
                    )}
                </View>
              ) : null}

              <Pressable
                disabled
                accessibilityRole="button"
                accessibilityState={{
                  disabled:
                    true,
                }}
                style={
                  styles.monthlyRecapButton
                }
              >
                <View
                  style={
                    styles.monthlyRecapIcon
                  }
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={
                      18
                    }
                    color={
                      colors.gold
                    }
                  />
                </View>

                <View
                  style={
                    styles.monthlyRecapCopy
                  }
                >
                  <Text
                    style={
                      styles.monthlyRecapTitle
                    }
                  >
                    View Monthly Recap
                  </Text>

                  <Text
                    style={
                      styles.monthlyRecapSubtitle
                    }
                  >
                    Your month, wrapped up in one place.
                  </Text>
                </View>

                <View
                  style={
                    styles.monthlyRecapSoon
                  }
                >
                  <Text
                    style={
                      styles.monthlyRecapSoonText
                    }
                  >
                    Soon
                  </Text>
                </View>
              </Pressable>
            </View>

            {selectedDateKey &&
            selectedDay ? (
              <>
            <View
              style={[
                styles.sectionIntro,
                styles.daySectionIntro,
              ]}
            >
              <View>
                <Text
                  style={
                    styles.sectionEyebrow
                  }
                >
                  ON THIS DAY
                </Text>

                <Text
                  style={
                    styles.sectionIntroTitle
                  }
                >
                  Your reading, remembered.
                </Text>
              </View>

              <Ionicons
                name="sparkles-outline"
                size={
                  18
                }
                color={
                  colors.gold
                }
              />
            </View>

            <View
              style={
                styles.dayDetailCard
              }
            >
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
                      ? 'Reading day'
                      : hasSelectedActivity
                      ? 'Reading activity'
                      : 'No reading logged'}
                  </Text>
                </View>

                {selectedDay.checkedIn ? (
                  <View
                    style={
                      styles.readBadge
                    }
                  >
                    <Ionicons
                      name="checkmark"
                      size={
                        13
                      }
                      color={
                        colors.background
                      }
                    />

                    <Text
                      style={
                        styles.readBadgeText
                      }
                    >
                      Read
                    </Text>
                  </View>
                ) : null}
              </View>

              {!hasSelectedActivity ? (
                <View
                  style={
                    styles.emptyDay
                  }
                >
                  <View
                    style={
                      styles.emptyDayIcon
                    }
                  >
                    <Ionicons
                      name="book-outline"
                      size={
                        22
                      }
                      color={
                        colors.gold
                      }
                    />
                  </View>

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
                    Reading days, books, and journey milestones will appear here.
                  </Text>
                </View>
              ) : (
                <>
                  {selectedDay.books.length >
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
                        {selectedDay.books.map(
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
                        JOURNEY MILESTONES
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
                                      ? 'checkmark-circle-outline'
                                      : 'flag-outline'
                                  }
                                  size={
                                    18
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

              </>
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
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        12,
    },
    backButton: {
      width:
        42,
      height:
        42,
      borderRadius:
        13,
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
    headerCopy: {
      flex:
        1,
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
    },
    subheading: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      marginTop:
        2,
    },
    monthHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginTop:
        24,
      marginBottom:
        14,
      paddingHorizontal:
        2,
    },
    monthButton: {
      width:
        38,
      height:
        38,
      borderRadius:
        12,
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
    orbitTopRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-end',
      justifyContent:
        'space-between',
      gap:
        12,
      paddingHorizontal:
        2,
      marginBottom:
        4,
    },
    orbitDivider: {
      height:
        1,
      width:
        '100%',
      backgroundColor:
        colors.gold,
      opacity:
        0.58,
      marginTop:
        12,
      marginBottom:
        5,
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
        22,
      marginTop:
        2,
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
        10,
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    personalizeButtonText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        9.5,
    },
    orbitStage: {
      alignSelf:
        'center',
      position:
        'relative',
      marginTop:
        18,
      marginBottom:
        6,
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
    orbitDayNumberCompact: {
      fontSize:
        7.5,
      lineHeight:
        9,
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
    charmScatter: {
      width:
        '100%',
      minHeight:
        68,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-around',
      paddingHorizontal:
        6,
    },
    charmScatterTop: {
      marginTop:
        8,
      marginBottom:
        2,
    },
    charmScatterBottom: {
      marginTop:
        2,
      marginBottom:
        5,
    },
    charmScatterItem: {
      width:
        64,
      height:
        64,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    monthlyRecapButton: {
      minHeight:
        62,
      marginTop:
        12,
      borderRadius:
        17,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        11,
      paddingHorizontal:
        13,
      opacity:
        0.88,
    },
    monthlyRecapIcon: {
      width:
        38,
      height:
        38,
      borderRadius:
        12,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    monthlyRecapCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    monthlyRecapTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        11.5,
    },
    monthlyRecapSubtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        9.5,
      marginTop:
        2,
    },
    monthlyRecapSoon: {
      borderRadius:
        999,
      borderWidth:
        1,
      borderColor:
        colors.gold,
      paddingHorizontal:
        8,
      paddingVertical:
        4,
    },
    monthlyRecapSoonText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        8,
      letterSpacing:
        0.4,
      textTransform:
        'uppercase',
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
    daySectionIntro: {
      marginTop:
        30,
    },

    dayDetailCard: {
      backgroundColor:
        colors.surface,
      borderRadius:
        20,
      padding:
        15,
      borderLeftWidth:
        2,
      borderLeftColor:
        colors.gold,
    },
    dayDetailHeader: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
      gap:
        10,
    },
    dayDetailCopy: {
      flex:
        1,
    },
    dayDetailTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        19,
    },
    dayDetailSubtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      marginTop:
        2,
    },
    readBadge: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        4,
      backgroundColor:
        colors.gold,
      paddingHorizontal:
        9,
      paddingVertical:
        5,
      borderRadius:
        999,
    },
    readBadgeText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        9,
    },
    detailSection: {
      marginTop:
        17,
    },
    detailLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        9,
      letterSpacing:
        1,
      marginBottom:
        7,
    },
    bookList: {
      gap:
        7,
    },
    bookRow: {
      minHeight:
        70,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        10,
      backgroundColor:
        colors.background,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        14,
      padding:
        8,
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
        7,
    },
    milestoneRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        9,
      padding:
        10,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        13,
      backgroundColor:
        colors.background,
    },
    milestoneIcon: {
      width:
        31,
      height:
        31,
      borderRadius:
        10,
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
      alignItems:
        'center',
      paddingVertical:
        23,
      paddingHorizontal:
        10,
    },
    emptyDayIcon: {
      width:
        42,
      height:
        42,
      borderRadius:
        14,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom:
        9,
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
      textAlign:
        'center',
      marginTop:
        4,
      maxWidth:
        250,
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
