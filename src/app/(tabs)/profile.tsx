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

import {
  TabScreen,
} from '../../components/tab-screen';
import {
  COLORS,
} from '../../constants/novori-theme';
import {
  supabase,
} from '../../lib/supabase';
import {
  getUserBooks,
  UserBook,
} from '../../lib/user-books';

type ProfileTab =
  | 'books'
  | 'reviews'
  | 'clubs';

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export default function ProfileScreen() {
  const router = useRouter();

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<ProfileTab>(
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
    books,
    setBooks,
  ] =
    useState<UserBook[]>(
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
          const savedBooks =
            await getUserBooks();

          if (
            isMounted
          ) {
            setBooks(
              savedBooks
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

  const currentlyReadingBooks =
    books.filter(
      (book) =>
        book.status ===
        'reading'
    );

  const readBooks =
    books.filter(
      (book) =>
        book.status ===
        'read'
    );

  const dnfBooks =
    books.filter(
      (book) =>
        book.status ===
        'dnf'
    );

  const publicBooks = [
    ...readBooks,
    ...dnfBooks,
  ];

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
    currentlyReadingBooks.length +
    publicBooks.length;

  const previewBooks =
    currentlyReadingBooks.slice(
      0,
      3
    );

  const remainingReadingCount =
    Math.max(
      currentlyReadingBooks.length -
        previewBooks.length,
      0
    );

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

  function openCurrentlyReading() {
    router.push(
      '/currently-reading'
    );
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
      book.status ===
      'read'
    ) {
      return 'Read';
    }

    if (
      book.status ===
      'dnf'
    ) {
      return 'DNF';
    }

    if (
      book.status ===
      'reading'
    ) {
      return 'Reading';
    }

    return 'Want to Read';
  }

  function renderCurrentlyReading() {
    return (
      <View
        style={
          styles.readingSection
        }
      >
        <View
          style={
            styles.sectionHeader
          }
        >
          <View>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Currently Reading
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              What you’re into right now.
            </Text>
          </View>

          {currentlyReadingBooks.length >
          0 ? (
            <Pressable
              onPress={
                openCurrentlyReading
              }
              hitSlop={
                10
              }
              style={({
                pressed,
              }) => [
                styles.sectionActionRow,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.sectionAction
                }
              >
                See all
              </Text>

              <Ionicons
                name="chevron-forward"
                size={
                  16
                }
                color={
                  COLORS.softGold
                }
              />
            </Pressable>
          ) : null}
        </View>

        {previewBooks.length >
        0 ? (
          <View
            style={
              styles.readingPreviewRow
            }
          >
            {previewBooks.map(
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
                    styles.readingPreviewBook,
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
                        styles.readingPreviewCover
                      }
                    />
                  ) : (
                    <View
                      style={
                        styles.readingPreviewPlaceholder
                      }
                    >
                      <Ionicons
                        name="book-outline"
                        size={
                          24
                        }
                        color={
                          COLORS.gold
                        }
                      />
                    </View>
                  )}

                  <Text
                    style={
                      styles.readingPreviewTitle
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {
                      book.title
                    }
                  </Text>
                </Pressable>
              )
            )}

            {remainingReadingCount >
            0 ? (
              <Pressable
                onPress={
                  openCurrentlyReading
                }
                style={({
                  pressed,
                }) => [
                  styles.moreReadingCard,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <View
                  style={
                    styles.moreReadingBadge
                  }
                >
                  <Text
                    style={
                      styles.moreReadingBadgeText
                    }
                  >
                    +
                    {
                      remainingReadingCount
                    }
                  </Text>
                </View>

                <Text
                  style={
                    styles.moreReadingText
                  }
                >
                  More
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View
            style={
              styles.emptyReading
            }
          >
            <View
              style={
                styles.emptyReadingIcon
              }
            >
              <Ionicons
                name="book-outline"
                size={
                  23
                }
                color={
                  COLORS.gold
                }
              />
            </View>

            <View
              style={
                styles.emptyReadingText
              }
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                Nothing here yet
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Books you mark as Reading will appear here.
              </Text>
            </View>
          </View>
        )}
      </View>
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
            Books you finish or mark as DNF will appear on your profile.
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
                        COLORS.gold
                      }
                    />
                  </View>
                )}

                {book.status ===
                'dnf' ? (
                  <View
                    style={
                      styles.gridDnfBadge
                    }
                  >
                    <Text
                      style={
                        styles.gridDnfBadgeText
                      }
                    >
                      DNF
                    </Text>
                  </View>
                ) : null}
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
                      COLORS.gold
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
                        COLORS.gold
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
                            COLORS.gold
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

  function renderTabContent() {
    if (
      activeTab ===
      'reviews'
    ) {
      return renderReviewsTab();
    }

    if (
      activeTab ===
      'clubs'
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
            Your clubs will show up here.
          </Text>

          <Text
            style={
              styles.emptyActivityText
            }
          >
            Clubs you join or create will appear on your profile.
          </Text>
        </View>
      );
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
              COLORS.text
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
          <Image
            source={{
              uri:
                profile.avatar_url,
            }}
            style={
              styles.avatarImage
            }
          />
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
          onPress={() =>
            setActiveTab(
              'books'
            )
          }
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
          onPress={() =>
            Alert.alert(
              'Followers',
              'Your followers list will open here.'
            )
          }
        >
          <Text
            style={
              styles.statNumber
            }
          >
            0
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
          onPress={() =>
            Alert.alert(
              'Following',
              'The readers you follow will open here.'
            )
          }
        >
          <Text
            style={
              styles.statNumber
            }
          >
            0
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

      {
        renderCurrentlyReading()
      }

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
          label="Books"
          icon="book-outline"
          active={
            activeTab ===
            'books'
          }
          onPress={() =>
            setActiveTab(
              'books'
            )
          }
        />

        <ProfileTabButton
          label="Reviews"
          icon="star-outline"
          active={
            activeTab ===
            'reviews'
          }
          onPress={() =>
            setActiveTab(
              'reviews'
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

      {
        renderTabContent()
      }
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
            ? COLORS.gold
            : COLORS.mutedText
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

const styles =
  StyleSheet.create({
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
        COLORS.elevated,
      borderWidth: 2,
      borderColor:
        COLORS.gold,
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
        COLORS.gold,
      backgroundColor:
        COLORS.elevated,
    },

    avatarText: {
      color:
        COLORS.gold,
      fontSize: 35,
      fontFamily:
        'Inter_700Bold',
    },

    name: {
      color:
        COLORS.text,
      fontSize: 24,
      fontFamily:
        'PlayfairDisplay_700Bold',
      marginTop: 15,
    },

    username: {
      color:
        COLORS.mutedText,
      fontSize: 14,
      fontFamily:
        'Inter_400Regular',
      marginTop: 4,
    },

    bio: {
      color:
        COLORS.secondaryText,
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
        COLORS.text,
      fontSize: 20,
      fontFamily:
        'Inter_700Bold',
    },

    statLabel: {
      color:
        COLORS.mutedText,
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
        COLORS.border,
      backgroundColor:
        COLORS.surface,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    actionButtonText: {
      color:
        COLORS.text,
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
        COLORS.border,
      marginVertical: 18,
    },

    readingSection: {
      width: '100%',
    },

    sectionHeader: {
      flexDirection:
        'row',
      alignItems:
        'flex-end',
      justifyContent:
        'space-between',
      marginBottom: 11,
      gap: 12,
    },

    sectionTitle: {
      color:
        COLORS.text,
      fontSize: 20,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
    },

    sectionSubtitle: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      marginTop: 3,
    },

    sectionActionRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingVertical: 4,
    },

    sectionAction: {
      color:
        COLORS.softGold,
      fontSize: 12,
      fontFamily:
        'Inter_600SemiBold',
    },

    readingPreviewRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      gap: 12,
    },

    readingPreviewBook: {
      width: 76,
    },

    readingPreviewCover: {
      width: 76,
      height: 112,
      borderRadius: 8,
      backgroundColor:
        COLORS.elevated,
    },

    readingPreviewPlaceholder: {
      width: 76,
      height: 112,
      borderRadius: 8,
      backgroundColor:
        COLORS.elevated,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    readingPreviewTitle: {
      color:
        COLORS.secondaryText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 10,
      marginTop: 6,
    },

    moreReadingCard: {
      width: 64,
      alignItems:
        'center',
      paddingTop: 27,
    },

    moreReadingBadge: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor:
        COLORS.elevated,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    moreReadingBadgeText: {
      color:
        COLORS.softGold,
      fontSize: 15,
      fontFamily:
        'Inter_700Bold',
    },

    moreReadingText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 10,
      marginTop: 7,
    },

    emptyReading: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 14,
      padding: 14,
    },

    emptyReadingIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    emptyReadingText: {
      flex: 1,
      marginLeft: 13,
    },

    emptyTitle: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
    },

    emptyText: {
      color:
        COLORS.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      lineHeight: 18,
      marginTop: 3,
    },

    profileTabs: {
      flexDirection:
        'row',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
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
        COLORS.elevated,
    },

    profileTabText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12,
    },

    profileTabTextActive: {
      color:
        COLORS.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12,
    },

    emptyActivity: {
      alignItems:
        'center',
      paddingVertical: 46,
      paddingHorizontal: 24,
    },

    emptyActivityTitle: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      fontSize: 19,
      textAlign:
        'center',
    },

    emptyActivityText: {
      color:
        COLORS.mutedText,
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
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
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
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    gridDnfBadge: {
      position:
        'absolute',
      left: 6,
      bottom: 6,
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 4,
      backgroundColor:
        COLORS.background,
      borderWidth: 1,
      borderColor:
        COLORS.danger,
    },

    gridDnfBadgeText: {
      color:
        COLORS.danger,
      fontFamily:
        'Inter_700Bold',
      fontSize: 8,
      letterSpacing: 0.4,
    },

    gridBookTitle: {
      color:
        COLORS.text,
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
        COLORS.gold,
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
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
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
        COLORS.elevated,
      marginRight: 11,
    },

    reviewCoverPlaceholder: {
      width: 44,
      height: 66,
      borderRadius: 6,
      backgroundColor:
        COLORS.elevated,
      borderWidth: 1,
      borderColor:
        COLORS.border,
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
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
      lineHeight: 19,
    },

    reviewBookAuthor: {
      color:
        COLORS.secondaryText,
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
        COLORS.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
    },

    reviewStatus: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 11,
      marginLeft: 4,
    },

    reviewText: {
      color:
        COLORS.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      lineHeight: 20,
      marginTop: 12,
    },

    ratingOnlyText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      fontStyle:
        'italic',
      marginTop: 12,
    },
  });
