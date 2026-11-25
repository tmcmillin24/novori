import { usePostCommentsSheet } from '../../components/usePostCommentsSheet';
import { useBrowsingNavigationScroll } from '../../components/BrowsingNavigation';
import CachedMediaImage from '../../components/CachedMediaImage';
import { displayBookTitle } from '../../lib/book-title';
import {PostSpoilerContent} from '../../components/PostSpoilerNotice';
import { useReportConfirmation } from '../../lib/use-report-confirmation';
import { moderationMediaUrl } from '../../lib/moderation-media-url';
import { useUiSheetMotion, UiSheetModal, UiSheetSurface, UiSheetBackdrop } from '../../components/UiSheet';
import ClubEventsBoard from '../../components/ClubEventsBoard';
import ClubBooksBoard from '../../components/ClubBooksBoard';
import ClubTabActions from '../../components/ClubTabActions';
import useEventClock from '../../hooks/use-event-clock';
import { getClubEvents } from '../../lib/club-events';
import { isUpcomingClubEvent, type ClubEvent } from '../../lib/club-event';
import ClubEventPostAttachment from '../../components/ClubEventPostAttachment';
import ClubDiscussionPostAttachment from '../../components/ClubDiscussionPostAttachment';
import ClubPinnedPosts from '../../components/ClubPinnedPosts';
import ClubPinActionsSheet from '../../components/ClubPinActionsSheet';
import { getClubConversation, getClubPins, resolveClubPinnedPosts, setClubPostPin } from '../../lib/club-posts';
import ClubHomeCard from '../../components/ClubHomeCard';
import ClubOptionsSheet from '../../components/ClubOptionsSheet';
import ClubWelcomeCard from '../../components/ClubWelcomeCard';
import ValidationWarningSheet from '../../components/ValidationWarningSheet';
import { getClubMemberExperience, setClubNotificationsEnabled, dismissClubWelcome, type ClubMemberExperience } from '../../lib/club-member-experience';
import { getClubHomeActions, type ClubHomeAction } from '../../lib/club-home';
import BookCoverImage from '../../components/BookCoverImage';
import BookStackPostAttachment from '../../components/BookStackPostAttachment';
import { Ionicons } from '@expo/vector-icons';
import ReadingRecapPostAttachment from '../../components/ReadingRecapPostAttachment';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Keyboard, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedPostImage from '../../components/FeedPostImage';
import FullScreenImageViewer from '../../components/FullScreenImageViewer';
import PostTypeIdentifier from '../../components/PostTypeIdentifier';
import BlockReaderConfirmSheet from '../../components/BlockReaderConfirmSheet';
import LeaveClubConfirmSheet from '../../components/LeaveClubConfirmSheet';
import { NovoriColors } from '../../constants/novori-theme';
import { useNovoriTheme } from '../../context/theme-context';
import { acceptClubInvite, approveClubJoinRequest, cancelClubInvite, cancelPrivateClubRequest, ClubInvitation, ClubInviteCandidate, ClubJoinRequest, ClubMember, ClubWithMembership, declineClubInvite, declineClubJoinRequest, demoteClubAdmin, getClub, getClubMembers, getPendingClubInvite, getPendingClubInvitesForManager, getPendingClubJoinRequestsForManager, getPendingPrivateClubRequest, inviteReaderToClub, joinClub, kickClubMember, leaveClub, promoteClubMember, requestPrivateClubAccess, searchClubInviteCandidates } from '../../lib/clubs';
import { FeedPost, PostVoteValue, splitQuestionPostBody, togglePostVote, getPostMutationVersion } from '../../lib/feed';
import { ReportReason, submitProfileReport } from '../../lib/reports';
import { blockReader, getReaderConnections } from '../../lib/social';
import { loadComposerProfile, prepareClubComposerPreview, warmComposerImage } from '../../lib/club-composer-preview';
import { supabase } from '../../lib/supabase';
import { shareClubLink, sharePostLink } from '../../lib/share-links';
function roleLabel(role: ClubMember['role']) {
    if (role === 'owner')
        return 'Owner';
    if (role === 'admin')
        return 'Admin';
    return 'Member';
}
const MEMBER_REPORT_REASONS: Array<{
    value: ReportReason;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
}> = [
    {
        value: 'harassment',
        label: 'Bullying or unwanted contact',
        icon: 'person-remove-outline',
    },
    {
        value: 'hate',
        label: 'Violence, hate, or discrimination',
        icon: 'warning-outline',
    },
    {
        value: 'spam',
        label: 'Scam, fraud, or spam',
        icon: 'megaphone-outline',
    },
    {
        value: 'impersonation',
        label: 'Impersonation',
        icon: 'people-outline',
    },
    {
        value: 'explicit_content',
        label: 'Graphic or inappropriate content',
        icon: 'eye-off-outline',
    },
    {
        value: 'other',
        label: 'Other',
        icon: 'ellipsis-horizontal-circle-outline',
    }
];
export default function ClubDetailScreen() {
  const browsingScroll = useBrowsingNavigationScroll();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{
        id: string;
    }>();
    const { colors } = useNovoriTheme();
    const styles = createStyles(colors);
    const [club, setClub] = useState<ClubWithMembership | null>(null);
    const [clubImageOpen, setClubImageOpen,] = useState(false);
    const [members, setMembers] = useState<ClubMember[]>([]);
    const [clubPosts, setClubPosts] = useState<FeedPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [postsStatus, setPostsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [eventsLoading, setEventsLoading] = useState(true);
    const [membersLoading, setMembersLoading] = useState(true);
    const [accessLoading, setAccessLoading] = useState(true);
    const clubLoadSequence = useRef(0);
    const [refreshing, setRefreshing] = useState(false);
    const [membershipLoading, setMembershipLoading] = useState(false);
    const [leaveConfirmVisible, setLeaveConfirmVisible,] = useState(false);
    const [votingPostId, setVotingPostId,] = useState<string | null>(null);
    const [error, setError] = useState('');
    const composerWarm = useRef<{ userId: string; clubId: string; profile: ReturnType<typeof loadComposerProfile>; cover: Promise<void> } | null>(null);
    const openingComposer = useRef(false);
    const [currentUserId, setCurrentUserId,] = useState<string | null>(null);
    const [memberActionTarget, setMemberActionTarget,] = useState<ClubMember | null>(null);
    const [memberReportTarget, setMemberReportTarget,] = useState<ClubMember | null>(null);
    const [promoteConfirmTarget, setPromoteConfirmTarget,] = useState<ClubMember | null>(null);
    const promoteConfirmClosing = useRef(false);
    const promoteConfirmGestureClosing = useRef(false);
    const promoteConfirmSheetHeight = useRef(0);
    const [demoteConfirmTarget, setDemoteConfirmTarget,] = useState<ClubMember | null>(null);
    const demoteConfirmClosing = useRef(false);
    const demoteConfirmGestureClosing = useRef(false);
    const demoteConfirmSheetHeight = useRef(0);
    const [removeMemberConfirmTarget, setRemoveMemberConfirmTarget,] = useState<ClubMember | null>(null);
    const [blockConfirmTarget, setBlockConfirmTarget,] = useState<ClubMember | null>(null);
    const removeMemberConfirmClosing = useRef(false);
    const removeMemberConfirmGestureClosing = useRef(false);
    const removeMemberConfirmSheetHeight = useRef(0);
    const [memberActionBusy, setMemberActionBusy,] = useState(false);
    const [memberReportSubmitting, setMemberReportSubmitting,] = useState(false);
    const memberActionAccentOpacity = useRef(new Animated.Value(0)).current;
    const memberActionClosing = useRef(false);
    const memberActionGestureClosing = useRef(false);
    const memberActionSheetHeight = useRef(0);
    const preserveClubStateOnNextFocus = useRef(false);
    const memberReportClosing = useRef(false);
    const [pendingInvite, setPendingInvite,] = useState<ClubInvitation | null>(null);
    const [managerInvites, setManagerInvites,] = useState<ClubInvitation[]>([]);
    const [managerJoinRequests, setManagerJoinRequests,] = useState<ClubJoinRequest[]>([]);
    const [processingJoinRequestId, setProcessingJoinRequestId,] = useState<string | null>(null);
    const [invitePanelOpen, setInvitePanelOpen,] = useState(false);
    const [inviteQuery, setInviteQuery,] = useState('');
    const [inviteResults, setInviteResults,] = useState<ClubInviteCandidate[]>([]);
    const [inviteSearchError, setInviteSearchError] = useState(false);
    const [inviteSearchAttempt, retryInviteSearch] = useState(0);
    const [inviteSearchLoading, setInviteSearchLoading,] = useState(false);
    const inviteInFlight = useRef(false);
    const [sentInviteIds, setSentInviteIds] = useState<Set<string>>(() => new Set());
    const [invitingReaderId, setInvitingReaderId,] = useState<string | null>(null);
    const [respondingToInvite, setRespondingToInvite,] = useState(false);
    const [cancellingInviteId, setCancellingInviteId,] = useState<string | null>(null);
    const [pendingJoinRequest, setPendingJoinRequest,] = useState<ClubJoinRequest | null>(null);
    const [joinRequestLoading, setJoinRequestLoading,] = useState(false);
    const clubScrollRef = useRef<ScrollView | null>(null);
    const [clubTab, setClubTab] = useState<'posts' | 'events' | 'books'>('posts');
    const [visitedTabs, setVisitedTabs] = useState<{ clubId: string; books?: boolean; events?: boolean }>({ clubId: '' });
    const [booksRefreshVersion, setBooksRefreshVersion] = useState(0);
    const [upcomingEvents, setUpcomingEvents] = useState<ClubEvent[]>([]);
    const [pinnedPosts, setPinnedPosts] = useState<FeedPost[]>([]);
    const { openCommentsSheet, sheet } = usePostCommentsSheet({setFeedPosts: update => { setClubPosts(update); setPinnedPosts(update); }, onNavigate: () => { preserveClubStateOnNextFocus.current = true; }});
    const [pinTarget, setPinTarget] = useState<FeedPost | null>(null);
    const [pinBusy, setPinBusy] = useState(false);
    const [clubMenuVisible, setClubMenuVisible] = useState(false);
    const [rulesExpanded, setRulesExpanded] = useState(false);
    const [membersVisible, setMembersVisible] = useState(false);
    const [managementVisible, setManagementVisible] = useState(false);
    const [memberExperience, setMemberExperience] = useState<ClubMemberExperience | null>(null);
    const [welcomeOpen, setWelcomeOpen] = useState(false);
    const [experienceBusy, setExperienceBusy] = useState(false);
    const [experienceWarning, setExperienceWarning] = useState('');
    const experienceMutation = useRef(false), experienceVersion = useRef(0);
    const experienceMounted = useRef(true);
    useEffect(() => { experienceMounted.current = true; return () => { experienceMounted.current = false; experienceVersion.current++; }; }, []);
    const pendingMemberScroll = useRef(false);
    const membersSectionY = useRef(0);
    const clubId = typeof params.id === 'string'
        ? params.id
        : '';
    useEffect(() => {
        if (clubTab === 'posts') return;
        setVisitedTabs(current => current.clubId === clubId && current[clubTab]
            ? current
            : { ...(current.clubId === clubId ? current : {}), clubId, [clubTab]: true });
    }, [clubId, clubTab]);
    const pinClubIdRef = useRef(clubId);
    pinClubIdRef.current = clubId;
    useEffect(() => {
        const tab = (params as {
            tab?: string;
        }).tab;
        setClubTab(tab === 'books' ? 'books' : tab === 'events' ? 'events' : 'posts');
        setUpcomingEvents([]);
        setPinnedPosts([]);
        setPinTarget(null);
        setClubMenuVisible(false);
        setRulesExpanded(false);
        setMembersVisible(false);
        setManagementVisible(false);
        setMemberExperience(null);
        setWelcomeOpen(false);
        setExperienceWarning('');
        experienceVersion.current++;
        setInvitePanelOpen(false);
        setSentInviteIds(new Set());
        pendingMemberScroll.current = false;
    }, [clubId, (params as {
            tab?: string;
        }).tab]);
    const eventDeadline = Math.min(...[...upcomingEvents, ...pinnedPosts.flatMap(post => post.club_event ? [post.club_event] : [])].filter(event => isUpcomingClubEvent(event)).map(event => Date.parse(event.ends_at)));
    const eventNow = useEventClock(Number.isFinite(eventDeadline) ? eventDeadline : undefined);
    const visiblePinnedPosts = pinnedPosts.filter(post => !post.club_event || isUpcomingClubEvent(post.club_event, eventNow));
    const nextEvent = upcomingEvents.find(event => isUpcomingClubEvent(event, eventNow));
    const loadClub = useCallback(async () => {
        const request = ++clubLoadSequence.current;
        const mutationAtStart = getPostMutationVersion();
        const experienceRequest = ++experienceVersion.current;
        const isCurrent = () => experienceMounted.current && pinClubIdRef.current === clubId && request === clubLoadSequence.current;
        if (!clubId) {
            setError('This club could not be found.');
            setLoading(false);
            return;
        }
        const authRequest = supabase.auth.getUser().catch(() => null);
        try {
            setError('');
            if (loadedClub.current?.id !== clubId) {
                setClubPosts([]);
                setPinnedPosts([]);
                setMembers([]);
                setUpcomingEvents([]);
                setPendingInvite(null);
                setPendingJoinRequest(null);
                setManagerInvites([]);
                setManagerJoinRequests([]);
                setPostsStatus('loading');
                setMembersLoading(true);
                setEventsLoading(true);
                setAccessLoading(true);
            }
            const clubData = await getClub(clubId);
            if (!isCurrent()) return;
            setClub(clubData);
            setLoading(false);

            const canRead = clubData.privacy === 'public' || Boolean(clubData.membership_role);
            const manager = clubData.membership_role === 'owner' || clubData.membership_role === 'admin';
            let failed = false;
            async function section<T>(label: string, promise: Promise<T>, apply: (data: T) => void, onError?: () => void) {
                try {
                    const data = await promise;
                    if (isCurrent()) apply(data);
                } catch (error) {
                    failed = true;
                    if (isCurrent()) {
                        console.warn(`Could not load club ${label}:`, error);
                        onError?.();
                    }
                }
            }
            void authRequest.then(auth => {
                if (!isCurrent()) return;
                const userId = auth?.data.user?.id ?? null;
                setCurrentUserId(userId);
                if (userId && clubData.membership_role && (composerWarm.current?.clubId !== clubId || composerWarm.current.userId !== userId)) {
                    composerWarm.current = {
                        userId,
                        clubId,
                        profile: loadComposerProfile(userId).catch(() => null),
                        cover: warmComposerImage(clubData.cover_url).catch(() => {}),
                    };
                }
            });

            const access = clubData.membership_role ? [] : [
                section('invitation', getPendingClubInvite(clubId), setPendingInvite),
                section('access request', getPendingPrivateClubRequest(clubId), setPendingJoinRequest),
            ];
            const management = manager ? [
                section('sent invitations', getPendingClubInvitesForManager(clubId), setManagerInvites),
                section('join requests', getPendingClubJoinRequestsForManager(clubId), setManagerJoinRequests),
            ] : [];
            const content = canRead ? [
                section('conversation', getClubConversation(clubId), conversation => {
                    if (getPostMutationVersion() !== mutationAtStart) {
                        failed = true;
                        setPostsStatus(current => current === 'loading' ? 'error' : current);
                        return;
                    }
                    setClubPosts(conversation.posts);
                    setPinnedPosts(conversation.pinnedPosts);
                    setPostsStatus('ready');
                }, () => setPostsStatus(current => current === 'ready' ? current : 'error')),
                section('events', getClubEvents(clubId), events => {
                    setUpcomingEvents(current => JSON.stringify(current) === JSON.stringify(events) ? current : events);
                }).finally(() => { if (isCurrent()) setEventsLoading(false); }),
                section('members', getClubMembers(clubId), setMembers).finally(() => {
                    if (isCurrent()) setMembersLoading(false);
                }),
            ] : [];
            const experience = clubData.membership_role ? [
                section('preferences', getClubMemberExperience(clubId), data => {
                    if (experienceRequest !== experienceVersion.current) return;
                    setMemberExperience(data);
                    setWelcomeOpen(Boolean(data && !data.welcome_seen_at));
                }, () => {
                    if (experienceRequest === experienceVersion.current) setExperienceWarning('Could not load your club preferences.');
                }),
            ] : [];
            await Promise.all([
                ...content, ...management, ...experience,
                Promise.all(access).then(() => { if (isCurrent()) setAccessLoading(false); }),
            ]);
            if (!isCurrent()) return;
            setBooksRefreshVersion(version => version + 1);
            if (!failed) loadedClub.current = { id: clubId, version: mutationAtStart };
        } catch (loadError) {
            if (!isCurrent()) return;
            console.warn('Could not load club:', loadError);
            setError('This club is unavailable or private.');
            setLoading(false);
        }
    }, [clubId]);
    const loadedClub = useRef<{ id: string; version: number } | null>(null);
    useFocusEffect(useCallback(() => {
        const unchanged = loadedClub.current?.id === clubId && loadedClub.current.version === getPostMutationVersion();
        if (unchanged) {
            preserveClubStateOnNextFocus.current = false;
            return;
        }
        preserveClubStateOnNextFocus.current = false;
        if (loadedClub.current?.id !== clubId) setLoading(true);
        loadClub();
    }, [loadClub, clubId]));
    const refreshClub = useCallback(async () => {
        if (refreshing) {
            return;
        }
        try {
            setRefreshing(true);
            await loadClub();
        }
        finally {
            setRefreshing(false);
        }
    }, [
        loadClub,
        refreshing
    ]);
    const inviteClubId = club?.id;
    const canInvite = club?.membership_role === 'owner' || club?.membership_role === 'admin';
    const inviteTerm = inviteQuery.trim().replace(/^@/, '');
    useEffect(() => {
        if (!invitePanelOpen || !canInvite || !inviteClubId || !currentUserId) return;
        let active = true;
        setInviteSearchLoading(true);
        setInviteSearchError(false);
        setInviteResults([]);
        const timer = setTimeout(async () => {
            try {
                let results: ClubInviteCandidate[];
                if (inviteTerm) {
                    results = inviteTerm.length < 2 ? [] : await searchClubInviteCandidates(inviteClubId, inviteTerm);
                } else {
                    // Use public reader data only as a shortlist. The existing club
                    // RPC checks eligibility and pending state before any row is shown.
                    const memberIds = new Set(members.map(member => member.user_id));
                    const following = await getReaderConnections(currentUserId, 'following', 30).catch(() => []);
                    const shortlist = following.filter(reader => reader.username && !memberIds.has(reader.id)).slice(0, 8);
                    if (shortlist.length < 8) {
                        const { data, error } = await supabase.from('profiles')
                            .select('id, username').neq('id', currentUserId).not('username', 'is', null)
                            .order('id').limit(30);
                        if (error && !shortlist.length) throw error;
                        const seen = new Set(shortlist.map(reader => reader.id));
                        for (const reader of data ?? []) {
                            if (shortlist.length >= 8) break;
                            if (!reader.username || memberIds.has(reader.id) || seen.has(reader.id)) continue;
                            shortlist.push({ ...reader, display_name: null, avatar_url: null,
                                is_following: false, is_self: false, is_private: false, follow_request_pending: false });
                        }
                    }
                    if (!active) return;
                    const found = await Promise.all(shortlist.map(async reader =>
                        (await searchClubInviteCandidates(inviteClubId, reader.username!))
                            .find(candidate => candidate.id === reader.id)));
                    results = found.filter((candidate): candidate is ClubInviteCandidate => Boolean(candidate));
                }
                if (active) setInviteResults(results.filter(candidate => !candidate.is_member));
            } catch {
                if (active) setInviteSearchError(true);
            } finally {
                if (active) setInviteSearchLoading(false);
            }
        }, inviteTerm ? 250 : 0);
        return () => { active = false; clearTimeout(timer); };
    }, [invitePanelOpen, canInvite, inviteClubId, currentUserId, inviteTerm, members, inviteSearchAttempt]);

    async function handleJoin() {
        if (!club)
            return;
        if (club.privacy ===
            'private') {
            Alert.alert('Invite only', 'Private clubs can only be joined through a club invitation.');
            return;
        }
        try {
            setMembershipLoading(true);
            await joinClub(club.id);
            await loadClub();
        }
        catch (joinError) {
            console.error('Could not join club:', joinError);
            Alert.alert('Could not join club', 'Please try again.');
        }
        finally {
            setMembershipLoading(false);
        }
    }
    async function handleInviteReader(candidate: ClubInviteCandidate) {
        if (!club ||
            candidate.is_member ||
            candidate.invite_pending ||
            sentInviteIds.has(candidate.id) ||
            inviteInFlight.current) {
            return;
        }
        inviteInFlight.current = true;
        try {
            setInvitingReaderId(candidate.id);
            await inviteReaderToClub(club.id, candidate.id);
            if (pinClubIdRef.current !== club.id) return;
            setSentInviteIds(current => new Set(current).add(candidate.id));
            setInviteResults((current) => current.map((item) => item.id ===
                candidate.id
                ? {
                    ...item,
                    invite_pending: true,
                }
                : item));
            void getPendingClubInvitesForManager(club.id).then(invites => {
                if (pinClubIdRef.current === club.id) setManagerInvites(invites);
            }).catch(() => {});
        }
        catch (inviteError) {
            console.error('Could not invite reader:', inviteError);
            Alert.alert('Could not send invite', inviteError instanceof
                Error
                ? inviteError.message
                : 'Please try again.');
        }
        finally {
            inviteInFlight.current = false;
            setInvitingReaderId(null);
        }
    }
    async function handleAcceptInvite() {
        if (!pendingInvite ||
            respondingToInvite) {
            return;
        }
        try {
            setRespondingToInvite(true);
            await acceptClubInvite(pendingInvite.id);
            setPendingInvite(null);
            await loadClub();
        }
        catch (acceptError) {
            console.error('Could not accept club invite:', acceptError);
            Alert.alert('Could not accept invitation', 'Please try again.');
        }
        finally {
            setRespondingToInvite(false);
        }
    }
    async function handleDeclineInvite() {
        if (!pendingInvite ||
            respondingToInvite) {
            return;
        }
        try {
            setRespondingToInvite(true);
            await declineClubInvite(pendingInvite.id);
            setPendingInvite(null);
            router.back();
        }
        catch (declineError) {
            console.error('Could not decline club invite:', declineError);
            Alert.alert('Could not decline invitation', 'Please try again.');
        }
        finally {
            setRespondingToInvite(false);
        }
    }
    async function handleCancelInvite(invitation: ClubInvitation) {
        if (!club ||
            cancellingInviteId) {
            return;
        }
        try {
            setCancellingInviteId(invitation.id);
            await cancelClubInvite(invitation.id);
            setSentInviteIds(current => {
                const next = new Set(current);
                next.delete(invitation.invitee_id);
                return next;
            });
            setManagerInvites((current) => current.filter((item) => item.id !==
                invitation.id));
            setInviteResults((current) => current.map((item) => item.id ===
                invitation.invitee_id
                ? {
                    ...item,
                    invite_pending: false,
                }
                : item));
        }
        catch (cancelError) {
            console.error('Could not cancel club invite:', cancelError);
            Alert.alert('Could not cancel invitation', 'Please try again.');
        }
        finally {
            setCancellingInviteId(null);
        }
    }
    async function handleRequestAccess() {
        if (!club ||
            joinRequestLoading ||
            pendingJoinRequest) {
            return;
        }
        try {
            setJoinRequestLoading(true);
            const requestId = await requestPrivateClubAccess(club.id);
            setPendingJoinRequest({
                id: requestId,
                club_id: club.id,
                requester_id: '',
                status: 'pending',
                created_at: new Date().toISOString(),
            });
        }
        catch (requestError) {
            console.error('Could not request club access:', requestError);
            Alert.alert('Could not request access', requestError instanceof
                Error
                ? requestError.message
                : 'Please try again.');
        }
        finally {
            setJoinRequestLoading(false);
        }
    }
    async function handleCancelAccessRequest() {
        if (!pendingJoinRequest ||
            joinRequestLoading) {
            return;
        }
        try {
            setJoinRequestLoading(true);
            await cancelPrivateClubRequest(pendingJoinRequest.id);
            setPendingJoinRequest(null);
        }
        catch (cancelError) {
            console.error('Could not cancel club access request:', cancelError);
            Alert.alert('Could not cancel request', 'Please try again.');
        }
        finally {
            setJoinRequestLoading(false);
        }
    }
    async function handleApproveJoinRequest(request: ClubJoinRequest) {
        if (processingJoinRequestId) {
            return;
        }
        try {
            setProcessingJoinRequestId(request.id);
            await approveClubJoinRequest(request.id);
            setManagerJoinRequests((current) => current.filter((item) => item.id !==
                request.id));
            await loadClub();
        }
        catch (approveError) {
            console.error('Could not approve club join request:', approveError);
            Alert.alert('Could not approve request', 'Please try again.');
        }
        finally {
            setProcessingJoinRequestId(null);
        }
    }
    async function handleDeclineJoinRequest(request: ClubJoinRequest) {
        if (processingJoinRequestId) {
            return;
        }
        try {
            setProcessingJoinRequestId(request.id);
            await declineClubJoinRequest(request.id);
            setManagerJoinRequests((current) => current.filter((item) => item.id !==
                request.id));
        }
        catch (declineError) {
            console.error('Could not decline club join request:', declineError);
            Alert.alert('Could not decline request', 'Please try again.');
        }
        finally {
            setProcessingJoinRequestId(null);
        }
    }
    function canManageMember(member: ClubMember) {
        if (!club ||
            !currentUserId ||
            member.user_id ===
                currentUserId ||
            member.role ===
                'owner') {
            return false;
        }
        if (club.membership_role ===
            'owner') {
            return true;
        }
        return (club.membership_role ===
            'admin' &&
            member.role ===
                'member');
    }
    function openMemberActions(member: ClubMember) {
        if (!canManageMember(member)) {
            return;
        }
        Keyboard.dismiss();
        memberActionClosing.current =
            false;
        setMemberActionTarget(member);
    }
    function closeMemberActions(afterClose?: () => void) {
        if (!memberActionTarget ||
            memberActionClosing.current) {
            return;
        }
        memberActionClosing.current =
            true;
        uiMemberAction.closeAfterActionWithCallback(afterClose);
    }
    function dismissMemberActionsByGesture() {
        if (!memberActionTarget ||
            memberActionClosing.current ||
            memberActionGestureClosing.current) {
            return;
        }
        memberActionGestureClosing.current =
            true;
        memberActionAccentOpacity.stopAnimation();
        const offscreenY = Math.max(memberActionSheetHeight.current +
            32, 420);
        uiMemberAction.closeAfterActionWithCallback();
    }
    function closeMemberReport(afterClose?: () => void) {
        if (!memberReportTarget ||
            memberReportClosing.current ||
            memberReportSubmitting) {
            return;
        }
        memberReportClosing.current =
            true;
        uiMemberReport.closeAfterActionWithCallback(afterClose);
    }
    function viewSelectedMember() {
        if (!memberActionTarget) {
            return;
        }
        const target = memberActionTarget;
        closeMemberActions(() => {
            preserveClubStateOnNextFocus.current =
                true;
            openReader(target.user_id);
        });
    }
    function closePromoteConfirm(afterClose?: () => void) {
        if (!promoteConfirmTarget ||
            promoteConfirmClosing.current) {
            return;
        }
        promoteConfirmClosing.current =
            true;
        uiPromoteConfirm.closeAfterActionWithCallback(afterClose);
    }
    async function confirmPromoteMember() {
        if (!club ||
            !promoteConfirmTarget ||
            memberActionBusy) {
            return;
        }
        const target = promoteConfirmTarget;
        try {
            setMemberActionBusy(true);
            await promoteClubMember(club.id, target.user_id);
            closePromoteConfirm(() => {
                void loadClub();
            });
        }
        catch (error) {
            console.error('Could not promote club member:', error);
            Alert.alert('Could not make admin', 'Please try again.');
        }
        finally {
            setMemberActionBusy(false);
        }
    }
    function promoteSelectedMember() {
        if (!club ||
            !memberActionTarget ||
            club.membership_role !==
                'owner' ||
            memberActionTarget.role !==
                'member') {
            return;
        }
        const target = memberActionTarget;
        closeMemberActions(() => {
            setPromoteConfirmTarget(target);
        });
    }
    function dismissPromoteConfirmByGesture() {
        if (!promoteConfirmTarget ||
            promoteConfirmClosing.current ||
            promoteConfirmGestureClosing.current ||
            memberActionBusy) {
            return;
        }
        promoteConfirmGestureClosing.current =
            true;
        const offscreenY = Math.max(promoteConfirmSheetHeight.current +
            32, 420);
        uiPromoteConfirm.closeAfterActionWithCallback();
    }
    function closeDemoteConfirm(afterClose?: () => void) {
        if (!demoteConfirmTarget ||
            demoteConfirmClosing.current) {
            return;
        }
        demoteConfirmClosing.current =
            true;
        uiDemoteConfirm.closeAfterActionWithCallback(afterClose);
    }
    function dismissDemoteConfirmByGesture() {
        if (!demoteConfirmTarget ||
            demoteConfirmClosing.current ||
            demoteConfirmGestureClosing.current ||
            memberActionBusy) {
            return;
        }
        demoteConfirmGestureClosing.current =
            true;
        const offscreenY = Math.max(demoteConfirmSheetHeight.current +
            32, 420);
        uiDemoteConfirm.closeAfterActionWithCallback();
    }
    async function confirmDemoteAdmin() {
        if (!club ||
            !demoteConfirmTarget ||
            memberActionBusy) {
            return;
        }
        const target = demoteConfirmTarget;
        try {
            setMemberActionBusy(true);
            await demoteClubAdmin(club.id, target.user_id);
            closeDemoteConfirm(() => {
                void loadClub();
            });
        }
        catch (error) {
            console.error('Could not demote club admin:', error);
            Alert.alert('Could not remove admin', 'Please try again.');
        }
        finally {
            setMemberActionBusy(false);
        }
    }
    function demoteSelectedAdmin() {
        if (!club ||
            !memberActionTarget ||
            club.membership_role !==
                'owner' ||
            memberActionTarget.role !==
                'admin') {
            return;
        }
        const target = memberActionTarget;
        closeMemberActions(() => {
            setDemoteConfirmTarget(target);
        });
    }
    function closeRemoveMemberConfirm(afterClose?: () => void) {
        if (!removeMemberConfirmTarget ||
            removeMemberConfirmClosing.current) {
            return;
        }
        removeMemberConfirmClosing.current =
            true;
        uiRemoveMemberConfirm.closeAfterActionWithCallback(afterClose);
    }
    function dismissRemoveMemberConfirmByGesture() {
        if (!removeMemberConfirmTarget ||
            removeMemberConfirmClosing.current ||
            removeMemberConfirmGestureClosing.current ||
            memberActionBusy) {
            return;
        }
        removeMemberConfirmGestureClosing.current =
            true;
        const offscreenY = Math.max(removeMemberConfirmSheetHeight.current +
            32, 420);
        uiRemoveMemberConfirm.closeAfterActionWithCallback();
    }
    async function confirmRemoveMember() {
        if (!club ||
            !removeMemberConfirmTarget ||
            memberActionBusy) {
            return;
        }
        const target = removeMemberConfirmTarget;
        try {
            setMemberActionBusy(true);
            await kickClubMember(club.id, target.user_id);
            closeRemoveMemberConfirm(() => {
                void loadClub();
            });
        }
        catch (error) {
            console.error('Could not remove club member:', error);
            Alert.alert('Could not remove member', 'Please try again.');
        }
        finally {
            setMemberActionBusy(false);
        }
    }
    function kickSelectedMember() {
        if (!club ||
            !memberActionTarget) {
            return;
        }
        const target = memberActionTarget;
        closeMemberActions(() => {
            setRemoveMemberConfirmTarget(target);
        });
    }
    async function confirmBlockMember() {
        if (!club ||
            !blockConfirmTarget ||
            memberActionBusy) {
            return;
        }
        try {
            setMemberActionBusy(true);
            await kickClubMember(club.id, blockConfirmTarget.user_id);
            await blockReader(blockConfirmTarget.user_id);
            await loadClub();
        }
        catch (error) {
            console.error('Could not block club member:', error);
            Alert.alert('Could not block reader', 'Please try again.');
            throw error;
        }
        finally {
            setMemberActionBusy(false);
        }
    }
    function blockSelectedMember() {
        if (!club ||
            !memberActionTarget) {
            return;
        }
        const target = memberActionTarget;
        closeMemberActions(() => {
            setBlockConfirmTarget(target);
        });
    }
    function reportSelectedMember() {
        if (!memberActionTarget) {
            return;
        }
        const target = memberActionTarget;
        closeMemberActions(() => {
            setMemberReportTarget(target);
        });
    }
    const reportConfirmation = useReportConfirmation(Boolean(memberReportTarget));
    async function handleMemberReport(reason: ReportReason) {
        if (!memberReportTarget ||
            memberReportSubmitting) {
            return;
        }
        try {
            setMemberReportSubmitting(true);
            await submitProfileReport(memberReportTarget.user_id, reason);
            setMemberReportSubmitting(false);
            closeMemberReport(() => {
                reportConfirmation.queue();
            });
        }
        catch (error) {
            console.error('Could not report club member:', error);
            setMemberReportSubmitting(false);
            Alert.alert('Could not submit report', 'Please try again.');
        }
    }
    function confirmLeave() {
        if (!club ||
            membershipLoading) {
            return;
        }
        setLeaveConfirmVisible(true);
    }
    async function handleLeave() {
        if (!club ||
            membershipLoading) {
            return;
        }
        try {
            setMembershipLoading(true);
            await leaveClub(club.id);
            await loadClub();
        }
        catch (leaveError) {
            console.error('Could not leave club:', leaveError);
            Alert.alert('Could not leave club', leaveError instanceof Error
                ? leaveError.message
                : 'Please try again.');
            throw leaveError;
        }
        finally {
            setMembershipLoading(false);
        }
    }
    function openReader(readerId: string) {
        if (!readerId)
            return;
        router.push({
            pathname: '/reader/[id]',
            params: {
                id: readerId,
            },
        });
    }
    function formatPostTime(createdAt: string) {
        const created = new Date(createdAt);
        const diffMs = Date.now() -
            created.getTime();
        const minutes = Math.max(0, Math.floor(diffMs / 60000));
        if (minutes < 1) {
            return 'now';
        }
        if (minutes < 60) {
            return `${minutes}m`;
        }
        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            return `${hours}h`;
        }
        const days = Math.floor(hours / 24);
        if (days < 7) {
            return `${days}d`;
        }
        return created.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
        });
    }
    async function shareRenderedPost(postId: string) {
        try {
            await sharePostLink(postId);
        }
        catch (shareError) {
            console.error('Could not share post:', shareError);
            Alert.alert('Could not share post', 'Please try again.');
        }
    }
    async function handlePostVote(postId: string, voteValue: PostVoteValue) {
        if (votingPostId ===
            postId) {
            return;
        }
        try {
            setVotingPostId(postId);
            const nextVote = await togglePostVote(postId, voteValue);
            setClubPosts((current) => current.map((post) => post.id ===
                postId
                ? {
                    ...post,
                    ...nextVote,
                }
                : post));
        }
        catch (error) {
            console.error('Could not update post vote:', error);
            Alert.alert('Could not vote', 'Please try again.');
        }
        finally {
            setVotingPostId(null);
        }
    }
    async function handleClubPin(postId: string, pinned: boolean, replacePostId?: string) {
        if (pinBusy || !club || !['owner', 'admin'].includes(club.membership_role ?? ''))
            return;
        try {
            setPinBusy(true);
            await setClubPostPin(club.id, postId, pinned, replacePostId);
            const pins = await getClubPins(club.id);
            const nextPins = await resolveClubPinnedPosts(club.id, pins, [...pinnedPosts, ...clubPosts]);
            if (pinClubIdRef.current === club.id)
                setPinnedPosts(nextPins);
        }
        catch (error) {
            Alert.alert('Could not update pins', (error as {
                message?: string;
            } | null)?.message || 'Reload the club and try again.');
        }
        finally {
            setPinBusy(false);
        }
    }
    function renderClubPost(post: FeedPost) {
        const plainPost = post.post_type === 'post' && !post.is_club_announcement && !post.club_discussion
            && !post.club_event && !post.reading_recap && !post.book_stack_id && !post.post_image_url && !post.book_title;
        const displayName = post.author_display_name?.trim() ||
            post.author_username?.trim() ||
            'Novori Reader';
        const username = post.author_username?.trim()
            ? `@${post.author_username.trim()}`
            : '';
        const authorInitial = displayName
            .charAt(0)
            .toUpperCase();
        const questionContent = post.post_type ===
            'question'
            ? splitQuestionPostBody(post.body)
            : null;
        return (<Pressable key={post.id} accessibilityRole="button" accessibilityLabel="Open club post and comments" onPress={() => {
            preserveClubStateOnNextFocus.current = true;
            router.push({ pathname: '/post/[id]', params: { id: post.id } });
        }} style={styles.postCard}>
        <Pressable onPress={() => openReader(post.author_id)} style={({ pressed }) => [
                styles.postHeader,
                { paddingRight: club?.membership_role === 'owner' || club?.membership_role === 'admin' ? 66 : 32 },
                pressed &&
                    styles.pressed
            ]}>
          {post.author_avatar_url ? (<CachedMediaImage source={{
                    uri: moderationMediaUrl(post.author_avatar_url),
                }} style={styles.postAvatar}/>) : (<View style={styles.postAvatarFallback}>
              <Text style={styles.postAvatarText}>
                {authorInitial}
              </Text>
            </View>)}

          <View style={styles.postAuthorCopy}>
            <View style={styles.postAuthorRow}>
              <Text style={styles.postAuthorName} numberOfLines={1}>
                {displayName}
              </Text>

              <Text style={styles.postTime}>
                · {formatPostTime(post.created_at)}
              </Text>
            </View>

            {username ? (<Text style={styles.postUsername} numberOfLines={1}>
                {username}
              </Text>) : null}
          </View>
        </Pressable>

        <Pressable onPress={() => void shareRenderedPost(post.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Share post" style={({ pressed }) => [
                styles.postHeaderShare,
                pressed &&
                    styles.pressed
            ]}>
          <Ionicons name="share-social-outline" size={18} color={colors.mutedText}/>
        </Pressable>

        {(club?.membership_role === 'owner' || club?.membership_role === 'admin') && (!post.club_event || isUpcomingClubEvent(post.club_event, eventNow)) ? <Pressable disabled={pinBusy} accessibilityRole="button" accessibilityLabel={`Pin options: ${post.id}`} hitSlop={8} onPress={() => { Keyboard.dismiss(); setPinTarget(post); }} style={({ pressed }) => [styles.postPinButton, pressed && styles.pressed]}>
          <Ionicons name={pinnedPosts.some(pin => pin.id === post.id) ? 'pin' : 'pin-outline'} size={18} color={colors.gold}/>
        </Pressable> : null}

        <PostTypeIdentifier attachmentHasLabel={Boolean(post.club_discussion || (post.post_type === 'book_stack' && post.book_stack_id))} discussion={Boolean(post.club_discussion)} poll={post.club_discussion?.kind === 'poll'} event={Boolean(post.club_event)} announcement={post.is_club_announcement} readingRecap={Boolean(post.reading_recap)} postType={post.post_type} rating={post.rating} colors={colors}/>

        <PostSpoilerContent post={post}>
        {questionContent ? (<>
            <Text style={styles.questionPostTitle}>
              {questionContent.question}
            </Text>

            {questionContent.context ? (<Text style={styles.questionPostContext}>
                {questionContent.context}
              </Text>) : null}
          </>) : post.body.trim() && !post.club_discussion ? (<Text style={[styles.postBody, plainPost && styles.plainPostBody]}>
            {post.body}
          </Text>) : null}

        {post.club_discussion ? <ClubDiscussionPostAttachment discussion={post.club_discussion}/> : null}
        {post.club_event ? <ClubEventPostAttachment event={post.club_event}/> : null}
        {post.reading_recap ? <ReadingRecapPostAttachment snapshot={post.reading_recap}/> : null}

        {post.post_image_url ? (<FeedPostImage uri={post.post_image_url} colors={colors}/>) : null}

        </PostSpoilerContent>
        {post.post_type === 'book_stack' && post.book_stack_id ? <BookStackPostAttachment stackId={post.book_stack_id} compactTopSpacing={!post.body.trim()}/> : null}
        {post.book_title ? (post.post_image_url ? (<Pressable disabled={!post.google_book_id} onPress={() => {
                    if (!post.google_book_id) {
                        return;
                    }
                    router.push({
                        pathname: '/book/[id]',
                        params: {
                            id: post.google_book_id,
                        },
                    });
                }} style={({ pressed, }) => [
                    styles.postCompactBookLink,
                    pressed &&
                        Boolean(post.google_book_id) &&
                        styles.pressed
                ]}>
              <Ionicons name="book-outline" size={14} color={colors.gold}/>

              <View style={styles.postCompactBookCopy}>
                <Text style={styles.postCompactBookTitle} numberOfLines={1}>
                  {displayBookTitle(post.book_title ?? '')}
                </Text>

                {(post.book_authors &&
                    post.book_authors.length >
                        0) ||
                    post.book_series_name ? (<Text style={styles.postCompactBookMeta} numberOfLines={1}>
                    {post.book_authors &&
                        post.book_authors.length >
                            0
                        ? post.book_authors.join(', ')
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
                  </Text>) : null}
              </View>

              {post.google_book_id ? (<Ionicons name="chevron-forward" size={15} color={colors.mutedText}/>) : null}
            </Pressable>) : (<Pressable disabled={!post.google_book_id} onPress={() => {
                    if (!post.google_book_id) {
                        return;
                    }
                    router.push({
                        pathname: '/book/[id]',
                        params: {
                            id: post.google_book_id,
                        },
                    });
                }} style={({ pressed, }) => [
                    styles.postBookCard,
                    pressed &&
                        Boolean(post.google_book_id) &&
                        styles.pressed
                ]}>
              {(post.google_book_id || post.book_cover_url) ? (<BookCoverImage googleBookId={post.google_book_id} existingCoverUrl={post.book_cover_url} style={styles.postBookCover}/>) : (<View style={styles.postBookCoverFallback}>
                  <Ionicons name="book-outline" size={18} color={colors.gold}/>
                </View>)}

              <View style={styles.postBookCopy}>
                <Text style={styles.postBookTitle} numberOfLines={2}>
                  {displayBookTitle(post.book_title ?? '')}
                </Text>

                {post.book_authors &&
                    post.book_authors.length >
                        0 ? (<Text style={styles.postBookAuthor} numberOfLines={1}>
                    {post.book_authors.join(', ')}
                  </Text>) : null}

                {post.rating ? (<Text style={styles.postBookRating}>
                    ★ {post.rating}
                  </Text>) : null}
              </View>
            </Pressable>)) : null}

        <View style={styles.postVoteRow}>
          <View style={styles.postVotePill}>
          <Pressable disabled={votingPostId ===
                post.id} accessibilityRole="button" accessibilityLabel="Upvote post" accessibilityState={{ selected: post.viewer_vote === 1 }} onPress={event => { event.stopPropagation(); void handlePostVote(post.id, 1); }} hitSlop={8} style={({ pressed }) => [
                styles.postVoteButton,
                post.viewer_vote ===
                    1 &&
                    styles.postVoteButtonActive,
                pressed &&
                    styles.pressed,
                votingPostId ===
                    post.id &&
                    styles.postVoteButtonDisabled
            ]}>
            <Ionicons name={post.viewer_vote ===
                1
                ? 'arrow-up-circle'
                : 'arrow-up-circle-outline'} size={20} color={post.viewer_vote ===
                1
                ? colors.gold
                : colors.mutedText}/>
          </Pressable>

          <Text style={[
                styles.postVoteScore,
                post.viewer_vote !==
                    0 &&
                    styles.postVoteScoreActive
            ]}>
            {post.vote_score ??
                0}
          </Text>

          <Pressable disabled={votingPostId ===
                post.id} accessibilityRole="button" accessibilityLabel="Downvote post" accessibilityState={{ selected: post.viewer_vote === -1 }} onPress={event => { event.stopPropagation(); void handlePostVote(post.id, -1); }} hitSlop={8} style={({ pressed }) => [
                styles.postVoteButton,
                post.viewer_vote ===
                    -1 &&
                    styles.postVoteButtonActive,
                pressed &&
                    styles.pressed,
                votingPostId ===
                    post.id &&
                    styles.postVoteButtonDisabled
            ]}>
            <Ionicons name={post.viewer_vote ===
                -1
                ? 'arrow-down-circle'
                : 'arrow-down-circle-outline'} size={20} color={post.viewer_vote ===
                -1
                ? colors.gold
                : colors.mutedText}/>
          </Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open club post comments" hitSlop={8} onPress={event => {
              event.stopPropagation();
              openCommentsSheet(post);
          }} style={({ pressed }) => [styles.postCommentPill, pressed && styles.pressed]}>
            <Ionicons name="chatbubble-outline" size={17} color={colors.mutedText}/>
            <Text style={{ color: colors.mutedText, fontFamily: 'Inter_500Medium', fontSize: 12 }}>{post.comment_count ?? 0} {(post.comment_count ?? 0) === 1 ? 'comment' : 'comments'}</Text>
          </Pressable>
        </View>
      </Pressable>);
    }
    function renderMember(member: ClubMember) {
        const displayName = member.display_name?.trim() ||
            member.username?.trim() ||
            'Novori Reader';
        const username = member.username?.trim()
            ? `@${member.username.trim()}`
            : '';
        const initial = displayName.charAt(0).toUpperCase();
        return (<Pressable key={member.user_id} onPress={() => {
                preserveClubStateOnNextFocus.current =
                    true;
                openReader(member.user_id);
            }} onLongPress={() => openMemberActions(member)} delayLongPress={220} style={({ pressed }) => [
                styles.memberRow,
                memberActionTarget?.user_id ===
                    member.user_id &&
                    styles.memberRowSelected,
                pressed &&
                    styles.pressed
            ]}>
        {memberActionTarget?.user_id ===
                member.user_id ? (<Animated.View pointerEvents="none" style={[
                    styles.memberActionAccent,
                    {
                        opacity: memberActionAccentOpacity,
                    }
                ]}/>) : null}
        {member.avatar_url ? (<CachedMediaImage source={{
                    uri: moderationMediaUrl(member.avatar_url),
                }} style={styles.memberAvatar}/>) : (<View style={styles.memberAvatarFallback}>
            <Text style={styles.memberAvatarText}>
              {initial}
            </Text>
          </View>)}

        <View style={styles.memberCopy}>
          <Text style={styles.memberName} numberOfLines={1}>
            {displayName}
          </Text>

          {username ? (<Text style={styles.memberUsername} numberOfLines={1}>
              {username}
            </Text>) : null}
        </View>

        <Text style={styles.roleText}>
          {roleLabel(member.role)}
        </Text>
      </Pressable>);
    }
    function renderInviteCandidate(result: ClubInviteCandidate) {
        const candidate = sentInviteIds.has(result.id) ? { ...result, invite_pending: true } : result;
        const displayName = candidate.display_name
            ?.trim() ||
            candidate.username
                ?.trim() ||
            'Novori Reader';
        const username = candidate.username
            ?.trim()
            ? `@${candidate.username.trim()}`
            : '';
        const initial = displayName
            .charAt(0)
            .toUpperCase();
        const busy = invitingReaderId ===
            candidate.id;
        const disabled = invitingReaderId !== null || candidate.invite_pending;
        return (<View key={candidate.id} style={styles.inviteReaderRow}>
        <View style={styles.inviteReaderIdentity}>
          {candidate.avatar_url ? (<CachedMediaImage source={{
                    uri: moderationMediaUrl(candidate.avatar_url),
                }} style={styles.inviteReaderAvatar}/>) : (<View style={styles.inviteReaderAvatarFallback}>
              <Text style={styles.inviteReaderAvatarText}>
                {initial}
              </Text>
            </View>)}

          <View style={styles.inviteReaderCopy}>
            <Text style={styles.inviteReaderName} numberOfLines={1}>
              {displayName}
            </Text>

            {username ? (<Text style={styles.inviteReaderUsername} numberOfLines={1}>
                {username}
              </Text>) : null}
          </View>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={candidate.invite_pending ? `Invitation sent to ${displayName}` : `Invite ${displayName}`} disabled={disabled} onPress={() => handleInviteReader(candidate)} style={({ pressed }) => [
                styles.inviteReaderButton,
                (candidate.is_member ||
                    candidate.invite_pending) &&
                    styles.inviteReaderButtonDisabled,
                pressed &&
                    !disabled &&
                    styles.pressed
            ]}>
          {busy ? (<ActivityIndicator size="small" color={colors.background}/>) : (<Text style={[
                    styles.inviteReaderButtonText,
                    (candidate.is_member ||
                        candidate.invite_pending) &&
                        styles.inviteReaderButtonTextDisabled
                ]}>
              {candidate.is_member
                    ? 'Member'
                    : candidate.invite_pending
                        ? 'Invited'
                        : 'Invite'}
            </Text>)}
        </Pressable>
      </View>);
    }
    function renderManagerJoinRequest(request: ClubJoinRequest) {
        const displayName = request.display_name
            ?.trim() ||
            request.username
                ?.trim() ||
            'Novori Reader';
        const username = request.username
            ?.trim()
            ? `@${request.username.trim()}`
            : '';
        const initial = displayName
            .charAt(0)
            .toUpperCase();
        const busy = processingJoinRequestId ===
            request.id;
        return (<View key={request.id} style={styles.joinRequestRow}>
        <Pressable onPress={() => openReader(request.requester_id)} style={({ pressed }) => [
                styles.joinRequestIdentity,
                pressed &&
                    styles.pressed
            ]}>
          {request.avatar_url ? (<CachedMediaImage source={{
                    uri: moderationMediaUrl(request.avatar_url),
                }} style={styles.joinRequestAvatar}/>) : (<View style={styles.joinRequestAvatarFallback}>
              <Text style={styles.joinRequestAvatarText}>
                {initial}
              </Text>
            </View>)}

          <View style={styles.joinRequestCopy}>
            <Text style={styles.joinRequestName} numberOfLines={1}>
              {displayName}
            </Text>

            <Text style={styles.joinRequestMeta} numberOfLines={1}>
              {username
                ? `${username} · wants to join`
                : 'Wants to join'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.joinRequestActions}>
          <Pressable disabled={Boolean(processingJoinRequestId)} onPress={() => handleDeclineJoinRequest(request)} style={({ pressed }) => [
                styles.joinRequestDeclineButton,
                pressed &&
                    styles.pressed
            ]}>
            <Text style={styles.joinRequestDeclineText}>
              Decline
            </Text>
          </Pressable>

          <Pressable disabled={Boolean(processingJoinRequestId)} onPress={() => handleApproveJoinRequest(request)} style={({ pressed }) => [
                styles.joinRequestApproveButton,
                pressed &&
                    styles.pressed
            ]}>
            {busy ? (<ActivityIndicator size="small" color={colors.background}/>) : (<Text style={styles.joinRequestApproveText}>
                Accept
              </Text>)}
          </Pressable>
        </View>
      </View>);
    }
    function renderManagerInvite(invitation: ClubInvitation) {
        const displayName = invitation.display_name
            ?.trim() ||
            invitation.username
                ?.trim() ||
            'Novori Reader';
        const username = invitation.username
            ?.trim()
            ? `@${invitation.username.trim()}`
            : '';
        const initial = displayName
            .charAt(0)
            .toUpperCase();
        const busy = cancellingInviteId ===
            invitation.id;
        return (<View key={invitation.id} style={styles.pendingInviteRow}>
        {invitation.avatar_url ? (<CachedMediaImage source={{
                    uri: moderationMediaUrl(invitation.avatar_url),
                }} style={styles.pendingInviteAvatar}/>) : (<View style={styles.pendingInviteAvatarFallback}>
            <Text style={styles.pendingInviteAvatarText}>
              {initial}
            </Text>
          </View>)}

        <View style={styles.pendingInviteCopy}>
          <Text style={styles.pendingInviteName} numberOfLines={1}>
            {displayName}
          </Text>

          <Text style={styles.pendingInviteMeta} numberOfLines={1}>
            {username
                ? `${username} · Pending`
                : 'Invitation pending'}
          </Text>
        </View>

        <Pressable disabled={Boolean(cancellingInviteId)} onPress={() => handleCancelInvite(invitation)} hitSlop={8} style={({ pressed }) => [
                styles.cancelInviteButton,
                pressed &&
                    styles.pressed
            ]}>
          {busy ? (<ActivityIndicator size="small" color={colors.mutedText}/>) : (<Text style={styles.cancelInviteText}>
              Cancel
            </Text>)}
        </Pressable>
      </View>);
    }
    const uiMemberAction = useUiSheetMotion({ visible: Boolean(memberActionTarget), busy: memberActionBusy, embedded: false, onDismiss: () => {
            const finished = true;
            memberActionClosing.current =
                false;
            if (!finished) {
                return;
            }
            setMemberActionTarget(null);
        } });
    const uiMemberReport = useUiSheetMotion({ visible: Boolean(memberReportTarget), busy: memberReportSubmitting, embedded: false, onDismiss: () => {
            const finished = true;
            memberReportClosing.current =
                false;
            if (!finished) {
                return;
            }
            setMemberReportTarget(null);
        } });
    const uiPromoteConfirm = useUiSheetMotion({ visible: Boolean(promoteConfirmTarget), busy: memberActionBusy, embedded: false, onDismiss: () => {
            const finished = true;
            promoteConfirmClosing.current =
                false;
            if (!finished) {
                return;
            }
            setPromoteConfirmTarget(null);
        } });
    const uiDemoteConfirm = useUiSheetMotion({ visible: Boolean(demoteConfirmTarget), busy: memberActionBusy, embedded: false, onDismiss: () => {
            const finished = true;
            demoteConfirmClosing.current =
                false;
            if (!finished) {
                return;
            }
            setDemoteConfirmTarget(null);
        } });
    const uiRemoveMemberConfirm = useUiSheetMotion({ visible: Boolean(removeMemberConfirmTarget), busy: memberActionBusy, embedded: false, onDismiss: () => {
            const finished = true;
            removeMemberConfirmClosing.current =
                false;
            if (!finished) {
                return;
            }
            setRemoveMemberConfirmTarget(null);
        } });
    if (loading || (club && club.id !== clubId && !error)) {
        return (<SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={colors.gold}/>
        </View>
      </SafeAreaView>);
    }
    if (!club || error) {
        return (<SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text}/>
          </Pressable>

          <Text style={styles.headerTitle}>
            Club
          </Text>

          <View style={styles.headerSpacer}/>
        </View>

        <View style={styles.centered}>
          <Ionicons name="people-outline" size={35} color={colors.mutedText}/>

          <Text style={styles.errorTitle}>
            Club unavailable
          </Text>

          <Text style={styles.errorText}>
            {error ||
                'This club could not be loaded.'}
          </Text>
        </View>
      </SafeAreaView>);
    }
    const role = club.membership_role;
    const isOwner = role === 'owner';
    const isManager = role === 'owner' ||
        role === 'admin';
    const isMember = Boolean(role);
    const ownerMember = members.find((member) => member.role ===
        'owner') ??
        members[0] ??
        null;
    const otherMembers = ownerMember
        ? members.filter((member) => member.user_id !==
            ownerMember.user_id)
        : [];
    const canViewMembers = club.privacy === 'public' || isMember;
    const clubActions = getClubHomeActions(role, canViewMembers, Boolean(club.rules?.trim()));
    function editClub() {
        if (isOwner)
            router.push({ pathname: '/edit-club', params: { clubId: club!.id } });
    }
    function toggleManagement(next = !managementVisible) {
        if (!isManager)
            return;
        setManagementVisible(next);
        setMembersVisible(next);
    }
    async function handleShareClub() {
        if (!club)
            return;
        try {
            await shareClubLink({ clubId: club.id, name: club.name });
        }
        catch {
            Alert.alert('Could not share club', 'Please try again.');
        }
    }
    async function openClubComposer(announcement = false) {
        const warm = composerWarm.current;
        if (!club?.membership_role || openingComposer.current) return;
        const { id, name, cover_url } = club;
        openingComposer.current = true;
        try {
            const matches = warm && warm.clubId === id && warm.userId === currentUserId;
            const [profile] = await Promise.all([
                matches ? warm.profile : currentUserId ? loadComposerProfile(currentUserId).catch(() => null) : null,
                matches ? warm.cover : warmComposerImage(cover_url).catch(() => {}),
            ]);
            if (!experienceMounted.current || pinClubIdRef.current !== id) return;
            const previewKey = currentUserId ? prepareClubComposerPreview({
                clubId: id, clubName: name, clubCover: cover_url, userId: currentUserId, profile,
            }) : undefined;
            router.push({ pathname: '/create-post', params: {
                clubId: id, clubName: name, previewKey, ...(announcement ? { announcement: '1' } : {}),
            } });
        } finally {
            openingComposer.current = false;
        }
    }
    function handleClubAction(action: ClubHomeAction) {
        if (!clubActions.includes(action))
            return;
        if (action === 'edit')
            editClub();
        else if (action === 'rules') {
            setRulesExpanded(true);
            clubScrollRef.current?.scrollTo({ y: 0, animated: true });
        }
        else if (action === 'members') {
            if (membersVisible)
                clubScrollRef.current?.scrollTo({ y: Math.max(0, membersSectionY.current - 12), animated: true });
            else
                pendingMemberScroll.current = true;
            setMembersVisible(true);
        }
        else if (action === 'manage') {
            toggleManagement(true);
            clubScrollRef.current?.scrollTo({ y: 0, animated: true });
        }
        else if (action === 'announce' && isManager)
            void openClubComposer(true);
        else if (action === 'discussions' && club)
            router.push({ pathname: '/club-discussions', params: { clubId: club.id } });
        else if (action === 'notification_settings')
            router.push('/notification-settings');
        else if (action === 'notifications')
            void updateClubExperience('notifications');
        else if (action === 'leave')
            confirmLeave();
    }
    async function updateClubExperience(action: 'notifications' | 'welcome') {
        if (!club?.membership_role || experienceMutation.current)
            return;
        const target = club.id;
        experienceMutation.current = true;
        setExperienceBusy(true);
        try {
            const previous = memberExperience ?? await getClubMemberExperience(target);
            const next = action === 'notifications' ? await setClubNotificationsEnabled(target, !previous.notifications_enabled) : await dismissClubWelcome(target);
            if (experienceMounted.current && pinClubIdRef.current === target) {
                experienceVersion.current++;
                setMemberExperience(next);
                setExperienceWarning('');
                if (action === 'welcome')
                    setWelcomeOpen(false);
            }
        }
        catch (error) {
            if (experienceMounted.current && pinClubIdRef.current === target)
                setExperienceWarning((error as {
                    message?: string;
                })?.message || 'Could not save your club preference.');
        }
        finally {
            experienceMutation.current = false;
            if (experienceMounted.current)
                setExperienceBusy(false);
        }
    }
    return (<SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerActions}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed
        ]}>
          <Ionicons name="chevron-back" size={24} color={colors.text}/>
        </Pressable>
        </View>

        <Text style={styles.headerTitle} numberOfLines={1}>
          Club
        </Text>

        <View style={styles.headerActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Share club" onPress={() => { Keyboard.dismiss(); void handleShareClub(); }} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <Ionicons name="share-social-outline" size={23} color={colors.text}/>
          </Pressable>
          {clubActions.length ? <Pressable accessibilityRole="button" accessibilityLabel={isManager && managerJoinRequests.length > 0 ? `Open club options, ${managerJoinRequests.length} pending join requests` : "Open club options"} onPress={() => { Keyboard.dismiss(); setClubMenuVisible(true); }} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}><Ionicons name="ellipsis-horizontal" size={23} color={colors.text}/>{isManager && managerJoinRequests.length > 0 ? <View pointerEvents="none" style={styles.clubOptionsDot}/> : null}</Pressable> : <View style={styles.headerSpacer}/>}
        </View>
      </View>

      {isManager && invitePanelOpen ? (
        <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setInvitePanelOpen(false)}>
          <SafeAreaProvider style={styles.safeArea}>
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
            <View style={styles.header}>
              <Pressable accessibilityRole="button" accessibilityLabel="Back to club" hitSlop={8} onPress={() => { Keyboard.dismiss(); setInvitePanelOpen(false); }} style={styles.headerButton}>
                <Ionicons name="chevron-back" size={24} color={colors.text}/>
              </Pressable>
              <Text style={styles.headerTitle}>Invite readers</Text>
              <View style={styles.headerSpacer}/>
            </View>
            <View style={styles.inviteScreenBody}>
              <View style={styles.inviteSearchWrap}>
                <Ionicons name="search-outline" size={18} color={colors.mutedText}/>
                <View style={styles.inviteSearchField}>
                  <TextInput accessibilityLabel="Search by name or username" value={inviteQuery} onChangeText={setInviteQuery}
                    autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={styles.inviteSearchInput}/>
                </View>
                {inviteQuery ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10} onPress={() => setInviteQuery('')}>
                  <Ionicons name="close-circle" size={20} color={colors.mutedText}/>
                </Pressable> : null}
                {!inviteQuery ? <View pointerEvents="none" accessible={false}
                    accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.inviteSearchPlaceholder}>
                    <Text numberOfLines={1} style={styles.inviteSearchPlaceholderText}>Search by name or @username</Text>
                  </View> : null}
              </View>
              {!inviteTerm && !inviteSearchLoading && !inviteSearchError && inviteResults.length > 0
                ? <Text style={styles.inviteResultsLabel}>Suggested readers</Text> : null}
              {inviteSearchLoading ? <ActivityIndicator style={styles.inviteSearchHint} color={colors.gold}/>
                : inviteSearchError ? <Pressable accessibilityRole="button" onPress={() => retryInviteSearch(value => value + 1)}>
                  <Text style={styles.inviteSearchHint}>Couldn’t load readers. Tap to retry.</Text>
                </Pressable>
                : !inviteResults.length ? <Text style={styles.inviteSearchHint}>{inviteTerm.length === 1
                  ? 'Enter at least two characters to search.'
                  : inviteTerm ? 'No matching readers to invite.' : 'No suggestions yet. Search to find a reader.'}</Text>
                : <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets
                    contentContainerStyle={styles.inviteResultsContent}>
                    {inviteResults.map(renderInviteCandidate)}
                  </ScrollView>}
            </View>
          </SafeAreaView>
          </SafeAreaProvider>
        </Modal>
      ) : null}

      <ScrollView {...browsingScroll} nestedScrollEnabled ref={clubScrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshClub} tintColor={colors.gold} colors={[
                colors.gold
            ]} progressBackgroundColor={colors.surface}/>}>
        <ClubHomeCard key={club.id} club={club} canViewMembers={canViewMembers} rulesExpanded={rulesExpanded} membersVisible={membersVisible} onPhoto={() => setClubImageOpen(true)} onMembers={() => {
            if (membersVisible && !managementVisible) setMembersVisible(false);
            else handleClubAction('members');
        }} onCloseRules={() => setRulesExpanded(false)} onEdit={editClub} onInvite={isManager ? () => {
            setInviteQuery('');
            setInviteResults([]);
            setInviteSearchError(false);
            setInviteSearchLoading(true);
            setInvitePanelOpen(true);
        } : undefined}/>
        {isMember && welcomeOpen && memberExperience ? <ClubWelcomeCard name={club.name} experience={memberExperience} eventTitle={nextEvent?.title} hasRules={Boolean(club.rules?.trim())} busy={experienceBusy} onBooks={() => setClubTab('books')} onDiscussion={() => router.push({ pathname: '/club-discussions', params: { clubId: club.id } })} onEvents={() => setClubTab('events')} onRules={() => { setRulesExpanded(true); clubScrollRef.current?.scrollTo({ y: 0, animated: true }); }} onDismiss={() => void updateClubExperience('welcome')}/> : null}

        {pendingInvite &&
            !isMember ? (<View style={styles.invitationCard}>
            <View style={styles.invitationIcon}>
              <Ionicons name="mail-unread-outline" size={21} color={colors.gold}/>
            </View>

            <View style={styles.invitationCopy}>
              <Text style={styles.invitationTitle}>
                You’re invited
              </Text>

              <Text style={styles.invitationText}>
                {pendingInvite.inviter_display_name
                ?.trim() ||
                pendingInvite.inviter_username
                    ?.trim() ||
                'A club manager'}{' '}
                invited you to join{' '}
                {club.name}.
              </Text>
            </View>

            <View style={styles.invitationActions}>
              <Pressable disabled={respondingToInvite} onPress={handleDeclineInvite} style={({ pressed }) => [
                styles.invitationDeclineButton,
                pressed &&
                    styles.pressed
            ]}>
                <Text style={styles.invitationDeclineText}>
                  Decline
                </Text>
              </Pressable>

              <Pressable disabled={respondingToInvite} onPress={handleAcceptInvite} style={({ pressed }) => [
                styles.invitationAcceptButton,
                pressed &&
                    styles.pressed
            ]}>
                {respondingToInvite ? (<ActivityIndicator size="small" color={colors.background}/>) : (<Text style={styles.invitationAcceptText}>
                    Accept
                  </Text>)}
              </Pressable>
            </View>
          </View>) : null}

        {isMember || accessLoading ? null : pendingInvite ? (null) : club.privacy ===
            'private' ? (<Pressable disabled={joinRequestLoading} onPress={pendingJoinRequest
                ? handleCancelAccessRequest
                : handleRequestAccess} style={({ pressed }) => [
                styles.requestAccessButton,
                pendingJoinRequest &&
                    styles.requestAccessButtonPending,
                pressed &&
                    styles.pressed
            ]}>
            {joinRequestLoading ? (<ActivityIndicator size="small" color={pendingJoinRequest
                    ? colors.mutedText
                    : colors.background}/>) : (<>
                <Ionicons name={pendingJoinRequest
                    ? 'time-outline'
                    : 'lock-open-outline'} size={18} color={pendingJoinRequest
                    ? colors.mutedText
                    : colors.background}/>

                <Text style={[
                    styles.requestAccessButtonText,
                    pendingJoinRequest &&
                        styles.requestAccessButtonTextPending
                ]}>
                  {pendingJoinRequest
                    ? 'Request Sent · Tap to Cancel'
                    : 'Request Access'}
                </Text>
              </>)}
          </Pressable>) : (<Pressable disabled={membershipLoading} onPress={handleJoin} style={({ pressed }) => [
                styles.primaryButton,
                pressed &&
                    styles.pressed
            ]}>
            {membershipLoading ? (<ActivityIndicator size="small" color={colors.background}/>) : (<>
                <Ionicons name="add" size={18} color={colors.background}/>

                <Text style={styles.primaryButtonText}>
                  Join Club
                </Text>
              </>)}
          </Pressable>)}

        {isManager && managementVisible ? <View style={styles.clubManagementHeader}>
          <Text style={styles.sectionTitle}>Manage club</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close club management" onPress={() => toggleManagement(false)} style={styles.headerButton}>
            <Ionicons name="close" size={22} color={colors.text}/>
          </Pressable>
        </View> : null}
        {isManager && managementVisible &&
            managerJoinRequests.length >
                0 ? (<View style={styles.joinRequestsSection}>
            <View style={styles.joinRequestsHeader}>
              <View>
                <Text style={styles.joinRequestsTitle}>
                  Join Requests
                </Text>

                <Text style={styles.joinRequestsSubtitle}>
                  Readers waiting for access to this private club.
                </Text>
              </View>

              <View style={styles.joinRequestsBadge}>
                <Text style={styles.joinRequestsBadgeText}>
                  {managerJoinRequests.length}
                </Text>
              </View>
            </View>

            <View style={styles.joinRequestsCard}>
              {managerJoinRequests.map(renderManagerJoinRequest)}
            </View>
          </View>) : null}

        {isManager && managementVisible ? (<View style={styles.inviteSection}>
            {managerInvites.length >
                0 ? (<View style={styles.pendingInvitesBlock}>
                <View style={styles.pendingInvitesHeader}>
                  <Text style={styles.pendingInvitesTitle}>
                    Pending invitations
                  </Text>

                  <Text style={styles.pendingInvitesCount}>
                    {managerInvites.length}
                  </Text>
                </View>

                <View style={styles.pendingInvitesCard}>
                  {managerInvites.map(renderManagerInvite)}
                </View>
              </View>) : null}
          </View>) : null}

        {club.privacy ===
            'private' &&
            !isMember ? (<View style={styles.privatePreviewCard}>
            <Ionicons name="lock-closed-outline" size={24} color={colors.gold}/>

            <Text style={styles.privatePreviewTitle}>
              Members-only activity
            </Text>

            <Text style={styles.privatePreviewText}>
              {pendingInvite
                ? 'Accept the invitation to see members and posts inside this private club.'
                : pendingJoinRequest
                    ? 'Your access request is pending. Club members and posts stay private until a manager approves it.'
                    : 'Request access to join this private club. Members and posts stay hidden until you are approved.'}
            </Text>
          </View>) : (<>
        {membersVisible ? <View style={styles.membersSection} onLayout={event => {
                    membersSectionY.current = event.nativeEvent.layout.y;
                    if (pendingMemberScroll.current) {
                        const y = event.nativeEvent.layout.y;
                        pendingMemberScroll.current = false;
                        requestAnimationFrame(() => clubScrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }));
                    }
                }}>
        <View style={[styles.sectionHeader, styles.membersSectionHeader]}>
          <Text style={styles.sectionTitle}>
            Members
          </Text>

          <Text style={styles.sectionMeta}>
            {members.length}
          </Text>
        </View>

        <View style={styles.card}>
          {membersLoading && !ownerMember ? <ActivityIndicator color={colors.gold} style={{ padding: 16 }}/> : ownerMember ? <>
            <ScrollView accessibilityLabel="Club members" nestedScrollEnabled directionalLockEnabled scrollEnabled={members.length > 5} showsVerticalScrollIndicator={members.length > 5} bounces={false} keyboardShouldPersistTaps="handled" style={members.length > 5 ? styles.membersScroll : undefined}>
              {[ownerMember, ...otherMembers].map((member, index) => <View key={member.user_id}>
                {index ? <View style={styles.rowDivider}/> : null}
                {renderMember(member)}
              </View>)}
            </ScrollView>
            {members.length > 5 ? <Text style={styles.membersScrollHint}>Swipe to see all members</Text> : null}
          </> : <Text style={styles.emptyCardText}>No members to show yet.</Text>}
        </View>

        </View> : null}

        <View style={styles.clubToolsRow}>
        <View style={styles.clubTabBar} accessibilityRole="tablist">{(['posts', 'books', 'events'] as const).map(tab => <Pressable key={tab} accessibilityRole="tab" accessibilityLabel={tab === 'posts' ? 'Club Posts tab' : tab === 'events' ? 'Club Events tab' : 'Club Books tab'} accessibilityState={{ selected: clubTab === tab }} onPress={() => setClubTab(tab)} style={[styles.clubTab, clubTab === tab && styles.clubTabSelected]}><Text style={[styles.clubTabText, clubTab === tab && { color: colors.gold }]}>{tab === 'posts' ? 'Posts' : tab === 'events' ? 'Events' : 'Books'}</Text></Pressable>)}</View>
        <ClubTabActions clubId={club.id} clubName={club.name} onPost={() => void openClubComposer()} tab={clubTab} isMember={isMember} canManage={isManager} compact/>
        </View>
        {(clubTab === 'books' || (visitedTabs.clubId === club.id && visitedTabs.books)) ? (
          <View style={clubTab !== 'books' ? styles.hiddenClubTab : undefined}><ClubBooksBoard key={club.id} clubId={club.id} canManage={isManager} refreshVersion={booksRefreshVersion} showAddAction={false}/></View>
        ) : null}
        {(clubTab === 'events' || (visitedTabs.clubId === club.id && visitedTabs.events)) ? (
          <View style={clubTab !== 'events' ? styles.hiddenClubTab : undefined}>{eventsLoading ? <ActivityIndicator color={colors.gold} style={{ padding: 20 }}/> : <ClubEventsBoard key={club.id} clubId={club.id} upcoming={upcomingEvents} canManage={isManager} now={eventNow} showCreateAction={false}/>}</View>
        ) : null}
        <View style={clubTab !== 'posts' ? styles.hiddenClubTab : undefined}>
        <ClubPinnedPosts posts={visiblePinnedPosts} canManage={isManager} busy={pinBusy} onOpen={postId => router.push({ pathname: '/post/[id]', params: { id: postId } })} onManage={post => { Keyboard.dismiss(); setPinTarget(post); }}/>

        <View style={[styles.sectionHeader, styles.conversationHeader, membersVisible && !visiblePinnedPosts.length && styles.conversationAfterMembers]}>
          <Text style={styles.sectionTitle}>
            Club conversation
          </Text>

          <Text style={styles.sectionMeta}>
            {clubPosts.length}
          </Text>
        </View>

        {postsStatus === 'loading' ? <ActivityIndicator color={colors.gold} style={{ padding: 20 }}/>
        : postsStatus === 'error' ? <Pressable accessibilityRole="button" onPress={() => void refreshClub()} style={styles.activityPlaceholder}>
            <Text style={styles.activityText}>Couldn’t load club posts. Tap to retry.</Text>
          </Pressable>
        : clubPosts.length > 0 ? (<View style={styles.postList}>
            {clubPosts.map(renderClubPost)}
          </View>) : (<View style={styles.activityPlaceholder}>
            <Ionicons name="chatbubbles-outline" size={27} color={colors.gold}/>

            <Text style={styles.activityTitle}>
              A place for your next great discussion
            </Text>

            <Text style={styles.activityText}>
              {isMember
                        ? 'Start the conversation by making the first post in this club.'
                        : 'Club posts will appear here when members start the conversation.'}
            </Text>

            {isMember ? (<Pressable onPress={() => void openClubComposer()} style={({ pressed }) => [
                            styles.emptyPostButton,
                            pressed && styles.pressed
                        ]}>
                <Ionicons name="add" size={17} color={colors.background}/>

                <Text style={styles.emptyPostButtonText}>
                  Create First Post
                </Text>
              </Pressable>) : null}
          </View>)}
        </View>
          </>)}
      </ScrollView>

      <ClubPinActionsSheet visible={Boolean(pinTarget)} post={pinTarget} pinnedPosts={visiblePinnedPosts} busy={pinBusy} onPin={(postId, pinned, replacePostId) => void handleClubPin(postId, pinned, replacePostId)} onDismiss={() => setPinTarget(null)}/>

      <ClubOptionsSheet visible={clubMenuVisible} clubName={club.name} role={role} canViewMembers={canViewMembers} notificationsEnabled={memberExperience?.notifications_enabled} globalNotificationsEnabled={memberExperience?.global_notifications_enabled} notificationsBusy={experienceBusy} hasRules={Boolean(club.rules?.trim())} busy={membershipLoading} onAction={handleClubAction} onDismiss={() => setClubMenuVisible(false)}/>
      <ValidationWarningSheet visible={Boolean(experienceWarning)} title="Club preferences" message={experienceWarning} onDismiss={() => setExperienceWarning('')}/>

      <UiSheetModal visible={Boolean(memberActionTarget)} transparent animationType="none" onRequestClose={() => closeMemberActions()} motion={uiMemberAction}>
        <Pressable style={styles.memberActionBackdrop} onPress={() => closeMemberActions()}>
          <UiSheetBackdrop pointerEvents="none" style={[
            styles.memberActionBackdropVisual,
            {}
        ]} motion={uiMemberAction}/>

          <UiSheetSurface style={[
            styles.memberActionSheet,
            {
                paddingBottom: Math.max(18, insets.bottom +
                    12)
            }
        ]} motion={uiMemberAction}>
            <Pressable onPress={(event) => event.stopPropagation()}>
              <View style={styles.memberActionHandle}/>

              <Text style={styles.memberActionTitle}>
                Member options
              </Text>

              <Text style={styles.memberActionSubtitle} numberOfLines={1}>
                Manage ${memberActionTarget?.display_name
            ?.trim() ||
            memberActionTarget?.username
                ?.trim() ||
            'this reader'} in this club.
              </Text>

              <View style={styles.memberActionList}>
                <Pressable disabled={memberActionBusy} onPress={viewSelectedMember} style={({ pressed }) => [
            styles.memberActionButton,
            pressed &&
                styles.memberActionButtonPressed
        ]}>
                  <View style={styles.memberActionRowIcon}>
                    <Ionicons name="person-outline" size={18} color={colors.gold}/>
                  </View>

                  <Text style={styles.memberActionButtonText}>
                    View profile
                  </Text>
                </Pressable>

                {club.membership_role ===
            'owner' &&
            memberActionTarget?.role ===
                'member' ? (<Pressable disabled={memberActionBusy} onPress={promoteSelectedMember} style={({ pressed }) => [
                styles.memberActionButton,
                pressed &&
                    styles.memberActionButtonPressed
            ]}>
                    <View style={styles.memberActionRowIcon}>
                      <Ionicons name="shield-checkmark-outline" size={18} color={colors.gold}/>
                    </View>

                    <Text style={styles.memberActionButtonText}>
                      Make admin
                    </Text>
                  </Pressable>) : null}

                {club.membership_role ===
            'owner' &&
            memberActionTarget?.role ===
                'admin' ? (<Pressable disabled={memberActionBusy} onPress={demoteSelectedAdmin} style={({ pressed }) => [
                styles.memberActionButton,
                pressed &&
                    styles.memberActionButtonPressed
            ]}>
                    <View style={styles.memberActionRowIcon}>
                      <Ionicons name="shield-outline" size={18} color={colors.gold}/>
                    </View>

                    <Text style={styles.memberActionButtonText}>
                      Remove admin role
                    </Text>
                  </Pressable>) : null}

                <Pressable disabled={memberActionBusy} onPress={kickSelectedMember} style={({ pressed }) => [
            styles.memberActionButton,
            pressed &&
                styles.memberActionButtonPressed
        ]}>
                  <View style={styles.memberActionRowIcon}>
                    <Ionicons name="exit-outline" size={18} color={colors.gold}/>
                  </View>

                  <Text style={styles.memberActionButtonText}>
                    Remove from club
                  </Text>
                </Pressable>

                <Pressable disabled={memberActionBusy} onPress={blockSelectedMember} style={({ pressed }) => [
            styles.memberActionButton,
            pressed &&
                styles.memberActionButtonPressed
        ]}>
                  <View style={styles.memberActionRowIcon}>
                    <Ionicons name="ban-outline" size={18} color={colors.gold}/>
                  </View>

                  <Text style={styles.memberActionButtonText}>
                    Block reader
                  </Text>
                </Pressable>

                <Pressable disabled={memberActionBusy} onPress={reportSelectedMember} style={({ pressed }) => [
            styles.memberActionButton,
            pressed &&
                styles.memberActionButtonPressed
        ]}>
                  <View style={styles.memberActionRowIcon}>
                    <Ionicons name="flag-outline" size={18} color={colors.gold}/>
                  </View>

                  <Text style={styles.memberActionButtonText}>
                    Report reader
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </UiSheetSurface>
        </Pressable>
      </UiSheetModal>

      <LeaveClubConfirmSheet visible={leaveConfirmVisible} clubName={club?.name ??
            'this club'} busy={membershipLoading} onConfirm={handleLeave} onDismiss={() => setLeaveConfirmVisible(false)}/>

      <BlockReaderConfirmSheet visible={Boolean(blockConfirmTarget)} readerName={blockConfirmTarget?.display_name
            ?.trim() ||
            blockConfirmTarget?.username
                ?.trim() ||
            'this reader'} message="They will be removed from this club, their posts and comments will be hidden from you, and any follow relationship between you will be removed. You can unblock them later in Settings." busy={memberActionBusy} onConfirm={confirmBlockMember} onDismiss={() => setBlockConfirmTarget(null)}/>

      <UiSheetModal visible={Boolean(promoteConfirmTarget)} transparent animationType="none" onRequestClose={() => closePromoteConfirm()} motion={uiPromoteConfirm}>
        <Pressable style={styles.memberActionBackdrop} onPress={() => closePromoteConfirm()}>
          <UiSheetBackdrop pointerEvents="none" style={[
            styles.memberActionBackdropVisual,
            {}
        ]} motion={uiPromoteConfirm}/>

          <UiSheetSurface style={[
            styles.promoteConfirmSheet,
            {
                paddingBottom: Math.max(18, insets.bottom +
                    12)
            }
        ]} motion={uiPromoteConfirm}>
            <Pressable onPress={(event) => event.stopPropagation()}>
              <View style={styles.memberActionHandle}/>

              <View style={styles.promoteConfirmIcon}>
                <Ionicons name="shield-checkmark-outline" size={24} color={colors.gold}/>
              </View>

              <Text style={styles.promoteConfirmTitle}>
                Make this reader an admin?
              </Text>

              <Text style={styles.promoteConfirmText}>
                {promoteConfirmTarget?.display_name
            ?.trim() ||
            promoteConfirmTarget?.username
                ?.trim() ||
            'This reader'} will be able to invite members, review join requests, and manage regular members.
              </Text>

              <View style={styles.promoteConfirmActions}>
                <Pressable disabled={memberActionBusy} onPress={() => closePromoteConfirm()} style={({ pressed }) => [
            styles.promoteConfirmCancelButton,
            pressed &&
                styles.memberActionButtonPressed
        ]}>
                  <Text style={styles.promoteConfirmCancelText}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable disabled={memberActionBusy} onPress={() => void confirmPromoteMember()} style={({ pressed }) => [
            styles.promoteConfirmPrimaryButton,
            pressed &&
                styles.pressed
        ]}>
                  {memberActionBusy ? (<ActivityIndicator size="small" color={colors.background}/>) : (<Text style={styles.promoteConfirmPrimaryText}>
                      Make Admin
                    </Text>)}
                </Pressable>
              </View>
            </Pressable>
          </UiSheetSurface>
        </Pressable>
      </UiSheetModal>

      <UiSheetModal visible={Boolean(demoteConfirmTarget)} transparent animationType="none" onRequestClose={() => closeDemoteConfirm()} motion={uiDemoteConfirm}>
        <Pressable style={styles.memberActionBackdrop} onPress={() => closeDemoteConfirm()}>
          <UiSheetBackdrop pointerEvents="none" style={[
            styles.memberActionBackdropVisual,
            {}
        ]} motion={uiDemoteConfirm}/>

          <UiSheetSurface style={[
            styles.promoteConfirmSheet,
            {
                paddingBottom: Math.max(18, insets.bottom +
                    12)
            }
        ]} motion={uiDemoteConfirm}>
            <Pressable onPress={(event) => event.stopPropagation()}>
              <View style={styles.memberActionHandle}/>

              <View style={styles.promoteConfirmIcon}>
                <Ionicons name="shield-outline" size={24} color={colors.gold}/>
              </View>

              <Text style={styles.promoteConfirmTitle}>
                Remove admin access?
              </Text>

              <Text style={styles.promoteConfirmText}>
                {demoteConfirmTarget?.display_name
            ?.trim() ||
            demoteConfirmTarget?.username
                ?.trim() ||
            'This reader'} will lose admin permissions, but will remain in the club as a regular member.
              </Text>

              <View style={styles.promoteConfirmActions}>
                <Pressable disabled={memberActionBusy} onPress={() => closeDemoteConfirm()} style={({ pressed }) => [
            styles.promoteConfirmCancelButton,
            pressed &&
                styles.memberActionButtonPressed
        ]}>
                  <Text style={styles.promoteConfirmCancelText}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable disabled={memberActionBusy} onPress={() => void confirmDemoteAdmin()} style={({ pressed }) => [
            styles.demoteConfirmPrimaryButton,
            pressed &&
                styles.pressed
        ]}>
                  {memberActionBusy ? (<ActivityIndicator size="small" color={colors.text}/>) : (<Text style={styles.demoteConfirmPrimaryText}>
                      Remove Admin
                    </Text>)}
                </Pressable>
              </View>
            </Pressable>
          </UiSheetSurface>
        </Pressable>
      </UiSheetModal>

      <UiSheetModal visible={Boolean(removeMemberConfirmTarget)} transparent animationType="none" onRequestClose={() => closeRemoveMemberConfirm()} motion={uiRemoveMemberConfirm}>
        <Pressable style={styles.memberActionBackdrop} onPress={() => closeRemoveMemberConfirm()}>
          <UiSheetBackdrop pointerEvents="none" style={[
            styles.memberActionBackdropVisual,
            {}
        ]} motion={uiRemoveMemberConfirm}/>

          <UiSheetSurface style={[
            styles.promoteConfirmSheet,
            {
                paddingBottom: Math.max(18, insets.bottom +
                    12)
            }
        ]} motion={uiRemoveMemberConfirm}>
            <Pressable onPress={(event) => event.stopPropagation()}>
              <View style={styles.memberActionHandle}/>

              <View style={styles.promoteConfirmIcon}>
                <Ionicons name="exit-outline" size={24} color={colors.gold}/>
              </View>

              <Text style={styles.promoteConfirmTitle}>
                Remove from this club?
              </Text>

              <Text style={styles.promoteConfirmText}>
                {removeMemberConfirmTarget?.display_name
            ?.trim() ||
            removeMemberConfirmTarget?.username
                ?.trim() ||
            'This reader'} will lose access to this club. They can join or request access again later.
              </Text>

              <View style={styles.promoteConfirmActions}>
                <Pressable disabled={memberActionBusy} onPress={() => closeRemoveMemberConfirm()} style={({ pressed }) => [
            styles.promoteConfirmCancelButton,
            pressed &&
                styles.memberActionButtonPressed
        ]}>
                  <Text style={styles.promoteConfirmCancelText}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable disabled={memberActionBusy} onPress={() => void confirmRemoveMember()} style={({ pressed }) => [
            styles.demoteConfirmPrimaryButton,
            pressed &&
                styles.pressed
        ]}>
                  {memberActionBusy ? (<ActivityIndicator size="small" color={colors.text}/>) : (<Text style={styles.demoteConfirmPrimaryText}>
                      Remove
                    </Text>)}
                </Pressable>
              </View>
            </Pressable>
          </UiSheetSurface>
        </Pressable>
      </UiSheetModal>

      <UiSheetModal onDismiss={reportConfirmation.afterDismiss} visible={Boolean(memberReportTarget)} transparent animationType="none" onRequestClose={() => closeMemberReport()} motion={uiMemberReport}>
        <Pressable style={styles.memberActionBackdrop} onPress={() => closeMemberReport()}>
          <UiSheetBackdrop pointerEvents="none" style={[
            styles.memberActionBackdropVisual,
            {}
        ]} motion={uiMemberReport}/>

          <UiSheetSurface style={[
            styles.memberActionSheet,
            {
                paddingBottom: Math.max(18, insets.bottom +
                    12)
            }
        ]} motion={uiMemberReport}>
            <Pressable onPress={(event) => event.stopPropagation()}>
              <View style={styles.memberActionHandle}/>

              <Text style={styles.memberActionTitle}>
                Report reader
              </Text>

              <Text style={styles.memberActionSubtitle}>
                Why are you reporting this reader?
              </Text>

              <View style={styles.memberActionList}>
                {MEMBER_REPORT_REASONS.map((reason) => (<Pressable key={reason.value} disabled={memberReportSubmitting} onPress={() => void handleMemberReport(reason.value)} style={({ pressed }) => [
                styles.memberActionButton,
                pressed &&
                    styles.memberActionButtonPressed
            ]}>
                      <View style={styles.memberActionRowIcon}>
                        <Ionicons name={reason.icon} size={18} color={colors.gold}/>
                      </View>

                      <Text style={styles.memberActionButtonText}>
                        {reason.label}
                      </Text>

                      <Ionicons name="chevron-forward" size={17} color={colors.mutedText} style={{
                marginLeft: 'auto',
            }}/>
                    </Pressable>))}
              </View>

              {memberReportSubmitting ? (<View style={styles.memberReportSubmitting}>
                  <ActivityIndicator size="small" color={colors.gold}/>
                </View>) : null}
            </Pressable>
          </UiSheetSurface>
        </Pressable>
      </UiSheetModal>

      <FullScreenImageViewer visible={clubImageOpen} uri={club.cover_url} onClose={() => setClubImageOpen(false)} shape="rounded-square"/>
      <ValidationWarningSheet visible={reportConfirmation.visible} title="Report submitted" message="Thanks for letting us know. Your report has been submitted for review." icon="checkmark-circle-outline" dismissLabel="Got it" onDismiss={reportConfirmation.dismiss}/>
    {sheet}
    </SafeAreaView>);
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
        headerActions: { width: 80, flexDirection: 'row', alignItems: 'center' },
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
            maxWidth: '100%',
            alignSelf: 'center',
            paddingHorizontal: 20,
            paddingTop: 14,
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
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 6,
            marginTop: 12,
        },
        genreBadge: {
            backgroundColor: colors.elevated,
            borderRadius: 10,
            paddingHorizontal: 9,
            paddingVertical: 4,
        },
        genreBadgeText: {
            color: colors.gold,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10,
        },
        editGenresLink: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            marginTop: 9,
            paddingVertical: 3,
            paddingHorizontal: 5,
        },
        editGenresText: {
            color: colors.gold,
            fontFamily: 'Inter_600SemiBold',
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        primaryButtonTextDisabled: {
            color: colors.mutedText,
        },
        requestAccessButton: {
            minHeight: 46,
            borderRadius: 13,
            backgroundColor: colors.gold,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            marginTop: 14,
        },
        requestAccessButtonPending: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        requestAccessButtonText: {
            color: colors.background,
            fontFamily: 'Inter_700Bold',
            fontSize: 13,
        },
        requestAccessButtonTextPending: {
            color: colors.mutedText,
        },
        invitationCard: {
            marginTop: 22,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.gold,
            borderRadius: 17,
            padding: 15,
        },
        invitationIcon: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 11,
        },
        invitationCopy: {
            gap: 4,
        },
        invitationTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 19,
        },
        invitationText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            lineHeight: 19,
        },
        invitationActions: {
            flexDirection: 'row',
            gap: 9,
            marginTop: 14,
        },
        invitationDeclineButton: {
            flex: 1,
            minHeight: 42,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
        },
        invitationDeclineText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
        },
        invitationAcceptButton: {
            flex: 1,
            minHeight: 42,
            borderRadius: 12,
            backgroundColor: colors.gold,
            alignItems: 'center',
            justifyContent: 'center',
        },
        invitationAcceptText: {
            color: colors.background,
            fontFamily: 'Inter_700Bold',
            fontSize: 13,
        },
        inviteSection: {
            marginTop: 12,
        },
        clubOptionsDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
        clubManagementHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
        inviteScreenBody: { flex: 1, paddingHorizontal: 20, paddingTop: 14 },
        inviteResultsLabel: { color: colors.mutedText, fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 18 },
        inviteSearchWrap: {
            minHeight: 44,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 11,
        },
        inviteSearchField: { flex: 1, minWidth: 0, minHeight: 42, justifyContent: 'center' },
        inviteSearchPlaceholder: { position: 'absolute', top: 0, bottom: 0, left: 34, right: 34, justifyContent: 'center' },
        inviteSearchPlaceholderText: {
            textAlign: 'center',
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            includeFontPadding: false,
        },
        inviteSearchInput: {
            flex: 1,
            color: colors.text,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            minHeight: 42,
            paddingVertical: 0,
            textAlignVertical: 'center',
            includeFontPadding: false,
        },
        inviteSearchHint: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            lineHeight: 16,
            textAlign: 'center',
            paddingVertical: 14,
            paddingHorizontal: 8,
        },
        inviteResultsContent: {
            gap: 6,
            paddingBottom: 2,
        },
        inviteReaderRow: {
            minHeight: 58,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 9,
            paddingVertical: 6,
        },
        inviteReaderIdentity: {
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
        },
        inviteReaderAvatar: {
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: colors.elevated,
            marginRight: 9,
        },
        inviteReaderAvatarFallback: {
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 9,
        },
        inviteReaderAvatarText: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 15,
        },
        inviteReaderCopy: {
            flex: 1,
            minWidth: 0,
        },
        inviteReaderName: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12.5,
        },
        inviteReaderUsername: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10.5,
            marginTop: 2,
        },
        inviteReaderButton: {
            minWidth: 70,
            minHeight: 34,
            paddingHorizontal: 11,
            borderRadius: 17,
            backgroundColor: colors.gold,
            alignItems: 'center',
            justifyContent: 'center',
        },
        inviteReaderButtonDisabled: {
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
        },
        inviteReaderButtonText: {
            color: colors.background,
            fontFamily: 'Inter_700Bold',
            fontSize: 11,
        },
        inviteReaderButtonTextDisabled: {
            color: colors.mutedText,
        },
        joinRequestsSection: {
            marginTop: 14,
        },
        joinRequestsHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 8,
            paddingHorizontal: 2,
        },
        joinRequestsTitle: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 14,
        },
        joinRequestsSubtitle: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10.5,
            lineHeight: 15,
            marginTop: 2,
        },
        joinRequestsBadge: {
            minWidth: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        joinRequestsBadgeText: {
            color: colors.gold,
            fontFamily: 'Inter_700Bold',
            fontSize: 11,
        },
        joinRequestsCard: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            paddingHorizontal: 11,
        },
        joinRequestRow: {
            minHeight: 66,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 8,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        joinRequestIdentity: {
            flex: 1,
            minWidth: 0,
            flexDirection: 'row',
            alignItems: 'center',
        },
        joinRequestAvatar: {
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: colors.elevated,
            marginRight: 9,
        },
        joinRequestAvatarFallback: {
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 9,
        },
        joinRequestAvatarText: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 15,
        },
        joinRequestCopy: {
            flex: 1,
            minWidth: 0,
        },
        joinRequestName: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12.5,
        },
        joinRequestMeta: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10.5,
            marginTop: 2,
        },
        joinRequestActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
        },
        joinRequestDeclineButton: {
            minHeight: 34,
            paddingHorizontal: 12,
            borderRadius: 17,
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        joinRequestDeclineText: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11,
        },
        joinRequestApproveButton: {
            minHeight: 34,
            paddingHorizontal: 12,
            borderRadius: 17,
            backgroundColor: colors.gold,
            alignItems: 'center',
            justifyContent: 'center',
        },
        joinRequestApproveText: {
            color: colors.background,
            fontFamily: 'Inter_700Bold',
            fontSize: 11,
        },
        pendingInvitesBlock: {
            marginTop: 12,
        },
        pendingInvitesHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 2,
            marginBottom: 7,
        },
        pendingInvitesTitle: {
            color: colors.secondaryText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12,
        },
        pendingInvitesCount: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11,
        },
        pendingInvitesCard: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            paddingHorizontal: 11,
        },
        pendingInviteRow: {
            minHeight: 58,
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
        },
        pendingInviteAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.elevated,
            marginRight: 9,
        },
        pendingInviteAvatarFallback: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 9,
        },
        pendingInviteAvatarText: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 14,
        },
        pendingInviteCopy: {
            flex: 1,
            minWidth: 0,
        },
        pendingInviteName: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12.5,
        },
        pendingInviteMeta: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10.5,
            marginTop: 2,
        },
        cancelInviteButton: {
            minHeight: 32,
            minWidth: 58,
            paddingHorizontal: 9,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.elevated,
        },
        cancelInviteText: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10.5,
        },
        privatePreviewCard: {
            marginTop: 26,
            minHeight: 150,
            borderRadius: 17,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
        },
        privatePreviewTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 18,
            marginTop: 10,
            textAlign: 'center',
        },
        privatePreviewText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            lineHeight: 18,
            textAlign: 'center',
            marginTop: 5,
            maxWidth: 360,
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
        hiddenClubTab: { display: 'none' },
        clubToolsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, marginTop: 4 },
        clubTabBar: { flex: 1, flexDirection: 'row', gap: 4, backgroundColor: colors.surface, borderRadius: 13, padding: 4, borderWidth: 1, borderColor: colors.border },
        clubTab: { flex: 1, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', minHeight: 40, borderRadius: 10 },
        clubTabSelected: { backgroundColor: colors.elevated },
        clubTabText: { color: colors.mutedText, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
        membersSection: { marginBottom: 22 },
        membersSectionHeader: { marginTop: 0 },
        membersScroll: { maxHeight: 344 },
        membersScrollHint: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center', paddingVertical: 9 },
        conversationHeader: { marginTop: 12 },
        conversationAfterMembers: { marginTop: 0 },
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
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            marginTop: 15,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        postVotePill: {
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 36,
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 18,
            paddingHorizontal: 4,
        },
        postCommentPill: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            minHeight: 36,
            paddingHorizontal: 12,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.elevated,
        },
        postVoteButton: {
            width: 30,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
        },
        postVoteButtonActive: {
            backgroundColor: colors.surface,
        },
        postVoteButtonDisabled: {
            opacity: 0.55,
        },
        postVoteScore: {
            minWidth: 20,
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12,
            textAlign: 'center',
        },
        postVoteScoreActive: {
            color: colors.gold,
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
            backgroundColor: colors.elevated,
        },
        memberActionAccent: {
            position: 'absolute',
            left: 0,
            top: 7,
            bottom: 7,
            width: 3,
            borderRadius: 2,
            backgroundColor: colors.gold,
        },
        membersExpandRow: {
            minHeight: 46,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingHorizontal: 13,
        },
        membersExpandText: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11.5,
        },
        promoteConfirmSheet: {
            width: '100%',
            alignSelf: 'center',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 18,
            paddingTop: 10,
            overflow: 'hidden',
        },
        promoteConfirmIcon: {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            marginTop: 6,
            marginBottom: 14,
        },
        promoteConfirmTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 21,
            textAlign: 'center',
        },
        promoteConfirmText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12.5,
            lineHeight: 19,
            textAlign: 'center',
            marginTop: 7,
        },
        promoteConfirmActions: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 20,
        },
        promoteConfirmCancelButton: {
            flex: 1,
            minHeight: 46,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            alignItems: 'center',
            justifyContent: 'center',
        },
        promoteConfirmCancelText: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12.5,
        },
        promoteConfirmPrimaryButton: {
            flex: 1,
            minHeight: 46,
            borderRadius: 14,
            backgroundColor: colors.gold,
            alignItems: 'center',
            justifyContent: 'center',
        },
        promoteConfirmPrimaryText: {
            color: colors.background,
            fontFamily: 'Inter_700Bold',
            fontSize: 12.5,
        },
        demoteConfirmPrimaryButton: {
            flex: 1,
            minHeight: 46,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
        },
        demoteConfirmPrimaryText: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 12.5,
        },
        memberActionBackdrop: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        memberActionBackdropVisual: {
            ...StyleSheet.absoluteFill,
            backgroundColor: 'rgba(0,0,0,0.48)',
        },
        memberActionSheet: {
            width: '100%',
            alignSelf: 'center',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 10,
            paddingHorizontal: 16,
            overflow: 'hidden',
        },
        memberActionHandle: {
            width: 42,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: 'center',
            marginBottom: 13,
        },
        memberActionTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 20,
        },
        memberActionSubtitle: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            lineHeight: 17,
            marginTop: 3,
            marginBottom: 12,
        },
        memberActionList: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: colors.background,
        },
        memberActionButton: {
            minHeight: 58,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 11,
            paddingHorizontal: 13,
            paddingVertical: 10,
            backgroundColor: colors.background,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        memberActionButtonPressed: {
            backgroundColor: colors.elevated,
        },
        memberActionRowIcon: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
        },
        memberActionButtonText: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
        },
        memberReportSubmitting: {
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
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
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'flex-start',
        },
        postPinButton: { position: 'absolute', right: 44, top: 9, width: 34, height: 34, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
        postHeaderShare: {
            position: 'absolute',
            top: 9,
            right: 10,
            width: 34,
            height: 34,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
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
        questionPostTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_600SemiBold',
            fontSize: 18,
            lineHeight: 25,
            marginTop: 12,
        },
        questionPostContext: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 13.5,
            lineHeight: 20,
            marginTop: 7,
        },
        plainPostBody: { marginTop: 0 },
        postBody: {
            color: colors.text,
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            lineHeight: 21,
            marginTop: 12,
        },
        postCompactBookLink: {
            minHeight: 42,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 7,
            paddingHorizontal: 2,
            paddingVertical: 7,
        },
        postCompactBookCopy: {
            flex: 1,
            minWidth: 0,
        },
        postCompactBookTitle: {
            color: colors.gold,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12.5,
        },
        postCompactBookMeta: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10.5,
            fontStyle: 'italic',
            marginTop: 2,
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
        postBookAuthor: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10.5,
            marginTop: 4,
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
