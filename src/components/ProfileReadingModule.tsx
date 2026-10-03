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
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import DailyCheckinSheet from './DailyCheckinSheet';
import {
  NovoriColors,
} from '../constants/novori-theme';
import {
  useNovoriTheme,
} from '../context/theme-context';
import {
  DailyReadingCheckinState,
  ensureDailyReadingCheckin,
  getDailyReadingCheckinBookIds,
  getDailyReadingCheckinState,
  getCenteredCheckinDates,
  getLocalDateKey,
  replaceDailyReadingCheckinBooks,
} from '../lib/reading-checkins';
import {
  UserBook,
} from '../lib/user-books';

type ProfileReadingModuleProps = {
  books:
    UserBook[];
};

export default function ProfileReadingModule({
  books,
}: ProfileReadingModuleProps) {
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
    checkinState,
    setCheckinState,
  ] =
    useState<
      DailyReadingCheckinState | null
    >(
      null
    );

  const [
    loadingCheckin,
    setLoadingCheckin,
  ] =
    useState(
      true
    );

  const [
    savingCheckin,
    setSavingCheckin,
  ] =
    useState(
      false
    );

  const [
    checkinError,
    setCheckinError,
  ] =
    useState(
      ''
    );

  const [
    checkinSheetVisible,
    setCheckinSheetVisible,
  ] =
    useState(
      false
    );

  const [
    selectedCheckinBookIds,
    setSelectedCheckinBookIds,
  ] =
    useState<
      string[]
    >(
      []
    );

  const [
    editingCheckin,
    setEditingCheckin,
  ] =
    useState(
      false
    );

  const [localDate, setLocalDate] = useState(getLocalDateKey);

  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout>;
    function syncLocalDay() {
      const now = new Date();
      const dateKey = getLocalDateKey(now);
      setCheckinState(previous => previous?.localDate === dateKey ? previous : null);
      setLocalDate(dateKey);
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      clearTimeout(midnightTimer);
      midnightTimer = setTimeout(syncLocalDay, midnight.getTime() - now.getTime() + 50);
    }
    syncLocalDay();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') syncLocalDay();
    });
    return () => {
      clearTimeout(midnightTimer);
      subscription.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(
      () => {
        let active =
          true;

        async function loadCheckin() {
          try {
            setLoadingCheckin(
              true
            );

            setCheckinError(
              ''
            );

            const next =
              await getDailyReadingCheckinState(localDate);

            if (
              active
            ) {
              setCheckinState(
                next
              );
            }
          } catch (
            checkinLoadError
          ) {
            console.error(
              'Could not load daily reading check-in:',
              checkinLoadError
            );

            if (
              active
            ) {
              setCheckinError(
                'Daily check-ins are temporarily unavailable.'
              );
            }
          } finally {
            if (
              active
            ) {
              setLoadingCheckin(
                false
              );
            }
          }
        }

        void loadCheckin();

        return () => {
          active =
            false;
        };
      },
      [localDate]
    )
  );

  const readingBooks =
    useMemo(
      () =>
        books.filter(
          (
            book
          ) =>
            book.status ===
            'reading'
        ),
      [
        books,
      ]
    );

  const checkinPickerBooks =
    useMemo(
      () => {
        if (
          !editingCheckin
        ) {
          return readingBooks;
        }

        const selectedIds =
          new Set(
            selectedCheckinBookIds
          );

        return books.filter(
          (
            book
          ) =>
            book.status ===
              'reading' ||
            selectedIds.has(
              book.google_book_id
            )
        );
      },
      [
        books,
        editingCheckin,
        readingBooks,
        selectedCheckinBookIds,
      ]
    );

  const checkinDays =
    useMemo(
      () =>
        getCenteredCheckinDates(new Date(`${localDate}T12:00:00`)),
      [localDate]
    );

  const checkedDateSet =
    useMemo(
      () =>
        new Set(
          checkinState
            ?.checkedDates ??
          []
        ),
      [
        checkinState
          ?.checkedDates,
      ]
    );

  const todayCheckinKey =
    localDate;

  function toggleCheckinBook(
    googleBookId:
      string
  ) {
    if (
      savingCheckin
    ) {
      return;
    }

    if (
      editingCheckin
    ) {
      if (
        selectedCheckinBookIds.includes(
          googleBookId
        )
      ) {
        return;
      }

      setSelectedCheckinBookIds(
        [
          googleBookId,
        ]
      );

      void saveEditedDailyCheckin(
        [
          googleBookId,
        ]
      );

      return;
    }

    setSelectedCheckinBookIds(
      (
        current
      ) =>
        current.includes(
          googleBookId
        )
          ? []
          : [
              googleBookId,
            ]
    );
  }

  async function saveDailyCheckin(
    googleBookIds:
      string[]
  ) {
    if (
      savingCheckin ||
      checkinState
        ?.checkedIn
    ) {
      return;
    }

    try {
      setSavingCheckin(
        true
      );

      setCheckinError(
        ''
      );

      await ensureDailyReadingCheckin(
        googleBookIds,
        'manual',
        todayCheckinKey
      );

      const next =
        await getDailyReadingCheckinState(
          todayCheckinKey
        );

      setCheckinState(
        next
      );

      setCheckinSheetVisible(
        false
      );

      setSelectedCheckinBookIds(
        []
      );

      setEditingCheckin(
        false
      );
    } catch (
      checkinSaveError
    ) {
      console.error(
        'Could not save daily reading check-in:',
        checkinSaveError
      );

      setCheckinError(
        'Daily check-ins are temporarily unavailable.'
      );

      Alert.alert(
        'Could not check in',
        checkinSaveError instanceof
          Error
          ? checkinSaveError.message
          : 'Novori had trouble saving today\'s reading check-in. Please try again.'
      );
    } finally {
      setSavingCheckin(
        false
      );
    }
  }

  async function saveEditedDailyCheckin(
    googleBookIds:
      string[]
  ) {
    if (
      savingCheckin ||
      !checkinState
        ?.checkedIn
    ) {
      return;
    }

    try {
      setSavingCheckin(
        true
      );

      setCheckinError(
        ''
      );

      await replaceDailyReadingCheckinBooks(
        googleBookIds,
        todayCheckinKey
      );

      const next =
        await getDailyReadingCheckinState(
          todayCheckinKey
        );

      setCheckinState(
        next
      );

      setCheckinSheetVisible(
        false
      );

      setSelectedCheckinBookIds(
        []
      );

      setEditingCheckin(
        false
      );
    } catch (
      checkinSaveError
    ) {
      console.error(
        'Could not update daily reading check-in books:',
        checkinSaveError
      );

      Alert.alert(
        'Could not update check-in',
        checkinSaveError instanceof
          Error
          ? checkinSaveError.message
          : 'Novori had trouble updating today’s books. Please try again.'
      );
    } finally {
      setSavingCheckin(
        false
      );
    }
  }

  async function openEditDailyCheckin() {
    if (
      loadingCheckin ||
      savingCheckin ||
      checkinError ||
      !checkinState
        ?.checkedIn
    ) {
      return;
    }

    try {
      setSavingCheckin(
        true
      );

      const existingBookIds =
        await getDailyReadingCheckinBookIds(
          todayCheckinKey
        );

      setSelectedCheckinBookIds(
        existingBookIds.slice(
          0,
          1
        )
      );

      setEditingCheckin(
        true
      );

      setCheckinSheetVisible(
        true
      );
    } catch (
      checkinLoadError
    ) {
      console.error(
        'Could not load today’s check-in books:',
        checkinLoadError
      );

      Alert.alert(
        'Could not edit check-in',
        'Novori had trouble loading today’s book. Please try again.'
      );
    } finally {
      setSavingCheckin(
        false
      );
    }
  }

  function openDailyCheckin() {
    if (
      loadingCheckin ||
      savingCheckin ||
      checkinState
        ?.checkedIn ||
      checkinError
    ) {
      return;
    }

    setEditingCheckin(
      false
    );

    if (
      readingBooks.length ===
      0
    ) {
      setSelectedCheckinBookIds(
        []
      );

      setCheckinSheetVisible(
        true
      );

      return;
    }

    if (
      readingBooks.length ===
      1
    ) {
      void saveDailyCheckin(
        [
          readingBooks[0]
            .google_book_id,
        ]
      );

      return;
    }

    setSelectedCheckinBookIds(
      []
    );

    setCheckinSheetVisible(
      true
    );
  }

  return (
    <>
      <View style={styles.cardShadow}><View style={styles.card}>
        <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.cardAccent} />
        <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.cardGlow} />
        <View
          style={
            styles.topRow
          }
        >
          <View>
            <Text
              style={
                styles.eyebrow
              }
            >
              MY READING
            </Text>

            <View
              style={
                styles.streakRow
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
                  styles.streakText
                }
              >
                {checkinState &&
                checkinState.currentStreak >
                  0
                  ? `${checkinState.currentStreak} day${checkinState.currentStreak === 1 ? '' : 's'} streak`
                  : 'Start your streak today'}
              </Text>
            </View>
          </View>

          <View style={styles.moduleMark}><Ionicons name="book-outline" size={21} color={colors.gold} /></View>
        </View>

        {checkinState
          ?.checkedIn ? (
          <View
            style={
              styles.checkedInActionRow
            }
          >
            <View
              style={[
                styles.checkinButton,
                styles.checkedInButton,
              ]}
              accessibilityRole="text"
              accessibilityLabel="Checked in for today’s reading"
            >
              <Ionicons
                name="checkmark-circle"
                size={
                  18
                }
                color={
                  colors.background
                }
              />

              <Text
                style={
                  styles.checkinButtonText
                }
              >
                Checked in
              </Text>
            </View>

            <Pressable
              disabled={
                loadingCheckin ||
                savingCheckin ||
                Boolean(
                  checkinError
                )
              }
              onPress={
                openEditDailyCheckin
              }
              accessibilityRole="button"
              accessibilityLabel="Edit book for today’s reading check-in"
              style={({
                pressed,
              }) => [
                styles.editCheckinButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="pencil-outline"
                size={
                  14
                }
                color={
                  colors.gold
                }
              />

              <Text
                style={
                  styles.editCheckinButtonText
                }
              >
                Edit book
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            disabled={
              loadingCheckin ||
              savingCheckin ||
              Boolean(
                checkinError
              )
            }
            onPress={
              openDailyCheckin
            }
            accessibilityRole="button"
            accessibilityLabel="Check in for today’s reading"
            style={({
              pressed,
            }) => [
              styles.checkinButton,
              (
                pressed ||
                loadingCheckin ||
                savingCheckin
              ) &&
                styles.pressed,
            ]}
          >
            {loadingCheckin ||
            savingCheckin ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.background
                }
              />
            ) : (
              <Ionicons
                name="checkmark-circle-outline"
                size={
                  18
                }
                color={
                  colors.background
                }
              />
            )}

            <Text
              style={
                styles.checkinButtonText
              }
            >
              Check in
            </Text>
          </Pressable>
        )}

        <View
          style={
            styles.weekRow
          }
        >
          {checkinDays.map(
            (
              item
            ) => {
              const checked =
                checkedDateSet.has(
                  item.key
                );

              const isToday =
                item.key ===
                todayCheckinKey;

              return (
                <View
                  key={
                    item.key
                  }
                  style={
                    styles.weekDay
                  }
                >
                  <Text
                    style={[
                      styles.weekDayLabel,
                      isToday &&
                        styles.weekDayLabelToday,
                    ]}
                  >
                    {
                      [
                        'S',
                        'M',
                        'T',
                        'W',
                        'T',
                        'F',
                        'S',
                      ][item.date.getDay()]
                    }
                  </Text>

                  <View
                    style={[
                      styles.dayBubble,
                      isToday &&
                        styles.dayBubbleToday,
                      checked &&
                        styles.dayBubbleChecked,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayBubbleText,
                        checked &&
                          styles.dayBubbleTextChecked,
                      ]}
                    >
                      {
                        item.date.getDate()
                      }
                    </Text>
                  </View>
                </View>
              );
            }
          )}
        </View>

        {checkinError ? (
          <Text
            style={
              styles.checkinErrorText
            }
          >
            {
              checkinError
            }
          </Text>
        ) : null}

        <View style={styles.sectionDivider} />
        <Pressable onPress={() => router.push('/reading-activity')}
          style={({ pressed }) => [styles.destination, pressed && styles.pressed]}
          accessibilityRole="button" accessibilityLabel="Open Reading Tracker">
          <View style={styles.destinationIcon}><Ionicons name="calendar-outline" size={18} color={colors.gold} /></View>
          <View style={styles.destinationCopy}>
            <Text style={styles.destinationTitle}>Reading Tracker</Text>
            <Text style={styles.destinationSubtitle}>Your reading calendar</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
        </Pressable>
        <View style={styles.destinationPair}>
          <Pressable onPress={() => router.push('/reading-recaps')}
            style={({ pressed }) => [styles.destinationLink, pressed && styles.pressed]}
            accessibilityRole="button" accessibilityLabel="Open Reading Recaps">
            <Ionicons name="sparkles-outline" size={16} color={colors.gold} />
            <Text style={styles.destinationLinkTitle}>Reading Recaps</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.mutedText} />
          </Pressable>
          <View style={styles.destinationLinkDivider} />
          <Pressable onPress={() => router.push('/reading-goals')}
            style={({ pressed }) => [styles.destinationLink, pressed && styles.pressed]}
            accessibilityRole="button" accessibilityLabel="Open Reading Goals">
            <Ionicons name="flag-outline" size={16} color={colors.gold} />
            <Text style={styles.destinationLinkTitle}>Reading Goals</Text>
            <Ionicons name="chevron-forward" size={13} color={colors.mutedText} />
          </Pressable>
        </View>
      </View></View>

      <DailyCheckinSheet
        visible={
          checkinSheetVisible
        }
        books={
          checkinPickerBooks
        }
        selectedBookIds={
          selectedCheckinBookIds
        }
        busy={
          savingCheckin
        }
        editing={
          editingCheckin
        }
        onToggleBook={
          toggleCheckinBook
        }
        onConfirm={async () => {
          if (
            editingCheckin
          ) {
            await saveEditedDailyCheckin(
              selectedCheckinBookIds
            );

            return;
          }

          await saveDailyCheckin(
            selectedCheckinBookIds
          );
        }}
        onDismiss={() => {
          setCheckinSheetVisible(
            false
          );

          setSelectedCheckinBookIds(
            []
          );

          setEditingCheckin(
            false
          );
        }}
      />
    </>
  );
}

function createStyles(
  colors:
    NovoriColors
) {
  return StyleSheet.create({
    cardShadow: { marginTop: 12, borderRadius: 18, backgroundColor: colors.surface,
      shadowColor: '#000000', shadowOpacity: 0.13, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: `${colors.gold}40`, borderRadius: 18, padding: 14, overflow: 'hidden' },
    cardAccent: { position: 'absolute', top: 0, left: 16, right: 16, height: 2, borderRadius: 2, backgroundColor: colors.gold, opacity: 0.85 },
    cardGlow: { position: 'absolute', top: -55, right: -35, width: 160, height: 160, borderRadius: 80, backgroundColor: colors.gold, opacity: 0.035 },
    moduleMark: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, borderColor: `${colors.gold}40`,
      backgroundColor: `${colors.gold}16`, alignItems: 'center', justifyContent: 'center' },

    topRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
      gap:
        12,
    },

    eyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        9,
      letterSpacing:
        1,
    },

    streakRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        5,
      marginTop:
        5,
    },

    streakText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
    },

    checkinButton: {
      minHeight:
        44,
      borderRadius:
        13,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
      flexDirection:
        'row',
      gap:
        7,
      marginTop:
        13,
    },

    checkedInActionRow: {
      flexDirection:
        'row',
      alignItems:
        'stretch',
      gap:
        8,
      marginTop:
        13,
    },

    checkedInButton: {
      flex:
        1,
      marginTop:
        0,
    },

    editCheckinButton: {
      minHeight:
        44,
      borderRadius:
        13,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.elevated,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        5,
      paddingHorizontal:
        12,
    },

    editCheckinButtonText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        10.5,
    },

    checkinButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        12.5,
    },

    weekRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
      marginTop:
        14,
    },

    weekDay: {
      alignItems:
        'center',
      gap:
        5,
      flex:
        1,
    },

    weekDayLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        9.5,
    },

    weekDayLabelToday: {
      color:
        colors.gold,
    },

    dayBubble: {
      width:
        30,
      height:
        30,
      borderRadius:
        15,
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

    dayBubbleToday: {
      borderColor:
        colors.gold,
    },

    dayBubbleChecked: {
      borderColor:
        colors.gold,
      backgroundColor:
        colors.gold,
    },

    dayBubbleText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        10.5,
    },

    dayBubbleTextChecked: {
      color:
        colors.background,
    },

    checkinErrorText: {
      color:
        colors.danger,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        10.5,
      textAlign:
        'center',
      marginTop:
        9,
    },

    sectionDivider: {
      height:
        1,
      backgroundColor:
        colors.border,
      marginTop:
        15,
      marginBottom:
        4,
    },

    destination: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6 },
    destinationIcon: { width: 28, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    destinationCopy: { flex: 1, paddingRight: 8 },
    destinationTitle: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 12.5 },
    destinationSubtitle: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10.5, marginTop: 2 },
    destinationPair: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    destinationLink: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, paddingVertical: 10 },
    destinationLinkDivider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: colors.border, marginHorizontal: 5 },
    destinationLinkTitle: { flex: 1, color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 11.5, lineHeight: 16 },

    pressed: {
      opacity:
        0.68,
    },
  });
}
