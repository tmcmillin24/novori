import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
import { ClubWithMembership, getMyClubs } from '../lib/clubs';
import { createPost } from '../lib/feed';
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

type GoogleBookSearchItem = {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
    };
  };
};

type GoogleBooksResponse = {
  items?: GoogleBookSearchItem[];
};

function secureImageUrl(value?: string) {
  return value?.replace('http://', 'https://') ?? null;
}

function getBookCover(item: GoogleBookSearchItem) {
  const links = item.volumeInfo.imageLinks;

  return (
    secureImageUrl(links?.medium) ||
    secureImageUrl(links?.small) ||
    secureImageUrl(links?.thumbnail) ||
    secureImageUrl(links?.smallThumbnail)
  );
}

export default function AskReadersScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    clubId?: string;
  }>();

  const requestedClubId =
    typeof params.clubId === 'string' ? params.clubId : '';

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
  const [destinationExpanded, setDestinationExpanded] = useState(false);
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
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [
          clubResult,
          authResult,
        ] = await Promise.all([
          getMyClubs(),
          supabase.auth.getUser(),
        ]);

        if (!active) return;

        setClubs(clubResult);

        if (
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

        const user =
          authResult.data.user;

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
  }, [requestedClubId]);

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
    !publishing;

  async function searchBooks() {
    const query = bookQuery.trim();

    if (!query) {
      setBookResults([]);
      setBookSearchError('');
      return;
    }

    try {
      setBookSearching(true);
      setBookSearchError('');

      const key =
        process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;

      const queryParams = new URLSearchParams({
        q: query,
        maxResults: '20',
        printType: 'books',
      });

      if (key) {
        queryParams.set('key', key);
      }

      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('Book search is unavailable right now.');
      }

      const data = (await response.json()) as GoogleBooksResponse;

      setBookResults(data.items ?? []);
    } catch (error) {
      setBookResults([]);
      setBookSearchError(
        error instanceof Error
          ? error.message
          : 'Could not search books.'
      );
    } finally {
      setBookSearching(false);
    }
  }

  function chooseBook(item: GoogleBookSearchItem) {
    setAttachedBook({
      id: item.id,
      title: item.volumeInfo.title?.trim() || 'Untitled book',
      authors: item.volumeInfo.authors ?? [],
      coverUrl: getBookCover(item),
    });

    setBookPickerVisible(false);
    setBookQuery('');
    setBookResults([]);
    setBookSearchError('');
  }

  async function publishQuestion() {
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

      await createPost({
        body,
        postType: 'question',
        clubId:
          destination.type === 'club'
            ? destination.clubId
            : null,
        googleBookId: attachedBook?.id ?? null,
        bookTitle: attachedBook?.title ?? null,
        bookCoverUrl: attachedBook?.coverUrl ?? null,
        bookAuthors: attachedBook?.authors ?? null,
        rating: null,
      });

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
            Start a conversation
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
        <View style={styles.questionCard}>
          <View style={styles.questionIcon}>
            <Ionicons
              name="help"
              size={20}
              color={colors.gold}
            />
          </View>

          <Text style={styles.sectionLabel}>
            YOUR QUESTION
          </Text>

          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="What do you want to ask readers?"
            placeholderTextColor={colors.mutedText}
            multiline
            maxLength={280}
            autoFocus
            style={styles.questionInput}
          />

          <Text style={styles.characterCount}>
            {question.length}/280
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.sectionTitle}>
                Add context
              </Text>

              <Text style={styles.sectionSubtitle}>
                Optional details that help readers answer.
              </Text>
            </View>

            <Text style={styles.smallCount}>
              {context.length}/1200
            </Text>
          </View>

          <TextInput
            value={context}
            onChangeText={setContext}
            placeholder="Add preferences, background, or anything readers should know."
            placeholderTextColor={colors.mutedText}
            multiline
            maxLength={1200}
            style={styles.contextInput}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
              <Text style={styles.sectionTitle}>
                Connect a book
              </Text>

              <Text style={styles.sectionSubtitle}>
                Optional. Give the question book context.
              </Text>
            </View>
          </View>

          {attachedBook ? (
            <View style={styles.attachedBook}>
              {attachedBook.coverUrl ? (
                <Image
                  source={{ uri: attachedBook.coverUrl }}
                  style={styles.bookCover}
                />
              ) : (
                <View style={styles.bookCoverFallback}>
                  <Ionicons
                    name="book-outline"
                    size={20}
                    color={colors.gold}
                  />
                </View>
              )}

              <View style={styles.bookCopy}>
                <Text
                  style={styles.bookTitle}
                  numberOfLines={2}
                >
                  {attachedBook.title}
                </Text>

                <Text
                  style={styles.bookMeta}
                  numberOfLines={1}
                >
                  {attachedBook.authors.length
                    ? attachedBook.authors.join(', ')
                    : 'Unknown author'}
                </Text>
              </View>

              <Pressable
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
              onPress={() => setBookPickerVisible(true)}
              style={({ pressed }) => [
                styles.actionRow,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.actionIcon}>
                <Ionicons
                  name="book-outline"
                  size={20}
                  color={colors.gold}
                />
              </View>

              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>
                  Choose a book
                </Text>

                <Text style={styles.actionSubtitle}>
                  Search the Novori book catalog
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.mutedText}
              />
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Ask in
          </Text>

          <Pressable
            disabled={loadingClubs}
            onPress={() =>
              setDestinationExpanded((current) => !current)
            }
            style={({ pressed }) => [
              styles.destinationRow,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.destinationIcon}>
              <Ionicons
                name={
                  selectedClub
                    ? 'people-outline'
                    : 'person-outline'
                }
                size={20}
                color={colors.gold}
              />
            </View>

            <View style={styles.destinationCopy}>
              <Text style={styles.destinationTitle}>
                {selectedClub?.name ?? 'Your profile'}
              </Text>

              <Text style={styles.destinationSubtitle}>
                {selectedClub
                  ? 'Club members will see this question.'
                  : 'Readers who follow you can see this question.'}
              </Text>
            </View>

            {loadingClubs ? (
              <ActivityIndicator
                size="small"
                color={colors.mutedText}
              />
            ) : (
              <Ionicons
                name={
                  destinationExpanded
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={18}
                color={colors.mutedText}
              />
            )}
          </Pressable>

          {destinationExpanded ? (
            <View style={styles.destinationMenu}>
              <Pressable
                onPress={() => {
                  setDestination({
                    type: 'profile',
                    clubId: null,
                  });
                  setDestinationExpanded(false);
                }}
                style={({ pressed }) => [
                  styles.destinationOption,
                  pressed && styles.destinationOptionPressed,
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={colors.gold}
                />

                <Text style={styles.destinationOptionText}>
                  Your profile
                </Text>

                {destination.type === 'profile' ? (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={colors.gold}
                  />
                ) : null}
              </Pressable>

              {clubs.map((club) => (
                <Pressable
                  key={club.id}
                  onPress={() => {
                    setDestination({
                      type: 'club',
                      clubId: club.id,
                    });
                    setDestinationExpanded(false);
                  }}
                  style={({ pressed }) => [
                    styles.destinationOption,
                    pressed && styles.destinationOptionPressed,
                  ]}
                >
                  <Ionicons
                    name="people-outline"
                    size={18}
                    color={colors.gold}
                  />

                  <Text
                    style={styles.destinationOptionText}
                    numberOfLines={1}
                  >
                    {club.name}
                  </Text>

                  {destination.type === 'club' &&
                  destination.clubId === club.id ? (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.gold}
                    />
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View>
          <Text style={styles.previewLabel}>
            PREVIEW
          </Text>

          <View style={styles.feedPreviewCard}>
            <View style={styles.feedPreviewHeader}>
              {viewerProfile?.avatar_url ? (
                <Image
                  source={{
                    uri:
                      viewerProfile.avatar_url,
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
                  {selectedClub ? (
                    <>
                      <View style={styles.feedPreviewClubIcon}>
                        <Text style={styles.feedPreviewClubIconText}>
                          {selectedClub.name
                            .charAt(0)
                            .toUpperCase()}
                        </Text>
                      </View>

                      <Text
                        style={styles.feedPreviewClubText}
                        numberOfLines={1}
                      >
                        in {selectedClub.name}{' '}
                        <Text style={styles.feedPreviewTime}>
                          · now
                        </Text>
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.feedPreviewAudienceText}>
                      posted to your profile{' '}
                      <Text style={styles.feedPreviewTime}>
                        · now
                      </Text>
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.feedPreviewMore}>
                <Ionicons
                  name="ellipsis-horizontal"
                  size={20}
                  color={colors.mutedText}
                />
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

              <Text style={styles.feedPreviewQuestion}>
                {question.trim() ||
                  'Your question will appear here.'}
              </Text>

              {context.trim() ? (
                <Text style={styles.feedPreviewContext}>
                  {context.trim()}
                </Text>
              ) : null}

              {attachedBook ? (
                <View style={styles.feedPreviewBookCard}>
                  {attachedBook.coverUrl ? (
                    <Image
                      source={{
                        uri:
                          attachedBook.coverUrl,
                      }}
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
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={17}
                    color={colors.mutedText}
                  />
                </View>
              ) : null}
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
        </View>

        <Pressable
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
                Ask Readers
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
              onSubmitEditing={() => void searchBooks()}
              placeholder="Search title or author"
              placeholderTextColor={colors.mutedText}
              returnKeyType="search"
              autoFocus
              style={styles.searchInput}
            />

            <Pressable
              disabled={!bookQuery.trim() || bookSearching}
              onPress={() => void searchBooks()}
              style={({ pressed }) => [
                styles.searchButton,
                (!bookQuery.trim() || bookSearching) &&
                  styles.searchButtonDisabled,
                pressed && styles.pressed,
              ]}
            >
              {bookSearching ? (
                <ActivityIndicator
                  size="small"
                  color={colors.background}
                />
              ) : (
                <Text style={styles.searchButtonText}>
                  Search
                </Text>
              )}
            </Pressable>
          </View>

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
              const cover = getBookCover(item);

              return (
                <Pressable
                  key={item.id}
                  onPress={() => chooseBook(item)}
                  style={({ pressed }) => [
                    styles.bookResult,
                    pressed && styles.destinationOptionPressed,
                  ]}
                >
                  {cover ? (
                    <Image
                      source={{ uri: cover }}
                      style={styles.resultCover}