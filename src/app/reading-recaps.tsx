import BookCoverImage from '../components/BookCoverImage';
import YearInReading from '../components/YearInReading';
import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useRouter,
  useLocalSearchParams,
} from 'expo-router';
import {
  useCallback,
  useEffect,
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
  getReadingRecapJourneyData,
  ReadingRecapJourneyData,
  ReadingRecapJourneyEvent,
} from '../lib/reading-recaps';
import { parseRecapReferenceDate } from '../lib/reading-reminders';

type RecapMode =
  | 'week'
  | 'month'
  | 'year';

type RecapBook = {
  identity:
    string;
  book:
    ReadingActivityBook;
  dates:
    string[];
};

type StoryItem = {
  id:
    string;
  dateKey:
    string;
  icon:
    keyof typeof Ionicons.glyphMap;
  title:
    string;
  subtitle:
    string | null;
};

function pad(
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

function dateKey(
  date:
    Date
) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromKey(
  key:
    string
) {
  const [
    year,
    month,
    day,
  ] =
    key
      .split('-')
      .map(Number);

  return new Date(
    year,
    month - 1,
    day,
    12
  );
}

function localDateKeyFromIso(
  value:
    string
) {
  return dateKey(
    new Date(
      value
    )
  );
}

function getWeekStart(
  reference:
    Date
) {
  const day =
    reference.getDay();

  const offset =
    day ===
      0
      ? -6
      : 1 - day;

  return new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate() +
      offset,
    0,
    0,
    0,
    0
  );
}

function getPeriodBounds(
  mode:
    RecapMode,
  reference:
    Date
) {
  if (
    mode ===
    'month'
  ) {
    return {
      start:
        new Date(
          reference.getFullYear(),
          reference.getMonth(),
          1,
          0,
          0,
          0,
          0
        ),
      endExclusive:
        new Date(
          reference.getFullYear(),
          reference.getMonth() +
            1,
          1,
          0,
          0,
          0,
          0
        ),
    };
  }

  const start =
    getWeekStart(
      reference
    );

  return {
    start,
    endExclusive:
      new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() +
          7,
        0,
        0,
        0,
        0
      ),
  };
}

function getPeriodKeys(
  mode:
    RecapMode,
  reference:
    Date
) {
  const {
    start,
    endExclusive,
  } =
    getPeriodBounds(
      mode,
      reference
    );

  const keys:
    string[] =
    [];

  for (
    let current =
      new Date(
        start
      );
    current <
    endExclusive;
    current =
      new Date(
        current.getFullYear(),
        current.getMonth(),
        current.getDate() +
          1,
        12
      )
  ) {
    keys.push(
      dateKey(
        current
      )
    );
  }

  return keys;
}

function getPeriodLabel(
  mode:
    RecapMode,
  reference:
    Date
) {
  if (
    mode ===
    'month'
  ) {
    return reference.toLocaleDateString(
      undefined,
      {
        month:
          'long',
        year:
          'numeric',
      }
    );
  }

  const keys =
    getPeriodKeys(
      mode,
      reference
    );

  const start =
    dateFromKey(
      keys[0]
    );

  const end =
    dateFromKey(
      keys[
        keys.length -
          1
      ]
    );

  const sameMonth =
    start.getMonth() ===
      end.getMonth() &&
    start.getFullYear() ===
      end.getFullYear();

  if (
    sameMonth
  ) {
    return `${start.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })} – ${end.toLocaleDateString(undefined, {
      day: 'numeric',
      year: 'numeric',
    })}`;
  }

  return `${start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}

function getRequiredMonths(
  keys:
    string[]
) {
  const unique =
    new Map<
      string,
      {
        year:
          number;
        monthIndex:
          number;
      }
    >();

  for (
    const key
    of keys
  ) {
    const date =
      dateFromKey(
        key
      );

    const id =
      `${date.getFullYear()}-${date.getMonth()}`;

    unique.set(
      id,
      {
        year:
          date.getFullYear(),
        monthIndex:
          date.getMonth(),
      }
    );
  }

  return Array.from(
    unique.values()
  );
}

function bookIdentity(
  book:
    ReadingActivityBook
) {
  return (
    book.userBookId ??
    book.googleBookId ??
    `${book.title}:${book.authors.join('|')}`
  );
}

function getBestStreak(
  keys:
    string[]
) {
  const sorted =
    Array.from(
      new Set(
        keys
      )
    ).sort();

  let best =
    0;
  let bestEndKey:
    string | null =
    null;
  let current =
    0;
  let previous:
    number | null =
    null;

  for (
    const key
    of sorted
  ) {
    const time =
      dateFromKey(
        key
      ).getTime();

    if (
      previous !==
        null &&
      time -
        previous ===
        86400000
    ) {
      current +=
        1;
    } else {
      current =
        1;
    }

    if (
      current >
      best
    ) {
      best =
        current;
      bestEndKey =
        key;
    }

    previous =
      time;
  }

  return {
    length:
      best,
    endKey:
      bestEndKey,
  };
}

function buildBooksInMotion(
  dayMap:
    Record<
      string,
      ReadingActivityDay
    >,
  periodKeys:
    string[],
  journeyEvents:
    ReadingRecapJourneyEvent[]
) {
  const books =
    new Map<
      string,
      RecapBook
    >();

  function addBook(
    book:
      ReadingActivityBook,
    key:
      string
  ) {
    const identity =
      bookIdentity(
        book
      );

    const existing =
      books.get(
        identity
      );

    if (
      existing
    ) {
      if (
        !existing.dates.includes(
          key
        )
      ) {
        existing.dates.push(
          key
        );
      }

      return;
    }

    books.set(
      identity,
      {
        identity,
        book,
        dates:
          [
            key,
          ],
      }
    );
  }

  for (
    const key
    of periodKeys
  ) {
    const day =
      dayMap[
        key
      ];

    if (
      !day
    ) {
      continue;
    }

    for (
      const book
      of day.books
    ) {
      addBook(
        book,
        key
      );
    }
  }

  for (
    const event
    of journeyEvents
  ) {
    addBook(
      event.book,
      localDateKeyFromIso(
        event.occurredAt
      )
    );
  }

  return Array.from(
    books.values()
  )
    .map(
      (
        item
      ) => ({
        ...item,
        dates:
          item.dates.sort(),
      })
    )
    .sort(
      (
        a,
        b
      ) =>
        a.dates[0].localeCompare(
          b.dates[0]
        )
    );
}

function getLoggedPageMovement(
  dayMap:
    Record<
      string,
      ReadingActivityDay
    >,
  periodKeys:
    string[]
) {
  const pageUpdates =
    new Map<
      string,
      {
        page:
          number;
        createdAt:
          string;
      }[]
    >();

  for (
    const key
    of periodKeys
  ) {
    const day =
      dayMap[
        key
      ];

    if (
      !day
    ) {
      continue;
    }

    for (
      const update
      of day.readingUpdates
    ) {
      if (
        !update.book
      ) {
        continue;
      }

      const firstLine =
        update.body
          .split(
            '\n'
          )[0] ??
        '';

      const match =
        firstLine.match(
          /(?:^|·\s*)Page\s+(\d+)(?:\s*·|$)/i
        );

      if (
        !match
      ) {
        continue;
      }

      const page =
        Number(
          match[1]
        );

      if (
        !Number.isInteger(
          page
        ) ||
        page <
          1
      ) {
        continue;
      }

      const identity =
        bookIdentity(
          update.book
        );

      const current =
        pageUpdates.get(
          identity
        ) ??
        [];

      current.push({
        page,
        createdAt:
          update.createdAt,
      });

      pageUpdates.set(
        identity,
        current
      );
    }
  }

  let total =
    0;

  for (
    const updates
    of pageUpdates.values()
  ) {
    updates.sort(
      (
        a,
        b
      ) =>
        new Date(
          a.createdAt
        ).getTime() -
        new Date(
          b.createdAt
        ).getTime()
    );

    for (
      let index =
        1;
      index <
      updates.length;
      index +=
        1
    ) {
      const delta =
        updates[
          index
        ].page -
        updates[
          index -
            1
        ].page;

      if (
        delta >
        0
      ) {
        total +=
          delta;
      }
    }
  }

  return total;
}

function formatStoryDate(
  key:
    string
) {
  return dateFromKey(
    key
  ).toLocaleDateString(
    undefined,
    {
      month:
        'short',
      day:
        'numeric',
    }
  );
}

function getStoryTitle(
  mode:
    RecapMode,
  reference:
    Date
) {
  if (
    mode ===
    'week'
  ) {
    return 'This Week’s Story';
  }

  return `${reference.toLocaleDateString(
    undefined,
    {
      month:
        'long',
    }
  )}’s Story`;
}

function getContinuingSubtitle(
  mode:
    RecapMode,
  reference:
    Date
) {
  if (
    mode ===
    'week'
  ) {
    return 'Continuing beyond this week';
  }

  const nextMonth =
    new Date(
      reference.getFullYear(),
      reference.getMonth() +
        1,
      1
    ).toLocaleDateString(
      undefined,
      {
        month:
          'long',
      }
    );

  return `Continuing into ${nextMonth}`;
}

export default function ReadingRecapsScreen() {
  const params = useLocalSearchParams<{ mode?: string; referenceDate?: string }>();
  const router =
    useRouter();

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const [
    mode,
    setMode,
  ] =
    useState<RecapMode>(
      params.mode === 'year' ? 'year' : params.mode === 'week' ? 'week' : 'month'
    );

  const [yearRefreshRevision, setYearRefreshRevision] = useState(0);

  const [
    referenceDate,
    setReferenceDate,
  ] =
    useState(
      () =>
        parseRecapReferenceDate(params.referenceDate) ?? new Date()
    );

  useEffect(() => {
    const requestedDate = parseRecapReferenceDate(params.referenceDate);
    if (!requestedDate) return;
    setMode(params.mode === 'year' ? 'year' : params.mode === 'week' ? 'week' : 'month');
    setReferenceDate(requestedDate);
  }, [params.mode, params.referenceDate]);

  const [
    months,
    setMonths,
  ] =
    useState<
      ReadingActivityMonth[]
    >(
      []
    );

  const [
    journeyData,
    setJourneyData,
  ] =
    useState<
      ReadingRecapJourneyData
    >({
      events:
        [],
      continuing:
        [],
    });

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
    useState<
      string | null
    >(
      null
    );

  const periodKeys =
    useMemo(
      () =>
        mode === 'year' ? [] : getPeriodKeys(
          mode,
          referenceDate
        ),
      [
        mode,
        referenceDate,
      ]
    );

  const loadRecap =
    useCallback(
      async (
        isRefresh =
          false
      ) => {
        // The annual summary has its own single read; never fetch twelve months.
        if (mode === 'year') return;
        if (
          isRefresh
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
          null
        );

        try {
          const required =
            getRequiredMonths(
              getPeriodKeys(
                mode,
                referenceDate
              )
            );

          const {
            start,
            endExclusive,
          } =
            getPeriodBounds(
              mode,
              referenceDate
            );

          const [
            loadedMonths,
            loadedJourneyData,
          ] =
            await Promise.all([
              Promise.all(
                required.map(
                  (
                    item
                  ) =>
                    getReadingActivityMonth(
                      item.year,
                      item.monthIndex
                    )
                )
              ),
              getReadingRecapJourneyData(
                start,
                endExclusive
              ),
            ]);

          setMonths(
            loadedMonths
          );

          setJourneyData(
            loadedJourneyData
          );
        } catch (
          loadError
        ) {
          console.error(
            'Could not load reading recap:',
            loadError
          );

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : 'Could not load this recap.'
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
        mode,
        referenceDate,
      ]
    );

  useEffect(
    () => {
      void loadRecap();
    },
    [
      loadRecap,
    ]
  );

  const dayMap =
    useMemo(
      () => {
        const merged:
          Record<
            string,
            ReadingActivityDay
          > =
          {};

        for (
          const month
          of months
        ) {
          Object.assign(
            merged,
            month.days
          );
        }

        return merged;
      },
      [
        months,
      ]
    );

  const checkedKeys =
    useMemo(
      () =>
        periodKeys.filter(
          (
            key
          ) =>
            Boolean(
              dayMap[
                key
              ]?.checkedIn
            )
        ),
      [
        dayMap,
        periodKeys,
      ]
    );

  const streak =
    useMemo(
      () =>
        getBestStreak(
          checkedKeys
        ),
      [
        checkedKeys,
      ]
    );

  const booksInMotion =
    useMemo(
      () =>
        buildBooksInMotion(
          dayMap,
          periodKeys,
          journeyData.events
        ),
      [
        dayMap,
        periodKeys,
        journeyData.events,
      ]
    );

  const pagesLogged =
    useMemo(
      () =>
        getLoggedPageMovement(
          dayMap,
          periodKeys
        ),
      [
        dayMap,
        periodKeys,
      ]
    );

  const finishedEvents =
    useMemo(
      () =>
        journeyData.events.filter(
          (
            event
          ) =>
            event.type ===
            'finished'
        ),
      [
        journeyData.events,
      ]
    );

  const booksInMotionIds =
    useMemo(
      () =>
        new Set(
          booksInMotion.map(
            (
              item
            ) =>
              item.identity
          )
        ),
      [
        booksInMotion,
      ]
    );

  const continuingJourneys =
    useMemo(
      () =>
        journeyData.continuing.filter(
          (
            journey
          ) =>
            booksInMotionIds.has(
              bookIdentity(
                journey.book
              )
            )
        ),
      [
        booksInMotionIds,
        journeyData.continuing,
      ]
    );

  const storyItems =
    useMemo(
      () => {
        const items:
          StoryItem[] =
          journeyData.events.map(
            (
              event
            ) => ({
              id:
                event.id,
              dateKey:
                localDateKeyFromIso(
                  event.occurredAt
                ),
              icon:
                event.type ===
                'started'
                  ? 'book-outline'
                  : 'checkmark-circle-outline',
              title:
                event.type ===
                'started'
                  ? `Started ${event.book.title}`
                  : `Finished ${event.book.title}`,
              subtitle:
                event.book.authors.length >
                0
                  ? event.book.authors.join(
                      ', '
                    )
                  : null,
            })
          );

        if (
          streak.length >=
            2 &&
          streak.endKey
        ) {
          items.push({
            id:
              `streak-${streak.endKey}`,
            dateKey:
              streak.endKey,
            icon:
              'flame-outline',
            title:
              `${streak.length}-day reading streak`,
            subtitle:
              mode ===
              'month'
                ? 'Longest streak this month'
                : 'Longest streak this week',
          });
        }

        return items.sort(
          (
            a,
            b
          ) =>
            a.dateKey.localeCompare(
              b.dateKey
            )
        );
      },
      [
        journeyData.events,
        mode,
        streak.endKey,
        streak.length,
      ]
    );

  const heroBooks =
    booksInMotion.slice(
      0,
      5
    );

  function movePeriod(
    amount:
      number
  ) {
    setReferenceDate(
      (
        current
      ) => {
        if (
          mode ===
          'month'
        ) {
          return new Date(
            current.getFullYear(),
            current.getMonth() +
              amount,
            1,
            12
          );
        }

        return new Date(
          current.getFullYear(),
          current.getMonth(),
          current.getDate() +
            amount *
              7,
          12
        );
      }
    );
  }

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          style={({
            pressed,
          }) => [
            styles.headerButton,
            pressed &&
              styles.pressed,
          ]}
          hitSlop={
            8
          }
        >
          <Ionicons
            name="chevron-back"
            size={
              24
            }
            color={
              colors.text
            }
          />
        </Pressable>

        <Text
          style={
            styles.headerTitle
          }
        >
          {mode === 'year' ? 'Year in Reading' : 'Reading Recap'}
        </Text>

        <View
          style={
            styles.headerButton
          }
        />
      </View>

      <ScrollView
        style={
          styles.scroll
        }
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() => {
              if (mode === 'year') { setRefreshing(true); setYearRefreshRevision(value => value + 1); }
              else void loadRecap(true);
            }}
            tintColor={
              colors.gold
            }
          />
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.modeSwitch
          }
        >
          {(
            [
              'week',
              'month',
              'year',
            ] as
              RecapMode[]
          ).map(
            (
              item
            ) => (
              <Pressable
                key={
                  item
                }
                onPress={() =>
                  setMode(
                    item
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={`${item === 'year' ? 'Year in Reading' : item === 'week' ? 'Weekly recap' : 'Monthly recap'}`}
                accessibilityState={{ selected: mode === item }}
                style={[
                  styles.modeButton,
                  mode ===
                    item &&
                    styles.modeButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.modeButtonText,
                    mode ===
                      item &&
                      styles.modeButtonTextActive,
                  ]}
                >
                  {item ===
                  'week'
                    ? 'Week'
                    : item === 'month' ? 'Month' : 'Year'}
                </Text>
              </Pressable>
            )
          )}
        </View>

        {mode !== 'year' ? <View
          style={
            styles.periodNav
          }
        >
          <Pressable
            onPress={() =>
              movePeriod(
                -1
              )
            }
            style={({
              pressed,
            }) => [
              styles.periodArrow,
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
                colors.secondaryText
              }
            />
          </Pressable>

          <Text
            style={
              styles.periodLabel
            }
          >
            {
              getPeriodLabel(
                mode,
                referenceDate
              )
            }
          </Text>

          <Pressable
            onPress={() =>
              movePeriod(
                1
              )
            }
            style={({
              pressed,
            }) => [
              styles.periodArrow,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="chevron-forward"
              size={
                20
              }
              color={
                colors.secondaryText
              }
            />
          </Pressable>
        </View> : null}

        {mode === 'year' ? <YearInReading year={Math.min(new Date().getFullYear(), referenceDate.getFullYear())}
          onYearChange={year => setReferenceDate(new Date(year, 0, 1, 12))}
          onOpenMonth={monthIndex => { setReferenceDate(new Date(Math.min(new Date().getFullYear(), referenceDate.getFullYear()), monthIndex, 1, 12)); setMode('month'); }}
          refreshRevision={yearRefreshRevision} onRefreshComplete={() => setRefreshing(false)} /> : loading ? (
          <View
            style={
              styles.loadingState
            }
          >
            <ActivityIndicator
              color={
                colors.gold
              }
            />
          </View>
        ) : error ? (
          <View
            style={
              styles.errorState
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={
                24
              }
              color={
                colors.gold
              }
            />

            <Text
              style={
                styles.errorTitle
              }
            >
              Recap unavailable
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
                void loadRecap()
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
                  styles.retryButtonText
                }
              >
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View
              style={
                styles.hero
              }
            >
              <Text
                style={
                  styles.heroEyebrow
                }
              >
                {mode ===
                'month'
                  ? `YOUR ${referenceDate.toLocaleDateString(undefined, {
                      month: 'long',
                    }).toUpperCase()} IN MOTION`
                  : 'YOUR WEEK IN MOTION'}
              </Text>

              {heroBooks.length >
              0 ? (
                <View
                  style={
                    styles.coverFan
                  }
                >
                  {heroBooks.map(
                    (
                      item,
                      index
                    ) => (
                      <View
                        key={
                          item.identity
                        }
                        style={[
                          styles.heroCoverWrap,
                          index >
                            0 &&
                            styles.heroCoverOverlap,
                        ]}
                      >
                        {(item.book.googleBookId || item.book.coverUrl) ? (
                          <BookCoverImage
                            googleBookId={item.book.googleBookId}
                            existingCoverUrl={item.book.coverUrl}
                            style={
                              styles.heroCover
                            }
                          />
                        ) : (
                          <View
                            style={
                              styles.heroCoverFallback
                            }
                          >
                            <Ionicons
                              name="book-outline"
                              size={
                                24
                              }
                              color={
                                colors.mutedText
                              }
                            />
                          </View>
                        )}
                      </View>
                    )
                  )}
                </View>
              ) : null}

              <Text
                style={
                  styles.heroNumber
                }
              >
                {
                  checkedKeys.length
                }
              </Text>

              <Text
                style={
                  styles.heroMetric
                }
              >
                {checkedKeys.length ===
                1
                  ? 'reading day'
                  : 'reading days'}
              </Text>

              <Text
                style={
                  styles.heroSummary
                }
              >
                {booksInMotion.length}{' '}
                {booksInMotion.length ===
                1
                  ? 'book'
                  : 'books'}{' '}
                in motion
                {finishedEvents.length >
                0
                  ? ` · ${finishedEvents.length} finished`
                  : ''}
              </Text>

              {(streak.length >
                1 ||
                pagesLogged >
                  0) ? (
                <View
                  style={
                    styles.supportingStats
                  }
                >
                  {streak.length >
                  1 ? (
                    <View
                      style={
                        styles.supportingStat
                      }
                    >
                      <Ionicons
                        name="flame-outline"
                        size={
                          14
                        }
                        color={
                          colors.gold
                        }
                      />

                      <Text
                        style={
                          styles.supportingStatText
                        }
                      >
                        {
                          streak.length
                        }-day best streak
                      </Text>
                    </View>
                  ) : null}

                  {pagesLogged >
                  0 ? (
                    <View
                      style={
                        styles.supportingStat
                      }
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={
                          14
                        }
                        color={
                          colors.gold
                        }
                      />

                      <Text
                        style={
                          styles.supportingStatText
                        }
                      >
                        {
                          pagesLogged.toLocaleString()
                        } pages logged
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View
              style={
                styles.section
              }
            >
              <Text
                style={
                  styles.sectionEyebrow
                }
              >
                THE STORY
              </Text>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                {
                  getStoryTitle(
                    mode,
                    referenceDate
                  )
                }
              </Text>

              {storyItems.length ===
              0 ? (
                <View
                  style={
                    styles.emptyStory
                  }
                >
                  <Text
                    style={
                      styles.emptyStoryText
                    }
                  >
                    Check-ins and
                    reading milestones
                    from this period
                    will build your
                    story here.
                  </Text>
                </View>
              ) : (
                <View
                  style={
                    styles.timeline
                  }
                >
                  {storyItems.map(
                    (
                      item,
                      index
                    ) => (
                      <View
                        key={
                          item.id
                        }
                        style={
                          styles.timelineItem
                        }
                      >
                        <View
                          style={
                            styles.timelineRail
                          }
                        >
                          <View
                            style={
                              styles.timelineIcon
                            }
                          >
                            <Ionicons
                              name={
                                item.icon
                              }
                              size={
                                15
                              }
                              color={
                                colors.gold
                              }
                            />
                          </View>

                          {index <
                          storyItems.length -
                            1 ? (
                            <View
                              style={
                                styles.timelineLine
                              }
                            />
                          ) : null}
                        </View>

                        <View
                          style={
                            styles.timelineCopy
                          }
                        >
                          <Text
                            style={
                              styles.timelineDate
                            }
                          >
                            {
                              formatStoryDate(
                                item.dateKey
                              )
                            }
                          </Text>

                          <Text
                            style={
                              styles.timelineTitle
                            }
                          >
                            {
                              item.title
                            }
                          </Text>

                          {item.subtitle ? (
                            <Text
                              style={
                                styles.timelineSubtitle
                              }
                            >
                              {
                                item.subtitle
                              }
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    )
                  )}
                </View>
              )}
            </View>

            {finishedEvents.length >
            0 ? (
              <View
                style={
                  styles.section
                }
              >
                <Text
                  style={
                    styles.sectionEyebrow
                  }
                >
                  FINISHED
                </Text>

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Finished this {mode}
                </Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={
                    false
                  }
                  contentContainerStyle={[
                    styles.finishedFan,
                    finishedEvents.length <=
                      5 &&
                      styles.finishedFanCentered,
                  ]}
                >
                  {finishedEvents.map(
                    (
                      event,
                      index
                    ) => (
                      <View
                        key={
                          event.id
                        }
                        style={[
                          styles.finishedCoverWrap,
                          index >
                            0 &&
                            styles.finishedCoverOverlap,
                        ]}
                      >
                        {(event.book.googleBookId || event.book.coverUrl) ? (
                          <BookCoverImage
                            googleBookId={event.book.googleBookId}
                            existingCoverUrl={event.book.coverUrl}
                            style={
                              styles.finishedCover
                            }
                          />
                        ) : (
                          <View
                            style={
                              styles.finishedCoverFallback
                            }
                          >
                            <Ionicons
                              name="book-outline"
                              size={
                                24
                              }
                              color={
                                colors.mutedText
                              }
                            />
                          </View>
                        )}

                        <View
                          style={
                            styles.finishedBadge
                          }
                        >
                          <Ionicons
                            name="checkmark"
                            size={
                              11
                            }
                            color={
                              colors.background
                            }
                          />
                        </View>
                      </View>
                    )
                  )}
                </ScrollView>

                <Text
                  style={
                    styles.finishedSummary
                  }
                >
                  {finishedEvents.length}{' '}
                  {finishedEvents.length ===
                  1
                    ? 'book'
                    : 'books'}{' '}
                  completed this {mode}
                </Text>
              </View>
            ) : null}

            {continuingJourneys.length >
            0 ? (
              <View
                style={
                  styles.section
                }
              >
                <Text
                  style={
                    styles.sectionEyebrow
                  }
                >
                  STILL IN MOTION
                </Text>

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  {
                    getContinuingSubtitle(
                      mode,
                      referenceDate
                    )
                  }
                </Text>

                <View
                  style={
                    styles.continuingList
                  }
                >
                  {continuingJourneys.map(
                    (
                      journey
                    ) => {
                      const motionBook =
                        booksInMotion.find(
                          (
                            item
                          ) =>
                            item.identity ===
                            bookIdentity(
                              journey.book
                            )
                        );

                      const readingDays =
                        motionBook
                          ?.dates.length ??
                        0;

                      return (
                        <View
                          key={
                            journey.id
                          }
                          style={
                            styles.continuingBook
                          }
                        >
                          {(journey.book.googleBookId || journey.book.coverUrl) ? (
                            <BookCoverImage
                              googleBookId={journey.book.googleBookId}
                              existingCoverUrl={journey.book.coverUrl}
                              style={
                                styles.continuingCover
                              }
                            />
                          ) : (
                            <View
                              style={
                                styles.continuingCoverFallback
                              }
                            >
                              <Ionicons
                                name="book-outline"
                                size={
                                  21
                                }
                                color={
                                  colors.mutedText
                                }
                              />
                            </View>
                          )}

                          <View
                            style={
                              styles.continuingCopy
                            }
                          >
                            <Text
                              style={
                                styles.continuingTitle
                              }
                              numberOfLines={
                                2
                              }
                            >
                              {
                                journey.book.title
                              }
                            </Text>

                            {journey.book.authors.length >
                            0 ? (
                              <Text
                                style={
                                  styles.continuingAuthor
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                {
                                  journey.book.authors.join(
                                    ', '
                                  )
                                }
                              </Text>
                            ) : null}

                            <View
                              style={
                                styles.continuingMetaRow
                              }
                            >
                              <View
                                style={
                                  styles.continuingStatus
                                }
                              >
                                <View
                                  style={
                                    styles.continuingStatusDot
                                  }
                                />

                                <Text
                                  style={
                                    styles.continuingStatusText
                                  }
                                >
                                  IN MOTION
                                </Text>
                              </View>

                              {readingDays >
                              0 ? (
                                <Text
                                  style={
                                    styles.continuingMetaText
                                  }
                                >
                                  {readingDays}{' '}
                                  {readingDays ===
                                  1
                                    ? 'reading day'
                                    : 'reading days'}{' '}
                                  this {mode}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        </View>
                      );
                    }
                  )}
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={() =>
                router.push(
                  '/reading-activity'
                )
              }
              style={({
                pressed,
              }) => [
                styles.activityLink,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={
                  styles.activityLinkIcon
                }
              >
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
                  styles.activityLinkCopy
                }
              >
                <Text
                  style={
                    styles.activityLinkTitle
                  }
                >
                  Want the day-by-day view?
                </Text>

                <Text
                  style={
                    styles.activityLinkSubtitle
                  }
                >
                  Explore this period in Reading Tracker.
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={
                  19
                }
                color={
                  colors.mutedText
                }
              />
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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

    header: {
      height:
        56,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        14,
      borderBottomWidth:
        1,
      borderBottomColor:
        colors.border,
    },

    headerButton: {
      width:
        42,
      height:
        42,
      borderRadius:
        21,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    headerTitle: {
      flex:
        1,
      textAlign:
        'center',
      color:
        colors.text,
      fontSize:
        20,
      fontFamily:
        'PlayfairDisplay_700Bold',
    },

    scroll: {
      flex:
        1,
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
        14,
      paddingBottom:
        42,
    },

    modeSwitch: {
      alignSelf:
        'center',
      flexDirection:
        'row',
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        13,
      backgroundColor:
        colors.surface,
      padding:
        3,
      gap:
        3,
    },

    modeButton: {
      minWidth:
        88,
      minHeight:
        34,
      borderRadius:
        10,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        14,
    },

    modeButtonActive: {
      backgroundColor:
        colors.elevated,
    },

    modeButtonText: {
      color:
        colors.mutedText,
      fontSize:
        12,
      fontFamily:
        'Inter_600SemiBold',
    },

    modeButtonTextActive: {
      color:
        colors.gold,
    },

    periodNav: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop:
        11,
      marginBottom:
        14,
    },

    periodArrow: {
      width:
        38,
      height:
        38,
      borderRadius:
        19,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    periodLabel: {
      minWidth:
        190,
      textAlign:
        'center',
      color:
        colors.secondaryText,
      fontSize:
        13,
      fontFamily:
        'Inter_600SemiBold',
    },

    loadingState: {
      minHeight:
        360,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    errorState: {
      minHeight:
        320,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        30,
    },

    errorTitle: {
      color:
        colors.text,
      fontSize:
        18,
      fontFamily:
        'PlayfairDisplay_700Bold',
      marginTop:
        10,
    },

    errorText: {
      color:
        colors.mutedText,
      fontSize:
        12,
      lineHeight:
        18,
      textAlign:
        'center',
      fontFamily:
        'Inter_400Regular',
      marginTop:
        6,
    },

    retryButton: {
      minHeight:
        38,
      borderRadius:
        11,
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
      paddingHorizontal:
        16,
      marginTop:
        16,
    },

    retryButtonText: {
      color:
        colors.gold,
      fontSize:
        12,
      fontFamily:
        'Inter_700Bold',
    },

    hero: {
      alignItems:
        'center',
      paddingTop:
        4,
      paddingBottom:
        22,
    },

    heroEyebrow: {
      color:
        colors.gold,
      fontSize:
        10,
      letterSpacing:
        1.8,
      fontFamily:
        'Inter_700Bold',
      textAlign:
        'center',
    },

    coverFan: {
      alignSelf:
        'stretch',
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop:
        16,
      marginBottom:
        14,
      paddingHorizontal:
        18,
    },

    heroCoverWrap: {
      borderRadius:
        10,
      shadowColor:
        '#000000',
      shadowOpacity:
        0.18,
      shadowRadius:
        8,
      shadowOffset: {
        width:
          0,
        height:
          4,
      },
      elevation:
        3,
    },

    heroCoverOverlap: {
      marginLeft:
        -22,
    },

    heroCover: {
      width:
        64,
      height:
        96,
      borderRadius:
        9,
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },

    heroCoverFallback: {
      width:
        64,
      height:
        96,
      borderRadius:
        9,
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
    },

    heroNumber: {
      color:
        colors.text,
      fontSize:
        42,
      lineHeight:
        48,
      fontFamily:
        'PlayfairDisplay_700Bold',
    },

    heroMetric: {
      color:
        colors.secondaryText,
      fontSize:
        13,
      fontFamily:
        'Inter_600SemiBold',
      marginTop:
        -1,
    },

    heroSummary: {
      color:
        colors.mutedText,
      fontSize:
        12,
      fontFamily:
        'Inter_400Regular',
      marginTop:
        7,
      textAlign:
        'center',
    },

    supportingStats: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      justifyContent:
        'center',
      gap:
        8,
      marginTop:
        10,
    },

    supportingStat: {
      minHeight:
        31,
      borderRadius:
        999,
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
        5,
      paddingHorizontal:
        10,
    },

    supportingStatText: {
      color:
        colors.secondaryText,
      fontSize:
        10.5,
      fontFamily:
        'Inter_600SemiBold',
    },

    section: {
      borderTopWidth:
        1,
      borderTopColor:
        colors.border,
      paddingTop:
        20,
      marginBottom:
        22,
    },

    sectionEyebrow: {
      color:
        colors.gold,
      fontSize:
        10,
      letterSpacing:
        1.6,
      fontFamily:
        'Inter_700Bold',
      marginBottom:
        5,
    },

    sectionTitle: {
      color:
        colors.text,
      fontSize:
        23,
      lineHeight:
        29,
      fontFamily:
        'PlayfairDisplay_700Bold',
    },

    emptyStory: {
      marginTop:
        16,
      borderRadius:
        15,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      padding:
        18,
    },

    emptyStoryText: {
      color:
        colors.mutedText,
      fontSize:
        11.5,
      lineHeight:
        18,
      fontFamily:
        'Inter_400Regular',
    },

    timeline: {
      marginTop:
        15,
    },

    timelineItem: {
      flexDirection:
        'row',
      minHeight:
        68,
    },

    timelineRail: {
      width:
        42,
      alignItems:
        'center',
    },

    timelineIcon: {
      width:
        31,
      height:
        31,
      borderRadius:
        16,
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
      zIndex:
        2,
    },

    timelineLine: {
      width:
        1,
      flex:
        1,
      backgroundColor:
        colors.border,
    },

    timelineCopy: {
      flex:
        1,
      paddingLeft:
        10,
      paddingBottom:
        20,
    },

    timelineDate: {
      color:
        colors.gold,
      fontSize:
        9.5,
      fontFamily:
        'Inter_700Bold',
      letterSpacing:
        0.4,
    },

    timelineTitle: {
      color:
        colors.text,
      fontSize:
        14,
      lineHeight:
        19,
      fontFamily:
        'Inter_600SemiBold',
      marginTop:
        4,
    },

    timelineSubtitle: {
      color:
        colors.mutedText,
      fontSize:
        10.5,
      lineHeight:
        15,
      fontFamily:
        'Inter_400Regular',
      marginTop:
        3,
    },

    finishedFan: {
      minWidth:
        '100%',
      paddingTop:
        14,
      paddingBottom:
        6,
      paddingHorizontal:
        18,
      alignItems:
        'center',
    },

    finishedFanCentered: {
      flexGrow:
        1,
      justifyContent:
        'center',
    },

    finishedCoverWrap: {
      position:
        'relative',
      borderRadius:
        11,
      shadowColor:
        '#000000',
      shadowOpacity:
        0.16,
      shadowRadius:
        7,
      shadowOffset: {
        width:
          0,
        height:
          4,
      },
      elevation:
        3,
    },

    finishedCoverOverlap: {
      marginLeft:
        -22,
    },

    finishedCover: {
      width:
        82,
      height:
        123,
      borderRadius:
        10,
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },

    finishedCoverFallback: {
      width:
        82,
      height:
        123,
      borderRadius:
        10,
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
    },

    finishedBadge: {
      position:
        'absolute',
      right:
        -5,
      top:
        -5,
      width:
        22,
      height:
        22,
      borderRadius:
        11,
      backgroundColor:
        colors.gold,
      borderWidth:
        2,
      borderColor:
        colors.background,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    finishedSummary: {
      color:
        colors.mutedText,
      fontSize:
        10.5,
      fontFamily:
        'Inter_500Medium',
      textAlign:
        'center',
      marginTop:
        4,
    },

    continuingList: {
      marginTop:
        12,
      gap:
        8,
    },

    continuingBook: {
      minHeight:
        96,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderRadius:
        17,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      padding:
        11,
    },

    continuingCover: {
      width:
        52,
      height:
        78,
      borderRadius:
        8,
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },

    continuingCoverFallback: {
      width:
        52,
      height:
        78,
      borderRadius:
        8,
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
    },

    continuingCopy: {
      flex:
        1,
      paddingLeft:
        13,
      paddingRight:
        4,
    },

    continuingTitle: {
      color:
        colors.text,
      fontSize:
        15.5,
      lineHeight:
        20,
      fontFamily:
        'PlayfairDisplay_700Bold',
    },

    continuingAuthor: {
      color:
        colors.mutedText,
      fontSize:
        10.5,
      lineHeight:
        15,
      fontFamily:
        'Inter_400Regular',
      marginTop:
        3,
    },

    continuingMetaRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      flexWrap:
        'wrap',
      gap:
        8,
      marginTop:
        10,
    },

    continuingStatus: {
      minHeight:
        23,
      borderRadius:
        999,
      backgroundColor:
        colors.elevated,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        5,
      paddingHorizontal:
        8,
    },

    continuingStatusDot: {
      width:
        5,
      height:
        5,
      borderRadius:
        3,
      backgroundColor:
        colors.gold,
    },

    continuingStatusText: {
      color:
        colors.gold,
      fontSize:
        8.5,
      letterSpacing:
        0.7,
      fontFamily:
        'Inter_700Bold',
    },

    continuingMetaText: {
      color:
        colors.secondaryText,
      fontSize:
        9.5,
      fontFamily:
        'Inter_500Medium',
    },

    activityLink: {
      minHeight:
        68,
      borderRadius:
        16,
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
      paddingHorizontal:
        14,
      marginTop:
        -2,
    },

    activityLinkIcon: {
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
      marginRight:
        11,
    },

    activityLinkCopy: {
      flex:
        1,
      paddingRight:
        8,
    },

    activityLinkTitle: {
      color:
        colors.text,
      fontSize:
        12.5,
      fontFamily:
        'Inter_600SemiBold',
    },

    activityLinkSubtitle: {
      color:
        colors.mutedText,
      fontSize:
        10.5,
      lineHeight:
        15,
      fontFamily:
        'Inter_400Regular',
      marginTop:
        2,
    },

    pressed: {
      opacity:
        0.68,
    },
  });
}
