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
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import BlockReaderConfirmSheet from '../../components/BlockReaderConfirmSheet';
import LeaveClubConfirmSheet from '../../components/LeaveClubConfirmSheet';
import {
  getClubGenreLabel,
} from '../../constants/club-genres';
import { NovoriColors } from '../../constants/novori-theme';
import { useNovoriTheme } from '../../context/theme-context';
import {
  acceptClubInvite,
  approveClubJoinRequest,
  cancelClubInvite,
  cancelPrivateClubRequest,
  ClubInvitation,
  ClubInviteCandidate,
  ClubJoinRequest,
  ClubMember,
  ClubWithMembership,
  declineClubInvite,
  declineClubJoinRequest,
  demoteClubAdmin,
  getClub,
  getClubMembers,
  getPendingClubInvite,
  getPendingClubInvitesForManager,
  getPendingClubJoinRequestsForManager,
  getPendingPrivateClubRequest,
  inviteReaderToClub,
  joinClub,
  kickClubMember,
  leaveClub,
  promoteClubMember,
  requestPrivateClubAccess,
  searchClubInviteCandidates,
} from '../../lib/clubs';
import {
  FeedPost,
  getClubPosts,
  PostVoteValue,
  togglePostVote,
} from '../../lib/feed';
import {
  ReportReason,
  submitProfileReport,
} from '../../lib/reports';
import {
  blockReader,
} from '../../lib/social';
import {
  supabase,
} from '../../lib/supabase';

function roleLabel(role: ClubMember['role']) {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'Member';
}


const MEMBER_REPORT_REASONS:
  Array<{
    value: ReportReason;
    label: string;
    icon:
      keyof typeof Ionicons.glyphMap;
  }> = [
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
        'hate',
      label:
        'Violence, hate, or discrimination',
      icon:
        'warning-outline',
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
        'explicit_content',
      label:
        'Graphic or inappropriate content',
      icon:
        'eye-off-outline',
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

export default function ClubDetailScreen() {
  const router = useRouter();
  const insets =
    useSafeAreaInsets();

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
  const [refreshing, setRefreshing] =
    useState(false);
  const [membershipLoading, setMembershipLoading] =
    useState(false);
  const [
    leaveConfirmVisible,
    setLeaveConfirmVisible,
  ] =
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

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<string | null>(
      null
    );

  const [
    membersExpanded,
    setMembersExpanded,
  ] =
    useState(false);

  const [
    memberActionTarget,
    setMemberActionTarget,
  ] =
    useState<ClubMember | null>(
      null
    );

  const [
    memberReportTarget,
    setMemberReportTarget,
  ] =
    useState<ClubMember | null>(
      null
    );

  const [
    promoteConfirmTarget,
    setPromoteConfirmTarget,
  ] =
    useState<ClubMember | null>(
      null
    );

  const promoteConfirmTranslateY =
    useRef(
      new Animated.Value(
        12
      )
    ).current;

  const promoteConfirmSheetOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const promoteConfirmBackdropOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const promoteConfirmClosing =
    useRef(false);

  const promoteConfirmGestureClosing =
    useRef(false);

  const promoteConfirmSheetHeight =
    useRef(0);

  const [
    demoteConfirmTarget,
    setDemoteConfirmTarget,
  ] =
    useState<ClubMember | null>(
      null
    );

  const demoteConfirmTranslateY =
    useRef(
      new Animated.Value(
        12
      )
    ).current;

  const demoteConfirmSheetOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const demoteConfirmBackdropOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const demoteConfirmClosing =
    useRef(false);

  const demoteConfirmGestureClosing =
    useRef(false);

  const demoteConfirmSheetHeight =
    useRef(0);

  const [
    removeMemberConfirmTarget,
    setRemoveMemberConfirmTarget,
  ] =
    useState<ClubMember | null>(
      null
    );

  const [
    blockConfirmTarget,
    setBlockConfirmTarget,
  ] =
    useState<ClubMember | null>(
      null
    );

  const removeMemberConfirmTranslateY =
    useRef(
      new Animated.Value(
        12
      )
    ).current;

  const removeMemberConfirmSheetOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const removeMemberConfirmBackdropOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const removeMemberConfirmClosing =
    useRef(false);

  const removeMemberConfirmGestureClosing =
    useRef(false);

  const removeMemberConfirmSheetHeight =
    useRef(0);

  const [
    memberActionBusy,
    setMemberActionBusy,
  ] =
    useState(false);

  const [
    memberReportSubmitting,
    setMemberReportSubmitting,
  ] =
    useState(false);

  const memberActionTranslateY =
    useRef(
      new Animated.Value(
        12
      )
    ).current;

  const memberActionSheetOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const memberActionBackdropOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const memberActionAccentOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const memberActionClosing =
    useRef(false);

  const memberActionGestureClosing =
    useRef(false);

  const memberActionSheetHeight =
    useRef(0);

  const preserveClubStateOnNextFocus =
    useRef(false);

  const memberReportTranslateY =
    useRef(
      new Animated.Value(
        12
      )
    ).current;

  const memberReportSheetOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const memberReportBackdropOpacity =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const memberReportClosing =
    useRef(false);

  const [
    pendingInvite,
    setPendingInvite,
  ] =
    useState<ClubInvitation | null>(
      null
    );

  const [
    managerInvites,
    setManagerInvites,
  ] =
    useState<ClubInvitation[]>([]);

  const [
    managerJoinRequests,
    setManagerJoinRequests,
  ] =
    useState<ClubJoinRequest[]>([]);

  const [
    processingJoinRequestId,
    setProcessingJoinRequestId,
  ] =
    useState<string | null>(
      null
    );

  const [
    invitePanelOpen,
    setInvitePanelOpen,
  ] =
    useState(false);

  const [
    inviteQuery,
    setInviteQuery,
  ] =
    useState('');

  const [
    inviteResults,
    setInviteResults,
  ] =
    useState<ClubInviteCandidate[]>([]);

  const [
    inviteSearchLoading,
    setInviteSearchLoading,
  ] =
    useState(false);

  const [
    invitingReaderId,
    setInvitingReaderId,
  ] =
    useState<string | null>(
      null
    );

  const [
    respondingToInvite,
    setRespondingToInvite,
  ] =
    useState(false);

  const [
    cancellingInviteId,
    setCancellingInviteId,
  ] =
    useState<string | null>(
      null
    );

  const [
    pendingJoinRequest,
    setPendingJoinRequest,
  ] =
    useState<ClubJoinRequest | null>(
      null
    );

  const [
    joinRequestLoading,
    setJoinRequestLoading,
  ] =
    useState(false);

  const clubScrollRef =
    useRef<ScrollView | null>(
      null
    );

  const invitePanelY =
    useRef(0);

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

        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        setCurrentUserId(
          user?.id ??
            null
        );

        const clubData =
          await getClub(
            clubId
          );

        const [
          pendingInviteData,
          pendingJoinRequestData,
        ] =
          await Promise.all([
            getPendingClubInvite(
              clubId
            ),
            getPendingPrivateClubRequest(
              clubId
            ),
          ]);

        const canReadPrivateContent =
          clubData.privacy ===
            'public' ||
          Boolean(
            clubData.membership_role
          );

        let memberData:
          ClubMember[] =
            [];

        let postData:
          FeedPost[] =
            [];

        if (
          canReadPrivateContent
        ) {
          const [
            loadedMembers,
            loadedPosts,
          ] =
            await Promise.all([
              getClubMembers(
                clubId
              ),
              getClubPosts(
                clubId
              ),
            ]);

          memberData =
            loadedMembers;

          postData =
            loadedPosts;
        }

        const manager =
          clubData.membership_role ===
            'owner' ||
          clubData.membership_role ===
            'admin';

        const [
          outgoingInvites,
          joinRequests,
        ] =
          manager
            ? await Promise.all([
                getPendingClubInvitesForManager(
                  clubId
                ),
                getPendingClubJoinRequestsForManager(
                  clubId
                ),
              ])
            : [
                [],
                [],
              ];

        setClub(
          clubData
        );
        setMembers(
          memberData
        );
        setClubPosts(
          postData
        );
        setPendingInvite(
          pendingInviteData
        );
        setPendingJoinRequest(
          pendingJoinRequestData
        );
        setManagerInvites(
          outgoingInvites
        );
        setManagerJoinRequests(
          joinRequests
        );
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
      if (
        preserveClubStateOnNextFocus.current
      ) {
        preserveClubStateOnNextFocus.current =
          false;
        return;
      }

      setLoading(true);
      loadClub();
    }, [loadClub])
  );

  const refreshClub =
    useCallback(
      async () => {
        if (
          refreshing
        ) {
          return;
        }

        try {
          setRefreshing(
            true
          );

          await loadClub();
        } finally {
          setRefreshing(
            false
          );
        }
      },
      [
        loadClub,
        refreshing,
      ]
    );

  useEffect(
    () => {
      if (
        !invitePanelOpen ||
        !club
      ) {
        return;
      }

      const normalized =
        inviteQuery.trim();

      if (
        normalized.length <
        2
      ) {
        setInviteResults(
          []
        );
        setInviteSearchLoading(
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
              setInviteSearchLoading(
                true
              );

              const results =
                await searchClubInviteCandidates(
                  club.id,
                  normalized
                );

              if (
                active
              ) {
                setInviteResults(
                  results
                );
              }
            } catch (
              searchError
            ) {
              console.error(
                'Could not search readers for club invite:',
                searchError
              );

              if (
                active
              ) {
                setInviteResults(
                  []
                );
              }
            } finally {
              if (
                active
              ) {
                setInviteSearchLoading(
                  false
                );
              }
            }
          },
          250
        );

      return () => {
        active =
          false;

        clearTimeout(
          timer
        );
      };
    },
    [
      club,
      invitePanelOpen,
      inviteQuery,
    ]
  );

  async function handleJoin() {
    if (!club) return;

    if (
      club.privacy ===
      'private'
    ) {
      Alert.alert(
        'Invite only',
        'Private clubs can only be joined through a club invitation.'
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

  async function handleInviteReader(
    candidate:
      ClubInviteCandidate
  ) {
    if (
      !club ||
      candidate.is_member ||
      candidate.invite_pending ||
      invitingReaderId
    ) {
      return;
    }

    try {
      setInvitingReaderId(
        candidate.id
      );

      await inviteReaderToClub(
        club.id,
        candidate.id
      );

      setInviteResults(
        (
          current
        ) =>
          current.map(
            (
              item
            ) =>
              item.id ===
              candidate.id
                ? {
                    ...item,
                    invite_pending:
                      true,
                  }
                : item
          )
      );

      setManagerInvites(
        await getPendingClubInvitesForManager(
          club.id
        )
      );
    } catch (
      inviteError
    ) {
      console.error(
        'Could not invite reader:',
        inviteError
      );

      Alert.alert(
        'Could not send invite',
        inviteError instanceof
          Error
          ? inviteError.message
          : 'Please try again.'
      );
    } finally {
      setInvitingReaderId(
        null
      );
    }
  }

  async function handleAcceptInvite() {
    if (
      !pendingInvite ||
      respondingToInvite
    ) {
      return;
    }

    try {
      setRespondingToInvite(
        true
      );

      await acceptClubInvite(
        pendingInvite.id
      );

      setPendingInvite(
        null
      );

      await loadClub();
    } catch (
      acceptError
    ) {
      console.error(
        'Could not accept club invite:',
        acceptError
      );

      Alert.alert(
        'Could not accept invitation',
        'Please try again.'
      );
    } finally {
      setRespondingToInvite(
        false
      );
    }
  }

  async function handleDeclineInvite() {
    if (
      !pendingInvite ||
      respondingToInvite
    ) {
      return;
    }

    try {
      setRespondingToInvite(
        true
      );

      await declineClubInvite(
        pendingInvite.id
      );

      setPendingInvite(
        null
      );

      router.back();
    } catch (
      declineError
    ) {
      console.error(
        'Could not decline club invite:',
        declineError
      );

      Alert.alert(
        'Could not decline invitation',
        'Please try again.'
      );
    } finally {
      setRespondingToInvite(
        false
      );
    }
  }

  async function handleCancelInvite(
    invitation:
      ClubInvitation
  ) {
    if (
      !club ||
      cancellingInviteId
    ) {
      return;
    }

    try {
      setCancellingInviteId(
        invitation.id
      );

      await cancelClubInvite(
        invitation.id
      );

      setManagerInvites(
        (
          current
        ) =>
          current.filter(
            (
              item
            ) =>
              item.id !==
              invitation.id
          )
      );

      setInviteResults(
        (
          current
        ) =>
          current.map(
            (
              item
            ) =>
              item.id ===
              invitation.invitee_id
                ? {
                    ...item,
                    invite_pending:
                      false,
                  }
                : item
          )
      );
    } catch (
      cancelError
    ) {
      console.error(
        'Could not cancel club invite:',
        cancelError
      );

      Alert.alert(
        'Could not cancel invitation',
        'Please try again.'
      );
    } finally {
      setCancellingInviteId(
        null
      );
    }
  }

  async function handleRequestAccess() {
    if (
      !club ||
      joinRequestLoading ||
      pendingJoinRequest
    ) {
      return;
    }

    try {
      setJoinRequestLoading(
        true
      );

      const requestId =
        await requestPrivateClubAccess(
          club.id
        );

      setPendingJoinRequest({
        id:
          requestId,
        club_id:
          club.id,
        requester_id:
          '',
        status:
          'pending',
        created_at:
          new Date().toISOString(),
      });
    } catch (
      requestError
    ) {
      console.error(
        'Could not request club access:',
        requestError
      );

      Alert.alert(
        'Could not request access',
        requestError instanceof
          Error
          ? requestError.message
          : 'Please try again.'
      );
    } finally {
      setJoinRequestLoading(
        false
      );
    }
  }

  async function handleCancelAccessRequest() {
    if (
      !pendingJoinRequest ||
      joinRequestLoading
    ) {
      return;
    }

    try {
      setJoinRequestLoading(
        true
      );

      await cancelPrivateClubRequest(
        pendingJoinRequest.id
      );

      setPendingJoinRequest(
        null
      );
    } catch (
      cancelError
    ) {
      console.error(
        'Could not cancel club access request:',
        cancelError
      );

      Alert.alert(
        'Could not cancel request',
        'Please try again.'
      );
    } finally {
      setJoinRequestLoading(
        false
      );
    }
  }

  async function handleApproveJoinRequest(
    request:
      ClubJoinRequest
  ) {
    if (
      processingJoinRequestId
    ) {
      return;
    }

    try {
      setProcessingJoinRequestId(
        request.id
      );

      await approveClubJoinRequest(
        request.id
      );

      setManagerJoinRequests(
        (
          current
        ) =>
          current.filter(
            (
              item
            ) =>
              item.id !==
              request.id
          )
      );

      await loadClub();
    } catch (
      approveError
    ) {
      console.error(
        'Could not approve club join request:',
        approveError
      );

      Alert.alert(
        'Could not approve request',
        'Please try again.'
      );
    } finally {
      setProcessingJoinRequestId(
        null
      );
    }
  }

  async function handleDeclineJoinRequest(
    request:
      ClubJoinRequest
  ) {
    if (
      processingJoinRequestId
    ) {
      return;
    }

    try {
      setProcessingJoinRequestId(
        request.id
      );

      await declineClubJoinRequest(
        request.id
      );

      setManagerJoinRequests(
        (
          current
        ) =>
          current.filter(
            (
              item
            ) =>
              item.id !==
              request.id
          )
      );
    } catch (
      declineError
    ) {
      console.error(
        'Could not decline club join request:',
        declineError
      );

      Alert.alert(
        'Could not decline request',
        'Please try again.'
      );
    } finally {
      setProcessingJoinRequestId(
        null
      );
    }
  }

  function canManageMember(
    member:
      ClubMember
  ) {
    if (
      !club ||
      !currentUserId ||
      member.user_id ===
        currentUserId ||
      member.role ===
        'owner'
    ) {
      return false;
    }

    if (
      club.membership_role ===
      'owner'
    ) {
      return true;
    }

    return (
      club.membership_role ===
        'admin' &&
      member.role ===
        'member'
    );
  }

  function animateMemberActionsIn() {
    memberActionTranslateY.stopAnimation();
    memberActionSheetOpacity.stopAnimation();
    memberActionBackdropOpacity.stopAnimation();
    memberActionAccentOpacity.stopAnimation();

    memberActionTranslateY.setValue(
      12
    );
    memberActionSheetOpacity.setValue(
      0
    );
    memberActionBackdropOpacity.setValue(
      0
    );
    memberActionAccentOpacity.setValue(
      0
    );

    Animated.parallel([
      Animated.timing(
        memberActionTranslateY,
        {
          toValue:
            0,
          duration:
            135,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        memberActionSheetOpacity,
        {
          toValue:
            1,
          duration:
            105,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        memberActionBackdropOpacity,
        {
          toValue:
            1,
          duration:
            125,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        memberActionAccentOpacity,
        {
          toValue:
            1,
          duration:
            70,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start();
  }

  function openMemberActions(
    member:
      ClubMember
  ) {
    if (
      !canManageMember(
        member
      )
    ) {
      return;
    }

    Keyboard.dismiss();

    memberActionClosing.current =
      false;

    setMemberActionTarget(
      member
    );
  }

  function closeMemberActions(
    afterClose?: () => void
  ) {
    if (
      !memberActionTarget ||
      memberActionClosing.current
    ) {
      return;
    }

    memberActionClosing.current =
      true;

    Animated.parallel([
      Animated.timing(
        memberActionTranslateY,
        {
          toValue:
            12,
          duration:
            115,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        memberActionSheetOpacity,
        {
          toValue:
            0,
          duration:
            100,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        memberActionBackdropOpacity,
        {
          toValue:
            0,
          duration:
            120,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        memberActionAccentOpacity,
        {
          toValue:
            0,
          duration:
            90,
          easing:
            Easing.inOut(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(({
      finished,
    }) => {
      memberActionClosing.current =
        false;

      if (
        !finished
      ) {
        return;
      }

      setMemberActionTarget(
        null
      );

      afterClose?.();
    });
  }

  function dismissMemberActionsByGesture() {
    if (
      !memberActionTarget ||
      memberActionClosing.current ||
      memberActionGestureClosing.current
    ) {
      return;
    }

    memberActionGestureClosing.current =
      true;

    memberActionTranslateY.stopAnimation();
    memberActionBackdropOpacity.stopAnimation();
    memberActionAccentOpacity.stopAnimation();

    const offscreenY =
      Math.max(
        memberActionSheetHeight.current +
          32,
        420
      );

    Animated.parallel([
      Animated.timing(
        memberActionTranslateY,
        {
          toValue:
            offscreenY,
          duration:
            190,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        memberActionBackdropOpacity,
        {
          toValue:
            0,
          duration:
            190,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        memberActionAccentOpacity,
        {
          toValue:
            0,
          duration:
            120,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(({
      finished,
    }) => {
      memberActionGestureClosing.current =
        false;

      if (
        !finished
      ) {
        return;
      }

      memberActionTranslateY.setValue(
        12
      );

      memberActionSheetOpacity.setValue(
        0
      );

      setMemberActionTarget(
        null
      );
    });
  }

  const memberActionPanResponder =
    useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (
            _event,
            gesture
          ) =>
            Boolean(
              memberActionTarget
            ) &&
            !memberActionBusy &&
            !memberActionClosing.current &&
            !memberActionGestureClosing.current &&
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
              memberActionTarget
            ) &&
            !memberActionBusy &&
            !memberActionClosing.current &&
            !memberActionGestureClosing.current &&
            gesture.dy >
              10 &&
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
            const nextY =
              Math.max(
                0,
                gesture.dy
              );

            memberActionTranslateY.setValue(
              nextY
            );

            memberActionBackdropOpacity.setValue(
              Math.max(
                0.18,
                1 -
                  nextY /
                    520
              )
            );
          },

          onPanResponderRelease: (
            _event,
            gesture
          ) => {
            if (
              gesture.dy >
                88 ||
              gesture.vy >
                0.72
            ) {
              dismissMemberActionsByGesture();
              return;
            }

            Animated.parallel([
              Animated.spring(
                memberActionTranslateY,
                {
                  toValue:
                    0,
                  damping:
                    24,
                  stiffness:
                    220,
                  mass:
                    0.9,
                  useNativeDriver:
                    true,
                }
              ),
              Animated.timing(
                memberActionBackdropOpacity,
                {
                  toValue:
                    1,
                  duration:
                    120,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver:
                    true,
                }
              ),
            ]).start();
          },

          onPanResponderTerminate: () => {
            Animated.parallel([
              Animated.spring(
                memberActionTranslateY,
                {
                  toValue:
                    0,
                  damping:
                    24,
                  stiffness:
                    220,
                  mass:
                    0.9,
                  useNativeDriver:
                    true,
                }
              ),
              Animated.timing(
                memberActionBackdropOpacity,
                {
                  toValue:
                    1,
                  duration:
                    120,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver:
                    true,
                }
              ),
            ]).start();
          },
        }),
      [
        memberActionBackdropOpacity,
        memberActionBusy,
        memberActionTarget,
        memberActionTranslateY,
      ]
    );

  function animateMemberReportIn() {
    memberReportTranslateY.stopAnimation();
    memberReportSheetOpacity.stopAnimation();
    memberReportBackdropOpacity.stopAnimation();

    memberReportTranslateY.setValue(
      12
    );
    memberReportSheetOpacity.setValue(
      0
    );
    memberReportBackdropOpacity.setValue(
      0
    );

    Animated.parallel([
      Animated.timing(
        memberReportTranslateY,
        {
          toValue:
            0,
          duration:
            135,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        memberReportSheetOpacity,
        {
          toValue:
            1,
          duration:
            105,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        memberReportBackdropOpacity,
        {
          toValue:
            1,
          duration:
            125,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start();
  }

  function closeMemberReport(
    afterClose?: () => void
  ) {
    if (
      !memberReportTarget ||
      memberReportClosing.current ||
      memberReportSubmitting
    ) {
      return;
    }

    memberReportClosing.current =
      true;

    Animated.parallel([
      Animated.timing(
        memberReportTranslateY,
        {
          toValue:
            12,
          duration:
            115,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        memberReportSheetOpacity,
        {
          toValue:
            0,
          duration:
            100,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        memberReportBackdropOpacity,
        {
          toValue:
            0,
          duration:
            120,
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
      memberReportClosing.current =
        false;

      if (
        !finished
      ) {
        return;
      }

      setMemberReportTarget(
        null
      );

      afterClose?.();
    });
  }

  function viewSelectedMember() {
    if (
      !memberActionTarget
    ) {
      return;
    }

    const target =
      memberActionTarget;

    closeMemberActions(
      () => {
        preserveClubStateOnNextFocus.current =
          true;

        openReader(
          target.user_id
        );
      }
    );
  }

  function animatePromoteConfirmIn() {
    promoteConfirmTranslateY.stopAnimation();
    promoteConfirmSheetOpacity.stopAnimation();
    promoteConfirmBackdropOpacity.stopAnimation();

    promoteConfirmTranslateY.setValue(
      12
    );
    promoteConfirmSheetOpacity.setValue(
      0
    );
    promoteConfirmBackdropOpacity.setValue(
      0
    );

    Animated.parallel([
      Animated.timing(
        promoteConfirmTranslateY,
        {
          toValue:
            0,
          duration:
            135,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        promoteConfirmSheetOpacity,
        {
          toValue:
            1,
          duration:
            105,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        promoteConfirmBackdropOpacity,
        {
          toValue:
            1,
          duration:
            125,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start();
  }

  function closePromoteConfirm(
    afterClose?: () => void
  ) {
    if (
      !promoteConfirmTarget ||
      promoteConfirmClosing.current
    ) {
      return;
    }

    promoteConfirmClosing.current =
      true;

    Animated.parallel([
      Animated.timing(
        promoteConfirmTranslateY,
        {
          toValue:
            12,
          duration:
            115,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        promoteConfirmSheetOpacity,
        {
          toValue:
            0,
          duration:
            100,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        promoteConfirmBackdropOpacity,
        {
          toValue:
            0,
          duration:
            120,
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
      promoteConfirmClosing.current =
        false;

      if (
        !finished
      ) {
        return;
      }

      setPromoteConfirmTarget(
        null
      );

      afterClose?.();
    });
  }

  async function confirmPromoteMember() {
    if (
      !club ||
      !promoteConfirmTarget ||
      memberActionBusy
    ) {
      return;
    }

    const target =
      promoteConfirmTarget;

    try {
      setMemberActionBusy(
        true
      );

      await promoteClubMember(
        club.id,
        target.user_id
      );

      closePromoteConfirm(
        () => {
          void loadClub();
        }
      );
    } catch (
      error
    ) {
      console.error(
        'Could not promote club member:',
        error
      );

      Alert.alert(
        'Could not make admin',
        'Please try again.'
      );
    } finally {
      setMemberActionBusy(
        false
      );
    }
  }

  function promoteSelectedMember() {
    if (
      !club ||
      !memberActionTarget ||
      club.membership_role !==
        'owner' ||
      memberActionTarget.role !==
        'member'
    ) {
      return;
    }

    const target =
      memberActionTarget;

    closeMemberActions(
      () => {
        setPromoteConfirmTarget(
          target
        );
      }
    );
  }

  function dismissPromoteConfirmByGesture() {
    if (
      !promoteConfirmTarget ||
      promoteConfirmClosing.current ||
      promoteConfirmGestureClosing.current ||
      memberActionBusy
    ) {
      return;
    }

    promoteConfirmGestureClosing.current =
      true;

    promoteConfirmTranslateY.stopAnimation();
    promoteConfirmBackdropOpacity.stopAnimation();

    const offscreenY =
      Math.max(
        promoteConfirmSheetHeight.current +
          32,
        420
      );

    Animated.parallel([
      Animated.timing(
        promoteConfirmTranslateY,
        {
          toValue:
            offscreenY,
          duration:
            190,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        promoteConfirmBackdropOpacity,
        {
          toValue:
            0,
          duration:
            190,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(({
      finished,
    }) => {
      promoteConfirmGestureClosing.current =
        false;

      if (
        !finished
      ) {
        return;
      }

      promoteConfirmTranslateY.setValue(
        12
      );
      promoteConfirmSheetOpacity.setValue(
        0
      );
      setPromoteConfirmTarget(
        null
      );
    });
  }

  const promoteConfirmPanResponder =
    useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (
            _event,
            gesture
          ) =>
            Boolean(
              promoteConfirmTarget
            ) &&
            !memberActionBusy &&
            !promoteConfirmClosing.current &&
            !promoteConfirmGestureClosing.current &&
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
              promoteConfirmTarget
            ) &&
            !memberActionBusy &&
            !promoteConfirmClosing.current &&
            !promoteConfirmGestureClosing.current &&
            gesture.dy >
              10 &&
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
            const nextY =
              Math.max(
                0,
                gesture.dy
              );

            promoteConfirmTranslateY.setValue(
              nextY
            );

            promoteConfirmBackdropOpacity.setValue(
              Math.max(
                0.18,
                1 -
                  nextY /
                    520
              )
            );
          },

          onPanResponderRelease: (
            _event,
            gesture
          ) => {
            if (
              gesture.dy >
                88 ||
              gesture.vy >
                0.72
            ) {
              dismissPromoteConfirmByGesture();
              return;
            }

            Animated.parallel([
              Animated.spring(
                promoteConfirmTranslateY,
                {
                  toValue:
                    0,
                  damping:
                    24,
                  stiffness:
                    220,
                  mass:
                    0.9,
                  useNativeDriver:
                    true,
                }
              ),
              Animated.timing(
                promoteConfirmBackdropOpacity,
                {
                  toValue:
                    1,
                  duration:
                    120,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver:
                    true,
                }
              ),
            ]).start();
          },

          onPanResponderTerminate: () => {
            Animated.parallel([
              Animated.spring(
                promoteConfirmTranslateY,
                {
                  toValue:
                    0,
                  damping:
                    24,
                  stiffness:
                    220,
                  mass:
                    0.9,
                  useNativeDriver:
                    true,
                }
              ),
              Animated.timing(
                promoteConfirmBackdropOpacity,
                {
                  toValue:
                    1,
                  duration:
                    120,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver:
                    true,
                }
              ),
            ]).start();
          },
        }),
      [
        memberActionBusy,
        promoteConfirmBackdropOpacity,
        promoteConfirmTarget,
        promoteConfirmTranslateY,
      ]
    );

  function animateDemoteConfirmIn() {

    demoteConfirmTranslateY.stopAnimation();
    demoteConfirmSheetOpacity.stopAnimation();
    demoteConfirmBackdropOpacity.stopAnimation();

    demoteConfirmTranslateY.setValue(
      12
    );
    demoteConfirmSheetOpacity.setValue(
      0
    );
    demoteConfirmBackdropOpacity.setValue(
      0
    );

    Animated.parallel([
      Animated.timing(
        demoteConfirmTranslateY,
        {
          toValue:
            0,
          duration:
            135,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        demoteConfirmSheetOpacity,
        {
          toValue:
            1,
          duration:
            105,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        demoteConfirmBackdropOpacity,
        {
          toValue:
            1,
          duration:
            125,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start();
  }

  function closeDemoteConfirm(
    afterClose?: () => void
  ) {
    if (
      !demoteConfirmTarget ||
      demoteConfirmClosing.current
    ) {
      return;
    }

    demoteConfirmClosing.current =
      true;

    Animated.parallel([
      Animated.timing(
        demoteConfirmTranslateY,
        {
          toValue:
            12,
          duration:
            115,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        demoteConfirmSheetOpacity,
        {
          toValue:
            0,
          duration:
            100,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        demoteConfirmBackdropOpacity,
        {
          toValue:
            0,
          duration:
            120,
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
      demoteConfirmClosing.current =
        false;

      if (
        !finished
      ) {
        return;
      }

      setDemoteConfirmTarget(
        null
      );

      afterClose?.();
    });
  }

  function dismissDemoteConfirmByGesture() {
    if (
      !demoteConfirmTarget ||
      demoteConfirmClosing.current ||
      demoteConfirmGestureClosing.current ||
      memberActionBusy
    ) {
      return;
    }

    demoteConfirmGestureClosing.current =
      true;

    demoteConfirmTranslateY.stopAnimation();
    demoteConfirmBackdropOpacity.stopAnimation();

    const offscreenY =
      Math.max(
        demoteConfirmSheetHeight.current +
          32,
        420
      );

    Animated.parallel([
      Animated.timing(
        demoteConfirmTranslateY,
        {
          toValue:
            offscreenY,
          duration:
            190,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        demoteConfirmBackdropOpacity,
        {
          toValue:
            0,
          duration:
            190,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(({
      finished,
    }) => {
      demoteConfirmGestureClosing.current =
        false;

      if (
        !finished
      ) {
        return;
      }

      demoteConfirmTranslateY.setValue(
        12
      );
      demoteConfirmSheetOpacity.setValue(
        0
      );
      setDemoteConfirmTarget(
        null
      );
    });
  }

  const demoteConfirmPanResponder =
    useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (
            _event,
            gesture
          ) =>
            Boolean(
              demoteConfirmTarget
            ) &&
            !memberActionBusy &&
            !demoteConfirmClosing.current &&
            !demoteConfirmGestureClosing.current &&
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
              demoteConfirmTarget
            ) &&
            !memberActionBusy &&
            !demoteConfirmClosing.current &&
            !demoteConfirmGestureClosing.current &&
            gesture.dy >
              10 &&
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
            const nextY =
              Math.max(
                0,
                gesture.dy
              );

            demoteConfirmTranslateY.setValue(
              nextY
            );

            demoteConfirmBackdropOpacity.setValue(
              Math.max(
                0.18,
                1 -
                  nextY /
                    520
              )
            );
          },

          onPanResponderRelease: (
            _event,
            gesture
          ) => {
            if (
              gesture.dy >
                88 ||
              gesture.vy >
                0.72
            ) {
              dismissDemoteConfirmByGesture();
              return;
            }

            Animated.parallel([
              Animated.spring(
                demoteConfirmTranslateY,
                {
                  toValue:
                    0,
                  damping:
                    24,
                  stiffness:
                    220,
                  mass:
                    0.9,
                  useNativeDriver:
                    true,
                }
              ),
              Animated.timing(
                demoteConfirmBackdropOpacity,
                {
                  toValue:
                    1,
                  duration:
                    120,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver:
                    true,
                }
              ),
            ]).start();
          },

          onPanResponderTerminate: () => {
            Animated.parallel([
              Animated.spring(
                demoteConfirmTranslateY,
                {
                  toValue:
                    0,
                  damping:
                    24,
                  stiffness:
                    220,
                  mass:
                    0.9,
                  useNativeDriver:
                    true,
                }
              ),
              Animated.timing(
                demoteConfirmBackdropOpacity,
                {
                  toValue:
                    1,
                  duration:
                    120,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver:
                    true,
                }
              ),
            ]).start();
          },
        }),
      [
        demoteConfirmBackdropOpacity,
        demoteConfirmTarget,
        demoteConfirmTranslateY,
        memberActionBusy,
      ]
    );

  async function confirmDemoteAdmin() {

    if (
      !club ||
      !demoteConfirmTarget ||
      memberActionBusy
    ) {
      return;
    }

    const target =
      demoteConfirmTarget;

    try {
      setMemberActionBusy(
        true
      );

      await demoteClubAdmin(
        club.id,
        target.user_id
      );

      closeDemoteConfirm(
        () => {
          void loadClub();
        }
      );
    } catch (
      error
    ) {
      console.error(
        'Could not demote club admin:',
        error
      );

      Alert.alert(
        'Could not remove admin',
        'Please try again.'
      );
    } finally {
      setMemberActionBusy(
        false
      );
    }
  }

  function demoteSelectedAdmin() {
    if (
      !club ||
      !memberActionTarget ||
      club.membership_role !==
        'owner' ||
      memberActionTarget.role !==
        'admin'
    ) {
      return;
    }

    const target =
      memberActionTarget;

    closeMemberActions(
      () => {
        setDemoteConfirmTarget(
          target
        );
      }
    );
  }

  function animateRemoveMemberConfirmIn() {
    removeMemberConfirmTranslateY.stopAnimation();
    removeMemberConfirmSheetOpacity.stopAnimation();
    removeMemberConfirmBackdropOpacity.stopAnimation();

    removeMemberConfirmTranslateY.setValue(
      12
    );
    removeMemberConfirmSheetOpacity.setValue(
      0
    );
    removeMemberConfirmBackdropOpacity.setValue(
      0
    );

    Animated.parallel([
      Animated.timing(
        removeMemberConfirmTranslateY,
        {
          toValue:
            0,
          duration:
            135,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        removeMemberConfirmSheetOpacity,
        {
          toValue:
            1,
          duration:
            105,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        removeMemberConfirmBackdropOpacity,
        {
          toValue:
            1,
          duration:
            125,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start();
  }

  function closeRemoveMemberConfirm(
    afterClose?: () => void
  ) {
    if (
      !removeMemberConfirmTarget ||
      removeMemberConfirmClosing.current
    ) {
      return;
    }

    removeMemberConfirmClosing.current =
      true;

    Animated.parallel([
      Animated.timing(
        removeMemberConfirmTranslateY,
        {
          toValue:
            12,
          duration:
            115,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        removeMemberConfirmSheetOpacity,
        {
          toValue:
            0,
          duration:
            100,
          easing:
            Easing.in(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        removeMemberConfirmBackdropOpacity,
        {
          toValue:
            0,
          duration:
            120,
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
      removeMemberConfirmClosing.current =
        false;

      if (
        !finished
      ) {
        return;
      }

      setRemoveMemberConfirmTarget(
        null
      );

      afterClose?.();
    });
  }

  function dismissRemoveMemberConfirmByGesture() {
    if (
      !removeMemberConfirmTarget ||
      removeMemberConfirmClosing.current ||
      removeMemberConfirmGestureClosing.current ||
      memberActionBusy
    ) {
      return;
    }

    removeMemberConfirmGestureClosing.current =
      true;

    removeMemberConfirmTranslateY.stopAnimation();
    removeMemberConfirmBackdropOpacity.stopAnimation();

    const offscreenY =
      Math.max(
        removeMemberConfirmSheetHeight.current +
          32,
        420
      );

    Animated.parallel([
      Animated.timing(
        removeMemberConfirmTranslateY,
        {
          toValue:
            offscreenY,
          duration:
            190,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
      Animated.timing(
        removeMemberConfirmBackdropOpacity,
        {
          toValue:
            0,
          duration:
            190,
          easing:
            Easing.out(
              Easing.cubic
            ),
          useNativeDriver:
            true,
        }
      ),
    ]).start(({
      finished,
    }) => {
      removeMemberConfirmGestureClosing.current =
        false;

      if (
        !finished
      ) {
        return;
      }

      removeMemberConfirmTranslateY.setValue(
        12
      );
      removeMemberConfirmSheetOpacity.setValue(
        0
      );

      setRemoveMemberConfirmTarget(
        null
      );
    });
  }

  const removeMemberConfirmPanResponder =
    useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (
            _event,
            gesture
          ) =>
            Boolean(
              removeMemberConfirmTarget
            ) &&
            !memberActionBusy &&
            !removeMemberConfirmClosing.current &&
            !removeMemberConfirmGestureClosing.current &&
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
              removeMemberConfirmTarget
            ) &&
            !memberActionBusy &&
            !removeMemberConfirmClosing.current &&
            !removeMemberConfirmGestureClosing.current &&
            gesture.dy >
              10 &&
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
            const nextY =
              Math.max(
                0,
                gesture.dy
              );

            removeMemberConfirmTranslateY.setValue(
              nextY
            );

            removeMemberConfirmBackdropOpacity.setValue(
              Math.max(
                0.18,
                1 -
                  nextY /
                    520
              )
            );
          },

          onPanResponderRelease: (
            _event,
            gesture
          ) => {
            if (
              gesture.dy >
                88 ||
              gesture.vy >
                0.72
            ) {
              dismissRemoveMemberConfirmByGesture();
              return;
            }

            Animated.parallel([
              Animated.spring(
                removeMemberConfirmTranslateY,
                {
                  toValue:
                    0,
                  damping:
                    24,
                  stiffness:
                    220,
                  mass:
                    0.9,
                  useNativeDriver:
                    true,
                }
              ),
              Animated.timing(
                removeMemberConfirmBackdropOpacity,
                {
                  toValue:
                    1,
                  duration:
                    120,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver:
                    true,
                }
              ),
            ]).start();
          },

          onPanResponderTerminate: () => {
            Animated.parallel([
              Animated.spring(
                removeMemberConfirmTranslateY,
                {
                  toValue:
                    0,
                  damping:
                    24,
                  stiffness:
                    220,
                  mass:
                    0.9,
                  useNativeDriver:
                    true,
                }
              ),
              Animated.timing(
                removeMemberConfirmBackdropOpacity,
                {
                  toValue:
                    1,
                  duration:
                    120,
                  easing:
                    Easing.out(
                      Easing.cubic
                    ),
                  useNativeDriver:
                    true,
                }
              ),
            ]).start();
          },
        }),
      [
        memberActionBusy,
        removeMemberConfirmBackdropOpacity,
        removeMemberConfirmTarget,
        removeMemberConfirmTranslateY,
      ]
    );

  async function confirmRemoveMember() {
    if (
      !club ||
      !removeMemberConfirmTarget ||
      memberActionBusy
    ) {
      return;
    }

    const target =
      removeMemberConfirmTarget;

    try {
      setMemberActionBusy(
        true
      );

      await kickClubMember(
        club.id,
        target.user_id
      );

      closeRemoveMemberConfirm(
        () => {
          void loadClub();
        }
      );
    } catch (
      error
    ) {
      console.error(
        'Could not remove club member:',
        error
      );

      Alert.alert(
        'Could not remove member',
        'Please try again.'
      );
    } finally {
      setMemberActionBusy(
        false
      );
    }
  }

  function kickSelectedMember() {
    if (
      !club ||
      !memberActionTarget
    ) {
      return;
    }

    const target =
      memberActionTarget;

    closeMemberActions(
      () => {
        setRemoveMemberConfirmTarget(
          target
        );
      }
    );
  }

  async function confirmBlockMember() {
    if (
      !club ||
      !blockConfirmTarget ||
      memberActionBusy
    ) {
      return;
    }

    try {
      setMemberActionBusy(
        true
      );

      await kickClubMember(
        club.id,
        blockConfirmTarget.user_id
      );

      await blockReader(
        blockConfirmTarget.user_id
      );

      await loadClub();
    } catch (
      error
    ) {
      console.error(
        'Could not block club member:',
        error
      );

      Alert.alert(
        'Could not block reader',
        'Please try again.'
      );

      throw error;
    } finally {
      setMemberActionBusy(
        false
      );
    }
  }

  function blockSelectedMember() {
    if (
      !club ||
      !memberActionTarget
    ) {
      return;
    }

    const target =
      memberActionTarget;

    closeMemberActions(
      () => {
        setBlockConfirmTarget(
          target
        );
      }
    );
  }

  function reportSelectedMember() {
    if (
      !memberActionTarget
    ) {
      return;
    }

    const target =
      memberActionTarget;

    closeMemberActions(
      () => {
        setMemberReportTarget(
          target
        );
      }
    );
  }

  async function handleMemberReport(
    reason:
      ReportReason
  ) {
    if (
      !memberReportTarget ||
      memberReportSubmitting
    ) {
      return;
    }

    try {
      setMemberReportSubmitting(
        true
      );

      await submitProfileReport(
        memberReportTarget.user_id,
        reason
      );

      setMemberReportSubmitting(
        false
      );

      closeMemberReport(
        () => {
          Alert.alert(
            'Report submitted',
            'Thanks for letting us know. The reader has been added to the moderation queue.'
          );
        }
      );
    } catch (
      error
    ) {
      console.error(
        'Could not report club member:',
        error
      );

      setMemberReportSubmitting(
        false
      );

      Alert.alert(
        'Could not submit report',
        'Please try again.'
      );
    }
  }

  function confirmLeave() {
    if (
      !club ||
      membershipLoading
    ) {
      return;
    }

    setLeaveConfirmVisible(
      true
    );
  }

  async function handleLeave() {
    if (
      !club ||
      membershipLoading
    ) {
      return;
    }

    try {
      setMembershipLoading(
        true
      );

      await leaveClub(
        club.id
      );

      await loadClub();
    } catch (
      leaveError
    ) {
      console.error(
        'Could not leave club:',
        leaveError
      );

      Alert.alert(
        'Could not leave club',
        leaveError instanceof Error
          ? leaveError.message
          : 'Please try again.'
      );

      throw leaveError;
    } finally {
      setMembershipLoading(
        false
      );
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
    if (
      post.is_blocked_author
    ) {
      return (
        <View
          key={
            post.id
          }
          style={[
            styles.postCard,
            styles.blockedPostCard,
          ]}
        >
          <View
            style={
              styles.blockedPostRow
            }
          >
            <View
              style={
                styles.blockedPostIcon
              }
            >
              <Ionicons
                name="ban-outline"
                size={
                  18
                }
                color={
                  colors.mutedText
                }
              />
            </View>

            <View
              style={
                styles.blockedPostCopy
              }
            >
              <Text
                style={
                  styles.blockedPostTitle
                }
              >
                Blocked reader
              </Text>

              <Text
                style={
                  styles.blockedPostText
                }
              >
                This club post is hidden.
              </Text>
            </View>
          </View>
        </View>
      );
    }

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
        onPress={() => {
          preserveClubStateOnNextFocus.current =
            true;

          openReader(
            member.user_id
          );
        }}
        onLongPress={() =>
          openMemberActions(
            member
          )
        }
        delayLongPress={
          220
        }
        style={({ pressed }) => [
          styles.memberRow,
          memberActionTarget?.user_id ===
            member.user_id &&
            styles.memberRowSelected,
          pressed &&
            styles.pressed,
        ]}
      >
        {memberActionTarget?.user_id ===
        member.user_id ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.memberActionAccent,
              {
                opacity:
                  memberActionAccentOpacity,
              },
            ]}
          />
        ) : null}
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

  function renderInviteCandidate(
    candidate:
      ClubInviteCandidate
  ) {
    const displayName =
      candidate.display_name
        ?.trim() ||
      candidate.username
        ?.trim() ||
      'Novori Reader';

    const username =
      candidate.username
        ?.trim()
        ? `@${candidate.username.trim()}`
        : '';

    const initial =
      displayName
        .charAt(0)
        .toUpperCase();

    const busy =
      invitingReaderId ===
      candidate.id;

    const disabled =
      busy ||
      candidate.is_member ||
      candidate.invite_pending;

    return (
      <View
        key={
          candidate.id
        }
        style={
          styles.inviteReaderRow
        }
      >
        <Pressable
          onPress={() => {
            preserveClubStateOnNextFocus.current =
              true;

            openReader(
              candidate.id
            );
          }}
          style={({ pressed }) => [
            styles.inviteReaderIdentity,
            pressed &&
              styles.pressed,
          ]}
        >
          {candidate.avatar_url ? (
            <Image
              source={{
                uri:
                  candidate.avatar_url,
              }}
              style={
                styles.inviteReaderAvatar
              }
            />
          ) : (
            <View
              style={
                styles.inviteReaderAvatarFallback
              }
            >
              <Text
                style={
                  styles.inviteReaderAvatarText
                }
              >
                {initial}
              </Text>
            </View>
          )}

          <View
            style={
              styles.inviteReaderCopy
            }
          >
            <Text
              style={
                styles.inviteReaderName
              }
              numberOfLines={
                1
              }
            >
              {displayName}
            </Text>

            {username ? (
              <Text
                style={
                  styles.inviteReaderUsername
                }
                numberOfLines={
                  1
                }
              >
                {username}
              </Text>
            ) : null}
          </View>
        </Pressable>

        <Pressable
          disabled={
            disabled
          }
          onPress={() =>
            handleInviteReader(
              candidate
            )
          }
          style={({ pressed }) => [
            styles.inviteReaderButton,
            (
              candidate.is_member ||
              candidate.invite_pending
            ) &&
              styles.inviteReaderButtonDisabled,
            pressed &&
              !disabled &&
              styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator
              size="small"
              color={
                colors.background
              }
            />
          ) : (
            <Text
              style={[
                styles.inviteReaderButtonText,
                (
                  candidate.is_member ||
                  candidate.invite_pending
                ) &&
                  styles.inviteReaderButtonTextDisabled,
              ]}
            >
              {candidate.is_member
                ? 'Member'
                : candidate.invite_pending
                ? 'Invited'
                : 'Invite'}
            </Text>
          )}
        </Pressable>
      </View>
    );
  }

  function renderManagerJoinRequest(
    request:
      ClubJoinRequest
  ) {
    const displayName =
      request.display_name
        ?.trim() ||
      request.username
        ?.trim() ||
      'Novori Reader';

    const username =
      request.username
        ?.trim()
        ? `@${request.username.trim()}`
        : '';

    const initial =
      displayName
        .charAt(0)
        .toUpperCase();

    const busy =
      processingJoinRequestId ===
      request.id;

    return (
      <View
        key={
          request.id
        }
        style={
          styles.joinRequestRow
        }
      >
        <Pressable
          onPress={() =>
            openReader(
              request.requester_id
            )
          }
          style={({ pressed }) => [
            styles.joinRequestIdentity,
            pressed &&
              styles.pressed,
          ]}
        >
          {request.avatar_url ? (
            <Image
              source={{
                uri:
                  request.avatar_url,
              }}
              style={
                styles.joinRequestAvatar
              }
            />
          ) : (
            <View
              style={
                styles.joinRequestAvatarFallback
              }
            >
              <Text
                style={
                  styles.joinRequestAvatarText
                }
              >
                {initial}
              </Text>
            </View>
          )}

          <View
            style={
              styles.joinRequestCopy
            }
          >
            <Text
              style={
                styles.joinRequestName
              }
              numberOfLines={
                1
              }
            >
              {displayName}
            </Text>

            <Text
              style={
                styles.joinRequestMeta
              }
              numberOfLines={
                1
              }
            >
              {username
                ? `${username} · wants to join`
                : 'Wants to join'}
            </Text>
          </View>
        </Pressable>

        <View
          style={
            styles.joinRequestActions
          }
        >
          <Pressable
            disabled={
              Boolean(
                processingJoinRequestId
              )
            }
            onPress={() =>
              handleDeclineJoinRequest(
                request
              )
            }
            style={({ pressed }) => [
              styles.joinRequestDeclineButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.joinRequestDeclineText
              }
            >
              Decline
            </Text>
          </Pressable>

          <Pressable
            disabled={
              Boolean(
                processingJoinRequestId
              )
            }
            onPress={() =>
              handleApproveJoinRequest(
                request
              )
            }
            style={({ pressed }) => [
              styles.joinRequestApproveButton,
              pressed &&
                styles.pressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.background
                }
              />
            ) : (
              <Text
                style={
                  styles.joinRequestApproveText
                }
              >
                Accept
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  function renderManagerInvite(
    invitation:
      ClubInvitation
  ) {
    const displayName =
      invitation.display_name
        ?.trim() ||
      invitation.username
        ?.trim() ||
      'Novori Reader';

    const username =
      invitation.username
        ?.trim()
        ? `@${invitation.username.trim()}`
        : '';

    const initial =
      displayName
        .charAt(0)
        .toUpperCase();

    const busy =
      cancellingInviteId ===
      invitation.id;

    return (
      <View
        key={
          invitation.id
        }
        style={
          styles.pendingInviteRow
        }
      >
        {invitation.avatar_url ? (
          <Image
            source={{
              uri:
                invitation.avatar_url,
            }}
            style={
              styles.pendingInviteAvatar
            }
          />
        ) : (
          <View
            style={
              styles.pendingInviteAvatarFallback
            }
          >
            <Text
              style={
                styles.pendingInviteAvatarText
              }
            >
              {initial}
            </Text>
          </View>
        )}

        <View
          style={
            styles.pendingInviteCopy
          }
        >
          <Text
            style={
              styles.pendingInviteName
            }
            numberOfLines={
              1
            }
          >
            {displayName}
          </Text>

          <Text
            style={
              styles.pendingInviteMeta
            }
            numberOfLines={
              1
            }
          >
            {username
              ? `${username} · Pending`
              : 'Invitation pending'}
          </Text>
        </View>

        <Pressable
          disabled={
            Boolean(
              cancellingInviteId
            )
          }
          onPress={() =>
            handleCancelInvite(
              invitation
            )
          }
          hitSlop={
            8
          }
          style={({ pressed }) => [
            styles.cancelInviteButton,
            pressed &&
              styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator
              size="small"
              color={
                colors.mutedText
              }
            />
          ) : (
            <Text
              style={
                styles.cancelInviteText
              }
            >
              Cancel
            </Text>
          )}
        </Pressable>
      </View>
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

  const isManager =
    role === 'owner' ||
    role === 'admin';

  const isMember =
    Boolean(role);

  const ownerMember =
    members.find(
      (
        member
      ) =>
        member.role ===
        'owner'
    ) ??
    members[0] ??
    null;

  const otherMembers =
    ownerMember
      ? members.filter(
          (
            member
          ) =>
            member.user_id !==
            ownerMember.user_id
        )
      : [];

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
        ref={
          clubScrollRef
        }
        contentContainerStyle={[
          styles.content,
          invitePanelOpen &&
            styles.contentInviteOpen,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              refreshClub
            }
            tintColor={
              colors.gold
            }
            colors={[
              colors.gold,
            ]}
            progressBackgroundColor={
              colors.surface
            }
          />
        }
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

        {pendingInvite &&
        !isMember ? (
          <View
            style={
              styles.invitationCard
            }
          >
            <View
              style={
                styles.invitationIcon
              }
            >
              <Ionicons
                name="mail-unread-outline"
                size={
                  21
                }
                color={
                  colors.gold
                }
              />
            </View>

            <View
              style={
                styles.invitationCopy
              }
            >
              <Text
                style={
                  styles.invitationTitle
                }
              >
                You’re invited
              </Text>

              <Text
                style={
                  styles.invitationText
                }
              >
                {pendingInvite.inviter_display_name
                  ?.trim() ||
                  pendingInvite.inviter_username
                    ?.trim() ||
                  'A club manager'}{' '}
                invited you to join{' '}
                {club.name}.
              </Text>
            </View>

            <View
              style={
                styles.invitationActions
              }
            >
              <Pressable
                disabled={
                  respondingToInvite
                }
                onPress={
                  handleDeclineInvite
                }
                style={({ pressed }) => [
                  styles.invitationDeclineButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.invitationDeclineText
                  }
                >
                  Decline
                </Text>
              </Pressable>

              <Pressable
                disabled={
                  respondingToInvite
                }
                onPress={
                  handleAcceptInvite
                }
                style={({ pressed }) => [
                  styles.invitationAcceptButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                {respondingToInvite ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.background
                    }
                  />
                ) : (
                  <Text
                    style={
                      styles.invitationAcceptText
                    }
                  >
                    Accept
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}

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
        ) : pendingInvite ? (
          null
        ) : club.privacy ===
          'private' ? (
          <Pressable
            disabled={
              joinRequestLoading
            }
            onPress={
              pendingJoinRequest
                ? handleCancelAccessRequest
                : handleRequestAccess
            }
            style={({ pressed }) => [
              styles.requestAccessButton,
              pendingJoinRequest &&
                styles.requestAccessButtonPending,
              pressed &&
                styles.pressed,
            ]}
          >
            {joinRequestLoading ? (
              <ActivityIndicator
                size="small"
                color={
                  pendingJoinRequest
                    ? colors.mutedText
                    : colors.background
                }
              />
            ) : (
              <>
                <Ionicons
                  name={
                    pendingJoinRequest
                      ? 'time-outline'
                      : 'lock-open-outline'
                  }
                  size={
                    18
                  }
                  color={
                    pendingJoinRequest
                      ? colors.mutedText
                      : colors.background
                  }
                />

                <Text
                  style={[
                    styles.requestAccessButtonText,
                    pendingJoinRequest &&
                      styles.requestAccessButtonTextPending,
                  ]}
                >
                  {pendingJoinRequest
                    ? 'Request Sent · Tap to Cancel'
                    : 'Request Access'}
                </Text>
              </>
            )}
          </Pressable>
        ) : (
          <Pressable
            disabled={
              membershipLoading
            }
            onPress={handleJoin}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed &&
                styles.pressed,
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
                  name="add"
                  size={18}
                  color={colors.background}
                />

                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Join Club
                </Text>
              </>
            )}
          </Pressable>
        )}

        {isManager &&
        managerJoinRequests.length >
          0 ? (
          <View
            style={
              styles.joinRequestsSection
            }
          >
            <View
              style={
                styles.joinRequestsHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.joinRequestsTitle
                  }
                >
                  Join Requests
                </Text>

                <Text
                  style={
                    styles.joinRequestsSubtitle
                  }
                >
                  Readers waiting for access to this private club.
                </Text>
              </View>

              <View
                style={
                  styles.joinRequestsBadge
                }
              >
                <Text
                  style={
                    styles.joinRequestsBadgeText
                  }
                >
                  {
                    managerJoinRequests.length
                  }
                </Text>
              </View>
            </View>

            <View
              style={
                styles.joinRequestsCard
              }
            >
              {managerJoinRequests.map(
                renderManagerJoinRequest
              )}
            </View>
          </View>
        ) : null}

        {isManager ? (
          <View
            onLayout={(event) => {
              invitePanelY.current =
                event.nativeEvent.layout.y;
            }}
            style={
              styles.inviteSection
            }
          >
            <Pressable
              onPress={() => {
                setInvitePanelOpen(
                  (
                    current
                  ) =>
                    !current
                );

                if (
                  invitePanelOpen
                ) {
                  setInviteQuery(
                    ''
                  );
                  setInviteResults(
                    []
                  );
                }
              }}
              style={({ pressed }) => [
                styles.inviteToggleButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={
                  styles.inviteToggleIcon
                }
              >
                <Ionicons
                  name="person-add-outline"
                  size={
                    18
                  }
                  color={
                    colors.gold
                  }
                />
              </View>

              <View
                style={
                  styles.inviteToggleCopy
                }
              >
                <Text
                  style={
                    styles.inviteToggleTitle
                  }
                >
                  Invite Readers
                </Text>

                <Text
                  style={
                    styles.inviteToggleText
                  }
                >
                  Search Novori and invite readers to this club.
                </Text>
              </View>

              <Ionicons
                name={
                  invitePanelOpen
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={
                  18
                }
                color={
                  colors.mutedText
                }
              />
            </Pressable>

            {invitePanelOpen ? (
              <View
                style={
                  styles.invitePanel
                }
              >
                <View
                  style={
                    styles.inviteSearchWrap
                  }
                >
                  <Ionicons
                    name="search-outline"
                    size={
                      18
                    }
                    color={
                      colors.mutedText
                    }
                  />

                  <TextInput
                    value={
                      inviteQuery
                    }
                    onChangeText={
                      setInviteQuery
                    }
                    placeholder="Search by name or @username"
                    placeholderTextColor={
                      colors.mutedText
                    }
                    autoCapitalize="none"
                    autoCorrect={
                      false
                    }
                    returnKeyType="search"
                    onFocus={() => {
                      requestAnimationFrame(
                        () => {
                          const targetY =
                            Math.max(
                              0,
                              invitePanelY.current -
                                12
                            );

                          clubScrollRef.current?.scrollTo({
                            y:
                              targetY,
                            animated:
                              true,
                          });

                          setTimeout(
                            () => {
                              clubScrollRef.current?.scrollTo({
                                y:
                                  targetY,
                                animated:
                                  true,
                              });
                            },
                            220
                          );
                        }
                      );
                    }}
                    style={
                      styles.inviteSearchInput
                    }
                  />

                  {inviteSearchLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        colors.gold
                      }
                    />
                  ) : inviteQuery ? (
                    <Pressable
                      onPress={() => {
                        setInviteQuery(
                          ''
                        );
                        setInviteResults(
                          []
                        );
                      }}
                      hitSlop={
                        8
                      }
                    >
                      <Ionicons
                        name="close-circle"
                        size={
                          18
                        }
                        color={
                          colors.mutedText
                        }
                      />
                    </Pressable>
                  ) : null}
                </View>

                {inviteQuery.trim().length <
                2 ? (
                  <Text
                    style={
                      styles.inviteSearchHint
                    }
                  >
                    Enter at least two characters to search.
                  </Text>
                ) : !inviteSearchLoading &&
                  inviteResults.length ===
                    0 ? (
                  <Text
                    style={
                      styles.inviteSearchHint
                    }
                  >
                    No matching readers found.
                  </Text>
                ) : (
                  <ScrollView
                    style={
                      styles.inviteResults
                    }
                    contentContainerStyle={
                      styles.inviteResultsContent
                    }
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={
                      inviteResults.length >
                      4
                    }
                  >
                    {inviteResults.map(
                      renderInviteCandidate
                    )}
                  </ScrollView>
                )}
              </View>
            ) : null}

            {managerInvites.length >
            0 ? (
              <View
                style={
                  styles.pendingInvitesBlock
                }
              >
                <View
                  style={
                    styles.pendingInvitesHeader
                  }
                >
                  <Text
                    style={
                      styles.pendingInvitesTitle
                    }
                  >
                    Pending invitations
                  </Text>

                  <Text
                    style={
                      styles.pendingInvitesCount
                    }
                  >
                    {
                      managerInvites.length
                    }
                  </Text>
                </View>

                <View
                  style={
                    styles.pendingInvitesCard
                  }
                >
                  {managerInvites.map(
                    renderManagerInvite
                  )}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

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

        {club.privacy ===
          'private' &&
        !isMember ? (
          <View
            style={
              styles.privatePreviewCard
            }
          >
            <Ionicons
              name="lock-closed-outline"
              size={
                24
              }
              color={
                colors.gold
              }
            />

            <Text
              style={
                styles.privatePreviewTitle
              }
            >
              Members-only activity
            </Text>

            <Text
              style={
                styles.privatePreviewText
              }
            >
              {pendingInvite
                ? 'Accept the invitation to see members and posts inside this private club.'
                : pendingJoinRequest
                ? 'Your access request is pending. Club members and posts stay private until a manager approves it.'
                : 'Request access to join this private club. Members and posts stay hidden until you are approved.'}
            </Text>
          </View>
        ) : (
          <>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Members
          </Text>

          <Text style={styles.sectionMeta}>
            {members.length}
          </Text>
        </View>

        <View style={styles.card}>
          {ownerMember ? (
            <>
              {renderMember(
                ownerMember
              )}

              {otherMembers.length >
              0 ? (
                <>
                  {membersExpanded ? (
                    <>
                      {otherMembers.map(
                        (
                          member
                        ) => (
                          <View
                            key={
                              member.user_id
                            }
                          >
                            <View
                              style={
                                styles.rowDivider
                              }
                            />

                            {renderMember(
                              member
                            )}
                          </View>
                        )
                      )}
                    </>
                  ) : null}

                  <View
                    style={
                      styles.rowDivider
                    }
                  />

                  <Pressable
                    onPress={() =>
                      setMembersExpanded(
                        (
                          current
                        ) =>
                          !current
                      )
                    }
                    style={({ pressed }) => [
                      styles.membersExpandRow,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <Text
                      style={
                        styles.membersExpandText
                      }
                    >
                      {membersExpanded
                        ? 'Hide members'
                        : `Show ${otherMembers.length} more ${
                            otherMembers.length ===
                            1
                              ? 'member'
                              : 'members'
                          }`}
                    </Text>

                    <Ionicons
                      name={
                        membersExpanded
                          ? 'chevron-up'
                          : 'chevron-down'
                      }
                      size={
                        17
                      }
                      color={
                        colors.mutedText
                      }
                    />
                  </Pressable>
                </>
              ) : null}
            </>
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
          </>
        )}
      </ScrollView>

      <Modal
        visible={
          Boolean(
            memberActionTarget
          )
        }
        transparent
        animationType="none"
        onShow={
          animateMemberActionsIn
        }
        onRequestClose={() =>
          closeMemberActions()
        }
      >
        <Pressable
          style={
            styles.memberActionBackdrop
          }
          onPress={() =>
            closeMemberActions()
          }
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.memberActionBackdropVisual,
              {
                opacity:
                  memberActionBackdropOpacity,
              },
            ]}
          />

          <Animated.View
            {...memberActionPanResponder.panHandlers}
            onLayout={(event) => {
              memberActionSheetHeight.current =
                event.nativeEvent.layout.height;
            }}
            style={[
              styles.memberActionSheet,
              {
                paddingBottom:
                  Math.max(
                    18,
                    insets.bottom +
                      12
                  ),
                opacity:
                  memberActionSheetOpacity,
                transform: [
                  {
                    translateY:
                      memberActionTranslateY,
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
                  styles.memberActionHandle
                }
              />

              <Text
                style={
                  styles.memberActionTitle
                }
              >
                Member options
              </Text>

              <Text
                style={
                  styles.memberActionSubtitle
                }
                numberOfLines={
                  1
                }
              >
                Manage ${
                  memberActionTarget?.display_name
                    ?.trim() ||
                  memberActionTarget?.username
                    ?.trim() ||
                  'this reader'
                } in this club.
              </Text>

              <View
                style={
                  styles.memberActionList
                }
              >
                <Pressable
                  disabled={
                    memberActionBusy
                  }
                  onPress={
                    viewSelectedMember
                  }
                  style={({ pressed }) => [
                    styles.memberActionButton,
                    pressed &&
                      styles.memberActionButtonPressed,
                  ]}
                >
                  <View
                    style={
                      styles.memberActionRowIcon
                    }
                  >
                    <Ionicons
                      name="person-outline"
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
                      styles.memberActionButtonText
                    }
                  >
                    View profile
                  </Text>
                </Pressable>

                {club.membership_role ===
                  'owner' &&
                memberActionTarget?.role ===
                  'member' ? (
                  <Pressable
                    disabled={
                      memberActionBusy
                    }
                    onPress={
                      promoteSelectedMember
                    }
                    style={({ pressed }) => [
                      styles.memberActionButton,
                      pressed &&
                        styles.memberActionButtonPressed,
                    ]}
                  >
                    <View
                      style={
                        styles.memberActionRowIcon
                      }
                    >
                      <Ionicons
                        name="shield-checkmark-outline"
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
                        styles.memberActionButtonText
                      }
                    >
                      Make admin
                    </Text>
                  </Pressable>
                ) : null}

                {club.membership_role ===
                  'owner' &&
                memberActionTarget?.role ===
                  'admin' ? (
                  <Pressable
                    disabled={
                      memberActionBusy
                    }
                    onPress={
                      demoteSelectedAdmin
                    }
                    style={({ pressed }) => [
                      styles.memberActionButton,
                      pressed &&
                        styles.memberActionButtonPressed,
                    ]}
                  >
                    <View
                      style={
                        styles.memberActionRowIcon
                      }
                    >
                      <Ionicons
                        name="shield-outline"
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
                        styles.memberActionButtonText
                      }
                    >
                      Remove admin role
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  disabled={
                    memberActionBusy
                  }
                  onPress={
                    kickSelectedMember
                  }
                  style={({ pressed }) => [
                    styles.memberActionButton,
                    pressed &&
                      styles.memberActionButtonPressed,
                  ]}
                >
                  <View
                    style={
                      styles.memberActionRowIcon
                    }
                  >
                    <Ionicons
                      name="exit-outline"
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
                      styles.memberActionButtonText
                    }
                  >
                    Remove from club
                  </Text>
                </Pressable>

                <Pressable
                  disabled={
                    memberActionBusy
                  }
                  onPress={
                    blockSelectedMember
                  }
                  style={({ pressed }) => [
                    styles.memberActionButton,
                    pressed &&
                      styles.memberActionButtonPressed,
                  ]}
                >
                  <View
                    style={
                      styles.memberActionRowIcon
                    }
                  >
                    <Ionicons
                      name="ban-outline"
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
                      styles.memberActionButtonText
                    }
                  >
                    Block reader
                  </Text>
                </Pressable>

                <Pressable
                  disabled={
                    memberActionBusy
                  }
                  onPress={
                    reportSelectedMember
                  }
                  style={({ pressed }) => [
                    styles.memberActionButton,
                    pressed &&
                      styles.memberActionButtonPressed,
                  ]}
                >
                  <View
                    style={
                      styles.memberActionRowIcon
                    }
                  >
                    <Ionicons
                      name="flag-outline"
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
                      styles.memberActionButtonText
                    }
                  >
                    Report reader
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <LeaveClubConfirmSheet
        visible={
          leaveConfirmVisible
        }
        clubName={
          club?.name ??
          'this club'
        }
        busy={
          membershipLoading
        }
        onConfirm={
          handleLeave
        }
        onDismiss={() =>
          setLeaveConfirmVisible(
            false
          )
        }
      />

      <BlockReaderConfirmSheet
        visible={
          Boolean(
            blockConfirmTarget
          )
        }
        readerName={
          blockConfirmTarget?.display_name
            ?.trim() ||
          blockConfirmTarget?.username
            ?.trim() ||
          'this reader'
        }
        message="They will be removed from this club, their posts and comments will be hidden from you, and any follow relationship between you will be removed. You can unblock them later in Settings."
        busy={
          memberActionBusy
        }
        onConfirm={
          confirmBlockMember
        }
        onDismiss={() =>
          setBlockConfirmTarget(
            null
          )
        }
      />

      <Modal
        visible={
          Boolean(
            promoteConfirmTarget
          )
        }
        transparent
        animationType="none"
        onShow={
          animatePromoteConfirmIn
        }
        onRequestClose={() =>
          closePromoteConfirm()
        }
      >
        <Pressable
          style={
            styles.memberActionBackdrop
          }
          onPress={() =>
            closePromoteConfirm()
          }
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.memberActionBackdropVisual,
              {
                opacity:
                  promoteConfirmBackdropOpacity,
              },
            ]}
          />

          <Animated.View
            {...promoteConfirmPanResponder.panHandlers}
            onLayout={(event) => {
              promoteConfirmSheetHeight.current =
                event.nativeEvent.layout.height;
            }}
            style={[
              styles.promoteConfirmSheet,
              {
                paddingBottom:
                  Math.max(
                    18,
                    insets.bottom +
                      12
                  ),
                opacity:
                  promoteConfirmSheetOpacity,
                transform: [
                  {
                    translateY:
                      promoteConfirmTranslateY,
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
                  styles.memberActionHandle
                }
              />

              <View
                style={
                  styles.promoteConfirmIcon
                }
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={
                    24
                  }
                  color={
                    colors.gold
                  }
                />
              </View>

              <Text
                style={
                  styles.promoteConfirmTitle
                }
              >
                Make this reader an admin?
              </Text>

              <Text
                style={
                  styles.promoteConfirmText
                }
              >
                {promoteConfirmTarget?.display_name
                  ?.trim() ||
                  promoteConfirmTarget?.username
                    ?.trim() ||
                  'This reader'} will be able to invite members, review join requests, and manage regular members.
              </Text>

              <View
                style={
                  styles.promoteConfirmActions
                }
              >
                <Pressable
                  disabled={
                    memberActionBusy
                  }
                  onPress={() =>
                    closePromoteConfirm()
                  }
                  style={({ pressed }) => [
                    styles.promoteConfirmCancelButton,
                    pressed &&
                      styles.memberActionButtonPressed,
                  ]}
                >
                  <Text
                    style={
                      styles.promoteConfirmCancelText
                    }
                  >
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  disabled={
                    memberActionBusy
                  }
                  onPress={() =>
                    void confirmPromoteMember()
                  }
                  style={({ pressed }) => [
                    styles.promoteConfirmPrimaryButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  {memberActionBusy ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        colors.background
                      }
                    />
                  ) : (
                    <Text
                      style={
                        styles.promoteConfirmPrimaryText
                      }
                    >
                      Make Admin
                    </Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal
        visible={
          Boolean(
            demoteConfirmTarget
          )
        }
        transparent
        animationType="none"
        onShow={
          animateDemoteConfirmIn
        }
        onRequestClose={() =>
          closeDemoteConfirm()
        }
      >
        <Pressable
          style={
            styles.memberActionBackdrop
          }
          onPress={() =>
            closeDemoteConfirm()
          }
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.memberActionBackdropVisual,
              {
                opacity:
                  demoteConfirmBackdropOpacity,
              },
            ]}
          />

          <Animated.View
            {...demoteConfirmPanResponder.panHandlers}
            onLayout={(event) => {
              demoteConfirmSheetHeight.current =
                event.nativeEvent.layout.height;
            }}
            style={[
              styles.promoteConfirmSheet,
              {
                paddingBottom:
                  Math.max(
                    18,
                    insets.bottom +
                      12
                  ),
                opacity:
                  demoteConfirmSheetOpacity,
                transform: [
                  {
                    translateY:
                      demoteConfirmTranslateY,
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
                  styles.memberActionHandle
                }
              />

              <View
                style={
                  styles.promoteConfirmIcon
                }
              >
                <Ionicons
                  name="shield-outline"
                  size={
                    24
                  }
                  color={
                    colors.gold
                  }
                />
              </View>

              <Text
                style={
                  styles.promoteConfirmTitle
                }
              >
                Remove admin access?
              </Text>

              <Text
                style={
                  styles.promoteConfirmText
                }
              >
                {demoteConfirmTarget?.display_name
                  ?.trim() ||
                  demoteConfirmTarget?.username
                    ?.trim() ||
                  'This reader'} will lose admin permissions, but will remain in the club as a regular member.
              </Text>

              <View
                style={
                  styles.promoteConfirmActions
                }
              >
                <Pressable
                  disabled={
                    memberActionBusy
                  }
                  onPress={() =>
                    closeDemoteConfirm()
                  }
                  style={({ pressed }) => [
                    styles.promoteConfirmCancelButton,
                    pressed &&
                      styles.memberActionButtonPressed,
                  ]}
                >
                  <Text
                    style={
                      styles.promoteConfirmCancelText
                    }
                  >
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  disabled={
                    memberActionBusy
                  }
                  onPress={() =>
                    void confirmDemoteAdmin()
                  }
                  style={({ pressed }) => [
                    styles.demoteConfirmPrimaryButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  {memberActionBusy ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        colors.text
                      }
                    />
                  ) : (
                    <Text
                      style={
                        styles.demoteConfirmPrimaryText
                      }
                    >
                      Remove Admin
                    </Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal
        visible={
          Boolean(
            removeMemberConfirmTarget
          )
        }
        transparent
        animationType="none"
        onShow={
          animateRemoveMemberConfirmIn
        }
        onRequestClose={() =>
          closeRemoveMemberConfirm()
        }
      >
        <Pressable
          style={
            styles.memberActionBackdrop
          }
          onPress={() =>
            closeRemoveMemberConfirm()
          }
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.memberActionBackdropVisual,
              {
                opacity:
                  removeMemberConfirmBackdropOpacity,
              },
            ]}
          />

          <Animated.View
            {...removeMemberConfirmPanResponder.panHandlers}
            onLayout={(event) => {
              removeMemberConfirmSheetHeight.current =
                event.nativeEvent.layout.height;
            }}
            style={[
              styles.promoteConfirmSheet,
              {
                paddingBottom:
                  Math.max(
                    18,
                    insets.bottom +
                      12
                  ),
                opacity:
                  removeMemberConfirmSheetOpacity,
                transform: [
                  {
                    translateY:
                      removeMemberConfirmTranslateY,
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
                  styles.memberActionHandle
                }
              />

              <View
                style={
                  styles.promoteConfirmIcon
                }
              >
                <Ionicons
                  name="exit-outline"
                  size={
                    24
                  }
                  color={
                    colors.gold
                  }
                />
              </View>

              <Text
                style={
                  styles.promoteConfirmTitle
                }
              >
                Remove from this club?
              </Text>

              <Text
                style={
                  styles.promoteConfirmText
                }
              >
                {removeMemberConfirmTarget?.display_name
                  ?.trim() ||
                  removeMemberConfirmTarget?.username
                    ?.trim() ||
                  'This reader'} will lose access to this club. They can join or request access again later.
              </Text>

              <View
                style={
                  styles.promoteConfirmActions
                }
              >
                <Pressable
                  disabled={
                    memberActionBusy
                  }
                  onPress={() =>
                    closeRemoveMemberConfirm()
                  }
                  style={({ pressed }) => [
                    styles.promoteConfirmCancelButton,
                    pressed &&
                      styles.memberActionButtonPressed,
                  ]}
                >
                  <Text
                    style={
                      styles.promoteConfirmCancelText
                    }
                  >
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  disabled={
                    memberActionBusy
                  }
                  onPress={() =>
                    void confirmRemoveMember()
                  }
                  style={({ pressed }) => [
                    styles.demoteConfirmPrimaryButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  {memberActionBusy ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        colors.text
                      }
                    />
                  ) : (
                    <Text
                      style={
                        styles.demoteConfirmPrimaryText
                      }
                    >
                      Remove
                    </Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal
        visible={
          Boolean(
            memberReportTarget
          )
        }
        transparent
        animationType="none"
        onShow={
          animateMemberReportIn
        }
        onRequestClose={() =>
          closeMemberReport()
        }
      >
        <Pressable
          style={
            styles.memberActionBackdrop
          }
          onPress={() =>
            closeMemberReport()
          }
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.memberActionBackdropVisual,
              {
                opacity:
                  memberReportBackdropOpacity,
              },
            ]}
          />

          <Animated.View
            style={[
              styles.memberActionSheet,
              {
                paddingBottom:
                  Math.max(
                    18,
                    insets.bottom +
                      12
                  ),
                opacity:
                  memberReportSheetOpacity,
                transform: [
                  {
                    translateY:
                      memberReportTranslateY,
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
                  styles.memberActionHandle
                }
              />

              <Text
                style={
                  styles.memberActionTitle
                }
              >
                Report reader
              </Text>

              <Text
                style={
                  styles.memberActionSubtitle
                }
              >
                Why are you reporting this reader?
              </Text>

              <View
                style={
                  styles.memberActionList
                }
              >
                {MEMBER_REPORT_REASONS.map(
                  (
                    reason
                  ) => (
                    <Pressable
                      key={
                        reason.value
                      }
                      disabled={
                        memberReportSubmitting
                      }
                      onPress={() =>
                        void handleMemberReport(
                          reason.value
                        )
                      }
                      style={({ pressed }) => [
                        styles.memberActionButton,
                        pressed &&
                          styles.memberActionButtonPressed,
                      ]}
                    >
                      <View
                        style={
                          styles.memberActionRowIcon
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
                          styles.memberActionButtonText
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
                        style={{
                          marginLeft:
                            'auto',
                        }}
                      />
                    </Pressable>
                  )
                )}
              </View>

              {memberReportSubmitting ? (
                <View
                  style={
                    styles.memberReportSubmitting
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
    contentInviteOpen: {
      paddingBottom:
        500,
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
    primaryButtonDisabled: {
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    primaryButtonTextDisabled: {
      color:
        colors.mutedText,
    },
    requestAccessButton: {
      minHeight:
        46,
      borderRadius:
        13,
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
        14,
    },
    requestAccessButtonPending: {
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    requestAccessButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        13,
    },
    requestAccessButtonTextPending: {
      color:
        colors.mutedText,
    },
    invitationCard: {
      marginTop:
        22,
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.gold,
      borderRadius:
        17,
      padding:
        15,
    },
    invitationIcon: {
      width:
        40,
      height:
        40,
      borderRadius:
        20,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom:
        11,
    },
    invitationCopy: {
      gap:
        4,
    },
    invitationTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        19,
    },
    invitationText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13,
      lineHeight:
        19,
    },
    invitationActions: {
      flexDirection:
        'row',
      gap:
        9,
      marginTop:
        14,
    },
    invitationDeclineButton: {
      flex:
        1,
      minHeight:
        42,
      borderRadius:
        12,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    invitationDeclineText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
    },
    invitationAcceptButton: {
      flex:
        1,
      minHeight:
        42,
      borderRadius:
        12,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    invitationAcceptText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        13,
    },
    inviteSection: {
      marginTop:
        12,
    },
    inviteToggleButton: {
      minHeight:
        64,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        11,
      paddingHorizontal:
        13,
      paddingVertical:
        10,
      borderRadius:
        14,
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    inviteToggleIcon: {
      width:
        36,
      height:
        36,
      borderRadius:
        18,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    inviteToggleCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    inviteToggleTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        13,
    },
    inviteToggleText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
      lineHeight:
        16,
      marginTop:
        2,
    },
    invitePanel: {
      marginTop:
        8,
      padding:
        11,
      borderRadius:
        14,
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    inviteSearchWrap: {
      minHeight:
        44,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        8,
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        12,
      paddingHorizontal:
        11,
    },
    inviteSearchInput: {
      flex:
        1,
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        13,
      paddingVertical:
        9,
    },
    inviteSearchHint: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
      lineHeight:
        16,
      textAlign:
        'center',
      paddingVertical:
        14,
      paddingHorizontal:
        8,
    },
    inviteResults: {
      marginTop:
        8,
      maxHeight:
        194,
    },
    inviteResultsContent: {
      gap:
        6,
      paddingBottom:
        2,
    },
    inviteReaderRow: {
      minHeight:
        58,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        9,
      paddingVertical:
        6,
    },
    inviteReaderIdentity: {
      flex:
        1,
      minWidth:
        0,
      flexDirection:
        'row',
      alignItems:
        'center',
    },
    inviteReaderAvatar: {
      width:
        38,
      height:
        38,
      borderRadius:
        19,
      backgroundColor:
        colors.elevated,
      marginRight:
        9,
    },
    inviteReaderAvatarFallback: {
      width:
        38,
      height:
        38,
      borderRadius:
        19,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        9,
    },
    inviteReaderAvatarText: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        15,
    },
    inviteReaderCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    inviteReaderName: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
    },
    inviteReaderUsername: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      marginTop:
        2,
    },
    inviteReaderButton: {
      minWidth:
        70,
      minHeight:
        34,
      paddingHorizontal:
        11,
      borderRadius:
        17,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    inviteReaderButtonDisabled: {
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    inviteReaderButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        11,
    },
    inviteReaderButtonTextDisabled: {
      color:
        colors.mutedText,
    },
    joinRequestsSection: {
      marginTop:
        14,
    },
    joinRequestsHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap:
        12,
      marginBottom:
        8,
      paddingHorizontal:
        2,
    },
    joinRequestsTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        14,
    },
    joinRequestsSubtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      lineHeight:
        15,
      marginTop:
        2,
    },
    joinRequestsBadge: {
      minWidth:
        28,
      height:
        28,
      borderRadius:
        14,
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    joinRequestsBadgeText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        11,
    },
    joinRequestsCard: {
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        14,
      paddingHorizontal:
        11,
    },
    joinRequestRow: {
      minHeight:
        66,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        8,
      paddingVertical:
        8,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },
    joinRequestIdentity: {
      flex:
        1,
      minWidth:
        0,
      flexDirection:
        'row',
      alignItems:
        'center',
    },
    joinRequestAvatar: {
      width:
        38,
      height:
        38,
      borderRadius:
        19,
      backgroundColor:
        colors.elevated,
      marginRight:
        9,
    },
    joinRequestAvatarFallback: {
      width:
        38,
      height:
        38,
      borderRadius:
        19,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        9,
    },
    joinRequestAvatarText: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        15,
    },
    joinRequestCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    joinRequestName: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
    },
    joinRequestMeta: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      marginTop:
        2,
    },
    joinRequestActions: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        7,
    },
    joinRequestDeclineButton: {
      minHeight:
        34,
      paddingHorizontal:
        12,
      borderRadius:
        17,
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    joinRequestDeclineText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
    },
    joinRequestApproveButton: {
      minHeight:
        34,
      paddingHorizontal:
        12,
      borderRadius:
        17,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    joinRequestApproveText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        11,
    },
    pendingInvitesBlock: {
      marginTop:
        12,
    },
    pendingInvitesHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      paddingHorizontal:
        2,
      marginBottom:
        7,
    },
    pendingInvitesTitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
    },
    pendingInvitesCount: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
    },
    pendingInvitesCard: {
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        14,
      paddingHorizontal:
        11,
    },
    pendingInviteRow: {
      minHeight:
        58,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingVertical:
        8,
    },
    pendingInviteAvatar: {
      width:
        36,
      height:
        36,
      borderRadius:
        18,
      backgroundColor:
        colors.elevated,
      marginRight:
        9,
    },
    pendingInviteAvatarFallback: {
      width:
        36,
      height:
        36,
      borderRadius:
        18,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight:
        9,
    },
    pendingInviteAvatarText: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        14,
    },
    pendingInviteCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    pendingInviteName: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
    },
    pendingInviteMeta: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        10.5,
      marginTop:
        2,
    },
    cancelInviteButton: {
      minHeight:
        32,
      minWidth:
        58,
      paddingHorizontal:
        9,
      borderRadius:
        16,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
    },
    cancelInviteText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        10.5,
    },
    privatePreviewCard: {
      marginTop:
        26,
      minHeight:
        150,
      borderRadius:
        17,
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      padding:
        24,
    },
    privatePreviewTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        18,
      marginTop:
        10,
      textAlign:
        'center',
    },
    privatePreviewText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      lineHeight:
        18,
      textAlign:
        'center',
      marginTop:
        5,
      maxWidth:
        360,
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
      position: 'relative',
      overflow: 'hidden',
    },
    memberRowSelected: {
      backgroundColor:
        colors.elevated,
    },
    memberActionAccent: {
      position:
        'absolute',
      left:
        0,
      top:
        7,
      bottom:
        7,
      width:
        3,
      borderRadius:
        2,
      backgroundColor:
        colors.gold,
    },
    membersExpandRow: {
      minHeight:
        46,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        6,
      paddingHorizontal:
        13,
    },
    membersExpandText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11.5,
    },
    promoteConfirmSheet: {
      width:
        '100%',
      alignSelf:
        'center',
      backgroundColor:
        colors.surface,
      borderTopLeftRadius:
        24,
      borderTopRightRadius:
        24,
      paddingHorizontal:
        18,
      paddingTop:
        10,
      overflow:
        'hidden',
    },
    promoteConfirmIcon: {
      width:
        48,
      height:
        48,
      borderRadius:
        24,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      alignSelf:
        'center',
      marginTop:
        6,
      marginBottom:
        14,
    },
    promoteConfirmTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        21,
      textAlign:
        'center',
    },
    promoteConfirmText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12.5,
      lineHeight:
        19,
      textAlign:
        'center',
      marginTop:
        7,
    },
    promoteConfirmActions: {
      flexDirection:
        'row',
      gap:
        10,
      marginTop:
        20,
    },
    promoteConfirmCancelButton: {
      flex:
        1,
      minHeight:
        46,
      borderRadius:
        14,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.background,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    promoteConfirmCancelText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12.5,
    },
    promoteConfirmPrimaryButton: {
      flex:
        1,
      minHeight:
        46,
      borderRadius:
        14,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    promoteConfirmPrimaryText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        12.5,
    },
    demoteConfirmPrimaryButton: {
      flex:
        1,
      minHeight:
        46,
      borderRadius:
        14,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    demoteConfirmPrimaryText: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        12.5,
    },
    memberActionBackdrop: {
      flex:
        1,
      justifyContent:
        'flex-end',
    },
    memberActionBackdropVisual: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        'rgba(0,0,0,0.48)',
    },
    memberActionSheet: {
      width:
        '100%',
      alignSelf:
        'center',
      backgroundColor:
        colors.surface,
      borderTopLeftRadius:
        24,
      borderTopRightRadius:
        24,
      paddingTop:
        10,
      paddingHorizontal:
        16,
      overflow:
        'hidden',
    },
    memberActionHandle: {
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
    memberActionTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        20,
    },
    memberActionSubtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      lineHeight:
        17,
      marginTop:
        3,
      marginBottom:
        12,
    },
    memberActionList: {
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        16,
      overflow:
        'hidden',
      backgroundColor:
        colors.background,
    },
    memberActionButton: {
      minHeight:
        58,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        11,
      paddingHorizontal:
        13,
      paddingVertical:
        10,
      backgroundColor:
        colors.background,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },
    memberActionButtonPressed: {
      backgroundColor:
        colors.elevated,
    },
    memberActionRowIcon: {
      width:
        32,
      height:
        32,
      borderRadius:
        16,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      flexShrink:
        0,
    },
    memberActionButtonText: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
    },
    memberReportSubmitting: {
      paddingVertical:
        14,
      alignItems:
        'center',
      justifyContent:
        'center',
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
    blockedPostCard: {
      paddingVertical:
        14,
    },
    blockedPostRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },
    blockedPostIcon: {
      width:
        36,
      height:
        36,
      borderRadius:
        11,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      marginRight:
        11,
    },
    blockedPostCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    blockedPostTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
    },
    blockedPostText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      marginTop:
        3,
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
