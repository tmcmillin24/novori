import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CLUB_GENRES,
  ClubGenreKey,
  getClubGenreLabel,
} from '../../constants/club-genres';
import { COLORS } from '../../constants/novori-theme';
import {
  ClubWithMembership,
  getDiscoverClubs,
  getMyClubs,
  searchClubs,
} from '../../lib/clubs';
import {
  FeedPost,
  getHomeFeed,
} from '../../lib/feed';
import {
  getUnreadNotificationCount,
} from '../../lib/notifications';

type HomeSection =
  | 'feed'
  | 'clubs';

export default function HomeScreen() {
  const router = useRouter();

  const [activeSection, setActiveSection] =
    useState<HomeSection>('feed');

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [
    myClubs,
    setMyClubs,
  ] =
    useState<ClubWithMembership[]>([]);

  const [
    discoverClubs,
    setDiscoverClubs,
  ] =
    useState<ClubWithMembership[]>([]);

  const [
    clubsLoading,
    setClubsLoading,
  ] =
    useState(true);

  const [
    feedPosts,
    setFeedPosts,
  ] =
    useState<FeedPost[]>([]);

  const [
    feedLoading,
    setFeedLoading,
  ] =
    useState(true);

  const [
    feedError,
    setFeedError,
  ] =
    useState('');

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    clubSearch,
    setClubSearch,
  ] =
    useState('');

  const [
    clubSearchResults,
    setClubSearchResults,
  ] =
    useState<ClubWithMembership[]>([]);

  const [
    clubSearchLoading,
    setClubSearchLoading,
  ] =
    useState(false);

  const [
    clubSearchError,
    setClubSearchError,
  ] =
    useState('');

  const [
    activeClubGenre,
    setActiveClubGenre,
  ] =
    useState<
      ClubGenreKey | 'all'
    >('all');

  const loadHomeData =
    useCallback(
      async (
        showClubLoader =
          false
      ) => {
        if (showClubLoader) {
          setClubsLoading(true);
          setFeedLoading(true);
        }

        const results =
          await Promise.allSettled([
            getUnreadNotificationCount(),
            getMyClubs(),
            getDiscoverClubs(),
            getHomeFeed(),
          ]);

        const [
          unreadResult,
          myClubsResult,
          discoverResult,
          feedResult,
        ] = results;

        if (
          unreadResult.status ===
          'fulfilled'
        ) {
          setUnreadCount(
            unreadResult.value
          );
        } else {
          console.error(
            'Could not load unread notification count:',
            unreadResult.reason
          );
        }

        if (
          myClubsResult.status ===
          'fulfilled'
        ) {
          setMyClubs(
            myClubsResult.value
          );
        } else {
          console.error(
            'Could not load your clubs:',
            myClubsResult.reason
          );
        }

        if (
          discoverResult.status ===
          'fulfilled'
        ) {
          setDiscoverClubs(
            discoverResult.value
          );
        } else {
          console.error(
            'Could not load discover clubs:',
            discoverResult.reason
          );
        }

        if (
          feedResult.status ===
          'fulfilled'
        ) {
          setFeedPosts(
            feedResult.value
          );
          setFeedError(
            ''
          );
        } else {
          console.error(
            'Could not load Home feed:',
            feedResult.reason
          );
          setFeedError(
            'Could not load your feed.'
          );
        }

        if (showClubLoader) {
          setClubsLoading(false);
          setFeedLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    const normalized =
      clubSearch.trim();

    if (!normalized) {
      setClubSearchResults(
        []
      );

      setClubSearchError(
        ''
      );

      setClubSearchLoading(
        false
      );

      return;
    }

    let active =
      true;

    const timer =
      setTimeout(
        async () => {
          try {
            setClubSearchLoading(
              true
            );

            setClubSearchError(
              ''
            );

            const results =
              await searchClubs(
                normalized
              );

            if (
              active
            ) {
              setClubSearchResults(
                results
              );
            }
          } catch (
            error
          ) {
            console.error(
              'Could not search clubs:',
              error
            );

            if (
              active
            ) {
              setClubSearchResults(
                []
              );

              setClubSearchError(
                'Could not search clubs.'
              );
            }
          } finally {
            if (
              active
            ) {
              setClubSearchLoading(
                false
              );
            }
          }
        },
        300
      );

    return () => {
      active =
        false;

      clearTimeout(
        timer
      );
    };
  }, [
    clubSearch,
  ]);

  useFocusEffect(
    useCallback(() => {
      loadHomeData(true);
    }, [loadHomeData])
  );

  async function handleRefresh() {
    try {
      setRefreshing(true);
      await loadHomeData(false);
    } finally {
      setRefreshing(false);
    }
  }

  function openClub(
    clubId: string
  ) {
    router.push({
      pathname:
        '/club/[id]',
      params: {
        id: clubId,
      },
    });
  }

  function openReader(
    readerId: string
  ) {
    router.push({
      pathname:
        '/reader/[id]',
      params: {
        id:
          readerId,
      },
    });
  }

  function renderClubCard(
    club:
      ClubWithMembership,
    compact = false
  ) {
    const initial =
      club.name
        .charAt(0)
        .toUpperCase();

    return (
      <Pressable
        key={club.id}
        onPress={() =>
          openClub(
            club.id
          )
        }
        style={({ pressed }) => [
          compact
            ? styles.compactClubCard
            : styles.clubCard,
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
              compact
                ? styles.compactClubImage
                : styles.clubImage
            }
          />
        ) : (
          <View
            style={
              compact
                ? styles.compactClubImageFallback
                : styles.clubImageFallback
            }
          >
            <Text
              style={
                compact
                  ? styles.compactClubInitial
                  : styles.clubInitial
              }
            >
              {initial}
            </Text>
          </View>
        )}

        <View
          style={
            styles.clubCardCopy
          }
        >
          <View
            style={
              styles.clubMetaRow
            }
          >
            <Ionicons
              name={
                club.privacy ===
                'public'
                  ? 'earth-outline'
                  : 'lock-closed-outline'
              }
              size={12}
              color={
                COLORS.softGold
              }
            />

            <Text
              style={
                styles.clubMetaText
              }
            >
              {club.privacy ===
              'public'
                ? 'Public'
                : 'Private'}
            </Text>

            <Text
              style={
                styles.clubMetaDot
              }
            >
              •
            </Text>

            <Text
              style={
                styles.clubMetaText
              }
            >
              {club.member_count}{' '}
              {club.member_count ===
              1
                ? 'member'
                : 'members'}
            </Text>
          </View>

          <Text
            style={
              styles.clubName
            }
            numberOfLines={
              1
            }
          >
            {club.name}
          </Text>

          {!compact &&
          club.description ? (
            <Text
              style={
                styles.clubDescription
              }
              numberOfLines={
                2
              }
            >
              {
                club.description
              }
            </Text>
          ) : null}

          {club.genres?.length ? (
            <View
              style={
                styles.clubGenreRow
              }
            >
              {club.genres
                .slice(
                  0,
                  compact
                    ? 1
                    : 2
                )
                .map(
                  (genre) => (
                    <View
                      key={
                        genre
                      }
                      style={
                        styles.clubGenreBadge
                      }
                    >
                      <Text
                        style={
                          styles.clubGenreBadgeText
                        }
                      >
                        {
                          getClubGenreLabel(
                            genre
                          )
                        }
                      </Text>
                    </View>
                  )
                )}

              {club.genres.length >
              (compact ? 1 : 2) ? (
                <Text
                  style={
                    styles.clubGenreMore
                  }
                >
                  +
                  {club.genres.length -
                    (compact
                      ? 1
                      : 2)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {club.membership_role ? (
            <View
              style={
                styles.membershipBadge
              }
            >
              <Text
                style={
                  styles.membershipBadgeText
                }
              >
                {club.membership_role ===
                'owner'
                  ? 'Owner'
                  : club.membership_role ===
                    'admin'
                  ? 'Admin'
                  : 'Member'}
              </Text>
            </View>
          ) : null}
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={
            COLORS.mutedText
          }
        />
      </Pressable>
    );
  }

  function formatFeedTime(
    createdAt: string
  ) {
    const created =
      new Date(
        createdAt
      );

    const diffMs =
      Date.now() -
      created.getTime();

    const minutes =
      Math.max(
        0,
        Math.floor(
          diffMs /
            60000
        )
      );

    if (
      minutes < 1
    ) {
      return 'now';
    }

    if (
      minutes < 60
    ) {
      return `${minutes}m`;
    }

    const hours =
      Math.floor(
        minutes /
          60
      );

    if (
      hours < 24
    ) {
      return `${hours}h`;
    }

    const days =
      Math.floor(
        hours /
          24
      );

    if (
      days < 7
    ) {
      return `${days}d`;
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

  function renderFeedPost(
    post:
      FeedPost
  ) {
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

    const clubInitial =
      post.club_name
        ?.charAt(0)
        .toUpperCase() ||
      'C';

    return (
      <View
        key={
          post.id
        }
        style={
          styles.feedPostCard
        }
      >
        <View
          style={
            styles.feedPostHeader
          }
        >
          <Pressable
            onPress={() =>
              openReader(
                post.author_id
              )
            }
            style={({ pressed }) => [
              pressed &&
                styles.pressed,
            ]}
          >
            {post.author_avatar_url ? (
              <Image
                source={{
                  uri:
                    post.author_avatar_url,
                }}
                style={
                  styles.feedAvatar
                }
              />
            ) : (
              <View
                style={
                  styles.feedAvatarFallback
                }
              >
                <Text
                  style={
                    styles.feedAvatarText
                  }
                >
                  {initial}
                </Text>
              </View>
            )}
          </Pressable>

          <View
            style={
              styles.feedAuthorCopy
            }
          >
            <View
              style={
                styles.feedAuthorLine
              }
            >
              <Pressable
                onPress={() =>
                  openReader(
                    post.author_id
                  )
                }
                style={({ pressed }) => [
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.feedAuthorName
                  }
                  numberOfLines={
                    1
                  }
                >
                  {displayName}
                </Text>
              </Pressable>

              {username ? (
                <Text
                  style={
                    styles.feedUsername
                  }
                  numberOfLines={
                    1
                  }
                >
                  {username}
                </Text>
              ) : null}

              <Text
                style={
                  styles.feedTime
                }
              >
                ·{' '}
                {formatFeedTime(
                  post.created_at
                )}
              </Text>
            </View>

            {post.club_id &&
            post.club_name ? (
              <Pressable
                onPress={() =>
                  openClub(
                    post.club_id!
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.feedClubLine,
                  pressed &&
                    styles.pressed,
                ]}
              >
                {post.club_cover_url ? (
                  <Image
                    source={{
                      uri:
                        post.club_cover_url,
                    }}
                    style={
                      styles.feedClubIcon
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.feedClubIconFallback
                    }
                  >
                    <Text
                      style={
                        styles.feedClubIconText
                      }
                    >
                      {
                        clubInitial
                      }
                    </Text>
                  </View>
                )}

                <Text
                  style={
                    styles.feedClubText
                  }
                  numberOfLines={
                    1
                  }
                >
                  in{' '}
                  {
                    post.club_name
                  }
                </Text>
              </Pressable>
            ) : (
              <Text
                style={
                  styles.feedAudienceText
                }
              >
                posted to their profile
              </Text>
            )}
          </View>
        </View>

        <Text
          style={
            styles.feedBody
          }
        >
          {post.body}
        </Text>

        {post.book_title ? (
          <View
            style={
              styles.feedBookCard
            }
          >
            {post.book_cover_url ? (
              <Image
                source={{
                  uri:
                    post.book_cover_url,
                }}
                style={
                  styles.feedBookCover
                }
              />
            ) : (
              <View
                style={
                  styles.feedBookCoverFallback
                }
              >
                <Ionicons
                  name="book-outline"
                  size={
                    19
                  }
                  color={
                    COLORS.gold
                  }
                />
              </View>
            )}

            <View
              style={
                styles.feedBookCopy
              }
            >
              <Text
                style={
                  styles.feedBookTitle
                }
                numberOfLines={
                  2
                }
              >
                {
                  post.book_title
                }
              </Text>

              {post.rating ? (
                <Text
                  style={
                    styles.feedBookRating
                  }
                >
                  ★{' '}
                  {
                    post.rating
                  }
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View
          style={
            styles.feedPostFooter
          }
        >
          <View
            style={
              styles.feedPostType
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
                  : 'chatbubble-ellipses-outline'
              }
              size={
                14
              }
              color={
                COLORS.mutedText
              }
            />

            <Text
              style={
                styles.feedPostTypeText
              }
            >
              {post.post_type ===
              'review'
                ? 'Review'
                : post.post_type ===
                  'reading_update'
                ? 'Reading update'
                : 'Post'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  function renderFeed() {
    if (
      feedLoading
    ) {
      return (
        <View
          style={
            styles.feedLoading
          }
        >
          <ActivityIndicator
            size="small"
            color={
              COLORS.gold
            }
          />
        </View>
      );
    }

    if (
      feedError
    ) {
      return (
        <View
          style={
            styles.feedEmptyCard
          }
        >
          <Ionicons
            name="cloud-offline-outline"
            size={
              27
            }
            color={
              COLORS.mutedText
            }
          />

          <Text
            style={
              styles.feedEmptyTitle
            }
          >
            Feed unavailable
          </Text>

          <Text
            style={
              styles.feedEmptyText
            }
          >
            {feedError}
          </Text>

          <Pressable
            onPress={() =>
              loadHomeData(
                true
              )
            }
            style={({ pressed }) => [
              styles.feedActionButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.feedActionButtonText
              }
            >
              Try Again
            </Text>
          </Pressable>
        </View>
      );
    }

    if (
      feedPosts.length ===
      0
    ) {
      return (
        <View
          style={
            styles.feedEmptyCard
          }
        >
          <View
            style={
              styles.feedEmptyIcon
            }
          >
            <Ionicons
              name="newspaper-outline"
              size={
                27
              }
              color={
                COLORS.gold
              }
            />
          </View>

          <Text
            style={
              styles.feedEmptyTitle
            }
          >
            Your feed is ready.
          </Text>

          <Text
            style={
              styles.feedEmptyText
            }
          >
            Posts from readers you follow and clubs you’ve joined will appear here. You can also make the first post yourself.
          </Text>

          <Pressable
            onPress={() =>
              router.push(
                '/create-post'
              )
            }
            style={({ pressed }) => [
              styles.feedActionButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="add"
              size={
                17
              }
              color={
                COLORS.background
              }
            />

            <Text
              style={
                styles.feedActionButtonText
              }
            >
              Create Post
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View
        style={
          styles.feedList
        }
      >
        <View
          style={
            styles.feedHeadingRow
          }
        >
          <View>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Your Feed
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              Readers you follow and clubs you belong to.
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.push(
                '/create-post'
              )
            }
            style={({ pressed }) => [
              styles.feedComposeButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="add"
              size={
                17
              }
              color={
                COLORS.background
              }
            />

            <Text
              style={
                styles.feedComposeButtonText
              }
            >
              Post
            </Text>
          </Pressable>
        </View>

        {feedPosts.map(
          renderFeedPost
        )}
      </View>
    );
  }

  function renderClubs() {
    if (
      clubsLoading
    ) {
      return (
        <View
          style={
            styles.clubsLoading
          }
        >
          <ActivityIndicator
            size="small"
            color={
              COLORS.gold
            }
          />
        </View>
      );
    }

    const isSearching =
      Boolean(
        clubSearch.trim()
      );

    const filteredDiscoverClubs =
      activeClubGenre ===
      'all'
        ? discoverClubs
        : discoverClubs.filter(
            (club) =>
              club.genres?.includes(
                activeClubGenre
              )
          );

    return (
      <View>
        <View
          style={
            styles.clubSearchWrap
          }
        >
          <Ionicons
            name="search-outline"
            size={19}
            color={
              COLORS.mutedText
            }
          />

          <TextInput
            value={
              clubSearch
            }
            onChangeText={
              setClubSearch
            }
            placeholder="Search clubs by name or ID"
            placeholderTextColor={
              COLORS.mutedText
            }
            autoCapitalize="none"
            autoCorrect={
              false
            }
            returnKeyType="search"
            style={
              styles.clubSearchInput
            }
          />

          {clubSearchLoading ? (
            <ActivityIndicator
              size="small"
              color={
                COLORS.gold
              }
            />
          ) : clubSearch ? (
            <Pressable
              onPress={() =>
                setClubSearch(
                  ''
                )
              }
              hitSlop={
                8
              }
              style={({
                pressed,
              }) => [
                styles.clubSearchClear,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="close-circle"
                size={
                  19
                }
                color={
                  COLORS.mutedText
                }
              />
            </Pressable>
          ) : null}
        </View>

        <Text
          style={
            styles.clubSearchHint
          }
        >
          Search public clubs by name. Exact club IDs also work.
        </Text>

        {isSearching ? (
          <View>
            <View
              style={
                styles.searchResultsHeader
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Search Results
              </Text>

              {!clubSearchLoading &&
              !clubSearchError ? (
                <Text
                  style={
                    styles.sectionSubtitle
                  }
                >
                  {clubSearchResults.length}{' '}
                  {clubSearchResults.length ===
                  1
                    ? 'club'
                    : 'clubs'}
                </Text>
              ) : null}
            </View>

            {clubSearchError ? (
              <View
                style={
                  styles.searchEmpty
                }
              >
                <Ionicons
                  name="cloud-offline-outline"
                  size={
                    25
                  }
                  color={
                    COLORS.mutedText
                  }
                />

                <Text
                  style={
                    styles.searchEmptyTitle
                  }
                >
                  Search unavailable
                </Text>

                <Text
                  style={
                    styles.searchEmptyText
                  }
                >
                  {clubSearchError}
                </Text>
              </View>
            ) : clubSearchLoading ? (
              <View
                style={
                  styles.searchLoading
                }
              >
                <ActivityIndicator
                  size="small"
                  color={
                    COLORS.gold
                  }
                />
              </View>
            ) : clubSearchResults.length >
              0 ? (
              <View
                style={
                  styles.clubList
                }
              >
                {clubSearchResults.map(
                  (club) =>
                    renderClubCard(
                      club
                    )
                )}
              </View>
            ) : (
              <View
                style={
                  styles.searchEmpty
                }
              >
                <Ionicons
                  name="search-outline"
                  size={
                    25
                  }
                  color={
                    COLORS.mutedText
                  }
                />

                <Text
                  style={
                    styles.searchEmptyTitle
                  }
                >
                  No clubs found
                </Text>

                <Text
                  style={
                    styles.searchEmptyText
                  }
                >
                  Try a different club name or paste an exact club ID.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <>
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
              Your Clubs
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              Communities you’ve joined or created.
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.push(
                '/create-club'
              )
            }
            style={({ pressed }) => [
              styles.createClubButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="add"
              size={17}
              color={
                COLORS.background
              }
            />

            <Text
              style={
                styles.createClubButtonText
              }
            >
              Create
            </Text>
          </Pressable>
        </View>

        {myClubs.length >
        0 ? (
          <View
            style={
              styles.clubList
            }
          >
            {myClubs.map(
              (club) =>
                renderClubCard(
                  club,
                  true
                )
            )}
          </View>
        ) : (
          <Pressable
            onPress={() =>
              router.push(
                '/create-club'
              )
            }
            style={({ pressed }) => [
              styles.emptyClubsCard,
              pressed &&
                styles.pressed,
            ]}
          >
            <View
              style={
                styles.emptyClubsIcon
              }
            >
              <Ionicons
                name="people-outline"
                size={24}
                color={
                  COLORS.gold
                }
              />
            </View>

            <View
              style={
                styles.emptyClubsCopy
              }
            >
              <Text
                style={
                  styles.emptyClubsTitle
                }
              >
                Start your first club
              </Text>

              <Text
                style={
                  styles.emptyClubsText
                }
              >
                Build a reading community around a genre, author, series, or shared interest.
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={
                COLORS.mutedText
              }
            />
          </Pressable>
        )}

        <View
          style={
            styles.discoverHeader
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Discover Clubs
          </Text>

          <Text
            style={
              styles.sectionSubtitle
            }
          >
            Public communities open to new readers.
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.clubGenreFilterRow
          }
          style={
            styles.clubGenreFilterScroll
          }
        >
          <Pressable
            onPress={() =>
              setActiveClubGenre(
                'all'
              )
            }
            style={[
              styles.clubGenreFilterChip,
              activeClubGenre ===
                'all' &&
                styles.clubGenreFilterChipActive,
            ]}
          >
            <Text
              style={[
                styles.clubGenreFilterText,
                activeClubGenre ===
                  'all' &&
                  styles.clubGenreFilterTextActive,
              ]}
            >
              All Genres
            </Text>
          </Pressable>

          {CLUB_GENRES.map(
            (genre) => {
              const active =
                activeClubGenre ===
                genre.key;

              return (
                <Pressable
                  key={
                    genre.key
                  }
                  onPress={() =>
                    setActiveClubGenre(
                      genre.key
                    )
                  }
                  style={[
                    styles.clubGenreFilterChip,
                    active &&
                      styles.clubGenreFilterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.clubGenreFilterText,
                      active &&
                        styles.clubGenreFilterTextActive,
                    ]}
                  >
                    {genre.label}
                  </Text>
                </Pressable>
              );
            }
          )}
        </ScrollView>

        {filteredDiscoverClubs.length >
        0 ? (
          <View
            style={
              styles.clubList
            }
          >
            {filteredDiscoverClubs.map(
              (club) =>
                renderClubCard(
                  club
                )
            )}
          </View>
        ) : (
          <View
            style={
              styles.discoverEmpty
            }
          >
            <Ionicons
              name="compass-outline"
              size={26}
              color={
                COLORS.mutedText
              }
            />

            <Text
              style={
                styles.discoverEmptyTitle
              }
            >
              {activeClubGenre ===
              'all'
                ? 'No public clubs yet.'
                : `No ${getClubGenreLabel(
                    activeClubGenre
                  )} clubs yet.`}
            </Text>

            <Text
              style={
                styles.discoverEmptyText
              }
            >
              {activeClubGenre ===
              'all'
                ? 'When readers create public clubs, they’ll appear here.'
                : 'Try another genre or switch back to All Genres.'}
            </Text>
          </View>
        )}
          </>
        )}
      </View>
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
      <ScrollView
        style={
          styles.screen
        }
        contentContainerStyle={
          styles.scrollContent
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              handleRefresh
            }
            tintColor={
              COLORS.gold
            }
          />
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.content
          }
        >
          <View
            style={
              styles.topRow
            }
          >
            <View
              style={
                styles.brandBlock
              }
            >
              <Text
                style={
                  styles.logo
                }
              >
                Novori
              </Text>

              <Text
                style={
                  styles.slogan
                }
              >
                Read. Discuss. Belong.
              </Text>
            </View>

            <Pressable
              onPress={() =>
                router.push(
                  '/(tabs)/notifications'
                )
              }
              hitSlop={10}
              style={({
                pressed,
              }) => [
                styles.notificationButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name={
                  unreadCount >
                  0
                    ? 'notifications'
                    : 'notifications-outline'
                }
                size={24}
                color={
                  unreadCount >
                  0
                    ? COLORS.gold
                    : COLORS.text
                }
              />

              {unreadCount >
              0 ? (
                <View
                  style={
                    styles.notificationBadge
                  }
                >
                  <Text
                    style={
                      styles.notificationBadgeText
                    }
                  >
                    {unreadCount >
                    99
                      ? '99+'
                      : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <View
            style={
              styles.sectionSwitch
            }
          >
            <Pressable
              onPress={() =>
                setActiveSection(
                  'feed'
                )
              }
              style={[
                styles.sectionSwitchButton,
                activeSection ===
                  'feed' &&
                  styles.sectionSwitchButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.sectionSwitchText,
                  activeSection ===
                    'feed' &&
                    styles.sectionSwitchTextActive,
                ]}
              >
                Feed
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                setActiveSection(
                  'clubs'
                )
              }
              style={[
                styles.sectionSwitchButton,
                activeSection ===
                  'clubs' &&
                  styles.sectionSwitchButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.sectionSwitchText,
                  activeSection ===
                    'clubs' &&
                    styles.sectionSwitchTextActive,
                ]}
              >
                Clubs
              </Text>
            </Pressable>
          </View>

          {activeSection ===
          'feed'
            ? renderFeed()
            : renderClubs()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },
    screen: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingTop: 22,
      paddingBottom: 120,
    },
    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf:
        'center',
      paddingHorizontal: 20,
    },
    topRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
    },
    brandBlock: {
      flex: 1,
      marginTop: 2,
    },
    logo: {
      color:
        COLORS.gold,
      fontSize: 43,
      fontFamily:
        'PlayfairDisplay_700Bold',
      letterSpacing: 0.2,
    },
    slogan: {
      color:
        COLORS.secondaryText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 15,
      marginTop: 5,
      letterSpacing: 0.15,
    },
    notificationButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginTop: 4,
      marginLeft: 12,
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      position:
        'relative',
    },
    notificationBadge: {
      position:
        'absolute',
      top: -4,
      right: -5,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor:
        COLORS.gold,
      borderWidth: 2,
      borderColor:
        COLORS.background,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    notificationBadgeText: {
      color:
        COLORS.background,
      fontSize: 9,
      fontFamily:
        'Inter_700Bold',
      lineHeight: 12,
    },
    sectionSwitch: {
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
      marginTop: 24,
      marginBottom: 22,
    },
    sectionSwitchButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: 10,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    sectionSwitchButtonActive: {
      backgroundColor:
        COLORS.elevated,
    },
    sectionSwitchText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 13,
    },
    sectionSwitchTextActive: {
      color:
        COLORS.gold,
    },
    feedCard: {
      backgroundColor:
        COLORS.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      padding: 21,
    },
    eyebrow: {
      color:
        COLORS.softGold,
      fontSize: 11,
      fontFamily:
        'Inter_700Bold',
      letterSpacing: 1.4,
      marginBottom: 11,
    },
    cardTitle: {
      color:
        COLORS.text,
      fontSize: 24,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      lineHeight: 31,
    },
    cardText: {
      color:
        COLORS.secondaryText,
      fontSize: 15,
      fontFamily:
        'Inter_400Regular',
      lineHeight: 23,
      marginTop: 12,
    },
    clubSearchWrap: {
      minHeight: 48,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 15,
      paddingHorizontal: 13,
      gap: 9,
    },
    clubSearchInput: {
      flex: 1,
      color:
        COLORS.text,
      fontFamily:
        'Inter_400Regular',
      fontSize: 14,
      paddingVertical: 0,
    },
    clubSearchClear: {
      width: 28,
      height: 28,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    clubSearchHint: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      lineHeight: 15,
      marginTop: 6,
      marginBottom: 21,
      paddingHorizontal: 3,
    },
    searchResultsHeader: {
      marginBottom: 2,
    },
    searchLoading: {
      minHeight: 150,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    searchEmpty: {
      minHeight: 150,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 17,
      paddingHorizontal: 24,
      marginTop: 13,
    },
    searchEmptyTitle: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
      marginTop: 9,
    },
    searchEmptyText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      lineHeight: 16,
      textAlign:
        'center',
      marginTop: 4,
    },
    feedLoading: {
      minHeight: 220,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    feedList: {
      gap: 12,
    },
    feedHeadingRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
      gap: 14,
      marginBottom: 2,
    },
    feedComposeButton: {
      minHeight: 37,
      paddingHorizontal:
        12,
      borderRadius:
        12,
      backgroundColor:
        COLORS.gold,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 5,
    },
    feedComposeButtonText: {
      color:
        COLORS.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 12,
    },
    feedEmptyCard: {
      minHeight: 240,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 18,
      paddingHorizontal:
        26,
      paddingVertical:
        30,
    },
    feedEmptyIcon: {
      width: 54,
      height: 54,
      borderRadius: 17,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom: 12,
    },
    feedEmptyTitle: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 21,
      textAlign:
        'center',
      marginTop: 9,
    },
    feedEmptyText: {
      color:
        COLORS.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      lineHeight: 18,
      textAlign:
        'center',
      maxWidth: 430,
      marginTop: 7,
    },
    feedActionButton: {
      minHeight: 40,
      borderRadius: 12,
      backgroundColor:
        COLORS.gold,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 5,
      paddingHorizontal:
        14,
      marginTop: 16,
    },
    feedActionButtonText: {
      color:
        COLORS.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 12,
    },
    feedPostCard: {
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 18,
      padding: 15,
    },
    feedPostHeader: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
    },
    feedAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        COLORS.elevated,
      marginRight: 11,
    },
    feedAvatarFallback: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },
    feedAvatarText: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 18,
    },
    feedAuthorCopy: {
      flex: 1,
      minWidth: 0,
      paddingTop: 2,
    },
    feedAuthorLine: {
      flexDirection:
        'row',
      alignItems:
        'center',
      flexWrap:
        'wrap',
      columnGap: 5,
    },
    feedAuthorName: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 13,
      maxWidth: '55%',
    },
    feedUsername: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      maxWidth: '28%',
    },
    feedTime: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
    },
    feedAudienceText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      marginTop: 4,
    },
    feedClubLine: {
      alignSelf:
        'flex-start',
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 5,
      marginTop: 4,
      maxWidth: '100%',
    },
    feedClubIcon: {
      width: 17,
      height: 17,
      borderRadius: 5,
      backgroundColor:
        COLORS.elevated,
    },
    feedClubIconFallback: {
      width: 17,
      height: 17,
      borderRadius: 5,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    feedClubIconText: {
      color:
        COLORS.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 8,
    },
    feedClubText: {
      color:
        COLORS.softGold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 10,
      flexShrink: 1,
    },
    feedBody: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_400Regular',
      fontSize: 14,
      lineHeight: 21,
      marginTop: 13,
    },
    feedBookCard: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.elevated,
      borderRadius: 13,
      padding: 9,
      marginTop: 13,
    },
    feedBookCover: {
      width: 39,
      height: 57,
      borderRadius: 6,
      backgroundColor:
        COLORS.surface,
      marginRight: 10,
    },
    feedBookCoverFallback: {
      width: 39,
      height: 57,
      borderRadius: 6,
      backgroundColor:
        COLORS.surface,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },
    feedBookCopy: {
      flex: 1,
    },
    feedBookTitle: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12,
      lineHeight: 17,
    },
    feedBookRating: {
      color:
        COLORS.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
      marginTop: 4,
    },
    feedPostFooter: {
      borderTopWidth: 1,
      borderTopColor:
        COLORS.border,
      marginTop: 13,
      paddingTop: 10,
    },
    feedPostType: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 5,
    },
    feedPostTypeText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 10,
    },
    clubsLoading: {
      minHeight: 220,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    sectionHeader: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
      gap: 14,
    },
    sectionTitle: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 21,
    },
    sectionSubtitle: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      lineHeight: 18,
      marginTop: 3,
    },
    createClubButton: {
      minHeight: 37,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor:
        COLORS.gold,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 5,
    },
    createClubButtonText: {
      color:
        COLORS.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 12,
    },
    clubList: {
      gap: 10,
      marginTop: 13,
    },
    compactClubCard: {
      minHeight: 76,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 16,
      padding: 11,
    },
    clubCard: {
      minHeight: 104,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 17,
      padding: 12,
    },
    compactClubImage: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor:
        COLORS.elevated,
      marginRight: 12,
    },
    compactClubImageFallback: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 12,
    },
    compactClubInitial: {
      color:
        COLORS.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 23,
    },
    clubImage: {
      width: 66,
      height: 66,
      borderRadius: 16,
      backgroundColor:
        COLORS.elevated,
      marginRight: 13,
    },
    clubImageFallback: {
      width: 66,
      height: 66,
      borderRadius: 16,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 13,
    },
    clubInitial: {
      color:
        COLORS.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 28,
    },
    clubCardCopy: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },
    clubMetaRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 4,
    },
    clubMetaText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 10,
    },
    clubMetaDot: {
      color:
        COLORS.mutedText,
      fontSize: 9,
    },
    clubName: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 15,
      marginTop: 4,
    },
    clubDescription: {
      color:
        COLORS.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4,
    },
    clubGenreRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      flexWrap:
        'wrap',
      gap: 5,
      marginTop: 6,
    },
    clubGenreBadge: {
      backgroundColor:
        COLORS.elevated,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    clubGenreBadgeText: {
      color:
        COLORS.softGold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 9,
    },
    clubGenreMore: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 9,
    },
    membershipBadge: {
      alignSelf:
        'flex-start',
      backgroundColor:
        COLORS.elevated,
      borderRadius: 9,
      paddingHorizontal: 7,
      paddingVertical: 3,
      marginTop: 5,
    },
    membershipBadgeText: {
      color:
        COLORS.softGold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 9,
    },
    emptyClubsCard: {
      minHeight: 96,
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 17,
      padding: 14,
      marginTop: 13,
    },
    emptyClubsIcon: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor:
        COLORS.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 12,
    },
    emptyClubsCopy: {
      flex: 1,
      paddingRight: 8,
    },
    emptyClubsTitle: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
    },
    emptyClubsText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      lineHeight: 16,
      marginTop: 3,
    },
    discoverHeader: {
      marginTop: 30,
    },
    clubGenreFilterScroll: {
      marginTop: 12,
      marginHorizontal:
        -20,
    },
    clubGenreFilterRow: {
      paddingHorizontal: 20,
      gap: 8,
    },
    clubGenreFilterChip: {
      minHeight: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      backgroundColor:
        COLORS.surface,
      paddingHorizontal: 12,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    clubGenreFilterChipActive: {
      borderColor:
        COLORS.gold,
      backgroundColor:
        COLORS.elevated,
    },
    clubGenreFilterText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 10,
    },
    clubGenreFilterTextActive: {
      color:
        COLORS.gold,
    },
    discoverEmpty: {
      alignItems:
        'center',
      backgroundColor:
        COLORS.surface,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      borderRadius: 17,
      paddingHorizontal: 24,
      paddingVertical: 28,
      marginTop: 13,
    },
    discoverEmptyTitle: {
      color:
        COLORS.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
      marginTop: 10,
    },
    discoverEmptyText: {
      color:
        COLORS.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      lineHeight: 16,
      textAlign:
        'center',
      marginTop: 4,
    },
    pressed: {
      opacity: 0.68,
    },
  });
