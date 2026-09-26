import { Ionicons } from '@expo/vector-icons';
import {
    useFocusEffect,
    useLocalSearchParams,
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
    Alert,
    Animated,
    Easing,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import {
    NovoriColors,
} from '../../constants/novori-theme';
import {
    useNovoriTheme,
} from '../../context/theme-context';
import {
    addReadingNote,
    getReadingDetails,
    ReadingCheckpoint,
    ReadingDetailsData,
    saveReadingCheckpoint,
    saveReadingSummary,
    updateReadingDetailsDates,
} from '../../lib/reading-details';

function formatDate(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return '';
  }

  return new Date(
    value
  ).toLocaleDateString(
    undefined,
    {
      month:
        'short',
      day:
        'numeric',
      year:
        'numeric',
    }
  );
}


function dateInputFromIso(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return '';
  }

  const date =
    new Date(
      value
    );

  const month =
    String(
      date.getMonth() +
        1
    ).padStart(
      2,
      '0'
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    );

  const year =
    date.getFullYear();

  return `${month}/${day}/${year}`;
}

function formatDateInput(
  value: string
) {
  const digits =
    value.replace(
      /\D/g,
      ''
    ).slice(
      0,
      8
    );

  if (
    digits.length <=
    2
  ) {
    return digits;
  }

  if (
    digits.length <=
    4
  ) {
    return `${digits.slice(
      0,
      2
    )}/${digits.slice(
      2
    )}`;
  }

  return `${digits.slice(
    0,
    2
  )}/${digits.slice(
    2,
    4
  )}/${digits.slice(
    4
  )}`;
}

function parseDateInput(
  value: string
) {
  const trimmed =
    value.trim();

  if (!trimmed) {
    return null;
  }

  const match =
    trimmed.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

  if (!match) {
    throw new Error(
      'Use MM/DD/YYYY for reading dates.'
    );
  }

  const month =
    Number(
      match[1]
    );

  const day =
    Number(
      match[2]
    );

  const year =
    Number(
      match[3]
    );

  const date =
    new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0
    );

  if (
    date.getFullYear() !==
      year ||
    date.getMonth() !==
      month - 1 ||
    date.getDate() !==
      day
  ) {
    throw new Error(
      'Enter a valid calendar date.'
    );
  }

  return date.toISOString();
}

function checkpointLabel(
  checkpoint:
    | ReadingCheckpoint
    | null
) {
  if (!checkpoint) {
    return 'No checkpoint saved yet';
  }

  const parts:
    string[] = [];

  if (
    checkpoint.page_number !==
    null
  ) {
    parts.push(
      `Page ${checkpoint.page_number}`
    );
  }

  if (
    checkpoint.progress_percent !==
    null
  ) {
    parts.push(
      `${checkpoint.progress_percent}%`
    );
  }

  if (
    checkpoint.chapter
  ) {
    parts.push(
      checkpoint.chapter
        .toLowerCase()
        .startsWith(
          'chapter'
        )
        ? checkpoint.chapter
        : `Chapter ${checkpoint.chapter}`
    );
  }

  return (
    parts.join(
      ' · '
    ) ||
    'Checkpoint saved'
  );
}

function parseLocationInput(
  value: string
) {
  const cleaned =
    value.trim();

  if (!cleaned) {
    return {
      pageNumber: null,
      progressPercent: null,
    };
  }

  const isPercent =
    cleaned.includes(
      '%'
    );

  const numericText =
    cleaned.replace(
      /%/g,
      ''
    ).trim();

  const number =
    Number(
      numericText
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return {
      pageNumber: null,
      progressPercent: null,
    };
  }

  return isPercent
    ? {
        pageNumber: null,
        progressPercent:
          number,
      }
    : {
        pageNumber:
          number,
        progressPercent: null,
      };
}

function checkpointInputValue(
  checkpoint:
    | ReadingCheckpoint
    | null
    | undefined
) {
  if (!checkpoint) {
    return '';
  }

  if (
    checkpoint.page_number !==
    null
  ) {
    return String(
      checkpoint.page_number
    );
  }

  if (
    checkpoint.progress_percent !==
    null
  ) {
    return `${checkpoint.progress_percent}%`;
  }

  return '';
}


function useNovoriSheet(
  onDismiss: () => void
) {
  const translateY =
    useRef(
      new Animated.Value(
        12
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

  const onDismissRef =
    useRef(
      onDismiss
    );

  onDismissRef.current =
    onDismiss;

  function finishDismiss() {
    closing.current =
      false;

    translateY.setValue(
      12
    );

    sheetOpacity.setValue(
      0
    );

    backdropOpacity.setValue(
      0
    );

    onDismissRef.current();
  }

  function animateIn() {
    closing.current =
      false;

    translateY.stopAnimation();
    sheetOpacity.stopAnimation();
    backdropOpacity.stopAnimation();

    translateY.setValue(
      12
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
            135,
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
            105,
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
            125,
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
      closing.current
    ) {
      return;
    }

    Keyboard.dismiss();

    closing.current =
      true;

    translateY.stopAnimation();
    sheetOpacity.stopAnimation();
    backdropOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(
        translateY,
        {
          toValue:
            12,
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
            120,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(({
      finished,
    }) => {
      if (
        finished
      ) {
        finishDismiss();
      } else {
        closing.current =
          false;
      }
    });
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
            if (
              gesture.dy <
              0
            ) {
              return;
            }

            const nextY =
              Math.max(
                0,
                gesture.dy
              );

            translateY.setValue(
              nextY
            );

            backdropOpacity.setValue(
              Math.max(
                0.18,
                1 -
                  nextY /
                    520
              )
            );
          },

          onPanResponderRelease: (
            _event,
            gesture
          ) => {
            const shouldDismiss =
              gesture.dy >
                88 ||
              gesture.vy >
                0.72;

            if (
              shouldDismiss
            ) {
              closing.current =
                true;

              const targetY =
                Math.max(
                  sheetHeight.current +
                    32,
                  420
                );

              Animated.parallel([
                Animated.timing(
                  translateY,
                  {
                    toValue:
                      targetY,
                    duration:
                      190,
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
                      0,
                    duration:
                      120,
                    easing:
                      Easing.out(
                        Easing.cubic
                      ),
                    useNativeDriver:
                      true,
                  }
                ),
              ]).start(({
                finished,
              }) => {
                if (
                  finished
                ) {
                  finishDismiss();
                } else {
                  closing.current =
                    false;
                }
              });

              return;
            }

            Animated.parallel([
              Animated.spring(
                translateY,
                {
                  toValue:
                    0,
                  damping:
                    24,
                  stiffness:
                    220,
                  mass:
                    0.9,
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
                    120,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver:
                    true,
                }
              ),
            ]).start();
          },

          onPanResponderTerminate: () => {
            Animated.parallel([
              Animated.spring(
                translateY,
                {
                  toValue:
                    0,
                  damping:
                    24,
                  stiffness:
                    220,
                  mass:
                    0.9,
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
                    120,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver:
                    true,
                }
              ),
            ]).start();
          },
        }),
      [
        backdropOpacity,
        translateY,
      ]
    );

  return {
    animateIn,
    backdropOpacity,
    closeSmoothly,
    panResponder,
    sheetHeight,
    sheetOpacity,
    translateY,
  };
}

export default function ReadingDetailsScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      id?: string;
    }>();

  const googleBookId =
    typeof params.id ===
    'string'
      ? params.id
      : '';

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const [
    data,
    setData,
  ] =
    useState<
      ReadingDetailsData | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    progressEditorOpen,
    setProgressEditorOpen,
  ] =
    useState(false);

  const [
    locationInput,
    setLocationInput,
  ] =
    useState('');

  const [
    chapterInput,
    setChapterInput,
  ] =
    useState('');

  const [
    checkpointNoteInput,
    setCheckpointNoteInput,
  ] =
    useState('');

  const [
    savingProgress,
    setSavingProgress,
  ] =
    useState(false);

  const [
    summaryEditorOpen,
    setSummaryEditorOpen,
  ] =
    useState(false);

  const [
    summaryInput,
    setSummaryInput,
  ] =
    useState('');

  const [
    savingSummary,
    setSavingSummary,
  ] =
    useState(false);

  const [
    noteEditorOpen,
    setNoteEditorOpen,
  ] =
    useState(false);

  const [
    noteBodyInput,
    setNoteBodyInput,
  ] =
    useState('');

  const [
    noteLocationInput,
    setNoteLocationInput,
  ] =
    useState('');

  const [
    noteChapterInput,
    setNoteChapterInput,
  ] =
    useState('');

  const [
    savingNote,
    setSavingNote,
  ] =
    useState(false);

  const [
    showAllNotes,
    setShowAllNotes,
  ] =
    useState(false);

  const [
    showHistory,
    setShowHistory,
  ] =
    useState(false);

  const [
    dateEditorVisible,
    setDateEditorVisible,
  ] =
    useState(false);

  const [
    startedDateInput,
    setStartedDateInput,
  ] =
    useState('');

  const [
    endedDateInput,
    setEndedDateInput,
  ] =
    useState('');

  const [
    savingDates,
    setSavingDates,
  ] =
    useState(false);

  const summarySheet =
    useNovoriSheet(
      () =>
        setSummaryEditorOpen(
          false
        )
    );

  const noteSheet =
    useNovoriSheet(
      () =>
        setNoteEditorOpen(
          false
        )
    );

  const historySheet =
    useNovoriSheet(
      () =>
        setShowHistory(
          false
        )
    );

  const dateSheet =
    useNovoriSheet(
      () =>
        setDateEditorVisible(
          false
        )
    );

  const loadData =
    useCallback(
      async (
        showLoader =
          true
      ) => {
        if (
          !googleBookId
        ) {
          setError(
            'This reading record could not be found.'
          );
          setLoading(
            false
          );
          return;
        }

        try {
          if (
            showLoader
          ) {
            setLoading(
              true
            );
          }

          setError(
            ''
          );

          const next =
            await getReadingDetails(
              googleBookId
            );

          setData(
            next
          );

          setSummaryInput(
            next.session
              .summary_text ??
              ''
          );
        } catch (
          loadError
        ) {
          console.error(
            'Could not load Reading Details:',
            loadError
          );

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : 'Could not load Reading Details.'
          );
        } finally {
          if (
            showLoader
          ) {
            setLoading(
              false
            );
          }
        }
      },
      [
        googleBookId,
      ]
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadData(
          true
        );
      },
      [
        loadData,
      ]
    )
  );

  const isReading =
    data?.book.status ===
    'reading';

  const isFinished =
    data?.book.status ===
    'read';

  const isDnf =
    data?.book.status ===
    'dnf';

  const resumeEyebrow =
    isFinished
      ? 'READING COMPLETED'
      : isDnf
      ? 'READING STOPPED'
      : 'YOU LEFT OFF HERE';

  const displayedNotes =
    useMemo(
      () =>
        showAllNotes
          ? data?.notes ??
            []
          : (
              data?.notes ??
              []
            ).slice(
              0,
              3
            ),
      [
        data?.notes,
        showAllNotes,
      ]
    );

  async function refresh() {
    try {
      setRefreshing(
        true
      );

      await loadData(
        false
      );
    } finally {
      setRefreshing(
        false
      );
    }
  }

  function openProgressEditor() {
    if (!data) {
      return;
    }

    const latest =
      data.latest_checkpoint;

    setLocationInput(
      checkpointInputValue(
        latest
      )
    );

    setChapterInput(
      latest?.chapter ??
      ''
    );

    setCheckpointNoteInput(
      ''
    );

    setProgressEditorOpen(
      true
    );
  }

  async function saveProgress() {
    if (
      !data ||
      savingProgress
    ) {
      return;
    }

    const {
      pageNumber,
      progressPercent,
    } =
      parseLocationInput(
        locationInput
      );

    try {
      setSavingProgress(
        true
      );

      await saveReadingCheckpoint(
        data.session.id,
        {
          pageNumber,
          progressPercent,
          chapter:
            chapterInput,
          note:
            checkpointNoteInput,
        }
      );

      setProgressEditorOpen(
        false
      );

      await loadData(
        false
      );
    } catch (
      saveError
    ) {
      Alert.alert(
        'Could not save progress',
        saveError instanceof
          Error
          ? saveError.message
          : 'Please try again.'
      );
    } finally {
      setSavingProgress(
        false
      );
    }
  }

  function openSummaryEditor() {
    setSummaryInput(
      data?.session
        .summary_text ??
        ''
    );

    setSummaryEditorOpen(
      true
    );
  }

  async function saveSummary() {
    if (
      !data ||
      savingSummary
    ) {
      return;
    }

    try {
      setSavingSummary(
        true
      );

      const session =
        await saveReadingSummary(
          data.session.id,
          summaryInput
        );

      setData(
        (
          current
        ) =>
          current
            ? {
                ...current,
                session,
              }
            : current
      );

      summarySheet.closeSmoothly();
    } catch (
      saveError
    ) {
      Alert.alert(
        'Could not save summary',
        saveError instanceof
          Error
          ? saveError.message
          : 'Please try again.'
      );
    } finally {
      setSavingSummary(
        false
      );
    }
  }

  function openNoteEditor() {
    const latest =
      data?.latest_checkpoint;

    setNoteBodyInput(
      ''
    );

    setNoteLocationInput(
      checkpointInputValue(
        latest
      )
    );

    setNoteChapterInput(
      latest?.chapter ??
      ''
    );

    setNoteEditorOpen(
      true
    );
  }

  async function saveNote() {
    if (
      !data ||
      savingNote
    ) {
      return;
    }

    try {
      setSavingNote(
        true
      );

      const {
        pageNumber,
        progressPercent,
      } =
        parseLocationInput(
          noteLocationInput
        );

      await addReadingNote(
        data.session.id,
        {
          body:
            noteBodyInput,
          pageNumber,
          progressPercent,
          chapter:
            noteChapterInput,
        }
      );

      noteSheet.closeSmoothly();

      await loadData(
        false
      );
    } catch (
      saveError
    ) {
      Alert.alert(
        'Could not save note',
        saveError instanceof
          Error
          ? saveError.message
          : 'Please try again.'
      );
    } finally {
      setSavingNote(
        false
      );
    }
  }


  function openBookPage() {
    router.push({
      pathname:
        '/book/[id]',
      params: {
        id:
          googleBookId,
        source:
          'library',
      },
    });
  }

  function openDateEditor() {
    if (!data) {
      return;
    }

    setStartedDateInput(
      dateInputFromIso(
        data.book
          .started_at
      )
    );

    if (
      data.book.status ===
      'read'
    ) {
      setEndedDateInput(
        dateInputFromIso(
          data.book
            .finished_at
        )
      );
    } else if (
      data.book.status ===
      'dnf'
    ) {
      setEndedDateInput(
        dateInputFromIso(
          data.book
            .dnf_at
        )
      );
    } else {
      setEndedDateInput(
        ''
      );
    }

    setDateEditorVisible(
      true
    );
  }

  async function saveDates() {
    if (
      !data ||
      savingDates
    ) {
      return;
    }

    try {
      const startedAt =
        parseDateInput(
          startedDateInput
        );

      let finishedAt =
        data.book
          .finished_at;

      let dnfAt =
        data.book
          .dnf_at;

      if (
        data.book.status ===
        'reading'
      ) {
        finishedAt =
          null;
        dnfAt =
          null;
      }

      if (
        data.book.status ===
        'read'
      ) {
        finishedAt =
          parseDateInput(
            endedDateInput
          );

        if (!finishedAt) {
          throw new Error(
            'A finished date is required for a finished book.'
          );
        }

        dnfAt =
          null;
      }

      if (
        data.book.status ===
        'dnf'
      ) {
        dnfAt =
          parseDateInput(
            endedDateInput
          );

        if (!dnfAt) {
          throw new Error(
            'A stopped date is required for a DNF book.'
          );
        }

        finishedAt =
          null;
      }

      const endDate =
        data.book.status ===
        'read'
          ? finishedAt
          : data.book
              .status ===
            'dnf'
          ? dnfAt
          : null;

      if (
        startedAt &&
        endDate &&
        new Date(
          endDate
        ).getTime() <
          new Date(
            startedAt
          ).getTime()
      ) {
        throw new Error(
          'The ending date cannot be before the started date.'
        );
      }

      setSavingDates(
        true
      );

      const updatedBook =
        await updateReadingDetailsDates(
          data.session.id,
          googleBookId,
          data.book.status,
          startedAt,
          finishedAt,
          dnfAt
        );

      setData(
        (
          current
        ) =>
          current
            ? {
                ...current,
                book:
                  updatedBook,
                session: {
                  ...current.session,
                  started_at:
                    startedAt,
                  finished_at:
                    data.book
                        .status ===
                      'read'
                      ? finishedAt
                      : null,
                  dnf_at:
                    data.book
                        .status ===
                      'dnf'
                      ? dnfAt
                      : null,
                },
              }
            : current
      );

      dateSheet.closeSmoothly();
    } catch (
      dateError
    ) {
      Alert.alert(
        'Check reading dates',
        dateError instanceof
          Error
          ? dateError.message
          : 'Novori could not update these dates.'
      );
    } finally {
      setSavingDates(
        false
      );
    }
  }

  function noteLocation(
    page:
      | number
      | null,
    percent:
      | number
      | null,
    chapter:
      | string
      | null
  ) {
    const parts:
      string[] = [];

    if (
      page !==
      null
    ) {
      parts.push(
        `Page ${page}`
      );
    }

    if (
      percent !==
      null
    ) {
      parts.push(
        `${percent}%`
      );
    }

    if (chapter) {
      parts.push(
        chapter
          .toLowerCase()
          .startsWith(
            'chapter'
          )
          ? chapter
          : `Chapter ${chapter}`
      );
    }

    return parts.join(
      ' · '
    );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.screen
        }
      >
        <View
          style={
            styles.centerState
          }
        >
          <ActivityIndicator
            color={
              colors.gold
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  if (
    error ||
    !data
  ) {
    return (
      <SafeAreaView
        style={
          styles.screen
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
            hitSlop={10}
            style={
              styles.headerButton
            }
          >
            <Ionicons
              name="chevron-back"
              size={24}
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
            Reading Details
          </Text>

          <View
            style={
              styles.headerButton
            }
          />
        </View>

        <View
          style={
            styles.centerState
          }
        >
          <Ionicons
            name="book-outline"
            size={30}
            color={
              colors.mutedText
            }
          />

          <Text
            style={
              styles.errorText
            }
          >
            {
              error ||
              'Could not load Reading Details.'
            }
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const authorText =
    data.book.authors
      ?.join(
        ', '
      ) ||
    'Unknown author';

  const statusLabel =
    data.book.status ===
      'reading'
      ? 'Currently Reading'
      : data.book.status ===
        'read'
      ? 'Finished'
      : 'Did Not Finish';

  return (
    <SafeAreaView
      style={
        styles.screen
      }
    >
      <KeyboardAvoidingView
        style={
          styles.screen
        }
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
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
            hitSlop={10}
            style={
              styles.headerButton
            }
          >
            <Ionicons
              name="chevron-back"
              size={24}
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
            Reading Details
          </Text>

          <View
            style={
              styles.headerButton
            }
          />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                refresh
              }
              tintColor={
                colors.gold
              }
            />
          }
          contentContainerStyle={
            styles.content
          }
        >
          <View
            style={
              styles.bookHeader
            }
          >
            {data.book
              .cover_url ? (
              <Image
                source={{
                  uri:
                    data.book
                      .cover_url,
                }}
                style={
                  styles.cover
                }
              />
            ) : (
              <View
                style={[
                  styles.cover,
                  styles.coverFallback,
                ]}
              >
                <Ionicons
                  name="book-outline"
                  size={32}
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
                numberOfLines={3}
                style={
                  styles.bookTitle
                }
              >
                {
                  data.book
                    .title
                }
              </Text>

              <Text
                numberOfLines={2}
                style={
                  styles.bookAuthor
                }
              >
                {
                  authorText
                }
              </Text>

              <View
                style={
                  styles.statusPill
                }
              >
                <Text
                  style={
                    styles.statusPillText
                  }
                >
                  {
                    statusLabel
                  }
                </Text>
              </View>

              <Pressable
                onPress={
                  openBookPage
                }
                hitSlop={8}
                style={({
                  pressed,
                }) => [
                  styles.openBookAction,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Ionicons
                  name="open-outline"
                  size={14}
                  color={
                    colors.gold
                  }
                />

                <Text
                  style={
                    styles.openBookActionText
                  }
                >
                  Open Book
                </Text>
              </Pressable>
            </View>
          </View>

          <View
            style={
              styles.timelineCard
            }
          >
            <View
              style={
                styles.timelineHeader
              }
            >
              <Text
                style={
                  styles.timelineHeaderText
                }
              >
                Reading dates
              </Text>

              <Pressable
                onPress={
                  openDateEditor
                }
                hitSlop={8}
                style={({
                  pressed,
                }) => [
                  styles.timelineEditButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={14}
                  color={
                    colors.gold
                  }
                />

                <Text
                  style={
                    styles.timelineEditText
                  }
                >
                  Edit
                </Text>
              </Pressable>
            </View>

            <View
              style={
                styles.timelineDatesRow
              }
            >
              <View
                style={
                  styles.timelineItem
                }
              >
                <Text
                  style={
                    styles.timelineLabel
                  }
                >
                  Started
                </Text>

                <Text
                  style={
                    styles.timelineValue
                  }
                >
                  {
                    data.book
                      .started_at
                      ? formatDate(
                          data.book
                            .started_at
                        )
                      : 'Not recorded'
                  }
                </Text>
              </View>

              <View
                style={
                  styles.timelineDivider
                }
              />

              <View
                style={
                  styles.timelineItem
                }
              >
                <Text
                  style={
                    styles.timelineLabel
                  }
                >
                  {
                    data.book
                        .status ===
                      'dnf'
                      ? 'Stopped'
                      : 'Finished'
                  }
                </Text>

                <Text
                  style={
                    styles.timelineValue
                  }
                >
                  {
                    data.book
                        .status ===
                      'dnf'
                      ? data.book
                          .dnf_at
                        ? formatDate(
                            data.book
                              .dnf_at
                          )
                        : 'Not recorded'
                      : data.book
                          .finished_at
                      ? formatDate(
                          data.book
                            .finished_at
                        )
                      : data.book
                          .status ===
                        'reading'
                      ? 'In progress'
                      : 'Not finished'
                  }
                </Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.card,
              styles.resumeCard,
            ]}
          >
            <View
              style={
                styles.cardHeadingRow
              }
            >
              <View>
                <Text
                  style={
                    styles.eyebrow
                  }
                >
                  {
                    resumeEyebrow
                  }
                </Text>

                <Text
                  style={
                    styles.resumeValue
                  }
                >
                  {
                    checkpointLabel(
                      data.latest_checkpoint
                    )
                  }
                </Text>

                <Text
                  style={
                    styles.resumeMeta
                  }
                >
                  {
                    data.latest_checkpoint
                      ? isFinished
                        ? `Final checkpoint · ${formatDate(
                            data.latest_checkpoint
                              .created_at
                          )}`
                        : isDnf
                        ? `Last checkpoint · ${formatDate(
                            data.latest_checkpoint
                              .created_at
                          )}`
                        : `Updated ${formatDate(
                            data.latest_checkpoint
                              .created_at
                          )}`
                      : isFinished
                      ? 'This reading session is complete.'
                      : isDnf
                      ? 'No checkpoint was saved before this reading session ended.'
                      : 'Save your first checkpoint whenever you stop reading.'
                  }
                </Text>
              </View>

              <View
                style={
                  styles.resumeIcon
                }
              >
                <Ionicons
                  name="bookmark-outline"
                  size={20}
                  color={
                    colors.gold
                  }
                />
              </View>
            </View>

            {data
              .latest_checkpoint
              ?.checkpoint_note ? (
              <Text
                style={
                  styles.checkpointNote
                }
              >
                {
                  data.latest_checkpoint
                    .checkpoint_note
                }
              </Text>
            ) : null}

            {isReading ? (
              <Pressable
                onPress={
                  openProgressEditor
                }
                style={({
                  pressed,
                }) => [
                  styles.primaryButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={
                    colors.background
                  }
                />

                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Update progress
                </Text>
              </Pressable>
            ) : (
              <Text
                style={
                  styles.completedHint
                }
              >
                {
                  isFinished
                    ? 'Your completed reading record is preserved here.'
                    : 'Your reading record is preserved here.'
                }
              </Text>
            )}
          </View>

          {progressEditorOpen ? (
            <View
              style={
                styles.editorCard
              }
            >
              <View
                style={
                  styles.editorHeader
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Update progress
                </Text>

                <Pressable
                  onPress={() =>
                    setProgressEditorOpen(
                      false
                    )
                  }
                  hitSlop={8}
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={
                      colors.mutedText
                    }
                  />
                </Pressable>
              </View>

              <Text
                style={
                  styles.editorHelp
                }
              >
                Enter a page number like 214, or a percentage like 63%.
              </Text>

              <Text
                style={
                  styles.fieldLabel
                }
              >
                Page / %
              </Text>

              <TextInput
                value={
                  locationInput
                }
                onChangeText={
                  setLocationInput
                }
                keyboardType="numbers-and-punctuation"
                placeholder="Page / %"
                placeholderTextColor={
                  colors.mutedText
                }
                style={
                  styles.input
                }
              />

              <View
                style={
                  styles.fieldSpacer
                }
              />

              <Text
                style={
                  styles.fieldLabelNoTop
                }
              >
                Chapter
              </Text>

              <TextInput
                value={
                  chapterInput
                }
                onChangeText={
                  setChapterInput
                }
                placeholder="Chapter"
                placeholderTextColor={
                  colors.mutedText
                }
                style={
                  styles.input
                }
              />

              <Text
                style={
                  styles.fieldLabel
                }
              >
                Quick note
              </Text>

              <TextInput
                value={
                  checkpointNoteInput
                }
                onChangeText={
                  setCheckpointNoteInput
                }
                multiline
                placeholder="Stopped after the argument at the inn..."
                placeholderTextColor={
                  colors.mutedText
                }
                style={[
                  styles.input,
                  styles.multilineInput,
                ]}
              />

              <Pressable
                onPress={() =>
                  void saveProgress()
                }
                disabled={
                  savingProgress
                }
                style={({
                  pressed,
                }) => [
                  styles.primaryButton,
                  (
                    pressed ||
                    savingProgress
                  ) &&
                    styles.pressed,
                ]}
              >
                {savingProgress ? (
                  <ActivityIndicator
                    color={
                      colors.background
                    }
                  />
                ) : (
                  <>
                    <Ionicons
                      name="bookmark-outline"
                      size={18}
                      color={
                        colors.background
                      }
                    />

                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      Save checkpoint
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}

          <View
            style={
              styles.card
            }
          >
            <View
              style={
                styles.sectionHeader
              }
            >
              <View
                style={
                  styles.sectionHeaderCopy
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  My summary
                </Text>

                <Text
                  style={
                    styles.sectionSubtitle
                  }
                >
                  A private refresher for when you come back later.
                </Text>
              </View>

              <Pressable
                onPress={
                  openSummaryEditor
                }
                hitSlop={8}
                style={({
                  pressed,
                }) => [
                  styles.textAction,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.textActionText
                  }
                >
                  {
                    data.session
                      .summary_text
                      ? 'Edit'
                      : 'Add'
                  }
                </Text>
              </Pressable>
            </View>

            {data.session
              .summary_text ? (
              <Text
                style={
                  styles.summaryText
                }
              >
                {
                  data.session
                    .summary_text
                }
              </Text>
            ) : (
              <Text
                style={
                  styles.emptySectionText
                }
              >
                No summary yet. Add a few lines about what you want to remember.
              </Text>
            )}
          </View>

          <View
            style={
              styles.card
            }
          >
            <View
              style={
                styles.sectionHeader
              }
            >
              <View
                style={
                  styles.sectionHeaderCopy
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Notes
                </Text>

                <Text
                  style={
                    styles.sectionSubtitle
                  }
                >
                  Private thoughts tied to this read.
                </Text>
              </View>

              <Pressable
                onPress={
                  openNoteEditor
                }
                hitSlop={8}
                style={({
                  pressed,
                }) => [
                  styles.textAction,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.textActionText
                  }
                >
                  Add
                </Text>
              </Pressable>
            </View>

            {displayedNotes.length >
            0 ? (
              <View
                style={
                  styles.noteList
                }
              >
                {displayedNotes.map(
                  (
                    note
                  ) => {
                    const location =
                      noteLocation(
                        note.page_number,
                        note.progress_percent,
                        note.chapter
                      );

                    return (
                      <View
                        key={
                          note.id
                        }
                        style={
                          styles.noteItem
                        }
                      >
                        <View
                          style={
                            styles.noteMetaRow
                          }
                        >
                          <Text
                            style={
                              styles.noteDate
                            }
                          >
                            {
                              formatDate(
                                note.created_at
                              )
                            }
                          </Text>

                          {location ? (
                            <Text
                              style={
                                styles.noteLocation
                              }
                            >
                              {
                                location
                              }
                            </Text>
                          ) : null}
                        </View>

                        <Text
                          style={
                            styles.noteBody
                          }
                        >
                          {
                            note.body
                          }
                        </Text>
                      </View>
                    );
                  }
                )}

                {(data.notes
                  .length >
                  3) ? (
                  <Pressable
                    onPress={() =>
                      setShowAllNotes(
                        (
                          current
                        ) =>
                          !current
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.inlineLink,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <Text
                      style={
                        styles.inlineLinkText
                      }
                    >
                      {
                        showAllNotes
                          ? 'Show fewer notes'
                          : `View all ${data.notes.length} notes`
                      }
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text
                style={
                  styles.emptySectionText
                }
              >
                No private notes yet.
              </Text>
            )}
          </View>

          <View
            style={
              styles.card
            }
          >
            <Pressable
              onPress={() =>
                setShowHistory(
                  true
                )
              }
              style={({
                pressed,
              }) => [
                styles.historyHeader,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={
                  styles.sectionHeaderCopy
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Reading history
                </Text>

                <Text
                  style={
                    styles.sectionSubtitle
                  }
                >
                  {
                    data.checkpoints
                      .length
                  } {
                    data.checkpoints
                      .length ===
                    1
                      ? 'checkpoint'
                      : 'checkpoints'
                  }
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={19}
                color={
                  colors.mutedText
                }
              />
            </Pressable>
          </View>

          <Text
            style={
              styles.privateFooter
            }
          >
            <Ionicons
              name="lock-closed-outline"
              size={12}
              color={
                colors.mutedText
              }
            />{' '}
            Reading Details are private to you.
          </Text>
        </ScrollView>

        <Modal
          visible={
            dateEditorVisible
          }
          transparent
          animationType="none"
          onShow={
            dateSheet.animateIn
          }
          onRequestClose={
            dateSheet.closeSmoothly
          }
        >
          <KeyboardAvoidingView
            style={
              styles.modalKeyboardHost
            }
            behavior={
              Platform.OS ===
              'ios'
                ? 'padding'
                : undefined
            }
          >
            <Pressable
              style={
                styles.modalBackdrop
              }
              onPress={
                dateSheet.closeSmoothly
              }
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.modalBackdropVisual,
                  {
                    opacity:
                      dateSheet.backdropOpacity,
                  },
                ]}
              />

              <Animated.View
                {...dateSheet.panResponder.panHandlers}
                onLayout={(event) => {
                  dateSheet.sheetHeight.current =
                    event.nativeEvent.layout.height;
                }}
                style={[
                  styles.modalSheet,
                  styles.dateModalSheet,
                  {
                    opacity:
                      dateSheet.sheetOpacity,
                    transform: [
                      {
                        translateY:
                          dateSheet.translateY,
                      },
                    ],
                  },
                ]}
              >
                <Pressable
                  onPress={(event) =>
                    event.stopPropagation()
                  }
                >
                  <View
                    style={
                      styles.modalHandle
                    }
                  />

                  <View
                    style={
                      styles.modalHeader
                    }
                  >
                    <View
                      style={
                        styles.modalHeaderCopy
                      }
                    >
                      <Text
                        style={
                          styles.modalTitle
                        }
                      >
                        Edit reading dates
                      </Text>

                      <Text
                        style={
                          styles.modalSubtitle
                        }
                      >
                        Adjust dates if you started or finished on a different day.
                      </Text>
                    </View>

                    <Pressable
                      onPress={
                        dateSheet.closeSmoothly
                      }
                      hitSlop={8}
                      disabled={
                        savingDates
                      }
                      style={
                        styles.modalCloseButton
                      }
                    >
                      <Ionicons
                        name="close"
                        size={20}
                        color={
                          colors.mutedText
                        }
                      />
                    </Pressable>
                  </View>

                  <Text
                    style={
                      styles.fieldLabelNoTop
                    }
                  >
                    Started
                  </Text>

                  <TextInput
                    value={
                      startedDateInput
                    }
                    onChangeText={(value) =>
                      setStartedDateInput(
                        formatDateInput(
                          value
                        )
                      )
                    }
                    keyboardType="number-pad"
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor={
                      colors.mutedText
                    }
                    maxLength={10}
                    autoCorrect={false}
                    style={
                      styles.input
                    }
                  />

                  <Text
                    style={
                      styles.dateInputHint
                    }
                  >
                    Leave blank if you do not know the start date.
                  </Text>

                  {data.book.status ===
                    'read' ||
                  data.book.status ===
                    'dnf' ? (
                    <View
                      style={
                        styles.dateEndField
                      }
                    >
                      <Text
                        style={
                          styles.fieldLabelNoTop
                        }
                      >
                        {
                          data.book
                              .status ===
                            'read'
                            ? 'Finished'
                            : 'Stopped'
                        }
                      </Text>

                      <TextInput
                        value={
                          endedDateInput
                        }
                        onChangeText={(value) =>
                          setEndedDateInput(
                            formatDateInput(
                              value
                            )
                          )
                        }
                        keyboardType="number-pad"
                        placeholder="MM/DD/YYYY"
                        placeholderTextColor={
                          colors.mutedText
                        }
                        maxLength={10}
                        autoCorrect={false}
                        style={
                          styles.input
                        }
                      />
                    </View>
                  ) : null}

                  <View
                    style={
                      styles.modalActions
                    }
                  >
                    <Pressable
                      onPress={
                        dateSheet.closeSmoothly
                      }
                      disabled={
                        savingDates
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.secondaryButton,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      <Text
                        style={
                          styles.secondaryButtonText
                        }
                      >
                        Cancel
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        void saveDates()
                      }
                      disabled={
                        savingDates
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.smallPrimaryButton,
                        (
                          pressed ||
                          savingDates
                        ) &&
                          styles.pressed,
                      ]}
                    >
                      {savingDates ? (
                        <ActivityIndicator
                          color={
                            colors.background
                          }
                        />
                      ) : (
                        <Text
                          style={
                            styles.primaryButtonText
                          }
                        >
                          Save dates
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </Pressable>
              </Animated.View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={
            summaryEditorOpen
          }
          transparent
          animationType="none"
          onShow={
            summarySheet.animateIn
          }
          onRequestClose={
            summarySheet.closeSmoothly
          }
        >
          <KeyboardAvoidingView
            style={
              styles.modalKeyboardHost
            }
            behavior={
              Platform.OS ===
              'ios'
                ? 'padding'
                : undefined
            }
          >
            <Pressable
              style={
                styles.modalBackdrop
              }
              onPress={
                summarySheet.closeSmoothly
              }
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.modalBackdropVisual,
                  {
                    opacity:
                      summarySheet.backdropOpacity,
                  },
                ]}
              />

              <Animated.View
                {...summarySheet.panResponder.panHandlers}
                onLayout={(event) => {
                  summarySheet.sheetHeight.current =
                    event.nativeEvent.layout.height;
                }}
                style={[
                  styles.modalSheet,
                  {
                    opacity:
                      summarySheet.sheetOpacity,
                    transform: [
                      {
                        translateY:
                          summarySheet.translateY,
                      },
                    ],
                  },
                ]}
              >
                <Pressable
                  onPress={(event) =>
                    event.stopPropagation()
                  }
                >
              <View
                style={
                  styles.modalHandle
                }
              />

              <View
                style={
                  styles.modalHeader
                }
              >
                <View
                  style={
                    styles.modalHeaderCopy
                  }
                >
                  <Text
                    style={
                      styles.modalTitle
                    }
                  >
                    My summary
                  </Text>

                  <Text
                    style={
                      styles.modalSubtitle
                    }
                  >
                    A private refresher for your future self.
                  </Text>
                </View>

                <Pressable
                  onPress={
                    summarySheet.closeSmoothly
                  }
                  hitSlop={8}
                  style={
                    styles.modalCloseButton
                  }
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={
                      colors.mutedText
                    }
                  />
                </Pressable>
              </View>

              <TextInput
                value={
                  summaryInput
                }
                onChangeText={
                  setSummaryInput
                }
                multiline
                placeholder="Write what you want to remember about the story so far..."
                placeholderTextColor={
                  colors.mutedText
                }
                style={[
                  styles.input,
                  styles.modalSummaryInput,
                ]}
              />

              <View
                style={
                  styles.modalActions
                }
              >
                <Pressable
                  onPress={
                    summarySheet.closeSmoothly
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.secondaryButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={
                      styles.secondaryButtonText
                    }
                  >
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    void saveSummary()
                  }
                  disabled={
                    savingSummary
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.smallPrimaryButton,
                    (
                      pressed ||
                      savingSummary
                    ) &&
                      styles.pressed,
                  ]}
                >
                  {savingSummary ? (
                    <ActivityIndicator
                      color={
                        colors.background
                      }
                    />
                  ) : (
                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      Save
                    </Text>
                  )}
                </Pressable>
              </View>
                </Pressable>
              </Animated.View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={
            noteEditorOpen
          }
          transparent
          animationType="none"
          onShow={
            noteSheet.animateIn
          }
          onRequestClose={
            noteSheet.closeSmoothly
          }
        >
          <KeyboardAvoidingView
            style={
              styles.modalKeyboardHost
            }
            behavior={
              Platform.OS ===
              'ios'
                ? 'padding'
                : undefined
            }
          >
            <Pressable
              style={
                styles.modalBackdrop
              }
              onPress={
                noteSheet.closeSmoothly
              }
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.modalBackdropVisual,
                  {
                    opacity:
                      noteSheet.backdropOpacity,
                  },
                ]}
              />

              <Animated.View
                {...noteSheet.panResponder.panHandlers}
                onLayout={(event) => {
                  noteSheet.sheetHeight.current =
                    event.nativeEvent.layout.height;
                }}
                style={[
                  [styles.modalSheet, styles.noteModalSheet],
                  {
                    opacity:
                      noteSheet.sheetOpacity,
                    transform: [
                      {
                        translateY:
                          noteSheet.translateY,
                      },
                    ],
                  },
                ]}
              >
                <Pressable
                  onPress={(event) =>
                    event.stopPropagation()
                  }
                >
              <View
                style={
                  styles.modalHandle
                }
              />

              <View
                style={
                  styles.modalHeader
                }
              >
                <View
                  style={
                    styles.modalHeaderCopy
                  }
                >
                  <Text
                    style={
                      styles.modalTitle
                    }
                  >
                    Add note
                  </Text>

                  <Text
                    style={
                      styles.modalSubtitle
                    }
                  >
                    Private to you. Location is optional.
                  </Text>
                </View>

                <Pressable
                  onPress={
                    noteSheet.closeSmoothly
                  }
                  hitSlop={8}
                  style={
                    styles.modalCloseButton
                  }
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={
                      colors.mutedText
                    }
                  />
                </Pressable>
              </View>

              <Text
                style={
                  styles.fieldLabelNoTop
                }
              >
                Note
              </Text>

              <TextInput
                value={
                  noteBodyInput
                }
                onChangeText={
                  setNoteBodyInput
                }
                multiline
                placeholder="What do you want to remember?"
                placeholderTextColor={
                  colors.mutedText
                }
                style={[
                  styles.input,
                  styles.noteBodyInput,
                ]}
              />

              <View
                style={
                  styles.noteLocationRow
                }
              >
                <View
                  style={
                    styles.noteLocationField
                  }
                >
                  <Text
                    style={
                      styles.fieldLabelNoTop
                    }
                  >
                    Page / %
                  </Text>

                  <TextInput
                    value={
                      noteLocationInput
                    }
                    onChangeText={
                      setNoteLocationInput
                    }
                    keyboardType="numbers-and-punctuation"
                    placeholder="Page / %"
                    placeholderTextColor={
                      colors.mutedText
                    }
                    style={
                      styles.input
                    }
                  />
                </View>

                <View
                  style={
                    styles.noteChapterField
                  }
                >
                  <Text
                    style={
                      styles.fieldLabelNoTop
                    }
                  >
                    Chapter
                  </Text>

                  <TextInput
                    value={
                      noteChapterInput
                    }
                    onChangeText={
                      setNoteChapterInput
                    }
                    placeholder="Chapter"
                    placeholderTextColor={
                      colors.mutedText
                    }
                    style={
                      styles.input
                    }
                  />
                </View>
              </View>

              <Text
                style={
                  styles.locationHint
                }
              >
                Example: 214 for a page, or 63% for Kindle progress.
              </Text>

              <View
                style={
                  styles.modalActions
                }
              >
                <Pressable
                  onPress={
                    noteSheet.closeSmoothly
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.secondaryButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={
                      styles.secondaryButtonText
                    }
                  >
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    void saveNote()
                  }
                  disabled={
                    savingNote
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.smallPrimaryButton,
                    (
                      pressed ||
                      savingNote
                    ) &&
                      styles.pressed,
                  ]}
                >
                  {savingNote ? (
                    <ActivityIndicator
                      color={
                        colors.background
                      }
                    />
                  ) : (
                    <Text
                      style={
                        styles.primaryButtonText
                      }
                    >
                      Save note
                    </Text>
                  )}
                </Pressable>
              </View>
                </Pressable>
              </Animated.View>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={
            showHistory
          }
          transparent
          animationType="none"
          onShow={
            historySheet.animateIn
          }
          onRequestClose={
            historySheet.closeSmoothly
          }
        >
          <View
            style={
              styles.modalKeyboardHost
            }
          >
            <Pressable
              style={
                styles.modalBackdrop
              }
              onPress={
                historySheet.closeSmoothly
              }
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.modalBackdropVisual,
                  {
                    opacity:
                      historySheet.backdropOpacity,
                  },
                ]}
              />

              <Animated.View
                {...historySheet.panResponder.panHandlers}
                onLayout={(event) => {
                  historySheet.sheetHeight.current =
                    event.nativeEvent.layout.height;
                }}
                style={[
                  [styles.modalSheet, styles.historyModalSheet],
                  {
                    opacity:
                      historySheet.sheetOpacity,
                    transform: [
                      {
                        translateY:
                          historySheet.translateY,
                      },
                    ],
                  },
                ]}
              >
                <Pressable
                  onPress={(event) =>
                    event.stopPropagation()
                  }
                >
              <View
                style={
                  styles.modalHandle
                }
              />

              <View
                style={
                  styles.modalHeader
                }
              >
                <View
                  style={
                    styles.modalHeaderCopy
                  }
                >
                  <Text
                    style={
                      styles.modalTitle
                    }
                  >
                    Reading history
                  </Text>

                  <Text
                    style={
                      styles.modalSubtitle
                    }
                  >
                    {
                      data.checkpoints
                        .length
                    } {
                      data.checkpoints
                        .length ===
                      1
                        ? 'checkpoint'
                        : 'checkpoints'
                    }
                  </Text>
                </View>

                <Pressable
                  onPress={
                    historySheet.closeSmoothly
                  }
                  hitSlop={8}
                  style={
                    styles.modalCloseButton
                  }
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={
                      colors.mutedText
                    }
                  />
                </Pressable>
              </View>

              {data.checkpoints
                .length >
              0 ? (
                <ScrollView
                  style={
                    styles.historyModalScroll
                  }
                  contentContainerStyle={
                    styles.historyModalContent
                  }
                  showsVerticalScrollIndicator={
                    false
                  }
                >
                  {data.checkpoints.map(
                    (
                      checkpoint
                    ) => (
                      <View
                        key={
                          checkpoint.id
                        }
                        style={
                          styles.historyItem
                        }
                      >
                        <View
                          style={
                            styles.historyDot
                          }
                        />

                        <View
                          style={
                            styles.historyCopy
                          }
                        >
                          <Text
                            style={
                              styles.historyValue
                            }
                          >
                            {
                              checkpointLabel(
                                checkpoint
                              )
                            }
                          </Text>

                          <Text
                            style={
                              styles.historyDate
                            }
                          >
                            {
                              formatDate(
                                checkpoint.created_at
                              )
                            }
                          </Text>

                          {checkpoint
                            .checkpoint_note ? (
                            <Text
                              style={
                                styles.historyNote
                              }
                            >
                              {
                                checkpoint
                                  .checkpoint_note
                              }
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    )
                  )}
                </ScrollView>
              ) : (
                <Text
                  style={
                    styles.emptyModalText
                  }
                >
                  Your checkpoints will appear here as you update your progress.
                </Text>
              )}
                </Pressable>
              </Animated.View>
            </Pressable>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    screen: {
      flex:
        1,
      backgroundColor:
        colors.background,
    },
    header: {
      minHeight:
        52,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      paddingHorizontal:
        12,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },
    headerButton: {
      width:
        40,
      height:
        40,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    headerTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        16,
    },
    content: {
      padding:
        18,
      paddingBottom:
        48,
    },
    centerState: {
      flex:
        1,
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        12,
      padding:
        24,
    },
    errorText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        14,
      textAlign:
        'center',
    },
    bookHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom:
        18,
    },
    cover: {
      width:
        92,
      height:
        138,
      borderRadius:
        10,
      backgroundColor:
        colors.elevated,
    },
    coverFallback: {
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    bookCopy: {
      flex:
        1,
      minWidth:
        0,
      marginLeft:
        16,
    },
    bookTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        24,
      lineHeight:
        29,
    },
    bookAuthor: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13,
      marginTop:
        6,
    },
    statusPill: {
      alignSelf:
        'flex-start',
      marginTop:
        12,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      borderRadius:
        999,
      paddingHorizontal:
        10,
      paddingVertical:
        5,
    },
    openBookAction: {
      alignSelf:
        'flex-start',
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        5,
      marginTop:
        10,
      paddingVertical:
        4,
    },
    openBookActionText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11.5,
    },
    statusPillText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
    },
    timelineCard: {
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        16,
      paddingVertical:
        13,
      paddingHorizontal:
        16,
      marginBottom:
        14,
    },
    timelineHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      paddingBottom:
        11,
      marginBottom:
        12,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },
    timelineHeaderText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
    },
    timelineEditButton: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        4,
      paddingVertical:
        3,
      paddingHorizontal:
        2,
    },
    timelineEditText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11.5,
    },
    timelineDatesRow: {
      flexDirection:
        'row',
      alignItems:
        'stretch',
    },
    timelineItem: {
      flex:
        1,
      minWidth:
        0,
    },
    timelineLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        10.5,
      marginBottom:
        5,
    },
    timelineValue: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
    },
    timelineDivider: {
      width:
        StyleSheet.hairlineWidth,
      backgroundColor:
        colors.border,
      marginHorizontal:
        16,
    },

    card: {
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        18,
      padding:
        16,
      marginBottom:
        14,
    },
    resumeCard: {
      padding:
        18,
    },
    cardHeadingRow: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'flex-start',
    },
    eyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        10,
      letterSpacing:
        1.1,
    },
    resumeValue: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        19,
      marginTop:
        7,
    },
    resumeMeta: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      marginTop:
        5,
      maxWidth:
        260,
    },
    resumeIcon: {
      width:
        38,
      height:
        38,
      borderRadius:
        12,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      marginLeft:
        12,
    },
    checkpointNote: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13,
      lineHeight:
        19,
      marginTop:
        14,
      paddingTop:
        12,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.border,
    },
    primaryButton: {
      minHeight:
        46,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        8,
      backgroundColor:
        colors.gold,
      borderRadius:
        13,
      paddingHorizontal:
        16,
      marginTop:
        16,
    },
    smallPrimaryButton: {
      minHeight:
        42,
      minWidth:
        104,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.gold,
      borderRadius:
        12,
      paddingHorizontal:
        16,
    },
    primaryButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
    },
    completedHint: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      lineHeight:
        18,
      marginTop:
        15,
    },
    editorCard: {
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.gold,
      borderRadius:
        18,
      padding:
        16,
      marginBottom:
        14,
    },
    editorHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },
    editorHelp: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      marginTop:
        5,
      marginBottom:
        14,
    },
    fieldLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        11,
      marginBottom:
        6,
      marginTop:
        10,
    },
    optionalLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        11,
      marginTop:
        14,
      marginBottom:
        2,
    },
    input: {
      minHeight:
        44,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.elevated,
      color:
        colors.text,
      borderRadius:
        12,
      paddingHorizontal:
        12,
      paddingVertical:
        10,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13,
    },
    multilineInput: {
      minHeight:
        82,
      textAlignVertical:
        'top',
    },
    summaryInput: {
      minHeight:
        130,
      textAlignVertical:
        'top',
      marginTop:
        12,
    },
    sectionHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'flex-start',
      gap:
        12,
    },
    sectionHeaderCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    sectionTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        15,
    },
    sectionSubtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11.5,
      lineHeight:
        17,
      marginTop:
        3,
    },
    textAction: {
      minHeight:
        30,
      justifyContent:
        'center',
      paddingHorizontal:
        4,
    },
    textActionText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
    },
    summaryText: {
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13.5,
      lineHeight:
        21,
      marginTop:
        14,
    },
    emptySectionText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12.5,
      lineHeight:
        19,
      marginTop:
        14,
    },
    editorActions: {
      flexDirection:
        'row',
      justifyContent:
        'flex-end',
      alignItems:
        'center',
      gap:
        10,
      marginTop:
        12,
    },
    secondaryButton: {
      minHeight:
        42,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        12,
      paddingHorizontal:
        16,
    },
    secondaryButtonText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
    },
    noteList: {
      marginTop:
        12,
    },
    noteItem: {
      paddingVertical:
        12,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.border,
    },
    noteMetaRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap:
        8,
      marginBottom:
        6,
    },
    noteDate: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        10.5,
    },
    noteLocation: {
      flexShrink:
        1,
      color:
        colors.gold,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        10.5,
      textAlign:
        'right',
    },
    noteBody: {
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13,
      lineHeight:
        20,
    },
    inlineLink: {
      alignSelf:
        'flex-start',
      paddingVertical:
        8,
    },
    inlineLinkText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
    },
    historyHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },
    historyList: {
      marginTop:
        14,
      paddingTop:
        4,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.border,
    },
    historyItem: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      paddingVertical:
        10,
    },
    historyDot: {
      width:
        8,
      height:
        8,
      borderRadius:
        4,
      backgroundColor:
        colors.gold,
      marginTop:
        6,
      marginRight:
        11,
    },
    historyCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    historyValue: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
    },
    historyDate: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      marginTop:
        2,
    },
    historyNote: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      lineHeight:
        18,
      marginTop:
        5,
    },
    fieldLabelNoTop: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        11,
      marginBottom:
        6,
    },
    fieldSpacer: {
      height:
        14,
    },
    modalKeyboardHost: {
      flex:
        1,
      justifyContent:
        'flex-end',
    },
    modalBackdrop: {
      flex:
        1,
      justifyContent:
        'flex-end',
      backgroundColor:
        'transparent',
    },
    modalBackdropVisual: {
      backgroundColor:
        'rgba(0, 0, 0, 0.56)',
    },
    modalSheet: {
      width:
        '100%',
      maxWidth:
        720,
      alignSelf:
        'center',
      backgroundColor:
        colors.surface,
      borderTopLeftRadius:
        24,
      borderTopRightRadius:
        24,
      borderWidth:
        1,
      borderBottomWidth:
        0,
      borderColor:
        colors.border,
      paddingHorizontal:
        18,
      paddingTop:
        9,
      paddingBottom:
        Platform.OS ===
        'ios'
          ? 28
          : 20,
    },
    dateModalSheet: {
      maxHeight:
        '72%',
    },
    dateInputHint: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      lineHeight:
        15,
      marginTop:
        7,
    },
    dateEndField: {
      marginTop:
        16,
    },
    noteModalSheet: {
      maxHeight:
        '82%',
    },
    historyModalSheet: {
      maxHeight:
        '76%',
      minHeight:
        260,
    },
    modalHandle: {
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
    modalHeader: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
      marginBottom:
        14,
    },
    modalHeaderCopy: {
      flex:
        1,
      minWidth:
        0,
      marginRight:
        12,
    },
    modalTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        17,
    },
    modalSubtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11.5,
      lineHeight:
        17,
      marginTop:
        3,
    },
    modalCloseButton: {
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
      backgroundColor:
        colors.elevated,
    },
    modalSummaryInput: {
      minHeight:
        140,
      maxHeight:
        220,
      textAlignVertical:
        'top',
    },
    noteBodyInput: {
      minHeight:
        92,
      maxHeight:
        132,
      textAlignVertical:
        'top',
    },
    noteLocationRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-end',
      gap:
        16,
      marginTop:
        14,
    },
    noteLocationField: {
      flex:
        1,
      minWidth:
        0,
    },
    noteChapterField: {
      flex:
        1,
      minWidth:
        0,
    },
    locationHint: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      lineHeight:
        15,
      marginTop:
        8,
    },
    modalActions: {
      flexDirection:
        'row',
      justifyContent:
        'flex-end',
      alignItems:
        'center',
      gap:
        10,
      marginTop:
        16,
    },
    historyModalScroll: {
      maxHeight:
        460,
    },
    historyModalContent: {
      paddingBottom:
        8,
    },
    emptyModalText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12.5,
      lineHeight:
        19,
      paddingVertical:
        26,
      textAlign:
        'center',
    },

    privateFooter: {
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
    pressed: {
      opacity:
        0.68,
    },
  });
}
