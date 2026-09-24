import { Ionicons } from '@expo/vector-icons';
import {
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import {
    useCallback,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    getClubGenreLabel,
} from '../../constants/club-genres';
import { NovoriColors } from '../../constants/novori-theme';
import { useNovoriTheme } from '../../context/theme-context';
import {
    ClubMember,
    ClubWithMembership,
    getClub,
    getClubMembers,
    joinClub,
    leaveClub,
} from '../../lib/clubs';
import {
    FeedPost,
    getClubPosts,
    PostVoteValue,
    togglePostVote,
} from '../../lib/feed';

function roleLabel(role: ClubMember['role']) {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'Member';
}

export default function ClubDetailScreen() {
  const router = useRouter();
  const params =
    useLocalSearchParams<{
      id: string;
    }>();

  const { colors } = useNovoriTheme();
  const styles = createStyles(colors);

  const [club, setClub] =
    useState<ClubWithMembership | null>(null);
  const [members, setMembers] =
    useState<ClubMember[]>([]);
  const [clubPosts, setClubPosts] =
    useState<FeedPost[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [membershipLoading, setMembershipLoading] =
    useState(false);
  const [
    votingPostId,
    setVotingPostId,
  ] =
    useState<string | null>(
      null
    );
  const [error, setError] =
    useState('');

  const clubId =
    typeof params.id === 'string'
      ? params.id
      : '';

  const loadClub = useCallback(
    async () => {
      if (!clubId) {
        setError(
          'This club could not be found.'
        );
        setLoading(false);
        return;
      }

      try {
        setError('');

        const [
          clubData,
          memberData,
          postData,
        ] = await Promise.all([
          getClub(clubId),
          getClubMembers(clubId),
          getClubPosts(clubId),
        ]);

        setClub(clubData);
        setMembers(memberData);
        setClubPosts(postData);
      } catch (loadError) {
        console.error(
          'Could not load club:',
          loadError
        );

        setError(
          'This club is unavailable or private.'
        );
      } finally {
        setLoading(false);
      }
    },
    [clubId]
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadClub();
    }, [loadClub])
  );

  async function handleJoin() {
    if (!club) return;

    if (club.privacy === 'private') {
      Alert.alert(
        'Private club',
        'Private clubs are invite-only. Club invitations are coming in the next Clubs pass.'
      );
      return;
    }

    try {
      setMembershipLoading(true);
      await joinClub(club.id);
      await loadClub();
    } catch (joinError) {
      console.error(
        'Could not join club:',
        joinError
      );

      Alert.alert(
        'Could not join club',
        'Please try again.'
      );
    } finally {
      setMembershipLoading(false);
    }
  }

  function confirmLeave() {
    if (!club) return;

    Alert.alert(
      'Leave Club',
      `Leave ${club.name}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: handleLeave,
        },
      ]
    );
  }

  async function handleLeave() {
    if (!club) return;

    try {
      setMembershipLoading(true);
      await leaveClub(club.id);
      await loadClub();
    } catch (leaveError) {
      console.error(
        'Could not leave club:',
        leaveError
      );

      Alert.alert(
        'Could not leave club',
        'Please try again.'
      );
    } finally {
      setMembershipLoading(false);
    }
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

  function formatPostTime(
    createdAt: string
  ) {
    const created =
      new Date(createdAt);

    const diffMs =
      Date.now() -
      created.getTime();

    const minutes =
      Math.max(
        0,
        Math.floor(
          diffMs / 60000
        )
      );

    if (minutes < 1) {
      return 'now';
    }

    if (minutes < 60) {
      return `${minutes}m`;
    }

    const hours =
      Math.floor(
        minutes / 60
      );

    if (hours < 24) {
      return `${hours}h`;
    }

    const days =
      Math.floor(
        hours / 24
      );

    if (days < 7) {
      return `${days}d`;
    }

    return created.toLocaleDateString(
      undefined,
      {
        month: 'short',
        day: 'numeric',
      }
    );
  }

  async function handlePostVote(
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

      setClubPosts(
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
    } catch (
      error
    ) {
      console.error(
        'Could not update post vote:',
        error
      );

      Alert.alert(
        'Could not vote',
        'Please try again.'
      );
    } finally {
      setVotingPostId(
        null
      );
    }
  }

  function renderClubPost(
    post: FeedPost
  ) {
    const displayName =
      post.author_display_name?.trim() ||
      post.author_username?.trim() ||
      'Novori Reader';

    const username =
      post.author_username?.trim()
        ? `@${post.author_username.trim()}`
        : '';

    const authorInitial =
      displayName
        .charAt(0)
        .toUpperCase();

    return (
      <View
        key={post.id}
        style={styles.postCard}
      >
        <Pressable
          onPress={() =>
            openReader(
              post.author_id
            )
          }
          style={({ pressed }) => [
            styles.postHeader,
            pressed &&
              styles.pressed,
          ]}
        >
          {post.author_avatar_url ? (
            <Image
              source={{
                uri: post.author_avatar_url,
              }}
              style={styles.postAvatar}
            />
          ) : (
            <View
              style={styles.postAvatarFallback}
            >
              <Text
                style={styles.postAvatarText}
              >
                {authorInitial}
              </Text>
            </View>
          )}

          <View style={styles.postAuthorCopy}>
            <View style={styles.postAuthorRow}>
              <Text
                style={styles.postAuthorName}
                numberOfLines={1}
              >
                {displayName}
              </Text>

              <Text style={styles.postTime}>
                · {formatPostTime(post.created_at)}
              </Text>
            </View>

            {username ? (
              <Text
                style={styles.postUsername}
                numberOfLines={1}
              >
                {username}
              </Text>
            ) : null}
          </View>
        </Pressable>

        <Text style={styles.postBody}>
          {post.body}
        </Text>

        {post.book_title ? (
          <View style={styles.postBookCard}>
            {post.book_cover_url ? (
              <Image
                source={{
                  uri: post.book_cover_url,
                }}
                style={styles.postBookCover}
              />
            ) : (
              <View
                style={
                  styles.postBookCoverFallback
                }
              >
                <Ionicons
                  name="book-outline"
                  size={18}
                  color={colors.gold}
                />
              </View>
            )}

            <View style={styles.postBookCopy}>
              <Text
                style={styles.postBookTitle}
                numberOfLines={2}
              >
                {post.book_title}
              </Text>

              {post.rating ? (
                <Text
                  style={styles.postBookRating}
                >
                  ★ {post.rating}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View
          style={
            styles.postVoteRow
          }
        >
          <Pressable
            disabled={
              votingPostId ===
              post.id
            }
            onPress={() =>
              handlePostVote(
                post.id,
                1
              )
            }
            hitSlop={
              8
            }
            style={({ pressed }) => [
              styles.postVoteButton,
              post.viewer_vote ===
                1 &&
                styles.postVoteButtonActive,
              pressed &&
                styles.pressed,
              votingPostId ===
                post.id &&
                styles.postVoteButtonDisabled,
            ]}
          >
            <Ionicons
              name={
                post.viewer_vote ===
                1
                  ? 'arrow-up-circle'
                  : 'arrow-up-circle-outline'
              }
              size={
                20
              }
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
              styles.postVoteScore,
              post.viewer_vote !==
                0 &&
                styles.postVoteScoreActive,
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
            onPress={() =>
              handlePostVote(
                post.id,
                -1
              )
            }
            hitSlop={
              8
            }
            style={({ pressed }) => [
              styles.postVoteButton,
              post.viewer_vote ===
                -1 &&
                styles.postVoteButtonActive,
              pressed &&
                styles.pressed,
              votingPostId ===
                post.id &&
                styles.postVoteButtonDisabled,
            ]}
          >
            <Ionicons
              name={
                post.viewer_vote ===
                -1
                  ? 'arrow-down-circle'
                  : 'arrow-down-circle-outline'
              }
              size={
                20
              }
              color={
                post.viewer_vote ===
                -1
                  ? colors.gold
                  : colors.mutedText
              }
            />
          </Pressable>
        </View>
      </View>
    );
  }

  function renderMember(member: ClubMember) {
    const displayName =
      member.display_name?.trim() ||
      member.username?.trim() ||
      'Novori Reader';

    const username =
      member.username?.trim()
        ? `@${member.username.trim()}`
        : '';

    const initial =
      displayName.charAt(0).toUpperCase();

    return (
      <Pressable
        key={member.user_id}
        onPress={() =>
          openReader(
            member.user_id
          )
        }
        style={({ pressed }) => [
          styles.memberRow,
          pressed &&
            styles.pressed,
        ]}
      >
        {member.avatar_url ? (
          <Image
            source={{
              uri: member.avatar_url,
            }}
            style={styles.memberAvatar}
          />
        ) : (
          <View
            style={styles.memberAvatarFallback}
          >
            <Text
              style={styles.memberAvatarText}
            >
              {initial}
            </Text>
          </View>
        )}

        <View style={styles.memberCopy}>
          <Text
            style={styles.memberName}
            numberOfLines={1}
          >
            {displayName}
          </Text>

          {username ? (
            <Text
              style={styles.memberUsername}
              numberOfLines={1}
            >
              {username}
            </Text>
          ) : null}
        </View>

        <Text style={styles.roleText}>
          {roleLabel(member.role)}
        </Text>
      </Pressable>
    );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={['top', 'bottom']}
      >
        <View style={styles.centered}>
          <ActivityIndicator
            size="small"
            color={colors.gold}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!club || error) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={['top', 'bottom']}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={colors.text}
            />
          </Pressable>

          <Text style={styles.headerTitle}>
            Club
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.centered}>
          <Ionicons
            name="people-outline"
            size={35}
            color={colors.mutedText}
          />

          <Text style={styles.errorTitle}>
            Club unavailable
          </Text>

          <Text style={styles.errorText}>
            {error ||
              'This club could not be loaded.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const role =
    club.membership_role;

  const isOwner =
    role === 'owner';

  const isMember =
    Boolean(role);

  const initial =
    club.name.charAt(0).toUpperCase();

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
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

        <Text
          style={styles.headerTitle}
          numberOfLines={1}
        >
          Club
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {club.cover_url ? (
          <Image
            source={{
              uri: club.cover_url,
            }}
            style={styles.clubCover}
          />
        ) : (
          <View
            style={styles.clubCoverFallback}
          >
            <Text
              style={styles.clubCoverInitial}
            >
              {initial}
            </Text>
          </View>
        )}

        <View style={styles.titleBlock}>
          <View style={styles.badgeRow}>
            <View style={styles.privacyBadge}>
              <Ionicons
                name={
                  club.privacy === 'public'
                    ? 'earth-outline'
                    : 'lock-closed-outline'
                }
                size={13}
                color={colors.gold}
              />

              <Text
                style={styles.privacyBadgeText}
              >
                {club.privacy === 'public'
                  ? 'Public'
                  : 'Private'}
              </Text>
            </View>

            {role ? (
              <View style={styles.roleBadge}>
                <Text
                  style={styles.roleBadgeText}
                >
                  {roleLabel(role)}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.clubName}>
            {club.name}
          </Text>

          <View style={styles.memberCountRow}>
            <Ionicons
              name="people-outline"
              size={16}
              color={colors.mutedText}
            />

            <Text style={styles.memberCountText}>
              {club.member_count}{' '}
              {club.member_count === 1
                ? 'member'
                : 'members'}
            </Text>
          </View>

          {club.genres?.length ? (
            <View
              style={
                styles.genreRow
              }
            >
              {club.genres.map(
                (genre) => (
                  <View
                    key={
                      genre
                    }
                    style={
                      styles.genreBadge
                    }
                  >
                    <Text
                      style={
                        styles.genreBadgeText
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
            </View>
          ) : null}

          {isOwner ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname:
                    '/edit-club-genres',
                  params: {
                    clubId:
                      club.id,
                  },
                })
              }
              style={({ pressed }) => [
                styles.editGenresLink,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="pencil-outline"
                size={
                  13
                }
                color={
                  colors.gold
                }
              />

              <Text
                style={
                  styles.editGenresText
                }
              >
                {club.genres?.length
                  ? 'Edit genres'
                  : 'Add genres'}
              </Text>
            </Pressable>
          ) : null}

          {club.description ? (
            <Text
              style={styles.description}
            >
              {club.description}
            </Text>
          ) : (
            <Text
              style={styles.descriptionMuted}
            >
              No club description yet.
            </Text>
          )}
        </View>

        {isOwner ? (
          <View style={styles.ownerButton}>
            <Ionicons
              name="shield-checkmark-outline"
              size={17}
              color={colors.gold}
            />

            <Text style={styles.ownerButtonText}>
              You own this club
            </Text>
          </View>
        ) : isMember ? (
          <Pressable
            disabled={membershipLoading}
            onPress={confirmLeave}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            {membershipLoading ? (
              <ActivityIndicator
                size="small"
                color={colors.text}
              />
            ) : (
              <Text
                style={styles.secondaryButtonText}
              >
                Leave Club
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            disabled={membershipLoading}
            onPress={handleJoin}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            {membershipLoading ? (
              <ActivityIndicator
                size="small"
                color={colors.background}
              />
            ) : (
              <>
                <Ionicons
                  name={
                    club.privacy === 'public'
                      ? 'add'
                      : 'lock-closed-outline'
                  }
                  size={18}
                  color={colors.background}
                />

                <Text
                  style={styles.primaryButtonText}
                >
                  {club.privacy === 'public'
                    ? 'Join Club'
                    : 'Invite Only'}
                </Text>
              </>
            )}
          </Pressable>
        )}

        {isMember ? (
          <Pressable
            onPress={() =>
              router.push({
                pathname:
                  '/create-post',
                params: {
                  clubId:
                    club.id,
                },
              })
            }
            style={({ pressed }) => [
              styles.postInClubButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="create-outline"
              size={18}
              color={colors.background}
            />

            <Text
              style={styles.postInClubButtonText}
            >
              Post in Club
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Members
          </Text>

          <Text style={styles.sectionMeta}>
            {members.length}
          </Text>
        </View>

        <View style={styles.card}>
          {members.length > 0 ? (
            members.map((member, index) => (
              <View key={member.user_id}>
                {renderMember(member)}

                {index <
                members.length - 1 ? (
                  <View
                    style={styles.rowDivider}
                  />
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyCardText}>
              No members to show yet.
            </Text>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Club Activity
          </Text>

          <Text style={styles.sectionMeta}>
            {clubPosts.length}
          </Text>
        </View>

        {clubPosts.length > 0 ? (
          <View style={styles.postList}>
            {clubPosts.map(renderClubPost)}
          </View>
        ) : (
          <View style={styles.activityPlaceholder}>
            <Ionicons
              name="chatbubbles-outline"
              size={27}
              color={colors.gold}
            />

            <Text style={styles.activityTitle}>
              No posts yet.
            </Text>

            <Text style={styles.activityText}>
              {isMember
                ? 'Start the conversation by making the first post in this club.'
                : 'Club posts will appear here when members start the conversation.'}
            </Text>

            {isMember ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname:
                      '/create-post',
                    params: {
                      clubId:
                        club.id,
                    },
                  })
                }
                style={({ pressed }) => [
                  styles.emptyPostButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="add"
                  size={17}
                  color={colors.background}
                />

                <Text
                  style={styles.emptyPostButtonText}
                >
                  Create First Post
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: NovoriColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 20,
      fontFamily: 'PlayfairDisplay_700Bold',
      textAlign: 'center',
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 90,
    },
    clubCover: {
      width: 116,
      height: 116,
      borderRadius: 26,
      backgroundColor: colors.elevated,
      alignSelf: 'center',
    },
    clubCoverFallback: {
      width: 116,
      height: 116,
      borderRadius: 26,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
    },
    clubCoverInitial: {
      color: colors.gold,
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 48,
    },
    titleBlock: {
      alignItems: 'center',
      marginTop: 17,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginBottom: 9,
    },
    privacyBadge: {
      minHeight: 27,
      paddingHorizontal: 9,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    privacyBadgeText: {
      color: colors.secondaryText,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
    },
    roleBadge: {
      minHeight: 27,
      paddingHorizontal: 9,
      borderRadius: 14,
      backgroundColor: colors.elevated,
      justifyContent: 'center',
    },
    roleBadgeText: {
      color: colors.gold,
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
    },
    clubName: {
      color: colors.text,
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 28,
      lineHeight: 34,
      textAlign: 'center',
    },
    memberCountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 7,
    },
    memberCountText: {
      color: colors.mutedText,
      fontFamily: 'Inter_500Medium',
      fontSize: 12,
    },
    genreRow: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      justifyContent:
        'center',
      gap: 6,
      marginTop: 12,
    },
    genreBadge: {
      backgroundColor:
        colors.elevated,
      borderRadius: 10,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    genreBadgeText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 10,
    },
    editGenresLink: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 5,
      marginTop: 9,
      paddingVertical: 3,
      paddingHorizontal: 5,
    },
    editGenresText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 10,
    },
    description: {
      color: colors.secondaryText,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      marginTop: 15,
      maxWidth: 560,
    },
    descriptionMuted: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      marginTop: 15,
    },
    primaryButton: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: colors.gold,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: 22,
    },
    primaryButtonText: {
      color: colors.background,
      fontFamily: 'Inter_700Bold',
      fontSize: 14,
    },
    secondaryButton: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 22,
    },
    secondaryButtonText: {
      color: colors.text,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
    },
    ownerButton: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: 22,
    },
    ownerButtonText: {
      color: colors.gold,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 30,
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    sectionTitle: {
      color: colors.text,
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 20,
    },
    sectionMeta: {
      color: colors.mutedText,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 17,
      overflow: 'hidden',
    },
    postVoteRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 3,
      marginTop: 14,
    },
    postVoteButton: {
      width: 32,
      height: 32,
      borderRadius:
        16,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    postVoteButtonActive: {
      backgroundColor:
        colors.elevated,
    },
    postVoteButtonDisabled: {
      opacity: 0.55,
    },
    postVoteScore: {
      minWidth: 24,
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12,
      textAlign:
        'center',
    },
    postVoteScoreActive: {
      color:
        colors.gold,
    },
    memberRow: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    memberAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.elevated,
      marginRight: 11,
    },
    memberAvatarFallback: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },
    memberAvatarText: {
      color: colors.text,
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 17,
    },
    memberCopy: {
      flex: 1,
    },
    memberName: {
      color: colors.text,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
    },
    memberUsername: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      marginTop: 2,
    },
    roleText: {
      color: colors.gold,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      marginLeft: 10,
    },
    rowDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 66,
    },
    emptyCardText: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      textAlign: 'center',
      padding: 24,
    },
    postInClubButton: {
      minHeight: 46,
      borderRadius: 14,
      backgroundColor: colors.gold,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginTop: 12,
    },
    postInClubButtonText: {
      color: colors.background,
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
    },
    postList: {
      gap: 11,
    },
    postCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 17,
      padding: 14,
    },
    postHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    postAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.elevated,
      marginRight: 10,
    },
    postAvatarFallback: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    postAvatarText: {
      color: colors.text,
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 16,
    },
    postAuthorCopy: {
      flex: 1,
      minWidth: 0,
      paddingTop: 2,
    },
    postAuthorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    postAuthorName: {
      color: colors.text,
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      flexShrink: 1,
    },
    postUsername: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 10,
      marginTop: 2,
    },
    postTime: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 10,
    },
    postBody: {
      color: colors.text,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      lineHeight: 21,
      marginTop: 12,
    },
    postBookCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.elevated,
      borderRadius: 12,
      padding: 9,
      marginTop: 12,
    },
    postBookCover: {
      width: 36,
      height: 52,
      borderRadius: 5,
      backgroundColor: colors.surface,
      marginRight: 9,
    },
    postBookCoverFallback: {
      width: 36,
      height: 52,
      borderRadius: 5,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 9,
    },
    postBookCopy: {
      flex: 1,
    },
    postBookTitle: {
      color: colors.text,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      lineHeight: 17,
    },
    postBookRating: {
      color: colors.gold,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      marginTop: 4,
    },
    emptyPostButton: {
      minHeight: 40,
      borderRadius: 12,
      backgroundColor: colors.gold,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 14,
      marginTop: 15,
    },
    emptyPostButtonText: {
      color: colors.background,
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
    },
    activityPlaceholder: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 17,
      alignItems: 'center',
      paddingHorizontal: 25,
      paddingVertical: 30,
    },
    activityTitle: {
      color: colors.text,
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      marginTop: 11,
    },
    activityText: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      marginTop: 6,
      maxWidth: 420,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
    },
    errorTitle: {
      color: colors.text,
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 22,
      marginTop: 13,
    },
    errorText: {
      color: colors.secondaryText,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: 6,
    },
    pressed: {
      opacity: 0.68,
    },
  });
}
