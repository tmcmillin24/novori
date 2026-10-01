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
  View,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';

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

const WEEK_LABELS = [
  'M',
  'T',
  'W',
  'T',
  'F',
  'S',
  'S',
];

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

function getCalendarCells(
  year:
    number,
  monthIndex:
    number
) {
  const firstDay =
    new Date(
      year,
      monthIndex,
      1
    ).getDay();

  const mondayOffset =
    firstDay ===
      0
      ? 6
      : firstDay -
        1;

  const daysInMonth =
    new Date(
      year,
      monthIndex +
        1,
      0
    ).getDate();

  const cells:
    Array<
      number | null
    > =
    [];

  for (
    let index =
      0;
    index <
    mondayOffset;
    index +=
      1
  ) {
    cells.push(
      null
    );
  }

  for (
    let day =
      1;
    day <=
    daysInMonth;
    day +=
      1
  ) {
    cells.push(
      day
    );
  }

  while (
    cells.length %
      7 !==
    0
  ) {
    cells.push(
      null
    );
  }

  return cells;
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
    useState(
      todayKey
    );

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

          const next =
            await getReadingActivityMonth(
              displayedMonth.year,
              displayedMonth.monthIndex
            );

          setMonthData(
            next
          );

          const isCurrentMonth =
            displayedMonth.year ===
              now.getFullYear() &&
            displayedMonth.monthIndex ===
              now.getMonth();

          if (
            isCurrentMonth
          ) {
            setSelectedDateKey(
              todayKey
            );
          } else if (
            next.checkedDates.length >
            0
          ) {
            setSelectedDateKey(
              next.checkedDates[
                next.checkedDates.length -
                  1
              ]
            );
          } else {
            setSelectedDateKey(
              getDateKey(
                displayedMonth.year,
                displayedMonth.monthIndex,
                1
              )
            );
          }
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

  const calendarCells =
    useMemo(
      () =>
        getCalendarCells(
          displayedMonth.year,
          displayedMonth.monthIndex
        ),
      [
        displayedMonth.monthIndex,
        displayedMonth.year,
      ]
    );

  const monthlyBooks =
    useMemo(
      () => {
        if (
          !monthData
        ) {
          return [];
        }

        const seen =
          new Set<string>();

        const books:
          ReadingActivityBook[] =
          [];

        for (
          const day
          of Object.values(
            monthData.days
          )
        ) {
          for (
            const book
            of day.books
          ) {
            const identity =
              book.userBookId ??
              book.googleBookId ??
              book.title;

            if (
              seen.has(
                identity
              )
            ) {
              continue;
            }

            seen.add(
              identity
            );

            books.push(
              book
            );
          }
        }

        return books;
      },
      [
        monthData,
      ]
    );

  const selectedDay =
    monthData
      ?.days[
        selectedDateKey
      ] ??
    emptyDay(
      selectedDateKey
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

  const hasSelectedActivity =
    selectedDay.checkedIn ||
    selectedDay.books.length >
      0 ||
    selectedDay.readingUpdates.length >
      0 ||
    selectedDay.journeyEvents.length >
      0;

  return (
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
                styles.monthStory
              }
            >
              <View
                style={
                  styles.monthStoryAccent
                }
              />

              <View
                style={
                  styles.monthStoryHeader
                }
              >
                <Text
                  style={
                    styles.monthStoryEyebrow
                  }
                >
                  YOUR MONTH
                </Text>

                <View
                  style={
                    styles.monthStoryMark
                  }
                >
                  <Ionicons
                    name="bookmark-outline"
                    size={
                      16
                    }
                    color={
                      colors.gold
                    }
                  />
                </View>
              </View>

              <View
                style={
                  styles.monthStoryMain
                }
              >
                <View
                  style={
                    styles.monthStoryNumberWrap
                  }
                >
                  <Text
                    style={
                      styles.monthStoryNumber
                    }
                  >
                    {
                      monthData.daysRead
                    }
                  </Text>

                  <Text
                    style={
                      styles.monthStoryLabel
                    }
                  >
                    {monthData.daysRead ===
                    1
                      ? 'day with a book'
                      : 'days with a book'}
                  </Text>
                </View>

                <View
                  style={
                    styles.monthBookStack
                  }
                >
                  {monthlyBooks
                    .slice(
                      0,
                      4
                    )
                    .map(
                      (
                        book,
                        index
                      ) =>
                        book.coverUrl ? (
                          <ExpoImage
                            key={
                              book.userBookId ??
                              book.googleBookId ??
                              `${book.title}-${index}`
                            }
                            source={
                              book.coverUrl
                            }
                            style={[
                              styles.monthBookCover,
                              {
                                marginLeft:
                                  index ===
                                  0
                                    ? 0
                                    : -12,
                                zIndex:
                                  10 -
                                  index,
                              },
                            ]}
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
                            key={
                              book.userBookId ??
                              book.googleBookId ??
                              `${book.title}-${index}`
                            }
                            style={[
                              styles.monthBookCoverPlaceholder,
                              {
                                marginLeft:
                                  index ===
                                  0
                                    ? 0
                                    : -12,
                                zIndex:
                                  10 -
                                  index,
                              },
                            ]}
                          >
                            <Ionicons
                              name="book-outline"
                              size={
                                15
                              }
                              color={
                                colors.gold
                              }
                            />
                          </View>
                        )
                    )}

                  {monthlyBooks.length ===
                  0 ? (
                    <View
                      style={
                        styles.monthBookEmpty
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
                  ) : null}
                </View>
              </View>

              <Text
                style={
                  styles.monthStoryCopy
                }
              >
                {monthData.daysRead ===
                0
                  ? 'A fresh month. Your first reading day will light up here.'
                  : monthData.daysRead ===
                    1
                  ? 'One reading day is already part of this month’s story.'
                  : `${monthData.daysRead} reading days are already part of this month’s story.`}
              </Text>

              <View
                style={
                  styles.monthStoryStats
                }
              >
                <StoryStat
                  icon="flame-outline"
                  value={
                    monthData.bestStreak
                  }
                  label="best streak"
                  colors={
                    colors
                  }
                  styles={
                    styles
                  }
                />

                <View
                  style={
                    styles.monthStoryDivider
                  }
                />

                <StoryStat
                  icon="checkmark-circle-outline"
                  value={
                    monthData.booksFinished
                  }
                  label="finished"
                  colors={
                    colors
                  }
                  styles={
                    styles
                  }
                />

                <View
                  style={
                    styles.monthStoryDivider
                  }
                />

                <StoryStat
                  icon="create-outline"
                  value={
                    monthData.readingUpdates
                  }
                  label="updates"
                  colors={
                    colors
                  }
                  styles={
                    styles
                  }
                />
              </View>
            </View>

            <View
              style={
                styles.sectionIntro
              }
            >
              <View>
                <Text
                  style={
                    styles.sectionEyebrow
                  }
                >
                  YOUR READING RHYTHM
                </Text>

                <Text
                  style={
                    styles.sectionIntroTitle
                  }
                >
                  Every day tells a little more.
                </Text>
              </View>

              <Ionicons
                name="calendar-outline"
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
                styles.calendarCard
              }
            >
              <View
                style={
                  styles.weekLabels
                }
              >
                {WEEK_LABELS.map(
                  (
                    label,
                    index
                  ) => (
                    <Text
                      key={
                        `${label}-${index}`
                      }
                      style={
                        styles.weekLabel
                      }
                    >
                      {label}
                    </Text>
                  )
                )}
              </View>

              <View
                style={
                  styles.calendarGrid
                }
              >
                {calendarCells.map(
                  (
                    day,
                    index
                  ) => {
                    if (
                      day ===
                      null
                    ) {
                      return (
                        <View
                          key={
                            `empty-${index}`
                          }
                          style={
                            styles.dayCellWrap
                          }
                        />
                      );
                    }

                    const dateKey =
                      getDateKey(
                        displayedMonth.year,
                        displayedMonth.monthIndex,
                        day
                      );

                    const activity =
                      monthData.days[
                        dateKey
                      ];

                    const checked =
                      Boolean(
                        activity
                          ?.checkedIn
                      );

                    const selected =
                      dateKey ===
                      selectedDateKey;

                    const isToday =
                      dateKey ===
                      todayKey;

                    const hasOtherActivity =
                      Boolean(
                        activity &&
                        (
                          activity.readingUpdates.length >
                            0 ||
                          activity.journeyEvents.length >
                            0
                        )
                      );

                    return (
                      <View
                        key={
                          dateKey
                        }
                        style={
                          styles.dayCellWrap
                        }
                      >
                        <Pressable
                          onPress={() =>
                            setSelectedDateKey(
                              dateKey
                            )
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.dayCell,
                            (
                              selected ||
                              isToday
                            ) &&
                              styles.dayCellOutlined,
                            checked &&
                              styles.dayCellRead,
                            selected &&
                              checked &&
                              styles.dayCellReadSelected,
                            pressed &&
                              styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayNumber,
                              checked &&
                                styles.dayNumberRead,
                            ]}
                          >
                            {day}
                          </Text>

                          {!checked &&
                          hasOtherActivity ? (
                            <View
                              style={
                                styles.activityDot
                              }
                            />
                          ) : null}
                        </Pressable>
                      </View>
                    );
                  }
                )}
              </View>

              <View
                style={
                  styles.legendRow
                }
              >
                <View
                  style={
                    styles.legendItem
                  }
                >
                  <View
                    style={
                      styles.legendRead
                    }
                  />

                  <Text
                    style={
                      styles.legendText
                    }
                  >
                    Read
                  </Text>
                </View>

                <View
                  style={
                    styles.legendItem
                  }
                >
                  <View
                    style={
                      styles.legendToday
                    }
                  />

                  <Text
                    style={
                      styles.legendText
                    }
                  >
                    Today
                  </Text>
                </View>
              </View>
            </View>

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
                      ? selectedDay.checkinSource ===
                        'reading_update'
                        ? 'Reading Update check-in'
                        : 'Daily reading check-in'
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
                    Check-ins and Reading Updates will appear here as you read.
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

                  {selectedDay.readingUpdates.length >
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
                        READING UPDATES
                      </Text>

                      <View
                        style={
                          styles.updateList
                        }
                      >
                        {selectedDay.readingUpdates.map(
                          (
                            update
                          ) => (
                            <View
                              key={
                                update.id
                              }
                              style={
                                styles.updateCard
                              }
                            >
                              <View
                                style={
                                  styles.updateIcon
                                }
                              >
                                <Ionicons
                                  name="create-outline"
                                  size={
                                    16
                                  }
                                  color={
                                    colors.gold
                                  }
                                />
                              </View>

                              <View
                                style={
                                  styles.updateCopy
                                }
                              >
                                {update.book ? (
                                  <Text
                                    style={
                                      styles.updateBook
                                    }
                                    numberOfLines={
                                      1
                                    }
                                  >
                                    {
                                      update.book
                                        .title
                                    }
                                  </Text>
                                ) : null}

                                <Text
                                  style={
                                    styles.updateBody
                                  }
                                  numberOfLines={
                                    4
                                  }
                                >
                                  {
                                    update.body
                                  }
                                </Text>
                              </View>
                            </View>
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
      </ScrollView>
    </SafeAreaView>
  );
}

function StoryStat({
  icon,
  value,
  label,
  colors,
  styles,
}: {
  icon:
    keyof typeof Ionicons.glyphMap;
  value:
    number;
  label:
    string;
  colors:
    NovoriColors;
  styles:
    ReturnType<
      typeof createStyles
    >;
}) {
  return (
    <View
      style={
        styles.storyStat
      }
    >
      <View
        style={
          styles.storyStatTop
        }
      >
        <Ionicons
          name={
            icon
          }
          size={
            14
          }
          color={
            colors.gold
          }
        />

        <Text
          style={
            styles.storyStatValue
          }
        >
          {value}
        </Text>
      </View>

      <Text
        style={
          styles.storyStatLabel
        }
      >
        {label}
      </Text>
    </View>
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
    monthStory: {
      position:
        'relative',
      overflow:
        'hidden',
      backgroundColor:
        colors.surface,
      borderRadius:
        22,
      paddingHorizontal:
        17,
      paddingTop:
        16,
      paddingBottom:
        15,
      marginBottom:
        20,
    },
    monthStoryAccent: {
      position:
        'absolute',
      left:
        0,
      top:
        16,
      bottom:
        16,
      width:
        3,
      borderRadius:
        2,
      backgroundColor:
        colors.gold,
    },
    monthStoryHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },
    monthStoryEyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        9,
      letterSpacing:
        1.35,
    },
    monthStoryMark: {
      width:
        30,
      height:
        30,
      borderRadius:
        10,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    monthStoryMain: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap:
        16,
      marginTop:
        8,
    },
    monthStoryNumberWrap: {
      flex:
        1,
    },
    monthStoryNumber: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        48,
      lineHeight:
        52,
    },
    monthStoryLabel: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
      marginTop:
        -2,
    },
    monthBookStack: {
      minWidth:
        116,
      minHeight:
        78,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'flex-end',
      paddingLeft:
        12,
    },
    monthBookCover: {
      width:
        48,
      height:
        72,
      borderRadius:
        7,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.elevated,
    },
    monthBookCoverPlaceholder: {
      width:
        48,
      height:
        72,
      borderRadius:
        7,
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
    monthBookEmpty: {
      width:
        72,
      height:
        72,
      borderRadius:
        22,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    monthStoryCopy: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11.5,
      lineHeight:
        17,
      marginTop:
        10,
      paddingRight:
        10,
    },
    monthStoryStats: {
      flexDirection:
        'row',
      alignItems:
        'stretch',
      marginTop:
        15,
      paddingTop:
        13,
      borderTopWidth:
        1,
      borderTopColor:
        colors.border,
    },
    storyStat: {
      flex:
        1,
      minWidth:
        0,
    },
    storyStatTop: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        5,
    },
    storyStatValue: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        14,
    },
    storyStatLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        9.5,
      marginTop:
        3,
    },
    monthStoryDivider: {
      width:
        1,
      marginHorizontal:
        12,
      backgroundColor:
        colors.border,
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
        22,
    },

    calendarCard: {
      backgroundColor:
        colors.surface,
      borderRadius:
        20,
      paddingHorizontal:
        12,
      paddingTop:
        16,
      paddingBottom:
        13,
      borderTopWidth:
        2,
      borderTopColor:
        colors.gold,
    },
    weekLabels: {
      flexDirection:
        'row',
      marginBottom:
        8,
    },
    weekLabel: {
      width:
        '14.2857%',
      textAlign:
        'center',
      color:
        colors.mutedText,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        9,
    },
    calendarGrid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
    },
    dayCellWrap: {
      width:
        '14.2857%',
      aspectRatio:
        1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    dayCell: {
      width:
        36,
      height:
        36,
      borderRadius:
        18,
      borderWidth:
        1,
      borderColor:
        'transparent',
      alignItems:
        'center',
      justifyContent:
        'center',
      position:
        'relative',
    },
    dayCellOutlined: {
      borderColor:
        colors.gold,
    },
    dayCellRead: {
      backgroundColor:
        colors.gold,
      borderColor:
        colors.gold,
    },
    dayCellReadSelected: {
      borderWidth:
        2,
      borderColor:
        colors.text,
    },
    dayNumber: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
    },
    dayNumberRead: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
    },
    activityDot: {
      position:
        'absolute',
      bottom:
        4,
      width:
        4,
      height:
        4,
      borderRadius:
        2,
      backgroundColor:
        colors.gold,
    },
    legendRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        18,
      marginTop:
        9,
    },
    legendItem: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        6,
    },
    legendRead: {
      width:
        10,
      height:
        10,
      borderRadius:
        5,
      backgroundColor:
        colors.gold,
    },
    legendToday: {
      width:
        10,
      height:
        10,
      borderRadius:
        5,
      borderWidth:
        1,
      borderColor:
        colors.gold,
    },
    legendText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        9.5,
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
    updateList: {
      gap:
        7,
    },
    updateCard: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
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
    updateIcon: {
      width:
        30,
      height:
        30,
      borderRadius:
        10,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    updateCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    updateBook: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        10.5,
      marginBottom:
        3,
    },
    updateBody: {
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11.5,
      lineHeight:
        16,
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
