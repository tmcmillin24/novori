import { Ionicons } from '@expo/vector-icons';
import {
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import {
    useCallback,
    useMemo,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
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

      setSummaryEditorOpen(
        false
      );
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

      setNoteEditorOpen(
        false
      );

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
            </View>
          </View>

          <View
            style={
              styles.timelineCard
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
                Finished
              </Text>

              <Text
                style={
                  styles.timelineValue
                }
              >
                {
                  data.book
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
                  YOU LEFT OFF HERE
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
                      ? `Updated ${formatDate(
                          data.latest_checkpoint
                            .created_at
                        )}`
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
                Your reading record is preserved after finishing the book.
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
            summaryEditorOpen
          }
          transparent
          animationType="slide"
          onRequestClose={() =>
            setSummaryEditorOpen(
              false
            )
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
              onPress={() =>
                setSummaryEditorOpen(
                  false
                )
              }
            />

            <View
              style={
                styles.modalSheet
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
                  onPress={() =>
                    setSummaryEditorOpen(
                      false
                    )
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
                  onPress={() =>
                    setSummaryEditorOpen(
                      false
                    )
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
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={
            noteEditorOpen
          }
          transparent
          animationType="slide"
          onRequestClose={() =>
            setNoteEditorOpen(
              false
            )
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
              onPress={() =>
                setNoteEditorOpen(
                  false
                )
              }
            />

            <View
              style={[
                styles.modalSheet,
                styles.noteModalSheet,
              ]}
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
                  onPress={() =>
                    setNoteEditorOpen(
                      false
                    )
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
                  onPress={() =>
                    setNoteEditorOpen(
                      false
                    )
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
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal
          visible={
            showHistory
          }
          transparent
          animationType="slide"
          onRequestClose={() =>
            setShowHistory(
              false
            )
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
              onPress={() =>
                setShowHistory(
                  false
                )
              }
            />

            <View
              style={[
                styles.modalSheet,
                styles.historyModalSheet,
              ]}
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
                  onPress={() =>
                    setShowHistory(
                      false
                    )
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
            </View>
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
    statusPillText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
    },
    timelineCard: {
      flexDirection:
        'row',
      alignItems:
        'stretch',
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        16,
      paddingVertical:
        14,
      paddingHorizontal:
        16,
      marginBottom:
        14,
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
      ...StyleSheet.absoluteFill,
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
