import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useState,
} from 'react';
import {
  Alert,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BookStackPostAttachment from '../../components/BookStackPostAttachment';
import BookStackVisual from '../../components/BookStackVisual';
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
  getMyBookStacks,
} from '../../lib/book-stacks';
import {
  ClubWithMembership,
} from '../../lib/clubs';
import {
  FeedPost,
} from '../../lib/feed';
import {
  PROFILE_BOOK_STATUS_LABELS,
  sortProfileBooks,
} from '../../lib/profile-book-order';
import {
  getReaderProfile,
  getReaderProfilePosts,
  getReaderPublicClubs,
} from '../../lib/social';
import {
  supabase,
} from '../../lib/supabase';
import {
  getUserBooks,
  UserBook,
} from '../../lib/user-books';

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

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function loadProfileAndBooks() {
        const {
          data: {
            user,
          },
          error:
            userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          await supabase.auth.signOut();

          router.replace(
            '/auth'
          );

          return;
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

        if (error) {
          console.error(
            'Could not load profile:',
            error.message
          );
        } else if (
          isMounted
        ) {
          setProfile(
            data
          );
        }

        try {
          const [
            savedBooks,
            socialProfile,
            profilePosts,
            publicClubs,
            savedStacks,
          ] = await Promise.all([
            getUserBooks(),
            getReaderProfile(
              user.id
            ),
            getReaderProfilePosts(
              user.id
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
                return [];
              }
            ),
          ]);

          if (
            isMounted
          ) {
            setBooks(
              savedBooks
            );
            setFollowerCount(
              socialProfile.follower_count
            );
            setFollowingCount(
              socialProfile.following_count
            );
            setPosts(
              profilePosts
            );
            setClubs(
              publicClubs
            );
            setStacks(
              savedStacks
            );
          }
        } catch (
          bookError
        ) {
          console.error(
            'Could not load profile books:',
            bookError
          );

          if (
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

      loadProfileAndBooks();

      return () => {
        isMounted =
          false;
      };
    }, [router])
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
      books
    );

  const reviewedBooks =
    books.filter(
      (book) =>
        book.rating !==
          null ||
        Boolean(
          book.review_text?.trim()
        )
    );

  const profileBookCount =
    books.length;

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
            Your reading history will show up here.
          </Text>

          <Text
            style={
              styles.emptyActivityText
            }
          >
            Reading, TBR, Read, and DNF books will appear here in that order.
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
                  <Image
                    source={{
                      uri:
                        book.cover_url,
                    }}
                    style={
                      styles.gridCover
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
            Your reviews will show up here.
          </Text>

          <Text
            style={
              styles.emptyActivityText
            }
          >
            Ratings and reviews you publish on Novori will appear on your profile.
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
                  <Image
                    source={{
                      uri:
                        book.cover_url,
                    }}
                    style={
                      styles.reviewCover
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
            Posts, reading updates, Ask Readers questions, and shared reviews will appear here.
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
          ) => (
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
                styles.activityCard,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={
                  styles.activityMetaRow
                }
              >
                <Ionicons
                  name={
                    post.post_type ===
                    'review'
                      ? 'star-outline'
                      : post.post_type ===
                        'reading_update'
                      ? 'book-outline'
                      : post.post_type ===
                        'question'
                      ? 'help-circle-outline'
                      : post.post_type ===
                        'book_stack'
                      ? 'albums-outline'
                      : 'chatbubble-ellipses-outline'
                  }
                  size={14}
                  color={
                    colors.gold
                  }
                />

                <Text
                  style={
                    styles.activityMetaText
                  }
                >
                  {post.post_type ===
                  'review'
                    ? 'Review'
                    : post.post_type ===
                      'reading_update'
                    ? 'Reading update'
                    : post.post_type ===
                      'question'
                    ? 'Ask Readers'
                    : post.post_type ===
                      'book_stack'
                    ? 'Book Stack'
                    : 'Post'}
                </Text>
              </View>

              <Text
                style={
                  styles.activityBody
                }
                numberOfLines={6}
              >
                {
                  post.body
                }
              </Text>

              {post.post_type ===
                'book_stack' &&
              post.book_stack_id ? (
                <BookStackPostAttachment
                  stackId={
                    post.book_stack_id
                  }
                />
              ) : null}

              {post.book_title ? (
                <View
                  style={
                    styles.activityBook
                  }
                >
                  {post.book_cover_url ? (
                    <Image
                      source={{
                        uri:
                          post.book_cover_url,
                      }}
                      style={
                        styles.activityBookCover
                      }
                    />
                  ) : (
                    <View
                      style={
                        styles.activityBookCoverFallback
                      }
                    >
                      <Ionicons
                        name="book-outline"
                        size={18}
                        color={
                          colors.gold
                        }
                      />
                    </View>
                  )}

                  <View
                    style={
                      styles.activityBookCopy
                    }
                  >
                    <Text
                      style={
                        styles.activityBookTitle
                      }
                      numberOfLines={2}
                    >
                      {
                        post.book_title
                      }
                    </Text>

                    {post.book_authors?.length ? (
                      <Text
                        style={
                          styles.activityBookAuthor
                        }
                        numberOfLines={1}
                      >
                        {post.book_authors.join(
                          ', '
                        )}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </Pressable>
          )
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
                <Image
                  source={{
                    uri:
                      club.cover_url,
                  }}
                  style={
                    styles.clubCover
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
                router.push({
                  pathname:
                    '/stack/[id]',
                  params: {
                    id:
                      stack.id,
                  },
                })
              }
              style={({ pressed }) => [
                styles.stackTile,
                pressed &&
                  styles.pressed,
              ]}
            >
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

  return (
    <TabScreen
      scroll
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
            <Image
              source={{
                uri:
                  profile.avatar_url,
              }}
              style={
                styles.avatarImage
              }
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
    topBar: {
      minHeight: 34,
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginBottom: 2,
    },

    topBarSpacer: {
      width: 36,
    },

    settingsButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems:
        'center',
      justifyContent:
        'center',
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

    stackTileVisual: {
      height: 145,
      alignItems:
        'center',
      justifyContent:
        'flex-start',
      overflow:
        'hidden',
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

    stackTileMeta: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 10,
      marginTop: 5,
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
