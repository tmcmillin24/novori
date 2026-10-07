import { displayBookTitle } from '../lib/book-title';
import { dismissKeyboardBeforeWarning } from '../lib/dismiss-keyboard-before-warning';
import {resolveStackDragTarget} from '../lib/stack-drag-target';
import { resolveCanonicalBookCover } from '../lib/canonical-book-covers';
import { Ionicons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import BookCoverImage from '../components/BookCoverImage';
import BookStackShowcase from '../components/BookStackShowcase';
import EditablePostCard from '../components/EditablePostCard';
import PostDestinationPicker from '../components/PostDestinationPicker';
import usePostDestinationClubs from '../hooks/use-post-destination-clubs';
import usePostComposerProfile from '../hooks/use-post-composer-profile';
import ValidationWarningSheet from '../components/ValidationWarningSheet';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import SortableBookStackRow, {
  StackDropEdge,
} from '../components/SortableBookStackRow';
import {
  NovoriColors,
} from '../constants/novori-theme';
import {
  useNovoriTheme,
} from '../context/theme-context';
import {
  getNovoriSearchBookCover,
  GoogleBookSearchItem,
  searchNovoriBooks,
} from '../lib/book-search';
import {
  BookStackDraftItem,
  saveBookStackSubmission,
  getBookStack,
} from '../lib/book-stacks';
import {
  getPostDetail,
} from '../lib/feed';
import {
  supabase,
} from '../lib/supabase';

const MAX_STACK_BOOKS = 10;
const MIN_STACK_BOOKS = 2;
const MIN_BOOK_SEARCH_LENGTH = 2;
const AUTO_BOOK_SEARCH_MIN_LENGTH = 4;
const BOOK_SEARCH_DELAY_MS = 700;

function getStackBookPrimaryIsbn(
  book: GoogleBookSearchItem
) {
  const identifiers =
    book.volumeInfo
      .industryIdentifiers ??
    [];

  return (
    identifiers.find(
      (
        identifier
      ) =>
        identifier.type ===
        'ISBN_13'
    )?.identifier ??
    identifiers.find(
      (
        identifier
      ) =>
        identifier.type ===
        'ISBN_10'
    )?.identifier ??
    book.novoriWork
      ?.isbns?.[0] ??
    null
  );
}

async function resolveBookStackCover(book: GoogleBookSearchItem, initialCover: string | null) {
  return resolveCanonicalBookCover({
    googleBookId: book.id,
    isbn: getStackBookPrimaryIsbn(book),
    imageLinks: book.volumeInfo.imageLinks,
    existingCoverUrl: book.novoriWork?.canonicalCoverUrl ?? initialCover,
  });
}

export default function CreateBookStackScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      editPostId?: string;
      stackId?: string;
    }>();

  const editPostId =
    typeof params.editPostId ===
    'string'
      ? params.editPostId
      : '';

  const editStackId =
    typeof params.stackId ===
    'string'
      ? params.stackId
      : '';

  const isEditing =
    Boolean(
      editStackId
    );

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const [
    name,
    setName,
  ] =
    useState('');

  const [
    items,
    setItems,
  ] =
    useState<
      BookStackDraftItem[]
    >([]);

  const [
    searchOpen,
    setSearchOpen,
  ] =
    useState(false);

  const [
    query,
    setQuery,
  ] =
    useState('');

  const [
    results,
    setResults,
  ] =
    useState<
      GoogleBookSearchItem[]
    >([]);

  const [
    searching,
    setSearching,
  ] =
    useState(false);

  const [
    searchError,
    setSearchError,
  ] =
    useState('');

  const [
    resolvingBookIds,
    setResolvingBookIds,
  ] =
    useState<string[]>(
      []
    );

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [clubId, setClubId] = useState<string | null>(null);
  const [clubName, setClubName] = useState<string | null>(null);
  const { clubs, loadingClubs } = usePostDestinationClubs();
  const viewerProfile = usePostComposerProfile();
  const [stackWarning, setStackWarning] = useState<{ title: string; message: string } | null>(null);
  async function showStackFailure(error: unknown, operation: 'save' | 'publish') {
    const details = error && typeof error === 'object'
      ? error as { code?: string; message?: string; review_id?: string }
      : null;
    const moderation = details?.code === 'NOVORI_MODERATION';
    if (!moderation) console.error(`Could not ${operation} Book Stack:`, error);
    await dismissKeyboardBeforeWarning();
    setStackWarning({
      title: moderation && details?.review_id ? 'Submission under review' : `Could not ${operation} stack`,
      message: moderation && details?.review_id
        ? 'Your stack submission needs a safety review. After approval, you can submit it again. For help, contact support@novori.link.'
        : details?.message || 'Please try again.',
    });
  }

  const selectedClub = clubs.find((club) => club.id === clubId);
  const [postTextHeight, setPostTextHeight] = useState(22);
  const saveInFlight = useRef(false);

  const [
    postText,
    setPostText,
  ] =
    useState('');

  const [
    publishing,
    setPublishing,
  ] =
    useState(false);

  const [
    loadingExistingStack,
    setLoadingExistingStack,
  ] =
    useState(
      isEditing
    );

  const [
    draggingBookId,
    setDraggingBookId,
  ] =
    useState<
      string | null
    >(null);

  const [
    dragTargetIndex,
    setDragTargetIndex,
  ] =
    useState<
      number | null
    >(null);

  const [
    dragTargetEdge,
    setDragTargetEdge,
  ] =
    useState<
      StackDropEdge
    >(null);

  const dragStartIndexRef =
    useRef<
      number | null
    >(null);

  const dragBookIdRef =
    useRef<
      string | null
    >(null);

  const dragTargetIndexRef =
    useRef<
      number | null
    >(null);

  const timerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const requestRef =
    useRef(0);

  useEffect(() => {
    let active =
      true;

    async function loadExistingStack() {
      if (
        !isEditing
      ) {
        setLoadingExistingStack(
          false
        );
        return;
      }

      try {
        const stack =
          await getBookStack(
            editStackId
          );

        const post =
          editPostId
            ? await getPostDetail(
                editPostId
              )
            : null;

        if (
          !active
        ) {
          return;
        }

        setName(
          stack.name
        );

        setItems(
          stack.items.map(
            (
              item
            ) => ({
              googleBookId:
                item.google_book_id,
              title:
                item.title,
              authors:
                item.authors,
              coverUrl:
                item.cover_url,
            })
          )
        );

        setPostText(
          post?.body ??
            ''
        );

        setClubId(post?.club_id ?? null);
        setClubName(post?.club_name ?? null);
      } catch (
        error
      ) {
        console.error(
          'Could not load Book Stack for editing:',
          error
        );

        Alert.alert(
          'Could not load stack',
          'Please try again.',
          [
            {
              text:
                'OK',
              onPress: () =>
                router.back(),
            },
          ]
        );
      } finally {
        if (
          active
        ) {
          setLoadingExistingStack(
            false
          );
        }
      }
    }

    void loadExistingStack();

    return () => {
      active =
        false;
    };
  }, [
    editPostId,
    editStackId,
    isEditing,
    router,
  ]);

  useEffect(() => {
    if (
      timerRef.current
    ) {
      clearTimeout(
        timerRef.current
      );
    }

    const searchTerm =
      query.trim();

    if (
      !searchOpen
    ) {
      requestRef.current +=
        1;
      setSearching(false);
      return;
    }

    if (
      searchTerm.length <
        MIN_BOOK_SEARCH_LENGTH
    ) {
      requestRef.current +=
        1;
      setResults([]);
      setSearchError('');
      setSearching(false);
      return;
    }

    if (
      searchTerm.length <
        AUTO_BOOK_SEARCH_MIN_LENGTH
    ) {
      requestRef.current +=
        1;
      setSearching(false);
      return;
    }

    const requestId =
      ++requestRef.current;

    timerRef.current =
      setTimeout(() => {
        void performSearch(
          searchTerm,
          requestId
        );
      }, BOOK_SEARCH_DELAY_MS);

    return () => {
      if (
        timerRef.current
      ) {
        clearTimeout(
          timerRef.current
        );
      }
    };
  }, [
    query,
    searchOpen,
  ]);

  async function performSearch(
    searchTerm: string,
    requestId: number
  ) {
    try {
      setSearching(true);
      setSearchError('');

      const next =
        await searchNovoriBooks(
          searchTerm
        );

      if (
        requestId !==
        requestRef.current
      ) {
        return;
      }

      setResults(
        next
      );
    } catch (
      error
    ) {
      if (
        requestId !==
        requestRef.current
      ) {
        return;
      }

      console.error(
        'Could not search books for stack:',
        error
      );

      setSearchError(
        'Could not search books. Please try again.'
      );

      setResults([]);
    } finally {
      if (
        requestId ===
        requestRef.current
      ) {
        setSearching(false);
      }
    }
  }

  function searchImmediately() {
    if (
      timerRef.current
    ) {
      clearTimeout(
        timerRef.current
      );
    }

    const searchTerm =
      query.trim();

    if (
      searchTerm.length <
        MIN_BOOK_SEARCH_LENGTH
    ) {
      return;
    }

    const requestId =
      ++requestRef.current;

    void performSearch(
      searchTerm,
      requestId
    );
  }

  function openBookSearch() {
    setSearchOpen(
      true
    );
  }

  function closeBookSearch() {
    setSearchOpen(
      false
    );
  }

  function isAdded(
    googleBookId: string
  ) {
    return items.some(
      (item) =>
        item.googleBookId ===
        googleBookId
    );
  }

  async function toggleBookSelection(
    book:
      GoogleBookSearchItem
  ) {
    const alreadySelected =
      isAdded(
        book.id
      );

    if (
      alreadySelected
    ) {
      setItems(
        (
          current
        ) =>
          current.filter(
            (
              item
            ) =>
              item.googleBookId !==
              book.id
          )
      );
      return;
    }

    if (
      resolvingBookIds.includes(
        book.id
      )
    ) {
      return;
    }

    if (
      items.length >=
      MAX_STACK_BOOKS
    ) {
      Alert.alert(
        'Stack is full',
        'Book Stacks can contain up to 10 books.'
      );
      return;
    }

    const initialCover =
      getNovoriSearchBookCover(
        book
      );

    setResolvingBookIds(
      (
        current
      ) =>
        current.includes(
          book.id
        )
          ? current
          : [
              ...current,
              book.id,
            ]
    );

    let finalCover: string | null =
      initialCover;

    try {
      finalCover =
        await resolveBookStackCover(
          book,
          initialCover
        );
    } catch (
      error
    ) {
      console.warn(
        'Could not refine Book Stack cover:',
        error
      );
    } finally {
      setResolvingBookIds(
        (
          current
        ) =>
          current.filter(
            (
              id
            ) =>
              id !==
              book.id
          )
      );
    }

    setItems(
      (
        current
      ) => {
        if (
          current.some(
            (
              item
            ) =>
              item.googleBookId ===
              book.id
          ) ||
          current.length >=
            MAX_STACK_BOOKS
        ) {
          return current;
        }

        const next:
          BookStackDraftItem = {
            googleBookId:
              book.id,
            title:
              book.volumeInfo.title
                ?.trim() ||
              'Untitled',
            authors:
              book.volumeInfo.authors ??
              [],
            coverUrl:
              finalCover,
          };

        return [
          ...current,
          next,
        ];
      }
    );
  }

  function removeBook(
    index: number
  ) {
    setItems(
      (
        current
      ) =>
        current.filter(
          (
            _,
            itemIndex
          ) =>
            itemIndex !==
            index
        )
    );
  }

  function moveBookTo(
    bookId: string,
    toIndex: number
  ) {
    setItems(
      (
        current
      ) => {
        const fromIndex =
          current.findIndex(
            (
              item
            ) =>
              item.googleBookId ===
              bookId
          );

        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          toIndex >=
            current.length ||
          fromIndex ===
            toIndex
        ) {
          return current;
        }

        const next = [
          ...current,
        ];

        const [
          moved,
        ] =
          next.splice(
            fromIndex,
            1
          );

        next.splice(
          toIndex,
          0,
          moved
        );

        return next;
      }
    );
  }

  function startBookDrag(
    bookId: string,
    index: number
  ) {
    dragStartIndexRef.current =
      index;

    dragBookIdRef.current =
      bookId;

    dragTargetIndexRef.current =
      index;

    setDraggingBookId(
      bookId
    );

    setDragTargetIndex(
      index
    );

    setDragTargetEdge(
      null
    );
  }

  function moveBookDrag(
    bookId: string,
    translationY: number
  ) {
    const startIndex =
      dragStartIndexRef.current;

    if (
      startIndex ===
      null
    ) {
      return;
    }

    const {index: targetIndex, edge} = resolveStackDragTarget(startIndex, translationY, items.length);

    dragTargetIndexRef.current =
      targetIndex;

    setDragTargetIndex(
      targetIndex
    );

    setDragTargetEdge(
      edge
    );
  }

  function endBookDrag() {
    const draggedBookId =
      dragBookIdRef.current;

    const targetIndex =
      dragTargetIndexRef.current;

    if (
      draggedBookId &&
      targetIndex !==
        null
    ) {
      moveBookTo(
        draggedBookId,
        targetIndex
      );
    }

    dragStartIndexRef.current =
      null;

    dragBookIdRef.current =
      null;

    dragTargetIndexRef.current =
      null;

    setDraggingBookId(
      null
    );

    setDragTargetIndex(
      null
    );

    setDragTargetEdge(
      null
    );
  }

  function validateStack() {
    const cleanName =
      name.trim();

    if (
      !cleanName
    ) {
      Keyboard.dismiss();
      setStackWarning({ title: 'Name your stack', message: 'Give this Book Stack a name before saving it.' });
      return false;
    }

    if (
      items.length <
      MIN_STACK_BOOKS
    ) {
      Keyboard.dismiss();
      setStackWarning({ title: 'Add more books', message: 'A Book Stack needs at least 2 books.' });
      return false;
    }

    return true;
  }

  async function saveStack() {
    if (saveInFlight.current || !validateStack()) return;
    saveInFlight.current = true;

    try {
      await dismissKeyboardBeforeWarning();
      setSaving(true);

      await saveBookStackSubmission({ name, items, stackId: isEditing ? editStackId : null,
        publish: Boolean(editPostId), body: postText, clubId, postId: editPostId || null });
      router.replace(editPostId ? '/(tabs)' : '/(tabs)/profile');
    } catch (
      error
    ) {
      await showStackFailure(error, 'save');
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }

  async function publishStack() {
    if (saveInFlight.current || !validateStack()) return;
    saveInFlight.current = true;

    try {
      await dismissKeyboardBeforeWarning();
      setPublishing(
        true
      );

      await saveBookStackSubmission({ name, items, stackId: isEditing ? editStackId : null,
        publish: true, body: postText, clubId, postId: editPostId || null });

      router.replace(
        '/(tabs)'
      );
    } catch (
      error
    ) {
      await showStackFailure(error, 'publish');
    } finally {
      saveInFlight.current = false;
      setPublishing(
        false
      );
    }
  }

  const arrangedItems =
    draggingBookId &&
    dragTargetIndex !==
      null
      ? (() => {
          const fromIndex =
            items.findIndex(
              (
                item
              ) =>
                item.googleBookId ===
                draggingBookId
            );

          if (
            fromIndex < 0 ||
            fromIndex ===
              dragTargetIndex
          ) {
            return items;
          }

          const next = [
            ...items,
          ];

          const [
            moved,
          ] =
            next.splice(
              fromIndex,
              1
            );

          next.splice(
            dragTargetIndex,
            0,
            moved
          );

          return next;
        })()
      : items;

  const visualItems =
    arrangedItems.map(
      (
        item,
        index
      ) => ({
        id:
          item.googleBookId,
        stack_id:
          'draft',
        google_book_id:
          item.googleBookId,
        title:
          item.title,
        authors:
          item.authors,
        cover_url:
          item.coverUrl,
        position:
          index,
        created_at:
          '',
      })
    );

  if (
    loadingExistingStack
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={{
            flex: 1,
            alignItems:
              'center',
            justifyContent:
              'center',
          }}
        >
          <ActivityIndicator
            size="small"
            color={
              colors.gold
            }
          />
        </View>
      </SafeAreaView>
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
          hitSlop={10}
          style={
            styles.headerButton
          }
        >
          <Ionicons
            name="close"
            size={25}
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
          {isEditing ? 'Edit Book Stack' : 'Book Stack'}
        </Text>

        <View
          style={
            styles.headerButton
          }
        />
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        scrollEnabled={!draggingBookId}
        keyboardShouldPersistTaps="handled"
        disableScrollOnKeyboardHide
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
      >
        <PostDestinationPicker clubs={clubs} loading={loadingClubs} disabled={saving || publishing}
          clubId={clubId} clubName={clubName} onClubIdChange={setClubId} profile={viewerProfile} />
        <EditablePostCard
          postType="book_stack"
          author={viewerProfile}
          clubId={clubId}
          clubName={selectedClub?.name ?? clubName}
          clubCoverUrl={selectedClub?.cover_url}
        >
          <TextInput
            accessibilityLabel="Optional text about this stack"
            editable={!saving && !publishing}
            value={postText}
            onChangeText={setPostText}
            placeholder="Say something about this stack… (optional)"
            placeholderTextColor={colors.mutedText}
            multiline
            scrollEnabled={false}
            onContentSizeChange={({ nativeEvent }) => setPostTextHeight(Math.max(22, Math.ceil(nativeEvent.contentSize.height)))}
            maxLength={4000}
            style={[styles.postInput, { height: postTextHeight }]}
          />
          <BookStackShowcase
            animateLayout={Boolean(draggingBookId)}
            name={name}
            onNameChange={setName}
            disabled={saving || publishing}
            items={visualItems}
            variant="feed"
            compactTopSpacing
          >
            <View style={styles.cardStackControls} pointerEvents={saving || publishing ? 'none' : 'auto'}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add books to stack"
                disabled={items.length >= MAX_STACK_BOOKS || saving || publishing}
                onPress={openBookSearch}
                style={({ pressed }) => [styles.addBookButton, items.length >= MAX_STACK_BOOKS && styles.disabled, pressed && styles.pressed]}
              >
                <Ionicons name="add" size={18} color={colors.gold} />
                <Text style={styles.addBookText}>Add Books</Text>
                <Text style={styles.cardBookCount}>{items.length}/{MAX_STACK_BOOKS}</Text>
              </Pressable>
              {items.length > 0 ? (
                <>
                  <Text style={styles.sectionSubtext}>Hold the grip to rearrange your books.</Text>
                  <View style={styles.arrangeList}>
                    {items.map((item, index) => (
                      <SortableBookStackRow
                        key={item.googleBookId}
                        item={item}
                        index={index}
                        rowCount={items.length}
                        animateLayout={Boolean(draggingBookId)}
                        isDragging={draggingBookId === item.googleBookId}
                        dropEdge={dragTargetIndex === index ? dragTargetEdge : null}
                        onDragStart={startBookDrag}
                        onDragMove={moveBookDrag}
                        onDragEnd={endBookDrag}
                        onRemove={() => removeBook(index)}
                        colors={colors}
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          </BookStackShowcase>
        </EditablePostCard>
        <View style={styles.actionSection}>
          {editPostId ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save stack to profile without posting"
              disabled={saving || publishing}
              onPress={() => void saveStack()}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, (saving || publishing) && styles.disabled]}
            >
              {saving ? <ActivityIndicator size="small" color={colors.gold} /> : <Ionicons name="person-outline" size={18} color={colors.gold} />}
              <Text style={styles.secondaryButtonText}>{isEditing ? 'Save Stack' : 'Save to Profile'}</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editPostId ? 'Save Book Stack post changes' : 'Save and publish Book Stack'}
            disabled={saving || publishing}
            onPress={() => void publishStack()}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, (saving || publishing) && styles.disabled]}
          >
            {publishing ? <ActivityIndicator size="small" color={colors.background} /> : (
              <>
                <Text style={styles.primaryButtonText}>{editPostId ? 'Save Changes' : 'Save & Post'}</Text>
                <Ionicons name={editPostId ? 'checkmark' : 'send-outline'} size={18} color={colors.background} />
              </>
            )}
          </Pressable>
          {editPostId ? null : (
            <Text style={styles.actionHint}>Save to Profile keeps the stack without a post. Save & Post shares the card above.</Text>
          )}
        </View>
      </KeyboardAwareScrollView>

      <ValidationWarningSheet visible={Boolean(stackWarning)} title={stackWarning?.title ?? ''}
        message={stackWarning?.message ?? ''} onDismiss={() => setStackWarning(null)} />

      <Modal supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
        visible={
          searchOpen
        }
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={
          closeBookSearch
        }
      >
        <SafeAreaView
          style={
            styles.searchSafeArea
          }
        >
          <View
            style={
              styles.searchHeader
            }
          >
            <Pressable
              onPress={
                closeBookSearch
              }
              hitSlop={10}
              style={
                styles.searchClose
              }
            >
              <Ionicons
                name="close"
                size={24}
                color={
                  colors.text
                }
              />
            </Pressable>

            <Text
              style={
                styles.searchTitle
              }
            >
              Add Books
            </Text>

            <Text
              style={
                styles.searchCount
              }
            >
              {items.length}/10
            </Text>
          </View>

          <View
            style={
              styles.searchBox
            }
          >
            <Ionicons
              name="search"
              size={18}
              color={
                colors.mutedText
              }
            />

            <TextInput
              value={
                query
              }
              onChangeText={
                setQuery
              }
              placeholder="Search title or author"
              placeholderTextColor={
                colors.mutedText
              }
              autoFocus
              returnKeyType="search"
              onSubmitEditing={
                searchImmediately
              }
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              blurOnSubmit={false}
              style={
                styles.searchInput
              }
            />

            {searching ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.gold
                }
              />
            ) : query ? (
              <Pressable
                onPress={() =>
                  setQuery('')
                }
                hitSlop={8}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={
                    colors.mutedText
                  }
                />
              </Pressable>
            ) : null}
          </View>

          {searchError ? (
            <Text
              style={
                styles.searchError
              }
            >
              {
                searchError
              }
            </Text>
          ) : null}

          <ScrollView
            contentContainerStyle={
              styles.searchResults
            }
            keyboardShouldPersistTaps="handled"
          >
            {results.map(
              (
                book
              ) => {
                const added =
                  isAdded(
                    book.id
                  );

                const info =
                  book.volumeInfo;

                const isbn =
                  info
                    .industryIdentifiers
                    ?.find(
                      (
                        identifier
                      ) =>
                        identifier.type ===
                          'ISBN_13'
                    )
                    ?.identifier ??
                  info
                    .industryIdentifiers
                    ?.find(
                      (
                        identifier
                      ) =>
                        identifier.type ===
                          'ISBN_10'
                    )
                    ?.identifier;

                const canonicalCover =
                  book.novoriWork
                    ?.canonicalCoverUrl ??
                  null;

                const cover =
                  getNovoriSearchBookCover(
                    book
                  );

                const resolving =
                  resolvingBookIds.includes(
                    book.id
                  );

                return (
                  <Pressable
                    key={
                      book.id
                    }
                    onPress={() =>
                      void toggleBookSelection(
                        book
                      )
                    }
                    style={({ pressed }) => [
                      styles.searchResult,
                      added &&
                        styles.searchResultSelected,
                      pressed &&
                        styles.searchResultPressed,
                    ]}
                  >
                    {(book.id || cover) ? (
                      <BookCoverImage
                        googleBookId={book.id}
                        imageLinks={
                          info.imageLinks
                        }
                        isbn={
                          isbn
                        }
                        existingCoverUrl={
                          canonicalCover
                        }
                        style={
                          styles.resultCover
                        }
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={
                          styles.resultCoverFallback
                        }
                      >
                        <Text
                          style={
                            styles.resultCoverFallbackText
                          }
                        >
                          No Cover
                        </Text>
                      </View>
                    )}

                    <View
                      style={
                        styles.resultCopy
                      }
                    >
                      <Text
                        style={
                          styles.resultTitle
                        }
                        numberOfLines={2}
                      >
                        {displayBookTitle(info.title || 'Untitled')}
                      </Text>

                      <Text
                        style={
                          styles.resultAuthor
                        }
                        numberOfLines={1}
                      >
                        {info.authors?.join(
                          ', '
                        ) ||
                          'Unknown author'}
                      </Text>

                      {typeof book.novoriWork
                        ?.hardcoverRating ===
                      'number' ? (
                        <View
                          style={
                            styles.resultRatingStars
                          }
                        >
                          {[1,2,3,4,5].map(
                            (
                              star
                            ) => {
                              const rating =
                                book.novoriWork
                                  ?.hardcoverRating ??
                                0;

                              return (
                                <Ionicons
                                  key={
                                    star
                                  }
                                  name={
                                    rating >=
                                    star
                                      ? 'star'
                                      : rating >=
                                        star -
                                          0.5
                                        ? 'star-half'
                                        : 'star-outline'
                                  }
                                  size={14}
                                  color={
                                    colors.gold
                                  }
                                />
                              );
                            }
                          )}
                        </View>
                      ) : null}

                      {info.publishedDate ? (
                        <Text
                          style={
                            styles.resultMeta
                          }
                        >
                          {
                            info.publishedDate
                          }
                        </Text>
                      ) : null}

                      <Text
                        style={
                          styles.resultActionText
                        }
                      >
                        {added
                          ? 'Added to stack'
                          : 'Add to stack'}
                      </Text>
                    </View>

                    {resolving ? (
                      <ActivityIndicator
                        size="small"
                        color={
                          colors.gold
                        }
                      />
                    ) : (
                      <Ionicons
                        name={
                          added
                            ? 'checkmark-circle'
                            : 'add-circle-outline'
                        }
                        size={24}
                        color={
                          added
                            ? colors.secondaryText
                            : colors.gold
                        }
                      />
                    )}
                  </Pressable>
                );
              }
            )}
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
    cardStackControls: { paddingHorizontal: 14, paddingBottom: 14 },
    cardBookCount: { marginLeft: 'auto', color: colors.mutedText, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    safeArea: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    header: {
      height: 54,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 12,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },

    headerButton: {
      width: 42,
      height: 42,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    headerTitle: {
      flex: 1,
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 19,
      textAlign:
        'center',
    },

    content: {
      width: '100%',
      maxWidth: '100%',
      alignSelf:
        'center',
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 46,
    },

    sectionSubtext: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      marginTop: 4,
    },

    addBookButton: {
      minHeight: 45,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 4,
      paddingHorizontal: 14,
      marginTop: 14,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 13,
      backgroundColor:
        colors.surface,
    },

    addBookText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 12,
    },

    arrangeList: {
      marginTop: 12,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.border,
    },

    actionSection: {
      gap: 10,
      paddingTop: 6,
    },

    secondaryButton: {
      minHeight: 50,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        colors.gold,
      backgroundColor:
        colors.background,
    },

    secondaryButtonText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 13,
    },

    primaryButton: {
      minHeight: 52,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 8,
      borderRadius: 14,
      backgroundColor:
        colors.gold,
    },

    primaryButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 13,
    },

    actionHint: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10.5,
      lineHeight: 16,
      textAlign:
        'center',
      marginTop: 2,
    },

    searchSafeArea: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    searchHeader: {
      height: 54,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 12,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },

    searchClose: {
      width: 42,
      height: 42,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    searchTitle: {
      flex: 1,
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 18,
      textAlign:
        'center',
    },

    searchCount: {
      width: 42,
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10,
      textAlign:
        'center',
    },

    searchBox: {
      minHeight: 50,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 9,
      marginHorizontal: 16,
      marginTop: 14,
      paddingHorizontal: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
    },

    searchInput: {
      flex: 1,
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
    },

    searchError: {
      color:
        colors.danger,
      fontFamily:
        'Inter_500Medium',
      fontSize: 11,
      paddingHorizontal: 18,
      marginTop: 8,
    },

    searchResults: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 36,
    },

    searchResult: {
      flexDirection:
        'row',
      width: '100%',
      alignItems:
        'center',
      backgroundColor:
        colors.surface,
      borderRadius: 16,
      padding: 12,
      marginBottom: 14,
      borderWidth: 1,
      borderColor:
        colors.border,
    },

    searchResultPressed: {
      opacity: 0.72,
    },

    searchResultSelected: {
      backgroundColor:
        colors.elevated,
      borderColor:
        colors.gold,
    },

    resultCover: {
      width: 75,
      height: 112,
      borderRadius: 8,
      backgroundColor:
        colors.elevated,
    },

    resultCoverFallback: {
      width: 75,
      height: 112,
      borderRadius: 8,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    resultCoverFallbackText: {
      color:
        colors.mutedText,
      fontSize: 11,
      fontFamily:
        'Inter_400Regular',
    },

    resultCopy: {
      flex: 1,
      minWidth: 0,
      marginLeft: 14,
      paddingRight: 10,
      justifyContent:
        'center',
    },

    resultTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      marginBottom: 5,
    },

    resultAuthor: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 13,
      marginBottom: 7,
    },

    resultRatingStars: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 2,
      marginTop: 7,
      marginBottom: 1,
    },

    resultMeta: {
      color:
        colors.mutedText,
      fontSize: 12,
      fontFamily:
        'Inter_400Regular',
      marginBottom: 2,
    },

    resultActionText: {
      color:
        colors.softGold,
      fontSize: 12,
      fontFamily:
        'Inter_600SemiBold',
      marginTop: 7,
    },

    postInput: {
      minHeight: 22,
      marginBottom: 8,
      color: colors.text,
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      lineHeight: 22,
      padding: 0,
      textAlignVertical: 'top',
    },

    pressed: {
      opacity: 0.72,
    },

    disabled: {
      opacity: 0.42,
    },
  });
}
