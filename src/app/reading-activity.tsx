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

const ORBIT_SIZE =
  252;

const ORBIT_CENTER =
  ORBIT_SIZE /
  2;

const ORBIT_RADIUS =
  111;

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

  const selectedDay =
    monthData
      ?.days[
        selectedDateKey
      ] ??
    emptyDay(
      selectedDateKey
    );

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
                ORBIT_CENTER +
                Math.cos(
                  angle
                ) *
                  ORBIT_RADIUS,
              top:
                ORBIT_CENTER +
                Math.sin(
                  angle
                ) *
                  ORBIT_RADIUS,
            };
          }
        );
      },
      [
        displayedMonth.monthIndex,
        displayedMonth.year,
        monthData,
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
    selectedDay.checkedIn ||
    selectedDay.books.length >
      0 ||
    selectedDay.readingUpdates.length >
      0 ||
    selectedDay.journeyEvents.length >
      0;

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
                  styles.orbitStage
                }
              >
                <View
                  style={
                    styles.orbitHaloOuter
                  }
                />

                <View
                  style={
                    styles.orbitHaloInner
                  }
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
                          styles.orbitDotTouch,
                          {
                            left:
                              dot.left -
                              13,
                            top:
                              dot.top -
                              13,
                          },
                          pressed &&
                            styles.orbitDotTouchPressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.orbitDot,
                            dot.checked &&
                              styles.orbitDotRead,
                            dot.today &&
                              styles.orbitDotToday,
                            selected &&
                              styles.orbitDotSelected,
                          ]}
                        />
                      </Pressable>
                    );
                  }
                )}

                <View
                  style={
                    styles.orbitCenter
                  }
                >
                  <Text
                    style={
                      styles.orbitNumber
                    }
                  >
                    {
                      monthData.daysRead
                    }
                  </Text>

                  <Text
                    style={
                      styles.orbitNumberLabel
                    }
                  >
                    {monthData.daysRead ===
                    1
                      ? 'READING DAY'
                      : 'READING DAYS'}
                  </Text>
                </View>

                {personalization.charms.map(
                  (
                    charm,
                    index
                  ) => (
                    <View
                      key={
                        charm
                      }
                      pointerEvents="none"
                      style={[
                        styles.orbitCharm,
                        styles[
                          `orbitCharm${index +
                            1}` as keyof typeof styles
                        ] as any,
                      ]}
                    >
                      <ReadingMonthCharmArtwork
                        charm={
                          charm
                        }
                        size={
                          index % 3 ===
                          0
                            ? 38
                            : 34
                        }
                      />
                    </View>
                  )
                )}

                {personalization.charms.length ===
                0 ? (
                  <Pressable
                    onPress={() =>
                      setCustomizeVisible(
                        true
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.orbitCharmEmpty,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="sparkles-outline"
                      size={
                        16
                      }
                      color={
                        colors.gold
                      }
                    />

                    <Text
                      style={
                        styles.orbitCharmEmptyText
                      }
                    >
                      Add charms
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <View
                style={
                  styles.orbitStats
                }
              >
                <View
                  style={
                    styles.orbitStat
                  }
                >
                  <Ionicons
                    name="flame-outline"
                    size={
                      16
                    }
                    color={
                      colors.gold
                    }
                  />

                  <Text
                    style={
                      styles.orbitStatValue
                    }
                  >
                    {
                      monthData.bestStreak
                    }
                  </Text>

                  <Text
                    style={
                      styles.orbitStatLabel
                    }
                  >
                    best streak
                  </Text>
                </View>

                <View
                  style={
                    styles.orbitStatsRule
                  }
                />

                <View
                  style={
                    styles.orbitStat
                  }
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={
                      16
                    }
                    color={
                      colors.gold
                    }
                  />

                  <Text
                    style={
                      styles.orbitStatValue
                    }
                  >
                    {
                      monthData.booksFinished
                    }
                  </Text>

                  <Text
                    style={
                      styles.orbitStatLabel
                    }
                  >
                    finished
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
      width:
        ORBIT_SIZE,
      height:
        ORBIT_SIZE,
      alignSelf:
        'center',
      position:
        'relative',
      marginTop:
        9,
      marginBottom:
        8,
    },
    orbitHaloOuter: {
      position:
        'absolute',
      left:
        15,
      top:
        15,
      width:
        ORBIT_SIZE -
        30,
      height:
        ORBIT_SIZE -
        30,
      borderRadius:
        (
          ORBIT_SIZE -
          30
        ) /
        2,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    orbitHaloInner: {
      position:
        'absolute',
      left:
        39,
      top:
        39,
      width:
        ORBIT_SIZE -
        78,
      height:
        ORBIT_SIZE -
        78,
      borderRadius:
        (
          ORBIT_SIZE -
          78
        ) /
        2,
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    orbitDotTouch: {
      position:
        'absolute',
      width:
        26,
      height:
        26,
      borderRadius:
        13,
      alignItems:
        'center',
      justifyContent:
        'center',
      zIndex:
        6,
    },
    orbitDotTouchPressed: {
      transform: [
        {
          scale:
            1.14,
        },
      ],
    },
    orbitDot: {
      width:
        5,
      height:
        5,
      borderRadius:
        3,
      backgroundColor:
        colors.border,
    },
    orbitDotRead: {
      width:
        8,
      height:
        8,
      borderRadius:
        4,
      backgroundColor:
        colors.gold,
    },
    orbitDotToday: {
      borderWidth:
        1,
      borderColor:
        colors.text,
    },
    orbitDotSelected: {
      width:
        12,
      height:
        12,
      borderRadius:
        6,
      borderWidth:
        2,
      borderColor:
        colors.softGold,
      backgroundColor:
        colors.gold,
    },
    orbitCharm: {
      position:
        'absolute',
      width:
        44,
      height:
        44,
      alignItems:
        'center',
      justifyContent:
        'center',
      zIndex:
        9,
    },
    orbitCharm1: {
      right:
        -8,
      top:
        28,
      transform: [
        {
          rotate:
            '5deg',
        },
      ],
    },
    orbitCharm2: {
      left:
        -10,
      top:
        52,
      transform: [
        {
          rotate:
            '-7deg',
        },
      ],
    },
    orbitCharm3: {
      right:
        -18,
      top:
        108,
      transform: [
        {
          rotate:
            '4deg',
        },
      ],
    },
    orbitCharm4: {
      left:
        -18,
      bottom:
        58,
      transform: [
        {
          rotate:
            '-4deg',
        },
      ],
    },
    orbitCharm5: {
      right:
        1,
      bottom:
        27,
      transform: [
        {
          rotate:
            '7deg',
        },
      ],
    },
    orbitCharm6: {
      left:
        28,
      bottom:
        -8,
      transform: [
        {
          rotate:
            '-5deg',
        },
      ],
    },
    orbitCharm7: {
      right:
        43,
      top:
        -12,
      transform: [
        {
          rotate:
            '3deg',
        },
      ],
    },
    orbitCharm8: {
      left:
        55,
      top:
        -13,
      transform: [
        {
          rotate:
            '-3deg',
        },
      ],
    },
    orbitCharmEmpty: {
      position:
        'absolute',
      right:
        -9,
      top:
        34,
      minHeight:
        31,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        4,
      paddingHorizontal:
        8,
      zIndex:
        9,
    },
    orbitCharmEmptyText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        9,
    },
    orbitStats: {
      minHeight:
        48,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        10,
      borderTopWidth:
        1,
      borderBottomWidth:
        1,
      borderColor:
        colors.border,
    },
    orbitStat: {
      flex:
        1,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        5,
    },
    orbitStatValue: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        12,
    },
    orbitStatLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        9.5,
    },
    orbitStatsRule: {
      width:
        1,
      height:
        22,
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
        24,
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
