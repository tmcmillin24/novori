import { moderationMediaUrl } from '../lib/moderation-media-url';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import BookCoverImage from '../components/BookCoverImage';
import ClubDestinationImage from '../components/ClubDestinationImage';
import PostDestinationPicker from '../components/PostDestinationPicker';
import CanonicalBookRating from '../components/CanonicalBookRating';
import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
import {
  getNovoriSearchBookCover,
  getNovoriSearchBookIsbn,
  GoogleBookSearchItem,
  resolveNovoriSearchBookCover,
  searchNovoriBooks,
} from '../lib/book-search';
import { ClubWithMembership, getMyClubs } from '../lib/clubs';
import {
  createPost,
  getPostDetail,
  splitQuestionPostBody,
  updatePost,
} from '../lib/feed';
import { supabase } from '../lib/supabase';

type ViewerProfile = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Destination =
  | { type: 'profile'; clubId: null }
  | { type: 'club'; clubId: string };

type AttachedBook = {
  id: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
};

export default function AskReadersScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    clubId?: string;
    editPostId?: string;
  }>();

  const requestedClubId =
    typeof params.clubId === 'string' ? params.clubId : '';

  const editPostId =
    typeof params.editPostId === 'string'
      ? params.editPostId
      : '';

  const isEditing =
    Boolean(editPostId);

  const { colors } = useNovoriTheme();

  const styles = useMemo(
    () => createStyles(colors),
    [colors]
  );

  const [question, setQuestion] = useState('');
  const [context, setContext] = useState('');
  const [viewerProfile, setViewerProfile] =
    useState<ViewerProfile | null>(null);
  const [clubs, setClubs] = useState<ClubWithMembership[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [clubName, setClubName] = useState<string | null>(null);
  const [destination, setDestination] = useState<Destination>({
    type: 'profile',
    clubId: null,
  });

  const [attachedBook, setAttachedBook] =
    useState<AttachedBook | null>(null);

  const [bookPickerVisible, setBookPickerVisible] = useState(false);
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] =
    useState<GoogleBookSearchItem[]>([]);
  const [bookSearching, setBookSearching] = useState(false);
  const [bookSearchError, setBookSearchError] = useState('');
  const bookSearchTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const bookSearchRequestRef =
    useRef(0);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [
          clubResult,
          authResult,
          editingPost,
        ] = await Promise.all([
          getMyClubs(),
          supabase.auth.getUser(),
          editPostId
            ? getPostDetail(editPostId)
            : Promise.resolve(null),
        ]);

        if (!active) return;

        setClubs(clubResult);

        const user =
          authResult.data.user;

        if (editingPost) {
          if (
            !user ||
            editingPost.author_id !== user.id ||
            editingPost.post_type !== 'question'
          ) {
            throw new Error(
              'This Ask Readers post cannot be edited.'
            );
          }

          const parsed =
            splitQuestionPostBody(
              editingPost.body
            );

          setQuestion(
            parsed.question
          );
          setContext(
            parsed.context
          );

          setDestination(
            editingPost.club_id
              ? {
                  type: 'club',
                  clubId: editingPost.club_id,
                }
              : {
                  type: 'profile',
                  clubId: null,
                }
          );
          setClubName(editingPost.club_name);

          if (
            editingPost.google_book_id &&
            editingPost.book_title
          ) {
            setAttachedBook({
              id: editingPost.google_book_id,
              title: editingPost.book_title,
              authors:
                editingPost.book_authors ?? [],
              coverUrl:
                editingPost.book_cover_url,
            });
          }
        } else if (
          requestedClubId &&
          clubResult.some(
            (club) =>
              club.id === requestedClubId
          )
        ) {
          setDestination({
            type: 'club',
            clubId: requestedClubId,
          });
        }

        if (user) {
          const {
            data: profileData,
            error: profileError,
          } = await supabase
            .from('profiles')
            .select(
              'display_name, username, avatar_url'
            )
            .eq(
              'id',
              user.id
            )
            .single();

          if (
            !profileError &&
            active
          ) {
            setViewerProfile(
              profileData
            );
          }
        }
      } catch (error) {
        console.warn(
          'Could not load Ask Readers composer data:',
          error
        );
      } finally {
        if (active) {
          setLoadingClubs(false);
        }
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, [
    editPostId,
    requestedClubId,
  ]);

  const selectedClub =
    destination.type === 'club'
      ? clubs.find((club) => club.id === destination.clubId) ?? null
      : null;

  const previewDisplayName =
    viewerProfile?.display_name?.trim() ||
    viewerProfile?.username?.trim() ||
    'You';

  const previewUsername =
    viewerProfile?.username?.trim()
      ? `@${viewerProfile.username.trim()}`
      : '';

  const previewInitial =
    previewDisplayName
      .charAt(0)
      .toUpperCase();

  const canPublish =
    question.trim().length >= 4 &&
    question.trim().length <= 280 &&
    context.length <= 1200 &&
    !publishing &&
    !loadingClubs;

  useEffect(() => {
    if (
      bookSearchTimerRef.current
    ) {
      clearTimeout(
        bookSearchTimerRef.current
      );
    }

    const query =
      bookQuery.trim();

    if (
      !bookPickerVisible ||
      query.length < 2
    ) {
      bookSearchRequestRef.current +=
        1;
      setBookResults([]);
      setBookSearchError('');
      setBookSearching(false);
      return;
    }

    const requestId =
      ++bookSearchRequestRef.current;

    bookSearchTimerRef.current =
      setTimeout(() => {
        void performBookSearch(
          query,
          requestId
        );
      }, 350);

    return () => {
      if (
        bookSearchTimerRef.current
      ) {
        clearTimeout(
          bookSearchTimerRef.current
        );
      }
    };
  }, [
    bookPickerVisible,
    bookQuery,
  ]);

  async function performBookSearch(
    query: string,
    requestId: number
  ) {
    try {
      setBookSearching(true);
      setBookSearchError('');

      const results =
        await searchNovoriBooks(
          query
        );

      if (
        requestId !==
        bookSearchRequestRef.current
      ) {
        return;
      }

      setBookResults(
        results
      );
    } catch (error) {
      if (
        requestId !==
        bookSearchRequestRef.current
      ) {
        return;
      }

      console.error(
        'Could not search books:',
        error
      );

      setBookResults([]);
      setBookSearchError(
        'Could not search books. Please try again.'
      );
    } finally {
      if (
        requestId ===
        bookSearchRequestRef.current
      ) {
        setBookSearching(false);
      }
    }
  }

  function chooseBook(item: GoogleBookSearchItem) {
    const initialCover =
      getNovoriSearchBookCover(
        item
      );

    setAttachedBook({
      id: item.id,
      title: item.volumeInfo.title?.trim() || 'Untitled book',
      authors: item.volumeInfo.authors ?? [],
      coverUrl:
        initialCover,
    });

    void resolveNovoriSearchBookCover(
      item
    )
      .then(
        (
          resolvedCover
        ) => {
          if (
            !resolvedCover ||
            resolvedCover ===
              initialCover
          ) {
            return;
          }

          setAttachedBook(
            (
              current
            ) =>
              current?.id ===
              item.id
                ? {
                    ...current,
                    coverUrl:
                      resolvedCover,
                  }
                : current
          );
        }
      )
      .catch(
        (
          error
        ) => {
          console.warn(
            'Could not refine Ask Readers cover:',
            error
          );
        }
      );

    setBookPickerVisible(false);
    setBookQuery('');
    setBookResults([]);
    setBookSearchError('');
  }

  async function publishQuestion() {
    if (publishing || loadingClubs) return;

    const cleanedQuestion = question.trim();
    const cleanedContext = context.trim();

    if (cleanedQuestion.length < 4) {
      Alert.alert(
        'Add a question',
        'Write a question for readers before publishing.'
      );
      return;
    }

    if (cleanedQuestion.length > 280) {
      Alert.alert(
        'Question is too long',
        'Questions can be up to 280 characters.'
      );
      return;
    }

    if (cleanedContext.length > 1200) {
      Alert.alert(
        'Context is too long',
        'Extra context can be up to 1,200 characters.'
      );
      return;
    }

    const body = [cleanedQuestion, cleanedContext]
      .filter(Boolean)
      .join('\n\n');

    try {
      setPublishing(true);

      const postInput = {
        body,
        clubId:
          destination.type === 'club'
            ? destination.clubId
            : null,
        googleBookId: attachedBook?.id ?? null,
        bookTitle: attachedBook?.title ?? null,
        bookCoverUrl: attachedBook?.coverUrl ?? null,
        bookAuthors: attachedBook?.authors ?? null,
        bookSeriesName: null,
        bookSeriesPosition: null,
        imageUrl: null,
      };

      if (isEditing) {
        await updatePost(
          editPostId,
          postInput
        );
      } else {
        await createPost({
          ...postInput,
          postType: 'question',
          rating: null,
        });
      }

      router.replace('/(tabs)');
    } catch (error) {
      console.error('Could not publish Ask Readers question:', error);

      Alert.alert(
        'Could not publish',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'bottom']}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={colors.text}
          />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>
            ASK READERS
          </Text>

          <Text style={styles.headerTitle}>
            {isEditing
              ? 'Edit your question'
              : 'Start a conversation'}
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAwareScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
      >
        <PostDestinationPicker clubs={clubs} clubId={destination.clubId} clubName={clubName} loading={loadingClubs} disabled={publishing} profile={viewerProfile}
          onClubIdChange={(clubId) => setDestination(clubId ? { type: 'club', clubId } : { type: 'profile', clubId: null })} />
        <View style={styles.feedPreviewCard}>
          <View style={styles.feedPreviewHeader}>
            {viewerProfile?.avatar_url ? (
              <Image
                source={{
                  uri:
                    moderationMediaUrl(viewerProfile.avatar_url),
                }}
                style={styles.feedPreviewAvatar}
              />
            ) : (
              <View style={styles.feedPreviewAvatarFallback}>
                <Text style={styles.feedPreviewAvatarText}>
                  {previewInitial}
                </Text>
              </View>
            )}

            <View style={styles.feedPreviewAuthorCopy}>
              <View style={styles.feedPreviewIdentity}>
                <Text
                  style={styles.feedPreviewAuthorName}
                  numberOfLines={1}
                >
                  {previewDisplayName}
                </Text>

                {previewUsername ? (
                  <Text
                    style={styles.feedPreviewUsername}
                    numberOfLines={1}
                  >
                    {previewUsername}
                  </Text>
                ) : null}
              </View>

              <View style={styles.feedPreviewAudienceRow}>
                {destination.clubId ? <ClubDestinationImage club={selectedClub ?? { name: clubName || 'Your club', cover_url: null }} size={18} /> : (
                  <Ionicons name="person-outline" size={13} color={colors.gold} />
                )}
                <Text
                  style={
                    destination.clubId
                      ? styles.feedPreviewClubText
                      : styles.feedPreviewAudienceText
                  }
                  numberOfLines={1}
                >
                  {destination.clubId ? `in ${selectedClub?.name || clubName || 'Your club'}` : 'Your feed'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.feedPreviewContent}>
            <View style={styles.askReadersBadge}>
              <Ionicons
                name="help-circle-outline"
                size={13}
                color={colors.gold}
              />

              <Text style={styles.askReadersBadgeText}>
                ASK READERS
              </Text>
            </View>

            <TextInput
              accessibilityLabel="Your question"
              editable={!publishing}
              value={question}
              onChangeText={setQuestion}
              placeholder="What do you want to ask readers?"
              placeholderTextColor={colors.mutedText}
              multiline
              maxLength={280}
              style={[
                styles.feedPreviewQuestion,
                styles.feedPreviewQuestionInput,
              ]}
            />

            <TextInput
              accessibilityLabel="Optional context"
              editable={!publishing}
              value={context}
              onChangeText={setContext}
              placeholder="Add optional context…"
              placeholderTextColor={colors.mutedText}
              multiline
              maxLength={1200}
              style={[
                styles.feedPreviewContext,
                styles.feedPreviewContextInput,
              ]}
            />

            <View style={styles.editCountRow}>
              <Text style={styles.editCountText}>
                {question.length}/280 · {context.length}/1200
              </Text>
            </View>
            {attachedBook ? (
              <View style={styles.feedPreviewBookCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Change attached book: ${attachedBook.title}`}
                  disabled={publishing}
                  onPress={() => setBookPickerVisible(true)}
                  style={({ pressed }) => [
                    styles.feedPreviewBookSelect,
                    pressed && styles.pressed,
                  ]}
                >
                  {(attachedBook.id || attachedBook.coverUrl) ? (
                    <BookCoverImage
                      googleBookId={attachedBook.id}
                      existingCoverUrl={attachedBook.coverUrl}
                      style={styles.feedPreviewBookCover}
                    />
                  ) : (
                    <View style={styles.feedPreviewBookCoverFallback}>
                      <Ionicons
                        name="book-outline"
                        size={18}
                        color={colors.gold}
                      />
                    </View>
                  )}

                  <View style={styles.feedPreviewBookCopy}>
                    <View style={styles.feedPreviewBookEyebrow}>
                      <Ionicons
                        name="book-outline"
                        size={12}
                        color={colors.gold}
                      />

                      <Text style={styles.feedPreviewBookEyebrowText}>
                        Book
                      </Text>
                    </View>

                    <Text
                      style={styles.feedPreviewBookTitle}
                      numberOfLines={2}
                    >
                      {attachedBook.title}
                    </Text>

                    {attachedBook.authors.length ? (
                      <Text
                        style={styles.feedPreviewBookAuthor}
                        numberOfLines={1}
                      >
                        {attachedBook.authors.join(', ')}
                      </Text>
                    ) : null}

                    <CanonicalBookRating
                      googleBookId={
                        attachedBook.id
                      }
                      title={
                        attachedBook.title
                      }
                      authors={
                        attachedBook.authors
                      }
                    />
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={17}
                    color={colors.mutedText}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove attached book"
                  disabled={publishing}
                  onPress={() => setAttachedBook(null)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.removeBook,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="close"
                    size={18}
                    color={colors.secondaryText}
                  />
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add a book (optional)"
                disabled={publishing}
                onPress={() => setBookPickerVisible(true)}
                style={({ pressed }) => [
                  styles.feedPreviewAddBook,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="book-outline"
                  size={18}
                  color={colors.gold}
                />
                <Text style={styles.feedPreviewAddBookText}>
                  Add a book (optional)
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={colors.mutedText}
                />
              </Pressable>
            )}
          </View>

          <View style={styles.feedPreviewFooter}>
            <View style={styles.feedPreviewVoteControl}>
              <Ionicons
                name="arrow-up-circle-outline"
                size={20}
                color={colors.mutedText}
              />

              <Text style={styles.feedPreviewVoteScore}>
                0
              </Text>

              <Ionicons
                name="arrow-down-circle-outline"
                size={20}
                color={colors.mutedText}
              />
            </View>

            <View style={styles.feedPreviewCommentCount}>
              <Ionicons
                name="chatbubble-outline"
                size={17}
                color={colors.mutedText}
              />

              <Text style={styles.feedPreviewCommentCountText}>
                0
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isEditing ? 'Save changes' : 'Publish Ask Readers post'}
          disabled={!canPublish}
          onPress={() => void publishQuestion()}
          style={({ pressed }) => [
            styles.publishButton,
            !canPublish && styles.publishButtonDisabled,
            pressed && canPublish && styles.publishButtonPressed,
          ]}
        >
          {publishing ? (
            <ActivityIndicator
              size="small"
              color={colors.background}
            />
          ) : (
            <>
              <Ionicons
                name="send-outline"
                size={18}
                color={colors.background}
              />

              <Text style={styles.publishButtonText}>
                {isEditing
                  ? 'Save Changes'
                  : 'Ask Readers'}
              </Text>
            </>
          )}
        </Pressable>
      </KeyboardAwareScrollView>

      <Modal
        visible={bookPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBookPickerVisible(false)}
      >
        <SafeAreaView
          style={styles.bookPickerSafeArea}
          edges={['top', 'bottom']}
        >
          <View style={styles.bookPickerHeader}>
            <Pressable
              onPress={() => setBookPickerVisible(false)}
              hitSlop={10}
              style={({ pressed }) => [
                styles.headerButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="close"
                size={24}
                color={colors.text}
              />
            </Pressable>

            <Text style={styles.bookPickerTitle}>
              Connect a book
            </Text>

            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.searchRow}>
            <Ionicons
              name="search"
              size={18}
              color={colors.mutedText}
            />

            <TextInput
              value={bookQuery}
              onChangeText={setBookQuery}
              placeholder="Search title or author"
              placeholderTextColor={colors.mutedText}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              style={styles.searchInput}
            />

            {bookSearching ? (
              <ActivityIndicator
                size="small"
                color={colors.gold}
              />
            ) : bookQuery ? (
              <Pressable
                onPress={() => {
                  setBookQuery('');
                  setBookResults([]);
                  setBookSearchError('');
                }}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.clearSearchButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.mutedText}
                />
              </Pressable>
            ) : null}
          </View>

          {bookQuery.trim().length === 1 ? (
            <Text style={styles.searchHint}>
              Type at least 2 characters to search.
            </Text>
          ) : null}

          {bookSearchError ? (
            <Text style={styles.searchError}>
              {bookSearchError}
            </Text>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.bookResults}
            keyboardShouldPersistTaps="handled"
          >
            {bookResults.map((item) => {
              const cover =
                getNovoriSearchBookCover(
                  item
                );
              const isbn =
                getNovoriSearchBookIsbn(
                  item
                );
              const canonicalCover =
                item.novoriWork
                  ?.canonicalCoverUrl ??
                null;

              return (
                <Pressable
                  key={item.id}
                  onPress={() => chooseBook(item)}
                  style={({ pressed }) => [
                    styles.bookResult,
                    pressed && styles.destinationOptionPressed,
                  ]}
                >
                  {(item.id || cover) ? (
                    <BookCoverImage
                      googleBookId={item.id}
                      imageLinks={
                        item.volumeInfo
                          .imageLinks
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
                    <View style={styles.resultCoverFallback}>
                      <Ionicons
                        name="book-outline"
                        size={18}
                        color={colors.gold}
                      />
                    </View>
                  )}

                  <View style={styles.resultCopy}>
                    <Text
                      style={styles.resultTitle}
                      numberOfLines={2}
                    >
                      {item.volumeInfo.title || 'Untitled book'}
                    </Text>

                    <Text
                      style={styles.resultMeta}
                      numberOfLines={1}
                    >
                      {item.volumeInfo.authors?.join(', ') ||
                        'Unknown author'}
                    </Text>

                    {item.volumeInfo.publishedDate ? (
                      <Text
                        style={styles.resultYear}
                        numberOfLines={1}
                      >
                        {item.volumeInfo.publishedDate.slice(0, 4)}
                      </Text>
                    ) : null}
                  </View>

                  <Ionicons
                    name="add-circle-outline"
                    size={22}
                    color={colors.gold}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: NovoriColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCopy: {
      flex: 1,
      alignItems: 'center',
    },
    headerEyebrow: {
      color: colors.gold,
      fontFamily: 'Inter_700Bold',
      fontSize: 9.5,
      letterSpacing: 1.5,
    },
    headerTitle: {
      color: colors.text,
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 19,
      marginTop: 2,
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 40,
    },
    removeBook: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    destinationOptionPressed: {
      backgroundColor: colors.elevated,
    },
    feedPreviewCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOpacity: 0.10,
      shadowRadius: 14,
      shadowOffset: {
        width: 0,
        height: 5,
      },
      elevation: 3,
    },
    feedPreviewHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: 16,
      paddingTop: 15,
    },
    feedPreviewAvatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 12,
    },
    feedPreviewAvatarFallback: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    feedPreviewAvatarText: {
      color: colors.text,
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 18,
    },
    feedPreviewAuthorCopy: {
      flex: 1,
      minWidth: 0,
      paddingTop: 2,
    },
    feedPreviewIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      columnGap: 6,
      minWidth: 0,
    },
    feedPreviewAuthorName: {
      color: colors.text,
      fontFamily: 'Inter_700Bold',
      fontSize: 13.5,
      flexShrink: 1,
      minWidth: 0,
    },
    feedPreviewUsername: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 11.5,
      flexShrink: 1,
      minWidth: 0,
    },
    feedPreviewAudienceRow: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 5,
      maxWidth: '100%',
    },
    feedPreviewAudienceText: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 10.5,
    },
    feedPreviewClubText: {
      color: colors.softGold,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 10.5,
      flexShrink: 1,
    },
    feedPreviewContent: {
      paddingHorizontal: 16,
      paddingTop: 14,
    },
    askReadersBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    askReadersBadgeText: {
      color: colors.gold,
      fontFamily: 'Inter_700Bold',
      fontSize: 9,
      letterSpacing: 0.8,
    },
    feedPreviewQuestion: {
      color: colors.text,
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 19,
      lineHeight: 26,
    },
    feedPreviewContext: {
      color: colors.secondaryText,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      lineHeight: 21,
      marginTop: 8,
    },
    feedPreviewBookCard: {
      minHeight: 84,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.elevated,
      borderRadius: 13,
      padding: 10,
      marginTop: 13,
    },
    feedPreviewBookSelect: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
    },
    feedPreviewBookCover: {
      width: 42,
      height: 62,
      borderRadius: 6,
      backgroundColor: colors.surface,
      marginRight: 10,
    },
    feedPreviewBookCoverFallback: {
      width: 42,
      height: 62,
      borderRadius: 6,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    feedPreviewBookCopy: {
      flex: 1,
      minWidth: 0,
    },
    feedPreviewBookEyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 3,
    },
    feedPreviewBookEyebrowText: {
      color: colors.gold,
      fontFamily: 'Inter_700Bold',
      fontSize: 9.5,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    feedPreviewBookTitle: {
      color: colors.text,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      lineHeight: 18,
    },
    feedPreviewBookAuthor: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 10.5,
      marginTop: 3,
    },
    feedPreviewQuestionInput: {
      padding: 0,
      margin: 0,
      textAlignVertical: 'top',
    },
    feedPreviewContextInput: {
      minHeight: 42,
      padding: 0,
      textAlignVertical: 'top',
    },
    editCountRow: {
      alignItems: 'flex-end',
      marginTop: 6,
    },
    editCountText: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 10,
    },
    feedPreviewAddBook: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 14,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.elevated,
    },
    feedPreviewAddBookText: {
      flex: 1,
      color: colors.text,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12.5,
    },

    feedPreviewFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 15,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    feedPreviewVoteControl: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    feedPreviewVoteScore: {
      minWidth: 14,
      color: colors.mutedText,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      textAlign: 'center',
    },
    feedPreviewCommentCount: {
      height: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    feedPreviewCommentCountText: {
      color: colors.mutedText,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
    },
    publishButton: {
      minHeight: 52,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.gold,
      marginTop: 18,
    },
    publishButtonDisabled: {
      opacity: 0.38,
    },
    publishButtonPressed: {
      opacity: 0.82,
    },
    publishButtonText: {
      color: colors.background,
      fontFamily: 'Inter_700Bold',
      fontSize: 14,
    },
    bookPickerSafeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    bookPickerHeader: {
      height: 58,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    bookPickerTitle: {
      flex: 1,
      color: colors.text,
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 20,
      textAlign: 'center',
    },
    searchRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      margin: 16,
      marginBottom: 8,
      paddingLeft: 12,
      paddingRight: 5,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
    },
    clearSearchButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchHint: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 10.5,
      paddingHorizontal: 18,
      paddingBottom: 4,
    },
    searchError: {
      color: colors.danger,
      fontFamily: 'Inter_500Medium',
      fontSize: 11,
      paddingHorizontal: 18,
      paddingBottom: 4,
    },
    bookResults: {
      paddingHorizontal: 16,
      paddingBottom: 30,
    },
    bookResult: {
      minHeight: 82,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 9,
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    resultCover: {
      width: 42,
      height: 62,
      borderRadius: 6,
      backgroundColor: colors.elevated,
      marginRight: 11,
    },
    resultCoverFallback: {
      width: 42,
      height: 62,
      borderRadius: 6,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },
    resultCopy: {
      flex: 1,
      minWidth: 0,
      marginRight: 10,
    },
    resultTitle: {
      color: colors.text,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      lineHeight: 18,
    },
    resultMeta: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 10.5,
      marginTop: 4,
    },
    resultYear: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 9.5,
      marginTop: 3,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
