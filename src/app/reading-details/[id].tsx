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
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}


import {
  NovoriColors,
} from '../../constants/novori-theme';
import {
  useNovoriTheme,
} from '../../context/theme-context';
import {
  addReadingNote,
  deleteReadingNote,
  getReadingDetails,
  ReadingCheckpoint,
  ReadingDetailsData,
  ReadingNote,
  saveReadingCheckpoint,
  saveReadingSummary,
  transitionReadingJourney,
  updateReadingDetailsDates,
  updateReadingNote,
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

function parseAudioPosition(value: string): number | null {
  const cleaned = value.trim();
  if (!cleaned) return null;

  const parts = cleaned.split(':');
  if (
    (parts.length !== 2 && parts.length !== 3) ||
    parts.some((part) => !/^\d+$/.test(part))
  ) {
    throw new Error('Enter an audio time like 23:45 or 1:23:45.');
  }

  const numbers = parts.map(Number);
  const seconds = numbers[numbers.length - 1];
  const minutes = numbers[numbers.length - 2];
  const hours = parts.length === 3 ? numbers[0] : 0;

  if ((parts.length === 3 && minutes > 59) || seconds > 59) {
    throw new Error('Minutes and seconds must be below 60.');
  }

  const total = hours * 3600 + minutes * 60 + seconds;
  if (!Number.isSafeInteger(total) || total > 2147483647) {
    throw new Error('Audio time is too long.');
  }
  return total;
}

function formatAudioPosition(seconds: number | null): string {
  if (seconds === null) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
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
    journeyAction,
    setJourneyAction,
  ] =
    useState<
      'finish' |
      'dnf' |
      'start' |
      null
    >(null);

  const [
    journeyConfirmAction,
    setJourneyConfirmAction,
  ] =
    useState<
      'finish' |
      'dnf' |
      null
    >(null);

  const journeyReviewActionRef =
    useRef<
      'finish' |
      'dnf' |
      null
    >(null);

  const [
    restartPromptVisible,
    setRestartPromptVisible,
  ] =
    useState(false);

  const [
    restartMode,
    setRestartMode,
  ] =
    useState<
      'fresh' |
      'carry' |
      null
    >(null);

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

  const [noteLocationMode, setNoteLocationMode] =
    useState<'page' | 'percent' | 'audio'>('page');

  const [
    noteChapterInput,
    setNoteChapterInput,
  ] =
    useState('');

  const [
    noteAudioInput,
    setNoteAudioInput,
  ] = useState('');

  const [
    savingNote,
    setSavingNote,
  ] =
    useState(false);

  const [
    editingNoteId,
    setEditingNoteId,
  ] =
    useState<string | null>(
      null
    );

  const [
    editingNotePosted,
    setEditingNotePosted,
  ] =
    useState(false);

  const [
    noteMenuTarget,
    setNoteMenuTarget,
  ] =
    useState<ReadingNote | null>(
      null
    );

  const [
    notePendingDelete,
    setNotePendingDelete,
  ] =
    useState<ReadingNote | null>(
      null
    );

  const [
    deletingNote,
    setDeletingNote,
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

  const restartPromptSheet =
    useNovoriSheet(
      () =>
        setRestartPromptVisible(
          false
        )
    );

  const journeyConfirmSheet =
    useNovoriSheet(
      () => {
        setJourneyConfirmAction(
          null
        );

        const completedAction =
          journeyReviewActionRef.current;

        journeyReviewActionRef.current =
          null;

        if (
          completedAction
        ) {
          router.push({
            pathname:
              '/rate-review',
            params: {
              googleBookId,
            },
          });
        }
      }
    );

  const summarySheet =
    useNovoriSheet(
      () =>
        setSummaryEditorOpen(
          false
        )
    );

  const noteSheet =
    useNovoriSheet(
      () => {
        setNoteEditorOpen(
          false
        );
        setEditingNoteId(
          null
        );
        setEditingNotePosted(
          false
        );
      }
    );

  const noteMenuSheet =
    useNovoriSheet(
      () =>
        setNoteMenuTarget(
          null
        )
    );

  const deleteNoteSheet =
    useNovoriSheet(
      () =>
        setNotePendingDelete(
          null
        )
    );

  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

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

  const needsHistoryDate =
    Boolean(
      isFinished &&
        !data?.book
          .finished_at
    ) ||
    Boolean(
      isDnf &&
        !data?.book
          .dnf_at
    );

  const resumeEyebrow =
    isFinished
      ? 'READING COMPLETED'
      : isDnf
      ? 'READING STOPPED'
      : 'YOU LEFT OFF HERE';

  const lastPosition = useMemo(() => {
    const checkpoint = data?.latest_checkpoint ?? null;
    const latestNote = (data?.notes ?? [])
      .filter((note) =>
        note.page_number !== null ||
        note.progress_percent !== null ||
        Boolean(note.chapter?.trim()) ||
        note.audio_position_seconds !== null
      )
      .reduce<ReadingNote | null>((latest, note) =>
        !latest || new Date(note.created_at).getTime() > new Date(latest.created_at).getTime()
          ? note
          : latest, null);

    if (latestNote && (!checkpoint ||
      new Date(latestNote.created_at).getTime() >= new Date(checkpoint.created_at).getTime())) {
      return {
        label: noteLocation(
          latestNote.page_number,
          latestNote.progress_percent,
          latestNote.chapter,
          latestNote.audio_position_seconds
        ),
        createdAt: latestNote.created_at,
        checkpointNote: null as string | null,
      };
    }
    return checkpoint ? {
      label: checkpointLabel(checkpoint),
      createdAt: checkpoint.created_at,
      checkpointNote: checkpoint.checkpoint_note,
    } : null;
  }, [data?.latest_checkpoint, data?.notes]);

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

  // Show every saved note unless its linked checkpoint already represents it.
  const readingHistory = useMemo(() => {
    const checkpoints = (data?.checkpoints ?? []).map((checkpoint) => {
      const linkedNoteId =
        (checkpoint as ReadingCheckpoint & { source_note_id?: string | null })
          .source_note_id;
      const linkedNote = (data?.notes ?? []).find((note) => note.id === linkedNoteId);
      return {
        id: `checkpoint-${checkpoint.id}`,
        createdAt: checkpoint.created_at,
        label: checkpointLabel(checkpoint),
        detail: checkpoint.checkpoint_note || linkedNote?.body || null,
      };
    });
    const linkedNoteIds = new Set(
      (data?.checkpoints ?? [])
        .map((checkpoint) =>
          (checkpoint as ReadingCheckpoint & { source_note_id?: string | null })
            .source_note_id
        )
        .filter((id): id is string => Boolean(id))
    );
    const privateNotes = (data?.notes ?? [])
      .filter((note) => !linkedNoteIds.has(note.id))
      .map((note) => ({
        id: `note-${note.id}`,
        createdAt: note.created_at,
        label: noteLocation(
          note.page_number,
          note.progress_percent,
          note.chapter,
          note.audio_position_seconds
        ) || 'Private note',
        detail: note.body,
      }));
    return [...checkpoints, ...privateNotes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [data?.checkpoints, data?.notes]);

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

  async function changeJourneyState(
    action:
      | 'finish'
      | 'dnf'
      | 'start'
  ) {
    if (
      !data ||
      journeyAction
    ) {
      return false;
    }

    try {
      setJourneyAction(
        action
      );

      await transitionReadingJourney(
        googleBookId,
        action
      );

      await loadData(
        false
      );

      return true;
    } catch (
      journeyError
    ) {
      const title =
        action ===
          'finish'
          ? 'Could not finish book'
          : action ===
              'dnf'
          ? 'Could not mark DNF'
          : 'Could not start again';

      Alert.alert(
        title,
        journeyError instanceof
          Error
          ? journeyError.message
          : 'Please try again.'
      );

      return false;
    } finally {
      setJourneyAction(
        null
      );
    }
  }

  function confirmJourneyEnd(
    action:
      | 'finish'
      | 'dnf'
  ) {
    if (
      journeyAction
    ) {
      return;
    }

    setJourneyConfirmAction(
      action
    );
  }

  async function completeJourneyFromSheet() {
    if (
      !journeyConfirmAction ||
      journeyAction
    ) {
      return;
    }

    const action =
      journeyConfirmAction;

    const completed =
      await changeJourneyState(
        action
      );

    if (
      !completed
    ) {
      return;
    }

    journeyReviewActionRef.current =
      action;

    journeyConfirmSheet.closeSmoothly();
  }

  function openRestartPrompt() {
    if (
      !data ||
      journeyAction
    ) {
      return;
    }

    setRestartPromptVisible(
      true
    );
  }

  async function startNewJourney(
    carryOver:
      boolean
  ) {
    if (
      !data ||
      journeyAction
    ) {
      return;
    }

    const previousSummary =
      data.session
        .summary_text;

    const previousNotes =
      [...data.notes].sort(
        (
          a,
          b
        ) =>
          new Date(
            a.created_at
          ).getTime() -
          new Date(
            b.created_at
          ).getTime()
      );

    let newJourneyStarted =
      false;

    try {
      setJourneyAction(
        'start'
      );

      setRestartMode(
        carryOver
          ? 'carry'
          : 'fresh'
      );

      const newSession =
        await transitionReadingJourney(
          googleBookId,
          'start'
        );

      newJourneyStarted =
        true;

      if (
        carryOver
      ) {
        try {
          if (
            previousSummary
              ?.trim()
          ) {
            await saveReadingSummary(
              newSession.id,
              previousSummary
            );
          }

          for (
            const note of
            previousNotes
          ) {
            await addReadingNote(
              newSession.id,
              {
                body:
                  note.body,
                pageNumber:
                  note.page_number,
                progressPercent:
                  note.progress_percent,
                chapter:
                  note.chapter,
                audioPositionSeconds:
                  note.audio_position_seconds,
              }
            );
          }
        } catch (
          carryOverError
        ) {
          console.error(
            'Could not carry over all reading journey context:',
            carryOverError
          );

          restartPromptSheet.closeSmoothly();

          await loadData(
            false
          );

          Alert.alert(
            'New journey started',
            'Your previous journey is still safe, but Novori could not copy all of its notes or summary into the new journey.'
          );

          return;
        }
      }

      restartPromptSheet.closeSmoothly();

      await loadData(
        false
      );
    } catch (
      restartError
    ) {
      console.error(
        'Could not start new reading journey:',
        restartError
      );

      if (
        newJourneyStarted
      ) {
        restartPromptSheet.closeSmoothly();

        await loadData(
          false
        );

        Alert.alert(
          'New journey started',
          'Your new reading journey was created, but Novori had trouble refreshing Reading Details. Reopen the page to continue.'
        );

        return;
      }

      Alert.alert(
        'Could not start again',
        restartError instanceof
          Error
          ? restartError.message
          : 'Novori had trouble starting a new reading journey. Please try again.'
      );
    } finally {
      setJourneyAction(
        null
      );

      setRestartMode(
        null
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

  function openNoteEditor(
    note?: ReadingNote
  ) {
    if (note) {
      setEditingNoteId(
        note.id
      );
      setEditingNotePosted(
        Boolean(
          note.source_post_id
        )
      );
      setNoteBodyInput(
        note.body
      );
      setNoteLocationInput(
        progressParam(
          note.page_number,
          note.progress_percent
        ).replace('%', '')
      );
      setNoteLocationMode(
        note.page_number !== null
          ? 'page'
          : note.progress_percent !== null
          ? 'percent'
          : note.audio_position_seconds !== null
          ? 'audio'
          : 'page'
      );
      setNoteChapterInput(
        note.chapter ??
          ''
      );
      setNoteAudioInput(
        formatAudioPosition(note.audio_position_seconds)
      );
      setNoteEditorOpen(
        true
      );
      return;
    }

    const latestCheckpoint =
      data?.latest_checkpoint ??
      null;

    const latestNoteWithLocation =
      (data?.notes ?? [])
        .filter(
          (currentNote) =>
            currentNote.page_number !==
              null ||
            currentNote.progress_percent !==
              null ||
            currentNote.audio_position_seconds !==
              null ||
            Boolean(
              currentNote.chapter
                ?.trim()
            )
        )
        .reduce<
          ReadingDetailsData['notes'][number] | null
        >(
          (latest, currentNote) =>
            !latest ||
            new Date(
              currentNote.created_at
            ).getTime() >
              new Date(
                latest.created_at
              ).getTime()
              ? currentNote
              : latest,
          null
        );

    const useLatestNote =
      latestNoteWithLocation &&
      (
        !latestCheckpoint ||
        new Date(
          latestNoteWithLocation.created_at
        ).getTime() >
          new Date(
            latestCheckpoint.created_at
          ).getTime()
      );

    const pageNumber =
      useLatestNote
        ? latestNoteWithLocation
            ?.page_number ??
          null
        : latestCheckpoint
            ?.page_number ??
          null;

    const progressPercent =
      useLatestNote
        ? latestNoteWithLocation
            ?.progress_percent ??
          null
        : latestCheckpoint
            ?.progress_percent ??
          null;

    const audioSeconds =
      useLatestNote
        ? latestNoteWithLocation
            ?.audio_position_seconds ??
          null
        : null;

    const chapter =
      useLatestNote
        ? latestNoteWithLocation
            ?.chapter ??
          ''
        : latestCheckpoint
            ?.chapter ??
          '';

    setEditingNoteId(
      null
    );
    setEditingNotePosted(
      false
    );
    setNoteBodyInput(
      ''
    );
    setNoteLocationInput(
      progressParam(
        pageNumber,
        progressPercent
      ).replace('%', '')
    );
    setNoteLocationMode(
      audioSeconds !== null && pageNumber === null && progressPercent === null
        ? 'audio'
        : progressPercent !== null && pageNumber === null
        ? 'percent'
        : 'page'
    );
    setNoteChapterInput(chapter);
    setNoteAudioInput(formatAudioPosition(audioSeconds));
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
          noteLocationInput.trim()
            ? noteLocationMode === 'percent'
              ? `${noteLocationInput.replace(/%/g, '')}%`
              : noteLocationInput.replace(/%/g, '')
            : ''
        );

      if (
        noteLocationInput.trim() &&
        pageNumber === null &&
        progressPercent === null
      ) {
        throw new Error('Enter a valid page number or percentage.');
      }

      const input = {
        body:
          noteBodyInput,
        pageNumber,
        progressPercent,
        chapter:
          noteChapterInput,
        audioPositionSeconds:
          parseAudioPosition(noteAudioInput),
      };

      if (editingNoteId) {
        await updateReadingNote(
          editingNoteId,
          data.session.id,
          input
        );
      } else {
        await addReadingNote(
          data.session.id,
          input
        );
      }

      noteSheet.closeSmoothly();

      await loadData(
        false
      );
    } catch (
      saveError
    ) {
      Alert.alert(
        editingNoteId
          ? 'Could not update note'
          : 'Could not save note',
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

  function openNoteMenu(
    note: ReadingNote
  ) {
    setNoteMenuTarget(
      note
    );
  }

  function editNoteFromMenu() {
    if (
      !noteMenuTarget
    ) {
      return;
    }

    const note =
      noteMenuTarget;

    setNoteMenuTarget(
      null
    );

    openNoteEditor(
      note
    );
  }

  function deleteNoteFromMenu() {
    if (
      !noteMenuTarget
    ) {
      return;
    }

    const note =
      noteMenuTarget;

    setNoteMenuTarget(
      null
    );

    confirmDeleteNote(
      note
    );
  }

  function confirmDeleteNote(
    note: ReadingNote
  ) {
    if (deletingNote) {
      return;
    }

    setNotePendingDelete(
      note
    );
  }

  async function removeReadingNote() {
    if (
      !notePendingDelete ||
      deletingNote
    ) {
      return;
    }

    try {
      setDeletingNote(
        true
      );

      await deleteReadingNote(
        notePendingDelete.id,
        notePendingDelete.session_id
      );

      deleteNoteSheet.closeSmoothly();

      await loadData(
        false
      );
    } catch (
      deleteError
    ) {
      Alert.alert(
        'Could not delete note',
        deleteError instanceof
          Error
          ? deleteError.message
          : 'Please try again.'
      );
    } finally {
      setDeletingNote(
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
      | null,
    audioSeconds:
      | number
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
        `${percent}% complete`
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

    if (audioSeconds !== null) {
      parts.push(`Audio ${formatAudioPosition(audioSeconds)}`);
    }

    return parts.join(
      ' · '
    );
  }

  function progressParam(
    page: number | null,
    percent: number | null
  ) {
    if (page !== null) {
      return String(page);
    }

    if (percent !== null) {
      return `${percent}%`;
    }

    return '';
  }

  function shareAsReadingUpdate(
    thought: string,
    page: number | null,
    percent: number | null,
    chapter: string | null,
    sourceNoteId?: string,
    audioSeconds?: number | null
  ) {
    router.push({
      pathname:
        '/create-reading-update',
      params: {
        bookId:
          googleBookId,
        progress:
          progressParam(
            page,
            percent
          ),
        chapter:
          chapter ??
          '',
        audioPosition:
          audioSeconds != null
            ? formatAudioPosition(audioSeconds)
            : '',
        thought,
        ...(sourceNoteId
          ? {
              sourceNoteId,
            }
          : {}),
      },
    });
  }

  function shareSummaryAsReadingUpdate() {
    const summary =
      data?.session
        .summary_text
        ?.trim() ||
      '';

    if (!summary) {
      return;
    }

    const latest =
      data?.latest_checkpoint ??
      null;

    shareAsReadingUpdate(
      summary,
      latest?.page_number ??
        null,
      latest?.progress_percent ??
        null,
      latest?.chapter ??
        null
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
            style={[
              styles.timelineCard,
              needsHistoryDate &&
                styles.timelineCardNeedsDates,
            ]}
          >
            <View
              style={
                styles.timelineHeader
              }
            >
              <View
                style={
                  styles.timelineHeaderCopy
                }
              >
                <Text
                  style={
                    styles.timelineHeaderText
                  }
                >
                  {needsHistoryDate
                    ? 'Add reading dates'
                    : 'Reading dates'}
                </Text>

                {needsHistoryDate ? (
                  <Text
                    style={
                      styles.timelineHeaderPrompt
                    }
                  >
                    {isFinished
                      ? 'Add a finish date to place this book in your reading history.'
                      : 'Add the date you stopped to place this book in your reading history.'}
                  </Text>
                ) : null}
              </View>

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
                  {needsHistoryDate
                    ? 'Add dates'
                    : 'Edit'}
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
                        : 'Date not added'
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
                      : 'Date not added'
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
                    lastPosition?.label || 'No checkpoint saved yet'
                  }
                </Text>

                <Text
                  style={
                    styles.resumeMeta
                  }
                >
                  {
                    lastPosition
                      ? isFinished
                        ? `Final position · ${formatDate(lastPosition.createdAt)}`
                        : isDnf
                        ? `Last position · ${formatDate(lastPosition.createdAt)}`
                        : `Updated ${formatDate(lastPosition.createdAt)}`
                      : isFinished
                      ? 'This reading session is complete.'
                      : isDnf
                      ? 'No position was saved before this reading session ended.'
                      : 'Save your first reading position whenever you stop.'
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

            {lastPosition?.checkpointNote ? (
              <Text
                style={
                  styles.checkpointNote
                }
              >
                {
                  lastPosition.checkpointNote
                }
              </Text>
            ) : null}

            {isReading ? (
              <>
                <Pressable
                  onPress={
                    openProgressEditor
                  }
                  disabled={
                    journeyAction !==
                    null
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.primaryButton,
                    (
                      pressed ||
                      journeyAction !==
                        null
                    ) &&
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

                <View
                  style={
                    styles.journeyEndActions
                  }
                >
                  <Pressable
                    onPress={() =>
                      confirmJourneyEnd(
                        'finish'
                      )
                    }
                    disabled={
                      journeyAction !==
                      null
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.journeySecondaryButton,
                      styles.journeyEndButton,
                      (
                        pressed ||
                        journeyAction !==
                          null
                      ) &&
                        styles.pressed,
                    ]}
                  >
                    {journeyAction ===
                    'finish' ? (
                      <ActivityIndicator
                        size="small"
                        color={
                          colors.gold
                        }
                      />
                    ) : (
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={17}
                        color={
                          colors.gold
                        }
                      />
                    )}

                    <Text
                      style={
                        styles.journeySecondaryButtonText
                      }
                    >
                      Finish book
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      confirmJourneyEnd(
                        'dnf'
                      )
                    }
                    disabled={
                      journeyAction !==
                      null
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.journeySecondaryButton,
                      styles.journeyEndButton,
                      (
                        pressed ||
                        journeyAction !==
                          null
                      ) &&
                        styles.pressed,
                    ]}
                  >
                    {journeyAction ===
                    'dnf' ? (
                      <ActivityIndicator
                        size="small"
                        color={
                          colors.gold
                        }
                      />
                    ) : (
                      <Ionicons
                        name="close-circle-outline"
                        size={17}
                        color={
                          colors.gold
                        }
                      />
                    )}

                    <Text
                      style={
                        styles.journeySecondaryButtonText
                      }
                    >
                      DNF
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
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

                <Pressable
                  onPress={
                    openRestartPrompt
                  }
                  disabled={
                    journeyAction !==
                    null
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.primaryButton,
                    (
                      pressed ||
                      journeyAction !==
                        null
                    ) &&
                      styles.pressed,
                  ]}
                >
                  {journeyAction ===
                    'start' &&
                  restartMode ===
                    'fresh' ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        colors.background
                      }
                    />
                  ) : (
                    <Ionicons
                      name="refresh-outline"
                      size={18}
                      color={
                        colors.background
                      }
                    />
                  )}

                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    Start again
                  </Text>
                </Pressable>
              </>
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

            {data.session
              .summary_text ? (
              <Pressable
                onPress={
                  shareSummaryAsReadingUpdate
                }
                style={({
                  pressed,
                }) => [
                  styles.shareUpdateButton,
                  pressed &&
                    styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Share summary as a reading update"
              >
                <Ionicons
                  name="share-social-outline"
                  size={15}
                  color={
                    colors.gold
                  }
                />

                <Text
                  style={
                    styles.shareUpdateText
                  }
                >
                  Share as Reading Update
                </Text>
              </Pressable>
            ) : null}
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
                  Your private notes and archived Reading Updates, all in one place.
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  openNoteEditor()
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
                        note.chapter,
                        note.audio_position_seconds
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
                          <View
                            style={
                              styles.noteMetaLeft
                            }
                          >
                            {note.source_type ===
                            'reading_update' ? (
                              <View
                                style={
                                  styles.readingUpdateBadge
                                }
                              >
                                <Text
                                  style={
                                    styles.readingUpdateBadgeText
                                  }
                                >
                                  Reading Update
                                </Text>
                              </View>
                            ) : (
                              <Ionicons
                                name="lock-closed-outline"
                                size={12}
                                color={colors.mutedText}
                              />
                            )}

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
                          </View>

                          <Pressable
                            onPress={() =>
                              openNoteMenu(
                                note
                              )
                            }
                            hitSlop={10}
                            style={({
                              pressed,
                            }) => [
                              styles.noteMenuButton,
                              pressed &&
                                styles.pressed,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Note options"
                          >
                            <Ionicons
                              name="ellipsis-horizontal"
                              size={18}
                              color={
                                colors.mutedText
                              }
                            />
                          </Pressable>
                        </View>

                        {location ? (
                          <View style={styles.noteLocationPill}>
                            <Ionicons name="bookmark-outline" size={11} color={colors.gold} />
                            <Text style={styles.noteLocation}>{location}</Text>
                          </View>
                        ) : null}

                        <Text
                          style={
                            styles.noteBody
                          }
                        >
                          {
                            note.body
                          }
                        </Text>

                        {!note.source_post_id ? (
                          <Pressable
                            onPress={() =>
                              shareAsReadingUpdate(
                                note.body,
                                note.page_number,
                                note.progress_percent,
                                note.chapter,
                                note.id,
                                note.audio_position_seconds
                              )
                            }
                            style={({
                              pressed,
                            }) => [
                              styles.noteShareButton,
                              pressed &&
                                styles.pressed,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Share note as a reading update"
                          >
                            <Ionicons
                              name="share-social-outline"
                              size={14}
                              color={
                                colors.gold
                              }
                            />

                            <Text
                              style={
                                styles.noteShareText
                              }
                            >
                              Share as Reading Update
                            </Text>
                          </Pressable>
                        ) : (
                          <View
                            style={
                              styles.postedProfileRow
                            }
                          >
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={14}
                              color={
                                colors.gold
                              }
                            />

                            <Text
                              style={
                                styles.postedProfileText
                              }
                            >
                              Posted to Profile
                            </Text>
                            <Pressable
                              onPress={() =>
                                router.push({
                                  pathname: '/post/[id]',
                                  params: {
                                    id: note.source_post_id!,
                                  },
                                })
                              }
                              style={({ pressed }) => [
                                styles.viewLinkedPostButton,
                                pressed && styles.pressed,
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel="View the current public post"
                            >
                              <Text style={styles.viewLinkedPostText}>
                                View Post
                              </Text>
                              <Ionicons
                                name="arrow-forward"
                                size={12}
                                color={colors.gold}
                              />
                            </Pressable>
                          </View>
                        )}

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
                    readingHistory
                      .length
                  } {
                    readingHistory
                      .length ===
                    1
                      ? 'entry'
                      : 'entries'
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
                        {needsHistoryDate
                          ? 'Add the dates you remember. Start date is optional.'
                          : 'Adjust dates if you started or finished on a different day.'}
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

                      <Text
                        style={
                          styles.dateInputHint
                        }
                      >
                        Leave blank if you do not remember. A {
                          data.book.status ===
                            'read'
                            ? 'finish'
                            : 'stopped'
                        } date is what places this book into monthly and yearly history.
                      </Text>
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
            restartPromptVisible
          }
          transparent
          animationType="none"
          onShow={
            restartPromptSheet.animateIn
          }
          onRequestClose={
            restartPromptSheet.closeSmoothly
          }
        >
          <Pressable
            style={
              styles.modalBackdrop
            }
            onPress={
              journeyAction
                ? undefined
                : restartPromptSheet.closeSmoothly
            }
          >
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.modalBackdropVisual,
                {
                  opacity:
                    restartPromptSheet.backdropOpacity,
                },
              ]}
            />

            <Animated.View
              {...restartPromptSheet.panResponder.panHandlers}
              onLayout={({
                nativeEvent,
              }) => {
                restartPromptSheet.sheetHeight.current =
                  nativeEvent.layout.height;
              }}
              style={[
                styles.modalSheet,
                styles.restartPromptModalSheet,
                {
                  opacity:
                    restartPromptSheet.sheetOpacity,
                  transform: [
                    {
                      translateY:
                        restartPromptSheet.translateY,
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
                    styles.modalHandle
                  }
                />

                <View
                  style={
                    styles.restartPromptIcon
                  }
                >
                  <Ionicons
                    name="refresh-outline"
                    size={24}
                    color={
                      colors.gold
                    }
                  />
                </View>

                <Text
                  style={
                    styles.restartPromptTitle
                  }
                >
                  Start a new reading journey?
                </Text>

                <Text
                  style={
                    styles.restartPromptMessage
                  }
                >
                  Your previous journey stays saved in your Reading Recap, including its notes and summary.
                </Text>

                <Pressable
                  disabled={
                    journeyAction !==
                    null
                  }
                  onPress={() =>
                    void startNewJourney(
                      false
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.restartChoice,
                    (
                      pressed ||
                      journeyAction !==
                        null
                    ) &&
                      styles.pressed,
                  ]}
                >
                  <View
                    style={
                      styles.restartChoiceIcon
                    }
                  >
                    <Ionicons
                      name="sparkles-outline"
                      size={18}
                      color={
                        colors.gold
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.restartChoiceCopy
                    }
                  >
                    <Text
                      style={
                        styles.restartChoiceTitle
                      }
                    >
                      Start Fresh
                    </Text>

                    <Text
                      style={
                        styles.restartChoiceText
                      }
                    >
                      Begin Journey #{(data?.session.session_number ?? 0) + 1} with a clean summary and no carried-over notes.
                    </Text>
                  </View>

                  {journeyAction ===
                  'start' ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        colors.gold
                      }
                    />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={
                        colors.mutedText
                      }
                    />
                  )}
                </Pressable>

                <Pressable
                  disabled={
                    journeyAction !==
                    null
                  }
                  onPress={() =>
                    void startNewJourney(
                      true
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.restartChoice,
                    (
                      pressed ||
                      journeyAction !==
                        null
                    ) &&
                      styles.pressed,
                  ]}
                >
                  <View
                    style={
                      styles.restartChoiceIcon
                    }
                  >
                    <Ionicons
                      name="copy-outline"
                      size={18}
                      color={
                        colors.gold
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.restartChoiceCopy
                    }
                  >
                    <Text
                      style={
                        styles.restartChoiceTitle
                      }
                    >
                      Carry Over Notes & Summary
                    </Text>

                    <Text
                      style={
                        styles.restartChoiceText
                      }
                    >
                      Copy your previous private notes and summary into the new journey. The original journey remains unchanged.
                    </Text>
                  </View>

                  {journeyAction ===
                    'start' &&
                  restartMode ===
                    'carry' ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        colors.gold
                      }
                    />
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={
                        colors.mutedText
                      }
                    />
                  )}
                </Pressable>

                <Pressable
                  disabled={
                    journeyAction !==
                    null
                  }
                  onPress={
                    restartPromptSheet.closeSmoothly
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.restartCancelButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Text
                    style={
                      styles.restartCancelText
                    }
                  >
                    Cancel
                  </Text>
                </Pressable>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>

        <Modal
          visible={
            Boolean(
              journeyConfirmAction
            )
          }
          transparent
          animationType="none"
          onShow={
            journeyConfirmSheet.animateIn
          }
          onRequestClose={
            journeyConfirmSheet.closeSmoothly
          }
        >
          <Pressable
            style={
              styles.modalBackdrop
            }
            onPress={
              journeyAction
                ? undefined
                : journeyConfirmSheet.closeSmoothly
            }
          >
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.modalBackdropVisual,
                {
                  opacity:
                    journeyConfirmSheet.backdropOpacity,
                },
              ]}
            />

            <Animated.View
              {...journeyConfirmSheet.panResponder.panHandlers}
              onLayout={({
                nativeEvent,
              }) => {
                journeyConfirmSheet.sheetHeight.current =
                  nativeEvent.layout.height;
              }}
              style={[
                styles.modalSheet,
                styles.journeyConfirmModalSheet,
                {
                  opacity:
                    journeyConfirmSheet.sheetOpacity,
                  transform: [
                    {
                      translateY:
                        journeyConfirmSheet.translateY,
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
                    styles.modalHandle
                  }
                />

                <View
                  style={
                    styles.journeyConfirmIcon
                  }
                >
                  <Ionicons
                    name={
                      journeyConfirmAction ===
                        'finish'
                        ? 'checkmark-circle-outline'
                        : 'close-circle-outline'
                    }
                    size={24}
                    color={
                      journeyConfirmAction ===
                        'finish'
                        ? colors.gold
                        : colors.danger
                    }
                  />
                </View>

                <Text
                  style={
                    styles.journeyConfirmTitle
                  }
                >
                  {journeyConfirmAction ===
                  'finish'
                    ? 'Finish this book?'
                    : 'Mark this book DNF?'}
                </Text>

                <Text
                  style={
                    styles.journeyConfirmMessage
                  }
                >
                  {journeyConfirmAction ===
                  'finish'
                    ? 'This completes your current reading journey and saves today as the finish date. You can always start the book again later.'
                    : 'This ends your current reading journey as Did Not Finish and saves today as the stopped date. You can always start the book again later.'}
                </Text>

                <View
                  style={
                    styles.journeyConfirmActions
                  }
                >
                  <Pressable
                    disabled={
                      journeyAction !==
                      null
                    }
                    onPress={
                      journeyConfirmSheet.closeSmoothly
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.journeyConfirmCancelButton,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <Text
                      style={
                        styles.journeyConfirmCancelText
                      }
                    >
                      Cancel
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={
                      journeyAction !==
                      null
                    }
                    onPress={() =>
                      void completeJourneyFromSheet()
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.journeyConfirmPrimaryButton,
                      journeyConfirmAction ===
                        'dnf' &&
                        styles.journeyConfirmDangerButton,
                      (
                        pressed ||
                        journeyAction !==
                          null
                      ) &&
                        styles.pressed,
                    ]}
                  >
                    {journeyAction ===
                    journeyConfirmAction ? (
                      <ActivityIndicator
                        size="small"
                        color={
                          colors.background
                        }
                      />
                    ) : (
                      <Text
                        style={[
                          styles.journeyConfirmPrimaryText,
                          journeyConfirmAction ===
                            'dnf' &&
                            styles.journeyConfirmDangerText,
                        ]}
                      >
                        {journeyConfirmAction ===
                        'finish'
                          ? 'Finish Book'
                          : 'Mark DNF'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>

        <Modal
          visible={
            Boolean(
              noteMenuTarget
            )
          }
          transparent
          animationType="none"
          onShow={
            noteMenuSheet.animateIn
          }
          onRequestClose={
            noteMenuSheet.closeSmoothly
          }
        >
          <Pressable
            style={
              styles.modalBackdrop
            }
            onPress={
              noteMenuSheet.closeSmoothly
            }
          >
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.modalBackdropVisual,
                {
                  opacity:
                    noteMenuSheet.backdropOpacity,
                },
              ]}
            />

            <Animated.View
              {...noteMenuSheet.panResponder.panHandlers}
              style={[
                styles.modalSheet,
                styles.noteMenuModalSheet,
                {
                  opacity:
                    noteMenuSheet.sheetOpacity,
                  transform: [
                    {
                      translateY:
                        noteMenuSheet.translateY,
                    },
                  ],
                },
              ]}
              onLayout={({
                nativeEvent,
              }) => {
                noteMenuSheet.sheetHeight.current =
                  nativeEvent.layout.height;
              }}
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
                    styles.modalHandle
                  }
                />

                <Pressable
                  onPress={
                    editNoteFromMenu
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.noteMenuAction,
                    pressed &&
                      styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Edit note"
                >
                  <View
                    style={
                      styles.noteMenuActionIcon
                    }
                  >
                    <Ionicons
                      name="pencil-outline"
                      size={18}
                      color={
                        colors.gold
                      }
                    />
                  </View>

                  <Text
                    style={
                      styles.noteMenuActionText
                    }
                  >
                    Edit note
                  </Text>
                </Pressable>

                <View
                  style={
                    styles.noteMenuDivider
                  }
                />

                <Pressable
                  onPress={
                    deleteNoteFromMenu
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.noteMenuAction,
                    pressed &&
                      styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Delete note"
                >
                  <View
                    style={
                      styles.noteMenuActionIcon
                    }
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color="#D86A6A"
                    />
                  </View>

                  <Text
                    style={
                      styles.noteMenuDeleteText
                    }
                  >
                    Delete note
                  </Text>
                </Pressable>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>

        <Modal
          visible={
            Boolean(
              notePendingDelete
            )
          }
          transparent
          animationType="none"
          onShow={
            deleteNoteSheet.animateIn
          }
          onRequestClose={
            deleteNoteSheet.closeSmoothly
          }
        >
          <Pressable
            style={
              styles.modalBackdrop
            }
            onPress={
              deleteNoteSheet.closeSmoothly
            }
          >
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.modalBackdropVisual,
                {
                  opacity:
                    deleteNoteSheet.backdropOpacity,
                },
              ]}
            />

            <Animated.View
              {...deleteNoteSheet.panResponder.panHandlers}
              onLayout={(event) => {
                deleteNoteSheet.sheetHeight.current =
                  event.nativeEvent.layout.height;
              }}
              style={[
                styles.modalSheet,
                styles.deleteNoteModalSheet,
                {
                  opacity:
                    deleteNoteSheet.sheetOpacity,
                  transform: [
                    {
                      translateY:
                        deleteNoteSheet.translateY,
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
                    styles.deleteNoteIcon
                  }
                >
                  <Ionicons
                    name="trash-outline"
                    size={22}
                    color="#D86A6A"
                  />
                </View>

                <Text
                  style={
                    styles.deleteNoteTitle
                  }
                >
                  Delete this note?
                </Text>

                <Text
                  style={
                    styles.deleteNoteCopy
                  }
                >
                  {notePendingDelete?.source_post_id
                    ? 'This removes the private note and its linked Reading history entry. The post on your profile stays until you delete it separately.'
                    : 'This permanently removes the note and its linked Reading history entry. Independently saved checkpoints remain.'}
                </Text>

                <View
                  style={
                    styles.deleteNoteActions
                  }
                >
                  <Pressable
                    onPress={
                      deleteNoteSheet.closeSmoothly
                    }
                    disabled={
                      deletingNote
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.deleteNoteCancelButton,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <Text
                      style={
                        styles.secondaryButtonText
                      }
                    >
                      Keep Note
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() =>
                      void removeReadingNote()
                    }
                    disabled={
                      deletingNote
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.deleteNoteButton,
                      (
                        pressed ||
                        deletingNote
                      ) &&
                        styles.pressed,
                    ]}
                  >
                    {deletingNote ? (
                      <ActivityIndicator
                        color="#FFFFFF"
                      />
                    ) : (
                      <Text
                        style={
                          styles.deleteNoteButtonText
                        }
                      >
                        Delete Note
                      </Text>
                    )}
                  </Pressable>
                </View>
              </Pressable>
            </Animated.View>
          </Pressable>
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
                    {editingNoteId
                      ? 'Edit note'
                      : 'Add note'}
                  </Text>

                  <Text
                    style={
                      styles.modalSubtitle
                    }
                  >
                    {editingNotePosted
                      ? 'This note stays private. View Post opens the current public version.'
                      : 'Private to you. Location is optional.'}
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

              <ScrollView
                style={styles.noteEditorScroll}
                contentContainerStyle={styles.noteEditorScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
              <View style={styles.noteLocationGroup}>
              <Text style={styles.fieldLabelNoTop}>Location (optional)</Text>
              <View style={styles.noteModeRow}>
                {(['page', 'percent', 'audio'] as const).map((modeChoice) => (
                  <Pressable
                    key={modeChoice}
                    onPress={() => {
                      if (modeChoice !== noteLocationMode) {
                        setNoteLocationInput('');
                        setNoteChapterInput('');
                        setNoteAudioInput('');
                        setNoteLocationMode(modeChoice);
                      }
                    }}
                    style={[
                      styles.noteModeButton,
                      noteLocationMode === modeChoice && styles.noteModeButtonSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: noteLocationMode === modeChoice }}
                  >
                    {modeChoice === 'audio' ? (
                      <Ionicons
                        name="headset-outline"
                        size={13}
                        color={noteLocationMode === 'audio' ? colors.gold : colors.mutedText}
                      />
                    ) : null}
                    <Text style={[
                      styles.noteModeText,
                      noteLocationMode === modeChoice && styles.noteModeTextSelected,
                    ]}>
                      {modeChoice === 'page' ? 'Page' : modeChoice === 'percent' ? 'Percent' : 'Audiobook'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {noteLocationMode === 'audio' ? (
              <View style={styles.noteAudioField}>
                <Text style={styles.fieldLabelNoTop}>
                  Audiobook timestamp (optional)
                </Text>
                <TextInput
                  value={noteAudioInput}
                  onChangeText={setNoteAudioInput}
                  keyboardType="numbers-and-punctuation"
                  placeholder="1:23:45 or 23:45"
                  placeholderTextColor={colors.mutedText}
                  style={styles.input}
                  accessibilityLabel="Audiobook timestamp"
                />
              </View>

              ) : (
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
                    {noteLocationMode === 'page' ? 'Page number' : 'Percent complete'}
                  </Text>

                  <TextInput
                    value={
                      noteLocationInput
                    }
                    onChangeText={
                      setNoteLocationInput
                    }
                    keyboardType="numbers-and-punctuation"
                    placeholder={noteLocationMode === 'page' ? '245' : '63'}
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

              )}
              <Text
                style={
                  styles.locationHint
                }
              >
                {noteLocationMode === 'audio' ? 'Enter the playback time from your audiobook.' : 'Add a reading position and an optional chapter.'}
              </Text>

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
                      {editingNoteId
                        ? 'Save changes'
                        : 'Save note'}
                    </Text>
                  )}
                </Pressable>
              </View>
              </ScrollView>
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
                      readingHistory
                        .length
                    } {
                      readingHistory
                        .length ===
                      1
                        ? 'entry'
                        : 'entries'
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

              {readingHistory
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
                  {readingHistory.map(
                    (
                      checkpoint
                    ) => (
                      <Pressable
                        key={checkpoint.id}
                        onPress={() => {
                          if (!checkpoint.detail) return;
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setExpandedHistoryId((current) =>
                            current === checkpoint.id ? null : checkpoint.id
                          );
                        }}
                        style={styles.historyItem}
                        accessibilityRole={checkpoint.detail ? 'button' : undefined}
                        accessibilityState={checkpoint.detail ? { expanded: expandedHistoryId === checkpoint.id } : undefined}
                        accessibilityLabel={checkpoint.detail ? `Show note for ${checkpoint.label}` : undefined}
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
                              checkpoint.label
                            }
                          </Text>

                          <Text
                            style={
                              styles.historyDate
                            }
                          >
                            {
                              formatDate(
                                checkpoint.createdAt
                              )
                            }
                          </Text>

                          {checkpoint.detail && expandedHistoryId === checkpoint.id ? (
                            <Text
                              style={
                                styles.historyNote
                              }
                            >
                              {
                                checkpoint
                                  .detail
                              }
                            </Text>
                          ) : null}
                        </View>
                        {checkpoint.detail ? (
                          <Ionicons
                            name={expandedHistoryId === checkpoint.id ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={colors.mutedText}
                            style={styles.historyChevron}
                          />
                        ) : null}
                      </Pressable>
                    )
                  )}
                </ScrollView>
              ) : (
                <Text
                  style={
                    styles.emptyModalText
                  }
                >
                  Your notes and reading updates will appear here as you save them.
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
    timelineCardNeedsDates: {
      borderColor:
        colors.gold,
      backgroundColor:
        colors.elevated,
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
    timelineHeaderCopy: {
      flex: 1,
      minWidth: 0,
      marginRight: 12,
    },
    timelineHeaderText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
    },
    timelineHeaderPrompt: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      lineHeight:
        15,
      marginTop:
        4,
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
    journeyEndActions: {
      flexDirection:
        'row',
      gap:
        9,
    },
    journeyEndButton: {
      flex:
        1,
    },
    journeySecondaryButton: {
      minHeight:
        42,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        7,
      borderWidth:
        1,
      borderColor:
        colors.gold,
      borderRadius:
        13,
      paddingHorizontal:
        16,
      marginTop:
        9,
    },
    journeySecondaryButtonText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
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
      marginTop: 14,
      gap: 12,
    },
    noteItem: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
    },
    shareUpdateButton: {
      alignSelf:
        'flex-start',
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        6,
      marginTop:
        14,
      paddingVertical:
        6,
    },
    shareUpdateText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
    },
    noteMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom: 10,
    },
    noteMetaLeft: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        7,
      flexShrink:
        1,
    },
    readingUpdateBadge: {
      borderRadius:
        999,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.gold,
      paddingHorizontal:
        7,
      paddingVertical:
        3,
    },
    readingUpdateBadgeText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        9.5,
    },
    noteDate: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        10.5,
    },
    noteLocationPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
      marginBottom: 10,
    },
    noteLocation: {
      color: colors.gold,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 10.5,
      flexShrink: 1,
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
    noteShareButton: {
      alignSelf:
        'flex-start',
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        5,
      marginTop:
        8,
      paddingVertical:
        4,
    },
    noteShareText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
    },
    postedProfileRow: {
      alignSelf:
        'flex-start',
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        5,
      marginTop:
        8,
      paddingVertical:
        4,
    },
    postedProfileText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
    },
    viewLinkedPostButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginLeft: 8,
      paddingVertical: 4,
      paddingHorizontal: 3,
    },
    viewLinkedPostText: {
      color: colors.gold,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
    },
    restartPromptModalSheet: {
      paddingBottom:
        Platform.OS ===
        'ios'
          ? 30
          : 22,
    },
    restartPromptIcon: {
      width:
        48,
      height:
        48,
      borderRadius:
        24,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      alignSelf:
        'center',
      marginTop:
        6,
      marginBottom:
        14,
    },
    restartPromptTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        21,
      textAlign:
        'center',
    },
    restartPromptMessage: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12.5,
      lineHeight:
        19,
      textAlign:
        'center',
      marginTop:
        7,
      marginBottom:
        16,
    },
    restartChoice: {
      minHeight:
        72,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        15,
      backgroundColor:
        colors.background,
      paddingHorizontal:
        12,
      paddingVertical:
        11,
      marginBottom:
        10,
    },
    restartChoiceIcon: {
      width:
        36,
      height:
        36,
      borderRadius:
        11,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        11,
    },
    restartChoiceCopy: {
      flex:
        1,
      marginRight:
        8,
    },
    restartChoiceTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        13,
    },
    restartChoiceText: {
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
    },
    restartCancelButton: {
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
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop:
        2,
    },
    restartCancelText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
    },
    journeyConfirmModalSheet: {
      paddingBottom:
        Platform.OS ===
        'ios'
          ? 30
          : 22,
    },
    journeyConfirmIcon: {
      width:
        48,
      height:
        48,
      borderRadius:
        24,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      alignSelf:
        'center',
      marginTop:
        6,
      marginBottom:
        14,
    },
    journeyConfirmTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        21,
      textAlign:
        'center',
    },
    journeyConfirmMessage: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12.5,
      lineHeight:
        19,
      textAlign:
        'center',
      marginTop:
        7,
    },
    journeyConfirmActions: {
      flexDirection:
        'row',
      gap:
        10,
      marginTop:
        20,
    },
    journeyConfirmCancelButton: {
      flex:
        1,
      minHeight:
        46,
      borderRadius:
        14,
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
    journeyConfirmPrimaryButton: {
      flex:
        1,
      minHeight:
        46,
      borderRadius:
        14,
      borderWidth:
        1,
      borderColor:
        colors.gold,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    journeyConfirmDangerButton: {
      borderColor:
        colors.danger,
      backgroundColor:
        colors.danger,
    },
    journeyConfirmCancelText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
    },
    journeyConfirmPrimaryText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        12.5,
    },
    journeyConfirmDangerText: {
      color:
        colors.text,
    },
    noteMenuButton: {
      width:
        30,
      height:
        30,
      borderRadius:
        9,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        -5,
    },
    noteMenuModalSheet: {
      paddingBottom:
        Platform.OS ===
        'ios'
          ? 28
          : 20,
    },
    noteMenuAction: {
      minHeight:
        56,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        16,
    },
    noteMenuActionIcon: {
      width:
        34,
      height:
        34,
      borderRadius:
        10,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      marginRight:
        12,
    },
    noteMenuActionText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        14,
    },
    noteMenuDeleteText: {
      color:
        '#D86A6A',
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        14,
    },
    noteMenuDivider: {
      height:
        StyleSheet.hairlineWidth,
      backgroundColor:
        colors.border,
      marginLeft:
        62,
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
    historyChevron: {
      marginTop: 2,
      marginLeft: 8,
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
    noteLocationGroup: {
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 17,
      backgroundColor: colors.elevated,
      marginBottom: 18,
    },
    noteEditorScroll: {
      flexShrink: 1,
    },
    noteEditorScrollContent: {
      paddingBottom: 12,
    },
    deleteNoteModalSheet: {
      paddingBottom:
        Platform.OS ===
        'ios'
          ? 30
          : 22,
    },
    deleteNoteIcon: {
      width:
        44,
      height:
        44,
      borderRadius:
        22,
      alignItems:
        'center',
      justifyContent:
        'center',
      alignSelf:
        'center',
      backgroundColor:
        'rgba(216, 106, 106, 0.12)',
      marginTop:
        2,
      marginBottom:
        12,
    },
    deleteNoteTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        18,
      textAlign:
        'center',
    },
    deleteNoteCopy: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12.5,
      lineHeight:
        19,
      textAlign:
        'center',
      marginTop:
        8,
      paddingHorizontal:
        6,
    },
    deleteNoteActions: {
      flexDirection:
        'row',
      gap:
        10,
      marginTop:
        20,
    },
    deleteNoteCancelButton: {
      flex:
        1,
      minHeight:
        46,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        13,
      backgroundColor:
        colors.elevated,
    },
    deleteNoteButton: {
      flex:
        1,
      minHeight:
        46,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderRadius:
        13,
      backgroundColor:
        '#D86A6A',
    },
    deleteNoteButtonText: {
      color:
        '#FFFFFF',
      fontFamily:
        'Inter_700Bold',
      fontSize:
        13,
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
    noteAudioField: {
      width: '100%',
    },
    noteModeRow: {
      flexDirection: 'row',
      width: '100%',
      gap: 0,
      marginTop: 1,
      marginBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    noteModeButton: {
      flex: 1,
      minHeight: 36,
      flexDirection: 'row',
      gap: 5,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    noteModeButtonSelected: {
      borderBottomColor: colors.gold,
    },
    noteModeText: {
      color: colors.mutedText,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
    },
    noteModeTextSelected: {
      color: colors.gold,
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
