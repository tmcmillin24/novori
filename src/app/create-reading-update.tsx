import BookCoverImage from '../components/BookCoverImage';
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
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import CanonicalBookRating from '../components/CanonicalBookRating';
import EditablePostCard from '../components/EditablePostCard';
import PostDestinationPicker from '../components/PostDestinationPicker';
import usePostDestinationClubs from '../hooks/use-post-destination-clubs';
import usePostComposerProfile from '../hooks/use-post-composer-profile';
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

  const publishInFlight = useRef(false);
  const [bookPickerVisible, setBookPickerVisible] = useState(false);
  const [postClubId, setPostClubId] = useState<string | null>(null);
  const [postClubName, setPostClubName] = useState<string | null>(null);
  const { clubs, loadingClubs } = usePostDestinationClubs();
  const viewerProfile = usePostComposerProfile();
  const selectedClub = clubs.find((club) => club.id === postClubId);

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

              if (
                result.length ===
                1
              ) {
                return result[0]
                  .google_book_id;
              }

              return null;
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
        loading
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

          setPostClubId(post.club_id);
          setPostClubName(post.club_name);

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
      loading,
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

  const canPublish =
    !loading && !loadingEditPost && !loadError &&
    Boolean(selectedBook) &&
    Boolean(progress.trim() || chapter.trim() || audioPosition.trim() || thought.trim());

  async function handlePublish() {
    if (
      !selectedBook ||
      !canPublish ||
      publishInFlight.current
    ) {
      return;
    }

    publishInFlight.current = true;
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
        clubId: postClubId,
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
      publishInFlight.current = false;
      setPublishing(
        false
      );
    }
  }

  async function handleSaveChanges() {
    if (
      !selectedBook ||
      !editPostId ||
      publishInFlight.current ||
      !canPublish
    ) {
      return;
    }

    publishInFlight.current = true;
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
          clubId: postClubId,
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
      publishInFlight.current = false;
      setPublishing(
        false
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close reading update editor"
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Reading Update' : 'Reading Update'}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <KeyboardAwareScrollView
        style={styles.screen}
        contentContainerStyle={[styles.editCardScroll, tablet && styles.contentTablet]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <PostDestinationPicker clubs={clubs} loading={loadingClubs} disabled={publishing || loadingEditPost}
          clubId={postClubId} clubName={postClubName} onClubIdChange={setPostClubId} profile={viewerProfile} />
        <EditablePostCard postType="reading_update" clubId={postClubId} author={viewerProfile}
          clubName={selectedClub?.name ?? postClubName} clubCoverUrl={selectedClub?.cover_url}>
          {loading || loadingEditPost ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={colors.gold} />
              <Text style={styles.stateText}>{isEditing ? 'Loading your Reading Update…' : 'Loading your books…'}</Text>
            </View>
          ) : loadError ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Couldn’t load your Reading Update</Text>
              <Text style={styles.stateText}>{loadError}</Text>
              <Pressable onPress={() => void loadBooks()} style={styles.inlineButton}>
                <Text style={styles.inlineButtonText}>Try Again</Text>
              </Pressable>
            </View>
          ) : books.length === 0 ? (
            <View style={styles.stateCard}>
              <Ionicons name="library-outline" size={25} color={colors.gold} />
              <Text style={styles.stateTitle}>Nothing in progress yet</Text>
              <Text style={styles.stateText}>Mark a book as Reading in your Library and it’ll appear here.</Text>
              <Pressable onPress={() => router.push('/(tabs)/library')} style={styles.inlineButton}>
                <Text style={styles.inlineButtonText}>Open Library</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.progressModeRow}>
                {(['page', 'percent', 'audio'] as const).map((modeChoice) => (
                  <Pressable
                    key={modeChoice}
                    accessibilityRole="button"
                    accessibilityState={{ selected: progressMode === modeChoice }}
                    disabled={publishing}
                    onPress={() => {
                      if (modeChoice !== progressMode) {
                        setProgress('');
                        setChapter('');
                        setAudioPosition('');
                        setProgressMode(modeChoice);
                      }
                    }}
                    style={[styles.progressModeButton, progressMode === modeChoice && styles.progressModeButtonSelected]}
                  >
                    {modeChoice === 'audio' ? <Ionicons name="headset-outline" size={13} color={progressMode === modeChoice ? colors.gold : colors.mutedText} /> : null}
                    <Text style={[styles.progressModeText, progressMode === modeChoice && styles.progressModeTextSelected]}>
                      {modeChoice === 'page' ? 'Page' : modeChoice === 'percent' ? 'Percent' : 'Audiobook'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.inlineProgressRow}>
                <View style={styles.inlineProgressField}>
                  <Text style={styles.inlineProgressLabel}>{progressMode === 'audio' ? 'Audio' : progressMode === 'percent' ? 'Progress' : 'Page'}</Text>
                  <TextInput
                    accessibilityLabel={progressMode === 'audio' ? 'Audiobook time' : progressMode === 'percent' ? 'Percent complete' : 'Current page'}
                    editable={!publishing}
                    value={progressMode === 'audio' ? audioPosition : progressMode === 'percent' ? progress.replace(/%/g, '') : progress}
                    onChangeText={(value) => {
                      if (progressMode === 'audio') {
                        setAudioPosition(value);
                      } else {
                        const numeric = value.replace(/%/g, '');
                        setProgress(numeric.trim() && progressMode === 'percent' ? `${numeric}%` : numeric);
                      }
                    }}
                    keyboardType={progressMode === 'audio' ? 'numbers-and-punctuation' : progressMode === 'percent' ? 'decimal-pad' : 'number-pad'}
                    placeholder={progressMode === 'audio' ? '1:23:45' : progressMode === 'percent' ? '63' : '245'}
                    placeholderTextColor={colors.mutedText}
                    style={styles.inlineProgressInput}
                  />
                  {progressMode === 'percent' ? <Text style={styles.inlineProgressLabel}>%</Text> : null}
                </View>
                {progressMode !== 'audio' ? (
                  <View style={styles.inlineProgressField}>
                    <Text style={styles.inlineProgressLabel}>Chapter</Text>
                    <TextInput
                      accessibilityLabel="Chapter (optional)"
                      editable={!publishing}
                      value={chapter}
                      onChangeText={setChapter}
                      placeholder="Optional"
                      placeholderTextColor={colors.mutedText}
                      maxLength={200}
                      style={styles.inlineProgressInput}
                    />
                  </View>
                ) : null}
              </View>
              <TextInput
                accessibilityLabel="Your reading update thoughts (optional)"
                editable={!publishing}
                value={thought}
                onChangeText={setThought}
                placeholder="Add a thought…"
                placeholderTextColor={colors.mutedText}
                multiline
                maxLength={500}
                style={styles.cardThoughtInput}
              />
              <Text style={styles.editCharacterCount}>{thought.length}/500</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selectedBook ? `Selected book: ${selectedBook.title}` : 'Choose a currently reading book'}
                accessibilityHint={!isEditing && books.length > 1 ? 'Choose the book for this Reading Update.' : undefined}
                disabled={publishing || isEditing || books.length === 1}
                onPress={() => setBookPickerVisible(true)}
                style={({ pressed }) => [styles.cardBook, pressed && styles.pressed]}
              >
                {selectedBook ? (
                  <>
                    <BookCoverImage googleBookId={selectedBook.google_book_id} existingCoverUrl={selectedBook.cover_url} style={styles.cardBookCover} />
                    <View style={styles.cardBookCopy}>
                      <View style={styles.cardBookEyebrow}>
                        <Ionicons name="book-outline" size={12} color={colors.gold} />
                        <Text style={styles.cardBookEyebrowText}>BOOK</Text>
                      </View>
                      <Text style={styles.cardBookTitle} numberOfLines={2}>{selectedBook.title}</Text>
                      <Text style={styles.cardBookAuthor} numberOfLines={1}>{formatAuthors(selectedBook.authors)}</Text>
                      <CanonicalBookRating googleBookId={selectedBook.google_book_id} title={selectedBook.title} authors={selectedBook.authors} />
                    </View>
                  </>
                ) : (
                  <>
                    <Ionicons name="book-outline" size={22} color={colors.gold} />
                    <Text style={[styles.cardBookTitle, styles.cardBookCopy]}>Choose a currently reading book</Text>
                  </>
                )}
                {!isEditing && books.length > 1 ? <Ionicons name="chevron-down" size={17} color={colors.mutedText} /> : null}
              </Pressable>
            </>
          )}
        </EditablePostCard>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isEditing ? 'Save Reading Update changes' : 'Publish Reading Update'}
          disabled={!canPublish || publishing}
          onPress={() => void (isEditing ? handleSaveChanges() : handlePublish())}
          style={({ pressed }) => [styles.primaryButton, (!canPublish || publishing) && styles.primaryButtonDisabled, pressed && canPublish && !publishing && styles.primaryButtonPressed]}
        >
          {publishing ? <ActivityIndicator size="small" color={colors.background} /> : (
            <>
              <Text style={[styles.primaryButtonText, !canPublish && styles.primaryButtonTextDisabled]}>{isEditing ? 'Save Changes' : 'Publish Update'}</Text>
              <Ionicons name={isEditing ? 'checkmark' : 'send-outline'} size={18} color={canPublish ? colors.background : colors.mutedText} />
            </>
          )}
        </Pressable>
        <Text style={styles.foundationNote}>
          {isEditing ? 'Editing changes your public update. Your original private Reading Details note stays unchanged.' : 'Your progress is also saved privately in Reading Details.'}
        </Text>
      </KeyboardAwareScrollView>
      <Modal supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']} visible={bookPickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBookPickerVisible(false)}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close book picker" onPress={() => setBookPickerVisible(false)} style={styles.headerButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Currently Reading</Text>
            <View style={styles.headerSpacer} />
          </View>
          <ScrollView contentContainerStyle={styles.editCardScroll}>
            <View style={styles.bookList}>
              {(!isEditing && bookPickerVisible ? books : []).map((book) => (
                <Pressable
                  key={book.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${book.title}`}
                  accessibilityState={{ selected: book.google_book_id === selectedBookId }}
                  onPress={() => {
                    if (book.google_book_id !== selectedBookId) setSourceNoteId(null);
                    setSelectedBookId(book.google_book_id);
                    setBookPickerVisible(false);
                  }}
                  style={({ pressed }) => [styles.bookCard, book.google_book_id === selectedBookId && styles.bookCardSelected, pressed && styles.pressed]}
                >
                  <BookCoverImage googleBookId={book.google_book_id} existingCoverUrl={book.cover_url} style={styles.cover} />
                  <View style={styles.bookCopy}>
                    <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
                    <Text style={styles.bookAuthor} numberOfLines={2}>{formatAuthors(book.authors)}</Text>
                  </View>
                  {book.google_book_id === selectedBookId ? <Ionicons name="checkmark" size={18} color={colors.gold} /> : null}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    inlineProgressRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    inlineProgressField: { flex: 1, minWidth: 120, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.elevated, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    inlineProgressLabel: { color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 15 },
    inlineProgressInput: { flex: 1, minWidth: 40, minHeight: 42, paddingVertical: 8, color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 15 },
    cardThoughtInput: { minHeight: 56, marginTop: 12, padding: 0, textAlignVertical: 'top', color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
    cardBook: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 11, marginTop: 15, gap: 0 },
    cardBookCover: { width: 52, height: 76, borderRadius: 8, backgroundColor: colors.surface, marginRight: 12 },
    cardBookCopy: { flex: 1, minWidth: 0, marginHorizontal: 4 },
    cardBookEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
    cardBookEyebrowText: { color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: 9.5, letterSpacing: 0.5 },
    cardBookTitle: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 },
    cardBookAuthor: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10.5, marginTop: 4 },

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
    contentTablet: {
      maxWidth: '100%',
      paddingHorizontal:
        30,
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
    progressModeRow: {
      flexDirection: 'row',
      width: '100%',
      gap: 0,
      marginTop: 1,
      marginBottom: 0,
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
    editCardScroll: {
      width: '100%',
      maxWidth: '100%',
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 36,
    },
    editCharacterCount: {
      alignSelf: 'flex-end',
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 10,
      marginTop: 6,
    },

    pressed: {
      opacity:
        0.72,
    },
  });
}
