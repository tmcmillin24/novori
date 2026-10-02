import {
  Ionicons,
} from '@expo/vector-icons';
import {
  Image as ExpoImage,
} from 'expo-image';
import {
  useRouter,
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

type RecapMode =
  | 'week'
  | 'month';

type RecapBook = {
  identity:
    string;
  book:
    ReadingActivityBook;
  dates:
    string[];
  finishedDate:
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
    12
  );
}

function getWeekKeys(
  reference:
    Date
) {
  const start =
    getWeekStart(
      reference
    );

  return Array.from(
    {
      length:
        7,
    },
    (
      _,
      index
    ) =>
      dateKey(
        new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate() +
            index,
          12
        )
      )
  );
}

function getMonthKeys(
  reference:
    Date
) {
  const total =
    new Date(
      reference.getFullYear(),
      reference.getMonth() +
        1,
      0
    ).getDate();

  return Array.from(
    {
      length:
        total,
    },
    (
      _,
      index
    ) =>
      dateKey(
        new Date(
          reference.getFullYear(),
          reference.getMonth(),
          index +
            1,
          12
        )
      )
  );
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
    getWeekKeys(
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

function getBestStreak(
  keys:
    string[]
) {
  const times =
    Array.from(
      new Set(
        keys.map(
          (
            key
          ) =>
            dateFromKey(
              key
            ).getTime()
        )
      )
    ).sort(
      (
        a,
        b
      ) =>
        a - b
    );

  let best =
    0;

  let current =
    0;

  let previous:
    number | null =
    null;

  for (
    const time
    of times
  ) {
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

    best =
      Math.max(
        best,
        current
      );

    previous =
      time;
  }

  return best;
}

function formatCompactDate(
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

function buildBookRecaps(
  dayMap:
    Record<
      string,
      ReadingActivityDay
    >,
  keys:
    string[]
) {
  const books =
    new Map<
      string,
      RecapBook
    >();

  for (
    const key
    of keys
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
      } else {
        books.set(
          identity,
          {
            identity,
            book,
            dates:
              [
                key,
              ],
            finishedDate:
              null,
          }
        );
      }
    }

    for (
      const event
      of day.journeyEvents
    ) {
      if (
        event.type !==
          'finished' ||
        !event.book
      ) {
        continue;
      }

      const identity =
        bookIdentity(
          event.book
        );

      const existing =
        books.get(
          identity
        );

      if (
        existing
      ) {
        existing.finishedDate =
          key;
      } else {
        books.set(
          identity,
          {
            identity,
            book:
              event.book,
            dates:
              [
                key,
              ],
            finishedDate:
              key,
          }
        );
      }
    }
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

export default function ReadingRecapsScreen() {
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
      'month'
    );

  const [
    referenceDate,
    setReferenceDate,
  ] =
    useState(
      () =>
        new Date()
    );

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
        mode ===
        'month'
          ? getMonthKeys(
              referenceDate
            )
          : getWeekKeys(
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
              mode ===
              'month'
                ? getMonthKeys(
                    referenceDate
                  )
                : getWeekKeys(
                    referenceDate
                  )
            );

          const loaded =
            await Promise.all(
              required.map(
                (
                  item
                ) =>
                  getReadingActivityMonth(
                    item.year,
                    item.monthIndex
                  )
              )
            );

          setMonths(
            loaded
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

  const books =
    useMemo(
      () =>
        buildBookRecaps(
          dayMap,
          periodKeys
        ),
      [
        dayMap,
        periodKeys,
      ]
    );

  const finishedBooks =
    useMemo(
      () =>
        books.filter(
          (
            item
          ) =>
            Boolean(
              item.finishedDate
            )
        ),
      [
        books,
      ]
    );

  const bestStreak =
    useMemo(
      () =>
        getBestStreak(
          checkedKeys
        ),
      [
        checkedKeys,
      ]
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

  const heroBooks =
    books.slice(
      0,
      5
    );

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
          Reading Recap
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
            onRefresh={() =>
              void loadRecap(
                true
              )
            }
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
            ] as RecapMode[]
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
                    : 'Month'}
                </Text>
              </Pressable>
            )
          )}
        </View>

        <View
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
        </View>

        {loading ? (
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
                  ? 'YOUR MONTH IN MOTION'
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
                        {item.book.coverUrl ? (
                          <ExpoImage
                            source={
                              item.book.coverUrl
                            }
                            style={
                              styles.heroCover
                            }
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            transition={
                              0
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
                {books.length}{' '}
                {books.length ===
                1
                  ? 'book'
                  : 'books'}{' '}
                in motion
                {finishedBooks.length >
                0
                  ? ` · ${finishedBooks.length} finished`
                  : ''}
              </Text>
            </View>

            <View
              style={
                styles.section
              }
            >
              <View
                style={
                  styles.sectionHeadingRow
                }
              >
                <View>
                  <Text
                    style={
                      styles.sectionEyebrow
                    }
                  >
                    RHYTHM
                  </Text>

                  <Text
                    style={
                      styles.sectionTitle
                    }
                  >
                    Your reading rhythm
                  </Text>
                </View>

                {bestStreak >
                0 ? (
                  <Text
                    style={
                      styles.streakText
                    }
                  >
                    {bestStreak}-day best
                  </Text>
                ) : null}
              </View>

              <View
                style={
                  styles.weekdayRow
                }
              >
                {[
                  'M',
                  'T',
                  'W',
                  'T',
                  'F',
                  'S',
                  'S',
                ].map(
                  (
                    label,
                    index
                  ) => (
                    <Text
                      key={
                        `${label}-${index}`
                      }
                      style={
                        styles.weekdayLabel
                      }
                    >
                      {label}
                    </Text>
                  )
                )}
              </View>

              {mode ===
              'week' ? (
                <View
                  style={
                    styles.rhythmWeek
                  }
                >
                  {periodKeys.map(
                    (
                      key
                    ) => (
                      <View
                        key={
                          key
                        }
                        style={
                          styles.rhythmCell
                        }
                      >
                        <View
                          style={[
                            styles.rhythmDot,
                            dayMap[
                              key
                            ]?.checkedIn &&
                              styles.rhythmDotRead,
                          ]}
                        />

                        <Text
                          style={[
                            styles.rhythmDayNumber,
                            dayMap[
                              key
                            ]?.checkedIn &&
                              styles.rhythmDayNumberRead,
                          ]}
                        >
                          {
                            dateFromKey(
                              key
                            ).getDate()
                          }
                        </Text>
                      </View>
                    )
                  )}
                </View>
              ) : (
                <View
                  style={
                    styles.monthRhythm
                  }
                >
                  {Array.from(
                    {
                      length:
                        (
                          (
                            dateFromKey(
                              periodKeys[0]
                            ).getDay() +
                            6
                          ) %
                            7
                        ),
                    },
                    (
                      _,
                      index
                    ) => (
                      <View
                        key={
                          `blank-${index}`
                        }
                        style={
                          styles.rhythmCell
                        }
                      />
                    )
                  )}

                  {periodKeys.map(
                    (
                      key
                    ) => (
                      <View
                        key={
                          key
                        }
                        style={
                          styles.rhythmCell
                        }
                      >
                        <View
                          style={[
                            styles.rhythmDot,
                            dayMap[
                              key
                            ]?.checkedIn &&
                              styles.rhythmDotRead,
                          ]}
                        />

                        <Text
                          style={[
                            styles.rhythmDayNumber,
                            dayMap[
                              key
                            ]?.checkedIn &&
                              styles.rhythmDayNumberRead,
                          ]}
                        >
                          {
                            dateFromKey(
                              key
                            ).getDate()
                          }
                        </Text>
                      </View>
                    )
                  )}
                </View>
              )}
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
                BOOKS
              </Text>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Books in motion
              </Text>

              {books.length ===
              0 ? (
                <View
                  style={
                    styles.emptyCard
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

                  <Text
                    style={
                      styles.emptyTitle
                    }
                  >
                    Nothing in motion yet.
                  </Text>

                  <Text
                    style={
                      styles.emptyText
                    }
                  >
                    Reading check-ins
                    and updates from
                    this period will
                    build your recap
                    here.
                  </Text>
                </View>
              ) : (
                <View
                  style={
                    styles.bookList
                  }
                >
                  {books.map(
                    (
                      item,
                      index
                    ) => (
                      <View
                        key={
                          item.identity
                        }
                      >
                        <View
                          style={
                            styles.bookRow
                          }
                        >
                          {item.book.coverUrl ? (
                            <ExpoImage
                              source={
                                item.book.coverUrl
                              }
                              style={
                                styles.bookCover
                              }
                              contentFit="cover"
                              cachePolicy="memory-disk"
                              transition={
                                0
                              }
                            />
                          ) : (
                            <View
                              style={
                                styles.bookCoverFallback
                              }
                            >
                              <Ionicons
                                name="book-outline"
                                size={
                                  20
                                }
                                color={
                                  colors.mutedText
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
                                item.book.title
                              }
                            </Text>

                            {item.book.authors.length >
                            0 ? (
                              <Text
                                style={
                                  styles.bookAuthor
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                {
                                  item.book.authors.join(
                                    ', '
                                  )
                                }
                              </Text>
                            ) : null}

                            <Text
                              style={
                                styles.bookMeta
                              }
                            >
                              {
                                item.dates.length
                              }{' '}
                              {item.dates.length ===
                              1
                                ? 'reading day'
                                : 'reading days'}
                              {' · '}
                              {
                                formatCompactDate(
                                  item.dates[0]
                                )
                              }
                              {item.dates.length >
                              1
                                ? ` – ${formatCompactDate(
                                    item.dates[
                                      item.dates.length -
                                        1
                                    ]
                                  )}`
                                : ''}
                            </Text>
                          </View>

                          {item.finishedDate ? (
                            <View
                              style={
                                styles.finishedBadge
                              }
                            >
                              <Ionicons
                                name="checkmark"
                                size={
                                  13
                                }
                                color={
                                  colors.gold
                                }
                              />

                              <Text
                                style={
                                  styles.finishedBadgeText
                                }
                              >
                                Finished
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {index <
                        books.length -
                          1 ? (
                          <View
                            style={
                              styles.bookDivider
                            }
                          />
                        ) : null}
                      </View>
                    )
                  )}
                </View>
              )}
            </View>

            {finishedBooks.length >
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
                  contentContainerStyle={
                    styles.finishedRow
                  }
                >
                  {finishedBooks.map(
                    (
                      item
                    ) => (
                      <View
                        key={
                          item.identity
                        }
                        style={
                          styles.finishedBook
                        }
                      >
                        {item.book.coverUrl ? (
                          <ExpoImage
                            source={
                              item.book.coverUrl
                            }
                            style={
                              styles.finishedCover
                            }
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            transition={
                              0
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
                                22
                              }
                              color={
                                colors.mutedText
                              }
                            />
                          </View>
                        )}

                        <Text
                          style={
                            styles.finishedTitle
                          }
                          numberOfLines={
                            2
                          }
                        >
                          {
                            item.book.title
                          }
                        </Text>

                        {item.finishedDate ? (
                          <Text
                            style={
                              styles.finishedDate
                            }
                          >
                            {
                              formatCompactDate(
                                item.finishedDate
                              )
                            }
                          </Text>
                        ) : null}
                      </View>
                    )
                  )}
                </ScrollView>
              </View>
            ) : null}
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
        18,
      paddingBottom:
        56,
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
        15,
      marginBottom:
        18,
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
        8,
      paddingBottom:
        30,
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
    },

    coverFan: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop:
        20,
      marginBottom:
        18,
      paddingLeft:
        22,
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
    },

    section: {
      borderTopWidth:
        1,
      borderTopColor:
        colors.border,
      paddingTop:
        24,
      marginTop:
        4,
      marginBottom:
        26,
    },

    sectionHeadingRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-end',
      justifyContent:
        'space-between',
      gap:
        14,
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

    streakText: {
      color:
        colors.mutedText,
      fontSize:
        11,
      fontFamily:
        'Inter_600SemiBold',
      paddingBottom:
        3,
    },

    weekdayRow: {
      flexDirection:
        'row',
      marginTop:
        20,
    },

    weekdayLabel: {
      width:
        '14.2857%',
      textAlign:
        'center',
      color:
        colors.mutedText,
      fontSize:
        9,
      fontFamily:
        'Inter_700Bold',
    },

    rhythmWeek: {
      flexDirection:
        'row',
      marginTop:
        10,
    },

    monthRhythm: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      marginTop:
        10,
    },

    rhythmCell: {
      width:
        '14.2857%',
      height:
        42,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    rhythmDot: {
      width:
        8,
      height:
        8,
      borderRadius:
        4,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        'transparent',
    },

    rhythmDotRead: {
      borderColor:
        colors.gold,
      backgroundColor:
        colors.gold,
    },

    rhythmDayNumber: {
      color:
        colors.mutedText,
      fontSize:
        9,
      fontFamily:
        'Inter_500Medium',
      marginTop:
        4,
    },

    rhythmDayNumberRead: {
      color:
        colors.secondaryText,
    },

    emptyCard: {
      marginTop:
        16,
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
      paddingHorizontal:
        24,
      paddingVertical:
        28,
    },

    emptyTitle: {
      color:
        colors.text,
      fontSize:
        14,
      fontFamily:
        'Inter_700Bold',
      marginTop:
        9,
    },

    emptyText: {
      color:
        colors.mutedText,
      fontSize:
        11,
      lineHeight:
        17,
      textAlign:
        'center',
      fontFamily:
        'Inter_400Regular',
      marginTop:
        4,
      maxWidth:
        320,
    },

    bookList: {
      marginTop:
        15,
      borderRadius:
        18,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      overflow:
        'hidden',
    },

    bookRow: {
      minHeight:
        104,
      flexDirection:
        'row',
      alignItems:
        'center',
      padding:
        13,
    },

    bookCover: {
      width:
        48,
      height:
        72,
      borderRadius:
        7,
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },

    bookCoverFallback: {
      width:
        48,
      height:
        72,
      borderRadius:
        7,
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

    bookCopy: {
      flex:
        1,
      paddingHorizontal:
        12,
    },

    bookTitle: {
      color:
        colors.text,
      fontSize:
        15,
      lineHeight:
        20,
      fontFamily:
        'PlayfairDisplay_700Bold',
    },

    bookAuthor: {
      color:
        colors.secondaryText,
      fontSize:
        11,
      fontFamily:
        'Inter_400Regular',
      marginTop:
        3,
    },

    bookMeta: {
      color:
        colors.mutedText,
      fontSize:
        10,
      fontFamily:
        'Inter_500Medium',
      marginTop:
        7,
    },

    finishedBadge: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        4,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        999,
      paddingHorizontal:
        8,
      paddingVertical:
        5,
      backgroundColor:
        colors.elevated,
    },

    finishedBadgeText: {
      color:
        colors.gold,
      fontSize:
        9,
      fontFamily:
        'Inter_700Bold',
    },

    bookDivider: {
      height:
        1,
      backgroundColor:
        colors.border,
      marginLeft:
        73,
    },

    finishedRow: {
      gap:
        12,
      paddingTop:
        15,
      paddingRight:
        8,
    },

    finishedBook: {
      width:
        92,
    },

    finishedCover: {
      width:
        78,
      height:
        117,
      borderRadius:
        9,
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },

    finishedCoverFallback: {
      width:
        78,
      height:
        117,
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

    finishedTitle: {
      color:
        colors.text,
      fontSize:
        11,
      lineHeight:
        15,
      fontFamily:
        'Inter_600SemiBold',
      marginTop:
        7,
    },

    finishedDate: {
      color:
        colors.mutedText,
      fontSize:
        9,
      fontFamily:
        'Inter_500Medium',
      marginTop:
        3,
    },

    pressed: {
      opacity:
        0.68,
    },
  });
}
