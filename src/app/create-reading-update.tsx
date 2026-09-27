import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useLocalSearchParams,
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
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
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
  getPostDetail,
} from '../lib/feed';
import {
  publishReadingUpdate,
  updateReadingUpdate,
} from '../lib/reading-updates';
import {
  getUserBooks,
  UserBook,
} from '../lib/user-books';

type ScreenMode =
  | 'compose'
  | 'preview';

function formatAuthors(
  authors: string[]
) {
  if (
    !authors ||
    authors.length === 0
  ) {
    return 'Unknown author';
  }

  return authors.join(
    ', '
  );
}

function getProgressLabel(
  progress: string
) {
  const trimmed =
    progress.trim();

  if (!trimmed) {
    return null;
  }

  if (
    trimmed.endsWith(
      '%'
    )
  ) {
    return `${trimmed} complete`;
  }

  return `Page ${trimmed}`;
}

function formatAudioPosition(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const parts = cleaned.split(':');
  if ((parts.length !== 2 && parts.length !== 3) ||
      parts.some((part) => !/^\d+$/.test(part))) return `Audio ${cleaned}`;
  const values = parts.map(Number);
  const seconds = values[values.length - 1];
  const minutes = values[values.length - 2];
  const hours = parts.length === 3 ? values[0] : 0;
  return hours > 0
    ? `Audio ${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `Audio ${minutes}:${String(seconds).padStart(2, '0')}`;
}

function parseReadingUpdateBody(
  body: string
) {
  const normalized =
    body
      .replace(
        /\r\n?/g,
        '\n'
      )
      // Repair a middle dot saved as the UTF-8 mojibake "A-circumflex dot".
      .replace(
        /\u00c2(?=\u00b7)/g,
        ''
      );

  const [
    header = '',
    ...rest
  ] = normalized.split(
    /\n\s*\n/
  );

  // Older updates may use a bullet, a pipe, or a line break
  // between progress fields. Only parse a leading metadata block.
  const pieces =
    header.split(
      /\s*[\u00b7\u2022|]\s*|\s+[\/-]\s+|,\s*(?=Chapter\b)|\n/i
    );

  let progress = '';
  let chapter = '';
  let audioPosition = '';
  let recognized = false;
  const remaining: string[] = [];

  for (const piece of pieces) {
    const value =
      piece
        .trim()
        .replace(
          /^[^A-Za-z0-9]+/,
          ''
        );

    const pageMatch =
      value.match(
        /^Page\s*:?\s*(\d+)$/i
      );
    const percentMatch =
      value.match(
        /^(?:Progress\s*:?\s*)?(\d+(?:\.\d+)?)\s*%$/i
      );
    const chapterMatch =
      value.match(
        /^Chapter\s*:?\s*(.+)$/i
      );
    const audioMatch = value.match(/^Audio(?:book)?\s*:?\s*(\d+:\d{1,2}(?::\d{1,2})?)$/i);

    if (pageMatch) {
      progress = pageMatch[1];
      recognized = true;
    } else if (percentMatch) {
      progress = `${percentMatch[1]}%`;
      recognized = true;
    } else if (chapterMatch) {
      chapter = chapterMatch[1].trim();
      recognized = true;
    } else if (audioMatch) {
      audioPosition = audioMatch[1];
      recognized = true;
    } else if (value) {
      remaining.push(value);
    }
  }

  const thought =
    recognized
      ? [
          remaining.join(' \u00b7 '),
          ...rest,
        ]
          .filter(Boolean)
          .join('\n\n')
          .trim()
      : normalized.trim();

  return {
    progress,
    chapter,
    audioPosition,
    thought:
      thought.slice(
        0,
        500
      ),
  };
}

export default function CreateReadingUpdateScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      bookId?: string;
      progress?: string;
      chapter?: string;
      audioPosition?: string;
      thought?: string;
      sourceNoteId?: string;
      editPostId?: string;
    }>();

  const appliedPrefill =
    useRef(false);

  const editLoaded =
    useRef(false);

  const editPostId =
    typeof params.editPostId ===
      'string'
      ? params.editPostId.trim()
      : '';

  const isEditing =
    Boolean(
      editPostId
    );

  const {
    width,
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

  const tablet =
    width >=
    768;

  const [
    books,
    setBooks,
  ] =
    useState<
      UserBook[]
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
    loadError,
    setLoadError,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    selectedBookId,
    setSelectedBookId,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    progress,
    setProgress,
  ] =
    useState(
      ''
    );

  const [progressMode, setProgressMode] =
    useState<'page' | 'percent' | 'audio'>('page');

  const [
    chapter,
    setChapter,
  ] =
    useState(
      ''
    );

  const [audioPosition, setAudioPosition] = useState('');

  const [
    thought,
    setThought,
  ] =
    useState(
      ''
    );

  const [
    sourceNoteId,
    setSourceNoteId,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    mode,
    setMode,
  ] =
    useState<
      ScreenMode
    >(
      'compose'
    );

  const [
    publishing,
    setPublishing,
  ] =
    useState(
      false
    );

  const [
    loadingEditPost,
    setLoadingEditPost,
  ] =
    useState(
      isEditing
    );

  const loadBooks =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

          setLoadError(
            null
          );

          const result =
            await getUserBooks(
              'reading'
            );

          setBooks(
            result
          );

          setSelectedBookId(
            (current) => {
              if (
                current &&
                result.some(
                  (
                    book
                  ) =>
                    book.google_book_id ===
                    current
                )
              ) {
                return current;
              }

              return (
                result[0]
                  ?.google_book_id ??
                null
              );
            }
          );
        } catch (
          error
        ) {
          setLoadError(
            error instanceof
              Error
              ? error.message
              : 'Unable to load your currently reading books.'
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadBooks();
      },
      [
        loadBooks,
      ]
    )
  );

  useEffect(
    () => {
      if (
        isEditing ||
        appliedPrefill.current ||
        books.length === 0
      ) {
        return;
      }

      const bookId =
        typeof params.bookId ===
          'string'
          ? params.bookId
          : '';

      if (
        bookId &&
        books.some(
          (book) =>
            book.google_book_id ===
            bookId
        )
      ) {
        setSelectedBookId(
          bookId
        );
      }

      if (
        typeof params.progress ===
        'string'
      ) {
        setProgress(
          params.progress
        );
        setProgressMode(
          params.progress.trim().endsWith('%') ? 'percent' : 'page'
        );
      }

      if (
        typeof params.chapter ===
        'string'
      ) {
        setChapter(
          params.chapter
        );
      }

      if (typeof params.audioPosition === 'string') {
        setAudioPosition(params.audioPosition);
        if (params.audioPosition.trim() && !params.progress?.trim()) {
          setProgressMode('audio');
        }
      }

      if (
        typeof params.thought ===
        'string'
      ) {
        setThought(
          params.thought.slice(
            0,
            500
          )
        );
      }

      if (
        typeof params.sourceNoteId ===
        'string' &&
        params.sourceNoteId.trim()
      ) {
        setSourceNoteId(
          params.sourceNoteId.trim()
        );
      }

      appliedPrefill.current =
        true;
    },
    [
      books,
      isEditing,
      params.bookId,
      params.chapter,
      params.audioPosition,
      params.progress,
      params.sourceNoteId,
      params.thought,
    ]
  );

  useEffect(
    () => {
      if (
        !isEditing ||
        !editPostId ||
        editLoaded.current ||
        books.length === 0
      ) {
        return;
      }

      let active =
        true;

      async function loadEditPost() {
        try {
          setLoadingEditPost(
            true
          );

          const post =
            await getPostDetail(
              editPostId
            );

          if (
            !active
          ) {
            return;
          }

          if (
            post.post_type !==
            'reading_update'
          ) {
            throw new Error(
              'This post is not a Reading Update.'
            );
          }

          if (
            !post.google_book_id
          ) {
            throw new Error(
              'This Reading Update is missing its book.'
            );
          }

          const matchingBook =
            books.find(
              (book) =>
                book.google_book_id ===
                post.google_book_id
            );

          if (
            !matchingBook
          ) {
            throw new Error(
              'This book must still be marked Reading in your Library to edit this update.'
            );
          }

          const parsed =
            parseReadingUpdateBody(
              post.body
            );

          setSelectedBookId(
            post.google_book_id
          );
          setProgress(
            parsed.progress
          );
          setProgressMode(
            parsed.progress.endsWith('%') ? 'percent' : 'page'
          );
          setChapter(
            parsed.chapter
          );
          setAudioPosition(parsed.audioPosition);
          if (parsed.audioPosition && !parsed.progress) {
            setProgressMode('audio');
          }
          setThought(
            parsed.thought
          );

          editLoaded.current =
            true;
        } catch (
          error
        ) {
          if (
            active
          ) {
            setLoadError(
              error instanceof
                Error
                ? error.message
                : 'Unable to load this Reading Update.'
            );
          }
        } finally {
          if (
            active
          ) {
            setLoadingEditPost(
              false
            );
          }
        }
      }

      void loadEditPost();

      return () => {
        active =
          false;
      };
    },
    [
      books,
      editPostId,
      isEditing,
    ]
  );

  const selectedBook =
    useMemo(
      () =>
        books.find(
          (
            book
          ) =>
            book.google_book_id ===
            selectedBookId
        ) ??
        null,
      [
        books,
        selectedBookId,
      ]
    );

  const visibleBooks =
    isEditing
      ? selectedBook
        ? [selectedBook]
        : []
      : books;

  const progressLabel =
    getProgressLabel(
      progress
    );

  const canPreview =
    !loadingEditPost &&
    Boolean(
      selectedBook
    ) &&
    Boolean(
      progress.trim() ||
      chapter.trim() ||
      audioPosition.trim() ||
      thought.trim()
    );

  async function handlePublish() {
    if (
      !selectedBook ||
      publishing
    ) {
      return;
    }

    try {
      setPublishing(
        true
      );

      await publishReadingUpdate({
        googleBookId:
          selectedBook.google_book_id,
        progress:
          progress,
        chapter:
          chapter,
        audioPosition,
        thought:
          thought,
        sourceNoteId,
      });

      router.replace(
        '/'
      );
    } catch (
      error
    ) {
      Alert.alert(
        'Could not publish update',
        error instanceof
          Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setPublishing(
        false
      );
    }
  }

  async function handleSaveChanges() {
    if (
      !selectedBook ||
      !editPostId ||
      publishing ||
      !canPreview
    ) {
      return;
    }

    try {
      setPublishing(
        true
      );

      await updateReadingUpdate(
        editPostId,
        {
          googleBookId:
            selectedBook.google_book_id,
          progress,
          chapter,
          audioPosition,
          thought,
        }
      );

      router.back();
    } catch (
      error
    ) {
      Alert.alert(
        'Could not save changes',
        error instanceof
          Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setPublishing(
        false
      );
    }
  }

  if (
    !isEditing &&
    mode ===
      'preview' &&
    selectedBook
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
        edges={[
          'top',
        ]}
      >
        <View
          style={
            styles.header
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to edit"
            onPress={() =>
              setMode(
                'compose'
              )
            }
            hitSlop={
              8
            }
            style={({
              pressed,
            }) => [
              styles.headerButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={
                23
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
            Preview
          </Text>

          <View
            style={
              styles.headerSpacer
            }
          />
        </View>

        <ScrollView
          style={
            styles.screen
          }
          contentContainerStyle={[
            styles.previewScroll,
            tablet &&
              styles.contentTablet,
          ]}
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={
              styles.previewIntro
            }
          >
            <Text
              style={
                styles.eyebrow
              }
            >
              READING UPDATE
            </Text>

            <Text
              style={
                styles.previewTitle
              }
            >
              This is how your update is shaping up.
            </Text>

            <Text
              style={
                styles.previewSubtitle
              }
            >
              Your public update will include the book and progress you entered. Any page, percentage, or chapter is also saved privately as a Reading Details checkpoint.
            </Text>
          </View>

          <View
            style={
              styles.previewCard
            }
          >
            <View
              style={
                styles.previewBookRow
              }
            >
              {selectedBook.cover_url ? (
                <Image
                  source={{
                    uri:
                      selectedBook.cover_url,
                  }}
                  style={
                    styles.previewCover
                  }
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.previewCover,
                    styles.coverPlaceholder,
                  ]}
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
                  styles.previewBookCopy
                }
              >
                <Text
                  style={
                    styles.previewBookTitle
                  }
                  numberOfLines={
                    2
                  }
                >
                  {selectedBook.title}
                </Text>

                <Text
                  style={
                    styles.previewAuthor
                  }
                  numberOfLines={
                    2
                  }
                >
                  {formatAuthors(
                    selectedBook.authors
                  )}
                </Text>

                <View
                  style={
                    styles.progressPills
                  }
                >
                  {progressLabel ? (
                    <View
                      style={
                        styles.progressPill
                      }
                    >
                      <Text
                        style={
                          styles.progressPillText
                        }
                      >
                        {progressLabel}
                      </Text>
                    </View>
                  ) : null}

                  {chapter.trim() ? (
                    <View
                      style={
                        styles.progressPill
                      }
                    >
                      <Text
                        style={
                          styles.progressPillText
                        }
                      >
                        Chapter {chapter.trim()}
                      </Text>
                    </View>
                  ) : null}
                  {formatAudioPosition(audioPosition) ? (
                    <View style={styles.progressPill}>
                      <Text style={styles.progressPillText}>
                        {formatAudioPosition(audioPosition)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {thought.trim() ? (
              <Text
                style={
                  styles.previewThought
                }
              >
                {thought.trim()}
              </Text>
            ) : (
              <Text
                style={
                  styles.previewMuted
                }
              >
                No thought added — this update can be progress-only.
              </Text>
            )}
          </View>

          <View
            style={
              styles.previewActions
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Publish reading update"
              disabled={
                publishing
              }
              onPress={() =>
                void handlePublish()
              }
              style={({
                pressed,
              }) => [
                styles.primaryButton,
                styles.previewActionButton,
                publishing &&
                  styles.primaryButtonDisabled,
                pressed &&
                  !publishing &&
                  styles.primaryButtonPressed,
              ]}
            >
              {publishing ? (
                <ActivityIndicator
                  size="small"
                  color={
                    colors.background
                  }
                />
              ) : (
                <>
                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    Publish Update
                  </Text>

                  <Ionicons
                    name="send"
                    size={
                      17
                    }
                    color={
                      colors.background
                    }
                  />
                </>
              )}
            </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to edit"
            onPress={() =>
              setMode(
                'compose'
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
              Back to Edit
            </Text>
          </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
      edges={[
        'top',
      ]}
    >
      <View
        style={
          styles.flex
        }
      >
        <View
          style={
            styles.header
          }
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close reading update"
            onPress={() =>
              router.back()
            }
            hitSlop={
              8
            }
            style={({
              pressed,
            }) => [
              styles.headerButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="close"
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
            {isEditing
              ? 'Edit Reading Update'
              : 'Reading Update'}
          </Text>

          <View
            style={
              styles.headerSpacer
            }
          />
        </View>

        <KeyboardAwareScrollView
          style={
            styles.screen
          }
          contentContainerStyle={[
            styles.scrollContent,
            tablet &&
              styles.contentTablet,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS ===
            'ios'
              ? 'interactive'
              : 'on-drag'
          }
          bottomOffset={
            20
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={
              styles.intro
            }
          >
            <Text
              style={
                styles.eyebrow
              }
            >
              {isEditing
                ? 'EDIT YOUR UPDATE'
                : 'SHARE YOUR PROGRESS'}
            </Text>

            <Text
              style={[
                styles.title,
                tablet &&
                  styles.titleTablet,
              ]}
            >
              {isEditing
                ? 'Update what you shared'
                : 'What are you reading?'}
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              {isEditing
                ? 'Make your changes below. Saving updates the Reading Update already on your profile.'
                : 'Choose a book already marked Reading in your Library, then add where you are and an optional thought.'}
            </Text>
          </View>

          <View
            style={
              styles.sectionHeader
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              {isEditing
                ? 'Book'
                : 'Currently Reading'}
            </Text>

            {!isEditing &&
            !loading &&
            visibleBooks.length >
              0 ? (
              <Text
                style={
                  styles.sectionCount
                }
              >
                {visibleBooks.length}
              </Text>
            ) : null}
          </View>

          {loading || loadingEditPost ? (
            <View
              style={
                styles.stateCard
              }
            >
              <ActivityIndicator
                color={
                  colors.gold
                }
              />

              <Text
                style={
                  styles.stateText
                }
              >
                {isEditing
                  ? 'Loading your Reading Update…'
                  : 'Loading your books…'}
              </Text>
            </View>
          ) : loadError ? (
            <View
              style={
                styles.stateCard
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={
                  26
                }
                color={
                  colors.gold
                }
              />

              <Text
                style={
                  styles.stateTitle
                }
              >
                Couldn’t load your Library
              </Text>

              <Text
                style={
                  styles.stateText
                }
              >
                {loadError}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Try loading currently reading books again"
                onPress={() =>
                  void loadBooks()
                }
                style={({
                  pressed,
                }) => [
                  styles.inlineButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.inlineButtonText
                  }
                >
                  Try Again
                </Text>
              </Pressable>
            </View>
          ) : visibleBooks.length ===
            0 ? (
            <View
              style={
                styles.stateCard
              }
            >
              <View
                style={
                  styles.emptyIcon
                }
              >
                <Ionicons
                  name="library-outline"
                  size={
                    25
                  }
                  color={
                    colors.gold
                  }
                />
              </View>

              <Text
                style={
                  styles.stateTitle
                }
              >
                Nothing in progress yet
              </Text>

              <Text
                style={
                  styles.stateText
                }
              >
                Mark a book as Reading in your Library and it’ll appear here.
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open Library"
                onPress={() =>
                  router.push(
                    '/(tabs)/library'
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.inlineButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.inlineButtonText
                  }
                >
                  Open Library
                </Text>
              </Pressable>
            </View>
          ) : (
            <View
              style={
                styles.bookList
              }
            >
              {visibleBooks.map(
                (
                  book
                ) => {
                  const selected =
                    book.google_book_id ===
                    selectedBookId;

                  return (
                    <Pressable
                      key={
                        book.id
                      }
                      accessibilityRole="button"
                      accessibilityLabel={
                        isEditing
                          ? `${book.title}, original book`
                          : `Select ${book.title}`
                      }
                      accessibilityState={{
                        selected,
                        disabled:
                          isEditing,
                      }}
                      disabled={
                        isEditing
                      }
                      onPress={() => {
                        if (
                          !isEditing
                        ) {
                          setSelectedBookId(
                            book.google_book_id
                          );
                        }
                      }}
                      style={({
                        pressed,
                      }) => [
                        styles.bookCard,
                        selected &&
                          styles.bookCardSelected,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      {book.cover_url ? (
                        <Image
                          source={{
                            uri:
                              book.cover_url,
                          }}
                          style={
                            styles.cover
                          }
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.cover,
                            styles.coverPlaceholder,
                          ]}
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
                          {book.title}
                        </Text>

                        <Text
                          style={
                            styles.bookAuthor
                          }
                          numberOfLines={
                            2
                          }
                        >
                          {formatAuthors(
                            book.authors
                          )}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.radio,
                          selected &&
                            styles.radioSelected,
                        ]}
                      >
                        {selected ? (
                          <View
                            style={
                              styles.radioDot
                            }
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                }
              )}
            </View>
          )}

          {selectedBook ? (
            <>
              <View
                style={
                  styles.divider
                }
              />

              <View
                style={
                  styles.sectionHeader
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Current Progress
                </Text>

                <Text
                  style={
                    styles.optionalLabel
                  }
                >
                  At least one field
                </Text>
              </View>

              <View style={styles.progressGroup}>
                <Text style={styles.fieldLabel}>Reading position</Text>
                  <View style={styles.progressModeRow}>
                    {(['page', 'percent', 'audio'] as const).map((modeChoice) => (
                      <Pressable
                        key={modeChoice}
                        onPress={() => {
                          if (modeChoice !== progressMode) {
                            setProgress('');
                            setChapter('');
                            setAudioPosition('');
                            setProgressMode(modeChoice);
                          }
                        }}
                        style={[
                          styles.progressModeButton,
                          progressMode === modeChoice && styles.progressModeButtonSelected,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: progressMode === modeChoice }}
                      >
                        {modeChoice === 'audio' ? (
                          <Ionicons
                            name="headset-outline"
                            size={13}
                            color={progressMode === 'audio' ? colors.gold : colors.mutedText}
                          />
                        ) : null}
                        <Text style={[
                          styles.progressModeText,
                          progressMode === modeChoice && styles.progressModeTextSelected,
                        ]}>
                          {modeChoice === 'page' ? 'Page' : modeChoice === 'percent' ? 'Percent' : 'Audiobook'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

              {progressMode === 'audio' ? (
              <View style={styles.audioModeField}>
                <Ionicons name="headset-outline" size={16} color={colors.gold} />
                <View style={styles.audioPositionCopy}>
                  <Text style={styles.fieldLabel}>Audiobook time</Text>
                  <TextInput
                    value={audioPosition}
                    onChangeText={setAudioPosition}
                    keyboardType="numbers-and-punctuation"
                    placeholder="1:23:45 or 23:45"
                    placeholderTextColor={colors.mutedText}
                    style={styles.input}
                    accessibilityLabel="Audiobook playback time"
                  />
                </View>
              </View>
              ) : (
              <View
                style={
                  styles.twoColumnRow
                }
              >
                <View
                  style={
                    styles.fieldColumn
                  }
                >
                  <Text
                    style={
                      styles.fieldLabel
                    }
                  >
                    {progressMode === 'page' ? 'Page number' : 'Percent complete'}
                  </Text>

                  <TextInput
                    value={
                      progressMode === 'percent'
                        ? progress.replace(/%/g, '')
                        : progress
                    }
                    onChangeText={(value) => {
                      const numeric = value.replace(/%/g, '');
                      setProgress(
                        numeric.trim() && progressMode === 'percent'
                          ? `${numeric}%`
                          : numeric
                      );
                    }}
                    placeholder={progressMode === 'percent' ? '63' : '245'}
                    placeholderTextColor={
                      colors.mutedText
                    }
                    autoCapitalize="none"
                    autoCorrect={
                      false
                    }
                    returnKeyType="next"
                    style={
                      styles.input
                    }
                    accessibilityLabel={progressMode === 'percent' ? 'Percent complete' : 'Page number'}
                  />
                </View>

                <View
                  style={
                    styles.fieldColumn
                  }
                >
                  <Text
                    style={
                      styles.fieldLabel
                    }
                  >
                    Chapter
                  </Text>

                  <TextInput
                    value={
                      chapter
                    }
                    onChangeText={
                      setChapter
                    }
                    placeholder="Optional"
                    placeholderTextColor={
                      colors.mutedText
                    }
                    returnKeyType="next"
                    style={
                      styles.input
                    }
                    accessibilityLabel="Current chapter"
                  />
                </View>
              </View>

              )}
              <Text style={styles.progressGroupHint}>
                {progressMode === 'audio' ? 'Enter the playback position from your audiobook.' : 'Add your reading position and an optional chapter.'}
              </Text>
              </View>

              <View
                style={
                  styles.thoughtHeader
                }
              >
                <Text
                  style={
                    styles.fieldLabel
                  }
                >
                  What are you thinking?
                </Text>

                <Text
                  style={
                    styles.optionalLabel
                  }
                >
                  Optional
                </Text>
              </View>

              <TextInput
                value={
                  thought
                }
                onChangeText={
                  setThought
                }
                placeholder="A reaction, prediction, favorite moment, or quick thought…"
                placeholderTextColor={
                  colors.mutedText
                }
                multiline
                textAlignVertical="top"
                maxLength={
                  500
                }
                style={[
                  styles.input,
                  styles.thoughtInput,
                ]}
                accessibilityLabel="Optional thought about your reading progress"
              />

              <View
                style={
                  styles.characterRow
                }
              >
                <Text
                  style={
                    styles.characterCount
                  }
                >
                  {thought.length}/500
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isEditing
                    ? 'Save Reading Update changes'
                    : 'Review reading update'
                }
                disabled={
                  !canPreview ||
                  publishing
                }
                onPress={() => {
                  if (
                    isEditing
                  ) {
                    void handleSaveChanges();
                    return;
                  }

                  setMode(
                    'preview'
                  );
                }}
                style={({
                  pressed,
                }) => [
                  styles.primaryButton,
                  (
                    !canPreview ||
                    publishing
                  ) &&
                    styles.primaryButtonDisabled,
                  pressed &&
                    canPreview &&
                    !publishing &&
                    styles.primaryButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    !canPreview &&
                      styles.primaryButtonTextDisabled,
                  ]}
                >
                  {publishing
                    ? 'Saving…'
                    : isEditing
                    ? 'Save Changes'
                    : 'Review Update'}
                </Text>

                <Ionicons
                  name={
                    isEditing
                      ? 'checkmark'
                      : 'arrow-forward'
                  }
                  size={
                    18
                  }
                  color={
                    canPreview &&
                    !publishing
                      ? colors.background
                      : colors.mutedText
                  }
                />
              </Pressable>

              <Text
                style={
                  styles.foundationNote
                }
              >
                {isEditing
                  ? 'This changes the public Reading Update only. Your private Reading Details note stays as the snapshot you originally saved.'
                  : 'Your update is shared publicly and also saved to your private Reading Details history, so you never have to write it twice.'}
              </Text>
            </>
          ) : null}
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaView>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    flex: {
      flex:
        1,
    },
    safeArea: {
      flex:
        1,
      backgroundColor:
        colors.background,
    },
    screen: {
      flex:
        1,
      backgroundColor:
        colors.background,
    },
    header: {
      height:
        54,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      paddingHorizontal:
        10,
      borderBottomWidth:
        1,
      borderBottomColor:
        colors.border,
      backgroundColor:
        colors.background,
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
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        19,
    },
    headerSpacer: {
      width:
        42,
      height:
        42,
    },
    scrollContent: {
      width:
        '100%',
      maxWidth:
        720,
      alignSelf:
        'center',
      paddingHorizontal:
        20,
      paddingTop:
        22,
      paddingBottom:
        48,
    },
    previewScroll: {
      width:
        '100%',
      maxWidth:
        720,
      alignSelf:
        'center',
      paddingHorizontal:
        20,
      paddingTop:
        26,
      paddingBottom:
        48,
    },
    contentTablet: {
      maxWidth:
        780,
      paddingHorizontal:
        30,
    },
    intro: {
      marginBottom:
        24,
    },
    previewIntro: {
      marginBottom:
        22,
    },
    previewActions: {
      marginTop:
        8,
      gap:
        10,
    },
    previewActionButton: {
      width:
        '100%',
    },
    eyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        10.5,
      letterSpacing:
        1.65,
      marginBottom:
        7,
    },
    title: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        31,
      lineHeight:
        38,
    },
    titleTablet: {
      fontSize:
        36,
      lineHeight:
        43,
    },
    subtitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13.5,
      lineHeight:
        20,
      marginTop:
        8,
      maxWidth:
        580,
    },
    previewTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        27,
      lineHeight:
        34,
    },
    previewSubtitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13,
      lineHeight:
        19,
      marginTop:
        8,
    },
    sectionHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginBottom:
        10,
    },
    sectionTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        14,
    },
    sectionCount: {
      minWidth:
        24,
      height:
        24,
      borderRadius:
        12,
      textAlign:
        'center',
      textAlignVertical:
        'center',
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        11,
      backgroundColor:
        colors.elevated,
      overflow:
        'hidden',
      paddingHorizontal:
        7,
      paddingTop:
        4,
    },
    stateCard: {
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
      borderRadius:
        18,
      paddingHorizontal:
        20,
      paddingVertical:
        28,
      gap:
        10,
    },
    emptyIcon: {
      width:
        50,
      height:
        50,
      borderRadius:
        17,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    stateTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        15,
      textAlign:
        'center',
      marginTop:
        2,
    },
    stateText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12.5,
      lineHeight:
        18,
      textAlign:
        'center',
      maxWidth:
        420,
    },
    inlineButton: {
      borderRadius:
        999,
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
      paddingHorizontal:
        15,
      paddingVertical:
        9,
      marginTop:
        4,
    },
    inlineButtonText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        12,
    },
    bookList: {
      gap:
        10,
    },
    bookCard: {
      minHeight:
        96,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        18,
      padding:
        11,
    },
    bookCardSelected: {
      borderColor:
        colors.gold,
      backgroundColor:
        colors.elevated,
    },
    cover: {
      width:
        51,
      height:
        76,
      borderRadius:
        8,
      backgroundColor:
        colors.elevated,
    },
    coverPlaceholder: {
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
      paddingHorizontal:
        12,
    },
    bookTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        14,
      lineHeight:
        18,
    },
    bookAuthor: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11.5,
      lineHeight:
        16,
      marginTop:
        4,
    },
    radio: {
      width:
        22,
      height:
        22,
      borderRadius:
        11,
      borderWidth:
        1.5,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        2,
    },
    radioSelected: {
      borderColor:
        colors.gold,
    },
    radioDot: {
      width:
        10,
      height:
        10,
      borderRadius:
        5,
      backgroundColor:
        colors.gold,
    },
    divider: {
      height:
        1,
      backgroundColor:
        colors.border,
      marginVertical:
        24,
    },
    twoColumnRow: {
      flexDirection:
        'row',
      gap:
        10,
    },
    progressGroup: {
      padding: 15,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    audioPositionField: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginTop: 15,
    },
    audioPositionCopy: {
      flex: 1,
    },
    progressGroupHint: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 10.5,
      lineHeight: 15,
      marginTop: 10,
    },
    progressModeRow: {
      flexDirection: 'row',
      width: '100%',
      maxWidth: 300,
      alignSelf: 'center',
      gap: 0,
      marginTop: 1,
      marginBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    progressModeButton: {
      flex: 1,
      minHeight: 36,
      flexDirection: 'row',
      gap: 5,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    progressModeButtonSelected: {
      borderBottomColor: colors.gold,
    },
    progressModeText: {
      color: colors.mutedText,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
    },
    progressModeTextSelected: {
      color: colors.gold,
    },
    audioModeField: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    fieldColumn: {
      flex:
        1,
      minWidth:
        0,
    },
    fieldLabel: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
      marginBottom:
        7,
    },
    optionalLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        10.5,
    },
    input: {
      minHeight:
        48,
      borderRadius:
        14,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        14,
      paddingHorizontal:
        13,
      paddingVertical:
        11,
    },
    fieldHelp: {
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
      marginBottom:
        22,
    },
    thoughtHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      marginTop: 20,
      marginBottom: 8,
    },
    thoughtInput: {
      minHeight:
        122,
      paddingTop:
        13,
    },
    characterRow: {
      flexDirection:
        'row',
      justifyContent:
        'flex-end',
      marginTop:
        6,
    },
    characterCount: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
    },
    primaryButton: {
      minHeight:
        50,
      borderRadius:
        16,
      backgroundColor:
        colors.gold,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        7,
      marginTop:
        20,
      paddingHorizontal:
        18,
    },
    primaryButtonDisabled: {
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    primaryButtonPressed: {
      opacity:
        0.78,
      transform: [
        {
          scale:
            0.99,
        },
      ],
    },
    primaryButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        13.5,
    },
    primaryButtonTextDisabled: {
      color:
        colors.mutedText,
    },
    foundationNote: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10,
      lineHeight:
        15,
      textAlign:
        'center',
      marginTop:
        10,
      paddingHorizontal:
        12,
    },
    previewCard: {
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        20,
      padding:
        16,
    },
    previewBookRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
    },
    previewCover: {
      width:
        66,
      height:
        98,
      borderRadius:
        9,
      backgroundColor:
        colors.elevated,
    },
    previewBookCopy: {
      flex:
        1,
      minWidth:
        0,
      paddingLeft:
        13,
    },
    previewBookTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        15,
      lineHeight:
        19,
    },
    previewAuthor: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11.5,
      lineHeight:
        16,
      marginTop:
        4,
    },
    progressPills: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        6,
      marginTop:
        11,
    },
    progressPill: {
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        999,
      paddingHorizontal:
        9,
      paddingVertical:
        5,
    },
    progressPillText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        10.5,
    },
    previewThought: {
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        14,
      lineHeight:
        21,
      marginTop:
        17,
      paddingTop:
        15,
      borderTopWidth:
        1,
      borderTopColor:
        colors.border,
    },
    previewMuted: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      lineHeight:
        18,
      marginTop:
        17,
      paddingTop:
        15,
      borderTopWidth:
        1,
      borderTopColor:
        colors.border,
    },
    secondaryButton: {
      minHeight:
        48,
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
      marginTop:
        14,
    },
    secondaryButtonText: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        13,
    },
    pressed: {
      opacity:
        0.72,
    },
  });
}
