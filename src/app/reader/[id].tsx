import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import BlockReaderConfirmSheet from '../../components/BlockReaderConfirmSheet';
import ReaderProfileActionsSheet from '../../components/ReaderProfileActionsSheet';
import {
  NovoriColors,
} from '../../constants/novori-theme';
import {
  useNovoriTheme,
} from '../../context/theme-context';
import {
  ClubWithMembership,
  getMyClubs,
  inviteReaderToClub,
} from '../../lib/clubs';
import {
  cancelFollowRequest,
  FeedPost,
  followReader,
  PostVoteValue,
  togglePostVote,
  unfollowReader,
} from '../../lib/feed';
import {
  ReportReason,
  submitProfileReport,
} from '../../lib/reports';
import {
  blockReader,
  getReaderProfile,
  getReaderProfilePosts,
  getReaderPublicBooks,
  getReaderPublicClubs,
  getReaderPublicReviews,
  isReaderBlockedByViewer,
  PublicReaderBook,
  PublicReaderReview,
  ReaderSocialProfile,
  unblockReader,
} from '../../lib/social';

type ReaderTab =
  | 'books'
  | 'reviews'
  | 'posts'
  | 'clubs';

const PROFILE_REPORT_REASONS:
  Array<{
    value: ReportReason;
    label: string;
    icon:
      keyof typeof Ionicons.glyphMap;
  }> = [
    {
      value:
        'explicit_content',
      label:
        'Graphic or inappropriate content',
      icon:
        'eye-off-outline',
    },
    {
      value:
        'hate',
      label:
        'Violence, hate, or discrimination',
      icon:
        'warning-outline',
    },
    {
      value:
        'harassment',
      label:
        'Bullying or unwanted contact',
      icon:
        'person-remove-outline',
    },
    {
      value:
        'spam',
      label:
        'Scam, fraud, or spam',
      icon:
        'megaphone-outline',
    },
    {
      value:
        'impersonation',
      label:
        'Impersonation',
      icon:
        'people-outline',
    },
    {
      value:
        'other',
      label:
        'Other',
      icon:
        'ellipsis-horizontal-circle-outline',
    },
  ];

export default function ReaderProfileScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      id: string;
    }>();

  const {
    colors,
  } =
    useNovoriTheme();

  const insets =
    useSafeAreaInsets();

  const styles =
    createStyles(
      colors
    );

  const readerId =
    typeof params.id ===
    'string'
      ? params.id
      : '';

  const [
    profile,
    setProfile,
  ] =
    useState<ReaderSocialProfile | null>(
      null
    );

  const [
    books,
    setBooks,
  ] =
    useState<PublicReaderBook[]>(
      []
    );

  const [
    reviews,
    setReviews,
  ] =
    useState<PublicReaderReview[]>(
      []
    );

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
    votingPostId,
    setVotingPostId,
  ] =
    useState<
      string | null
    >(null);

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<ReaderTab>(
      'books'
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    followLoading,
    setFollowLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    reportTargetProfile,
    setReportTargetProfile,
  ] =
    useState<ReaderSocialProfile | null>(
      null
    );

  const [
    isBlocked,
    setIsBlocked,
  ] =
    useState(false);

  const [
    blockConfirmProfile,
    setBlockConfirmProfile,
  ] =
    useState<ReaderSocialProfile | null>(
      null
    );

  const [
    unblockConfirmProfile,
    setUnblockConfirmProfile,
  ] =
    useState<ReaderSocialProfile | null>(
      null
    );

  const [
    blockBusy,
    setBlockBusy,
  ] =
    useState(false);

  const blockSucceededRef =
    useRef(false);

  const unblockSucceededRef =
    useRef(false);

  const [
    profileActionsOpen,
    setProfileActionsOpen,
  ] =
    useState(false);

  const [
    managerClubs,
    setManagerClubs,
  ] =
    useState<ClubWithMembership[]>(
      []
    );

  const [
    inviteClubPickerOpen,
    setInviteClubPickerOpen,
  ] =
    useState(false);

  const [
    invitingClubId,
    setInvitingClubId,
  ] =
    useState<string | null>(
      null
    );

  const [
    reportSubmitting,
    setReportSubmitting,
  ] =
    useState(false);

  const reportTranslateY =
    useRef(
      new Animated.Value(
        900
      )
    ).current;

  const reportBackdropOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const reportSheetOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const reportSheetHeight =
    useRef(0);

  const reportSheetAnimating =
    useRef(false);

  const reportSheetClosing =
    useRef(false);

  const reportEntranceStarted =
    useRef(false);

  const loadReader =
    useCallback(
      async () => {
        if (!readerId) {
          setError(
            'Reader profile not found.'
          );
          setLoading(
            false
          );
          return;
        }

        try {
          setError(
            ''
          );

          const [
            profileData,
            blockedByViewer,
          ] =
            await Promise.all([
              getReaderProfile(
                readerId
              ),
              isReaderBlockedByViewer(
                readerId
              ),
            ]);

          setProfile(
            profileData
          );

          setIsBlocked(
            blockedByViewer
          );

          try {
            const myClubData =
              await getMyClubs();

            setManagerClubs(
              myClubData.filter(
                (
                  club
                ) =>
                  club.membership_role ===
                    'owner' ||
                  club.membership_role ===
                    'admin'
              )
            );
          } catch (
            clubLoadError
          ) {
            console.error(
              'Could not load clubs managed by this reader:',
              clubLoadError
            );

            setManagerClubs(
              []
            );
          }

          if (
            blockedByViewer
          ) {
            setBooks(
              []
            );
            setReviews(
              []
            );
            setPosts(
              []
            );
            setClubs(
              []
            );
            return;
          }

          const [
            bookData,
            reviewData,
            postData,
            clubData,
          ] =
            await Promise.all([
              getReaderPublicBooks(
                readerId
              ),
              getReaderPublicReviews(
                readerId
              ),
              getReaderProfilePosts(
                readerId
              ),
              getReaderPublicClubs(
                readerId
              ),
            ]);

          setBooks(
            bookData
          );
          setReviews(
            reviewData
          );
          setPosts(
            postData
          );
          setClubs(
            clubData
          );
        } catch (
          loadError
        ) {
          console.error(
            'Could not load reader profile:',
            loadError
          );

          setError(
            'This reader profile could not be loaded.'
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        readerId,
      ]
    );

  useFocusEffect(
    useCallback(() => {
      setLoading(
        true
      );

      loadReader();
    }, [
      loadReader,
    ])
  );

  function openProfileReport() {
    if (
      !profile ||
      profile.is_self ||
      reportSubmitting ||
      reportTargetProfile ||
      reportSheetClosing.current
    ) {
      return;
    }

    reportTranslateY.stopAnimation();
    reportBackdropOpacity.stopAnimation();
    reportSheetOpacity.stopAnimation();

    reportSheetHeight.current =
      0;
    reportEntranceStarted.current =
      false;
    reportSheetAnimating.current =
      false;
    reportSheetClosing.current =
      false;

    reportTranslateY.setValue(
      900
    );
    reportBackdropOpacity.setValue(
      0
    );
    reportSheetOpacity.setValue(
      0
    );

    setReportTargetProfile(
      profile
    );
  }

  function animateProfileReportIn() {
    if (
      !reportTargetProfile ||
      reportEntranceStarted.current ||
      !reportSheetHeight.current ||
      reportSheetAnimating.current ||
      reportSheetClosing.current
    ) {
      return;
    }

    reportTranslateY.stopAnimation();
    reportBackdropOpacity.stopAnimation();
    reportSheetOpacity.stopAnimation();

    reportSheetAnimating.current =
      true;
    reportEntranceStarted.current =
      true;

    reportTranslateY.setValue(
      reportSheetHeight.current +
        24
    );
    reportSheetOpacity.setValue(
      1
    );

    Animated.parallel([
      Animated.timing(
        reportTranslateY,
        {
          toValue:
            0,
          duration:
            320,
          easing:
            Easing.bezier(
              0.22,
              0.68,
              0.30,
              1
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        reportBackdropOpacity,
        {
          toValue:
            1,
          duration:
            320,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(() => {
      reportSheetAnimating.current =
        false;
    });
  }

  function closeProfileReport() {
    if (
      reportSubmitting ||
      reportSheetClosing.current
    ) {
      return;
    }

    dismissProfileReport();
  }

  function dismissProfileReport(
    afterClose?: () => void
  ) {
    if (
      reportSheetClosing.current
    ) {
      return;
    }

    reportSheetClosing.current =
      true;

    reportTranslateY.stopAnimation();
    reportBackdropOpacity.stopAnimation();

    reportSheetAnimating.current =
      true;

    Animated.parallel([
      Animated.timing(
        reportTranslateY,
        {
          toValue:
            reportSheetHeight.current +
            24,
          duration:
            245,
          easing:
            Easing.bezier(
              0.32,
              0,
              0.67,
              1
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        reportBackdropOpacity,
        {
          toValue:
            0,
          duration:
            245,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(({
      finished,
    }) => {
      reportSheetAnimating.current =
        false;

      if (
        !finished
      ) {
        reportSheetClosing.current =
          false;
        return;
      }

      setReportTargetProfile(
        null
      );

      reportSheetClosing.current =
        false;
      reportEntranceStarted.current =
        false;
      reportSheetHeight.current =
        0;

      afterClose?.();
    });
  }

  async function handleProfileReport(
    reason: ReportReason
  ) {
    if (
      !reportTargetProfile ||
      reportSubmitting
    ) {
      return;
    }

    try {
      setReportSubmitting(
        true
      );

      await submitProfileReport(
        reportTargetProfile.id,
        reason
      );

      dismissProfileReport(
        () => {
          Alert.alert(
            'Report submitted',
            'Thanks for letting us know. The profile has been added to the moderation queue.'
          );
        }
      );
    } catch (
      reportError
    ) {
      console.error(
        'Could not report profile:',
        reportError
      );

      Alert.alert(
        'Could not submit report',
        'Please try again.'
      );
    } finally {
      setReportSubmitting(
        false
      );
    }
  }

  const reportPanResponder =
    useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (
            _event,
            gesture
          ) =>
            Boolean(
              reportTargetProfile
            ) &&
            !reportSubmitting &&
            !reportSheetAnimating.current &&
            gesture.dy >
              6 &&
            Math.abs(
              gesture.dy
            ) >
              Math.abs(
                gesture.dx
              ) *
                1.05,

          onMoveShouldSetPanResponderCapture: (
            _event,
            gesture
          ) =>
            Boolean(
              reportTargetProfile
            ) &&
            !reportSubmitting &&
            !reportSheetAnimating.current &&
            gesture.dy >
              9 &&
            Math.abs(
              gesture.dy
            ) >
              Math.abs(
                gesture.dx
              ) *
                1.12,

          onPanResponderMove: (
            _event,
            gesture
          ) => {
            reportTranslateY.setValue(
              Math.max(
                0,
                gesture.dy
              )
            );
          },

          onPanResponderRelease: (
            _event,
            gesture
          ) => {
            if (
              gesture.dy >
                92 ||
              gesture.vy >
                0.72
            ) {
              closeProfileReport();
              return;
            }

            reportSheetAnimating.current =
              true;

            Animated.spring(
              reportTranslateY,
              {
                toValue:
                  0,
                damping:
                  25,
                stiffness:
                  205,
                mass:
                  0.92,
                useNativeDriver:
                  true,
              }
            ).start(() => {
              reportSheetAnimating.current =
                false;
            });
          },

          onPanResponderTerminationRequest:
            () =>
              false,

          onPanResponderTerminate:
            () => {
              reportSheetAnimating.current =
                true;

              Animated.spring(
                reportTranslateY,
                {
                  toValue:
                    0,
                  damping:
                    25,
                  stiffness:
                    205,
                  mass:
                    0.92,
                  useNativeDriver:
                    true,
                }
              ).start(() => {
                reportSheetAnimating.current =
                  false;
              });
            },
        }),
      [
        reportSubmitting,
        reportTargetProfile,
        reportTranslateY,
      ]
    );

  function openProfileActions() {
    if (
      !profile ||
      profile.is_self
    ) {
      return;
    }

    setProfileActionsOpen(
      true
    );
  }

  async function shareProfile() {
    if (
      !profile
    ) {
      return;
    }

    const name =
      profile.display_name
        ?.trim() ||
      profile.username
        ?.trim() ||
      'Novori Reader';

    const username =
      profile.username
        ?.trim()
        ? `@${profile.username.trim()}`
        : '';

    setProfileActionsOpen(
      false
    );

    try {
      await Share.share({
        message:
          username
            ? `Check out ${name} (${username}) on Novori.`
            : `Check out ${name} on Novori.`,
      });
    } catch (
      shareError
    ) {
      console.error(
        'Could not share profile:',
        shareError
      );
    }
  }

  async function inviteProfileToClub(
    targetClub:
      ClubWithMembership
  ) {
    if (
      !profile ||
      invitingClubId
    ) {
      return;
    }

    try {
      setInvitingClubId(
        targetClub.id
      );

      await inviteReaderToClub(
        targetClub.id,
        profile.id
      );

      setInviteClubPickerOpen(
        false
      );

      Alert.alert(
        'Invitation sent',
        `${profile.display_name?.trim() ||
          profile.username?.trim() ||
          'This reader'} was invited to ${targetClub.name}.`
      );
    } catch (
      inviteError
    ) {
      console.error(
        'Could not invite reader from profile:',
        inviteError
      );

      Alert.alert(
        'Could not send invitation',
        inviteError instanceof Error
          ? inviteError.message
          : 'Please try again.'
      );
    } finally {
      setInvitingClubId(
        null
      );
    }
  }

  async function confirmBlockProfile() {
    if (
      !blockConfirmProfile ||
      blockBusy
    ) {
      return;
    }

    try {
      setBlockBusy(
        true
      );

      blockSucceededRef.current =
        false;

      await blockReader(
        blockConfirmProfile.id
      );

      blockSucceededRef.current =
        true;
    } catch (
      blockError
    ) {
      console.error(
        'Could not block reader from profile:',
        blockError
      );

      Alert.alert(
        'Could not block reader',
        blockError instanceof Error
          ? blockError.message
          : 'Please try again.'
      );

      throw blockError;
    } finally {
      setBlockBusy(
        false
      );
    }
  }

  async function confirmUnblockProfile() {
    if (
      !unblockConfirmProfile ||
      blockBusy
    ) {
      return;
    }

    try {
      setBlockBusy(
        true
      );

      unblockSucceededRef.current =
        false;

      await unblockReader(
        unblockConfirmProfile.id
      );

      unblockSucceededRef.current =
        true;
    } catch (
      unblockError
    ) {
      console.error(
        'Could not unblock reader from profile:',
        unblockError
      );

      Alert.alert(
        'Could not unblock reader',
        unblockError instanceof Error
          ? unblockError.message
          : 'Please try again.'
      );

      throw unblockError;
    } finally {
      setBlockBusy(
        false
      );
    }
  }

  async function toggleFollow() {

    if (
      !profile ||
      profile.is_self
    ) {
      return;
    }

    if (
      isBlocked
    ) {
      setUnblockConfirmProfile(
        profile
      );
      return;
    }

    try {
      setFollowLoading(
        true
      );

      if (
        profile.is_following
      ) {
        await unfollowReader(
          profile.id
        );
      } else if (
        profile.follow_request_pending
      ) {
        await cancelFollowRequest(
          profile.id
        );
      } else {
        await followReader(
          profile.id
        );
      }

      await loadReader();
    } catch (
      followError
    ) {
      console.error(
        'Could not update follow:',
        followError
      );

      Alert.alert(
        'Could not update follow',
        'Please try again.'
      );
    } finally {
      setFollowLoading(
        false
      );
    }
  }

  function openConnections(
    mode:
      | 'followers'
      | 'following'
  ) {
    if (!profile) {
      return;
    }

    if (
      profile.is_private &&
      !profile.can_view_content
    ) {
      Alert.alert(
        'Private profile',
        'Follow this reader and wait for approval to see their connections.'
      );
      return;
    }

    router.push({
      pathname:
        '/reader-connections',
      params: {
        readerId:
          profile.id,
        mode,
        name:
          profile.display_name ??
          profile.username ??
          'Reader',
      },
    });
  }

  function openClub(
    clubId: string
  ) {
    router.push({
      pathname:
        '/club/[id]',
      params: {
        id:
          clubId,
      },
    });
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
      },
    });
  }

  function formatTime(
    createdAt: string
  ) {
    const created =
      new Date(
        createdAt
      );

    const minutes =
      Math.max(
        0,
        Math.floor(
          (
            Date.now() -
            created.getTime()
          ) /
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

  function renderPost(
    post: FeedPost
  ) {
    return (
      <View
        key={
          post.id
        }
        style={
          styles.postCard
        }
      >
        <View
          style={
            styles.postMetaRow
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
              colors.gold
            }
          />

          <Text
            style={
              styles.postMetaText
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

          <Text
            style={
              styles.postTime
            }
          >
            ·{' '}
            {formatTime(
              post.created_at
            )}
          </Text>
        </View>

        <Text
          style={
            styles.postBody
          }
        >
          {post.body}
        </Text>

        {post.book_title ? (
          <View
            style={
              styles.bookCard
            }
          >
            {post.book_cover_url ? (
              <Image
                source={{
                  uri:
                    post.book_cover_url,
                }}
                style={
                  styles.bookCover
                }
              />
            ) : (
              <View
                style={
                  styles.bookCoverFallback
                }
              >
                <Ionicons
                  name="book-outline"
                  size={
                    18
                  }
                  color={
                    colors.gold
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
                {
                  post.book_title
                }
              </Text>

              {post.rating ? (
                <Text
                  style={
                    styles.bookRating
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

  function renderBook(
    book:
      PublicReaderBook
  ) {
    const statusLabel =
      book.status ===
      'reading'
        ? 'Reading'
        : book.status ===
          'dnf'
        ? 'DNF'
        : 'Read';

    return (
      <Pressable
        key={
          book.id
        }
        onPress={() =>
          openBook(
            book.google_book_id
          )
        }
        style={({ pressed }) => [
          styles.publicBookCard,
          pressed &&
            styles.pressed,
        ]}
      >
        <View
          style={
            styles.publicBookCoverWrap
          }
        >
          {book.cover_url ? (
            <Image
              source={{
                uri:
                  book.cover_url,
              }}
              style={
                styles.publicBookCover
              }
            />
          ) : (
            <View
              style={
                styles.publicBookCoverFallback
              }
            >
              <Ionicons
                name="book-outline"
                size={
                  24
                }
                color={
                  colors.gold
                }
              />
            </View>
          )}

          <View
            style={
              styles.publicBookStatus
            }
          >
            <Text
              style={
                styles.publicBookStatusText
              }
            >
              {statusLabel}
            </Text>
          </View>
        </View>

        <Text
          style={
            styles.publicBookTitle
          }
          numberOfLines={
            2
          }
        >
          {book.title}
        </Text>

        <Text
          style={
            styles.publicBookAuthor
          }
          numberOfLines={
            1
          }
        >
          {book.authors?.[0] ??
            'Unknown author'}
        </Text>
      </Pressable>
    );
  }

  function renderReview(
    review:
      PublicReaderReview
  ) {
    return (
      <Pressable
        key={
          review.id
        }
        onPress={() =>
          openBook(
            review.google_book_id
          )
        }
        style={({ pressed }) => [
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
          {review.cover_url ? (
            <Image
              source={{
                uri:
                  review.cover_url,
              }}
              style={
                styles.reviewCover
              }
            />
          ) : (
            <View
              style={
                styles.reviewCoverFallback
              }
            >
              <Ionicons
                name="book-outline"
                size={
                  19
                }
                color={
                  colors.gold
                }
              />
            </View>
          )}

          <View
            style={
              styles.reviewBookCopy
            }
          >
            <Text
              style={
                styles.reviewTitle
              }
              numberOfLines={
                2
              }
            >
              {review.title}
            </Text>

            <Text
              style={
                styles.reviewAuthor
              }
              numberOfLines={
                1
              }
            >
              {review.authors?.[0] ??
                'Unknown author'}
            </Text>

            {review.rating !==
            null ? (
              <View
                style={
                  styles.reviewRatingRow
                }
              >
                <Ionicons
                  name="star"
                  size={
                    13
                  }
                  color={
                    colors.gold
                  }
                />

                <Text
                  style={
                    styles.reviewRatingText
                  }
                >
                  {review.rating.toFixed(
                    1
                  )}
                </Text>
              </View>
            ) : null}
          </View>

          <Ionicons
            name="chevron-forward"
            size={
              18
            }
            color={
              colors.mutedText
            }
          />
        </View>

        {review.review_text
          ?.trim() ? (
          <Text
            style={
              styles.reviewText
            }
          >
            {review.review_text.trim()}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  function renderClub(
    club:
      ClubWithMembership
  ) {
    const initial =
      club.name
        .charAt(0)
        .toUpperCase();

    return (
      <Pressable
        key={
          club.id
        }
        onPress={() =>
          openClub(
            club.id
          )
        }
        style={({
          pressed,
        }) => [
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
              styles.clubImage
            }
          />
        ) : (
          <View
            style={
              styles.clubImageFallback
            }
          >
            <Text
              style={
                styles.clubInitial
              }
            >
              {initial}
            </Text>
          </View>
        )}

        <View
          style={
            styles.clubCopy
          }
        >
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

          <Text
            style={
              styles.clubMeta
            }
          >
            {club.member_count}{' '}
            {club.member_count ===
            1
              ? 'member'
              : 'members'}
            {' · '}
            {club.membership_role ===
            'owner'
              ? 'Owner'
              : club.membership_role ===
                'admin'
              ? 'Admin'
              : 'Member'}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={
            18
          }
          color={
            colors.mutedText
          }
        />
      </Pressable>
    );
  }

  if (
    loading
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
        edges={[
          'top',
          'bottom',
        ]}
      >
        <View
          style={
            styles.centered
          }
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

  if (
    !profile ||
    error
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
        edges={[
          'top',
          'bottom',
        ]}
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
            style={
              styles.headerButton
            }
          >
            <Ionicons
              name="chevron-back"
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
            Reader
          </Text>

          <View
            style={
              styles.headerSpacer
            }
          />
        </View>

        <View
          style={
            styles.centered
          }
        >
          <Text
            style={
              styles.errorTitle
            }
          >
            Reader unavailable
          </Text>

          <Text
            style={
              styles.errorText
            }
          >
            {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName =
    profile.display_name
      ?.trim() ||
    profile.username
      ?.trim() ||
    'Novori Reader';

  const username =
    profile.username
      ?.trim()
      ? `@${profile.username.trim()}`
      : '';

  const bio =
    profile.bio
      ?.trim() ||
    'No bio yet.';

  const initial =
    displayName
      .charAt(0)
      .toUpperCase();

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
          onPress={() =>
            router.back()
          }
          hitSlop={
            10
          }
          style={({ pressed }) => [
            styles.headerButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-back"
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
          numberOfLines={
            1
          }
        >
          Reader
        </Text>

        {profile.is_self ? (
          <View
            style={
              styles.headerSpacer
            }
          />
        ) : (
          <Pressable
            onPress={
              openProfileActions
            }
            hitSlop={
              10
            }
            style={({ pressed }) => [
              styles.headerButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={
                23
              }
              color={
                colors.text
              }
            />
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.profileHeader
          }
        >
          {profile.avatar_url ? (
            <Image
              source={{
                uri:
                  profile.avatar_url,
              }}
              style={
                styles.avatar
              }
            />
          ) : (
            <View
              style={
                styles.avatarFallback
              }
            >
              <Text
                style={
                  styles.avatarText
                }
              >
                {initial}
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

          {username ? (
            <Text
              style={
                styles.username
              }
            >
              {username}
            </Text>
          ) : null}

          {profile.is_private ? (
            <View
              style={
                styles.privateBadge
              }
            >
              <Ionicons
                name="lock-closed"
                size={
                  11
                }
                color={
                  colors.gold
                }
              />

              <Text
                style={
                  styles.privateBadgeText
                }
              >
                Private
              </Text>
            </View>
          ) : null}

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
            onPress={() =>
              openConnections(
                'followers'
              )
            }
            style={({ pressed }) => [
              styles.stat,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.statNumber
              }
            >
              {
                profile.follower_count
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
            onPress={() =>
              openConnections(
                'following'
              )
            }
            style={({ pressed }) => [
              styles.stat,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.statNumber
              }
            >
              {
                profile.following_count
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

          <View
            style={
              styles.stat
            }
          >
            <Text
              style={
                styles.statNumber
              }
            >
              {
                books.length
              }
            </Text>

            <Text
              style={
                styles.statLabel
              }
            >
              Books
            </Text>
          </View>
        </View>

        {profile.is_self ? (
          <Pressable
            onPress={() =>
              router.replace(
                '/(tabs)/profile'
              )
            }
            style={({ pressed }) => [
              styles.followButtonSecondary,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.followButtonSecondaryText
              }
            >
              Open My Profile
            </Text>
          </Pressable>
        ) : (
          <Pressable
            disabled={
              followLoading ||
              blockBusy
            }
            onPress={
              toggleFollow
            }
            style={({ pressed }) => [
              isBlocked ||
              profile.is_following ||
              profile.follow_request_pending
                ? styles.followButtonSecondary
                : styles.followButton,
              pressed &&
                !followLoading &&
                !blockBusy &&
                styles.pressed,
            ]}
          >
            {followLoading ||
            blockBusy ? (
              <ActivityIndicator
                size="small"
                color={
                  isBlocked ||
                  profile.is_following ||
                  profile.follow_request_pending
                    ? colors.text
                    : colors.background
                }
              />
            ) : (
              <>
                <Ionicons
                  name={
                    isBlocked
                      ? 'ban-outline'
                      : profile.is_following
                      ? 'checkmark'
                      : profile.follow_request_pending
                      ? 'time-outline'
                      : profile.is_private
                      ? 'lock-closed-outline'
                      : 'person-add-outline'
                  }
                  size={
                    17
                  }
                  color={
                    isBlocked ||
                    profile.is_following ||
                    profile.follow_request_pending
                      ? colors.text
                      : colors.background
                  }
                />

                <Text
                  style={
                    isBlocked ||
                    profile.is_following ||
                    profile.follow_request_pending
                      ? styles.followButtonSecondaryText
                      : styles.followButtonText
                  }
                >
                  {isBlocked
                    ? 'Blocked'
                    : profile.is_following
                    ? 'Following'
                    : profile.follow_request_pending
                    ? 'Requested'
                    : profile.is_private
                    ? 'Request to Follow'
                    : 'Follow'}
                </Text>
              </>
            )}
          </Pressable>
        )}

        {isBlocked &&
        !profile.is_self ? (
          <View
            style={
              styles.privateLockedCard
            }
          >
            <View
              style={
                styles.privateLockedIcon
              }
            >
              <Ionicons
                name="ban-outline"
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
                styles.emptyTitle
              }
            >
              You blocked this reader.
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Their posts and comments are hidden from you. Tap Blocked above if you want to unblock them.
            </Text>
          </View>
        ) : profile.is_private &&
        !profile.can_view_content &&
        !profile.is_self ? (
          <View
            style={
              styles.privateLockedCard
            }
          >
            <View
              style={
                styles.privateLockedIcon
              }
            >
              <Ionicons
                name="lock-closed"
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
                styles.emptyTitle
              }
            >
              This profile is private.
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Send a follow request to see this reader’s books, reviews, posts, clubs, and connections.
            </Text>

            {profile.follow_request_pending ? (
              <Text
                style={
                  styles.requestPendingText
                }
              >
                Follow request pending
              </Text>
            ) : null}
          </View>
        ) : (
          <>
        <View
          style={
            styles.tabRow
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
                  'posts',
                label:
                  'Posts',
              },
              {
                key:
                  'clubs',
                label:
                  'Clubs',
              },
            ] as {
              key:
                ReaderTab;
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
                  setActiveTab(
                    tab.key
                  )
                }
                style={[
                  styles.tabButton,
                  activeTab ===
                    tab.key &&
                    styles.tabButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab ===
                      tab.key &&
                      styles.tabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            )
          )}
        </View>

        {activeTab ===
        'books' ? (
          !profile.can_view_books ? (
            <View
              style={
                styles.emptyCard
              }
            >
              <Ionicons
                name="lock-closed-outline"
                size={
                  26
                }
                color={
                  colors.gold
                }
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                Books are private.
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                This reader has chosen not to show their reading history publicly.
              </Text>
            </View>
          ) : books.length >
            0 ? (
            <View
              style={
                styles.publicBookGrid
              }
            >
              {books.map(
                renderBook
              )}
            </View>
          ) : (
            <View
              style={
                styles.emptyCard
              }
            >
              <Ionicons
                name="library-outline"
                size={
                  26
                }
                color={
                  colors.gold
                }
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No books to show yet.
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Reading, Read, and DNF books will appear here. TBR books stay private.
              </Text>
            </View>
          )
        ) : activeTab ===
          'reviews' ? (
          !profile.can_view_reviews ? (
            <View
              style={
                styles.emptyCard
              }
            >
              <Ionicons
                name="lock-closed-outline"
                size={
                  26
                }
                color={
                  colors.gold
                }
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                Reviews are private.
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                This reader has chosen not to show ratings and reviews publicly.
              </Text>
            </View>
          ) : reviews.length >
            0 ? (
            <View
              style={
                styles.list
              }
            >
              {reviews.map(
                renderReview
              )}
            </View>
          ) : (
            <View
              style={
                styles.emptyCard
              }
            >
              <Ionicons
                name="star-outline"
                size={
                  26
                }
                color={
                  colors.gold
                }
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No reviews yet.
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Ratings and written reviews will appear here.
              </Text>
            </View>
          )
        ) : activeTab ===
          'posts' ? (
          posts.length >
          0 ? (
            <View
              style={
                styles.list
              }
            >
              {posts.map(
                renderPost
              )}
            </View>
          ) : (
            <View
              style={
                styles.emptyCard
              }
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={
                  26
                }
                color={
                  colors.gold
                }
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                No profile posts yet.
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Posts shared to this reader’s profile will appear here.
              </Text>
            </View>
          )
        ) : clubs.length >
          0 ? (
          <View
            style={
              styles.list
            }
          >
            {clubs.map(
              renderClub
            )}
          </View>
        ) : (
          <View
            style={
              styles.emptyCard
            }
          >
            <Ionicons
              name="people-outline"
              size={
                26
              }
              color={
                colors.gold
              }
            />

            <Text
              style={
                styles.emptyTitle
              }
            >
              No public clubs yet.
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Public clubs this reader belongs to will appear here. Private memberships stay private.
            </Text>
          </View>
        )}
          </>
        )}
      </ScrollView>
      <ReaderProfileActionsSheet
        visible={
          profileActionsOpen
        }
        isBlocked={
          isBlocked
        }
        canInviteToClub={
          managerClubs.length >
          0
        }
        onInviteToClub={() =>
          setInviteClubPickerOpen(
            true
          )
        }
        onBlock={() => {
          if (
            profile
          ) {
            setBlockConfirmProfile(
              profile
            );
          }
        }}
        onUnblock={() => {
          if (
            profile
          ) {
            setUnblockConfirmProfile(
              profile
            );
          }
        }}
        onReport={
          openProfileReport
        }
        onShare={() =>
          void shareProfile()
        }
        onDismiss={() =>
          setProfileActionsOpen(
            false
          )
        }
      />

      <Modal
        visible={
          inviteClubPickerOpen
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setInviteClubPickerOpen(
            false
          )
        }
      >
        <View
          style={
            styles.profileActionsBackdrop
          }
        >
          <Pressable
            style={
              StyleSheet.absoluteFill
            }
            onPress={() =>
              setInviteClubPickerOpen(
                false
              )
            }
          />

          <View
            style={[
              styles.profileActionsSheet,
              {
                paddingBottom:
                  Math.max(
                    18,
                    insets.bottom +
                      12
                  ),
              },
            ]}
          >
            <View
              style={
                styles.profileActionsHandle
              }
            />

            <Text
              style={
                styles.profileActionsTitle
              }
            >
              Invite to a club
            </Text>

            <Text
              style={
                styles.profileActionsHint
              }
            >
              Choose one of the clubs you manage.
            </Text>

            {managerClubs.map(
              (
                managedClub,
                index
              ) => (
                <View
                  key={
                    managedClub.id
                  }
                >
                  {index >
                  0 ? (
                    <View
                      style={
                        styles.profileActionsDivider
                      }
                    />
                  ) : null}

                  <Pressable
                    disabled={
                      Boolean(
                        invitingClubId
                      )
                    }
                    onPress={() =>
                      void inviteProfileToClub(
                        managedClub
                      )
                    }
                    style={({ pressed }) => [
                      styles.profileActionsRow,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="people-outline"
                      size={
                        19
                      }
                      color={
                        colors.gold
                      }
                    />

                    <View
                      style={
                        styles.profileInviteClubCopy
                      }
                    >
                      <Text
                        style={
                          styles.profileActionsText
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {managedClub.name}
                      </Text>

                      <Text
                        style={
                          styles.profileInviteClubRole
                        }
                      >
                        {managedClub.membership_role ===
                        'owner'
                          ? 'Owner'
                          : 'Admin'}
                      </Text>
                    </View>

                    {invitingClubId ===
                    managedClub.id ? (
                      <ActivityIndicator
                        size="small"
                        color={
                          colors.gold
                        }
                      />
                    ) : (
                      <Ionicons
                        name="chevron-forward"
                        size={
                          18
                        }
                        color={
                          colors.mutedText
                        }
                      />
                    )}
                  </Pressable>
                </View>
              )
            )}
          </View>
        </View>
      </Modal>

      <BlockReaderConfirmSheet
        visible={
          Boolean(
            blockConfirmProfile
          )
        }
        readerName={
          blockConfirmProfile?.display_name
            ?.trim() ||
          blockConfirmProfile?.username
            ?.trim() ||
          'this reader'
        }
        busy={
          blockBusy
        }
        onConfirm={
          confirmBlockProfile
        }
        onDismiss={() => {
          const didBlock =
            blockSucceededRef.current;

          blockSucceededRef.current =
            false;

          setBlockConfirmProfile(
            null
          );

          if (
            didBlock
          ) {
            setIsBlocked(
              true
            );

            setBooks(
              []
            );
            setReviews(
              []
            );
            setPosts(
              []
            );
            setClubs(
              []
            );
          }
        }}
      />

      <BlockReaderConfirmSheet
        visible={
          Boolean(
            unblockConfirmProfile
          )
        }
        readerName={
          unblockConfirmProfile?.display_name
            ?.trim() ||
          unblockConfirmProfile?.username
            ?.trim() ||
          'this reader'
        }
        mode="unblock"
        busy={
          blockBusy
        }
        onConfirm={
          confirmUnblockProfile
        }
        onDismiss={() => {
          const didUnblock =
            unblockSucceededRef.current;

          unblockSucceededRef.current =
            false;

          setUnblockConfirmProfile(
            null
          );

          if (
            didUnblock
          ) {
            setIsBlocked(
              false
            );

            void loadReader();
          }
        }}
      />

      <Modal
        visible={
          Boolean(
            reportTargetProfile
          )
        }
        transparent
        animationType="none"
        onShow={
          animateProfileReportIn
        }
        onRequestClose={
          closeProfileReport
        }
      >
        <Pressable
          style={
            styles.reportBackdrop
          }
          onPress={
            closeProfileReport
          }
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.reportBackdropVisual,
              {
                opacity:
                  reportBackdropOpacity,
              },
            ]}
          />

          <Animated.View
            {...reportPanResponder.panHandlers}
            onLayout={(event) => {
              reportSheetHeight.current =
                event.nativeEvent.layout.height;

              if (
                !reportSheetAnimating.current &&
                !reportSheetClosing.current
              ) {
                animateProfileReportIn();
              }
            }}
            style={[
              styles.reportSheet,
              {
                paddingBottom:
                  Math.max(
                    18,
                    insets.bottom +
                      12
                  ),
                opacity:
                  reportSheetOpacity,
                transform: [
                  {
                    translateY:
                      reportTranslateY,
                  },
                ],
              },
            ]}
          >
            <Pressable
              onPress={(event) =>
                event.stopPropagation()
              }
            >
              <View
                style={
                  styles.reportHandle
                }
              />

              <View
                style={
                  styles.reportHeadingRow
                }
              >
                <View
                  style={
                    styles.reportHeadingCopy
                  }
                >
                  <Text
                    style={
                      styles.reportTitle
                    }
                  >
                    Report profile
                  </Text>

                  <Text
                    style={
                      styles.reportSubtitle
                    }
                  >
                    Why are you reporting this profile?
                  </Text>
                </View>

                <Pressable
                  onPress={
                    closeProfileReport
                  }
                  hitSlop={
                    10
                  }
                  style={({ pressed }) => [
                    styles.reportCloseButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="close"
                    size={
                      21
                    }
                    color={
                      colors.text
                    }
                  />
                </Pressable>
              </View>

              <View
                style={
                  styles.reportReasonList
                }
              >
                {PROFILE_REPORT_REASONS.map(
                  (
                    reason
                  ) => (
                    <Pressable
                      key={
                        reason.value
                      }
                      disabled={
                        reportSubmitting
                      }
                      onPress={() =>
                        void handleProfileReport(
                          reason.value
                        )
                      }
                      style={({ pressed }) => [
                        styles.reportReasonButton,
                        pressed &&
                          styles.reportReasonButtonPressed,
                      ]}
                    >
                      <View
                        style={
                          styles.reportReasonIcon
                        }
                      >
                        <Ionicons
                          name={
                            reason.icon
                          }
                          size={
                            18
                          }
                          color={
                            colors.gold
                          }
                        />
                      </View>

                      <Text
                        style={
                          styles.reportReasonText
                        }
                      >
                        {reason.label}
                      </Text>

                      <Ionicons
                        name="chevron-forward"
                        size={
                          17
                        }
                        color={
                          colors.mutedText
                        }
                      />
                    </Pressable>
                  )
                )}
              </View>

              <Text
                style={
                  styles.reportPrivacyText
                }
              >
                Reports are private. This reader won’t be told who reported them.
              </Text>

              {reportSubmitting ? (
                <View
                  style={
                    styles.reportSubmitting
                  }
                >
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.gold
                    }
                  />
                </View>
              ) : null}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(
  colors:
    NovoriColors
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        colors.background,
    },
    header: {
      height: 56,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        14,
      borderBottomWidth:
        1,
      borderBottomColor:
        colors.border,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius:
        20,
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
      fontSize: 20,
      textAlign:
        'center',
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf:
        'center',
      paddingHorizontal:
        20,
      paddingTop: 24,
      paddingBottom:
        90,
    },
    profileHeader: {
      alignItems:
        'center',
    },
    avatar: {
      width: 104,
      height: 104,
      borderRadius: 52,
      backgroundColor:
        colors.elevated,
    },
    avatarFallback: {
      width: 104,
      height: 104,
      borderRadius: 52,
      backgroundColor:
        colors.elevated,
      borderWidth: 1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    avatarText: {
      color:
        colors.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 40,
    },
    name: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 27,
      marginTop: 14,
      textAlign:
        'center',
    },
    username: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 13,
      marginTop: 4,
    },
    privateBadge: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 4,
      backgroundColor:
        colors.elevated,
      borderRadius: 9,
      paddingHorizontal: 7,
      paddingVertical: 4,
      marginTop: 7,
    },
    privateBadgeText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 9,
    },
    bio: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      lineHeight: 20,
      textAlign:
        'center',
      maxWidth: 520,
      marginTop: 12,
    },
    statsRow: {
      flexDirection:
        'row',
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 17,
      marginTop: 22,
      overflow:
        'hidden',
    },
    stat: {
      flex: 1,
      minHeight: 70,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    statNumber: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 16,
    },
    statLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 10,
      marginTop: 4,
    },
    followButton: {
      minHeight: 46,
      backgroundColor:
        colors.gold,
      borderRadius: 14,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 7,
      marginTop: 14,
    },
    followButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 13,
    },
    followButtonSecondary: {
      minHeight: 46,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 14,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 7,
      marginTop: 14,
    },
    followButtonSecondaryText: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 13,
    },
    privateLockedCard: {
      minHeight: 220,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 18,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 28,
      paddingVertical: 30,
      marginTop: 18,
    },
    privateLockedIcon: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom: 13,
    },
    requestPendingText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10,
      marginTop: 13,
      textTransform:
        'uppercase',
      letterSpacing: 0.8,
    },
    tabRow: {
      flexDirection:
        'row',
      borderBottomWidth:
        1,
      borderBottomColor:
        colors.border,
      marginTop: 28,
      marginBottom: 14,
    },
    tabButton: {
      flex: 1,
      alignItems:
        'center',
      paddingVertical:
        12,
      borderBottomWidth:
        2,
      borderBottomColor:
        'transparent',
    },
    tabButtonActive: {
      borderBottomColor:
        colors.gold,
    },
    tabText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 10,
    },
    tabTextActive: {
      color:
        colors.text,
    },
    list: {
      gap: 11,
    },
    publicBookGrid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap: 12,
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
    publicBookCard: {
      width: '31%',
      minWidth: 96,
    },
    publicBookCoverWrap: {
      width: '100%',
      aspectRatio: 0.66,
      borderRadius: 11,
      overflow:
        'hidden',
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      position:
        'relative',
    },
    publicBookCover: {
      width: '100%',
      height: '100%',
    },
    publicBookCoverFallback: {
      width: '100%',
      height: '100%',
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
    },
    publicBookStatus: {
      position:
        'absolute',
      left: 6,
      bottom: 6,
      backgroundColor:
        colors.background,
      borderRadius: 7,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },
    publicBookStatusText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 8,
    },
    publicBookTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
      lineHeight: 15,
      marginTop: 6,
    },
    publicBookAuthor: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 9,
      marginTop: 2,
    },
    reviewCard: {
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 17,
      padding: 13,
    },
    reviewHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },
    reviewCover: {
      width: 46,
      height: 68,
      borderRadius: 7,
      backgroundColor:
        colors.elevated,
      marginRight: 11,
    },
    reviewCoverFallback: {
      width: 46,
      height: 68,
      borderRadius: 7,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },
    reviewBookCopy: {
      flex: 1,
      minWidth: 0,
    },
    reviewTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 13,
      lineHeight: 18,
    },
    reviewAuthor: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      marginTop: 3,
    },
    reviewRatingRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 4,
      marginTop: 6,
    },
    reviewRatingText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
    },
    reviewText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      lineHeight: 18,
      marginTop: 12,
    },
    postCard: {
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 17,
      padding: 15,
    },
    postMetaRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 5,
    },
    postMetaText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 10,
    },
    postTime: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
    },
    postBody: {
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize: 14,
      lineHeight: 21,
      marginTop: 11,
    },
    bookCard: {
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
    bookCover: {
      width: 36,
      height: 52,
      borderRadius: 5,
      backgroundColor:
        colors.surface,
      marginRight: 9,
    },
    bookCoverFallback: {
      width: 36,
      height: 52,
      borderRadius: 5,
      backgroundColor:
        colors.surface,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 9,
    },
    bookCopy: {
      flex: 1,
    },
    bookTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12,
      lineHeight: 17,
    },
    bookRating: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
      marginTop: 4,
    },
    clubCard: {
      minHeight: 72,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 16,
      flexDirection:
        'row',
      alignItems:
        'center',
      padding: 11,
    },
    clubImage: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor:
        colors.elevated,
      marginRight: 11,
    },
    clubImageFallback: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },
    clubInitial: {
      color:
        colors.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 20,
    },
    clubCopy: {
      flex: 1,
      minWidth: 0,
    },
    clubName: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 13,
    },
    clubMeta: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      marginTop: 4,
    },
    emptyCard: {
      minHeight: 190,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 17,
      alignItems:
        'center',
      justifyContent:
        'center',
      padding: 24,
    },
    emptyTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 18,
      marginTop: 10,
      textAlign:
        'center',
    },
    emptyText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      lineHeight: 17,
      textAlign:
        'center',
      marginTop: 6,
      maxWidth: 430,
    },
    centered: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        30,
    },
    errorTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 22,
    },
    errorText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      marginTop: 7,
      textAlign:
        'center',
    },
    profileActionsBackdrop: {
      flex:
        1,
      justifyContent:
        'flex-end',
      backgroundColor:
        'rgba(0,0,0,0.48)',
    },
    profileActionsSheet: {
      width:
        '100%',
      backgroundColor:
        colors.surface,
      borderTopLeftRadius:
        24,
      borderTopRightRadius:
        24,
      paddingHorizontal:
        16,
      paddingTop:
        10,
      overflow:
        'hidden',
    },
    profileActionsHandle: {
      width:
        42,
      height:
        4,
      borderRadius:
        2,
      backgroundColor:
        colors.border,
      alignSelf:
        'center',
      marginBottom:
        13,
    },
    profileActionsTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        19,
      marginBottom:
        12,
    },
    profileActionsRow: {
      minHeight:
        58,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        12,
      paddingHorizontal:
        12,
    },
    profileActionsText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
    },
    profileActionsHint: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12.5,
      lineHeight:
        18,
      marginBottom:
        8,
      paddingHorizontal:
        12,
    },
    profileInviteClubCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    profileInviteClubRole: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
      marginTop:
        2,
    },
    profileActionsDivider: {
      height:
        StyleSheet.hairlineWidth,
      backgroundColor:
        colors.border,
      marginLeft:
        12,
    },
    reportBackdrop: {
      flex: 1,
      backgroundColor:
        'transparent',
      justifyContent:
        'flex-end',
    },
    reportBackdropVisual: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        'rgba(0,0,0,0.52)',
    },
    reportSheet: {
      width: '100%',
      alignSelf:
        'center',
      backgroundColor:
        colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 18,
    },
    reportHandle: {
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor:
        colors.border,
      alignSelf:
        'center',
      marginBottom: 13,
    },
    reportHeadingRow: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      marginBottom: 14,
    },
    reportHeadingCopy: {
      flex: 1,
      paddingRight: 10,
    },
    reportTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 20,
    },
    reportSubtitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      marginTop: 3,
    },
    reportCloseButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    reportReasonList: {
      borderRadius: 16,
      overflow:
        'hidden',
      borderWidth: 1,
      borderColor:
        colors.border,
    },
    reportReasonButton: {
      minHeight: 54,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 12,
      backgroundColor:
        colors.background,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },
    reportReasonButtonPressed: {
      backgroundColor:
        colors.elevated,
    },
    reportReasonIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },
    reportReasonText: {
      flex: 1,
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 13,
    },
    reportPrivacyText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      lineHeight: 15,
      marginTop: 12,
      paddingHorizontal: 3,
    },
    reportSubmitting: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        'rgba(0,0,0,0.28)',
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    pressed: {
      opacity: 0.68,
    },
  });
}
