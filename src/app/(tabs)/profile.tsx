import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import {
  useFocusEffect,
  useNavigation,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BookStackActionsSheet from '../../components/BookStackActionsSheet';
import BookStackPostAttachment from '../../components/BookStackPostAttachment';
import BookStackVisual from '../../components/BookStackVisual';
import CanonicalBookRating from '../../components/CanonicalBookRating';
import FeedPostImage from '../../components/FeedPostImage';
import PostTypeIdentifier from '../../components/PostTypeIdentifier';
import ProfileReadingModule from '../../components/ProfileReadingModule';
import DeleteBookStackConfirmSheet from '../../components/DeleteBookStackConfirmSheet';
import DeletePostConfirmSheet from '../../components/DeletePostConfirmSheet';
import FullScreenImageViewer from '../../components/FullScreenImageViewer';
import {
  TabScreen,
} from '../../components/tab-screen';
import {
  NovoriColors,
} from '../../constants/novori-theme';
import {
  useNovoriTheme,
} from '../../context/theme-context';
import {
  BookStack,
  deleteBookStack,
  getMyBookStacks,
} from '../../lib/book-stacks';
import {
  ClubWithMembership,
} from '../../lib/clubs';
import {
  deletePost,
  FeedPost,
  getHomeFeed,
  getPostMutationVersion,
  PostVoteValue,
  splitQuestionPostBody,
  togglePostVote,
} from '../../lib/feed';
import {
  PROFILE_BOOK_STATUS_LABELS,
  sortProfileBooks,
} from '../../lib/profile-book-order';
import {
  DEFAULT_PROFILE_PRIVACY,
  getProfilePrivacy,
  ProfilePrivacyPreferences,
} from '../../lib/profile-privacy';
import {
  getReaderProfile,
  getReaderProfilePosts,
  getReaderPublicClubs,
} from '../../lib/social';
import {
  supabase,
} from '../../lib/supabase';
import {
  getLibraryMutationVersion,
  getUserBooks,
  UserBook,
} from '../../lib/user-books';
import {
  shareBookStackLink,
  sharePostLink,
} from '../../lib/share-links';
import {
  getPostEditRoute,
} from '../../lib/post-edit-route';

function formatActivityTime(
  value: string
) {
  const created =
    new Date(
      value
    );

  const difference =
    Date.now() -
    created.getTime();

  const minute =
    60 * 1000;
  const hour =
    60 * minute;
  const day =
    24 * hour;

  if (
    difference <
    minute
  ) {
    return 'now';
  }

  if (
    difference <
    hour
  ) {
    return `${Math.max(
      1,
      Math.floor(
        difference /
          minute
      )
    )}m`;
  }

  if (
    difference <
    day
  ) {
    return `${Math.floor(
      difference /
        hour
    )}h`;
  }

  if (
    difference <
    7 * day
  ) {
    return `${Math.floor(
      difference /
        day
    )}d`;
  }

  return created.toLocaleDateString(
    undefined,
    {
      month:
        'short',
      day:
        'numeric',
    }
  );
}

const PROFILE_STALE_MS =
  2 * 60 * 1000;

type ProfileTab =
  | 'library'
  | 'activity'
  | 'clubs';

type ProfileLibraryTab =
  | 'books'
  | 'reviews'
  | 'stacks';

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type ProfileCacheSnapshot = {
  profile: Profile | null;
  books: UserBook[];
  followerCount: number;
  followingCount: number;
  posts: FeedPost[];
  clubs: ClubWithMembership[];
  stacks: BookStack[];
  postMutationVersion: number;
};

let profileSessionCache:
  | {
      userId: string;
      snapshot: ProfileCacheSnapshot;
      refreshedAt: number;
      libraryMutationVersion: number;
      postMutationVersion: number;
    }
  | null =
  null;

function profileCacheKey(
  userId: string
) {
  return `novori:profile-cache:${userId}`;
}

async function readProfileCache(
  userId: string
): Promise<ProfileCacheSnapshot | null> {
  try {
    const raw =
      await AsyncStorage.getItem(
        profileCacheKey(
          userId
        )
      );

    if (!raw) {
      return null;
    }

    return JSON.parse(
      raw
    ) as ProfileCacheSnapshot;
  } catch (
    error
  ) {
    console.warn(
      'Could not read cached profile:',
      error
    );

    return null;
  }
}

async function writeProfileCache(
  userId: string,
  snapshot: ProfileCacheSnapshot
) {
  try {
    await AsyncStorage.setItem(
      profileCacheKey(
        userId
      ),
      JSON.stringify(
        snapshot
      )
    );
  } catch (
    error
  ) {
    console.warn(
      'Could not cache profile:',
      error
    );
  }
}

export default function ProfileScreen() {
  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const router = useRouter();
  const navigation =
    useNavigation();

  const profileScrollRef =
    useRef<ScrollView | null>(
      null
    );

  const profileScrollOffsetRef =
    useRef(0);

  const profileFocusedRef =
    useRef(false);

  const hasLoadedProfileRef =
    useRef(false);

  const lastProfileRefreshRef =
    useRef(0);

  const lastSeenLibraryMutationRef =
    useRef(
      profileSessionCache
        ?.libraryMutationVersion ??
      getLibraryMutationVersion()
    );

  const lastSeenPostMutationRef =
    useRef(
      profileSessionCache
        ?.postMutationVersion ??
      getPostMutationVersion()
    );

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<ProfileTab>(
      'library'
    );

  const [
    libraryTab,
    setLibraryTab,
  ] =
    useState<ProfileLibraryTab>(
      'books'
    );

  const [
    profile,
    setProfile,
  ] =
    useState<Profile | null>(
      null
    );

  const [
    profilePrivacy,
    setProfilePrivacy,
  ] =
    useState<ProfilePrivacyPreferences>(
      DEFAULT_PROFILE_PRIVACY
    );

  const [
    profileImageOpen,
    setProfileImageOpen,
  ] =
    useState(false);

  const [
    books,
    setBooks,
  ] =
    useState<UserBook[]>(
      []
    );

  const [
    followerCount,
    setFollowerCount,
  ] = useState(0);

  const [
    followingCount,
    setFollowingCount,
  ] = useState(0);

  const [
    posts,
    setPosts,
  ] =
    useState<FeedPost[]>(
      []
    );

  const [
    clubs,
    setClubs,
  ] =
    useState<ClubWithMembership[]>(
      []
    );

  const [
    stacks,
    setStacks,
  ] =
    useState<BookStack[]>(
      []
    );


  const [
    deletePostTarget,
    setDeletePostTarget,
  ] =
    useState<FeedPost | null>(
      null
    );

  const [
    deletingPostId,
    setDeletingPostId,
  ] =
    useState<string | null>(
      null
    );

  const [
    votingPostId,
    setVotingPostId,
  ] =
    useState<string | null>(
      null
    );

  const [
    deleteStackTarget,
    setDeleteStackTarget,
  ] =
    useState<BookStack | null>(
      null
    );


  const [
    stackActionsTarget,
    setStackActionsTarget,
  ] =
    useState<BookStack | null>(
      null
    );

  const [
    deletingStackId,
    setDeletingStackId,
  ] =
    useState<string | null>(
      null
    );


  const [
    profileHydrated,
    setProfileHydrated,
  ] =
    useState(false);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    refreshRequest,
    setRefreshRequest,
  ] =
    useState(0);

  const refreshProfile =
    useCallback(
      () => {
        if (
          refreshing
        ) {
          return;
        }

        setRefreshing(
          true
        );

        hasLoadedProfileRef.current =
          false;
        lastProfileRefreshRef.current =
          0;
        profileSessionCache =
          null;

        setRefreshRequest(
          (
            current
          ) =>
            current +
            1
        );
      },
      [
        refreshing,
      ]
    );

  useFocusEffect(
    useCallback(() => {
      let active =
        true;

      void getProfilePrivacy()
        .then(
          (
            nextPrivacy
          ) => {
            if (
              active
            ) {
              setProfilePrivacy(
                nextPrivacy
              );
            }
          }
        )
        .catch(
          (
            privacyError
          ) => {
            console.warn(
              'Could not refresh Profile visibility preview:',
              privacyError
            );
          }
        );

      return () => {
        active =
          false;
      };
    }, [
      refreshRequest,
    ])
  );

  useFocusEffect(
    useCallback(() => {
      profileFocusedRef.current =
        true;

      let isMounted = true;

      const currentLibraryMutationVersion =
        getLibraryMutationVersion();

      const currentPostMutationVersion =
        getPostMutationVersion();

      const libraryChanged =
        currentLibraryMutationVersion !==
        lastSeenLibraryMutationRef.current;

      const postsChanged =
        currentPostMutationVersion !==
        lastSeenPostMutationRef.current;

      const profileIsFresh =
        hasLoadedProfileRef.current &&
        Date.now() -
          lastProfileRefreshRef.current <
          PROFILE_STALE_MS;

      if (
        profileIsFresh &&
        !libraryChanged &&
        !postsChanged
      ) {
        return () => {
          isMounted =
            false;
          profileFocusedRef.current =
            false;
        };
      }

      if (
        profileIsFresh &&
        libraryChanged &&
        !postsChanged
      ) {
        void getUserBooks()
          .then(
            (
              savedBooks
            ) => {
              if (
                !isMounted
              ) {
                return;
              }

              setBooks(
                savedBooks
              );
              lastSeenLibraryMutationRef.current =
                currentLibraryMutationVersion;

              if (
                profileSessionCache
              ) {
                profileSessionCache = {
                  ...profileSessionCache,
                  snapshot: {
                    ...profileSessionCache.snapshot,
                    books:
                      savedBooks,
                  },
                  libraryMutationVersion:
                    currentLibraryMutationVersion,
                };
              }
            }
          )
          .catch(
            (
              booksError
            ) => {
              console.warn(
                'Could not refresh Profile books:',
                booksError
              );
            }
          );

        return () => {
          isMounted =
            false;
          profileFocusedRef.current =
            false;
        };
      }

      async function loadProfileAndBooks() {
        const {
          data: {
            session,
          },
          error:
            sessionError,
        } =
          await supabase.auth.getSession();

        const user =
          session?.user ??
          null;

        const memoryCache =
          user &&
          profileSessionCache
            ?.userId ===
            user.id
            ? profileSessionCache
            : null;

        if (
          sessionError ||
          !user
        ) {
          if (
            isMounted
          ) {
            setProfileHydrated(
              true
            );
          }

          await supabase.auth.signOut();

          router.replace(
            '/auth'
          );

          return;
        }

        if (
          memoryCache &&
          Date.now() -
            memoryCache.refreshedAt <
            PROFILE_STALE_MS &&
          !libraryChanged &&
          !postsChanged
        ) {
          const snapshot =
            memoryCache.snapshot;

          if (
            isMounted
          ) {
            setProfile(
              snapshot.profile
            );
            setBooks(
              snapshot.books
            );
            setFollowerCount(
              snapshot.followerCount
            );
            setFollowingCount(
              snapshot.followingCount
            );
            setPosts(
              snapshot.posts
            );
            setClubs(
              snapshot.clubs
            );
            setStacks(
              snapshot.stacks
            );
            setProfileHydrated(
              true
            );
          }

          hasLoadedProfileRef.current =
            true;
          lastProfileRefreshRef.current =
            memoryCache.refreshedAt;
          lastSeenLibraryMutationRef.current =
            memoryCache.libraryMutationVersion;
          lastSeenPostMutationRef.current =
            memoryCache.postMutationVersion;
          return;
        }

        const cached =
          await readProfileCache(
            user.id
          );

        if (
          isMounted &&
          cached
        ) {
          setProfile(
            cached.profile
          );
          if (
            !libraryChanged
          ) {
            setBooks(
              cached.books
            );
          }
          setFollowerCount(
            cached.followerCount
          );
          setFollowingCount(
            cached.followingCount
          );
          if (
            !postsChanged &&
            cached.postMutationVersion ===
              currentPostMutationVersion
          ) {
            setPosts(
              cached.posts
            );
          }
          setClubs(
            cached.clubs
          );
          setStacks(
            cached.stacks
          );
        }

        if (
          isMounted
        ) {
          setProfileHydrated(
            true
          );
          if (cached) {
            hasLoadedProfileRef.current =
              true;
          }
        }

        const {
          data,
          error,
        } =
          await supabase
            .from(
              'profiles'
            )
            .select(
              'id, username, display_name, bio, avatar_url'
            )
            .eq(
              'id',
              user.id
            )
            .single();

        let refreshedProfile:
          Profile | null =
          cached?.profile ??
          null;

        if (error) {
          console.error(
            'Could not load profile:',
            error.message
          );
        } else {
          refreshedProfile =
            data as Profile;

          if (
            isMounted
          ) {
            setProfile(
              refreshedProfile
            );
          }
        }

        try {
          const savedBooksPromise =
            getUserBooks();

          void savedBooksPromise
            .then(
              (
                savedBooks
              ) => {
                if (
                  isMounted
                ) {
                  setBooks(
                    savedBooks
                  );
                  lastSeenLibraryMutationRef.current =
                    currentLibraryMutationVersion;
                }
              }
            )
            .catch(
              (
                booksError
              ) => {
                console.warn(
                  'Could not refresh Profile books:',
                  booksError
                );
              }
            );

          const [
            savedBooks,
            socialProfile,
            profilePosts,
            homeFeedPosts,
            publicClubs,
            savedStacks,
          ] = await Promise.all([
            savedBooksPromise,
            getReaderProfile(
              user.id
            ),
            getReaderProfilePosts(
              user.id
            ),
            getHomeFeed(
              100
            ).catch(
              (
                feedError
              ) => {
                console.warn(
                  'Could not merge Home posts into Profile Activity:',
                  feedError
                );

                return [] as FeedPost[];
              }
            ),
            getReaderPublicClubs(
              user.id
            ),
            getMyBookStacks().catch(
              (
                stackError
              ) => {
                console.warn(
                  'Could not load Book Stacks:',
                  stackError
                );

                return (
                  cached?.stacks ??
                  []
                );
              }
            ),
          ]);

          const mergedProfilePosts =
            Array.from(
              new Map(
                [
                  ...profilePosts,
                  ...homeFeedPosts.filter(
                    (
                      post
                    ) =>
                      post.author_id ===
                      user.id
                  ),
                ].map(
                  (
                    post
                  ) => [
                    post.id,
                    post,
                  ]
                )
              ).values()
            ).sort(
              (
                a,
                b
              ) =>
                new Date(
                  b.created_at
                ).getTime() -
                new Date(
                  a.created_at
                ).getTime()
            );

          const snapshot:
            ProfileCacheSnapshot = {
              profile:
                refreshedProfile,
              books:
                savedBooks,
              followerCount:
                socialProfile.follower_count,
              followingCount:
                socialProfile.following_count,
              posts:
                mergedProfilePosts,
              clubs:
                publicClubs,
              stacks:
                savedStacks,
              postMutationVersion:
                currentPostMutationVersion,
            };

          if (
            isMounted
          ) {
            setBooks(
              snapshot.books
            );
            setFollowerCount(
              snapshot.followerCount
            );
            setFollowingCount(
              snapshot.followingCount
            );
            setPosts(
              snapshot.posts
            );
            setClubs(
              snapshot.clubs
            );
            setStacks(
              snapshot.stacks
            );
          }

          const refreshedAt =
            Date.now();

          hasLoadedProfileRef.current =
            true;
          lastSeenLibraryMutationRef.current =
            currentLibraryMutationVersion;
          lastSeenPostMutationRef.current =
            currentPostMutationVersion;
          lastProfileRefreshRef.current =
            refreshedAt;

          profileSessionCache = {
            userId:
              user.id,
            snapshot,
            refreshedAt,
            libraryMutationVersion:
              currentLibraryMutationVersion,
            postMutationVersion:
              currentPostMutationVersion,
          };

          void writeProfileCache(
            user.id,
            snapshot
          );
        } catch (
          refreshError
        ) {
          console.error(
            'Could not refresh profile data:',
            refreshError
          );

          if (
            !cached &&
            isMounted
          ) {
            setBooks(
              []
            );
            setFollowerCount(
              0
            );
            setFollowingCount(
              0
            );
            setPosts(
              []
            );
            setClubs(
              []
            );
            setStacks(
              []
            );
          }
        }
      }

      void loadProfileAndBooks()
        .finally(
          () => {
            if (
              isMounted
            ) {
              setRefreshing(
                false
              );
            }
          }
        );

      return () => {
        isMounted =
          false;
        profileFocusedRef.current =
          false;
      };
    }, [
      refreshRequest,
      router,
    ])
  );

  useEffect(
    () => {
      const unsubscribe =
        (navigation as any).addListener(
          'tabPress',
          () => {
            if (
              !profileFocusedRef.current
            ) {
              return;
            }

            if (
              profileScrollOffsetRef.current >
              24
            ) {
              profileScrollOffsetRef.current =
                0;

              profileScrollRef.current?.scrollTo({
                y: 0,
                animated: true,
              });
              return;
            }

            // Keep the in-memory Profile snapshot. Book mutations
            // invalidate it immediately, and the two-minute TTL covers
            // remote social/profile changes.
          }
        );

      return unsubscribe;
    },
    [
      navigation,
    ]
  );

  const rawUsername =
    profile?.username?.trim() ||
    'reader';

  const username =
    `@${rawUsername}`;

  const displayName =
    profile?.display_name?.trim() ||
    rawUsername;

  const bio =
    profile?.bio?.trim() ||
    'Add a bio to tell other readers a little about yourself.';

  const avatarInitial =
    displayName
      .charAt(0)
      .toUpperCase() ||
    'N';

  const publicBooks =
    sortProfileBooks(
      books.filter(
        (
          book
        ) => {
          if (
            book.status ===
              'want_to_read'
          ) {
            return (
              profilePrivacy
                .show_tbr_books
            );
          }

          if (
            book.status ===
              'reading'
          ) {
            return (
              profilePrivacy
                .show_reading_books
            );
          }

          if (
            book.status ===
              'read'
          ) {
            return (
              profilePrivacy
                .show_read_books
            );
          }

          if (
            book.status ===
              'dnf'
          ) {
            return (
              profilePrivacy
                .show_dnf_books
            );
          }

          return Boolean(
            book.owned &&
            profilePrivacy
              .show_owned_books
          );
        }
      )
    );

  const reviewedBooks =
    profilePrivacy
      .show_reviews
      ? books.filter(
          (book) =>
            book.rating !==
              null ||
            Boolean(
              book.review_text?.trim()
            )
        )
      : [];

  const profileBookCount =
    publicBooks.length;

  function handleEditProfile() {
    router.push(
      '/edit-profile'
    );
  }

  function openSettings() {
    router.push(
      '/settings'
    );
  }

  async function handleShareProfile() {
    try {
      await Share.share({
        message:
          `Check out ${username} on Novori.`,
      });
    } catch {
      Alert.alert(
        'Could not share profile',
        'Please try again.'
      );
    }
  }

  function openBook(
    googleBookId: string
  ) {
    router.push({
      pathname:
        '/book/[id]',
      params: {
        id:
          googleBookId,
        source:
          'profile',
      },
    });
  }

  function renderRating(
    rating: number
  ) {
    return `${rating.toFixed(
      1
    )}`;
  }

  function renderBookStatus(
    book: UserBook
  ) {
    if (
      !book.status
    ) {
      return book.owned
        ? 'Owned'
        : '';
    }

    return (
      PROFILE_BOOK_STATUS_LABELS[
        book.status
      ]
    );
  }

  function renderBooksTab() {
    if (
      publicBooks.length ===
      0
    ) {
      return (
        <View
          style={
            styles.emptyActivity
          }
        >
          <Text
            style={
              styles.emptyActivityTitle
            }
          >
            Your public library preview will show up here.
          </Text>

          <Text
            style={
              styles.emptyActivityText
            }
          >
            Only book categories enabled in Privacy appear here, exactly as other readers will see them.
          </Text>
        </View>
      );
    }

    return (
      <View
        style={
          styles.bookGrid
        }
      >
        {publicBooks.map(
          (
            book
          ) => (
            <Pressable
              key={
                book.id
              }
              onPress={() =>
                openBook(
                  book.google_book_id
                )
              }
              style={({
                pressed,
              }) => [
                styles.gridBook,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={
                  styles.gridCoverWrap
                }
              >
                {book.cover_url ? (
                  <ExpoImage
                    source={
                      book.cover_url
                    }
                    style={
                      styles.gridCover
                    }
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                    recyclingKey={
                      book.cover_url
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.gridCoverPlaceholder
                    }
                  >
                    <Ionicons
                      name="book-outline"
                      size={
                        27
                      }
                      color={
                        colors.gold
                      }
                    />
                  </View>
                )}

                <View
                  style={
                    styles.gridStatusBadge
                  }
                >
                  <Text
                    style={
                      styles.gridStatusBadgeText
                    }
                  >
                    {
                      renderBookStatus(
                        book
                      )
                    }
                  </Text>
                </View>
              </View>

              <Text
                style={
                  styles.gridBookTitle
                }
                numberOfLines={
                  2
                }
              >
                {
                  book.title
                }
              </Text>

              {book.rating !==
              null ? (
                <View
                  style={
                    styles.gridRatingRow
                  }
                >
                  <Ionicons
                    name="star"
                    size={
                      11
                    }
                    color={
                      colors.gold
                    }
                  />

                  <Text
                    style={
                      styles.gridRatingText
                    }
                  >
                    {
                      renderRating(
                        book.rating
                      )
                    }
                  </Text>
                </View>
              ) : (
                <View
                  style={
                    styles.gridRatingSpacer
                  }
                />
              )}
            </Pressable>
          )
        )}
      </View>
    );
  }

  function renderReviewsTab() {
    if (
      reviewedBooks.length ===
      0
    ) {
      return (
        <View
          style={
            styles.emptyActivity
          }
        >
          <Text
            style={
              styles.emptyActivityTitle
            }
          >
            Your public reviews preview will show up here.
          </Text>

          <Text
            style={
              styles.emptyActivityText
            }
          >
            Reviews appear here only when Show Reviews Publicly is enabled in Privacy.
          </Text>
        </View>
      );
    }

    return (
      <View
        style={
          styles.reviewList
        }
      >
        {reviewedBooks.map(
          (
            book
          ) => (
            <Pressable
              key={
                book.id
              }
              onPress={() =>
                openBook(
                  book.google_book_id
                )
              }
              style={({
                pressed,
              }) => [
                styles.reviewCard,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={
                  styles.reviewHeader
                }
              >
                {book.cover_url ? (
                  <ExpoImage
                    source={
                      book.cover_url
                    }
                    style={
                      styles.reviewCover
                    }
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                    recyclingKey={
                      book.cover_url
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.reviewCoverPlaceholder
                    }
                  >
                    <Ionicons
                      name="book-outline"
                      size={
                        20
                      }
                      color={
                        colors.gold
                      }
                    />
                  </View>
                )}

                <View
                  style={
                    styles.reviewBookInfo
                  }
                >
                  <Text
                    style={
                      styles.reviewBookTitle
                    }
                    numberOfLines={
                      2
                    }
                  >
                    {
                      book.title
                    }
                  </Text>

                  <Text
                    style={
                      styles.reviewBookAuthor
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {book.authors.length >
                    0
                      ? book.authors.join(
                          ', '
                        )
                      : 'Unknown author'}
                  </Text>

                  <View
                    style={
                      styles.reviewMetaRow
                    }
                  >
                    {book.rating !==
                    null ? (
                      <>
                        <Ionicons
                          name="star"
                          size={
                            14
                          }
                          color={
                            colors.gold
                          }
                        />

                        <Text
                          style={
                            styles.reviewRating
                          }
                        >
                          {
                            renderRating(
                              book.rating
                            )
                          }{' '}
                          / 5
                        </Text>
                      </>
                    ) : null}

                    <Text
                      style={
                        styles.reviewStatus
                      }
                    >
                      {
                        renderBookStatus(
                          book
                        )
                      }
                    </Text>
                  </View>
                </View>
              </View>

              {book.review_text?.trim() ? (
                <Text
                  style={
                    styles.reviewText
                  }
                >
                  {
                    book.review_text.trim()
                  }
                </Text>
              ) : (
                <Text
                  style={
                    styles.ratingOnlyText
                  }
                >
                  Rating only
                </Text>
              )}
            </Pressable>
          )
        )}
      </View>
    );
  }

  function editActivityPost(
    post: FeedPost
  ) {
    router.push(
      getPostEditRoute(
        post
      )
    );
  }

  function openActivityPostOptions(
    post: FeedPost
  ) {
    Alert.alert(
      'Post options',
      'Manage your post.',
      [
        {
          text:
            'Edit Post',
          onPress: () =>
            editActivityPost(
              post
            ),
        },
        {
          text:
            'Delete Post',
          style:
            'destructive',
          onPress: () =>
            setDeletePostTarget(
              post
            ),
        },
        {
          text:
            'Cancel',
          style:
            'cancel',
        },
      ]
    );
  }

  async function removeActivityPost(
    post: FeedPost
  ) {
    if (
      deletingPostId
    ) {
      return;
    }

    try {
      setDeletingPostId(
        post.id
      );

      await deletePost(
        post.id
      );

      setPosts(
        (
          current
        ) =>
          current.filter(
            (
              item
            ) =>
              item.id !==
              post.id
          )
      );

      const currentPostMutationVersion =
        getPostMutationVersion();

      lastSeenPostMutationRef.current =
        currentPostMutationVersion;

      if (
        profileSessionCache
      ) {
        const nextSnapshot:
          ProfileCacheSnapshot = {
            ...profileSessionCache.snapshot,
            posts:
              profileSessionCache.snapshot.posts.filter(
                (
                  item
                ) =>
                  item.id !==
                  post.id
              ),
            postMutationVersion:
              currentPostMutationVersion,
          };

        profileSessionCache = {
          ...profileSessionCache,
          snapshot:
            nextSnapshot,
          postMutationVersion:
            currentPostMutationVersion,
        };

        void writeProfileCache(
          profileSessionCache.userId,
          nextSnapshot
        );
      }

      setDeletePostTarget(
        null
      );
    } catch (
      error
    ) {
      console.error(
        'Could not delete post:',
        error
      );

      Alert.alert(
        'Could not delete post',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );

      throw error;
    } finally {
      setDeletingPostId(
        null
      );
    }
  }

  async function handleActivityPostVote(
    postId: string,
    voteValue:
      PostVoteValue
  ) {
    if (
      votingPostId ===
      postId
    ) {
      return;
    }

    try {
      setVotingPostId(
        postId
      );

      const nextVote =
        await togglePostVote(
          postId,
          voteValue
        );

      setPosts(
        (
          current
        ) =>
          current.map(
            (
              post
            ) =>
              post.id ===
              postId
                ? {
                    ...post,
                    ...nextVote,
                  }
                : post
          )
      );

      const currentPostMutationVersion =
        getPostMutationVersion();

      lastSeenPostMutationRef.current =
        currentPostMutationVersion;

      if (
        profileSessionCache
      ) {
        const nextSnapshot:
          ProfileCacheSnapshot = {
            ...profileSessionCache.snapshot,
            posts:
              profileSessionCache.snapshot.posts.map(
                (
                  post
                ) =>
                  post.id ===
                  postId
                    ? {
                        ...post,
                        ...nextVote,
                      }
                    : post
              ),
            postMutationVersion:
              currentPostMutationVersion,
          };

        profileSessionCache = {
          ...profileSessionCache,
          snapshot:
            nextSnapshot,
          postMutationVersion:
            currentPostMutationVersion,
        };

        void writeProfileCache(
          profileSessionCache.userId,
          nextSnapshot
        );
      }
    } catch (
      error
    ) {
      console.error(
        'Could not update post vote:',
        error
      );
    } finally {
      setVotingPostId(
        null
      );
    }
  }

  function renderActivityTab() {
    if (
      posts.length ===
      0
    ) {
      return (
        <View
          style={
            styles.emptyActivity
          }
        >
          <Text
            style={
              styles.emptyActivityTitle
            }
          >
            Your activity will show up here.
          </Text>

          <Text
            style={
              styles.emptyActivityText
            }
          >
            Posts, reading updates, Ask Readers questions, reviews, and Book Stacks will appear here.
          </Text>
        </View>
      );
    }

    return (
      <View
        style={
          styles.activityList
        }
      >
        {posts.map(
          (
            post
          ) => {
            const displayName =
              post.author_display_name
                ?.trim() ||
              post.author_username
                ?.trim() ||
              'Novori Reader';

            const username =
              post.author_username
                ?.trim()
                ? `@${post.author_username.trim()}`
                : '';

            const initial =
              displayName
                .charAt(0)
                .toUpperCase();

            const questionContent =
              post.post_type ===
                'question'
                ? splitQuestionPostBody(
                    post.body
                  )
                : null;

            return (
              <Pressable
                key={
                  post.id
                }
                onPress={() =>
                  router.push({
                    pathname:
                      '/post/[id]',
                    params: {
                      id:
                        post.id,
                    },
                  })
                }
                style={({ pressed }) => [
                  styles.activityFeedCard,
                  pressed &&
                    styles.activityFeedCardPressed,
                ]}
              >
                <View
                  style={
                    styles.activityFeedHeader
                  }
                >
                  {post.author_avatar_url ? (
                    <ExpoImage
                      source={
                        post.author_avatar_url
                      }
                      style={
                        styles.activityFeedAvatar
                      }
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={0}
                      recyclingKey={
                        post.author_avatar_url
                      }
                    />
                  ) : (
                    <View
                      style={
                        styles.activityFeedAvatarFallback
                      }
                    >
                      <Text
                        style={
                          styles.activityFeedAvatarText
                        }
                      >
                        {initial}
                      </Text>
                    </View>
                  )}

                  <View
                    style={
                      styles.activityFeedAuthorCopy
                    }
                  >
                    <View
                      style={
                        styles.activityFeedIdentity
                      }
                    >
                      <Text
                        style={
                          styles.activityFeedAuthorName
                        }
                        numberOfLines={1}
                      >
                        {displayName}
                      </Text>

                      {username ? (
                        <Text
                          style={
                            styles.activityFeedUsername
                          }
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {username}
                        </Text>
                      ) : null}
                    </View>

                    <Text
                      style={
                        styles.activityFeedTime
                      }
                    >
                      {post.club_name
                        ? `in ${post.club_name} · `
                        : 'posted to your profile · '}
                      {formatActivityTime(
                        post.created_at
                      )}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.activityFeedHeaderActions
                    }
                  >
                    <Pressable
                      onPress={(
                        event
                      ) => {
                        event.stopPropagation();

                        void sharePostLink(
                          post.id
                        ).catch(
                          (
                            shareError
                          ) => {
                            console.error(
                              'Could not share post:',
                              shareError
                            );

                            Alert.alert(
                              'Could not share post',
                              'Please try again.'
                            );
                          }
                        );
                      }}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Share post"
                      style={({ pressed }) => [
                        styles.activityFeedHeaderAction,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name="share-social-outline"
                        size={18}
                        color={
                          colors.mutedText
                        }
                      />
                    </Pressable>

                    <Pressable
                      onPress={(
                        event
                      ) => {
                        event.stopPropagation();
                        openActivityPostOptions(
                          post
                        );
                      }}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Post options"
                      style={({ pressed }) => [
                        styles.activityFeedHeaderAction,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={19}
                        color={
                          colors.mutedText
                        }
                      />
                    </Pressable>
                  </View>
                </View>

                <View
                  style={
                    styles.activityFeedContent
                  }
                >
                  <PostTypeIdentifier
                    postType={
                      post.post_type
                    }
                    rating={
                      post.rating
                    }
                    colors={
                      colors
                    }
                  />

                  {questionContent ? (
                    <>
                      <Text
                        style={
                          styles.activityFeedQuestionTitle
                        }
                      >
                        {
                          questionContent.question
                        }
                      </Text>

                      {questionContent.context ? (
                        <Text
                          style={
                            styles.activityFeedQuestionContext
                          }
                        >
                          {
                            questionContent.context
                          }
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text
                      style={
                        styles.activityFeedBody
                      }
                    >
                      {post.body}
                    </Text>
                  )}

                  {post.post_type ===
                    'book_stack' &&
                  post.book_stack_id ? (
                    <BookStackPostAttachment
                      stackId={
                        post.book_stack_id
                      }
                    />
                  ) : null}

                  {post.post_image_url ? (
                    <FeedPostImage
                      uri={
                        post.post_image_url
                      }
                      colors={
                        colors
                      }
                    />
                  ) : null}

                  {post.book_title ? (
                    post.post_image_url ? (
                      <Pressable
                        disabled={
                          !post.google_book_id
                        }
                        onPress={(event) => {
                          event.stopPropagation();

                          if (
                            !post.google_book_id
                          ) {
                            return;
                          }

                          router.push({
                            pathname:
                              '/book/[id]',
                            params: {
                              id:
                                post.google_book_id,
                              source:
                                'shared',
                            },
                          });
                        }}
                        style={({ pressed }) => [
                          styles.activityFeedCompactBook,
                          pressed &&
                            Boolean(
                              post.google_book_id
                            ) &&
                            styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name="book-outline"
                          size={14}
                          color={
                            colors.gold
                          }
                        />

                        <View
                          style={
                            styles.activityFeedCompactBookCopy
                          }
                        >
                          <Text
                            style={
                              styles.activityFeedCompactBookTitle
                            }
                            numberOfLines={1}
                          >
                            {post.book_title}
                          </Text>

                          {(post.book_authors &&
                            post.book_authors.length >
                              0) ||
                          post.book_series_name ? (
                            <Text
                              style={
                                styles.activityFeedCompactBookMeta
                              }
                              numberOfLines={1}
                            >
                              {post.book_authors &&
                              post.book_authors.length >
                                0
                                ? post.book_authors.join(
                                    ', '
                                  )
                                : ''}
                              {post.book_authors &&
                              post.book_authors.length >
                                0 &&
                              post.book_series_name
                                ? ' · '
                                : ''}
                              {post.book_series_name
                                ? `${post.book_series_name}${post.book_series_position !== null
                                    ? ` #${post.book_series_position}`
                                    : ''}`
                                : ''}
                            </Text>
                          ) : null}

                          {(post.post_type ===
                            'question' ||
                            post.post_type ===
                              'reading_update') &&
                          post.book_title ? (
                            <CanonicalBookRating
                              googleBookId={
                                post.google_book_id
                              }
                              title={
                                post.book_title
                              }
                              authors={
                                post.book_authors
                              }
                              compact
                            />
                          ) : null}
                        </View>

                        {post.google_book_id ? (
                          <Ionicons
                            name="chevron-forward"
                            size={15}
                            color={
                              colors.mutedText
                            }
                          />
                        ) : null}
                      </Pressable>
                    ) : (
                      <Pressable
                        disabled={
                          !post.google_book_id
                        }
                        onPress={(event) => {
                          event.stopPropagation();

                          if (
                            !post.google_book_id
                          ) {
                            return;
                          }

                          router.push({
                            pathname:
                              '/book/[id]',
                            params: {
                              id:
                                post.google_book_id,
                              source:
                                'shared',
                            },
                          });
                        }}
                        style={({ pressed }) => [
                          styles.activityFeedBookCard,
                          pressed &&
                            Boolean(
                              post.google_book_id
                            ) &&
                            styles.pressed,
                        ]}
                      >
                        {post.book_cover_url ? (
                          <ExpoImage
                            source={
                              post.book_cover_url
                            }
                            style={
                              styles.activityFeedBookCover
                            }
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            transition={0}
                            recyclingKey={
                              post.book_cover_url
                            }
                          />
                        ) : (
                          <View
                            style={
                              styles.activityFeedBookCoverFallback
                            }
                          >
                            <Ionicons
                              name="book-outline"
                              size={22}
                              color={
                                colors.gold
                              }
                            />
                          </View>
                        )}

                        <View
                          style={
                            styles.activityFeedBookCopy
                          }
                        >
                          <View
                            style={
                              styles.activityFeedBookEyebrow
                            }
                          >
                            <Ionicons
                              name="book-outline"
                              size={12}
                              color={
                                colors.gold
                              }
                            />

                            <Text
                              style={
                                styles.activityFeedBookEyebrowText
                              }
                            >
                              Book
                            </Text>
                          </View>

                          <Text
                            style={
                              styles.activityFeedBookTitle
                            }
                            numberOfLines={2}
                          >
                            {post.book_title}
                          </Text>

                          {post.book_authors &&
                          post.book_authors.length >
                            0 ? (
                            <Text
                              style={
                                styles.activityFeedBookAuthor
                              }
                              numberOfLines={1}
                            >
                              {post.book_authors.join(
                                ', '
                              )}
                            </Text>
                          ) : null}

                          {(post.post_type ===
                            'question' ||
                            post.post_type ===
                              'reading_update') &&
                          post.book_title ? (
                            <CanonicalBookRating
                              googleBookId={
                                post.google_book_id
                              }
                              title={
                                post.book_title
                              }
                              authors={
                                post.book_authors
                              }
                            />
                          ) : null}

                          {post.rating ? (
                            <View
                              style={
                                styles.activityFeedBookRatingRow
                              }
                            >
                              <Ionicons
                                name="star"
                                size={13}
                                color={
                                  colors.gold
                                }
                              />

                              <Text
                                style={
                                  styles.activityFeedBookRating
                                }
                              >
                                {post.rating}
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {post.google_book_id ? (
                          <Ionicons
                            name="chevron-forward"
                            size={17}
                            color={
                              colors.mutedText
                            }
                          />
                        ) : null}
                      </Pressable>
                    )
                  ) : null}
                </View>

                <View
                  style={
                    styles.activityFeedFooter
                  }
                >
                  <View
                    style={
                      styles.activityVoteControl
                    }
                  >
                    <Pressable
                      disabled={
                        votingPostId ===
                        post.id
                      }
                      onPress={(event) => {
                        event.stopPropagation();
                        void handleActivityPostVote(
                          post.id,
                          1
                        );
                      }}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.activityVoteButton,
                        post.viewer_vote ===
                          1 &&
                          styles.activityVoteButtonActive,
                        pressed &&
                          styles.pressed,
                        votingPostId ===
                          post.id &&
                          styles.activityVoteButtonDisabled,
                      ]}
                    >
                      <Ionicons
                        name={
                          post.viewer_vote ===
                          1
                            ? 'arrow-up-circle'
                            : 'arrow-up-circle-outline'
                        }
                        size={20}
                        color={
                          post.viewer_vote ===
                          1
                            ? colors.gold
                            : colors.mutedText
                        }
                      />
                    </Pressable>

                    <Text
                      style={[
                        styles.activityVoteScore,
                        post.viewer_vote !==
                          0 &&
                          styles.activityVoteScoreActive,
                      ]}
                    >
                      {post.vote_score ??
                        0}
                    </Text>

                    <Pressable
                      disabled={
                        votingPostId ===
                        post.id
                      }
                      onPress={(event) => {
                        event.stopPropagation();
                        void handleActivityPostVote(
                          post.id,
                          -1
                        );
                      }}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.activityVoteButton,
                        post.viewer_vote ===
                          -1 &&
                          styles.activityVoteButtonActive,
                        pressed &&
                          styles.pressed,
                        votingPostId ===
                          post.id &&
                          styles.activityVoteButtonDisabled,
                      ]}
                    >
                      <Ionicons
                        name={
                          post.viewer_vote ===
                          -1
                            ? 'arrow-down-circle'
                            : 'arrow-down-circle-outline'
                        }
                        size={20}
                        color={
                          post.viewer_vote ===
                          -1
                            ? colors.gold
                            : colors.mutedText
                        }
                      />
                    </Pressable>
                  </View>

                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      router.push({
                        pathname:
                          '/post/[id]',
                        params: {
                          id:
                            post.id,
                        },
                      });
                    }}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.activityCommentAction,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={16}
                      color={
                        colors.mutedText
                      }
                    />

                    <Text
                      style={
                        styles.activityCommentActionText
                      }
                    >
                      {post.comment_count ??
                        0}{' '}
                      {(post.comment_count ??
                        0) === 1
                        ? 'comment'
                        : 'comments'}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }
        )}
      </View>
    );
  }

  function renderClubsTab() {
    if (
      clubs.length ===
      0
    ) {
      return (
        <View
          style={
            styles.emptyActivity
          }
        >
          <Text
            style={
              styles.emptyActivityTitle
            }
          >
            Your public clubs will show up here.
          </Text>

          <Text
            style={
              styles.emptyActivityText
            }
          >
            Public clubs you join or create will appear here. Private memberships stay private.
          </Text>
        </View>
      );
    }

    return (
      <View
        style={
          styles.clubList
        }
      >
        {clubs.map(
          (
            club
          ) => (
            <Pressable
              key={
                club.id
              }
              onPress={() =>
                router.push({
                  pathname:
                    '/club/[id]',
                  params: {
                    id:
                      club.id,
                  },
                })
              }
              style={({ pressed }) => [
                styles.clubCard,
                pressed &&
                  styles.pressed,
              ]}
            >
              {club.cover_url ? (
                <ExpoImage
                  source={
                    club.cover_url
                  }
                  style={
                    styles.clubCover
                  }
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={0}
                  recyclingKey={
                    club.cover_url
                  }
                />
              ) : (
                <View
                  style={
                    styles.clubCoverFallback
                  }
                >
                  <Ionicons
                    name="people-outline"
                    size={20}
                    color={
                      colors.gold
                    }
                  />
                </View>
              )}

              <View
                style={
                  styles.clubCopy
                }
              >
                <Text
                  style={
                    styles.clubTitle
                  }
                  numberOfLines={1}
                >
                  {
                    club.name
                  }
                </Text>

                <Text
                  style={
                    styles.clubMeta
                  }
                  numberOfLines={1}
                >
                  {club.member_count}{' '}
                  {club.member_count ===
                  1
                    ? 'member'
                    : 'members'}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color={
                  colors.mutedText
                }
              />
            </Pressable>
          )
        )}
      </View>
    );
  }

  async function shareStack(
    stack: BookStack
  ) {
    try {
      await shareBookStackLink({
        stackId:
          stack.id,
        name:
          stack.name,
      });
    } catch (
      shareError
    ) {
      console.error(
        'Could not share Book Stack:',
        shareError
      );

      Alert.alert(
        'Could not share Book Stack',
        'Please try again.'
      );
    }
  }

  function editStack(
    stack: BookStack
  ) {
    setStackActionsTarget(
      null
    );

    router.push({
      pathname:
        '/create-book-stack',
      params: {
        stackId:
          stack.id,
      },
    });
  }

  async function shareStackFromMenu(
    stack: BookStack
  ) {
    setStackActionsTarget(
      null
    );

    await shareStack(
      stack
    );
  }

  function requestDeleteStack(
    stack: BookStack
  ) {
    setDeleteStackTarget(
      stack
    );
  }

  async function confirmDeleteStack() {
    if (
      !deleteStackTarget ||
      deletingStackId
    ) {
      return;
    }

    const stackId =
      deleteStackTarget.id;

    try {
      setDeletingStackId(
        stackId
      );

      await deleteBookStack(
        stackId
      );

      setStacks(
        (
          current
        ) =>
          current.filter(
            (
              stack
            ) =>
              stack.id !==
              stackId
          )
      );

      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      const userId =
        session?.user?.id;

      if (
        userId
      ) {
        const cached =
          await readProfileCache(
            userId
          );

        if (
          cached
        ) {
          await writeProfileCache(
            userId,
            {
              ...cached,
              stacks:
                cached.stacks.filter(
                  (
                    stack
                  ) =>
                    stack.id !==
                    stackId
                ),
            }
          );
        }
      }
    } catch (
      stackError
    ) {
      console.error(
        'Could not delete Book Stack:',
        stackError
      );

      Alert.alert(
        'Could not delete Book Stack',
        stackError instanceof Error
          ? stackError.message
          : 'Please try again.'
      );

      throw stackError;
    } finally {
      setDeletingStackId(
        null
      );
    }
  }

  function renderStacksTab() {
    if (
      stacks.length ===
      0
    ) {
      return (
        <View
          style={
            styles.emptyActivity
          }
        >
          <Text
            style={
              styles.emptyActivityTitle
            }
          >
            Your Book Stacks will show up here.
          </Text>

          <Text
            style={
              styles.emptyActivityText
            }
          >
            Build a stack from Create, then save it to your profile.
          </Text>
        </View>
      );
    }

    return (
      <View
        style={
          styles.stackGrid
        }
      >
        {stacks.map(
          (
            stack
          ) => (
            <Pressable
              key={
                stack.id
              }
              onPress={() =>
                setStackActionsTarget(
                  stack
                )
              }
              style={({ pressed }) => [
                styles.stackTile,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Pressable
                onPress={(event) => {
                  event.stopPropagation();
                  setStackActionsTarget(
                    stack
                  );
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Book Stack options"
                style={({ pressed }) => [
                  styles.stackTileMenu,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={19}
                  color={
                    colors.mutedText
                  }
                />
              </Pressable>
              <View
                style={
                  styles.stackTileVisual
                }
              >
                <BookStackVisual
                  variant="profile"
                  items={
                    stack.items
                  }
                />
              </View>

              <Text
                style={
                  styles.stackTileTitle
                }
                numberOfLines={2}
              >
                {
                  stack.name
                }
              </Text>

              <View
                style={
                  styles.stackTileMetaRow
                }
              >
                <Text
                  style={
                    styles.stackTileMeta
                  }
                >
                  {stack.items.length}{' '}
                  {stack.items.length ===
                  1
                    ? 'book'
                    : 'books'}
                </Text>


              </View>
            </Pressable>
          )
        )}
      </View>
    );
  }

  function renderTabContent() {
    if (
      activeTab ===
      'activity'
    ) {
      return renderActivityTab();
    }

    if (
      activeTab ===
      'clubs'
    ) {
      return renderClubsTab();
    }

    if (
      libraryTab ===
      'reviews'
    ) {
      return renderReviewsTab();
    }

    if (
      libraryTab ===
      'stacks'
    ) {
      return renderStacksTab();
    }

    return renderBooksTab();
  }

  if (
    !profileHydrated
  ) {
    return (
      <TabScreen
        scroll
      >
        <View
          style={
            styles.profileCacheWarmup
          }
        />
      </TabScreen>
    );
  }

  return (
    <TabScreen
      scroll
      scrollRef={
        profileScrollRef
      }
      onScroll={(event) => {
        profileScrollOffsetRef.current =
          event.nativeEvent
            .contentOffset.y;
      }}
      refreshing={
        refreshing
      }
      onRefresh={
        refreshProfile
      }
      refreshTintColor={
        colors.gold
      }
    >
      <View
        style={
          styles.topBar
        }
      >
        <View
          style={
            styles.topBarSpacer
          }
        />

        <Pressable
          onPress={
            openSettings
          }
          hitSlop={
            10
          }
          style={({
            pressed,
          }) => [
            styles.settingsButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="settings-outline"
            size={
              23
            }
            color={
              colors.text
            }
          />
        </Pressable>
      </View>

      <View
        style={
          styles.profileHeader
        }
      >
        {profile?.avatar_url ? (
          <Pressable
            onPress={() =>
              setProfileImageOpen(
                true
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Enlarge profile photo"
            style={({ pressed }) => [
              pressed &&
                styles.pressed,
            ]}
          >
            <ExpoImage
              source={
                profile.avatar_url
              }
              style={
                styles.avatarImage
              }
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
            />
          </Pressable>
        ) : (
          <View
            style={
              styles.avatar
            }
          >
            <Text
              style={
                styles.avatarText
              }
            >
              {
                avatarInitial
              }
            </Text>
          </View>
        )}

        <Text
          style={
            styles.name
          }
        >
          {displayName}
        </Text>

        <Text
          style={
            styles.username
          }
        >
          {username}
        </Text>

        <Text
          style={
            styles.bio
          }
        >
          {bio}
        </Text>
      </View>

      <View
        style={
          styles.statsRow
        }
      >
        <Pressable
          style={({
            pressed,
          }) => [
            styles.stat,
            pressed &&
              styles.pressed,
          ]}
          onPress={() => {
            setActiveTab(
              'library'
            );
            setLibraryTab(
              'books'
            );
          }}
        >
          <Text
            style={
              styles.statNumber
            }
          >
            {
              profileBookCount
            }
          </Text>

          <Text
            style={
              styles.statLabel
            }
          >
            Books
          </Text>
        </Pressable>

        <Pressable
          style={({
            pressed,
          }) => [
            styles.stat,
            pressed &&
              styles.pressed,
          ]}
          onPress={() => {
            if (
              !profile
            ) {
              return;
            }

            router.push({
              pathname:
                '/reader-connections',
              params: {
                readerId:
                  profile.id,
                mode:
                  'followers',
                name:
                  displayName,
              },
            });
          }}
        >
          <Text
            style={
              styles.statNumber
            }
          >
            {
              followerCount
            }
          </Text>

          <Text
            style={
              styles.statLabel
            }
          >
            Followers
          </Text>
        </Pressable>

        <Pressable
          style={({
            pressed,
          }) => [
            styles.stat,
            pressed &&
              styles.pressed,
          ]}
          onPress={() => {
            if (
              !profile
            ) {
              return;
            }

            router.push({
              pathname:
                '/reader-connections',
              params: {
                readerId:
                  profile.id,
                mode:
                  'following',
                name:
                  displayName,
              },
            });
          }}
        >
          <Text
            style={
              styles.statNumber
            }
          >
            {
              followingCount
            }
          </Text>

          <Text
            style={
              styles.statLabel
            }
          >
            Following
          </Text>
        </Pressable>
      </View>

      <View
        style={
          styles.profileActions
        }
      >
        <Pressable
          onPress={
            handleEditProfile
          }
          style={({
            pressed,
          }) => [
            styles.actionButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <Text
            style={
              styles.actionButtonText
            }
          >
            Edit Profile
          </Text>
        </Pressable>

        <Pressable
          onPress={
            handleShareProfile
          }
          style={({
            pressed,
          }) => [
            styles.actionButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <Text
            style={
              styles.actionButtonText
            }
          >
            Share Profile
          </Text>
        </Pressable>
      </View>

      <ProfileReadingModule
        books={
          books
        }
      />

      <View
        style={
          styles.divider
        }
      />

      <View
        style={
          styles.profileTabs
        }
      >
        <ProfileTabButton
          label="Library"
          icon="library-outline"
          active={
            activeTab ===
            'library'
          }
          onPress={() =>
            setActiveTab(
              'library'
            )
          }
        />

        <ProfileTabButton
          label="Activity"
          icon="pulse-outline"
          active={
            activeTab ===
            'activity'
          }
          onPress={() =>
            setActiveTab(
              'activity'
            )
          }
        />

        <ProfileTabButton
          label="Clubs"
          icon="people-outline"
          active={
            activeTab ===
            'clubs'
          }
          onPress={() =>
            setActiveTab(
              'clubs'
            )
          }
        />
      </View>

      {activeTab ===
      'library' ? (
        <View
          style={
            styles.libraryTabs
          }
        >
          {(
            [
              {
                key:
                  'books',
                label:
                  'Books',
              },
              {
                key:
                  'reviews',
                label:
                  'Reviews',
              },
              {
                key:
                  'stacks',
                label:
                  'Stacks',
              },
            ] as {
              key:
                ProfileLibraryTab;
              label:
                string;
            }[]
          ).map(
            (tab) => (
              <Pressable
                key={
                  tab.key
                }
                onPress={() =>
                  setLibraryTab(
                    tab.key
                  )
                }
                style={[
                  styles.libraryTab,
                  libraryTab ===
                    tab.key &&
                    styles.libraryTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.libraryTabText,
                    libraryTab ===
                      tab.key &&
                      styles.libraryTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            )
          )}
        </View>
      ) : null}

      {
        renderTabContent()
      }

      <DeletePostConfirmSheet
        visible={
          Boolean(
            deletePostTarget
          )
        }
        busy={
          Boolean(
            deletingPostId
          )
        }
        onConfirm={async () => {
          if (
            !deletePostTarget
          ) {
            return;
          }

          await removeActivityPost(
            deletePostTarget
          );
        }}
        onDismiss={() =>
          setDeletePostTarget(
            null
          )
        }
      />

      <BookStackActionsSheet
        visible={
          Boolean(
            stackActionsTarget
          )
        }
        stackName={
          stackActionsTarget?.name ??
          null
        }
        onEdit={() => {
          if (
            stackActionsTarget
          ) {
            editStack(
              stackActionsTarget
            );
          }
        }}
        onShare={() => {
          if (
            stackActionsTarget
          ) {
            void shareStackFromMenu(
              stackActionsTarget
            );
          }
        }}
        onDelete={() => {
          if (
            stackActionsTarget
          ) {
            requestDeleteStack(
              stackActionsTarget
            );
          }
        }}
        onDismiss={() =>
          setStackActionsTarget(
            null
          )
        }
      />

      <DeleteBookStackConfirmSheet
        visible={
          Boolean(
            deleteStackTarget
          )
        }
        busy={
          Boolean(
            deletingStackId
          )
        }
        onConfirm={
          confirmDeleteStack
        }
        onDismiss={() =>
          setDeleteStackTarget(
            null
          )
        }
      />

      <FullScreenImageViewer
        visible={
          profileImageOpen
        }
        uri={
          profile?.avatar_url ??
          null
        }
        onClose={() =>
          setProfileImageOpen(
            false
          )
        }
        shape="circle"
      />
    </TabScreen>
  );
}

function ProfileTabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon:
    keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useNovoriTheme();
  const styles = createStyles(colors);
  return (
    <Pressable
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.profileTab,
        active &&
          styles.profileTabActive,
        pressed &&
          styles.pressed,
      ]}
    >
      <Ionicons
        name={
          icon
        }
        size={
          17
        }
        color={
          active
            ? colors.gold
            : colors.mutedText
        }
      />

      <Text
        style={
          active
            ? styles.profileTabTextActive
            : styles.profileTabText
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    profileCacheWarmup: {
      minHeight: 1,
    },

    topBar: {
      minHeight: 44,
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginBottom: 2,
    },

    topBarSpacer: {
      width: 44,
    },

    settingsButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
    },

    profileHeader: {
      alignItems:
        'center',
    },

    avatar: {
      width: 86,
      height: 86,
      borderRadius: 43,
      backgroundColor:
        colors.elevated,
      borderWidth: 2,
      borderColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    avatarImage: {
      width: 86,
      height: 86,
      borderRadius: 43,
      borderWidth: 2,
      borderColor:
        colors.gold,
      backgroundColor:
        colors.elevated,
    },

    avatarText: {
      color:
        colors.gold,
      fontSize: 35,
      fontFamily:
        'Inter_700Bold',
    },

    name: {
      color:
        colors.text,
      fontSize: 24,
      fontFamily:
        'PlayfairDisplay_700Bold',
      marginTop: 15,
    },

    username: {
      color:
        colors.mutedText,
      fontSize: 14,
      fontFamily:
        'Inter_400Regular',
      marginTop: 4,
    },

    bio: {
      color:
        colors.secondaryText,
      fontSize: 14,
      lineHeight: 20,
      fontFamily:
        'Inter_400Regular',
      textAlign:
        'center',
      marginTop: 10,
      maxWidth: 360,
    },

    statsRow: {
      flexDirection:
        'row',
      marginTop: 20,
      marginBottom: 14,
    },

    stat: {
      flex: 1,
      alignItems:
        'center',
      minHeight: 46,
      justifyContent:
        'center',
    },

    statNumber: {
      color:
        colors.text,
      fontSize: 20,
      fontFamily:
        'Inter_700Bold',
    },

    statLabel: {
      color:
        colors.mutedText,
      fontSize: 12,
      fontFamily:
        'Inter_400Regular',
      marginTop: 3,
    },

    profileActions: {
      flexDirection:
        'row',
      gap: 10,
    },

    actionButton: {
      flex: 1,
      minHeight: 43,
      borderRadius: 12,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    actionButtonText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 13,
    },

    pressed: {
      opacity: 0.68,
    },

    divider: {
      height: 1,
      backgroundColor:
        colors.border,
      marginVertical: 18,
    },

    profileTabs: {
      flexDirection:
        'row',
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 14,
      padding: 4,
      gap: 4,
    },

    profileTab: {
      flex: 1,
      minHeight: 38,
      borderRadius: 10,
      alignItems:
        'center',
      justifyContent:
        'center',
      flexDirection:
        'row',
      gap: 6,
    },

    profileTabActive: {
      backgroundColor:
        colors.elevated,
    },

    profileTabText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12,
    },

    profileTabTextActive: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12,
    },

    libraryTabs: {
      flexDirection:
        'row',
      alignSelf:
        'center',
      gap: 18,
      marginTop: 12,
      paddingHorizontal: 4,
    },

    libraryTab: {
      minHeight: 32,
      justifyContent:
        'center',
      borderBottomWidth: 2,
      borderBottomColor:
        'transparent',
      paddingHorizontal: 4,
    },

    libraryTabActive: {
      borderBottomColor:
        colors.gold,
    },

    libraryTabText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12,
    },

    libraryTabTextActive: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 12,
    },

    stackGrid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      columnGap: 12,
      rowGap: 18,
      marginTop: 18,
    },

    stackTile: {
      width: '48%',
      minHeight: 225,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 17,
      backgroundColor:
        colors.surface,
      padding: 12,
      overflow:
        'hidden',
    },

    stackTileMenu: {
      position:
        'absolute',
      top: 7,
      right: 7,
      width: 32,
      height: 32,
      alignItems:
        'center',
      justifyContent:
        'center',
      zIndex: 4,
    },

    stackTileVisual: {
      height: 145,
      alignItems:
        'center',
      justifyContent:
        'center',
      overflow:
        'hidden',
      transform: [
        {
          translateY: 9,
        },
      ],
    },

    stackTileTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      fontSize: 15,
      lineHeight: 20,
      marginTop: 8,
    },

    stackTileMetaRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginTop: 5,
    },

    stackTileMeta: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 10,
    },

    activityFeedCard: {
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 22,
      overflow:
        'hidden',
      shadowColor:
        '#000000',
      shadowOpacity:
        0.1,
      shadowRadius:
        14,
      shadowOffset: {
        width: 0,
        height: 5,
      },
      elevation: 3,
    },

    activityFeedCardPressed: {
      opacity: 0.95,
      transform: [
        {
          scale: 0.998,
        },
      ],
    },

    activityFeedHeader: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      paddingHorizontal:
        16,
      paddingTop:
        15,
    },

    activityFeedAvatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor:
        colors.elevated,
      borderWidth: 1,
      borderColor:
        colors.border,
      marginRight: 12,
    },

    activityFeedAvatarFallback: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor:
        colors.elevated,
      borderWidth: 1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    activityFeedAvatarText: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 18,
    },

    activityFeedAuthorCopy: {
      flex: 1,
      minWidth: 0,
      paddingTop: 2,
    },

    activityFeedIdentity: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
      minWidth: 0,
    },

    activityFeedAuthorName: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 13.5,
      flexShrink: 0,
    },

    activityFeedUsername: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11.5,
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
    },

    activityFeedTime: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10.5,
      marginTop: 5,
    },

    activityFeedHeaderActions: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginLeft: 4,
      marginTop: -2,
    },

    activityFeedHeaderAction: {
      width: 34,
      height: 34,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    activityFeedContent: {
      paddingHorizontal: 16,
      paddingTop: 14,
    },

    activityFeedBody: {
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize: 15,
      lineHeight: 22,
    },

    activityFeedQuestionTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      fontSize: 19,
      lineHeight: 26,
    },

    activityFeedQuestionContext: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 14,
      lineHeight: 21,
      marginTop: 8,
    },

    activityFeedCompactBook: {
      minHeight: 42,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
      marginTop: 7,
      paddingHorizontal: 2,
      paddingVertical: 7,
    },

    activityFeedCompactBookCopy: {
      flex: 1,
      minWidth: 0,
    },

    activityFeedCompactBookTitle: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12.5,
    },

    activityFeedCompactBookMeta: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10.5,
      fontStyle:
        'italic',
      marginTop: 2,
    },

    activityFeedBookCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        colors.elevated,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 16,
      padding: 11,
      marginTop: 15,
    },

    activityFeedBookCover: {
      width: 52,
      height: 76,
      borderRadius: 8,
      backgroundColor:
        colors.surface,
      marginRight: 12,
    },

    activityFeedBookCoverFallback: {
      width: 52,
      height: 76,
      borderRadius: 8,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    activityFeedBookCopy: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },

    activityFeedBookEyebrow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 4,
      marginBottom: 5,
    },

    activityFeedBookEyebrowText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 9,
      textTransform:
        'uppercase',
      letterSpacing: 0.8,
    },

    activityFeedBookTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 13,
      lineHeight: 18,
    },

    activityFeedBookAuthor: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10.5,
      marginTop: 4,
    },

    activityFeedBookRatingRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 4,
      marginTop: 7,
    },

    activityFeedBookRating: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11.5,
    },

    activityFeedFooter: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap: 10,
      marginTop: 15,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 14,
      borderTopWidth: 1,
      borderTopColor:
        colors.border,
    },

    activityVoteControl: {
      flexDirection:
        'row',
      alignItems:
        'center',
      minHeight: 36,
      backgroundColor:
        colors.elevated,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 18,
      paddingHorizontal: 4,
    },

    activityVoteButton: {
      width: 30,
      height: 34,
      borderRadius: 17,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    activityVoteButtonActive: {
      backgroundColor:
        colors.surface,
    },

    activityVoteButtonDisabled: {
      opacity: 0.5,
    },

    activityVoteScore: {
      minWidth: 20,
      textAlign:
        'center',
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12,
    },

    activityVoteScoreActive: {
      color:
        colors.gold,
    },

    activityCommentAction: {
      minHeight: 36,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 6,
      backgroundColor:
        colors.elevated,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 18,
      paddingHorizontal: 12,
    },

    activityCommentActionText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
    },

    activityList: {
      marginTop: 18,
      gap: 12,
    },

    activityCard: {
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 16,
      padding: 14,
    },

    activityMetaRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
    },

    activityMetaText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10,
      letterSpacing: 0.5,
      textTransform:
        'uppercase',
    },

    activityBody: {
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13.5,
      lineHeight: 20,
      marginTop: 10,
    },

    activityBook: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        colors.elevated,
      borderRadius: 12,
      padding: 9,
      marginTop: 12,
    },

    activityBookCover: {
      width: 38,
      height: 56,
      borderRadius: 5,
      marginRight: 10,
      backgroundColor:
        colors.surface,
    },

    activityBookCoverFallback: {
      width: 38,
      height: 56,
      borderRadius: 5,
      marginRight: 10,
      backgroundColor:
        colors.surface,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    activityBookCopy: {
      flex: 1,
      minWidth: 0,
    },

    activityBookTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12.5,
      lineHeight: 17,
    },

    activityBookAuthor: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10.5,
      marginTop: 3,
    },

    clubList: {
      marginTop: 18,
      gap: 10,
    },

    clubCard: {
      minHeight: 70,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 15,
      padding: 10,
    },

    clubCover: {
      width: 48,
      height: 48,
      borderRadius: 13,
      marginRight: 11,
      backgroundColor:
        colors.elevated,
    },

    clubCoverFallback: {
      width: 48,
      height: 48,
      borderRadius: 13,
      marginRight: 11,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    clubCopy: {
      flex: 1,
      minWidth: 0,
    },

    clubTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 13.5,
    },

    clubMeta: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10.5,
      marginTop: 4,
    },

    emptyActivity: {
      alignItems:
        'center',
      paddingVertical: 46,
      paddingHorizontal: 24,
    },

    emptyActivityTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      fontSize: 19,
      textAlign:
        'center',
    },

    emptyActivityText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      lineHeight: 20,
      textAlign:
        'center',
      marginTop: 7,
    },

    bookGrid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      justifyContent:
        'flex-start',
      columnGap: 12,
      rowGap: 22,
      marginTop: 18,
    },

    gridBook: {
      width: '31%',
    },

    gridCoverWrap: {
      width: '100%',
      aspectRatio: 0.67,
      borderRadius: 9,
      overflow: 'hidden',
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      position: 'relative',
    },

    gridCover: {
      width: '100%',
      height: '100%',
      resizeMode:
        'cover',
    },

    gridCoverPlaceholder: {
      flex: 1,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    gridStatusBadge: {
      position:
        'absolute',
      left: 6,
      bottom: 6,
      borderRadius: 7,
      paddingHorizontal: 6,
      paddingVertical: 3,
      backgroundColor:
        colors.background,
      borderWidth: 1,
      borderColor:
        colors.border,
    },

    gridStatusBadgeText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 8,
      letterSpacing: 0.3,
    },

    gridBookTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
      lineHeight: 15,
      marginTop: 7,
    },

    gridRatingRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginTop: 4,
    },

    gridRatingText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 10,
      marginLeft: 3,
    },

    gridRatingSpacer: {
      height: 15,
      marginTop: 4,
    },

    reviewList: {
      marginTop: 18,
      gap: 12,
    },

    reviewCard: {
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 16,
      padding: 14,
    },

    reviewHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    reviewCover: {
      width: 44,
      height: 66,
      borderRadius: 6,
      backgroundColor:
        colors.elevated,
      marginRight: 11,
    },

    reviewCoverPlaceholder: {
      width: 44,
      height: 66,
      borderRadius: 6,
      backgroundColor:
        colors.elevated,
      borderWidth: 1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },

    reviewBookInfo: {
      flex: 1,
    },

    reviewBookTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
      lineHeight: 19,
    },

    reviewBookAuthor: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      marginTop: 3,
    },

    reviewMetaRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      flexWrap:
        'wrap',
      gap: 5,
      marginTop: 7,
    },

    reviewRating: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
    },

    reviewStatus: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 11,
      marginLeft: 4,
    },

    reviewText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      lineHeight: 20,
      marginTop: 12,
    },

    ratingOnlyText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      fontStyle:
        'italic',
      marginTop: 12,
    },
    });
}
