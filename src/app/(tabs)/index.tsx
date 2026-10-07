import { getCommentSheetBounds } from '../../lib/comment-sheet-snap';
import { useReportConfirmation } from '../../lib/use-report-confirmation';
import ValidationWarningSheet from '../../components/ValidationWarningSheet';
import { moderationMediaUrl } from '../../lib/moderation-media-url';
import { rememberAccountRestriction, restrictedAccountRoute } from '../../lib/account-restriction-notice';
import { useUiSheetMotion, UiSheetModal, UiSheetSurface, UiSheetBackdrop } from '../../components/UiSheet';
import Reanimated from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { useCommentSheetMotion } from '../../lib/use-comment-sheet-motion';
import { openCommentConversation, hideCommentSheetForNavigation } from '../../lib/open-comment-conversation';
import CommentsWindowOverlay from '../../components/CommentsWindowOverlay';
import { useCommentSheetContinuation } from '../../lib/use-comment-sheet-continuation';
import CommentBranchGuide from '../../components/CommentBranchGuide';
import { isTransientReadError } from '../../lib/session-read-cache';
import ReplyComposerContext from '../../components/ReplyComposerContext';
import { getAccountEntryRoute } from '../../lib/account-entry';
import { isAccountUnavailableError, isAccountRestrictedError } from '../../lib/account-session-errors';
import { signOutCurrentDevice } from '../../lib/sign-out';
import FeedPostCard from '../../components/FeedPostCard';
import {useTutorial,useTutorialTarget} from '../../context/tutorial-context';
import { COMMENT_REPLY_BATCH_SIZE, getCommentBranchIds, buildCommentThreads, countThreadReplies, getCommentDepthLimit } from '../../lib/comment-conversations';
import ClubEventPostAttachment from '../../components/ClubEventPostAttachment';
import ClubDiscussionPostAttachment from '../../components/ClubDiscussionPostAttachment';
import BookCoverImage from '../../components/BookCoverImage';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, Keyboard, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { KeyboardStickyView, useKeyboardAnimation } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BookStackPostAttachment from '../../components/BookStackPostAttachment';
import CanonicalBookRating from '../../components/CanonicalBookRating';
import DeletePostConfirmSheet from '../../components/DeletePostConfirmSheet';
import FeedPostImage from '../../components/FeedPostImage';
import ReadingRecapPostAttachment from '../../components/ReadingRecapPostAttachment';
import PostTypeIdentifier from '../../components/PostTypeIdentifier';
import { CLUB_GENRES, ClubGenreKey, getClubGenreLabel } from '../../constants/club-genres';
import { NovoriColors } from '../../constants/novori-theme';
import { useNovoriTheme } from '../../context/theme-context';
import { ClubWithMembership, getDiscoverClubs, getMyClubs, searchClubs } from '../../lib/clubs';
import { CommentVoteValue, createPostComment, deletePostComment, getPostComments, PostComment, toggleCommentVote, updatePostComment } from '../../lib/comments';
import { containsExplicitLanguage, getExplicitLanguagePreference, isExplicitContentRevealed, revealExplicitContentOnce, setExplicitLanguagePreference } from '../../lib/content-filter';
import { deletePost, FeedPost, getHomeFeed, getPostMutationVersion, PostVoteValue, togglePostVote } from '../../lib/feed';
import { getNotificationAttentionCount } from '../../lib/notifications';
import { ReportReason, submitCommentReport, submitPostReport } from '../../lib/reports';
import { blockReader } from '../../lib/social';
import { supabase } from '../../lib/supabase';
import { sharePostLink } from '../../lib/share-links';
import { getPostEditRoute } from '../../lib/post-edit-route';
type HomeSection = 'feed' | 'clubs';
type ComposerProfile = {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
};
const POST_REPORT_REASONS: Array<{
    value: ReportReason;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
}> = [
    {
        value: 'explicit_content',
        label: 'Graphic or inappropriate content',
        icon: 'eye-off-outline',
    },
    {
        value: 'hate',
        label: 'Violence, hate, or discrimination',
        icon: 'warning-outline',
    },
    {
        value: 'harassment',
        label: 'Bullying or unwanted contact',
        icon: 'person-remove-outline',
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
        value: 'other',
        label: 'Other',
        icon: 'ellipsis-horizontal-circle-outline',
    }
];
const HOME_FOCUS_REFRESH_MS = 60 * 1000;
export default function HomeScreen() {
    const { colors, } = useNovoriTheme();
    const styles = createStyles(colors);
    const router = useRouter();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const homeScrollRef = useRef<ScrollView | null>(null);
    const homeScrollOffsetRef = useRef(0);
    const homeFocusedRef = useRef(false);
    const [showStickyHomeHeader, setShowStickyHomeHeader,] = useState(false);
    const { height: keyboardHeight, } = useKeyboardAnimation();
    const emptyStateKeyboardTranslateY = Animated.multiply(keyboardHeight, 0.5);
    const { height: windowHeight, width: windowWidth, } = useWindowDimensions();
    const {full: commentsFullHeight, partial: commentsPartialHeight} = getCommentSheetBounds(windowHeight, insets.top);
    const commentsEntranceStartHeight = Math.max(320, Math.round(windowHeight * 0.50));
    const [activeSection, setActiveSection] = useState<HomeSection>('feed');
    const tutorial=useTutorial(),feedTarget=useTutorialTarget('home-feed',10),clubsTarget=useTutorialTarget('home-clubs',10);
    useEffect(()=>{
        if(tutorial?.active&&tutorial.step.path==='/'){
            setActiveSection(tutorial.step.anchor==='home-clubs'?'clubs':'feed');
            homeScrollRef.current?.scrollTo({y:0,animated:false});
        }
    },[tutorial?.active,tutorial?.step.anchor]);
    const [attentionCount, setAttentionCount,] = useState(0);
    const [currentUserId, setCurrentUserId,] = useState<string | null>(null);
    const [reportTargetPost, setReportTargetPost,] = useState<FeedPost | null>(null);
    const [reportSubmitting, setReportSubmitting,] = useState(false);
    // Keep the sheet fully offscreen until the native modal is presented.
    const reportEntranceOffset = windowHeight + 80;
    const reportSheetAnimating = useRef(false);
    const reportSheetHeight = useRef(0);
    const reportModalShown = useRef(false);
    const reportEntranceStarted = useRef(false);
    const reportSheetClosing = useRef(false);
    const reportSubmitted = useRef(false);
    const [composerProfile, setComposerProfile,] = useState<ComposerProfile | null>(null);
    const [myClubs, setMyClubs,] = useState<ClubWithMembership[]>([]);
    const [discoverClubs, setDiscoverClubs,] = useState<ClubWithMembership[]>([]);
    const [clubsLoading, setClubsLoading,] = useState(true);
    const [feedPosts, setFeedPosts,] = useState<FeedPost[]>([]);
    const [feedLoading, setFeedLoading,] = useState(true);
    const [feedError, setFeedError,] = useState('');
    const [refreshing, setRefreshing,] = useState(false);
    const [allowExplicitLanguage, setAllowExplicitLanguage,] = useState(false);
    const [revealedExplicitPosts, setRevealedExplicitPosts,] = useState<Record<string, boolean>>({});
    const [revealedExplicitComments, setRevealedExplicitComments,] = useState<Record<string, boolean>>({});
    const [votingPostId, setVotingPostId,] = useState<string | null>(null);
    const [deletingPostId, setDeletingPostId,] = useState<string | null>(null);
    const [deletePostTarget, setDeletePostTarget,] = useState<FeedPost | null>(null);
    const [ownPostOptionsTarget, setOwnPostOptionsTarget,] = useState<FeedPost | null>(null);
    const [commentsPost, setCommentsPost,] = useState<FeedPost | null>(null);
    const [commentsModalVisible, setCommentsModalVisible,] = useState(false);
    const [sheetComments, setSheetComments,] = useState<PostComment[]>([]);
    const [commentsLoading, setCommentsLoading,] = useState(false);
    const [commentsInitialLoadReady, setCommentsInitialLoadReady,] = useState(false);
    const [commentsSheetEntranceReady, setCommentsSheetEntranceReady,] = useState(false);
    const [commentsKeyboardVisible, setCommentsKeyboardVisible,] = useState(false);
    const [commentBody, setCommentBody,] = useState('');
    const [composerResetting, setComposerResetting,] = useState(false);
    const [replyResetting, setReplyResetting,] = useState(false);
    const [replyTarget, setReplyTarget,] = useState<PostComment | null>(null);
    const [submittingComment, setSubmittingComment,] = useState(false);
    const [deletingCommentId, setDeletingCommentId,] = useState<string | null>(null);
    const [commentReportTarget, setCommentReportTarget,] = useState<PostComment | null>(null);
    const [commentActionTarget, setCommentActionTarget,] = useState<PostComment | null>(null);
    const [holdingCommentId, setHoldingCommentId,] = useState<string | null>(null);
    const commentSelectionAccentOpacity = useRef(new Animated.Value(0)).current;
    const commentActionSheetHeight = useRef(0);
    const commentActionEntranceStarted = useRef(false);
    const commentActionClosing = useRef(false);
    const pendingCommentActionHandoff = useRef<(() => void) | null>(null);
    const [editingComment, setEditingComment,] = useState<PostComment | null>(null);
    const [blockingReaderId, setBlockingReaderId,] = useState<string | null>(null);
    const [commentReportSubmitting, setCommentReportSubmitting,] = useState(false);
    const commentReportSheetHeight = useRef(0);
    const commentReportSheetAnimating = useRef(false);
    const commentReportSheetClosing = useRef(false);
    const commentReportEntranceStarted = useRef(false);
    const [expandedReplyThreads, setExpandedReplyThreads,] = useState<Record<string, number>>({});
    const [commentSort, setCommentSort,] = useState<'top' | 'newest'>('top');
    const [votingCommentIds, setVotingCommentIds,] = useState<Record<string, boolean>>({});
    const commentInputRef = useRef<TextInput>(null);
    const commentsEmptyOpacity = useRef(new Animated.Value(1)).current;
    const commentsContentOpacity = useRef(new Animated.Value(0)).current;
    const commentsResultOpacity = useRef(new Animated.Value(0)).current;
    const commentsSheetCurrentHeight = useRef(0);
    const commentsSheetSnap = useRef<'partial' | 'full'>('partial');
    const commentsSheetAnimating = useRef(false);
    const commentsSheetClosing = useRef(false);
    const preserveHomeStateOnNextBlur = useRef(false);
    const hasLoadedHomeData = useRef(false);
    const lastHomeDataLoadAt = useRef(0);
    const lastSeenPostMutationRef = useRef(getPostMutationVersion());
    const [clubSearch, setClubSearch,] = useState('');
    const [clubSearchResults, setClubSearchResults,] = useState<ClubWithMembership[]>([]);
    const [clubSearchLoading, setClubSearchLoading,] = useState(false);
    const [clubSearchError, setClubSearchError,] = useState('');
    const [activeClubGenre, setActiveClubGenre,] = useState<ClubGenreKey | 'all'>('all');
    const loadComposerProfile = useCallback(async () => {
        const { data: { user, }, error: userError, } = await supabase.auth.getUser();
        if (userError ||
            !user) {
            return;
        }
        setCurrentUserId(user.id);
        const { data, error, } = await supabase
            .from('profiles')
            .select('display_name, username, avatar_url')
            .eq('id', user.id)
            .single();
        if (error) {
            console.error('Could not load comment composer profile:', error.message);
            return;
        }
        setComposerProfile(data);
    }, []);
    const loadHomeData = useCallback(async (showClubLoader = false) => {
        if (showClubLoader) {
            setClubsLoading(true);
            setFeedLoading(true);
        }
        // Choose an account route before requesting normal activity data.
        const accountRoute = await getAccountEntryRoute().catch(() => null);
        if (accountRoute) {
            setFeedLoading(false);
            setClubsLoading(false);
            router.replace(accountRoute);
            return;
        }
        const results = await Promise.allSettled([
            getNotificationAttentionCount(),
            getMyClubs(),
            getDiscoverClubs(),
            getHomeFeed()
        ]);
        const [attentionResult, myClubsResult, discoverResult, feedResult,] = results;
        if (results.some(result => result.status === 'rejected' && isAccountUnavailableError(result.reason))) {
            const restricted = results.some(result => result.status === 'rejected' && isAccountRestrictedError(result.reason));
            if (restricted) rememberAccountRestriction();
            const accountRoute = restricted ? restrictedAccountRoute : await getAccountEntryRoute().catch(() => null);
            setFeedLoading(false);
            setClubsLoading(false);
            if (accountRoute) {
                if (restricted) await signOutCurrentDevice().catch(() => {});
                router.replace(accountRoute);
                return;
            }
            await signOutCurrentDevice().catch(() => { });
            router.replace('/auth');
            return;
        }
        if (attentionResult.status ===
            'fulfilled') {
            setAttentionCount(attentionResult.value);
        }
        else {
            console.error('Could not load notification attention count:', attentionResult.reason);
        }
        if (myClubsResult.status ===
            'fulfilled') {
            setMyClubs(myClubsResult.value);
        }
        else {
            console.error('Could not load your clubs:', myClubsResult.reason);
        }
        if (discoverResult.status ===
            'fulfilled') {
            setDiscoverClubs(discoverResult.value);
        }
        else {
            console.error('Could not load discover clubs:', discoverResult.reason);
        }
        if (feedResult.status ===
            'fulfilled') {
            setFeedPosts(feedResult.value);
            setFeedError('');
        }
        else {
            console.error('Could not load Home feed:', feedResult.reason);
            setFeedError('Could not load your feed.');
        }
        if (showClubLoader) {
            setClubsLoading(false);
            setFeedLoading(false);
        }
        hasLoadedHomeData.current =
            true;
        lastHomeDataLoadAt.current =
            Date.now();
        lastSeenPostMutationRef.current =
            getPostMutationVersion();
    }, []);
    useEffect(() => {
        if (commentActionTarget ||
            !pendingCommentActionHandoff.current) {
            return;
        }
        const action = pendingCommentActionHandoff.current;
        pendingCommentActionHandoff.current =
            null;
        // Effects run after React has committed the action-sheet unmount.
        // The action can now safely update/focus the composer without the
        // keyboard ever re-laying out a still-mounted action sheet.
        action();
    }, [
        commentActionTarget
    ]);
    useEffect(() => {
        if (Platform.OS !==
            'ios') {
            return;
        }
        const changeFrame = Keyboard.addListener('keyboardWillChangeFrame', (event) => {
            const overlap = Math.max(0, windowHeight -
                event.endCoordinates
                    .screenY);
            setCommentsKeyboardVisible(overlap >
                0);
            if (overlap ===
                0) {
                setComposerResetting(false);
                setReplyResetting(false);
            }
        });
        const didHide = Keyboard.addListener('keyboardDidHide', () => {
            setCommentsKeyboardVisible(false);
            setComposerResetting(false);
            setReplyResetting(false);
        });
        return () => {
            changeFrame.remove();
            didHide.remove();
        };
    }, [
        windowHeight
    ]);
    useEffect(() => {
        if (!commentsModalVisible ||
            !commentsInitialLoadReady) {
            return;
        }
        commentsResultOpacity.stopAnimation();
        commentsResultOpacity.setValue(1);
    }, [
        commentsInitialLoadReady,
        commentsModalVisible,
        commentsResultOpacity
    ]);
    useEffect(() => {
        const normalized = clubSearch.trim();
        if (!normalized) {
            setClubSearchResults([]);
            setClubSearchError('');
            setClubSearchLoading(false);
            return;
        }
        let active = true;
        const timer = setTimeout(async () => {
            try {
                setClubSearchLoading(true);
                setClubSearchError('');
                const results = await searchClubs(normalized);
                if (active) {
                    setClubSearchResults(results);
                }
            }
            catch (error) {
                console.error('Could not search clubs:', error);
                if (active) {
                    setClubSearchResults([]);
                    setClubSearchError('Could not search clubs.');
                }
            }
            finally {
                if (active) {
                    setClubSearchLoading(false);
                }
            }
        }, 300);
        return () => {
            active =
                false;
            clearTimeout(timer);
        };
    }, [
        clubSearch
    ]);
    useFocusEffect(useCallback(() => {
        homeFocusedRef.current =
            true;
        setAllowExplicitLanguage(false);
        void getExplicitLanguagePreference().then(value => {
            if (homeFocusedRef.current)
                setAllowExplicitLanguage(value);
        }).catch(error => {
            if (homeFocusedRef.current)
                setAllowExplicitLanguage(false);
            if (!isTransientReadError(error))
                console.warn('Could not load explicit-language preference:', error);
        });
        const now = Date.now();
        const currentPostMutationVersion = getPostMutationVersion();
        const postsChanged = currentPostMutationVersion !==
            lastSeenPostMutationRef.current;
        const homeDataIsStale = !hasLoadedHomeData.current ||
            now -
                lastHomeDataLoadAt.current >=
                HOME_FOCUS_REFRESH_MS;
        if (!hasLoadedHomeData.current) {
            void loadHomeData(true);
        }
        else if (postsChanged ||
            homeDataIsStale) {
            // Keep the existing Home/Clubs UI visible and
            // quietly refresh stale or post-mutated data in the background.
            void loadHomeData(false);
        }
        void loadComposerProfile();
        return () => {
            homeFocusedRef.current =
                false;
            Keyboard.dismiss();
            if (preserveHomeStateOnNextBlur.current) {
                preserveHomeStateOnNextBlur.current =
                    false;
                return;
            }
            setActiveSection('feed');
            setClubSearch('');
            setClubSearchResults([]);
            setClubSearchLoading(false);
            setClubSearchError('');
            setActiveClubGenre('all');
        };
    }, [
        loadComposerProfile,
        loadHomeData
    ]));
    useEffect(() => {
        let active = true;
        let channel: ReturnType<typeof supabase.channel> | null = null;
        async function subscribeToNotificationCount() {
            const { data: { user, }, error, } = await supabase.auth.getUser();
            if (error ||
                !user ||
                !active) {
                return;
            }
            const refreshAttentionCount = async () => {
                try {
                    const count = await getNotificationAttentionCount();
                    if (active) {
                        setAttentionCount(count);
                    }
                }
                catch (attentionError) {
                    console.error('Could not refresh realtime notification attention count:', attentionError);
                }
            };
            channel =
                supabase
                    .channel(`home-notification-count-${user.id}-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2)}`)
                    .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'notifications',
                    filter: `recipient_id=eq.${user.id}`,
                }, () => {
                    void refreshAttentionCount();
                })
                    .subscribe();
        }
        void subscribeToNotificationCount();
        return () => {
            active =
                false;
            if (channel) {
                void supabase.removeChannel(channel);
            }
        };
    }, []);
    async function handleRefresh() {
        try {
            setRefreshing(true);
            await loadHomeData(false);
        }
        finally {
            setRefreshing(false);
        }
    }
    useEffect(() => {
        const unsubscribe = (navigation as any).addListener('tabPress', (event: { preventDefault: () => void }) => {
            if (commentsModalVisible) {
                event.preventDefault();
                return;
            }
            if (!homeFocusedRef.current) {
                return;
            }
            if (homeScrollOffsetRef.current >
                24) {
                homeScrollRef.current?.scrollTo({
                    y: 0,
                    animated: true,
                });
                return;
            }
            void handleRefresh();
        });
        return unsubscribe;
    }, [
        navigation,
        loadHomeData,
        commentsModalVisible
    ]);
    function openClub(clubId: string) {
        preserveHomeStateOnNextBlur.current =
            true;
        router.push({
            pathname: '/club/[id]',
            params: {
                id: clubId,
            },
        });
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
    const [commentsError, setCommentsError] = useState('');
    const commentsReadSequence = useRef(0);
    const commentsViewGeneration = useRef(0);
    const activeCommentsPostId = useRef<string | null>(null);
    const commentSubmitInFlight = useRef(false);
    async function loadCommentsSheet(postId: string, force = false) {
        const request = ++commentsReadSequence.current;
        setCommentsError('');
        try {
            setCommentsLoading(true);
            const comments = await getPostComments(postId, 500, { force });
            if (request !== commentsReadSequence.current || activeCommentsPostId.current !== postId)
                return;
            setSheetComments(comments);
            setFeedPosts((current) => current.map((item) => item.id ===
                postId
                ? {
                    ...item,
                    comment_count: comments.length >= 500 ? Math.max(item.comment_count ?? 0, comments.length) : comments.length,
                }
                : item));
            setCommentsPost((current) => current?.id ===
                postId
                ? {
                    ...current,
                    comment_count: comments.length >= 500 ? Math.max(current.comment_count ?? 0, comments.length) : comments.length,
                }
                : current);
        }
        catch (error) {
            if (request !== commentsReadSequence.current || activeCommentsPostId.current !== postId)
                return;
            if (!isTransientReadError(error))
                console.warn('Could not load comments:', error);
            setCommentsError(isTransientReadError(error) ? 'Could not load the conversation. Check your connection and try again.' : 'Could not load the conversation. Please try again.');
        }
        finally {
            if (request !== commentsReadSequence.current || activeCommentsPostId.current !== postId)
                return;
            setCommentsLoading(false);
            setCommentsInitialLoadReady(true);
        }
    }
    const commentsOverlayRoot = useRef<View | null>(null);
    const commentsListRef = useRef<ScrollView | null>(null);
    const commentsMotion = useCommentSheetMotion({
        partial: commentsPartialHeight, full: commentsFullHeight, keyboardVisible: commentsKeyboardVisible,
        onSettled: (height, snap) => {
            commentsSheetCurrentHeight.current = height;
            commentsSheetSnap.current = snap;
            commentsSheetAnimating.current = false;
        },
        onDragDismiss: height => {
            commentsSheetCurrentHeight.current = height;
            closeCommentsSheet();
        },
    });
    const prepareCommentsResume = useCallback(() => {
        commentsSheetClosing.current = false;
        commentsMotion.prepare(commentsSheetCurrentHeight.current, commentsSheetSnap.current);
        commentsContentOpacity.setValue(1);
    }, [commentsMotion.prepare, commentsContentOpacity]);
    const commentsContinuation = useCommentSheetContinuation(setCommentsModalVisible, commentsListRef, prepareCommentsResume);
    function stopCommentsMotionForNavigation() {
        hideCommentSheetForNavigation(commentsOverlayRoot.current, () => {
            commentsSheetClosing.current = false;
            commentsMotion.stop();
            commentsContentOpacity.stopAnimation();
            commentsResultOpacity.stopAnimation();
            commentsSheetAnimating.current = false;
            commentsContentOpacity.setValue(0);
        });
    }
    function openCommentsSheet(post: FeedPost) {
        commentsSheetClosing.current = false;
        commentsContinuation.reset();
        activeCommentsPostId.current = post.id;
        commentsViewGeneration.current += 1;
        if (post.club_discussion?.contains_spoilers) {
            router.push({ pathname: '/post/[id]', params: { id: post.id } });
            return;
        }
        commentsContentOpacity.stopAnimation();
        commentsResultOpacity.stopAnimation();
        commentsEmptyOpacity.stopAnimation();
        commentsResultOpacity.setValue(0);
        commentsEmptyOpacity.setValue(1);
        setCommentsInitialLoadReady(false);
        setCommentsSheetEntranceReady(false);
        setCommentsKeyboardVisible(false);
        commentsMotion.prepare(commentsPartialHeight);
        commentsContentOpacity.setValue(1);
        commentsSheetCurrentHeight.current =
            commentsPartialHeight;
        commentsSheetSnap.current =
            'partial';
        commentsSheetAnimating.current =
            true;
        setSheetComments([]);
        setCommentBody('');
        setReplyTarget(null);
        setEditingComment(null);
        setCommentActionTarget(null);
        setExpandedReplyThreads({});
        setCommentSort('top');
        setCommentsPost(post);
        setCommentsModalVisible(true);
        void loadCommentsSheet(post.id);
    }
    function animateCommentsSheetIn(_restoring = false) {
        commentsSheetAnimating.current = true;
        commentsMotion.open(() => {
            commentsSheetAnimating.current = false;
            setCommentsSheetEntranceReady(true);
        });
    }
    function handleCommentsModalDismiss() {
        commentsSheetClosing.current = false;
        if (commentsContinuation.onDismiss())
            return;
        commentsMotion.stop();
        commentsResultOpacity.stopAnimation();
        commentsEmptyOpacity.stopAnimation();
        commentsResultOpacity.setValue(0);
        commentsEmptyOpacity.setValue(1);
        setCommentsInitialLoadReady(false);
        setCommentsSheetEntranceReady(false);
        setCommentsKeyboardVisible(false);
        commentsSheetAnimating.current =
            false;
        commentsSheetSnap.current =
            'partial';
        commentsSheetCurrentHeight.current =
            0;
        commentsContentOpacity.setValue(0);
        setCommentsPost(null);
        setSheetComments([]);
        setCommentBody('');
        setReplyTarget(null);
        setEditingComment(null);
        setCommentActionTarget(null);
        setExpandedReplyThreads({});
    }
    function handleCommentsBackdropPress() {
        if (editingComment ||
            replyTarget) {
            resetTemporaryCommentComposer();
            return;
        }
        if (commentsKeyboardVisible) {
            Keyboard.dismiss();
            return;
        }
        closeCommentsSheet();
    }
    function closeCommentsSheet() {
        // Closing may interrupt entrance or snapping. Only duplicate closes
        // are ignored; a stale animation flag must never trap the reader.
        if (commentsSheetClosing.current)
            return;
        commentsSheetClosing.current = true;
        activeCommentsPostId.current = null;
        commentsViewGeneration.current += 1;
        commentsReadSequence.current += 1;
        Keyboard.dismiss();
        commentsSheetAnimating.current = true;
        commentsMotion.close(() => {
            commentsSheetClosing.current = false;
            commentsSheetAnimating.current = false;
            commentsSheetCurrentHeight.current = 0;
            setCommentsModalVisible(false);
        });
    }
    function startComposerWithKeyboard(action: () => void) {
        setComposerResetting(false);
        setReplyResetting(false);
        action();
        requestAnimationFrame(() => {
            commentInputRef
                .current
                ?.focus();
        });
    }
    function startReply(comment: PostComment) {
        startComposerWithKeyboard(() => {
            setEditingComment(null);
            setCommentBody('');
            setReplyTarget(comment);
        });
    }
    function toggleReplies(commentId: string) {
        setExpandedReplyThreads(current => ({ ...current, [commentId]: (current[commentId] ?? COMMENT_REPLY_BATCH_SIZE) + COMMENT_REPLY_BATCH_SIZE }));
    }
    const [commentWarning, setCommentWarning] = useState<{title: string; message: string} | null>(null);
    function showCommentWarning(error: unknown, fallbackTitle: string) {
        const details = error && typeof error === 'object' ? error as {code?: string; message?: string} : null;
        const message = details?.message || 'Please try again.';
        if (__DEV__) console.info('[Novori comment warning response]', {
            operation: fallbackTitle === 'Could not edit comment' ? 'edit' : fallbackTitle === 'Could not reply' ? 'reply' : 'new',
            code: details?.code ?? 'unknown',
            windowOpen: commentsModalVisible,
        });
        Keyboard.dismiss();
        setCommentWarning({
            title: details?.code === 'NOVORI_MODERATION' && /review/i.test(message)
                ? 'Submission under review' : fallbackTitle,
            message,
        });
    }
    async function submitSheetComment() {
        if (__DEV__) console.info('[Novori comment submit]', {
            operation: editingComment ? 'edit' : replyTarget ? 'reply' : 'new',
            hasText: Boolean(commentBody.trim()),
            inFlight: commentSubmitInFlight.current,
        });
        if (!commentsPost ||
            submittingComment || commentSubmitInFlight.current) {
            return;
        }
        const cleaned = commentBody.trim();
        if (!cleaned) {
            return;
        }
        commentSubmitInFlight.current = true;
        setCommentsError('');
        commentsReadSequence.current += 1;
        const writeGeneration = commentsViewGeneration.current;
        const writePostId = commentsPost.id;
        if (editingComment) {
            const target = editingComment;
            const previousBody = target.body;
            setSubmittingComment(true);
            try {
                await updatePostComment(target.id, cleaned);
                setEditingComment(null);
                setCommentBody('');
            setSheetComments((current) => current.map((item) => item.id ===
                target.id
                ? {
                    ...item,
                    body: cleaned,
                    updated_at: new Date().toISOString(),
                }
                : item));

            }
            catch (error) {
                if (commentsViewGeneration.current !== writeGeneration || activeCommentsPostId.current !== writePostId)
                    return;
                if ((error as {code?: string})?.code !== 'NOVORI_MODERATION') console.warn('Could not edit comment:', error);
                setSheetComments((current) => current.map((item) => item.id ===
                    target.id
                    ? {
                        ...item,
                        body: previousBody,
                    }
                    : item));
                setEditingComment(target);
                setCommentBody(cleaned);
                showCommentWarning(error, 'Could not edit comment');
            }
            finally {
                commentSubmitInFlight.current = false;
                setSubmittingComment(false);
            }
            return;
        }
        const postId = commentsPost.id;
        const parentId = replyTarget?.id ??
            null;
        const optimisticId = `optimistic-${Date.now()}`;
        const optimisticComment: PostComment = {
            id: optimisticId,
            post_id: postId,
            author_id: 'optimistic-current-user',
            parent_comment_id: parentId,
            body: cleaned,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            author_display_name: 'You',
            author_username: null,
            author_avatar_url: null,
            is_own: true,
            upvote_count: 0,
            downvote_count: 0,
            vote_score: 0,
            viewer_vote: 0,
        };
        const previousBody = commentBody;
        const previousReplyTarget = replyTarget;
        try {
            setSubmittingComment(true);
            const confirmedId = await createPostComment(postId, cleaned, parentId);
            if (commentsViewGeneration.current !== writeGeneration || activeCommentsPostId.current !== postId)
                return;
        setSheetComments((current) => [
            ...current,
            optimisticComment
        ]);
        setFeedPosts((current) => current.map((item) => item.id ===
            postId
            ? {
                ...item,
                comment_count: (item.comment_count ??
                    0) +
                    1,
            }
            : item));
        setCommentsPost((current) => current?.id ===
            postId
            ? {
                ...current,
                comment_count: (current.comment_count ??
                    0) +
                    1,
            }
            : current);
        setCommentBody('');
        setReplyTarget(null);
            if (parentId)
                setExpandedReplyThreads(current => ({ ...current, [parentId]: Math.max(current[parentId] ?? COMMENT_REPLY_BATCH_SIZE, (sheetThreadData.nodes.get(parentId)?.children.length ?? 0) + 1) }));
            if (typeof confirmedId === 'string')
                setSheetComments(current => current.some(item => item.id === confirmedId) ? current.filter(item => item.id !== optimisticId) : current.map(item => item.id === optimisticId ? { ...item, id: confirmedId } : item));
            const request = commentsReadSequence.current;
            void getPostComments(postId).then(comments => {
                if (request !== commentsReadSequence.current || activeCommentsPostId.current !== postId)
                    return;
                setSheetComments(current => [...comments, ...current.filter(item => item.id.startsWith('optimistic-') || (comments.length >= 500 && item.id === confirmedId && !comments.some(next => next.id === item.id)))]);
                setFeedPosts(current => current.map(item => item.id === postId ? { ...item, comment_count: comments.length >= 500 ? Math.max(item.comment_count ?? 0, comments.length) : comments.length } : item));
                setCommentsPost(current => current?.id === postId ? { ...current, comment_count: comments.length >= 500 ? Math.max(current.comment_count ?? 0, comments.length) : comments.length } : current);
            }).catch(refreshError => {
                // Keep the confirmed comment. Reopening or refreshing the thread will retry the read.
                if (request !== commentsReadSequence.current || activeCommentsPostId.current !== postId)
                    return;
                if (!isTransientReadError(refreshError))
                    console.warn('Comment saved; refresh failed:', refreshError);
                setCommentsError('Your comment was saved. The conversation could not refresh. Try again when your connection is back.');
            });
        }
        catch (error) {
            if (commentsViewGeneration.current !== writeGeneration || activeCommentsPostId.current !== writePostId)
                return;
            if ((error as {code?: string})?.code !== 'NOVORI_MODERATION') console.warn('Could not add comment:', error);
            setCommentBody(previousBody);
            setReplyTarget(previousReplyTarget);
            showCommentWarning(error, previousReplyTarget ? 'Could not reply' : 'Could not comment');
        }
        finally {
            commentSubmitInFlight.current = false;
            setSubmittingComment(false);
        }
    }
    const [deleteCommentTarget, setDeleteCommentTarget] = useState<PostComment | null>(null);
    function confirmDeleteComment(comment: PostComment) { setDeleteCommentTarget(comment); }
    async function removeSheetComment(commentId: string) {
        if (!commentsPost ||
            deletingCommentId) {
            return;
        }
        const postId = commentsPost.id;
        const request = ++commentsReadSequence.current;
        const deletedIds = getCommentBranchIds(sheetComments, commentId);
        try {
            setDeletingCommentId(commentId);
            await deletePostComment(commentId);
            if (request !== commentsReadSequence.current || activeCommentsPostId.current !== postId)
                return;
            setSheetComments(current => current.filter(item => !deletedIds.has(item.id)));
            setFeedPosts(current => current.map(item => item.id === postId ? { ...item, comment_count: Math.max(0, (item.comment_count ?? 0) - deletedIds.size) } : item));
            setCommentsPost(current => current?.id === postId ? { ...current, comment_count: Math.max(0, (current.comment_count ?? 0) - deletedIds.size) } : current);
            if (replyTarget && deletedIds.has(replyTarget.id)) {
                setReplyTarget(null);
            }
            await loadCommentsSheet(commentsPost.id, true);
        }
        catch (error) {
            console.error('Could not delete comment:', error);
            Alert.alert('Could not delete comment', 'Please try again.');
            throw error;
        }
        finally {
            setDeletingCommentId(null);
        }
    }
    function openCommentActions(comment: PostComment) {
        if (comment.is_deleted || comment.is_blocked_author || comment.id.startsWith('optimistic-'))
            return;
        if (commentActionTarget ||
            commentActionClosing.current) {
            return;
        }
        Keyboard.dismiss();
        commentActionEntranceStarted.current =
            false;
        commentSelectionAccentOpacity.stopAnimation();
        commentSelectionAccentOpacity.setValue(1);
        setHoldingCommentId(comment.id);
        setCommentActionTarget(comment);
    }
    function closeCommentActions(afterClose?: () => void, quickHandoff = false) {
        if (!commentActionTarget ||
            commentActionClosing.current) {
            return;
        }
        commentActionClosing.current =
            true;
        commentSelectionAccentOpacity.stopAnimation();
        Animated.timing(commentSelectionAccentOpacity, {
            toValue: 0,
            duration: quickHandoff
                ? 55
                : 90,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
        }).start(({ finished, }) => {
            if (finished) {
                setHoldingCommentId(null);
            }
        });
        uiCommentAction.closeAfterActionWithCallback(afterClose);
    }
    function beginCommentActionHandoff(action: () => void, delay = 50) {
        if (delay <=
            0) {
            // Reply/Edit must never start the keyboard while the action
            // sheet is still mounted. Store the action, perform a very
            // fast close, then the effect above runs it only after React
            // has committed the sheet's removal.
            pendingCommentActionHandoff.current =
                action;
            closeCommentActions(undefined, true);
            return;
        }
        closeCommentActions();
        setTimeout(action, delay);
    }
    function replyToSelectedComment() {
        if (!commentActionTarget) {
            return;
        }
        const target = commentActionTarget;
        beginCommentActionHandoff(() => {
            startReply(target);
        }, 0);
    }
    function startEditComment(comment: PostComment) {
        startComposerWithKeyboard(() => {
            setReplyTarget(null);
            setEditingComment(comment);
            setCommentBody(comment.body);
        });
    }
    function editSelectedComment() {
        if (!commentActionTarget ||
            !commentActionTarget.is_own) {
            return;
        }
        const target = commentActionTarget;
        beginCommentActionHandoff(() => {
            startEditComment(target);
        }, 0);
    }
    function resetTemporaryCommentComposer() {
        if (!editingComment &&
            !replyTarget) {
            return;
        }
        setComposerResetting(true);
        setReplyResetting(Boolean(replyTarget));
        commentInputRef
            .current
            ?.clear();
        commentInputRef
            .current
            ?.blur();
        setCommentBody('');
        setEditingComment(null);
        setReplyTarget(null);
        Keyboard.dismiss();
    }
    function cancelCommentEdit() {
        resetTemporaryCommentComposer();
    }
    function handleCommentComposerOutsideTouch() {
        if (editingComment ||
            replyTarget) {
            resetTemporaryCommentComposer();
            return;
        }
        if (commentsKeyboardVisible) {
            Keyboard.dismiss();
        }
    }
    function reportSelectedComment() {
        if (!commentActionTarget ||
            commentActionTarget.is_own) {
            return;
        }
        const target = commentActionTarget;
        beginCommentActionHandoff(() => {
            openCommentReport(target);
        }, 70);
    }
    function deleteSelectedComment() {
        if (!commentActionTarget ||
            !commentActionTarget.is_own) {
            return;
        }
        const target = commentActionTarget;
        beginCommentActionHandoff(() => {
            confirmDeleteComment(target);
        }, 105);
    }
    function confirmBlockSelectedReader() {
        if (!commentActionTarget ||
            commentActionTarget.is_own) {
            return;
        }
        const target = commentActionTarget;
        const displayName = target.author_display_name
            ?.trim() ||
            target.author_username
                ?.trim() ||
            'this reader';
        beginCommentActionHandoff(() => {
            Alert.alert(`Block ${displayName}?`, 'Their comments and posts will be hidden from you, and any follow relationship between you will be removed.', [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Block',
                    style: 'destructive',
                    onPress: () => void blockSelectedReader(target),
                }
            ]);
        }, 105);
    }
    async function blockSelectedReader(comment: PostComment) {
        if (blockingReaderId) {
            return;
        }
        commentsReadSequence.current += 1;
        try {
            setBlockingReaderId(comment.author_id);
            await blockReader(comment.author_id);
            setReplyTarget(current => current?.author_id === comment.author_id ? null : current);
            setSheetComments((current) => current.map(item => item.author_id === comment.author_id ? { ...item, is_blocked_author: true, body: 'This comment is hidden.', author_display_name: 'Blocked reader', author_username: null, author_avatar_url: null } : item));
            setFeedPosts((current) => current.filter((item) => item.author_id !==
                comment.author_id));
            if (commentsPost?.author_id ===
                comment.author_id) {
                closeCommentsSheet();
            }
            Alert.alert('Reader blocked', 'You will no longer see this reader’s comments or posts.');
        }
        catch (error) {
            console.error('Could not block reader:', error);
            Alert.alert('Could not block reader', 'Please try again.');
        }
        finally {
            setBlockingReaderId(null);
        }
    }
    function sortSiblingComments(comments: PostComment[]) {
        return [
            ...comments
        ].sort((first, second) => {
            const firstOptimistic = first.id.startsWith('optimistic-');
            const secondOptimistic = second.id.startsWith('optimistic-');
            if (firstOptimistic !==
                secondOptimistic) {
                return firstOptimistic
                    ? -1
                    : 1;
            }
            if (commentSort ===
                'newest') {
                return (new Date(second.created_at).getTime() -
                    new Date(first.created_at).getTime());
            }
            const scoreDifference = (second.vote_score ??
                0) -
                (first.vote_score ??
                    0);
            if (scoreDifference !==
                0) {
                return scoreDifference;
            }
            return (new Date(second.created_at).getTime() -
                new Date(first.created_at).getTime());
        });
    }
    async function handleCommentVote(comment: PostComment, voteValue: CommentVoteValue) {
        if (comment.is_deleted || comment.is_blocked_author)
            return;
        if (comment.id.startsWith('optimistic-') ||
            votingCommentIds[comment.id]) {
            return;
        }
        commentsReadSequence.current += 1;
        const previous = comment;
        const previousVote = comment.viewer_vote ??
            0;
        const nextVote = previousVote ===
            voteValue
            ? 0
            : voteValue;
        const scoreDelta = nextVote -
            previousVote;
        const optimistic: PostComment = {
            ...comment,
            viewer_vote: nextVote,
            vote_score: (comment.vote_score ??
                0) +
                scoreDelta,
            upvote_count: (comment.upvote_count ??
                0) +
                (previousVote ===
                    1
                    ? -1
                    : 0) +
                (nextVote ===
                    1
                    ? 1
                    : 0),
            downvote_count: (comment.downvote_count ??
                0) +
                (previousVote ===
                    -1
                    ? -1
                    : 0) +
                (nextVote ===
                    -1
                    ? 1
                    : 0),
        };
        setSheetComments((current) => current.map((item) => item.id ===
            comment.id
            ? optimistic
            : item));
        setVotingCommentIds((current) => ({
            ...current,
            [comment.id]: true,
        }));
        try {
            const result = await toggleCommentVote(comment.id, voteValue);
            setSheetComments((current) => current.map((item) => item.id ===
                comment.id
                ? {
                    ...item,
                    ...result,
                }
                : item));
        }
        catch (error) {
            console.error('Could not update comment vote:', error);
            setSheetComments((current) => current.map((item) => item.id ===
                comment.id
                ? previous
                : item));
        }
        finally {
            setVotingCommentIds((current) => {
                const next = {
                    ...current,
                };
                delete next[comment.id];
                return next;
            });
        }
    }
    function openCommentReport(comment: PostComment) {
        if (comment.is_own ||
            commentReportSubmitting ||
            commentReportTarget ||
            commentReportSheetClosing.current) {
            return;
        }
        Keyboard.dismiss();
        commentReportSheetHeight.current =
            0;
        commentReportEntranceStarted.current =
            false;
        commentReportSheetAnimating.current =
            false;
        commentReportSheetClosing.current =
            false;
        setCommentReportTarget(comment);
    }
    function closeCommentReport() {
        if (commentReportSubmitting ||
            commentReportSheetClosing.current) {
            return;
        }
        dismissCommentReport();
    }
    function dismissCommentReport(afterClose?: () => void) {
        if (commentReportSheetClosing.current) {
            return;
        }
        commentReportSheetClosing.current =
            true;
        commentReportSheetAnimating.current =
            true;
        uiCommentReport.closeAfterActionWithCallback(afterClose);
    }
    async function handleCommentReport(reason: ReportReason) {
        if (!commentReportTarget ||
            commentReportSubmitting) {
            return;
        }
        try {
            setCommentReportSubmitting(true);
            await submitCommentReport(commentReportTarget.id, reason);
            dismissCommentReport(() => {
                setCommentWarning({ title: 'Report submitted', message: 'Thanks for letting us know. Your report has been submitted for review.' });
            });
        }
        catch (error) {
            console.error('Could not report comment:', error);
            Alert.alert('Could not submit report', 'Please try again.');
        }
        finally {
            setCommentReportSubmitting(false);
        }
    }
    const sheetThreadData = useMemo(() => buildCommentThreads(sheetComments, commentSort), [sheetComments, commentSort]);
    const sheetDepthLimit = getCommentDepthLimit(Math.min(windowWidth, 720));
    function renderSheetComment(comment: PostComment, depth = 0) {
        const displayName = comment.author_display_name
            ?.trim() ||
            comment.author_username
                ?.trim() ||
            'Novori Reader';
        const username = comment.author_username
            ?.trim()
            ? `@${comment.author_username.trim()}`
            : '';
        const initial = displayName
            .charAt(0)
            .toUpperCase();
        const children = sheetThreadData.nodes.get(comment.id)?.children ?? [];
        const visibleLimit = expandedReplyThreads[comment.id] ?? COMMENT_REPLY_BATCH_SIZE;
        const expanded = visibleLimit > COMMENT_REPLY_BATCH_SIZE;
        const visibleChildren = children.slice(0, visibleLimit);
        const hiddenCount = Math.max(0, children.length -
            visibleChildren.length);
        const visualDepth = depth > 0 ? 1 : 0;
        return (<View key={comment.id} style={[
                styles.sheetCommentThread,
                {
                    marginLeft: visualDepth *
                        14,
                    paddingLeft: visualDepth ? 9 : 0,
                }
            ]}>
        {visualDepth ? <CommentBranchGuide /> : null}
        <Pressable delayLongPress={220} onLongPress={() => {
                if (!comment.is_deleted)
                    openCommentActions(comment);
            }} style={[
                styles.sheetComment
            ]}>
          {holdingCommentId ===
                comment.id ? (<Animated.View pointerEvents="none" style={[
                    styles.sheetCommentActionAccent,
                    {
                        opacity: commentSelectionAccentOpacity,
                    }
                ]}/>) : null}
          {comment.is_blocked_author ? <Text style={{ color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 12, paddingVertical: 4 }}>Blocked reader · This comment is hidden.</Text> : <>
          <Pressable disabled={comment.is_deleted} delayLongPress={220} onLongPress={() => openCommentActions(comment)} onPress={() => {
                    closeCommentsSheet();
                    openReader(comment.author_id);
                }} style={({ pressed }) => [
                    styles.sheetCommentAvatarButton,
                    pressed &&
                        styles.pressed
                ]}>
            {comment.author_avatar_url ? (<Image source={{
                        uri: moderationMediaUrl(comment.author_avatar_url),
                    }} style={styles.sheetCommentAvatar}/>) : (<View style={styles.sheetCommentAvatarFallback}>
                <Text style={styles.sheetCommentAvatarText}>
                  {initial}
                </Text>
              </View>)}
          </Pressable>

          <View style={styles.sheetCommentCopy}>
            <View style={styles.sheetCommentIdentity}>
              <Pressable disabled={comment.is_deleted} delayLongPress={220} onLongPress={() => openCommentActions(comment)} onPress={() => {
                    closeCommentsSheet();
                    openReader(comment.author_id);
                }} hitSlop={6} style={({ pressed }) => [
                    styles.sheetCommentNameButton,
                    pressed &&
                        styles.pressed
                ]}>
                <Text style={styles.sheetCommentName} numberOfLines={1}>
                  {displayName}
                </Text>
              </Pressable>

              {username ? (<Text style={styles.sheetCommentUsername} numberOfLines={1}>
                  {username}
                </Text>) : null}

              <Text style={styles.sheetCommentTime}>
                ·{' '}
                {formatFeedTime(comment.created_at)}
              </Text>
            </View>

            <Pressable delayLongPress={220} onLongPress={() => openCommentActions(comment)} hitSlop={{
                    top: 6,
                    bottom: 8,
                    left: 4,
                    right: 4,
                }} style={styles.commentHoldTarget}>
              {renderExplicitContentWarning(comment.body, 'comment', comment.id, styles.sheetCommentBody, comment.is_own)}
            </Pressable>

            <View style={styles.sheetCommentActions}>
              <View style={styles.commentVoteControl}>
                <Pressable delayLongPress={220} onLongPress={() => openCommentActions(comment)} disabled={comment.is_deleted || comment.id.startsWith('optimistic-') || Boolean(votingCommentIds[comment.id])} onPress={() => void handleCommentVote(comment, 1)} hitSlop={8} style={({ pressed }) => [
                    styles.commentVoteButton,
                    comment.viewer_vote ===
                        1 &&
                        styles.commentVoteButtonActive,
                    pressed &&
                        styles.pressed
                ]}>
                  <Ionicons name={comment.viewer_vote ===
                    1
                    ? 'arrow-up-circle'
                    : 'arrow-up-circle-outline'} size={21} color={comment.viewer_vote ===
                    1
                    ? colors.gold
                    : colors.mutedText}/>
                </Pressable>

                <Text style={[
                    styles.commentVoteScore,
                    comment.viewer_vote !==
                        0 &&
                        styles.commentVoteScoreActive
                ]}>
                  {comment.vote_score ??
                    0}
                </Text>

                <Pressable delayLongPress={220} onLongPress={() => openCommentActions(comment)} disabled={comment.is_deleted || comment.id.startsWith('optimistic-') || Boolean(votingCommentIds[comment.id])} onPress={() => void handleCommentVote(comment, -1)} hitSlop={8} style={({ pressed }) => [
                    styles.commentVoteButton,
                    comment.viewer_vote ===
                        -1 &&
                        styles.commentVoteButtonActive,
                    pressed &&
                        styles.pressed
                ]}>
                  <Ionicons name={comment.viewer_vote ===
                    -1
                    ? 'arrow-down-circle'
                    : 'arrow-down-circle-outline'} size={21} color={comment.viewer_vote ===
                    -1
                    ? colors.gold
                    : colors.mutedText}/>
                </Pressable>
              </View>
              {!comment.is_deleted && <Pressable accessibilityRole="button" accessibilityLabel={`Reply to comment: ${comment.id}`} disabled={submittingComment || comment.id.startsWith('optimistic-')} onPress={() => startReply(comment)} delayLongPress={220} onLongPress={() => openCommentActions(comment)} hitSlop={6} style={styles.commentVoteButton}><Ionicons name="return-down-forward-outline" size={18} color={colors.mutedText}/></Pressable>}
            </View>
          </View>
          </>}
        </Pressable>

        {children.length > 0 && depth >= sheetDepthLimit ? (<Pressable accessibilityRole="button" accessibilityLabel={`View conversation: ${comment.id}`} style={styles.continueSheetConversation} onPress={() => {
                    if (!commentsPost)
                        return;
                    const id = commentsPost.id;
                    preserveHomeStateOnNextBlur.current = true;
                    openCommentConversation(destination => router.push(destination), id, comment.id, { stopMotion: stopCommentsMotionForNavigation, suspend: commentsContinuation.suspend });
                }}><Ionicons name="chatbubbles-outline" size={14} color={colors.gold}/><Text style={styles.continueSheetConversationText}>View conversation · {countThreadReplies(sheetThreadData.nodes.get(comment.id)!)} {countThreadReplies(sheetThreadData.nodes.get(comment.id)!) === 1 ? 'reply' : 'replies'}</Text><Ionicons name="chevron-forward" size={13} color={colors.gold}/></Pressable>) : visibleChildren.length >
                0 ? (<View style={styles.sheetReplies}>
            {visibleChildren.map((child) => renderSheetComment(child, depth + 1))}
          </View>) : null}

        {depth < sheetDepthLimit && hiddenCount >
                0 ? (<Pressable accessibilityRole="button" accessibilityLabel={`Show more replies: ${comment.id}`} onPress={() => toggleReplies(comment.id)} style={({ pressed }) => [
                    styles.viewMoreRepliesButton,
                    pressed &&
                        styles.pressed
                ]}>
            <View style={styles.replyGuide}/>

            <Text style={styles.viewMoreRepliesText}>
              Show more replies · {hiddenCount}
            </Text>
          </Pressable>) : null}
        {depth < sheetDepthLimit && expanded &&
                children.length >
                    COMMENT_REPLY_BATCH_SIZE ? (<Pressable accessibilityRole="button" accessibilityLabel={`Show fewer replies: ${comment.id}`} onPress={() => setExpandedReplyThreads(current => ({ ...current, [comment.id]: COMMENT_REPLY_BATCH_SIZE }))} style={({ pressed }) => [
                    styles.viewMoreRepliesButton,
                    pressed &&
                        styles.pressed
                ]}>
            <View style={styles.replyGuide}/>

            <Text style={styles.viewMoreRepliesText}>
              Show fewer replies
            </Text>
          </Pressable>) : null}
      </View>);
    }
    function renderClubCard(club: ClubWithMembership, compact = false) {
        const initial = club.name
            .charAt(0)
            .toUpperCase();
        return (<Pressable key={club.id} onPress={() => openClub(club.id)} style={({ pressed }) => [
                compact
                    ? styles.compactClubCard
                    : styles.clubCard,
                pressed &&
                    styles.pressed
            ]}>
        {club.cover_url ? (<Image source={{
                    uri: moderationMediaUrl(club.cover_url),
                }} style={compact
                    ? styles.compactClubImage
                    : styles.clubImage}/>) : (<View style={compact
                    ? styles.compactClubImageFallback
                    : styles.clubImageFallback}>
            <Text style={compact
                    ? styles.compactClubInitial
                    : styles.clubInitial}>
              {initial}
            </Text>
          </View>)}

        <View style={styles.clubCardCopy}>
          <View style={styles.clubMetaRow}>
            <Ionicons name={club.privacy ===
                'public'
                ? 'earth-outline'
                : 'lock-closed-outline'} size={12} color={colors.softGold}/>

            <Text style={styles.clubMetaText}>
              {club.privacy ===
                'public'
                ? 'Public'
                : 'Private'}
            </Text>

            <Text style={styles.clubMetaDot}>
              •
            </Text>

            <Text style={styles.clubMetaText}>
              {club.member_count}{' '}
              {club.member_count ===
                1
                ? 'member'
                : 'members'}
            </Text>
          </View>

          <Text style={styles.clubName} numberOfLines={1}>
            {club.name}
          </Text>

          {!compact &&
                club.description ? (<Text style={styles.clubDescription} numberOfLines={2}>
              {club.description}
            </Text>) : null}

          {club.genres?.length ? (<View style={styles.clubGenreRow}>
              {club.genres
                    .slice(0, compact
                    ? 1
                    : 2)
                    .map((genre) => (<View key={genre} style={styles.clubGenreBadge}>
                      <Text style={styles.clubGenreBadgeText}>
                        {getClubGenreLabel(genre)}
                      </Text>
                    </View>))}

              {club.genres.length >
                    (compact ? 1 : 2) ? (<Text style={styles.clubGenreMore}>
                  +
                  {club.genres.length -
                        (compact
                            ? 1
                            : 2)}
                </Text>) : null}
            </View>) : null}

          {club.membership_role ? (<View style={styles.membershipBadge}>
              <Text style={styles.membershipBadgeText}>
                {club.membership_role ===
                    'owner'
                    ? 'Owner'
                    : club.membership_role ===
                        'admin'
                        ? 'Admin'
                        : 'Member'}
              </Text>
            </View>) : null}
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
      </Pressable>);
    }
    async function alwaysShowExplicitLanguage() {
        try {
            setAllowExplicitLanguage(true);
            await setExplicitLanguagePreference(true);
        }
        catch (error) {
            console.error('Could not save explicit-language preference:', error);
            setAllowExplicitLanguage(false);
            Alert.alert('Could not save preference', 'Please try again.');
        }
    }
    function renderExplicitContentWarning(content: string, targetType: 'post' | 'comment', targetId: string, textStyle: any, isOwnContent = false) {
        const revealed = isExplicitContentRevealed(targetType, targetId) ||
            (targetType ===
                'post'
                ? Boolean(revealedExplicitPosts[targetId])
                : Boolean(revealedExplicitComments[targetId]));
        const shouldHide = !isOwnContent &&
            !allowExplicitLanguage &&
            !revealed &&
            containsExplicitLanguage(content);
        if (!shouldHide) {
            return (<Text style={textStyle}>
          {content}
        </Text>);
        }
        const revealOnce = () => {
            revealExplicitContentOnce(targetType, targetId);
            if (targetType ===
                'post') {
                setRevealedExplicitPosts((current) => ({
                    ...current,
                    [targetId]: true,
                }));
            }
            else {
                setRevealedExplicitComments((current) => ({
                    ...current,
                    [targetId]: true,
                }));
            }
        };
        return (<View style={styles.explicitContentWrap}>
        <Text style={[
                textStyle,
                styles.explicitContentSource
            ]}>
          {content}
        </Text>

        <BlurView intensity={65} tint="dark" style={StyleSheet.absoluteFill}/>

        <View style={styles.explicitWarningCard}>
          <View style={styles.explicitWarningHeading}>
            <Ionicons name="eye-off-outline" size={17} color={colors.gold}/>

            <Text style={styles.explicitWarningTitle}>
              Explicit content warning
            </Text>
          </View>

          <Text style={styles.explicitWarningText}>
            This may contain explicit language.
          </Text>

          <View style={styles.explicitWarningActions}>
            <Pressable onPress={(event) => {
                event.stopPropagation();
                revealOnce();
            }} style={({ pressed }) => [
                styles.explicitWarningButton,
                pressed &&
                    styles.pressed
            ]}>
              <Text style={styles.explicitWarningButtonText}>
                Show once
              </Text>
            </Pressable>

            <Pressable onPress={(event) => {
                event.stopPropagation();
                void alwaysShowExplicitLanguage();
            }} style={({ pressed }) => [
                styles.explicitWarningButton,
                styles.explicitWarningButtonPrimary,
                pressed &&
                    styles.pressed
            ]}>
              <Text style={[
                styles.explicitWarningButtonText,
                styles.explicitWarningButtonPrimaryText
            ]}>
                Always show
              </Text>
            </Pressable>
          </View>
        </View>
      </View>);
    }
    function formatFeedTime(createdAt: string) {
        const created = new Date(createdAt);
        const diffMs = Date.now() -
            created.getTime();
        const minutes = Math.max(0, Math.floor(diffMs /
            60000));
        if (minutes < 1) {
            return 'now';
        }
        if (minutes < 60) {
            return `${minutes}m`;
        }
        const hours = Math.floor(minutes /
            60);
        if (hours < 24) {
            return `${hours}h`;
        }
        const days = Math.floor(hours /
            24);
        if (days < 7) {
            return `${days}d`;
        }
        return created.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
        });
    }
    function formatCommentContextTime(createdAt: string) {
        const value = formatFeedTime(createdAt);
        if (value === 'now') {
            return 'just now';
        }
        if (/^\d+[mhd]$/.test(value)) {
            return `${value} ago`;
        }
        return value;
    }
    function openPostReport(post: FeedPost) {
        if (!currentUserId ||
            post.author_id ===
                currentUserId) {
            return;
        }
        if (reportTargetPost || reportSheetClosing.current) {
            return;
        }
        reportSubmitted.current = false;
        reportModalShown.current = false;
        reportEntranceStarted.current = false;
        reportSheetHeight.current = 0;
        reportSheetAnimating.current =
            false;
        setReportTargetPost(post);
    }
    const reportConfirmation = useReportConfirmation(Boolean(reportTargetPost));
    function handleReportDismiss() {
        reportModalShown.current = false;
        reportSheetClosing.current = false;
        if (reportSubmitted.current) {
            reportSubmitted.current = false;
            reportConfirmation.present();
        }
    }
    function closePostReport() {
        if (reportSubmitting) {
            return;
        }
        dismissPostReport();
    }
    function dismissPostReport() {
        if (reportSheetClosing.current) {
            return;
        }
        reportSheetClosing.current =
            true;
        reportSheetAnimating.current =
            true;
        uiReport.closeAfterActionWithCallback();
    }
    async function handlePostReport(reason: ReportReason) {
        if (!reportTargetPost ||
            reportSubmitting) {
            return;
        }
        try {
            setReportSubmitting(true);
            await submitPostReport(reportTargetPost.id, reason);
            reportSubmitted.current = true;
            dismissPostReport();
        }
        catch (error) {
            console.error('Could not report post:', error);
            Alert.alert('Could not submit report', 'Please try again.');
        }
        finally {
            setReportSubmitting(false);
        }
    }
    function editOwnPost(post: FeedPost) {
        router.push(getPostEditRoute(post));
    }
    function confirmDeleteOwnPost(post: FeedPost) {
        setDeletePostTarget(post);
    }
    async function removeOwnPost(post: FeedPost) {
        if (deletingPostId) {
            return;
        }
        try {
            setDeletingPostId(post.id);
            await deletePost(post.id);
            setFeedPosts((current) => current.filter((item) => item.id !==
                post.id));
            lastSeenPostMutationRef.current =
                getPostMutationVersion();
        }
        catch (error) {
            console.error('Could not delete post:', error);
            Alert.alert('Could not delete post', error instanceof Error
                ? error.message
                : 'Please try again.');
            throw error;
        }
        finally {
            setDeletingPostId(null);
        }
    }
    function openOwnPostOptions(post: FeedPost) {
        if (deletingPostId ||
            ownPostOptionsTarget) {
            return;
        }
        setOwnPostOptionsTarget(post);
    }
    function closeOwnPostOptions(afterClose?: () => void) {
        uiOwnPostOptions.closeAfterActionWithCallback(afterClose);
    }
    function editSelectedOwnPost() {
        if (!ownPostOptionsTarget) {
            return;
        }
        const post = ownPostOptionsTarget;
        closeOwnPostOptions(() => editOwnPost(post));
    }
    function deleteSelectedOwnPost() {
        if (!ownPostOptionsTarget) {
            return;
        }
        const post = ownPostOptionsTarget;
        closeOwnPostOptions(() => confirmDeleteOwnPost(post));
    }
    async function shareFeedPost(post: FeedPost) {
        try {
            await sharePostLink(post.id);
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
            setFeedPosts((current) => current.map((post) => post.id ===
                postId
                ? {
                    ...post,
                    ...nextVote,
                }
                : post));
            lastSeenPostMutationRef.current =
                getPostMutationVersion();
        }
        catch (error) {
            console.error('Could not update post vote:', error);
        }
        finally {
            setVotingPostId(null);
        }
    }
    function renderFeedPost(post: FeedPost) {
        return <FeedPostCard key={post.id} post={post} currentUserId={currentUserId} votingPostId={votingPostId} deletingPostId={deletingPostId} onOpen={post => router.push({ pathname: '/post/[id]', params: { id: post.id } })} onComments={openCommentsSheet} onVote={handlePostVote} onMore={post => post.author_id === currentUserId ? openOwnPostOptions(post) : openPostReport(post)} onShare={shareFeedPost} onReader={openReader} onClub={openClub} renderText={renderExplicitContentWarning}/>;
    }
    function renderFeed() {
        if (feedLoading) {
            return (<View style={styles.feedLoading}>
          <ActivityIndicator size="small" color={colors.gold}/>
        </View>);
        }
        if (feedError) {
            return (<View style={styles.feedEmptyCard}>
          <Ionicons name="cloud-offline-outline" size={27} color={colors.mutedText}/>

          <Text style={styles.feedEmptyTitle}>
            Feed unavailable
          </Text>

          <Text style={styles.feedEmptyText}>
            {feedError}
          </Text>

          <Pressable onPress={() => loadHomeData(true)} style={({ pressed }) => [
                    styles.feedActionButton,
                    pressed &&
                        styles.pressed
                ]}>
            <Text style={styles.feedActionButtonText}>
              Try Again
            </Text>
          </Pressable>
        </View>);
        }
        if (feedPosts.length ===
            0) {
            return (<View style={styles.feedEmptyCard}>
          <View style={styles.feedEmptyIcon}>
            <Ionicons name="newspaper-outline" size={27} color={colors.gold}/>
          </View>

          <Text style={styles.feedEmptyTitle}>
            Your feed is ready.
          </Text>

          <Text style={styles.feedEmptyText}>
            Posts from readers you follow and clubs you’ve joined will appear here. You can also make the first post yourself.
          </Text>

          <Pressable onPress={() => router.push('/create-post')} style={({ pressed }) => [
                    styles.feedActionButton,
                    pressed &&
                        styles.pressed
                ]}>
            <Ionicons name="add" size={17} color={colors.background}/>

            <Text style={styles.feedActionButtonText}>
              Create Post
            </Text>
          </Pressable>
        </View>);
        }
        return (<View style={styles.feedList}>
        <View style={styles.feedHeadingRow}>
          <View style={styles.feedHeadingCopy}>
            <Text style={styles.sectionTitle}>
              Your Feed
            </Text>

            <Text style={styles.sectionSubtitle}>
              Readers you follow and clubs you belong to.
            </Text>
          </View>

          <Pressable onPress={() => router.push('/create-post')} style={({ pressed }) => [
                styles.feedComposeButton,
                pressed &&
                    styles.pressed
            ]}>
            <Ionicons name="add" size={20} color={colors.background}/>

            <Text style={styles.feedComposeButtonText}>
              Post
            </Text>
          </Pressable>
        </View>

        {feedPosts.map(renderFeedPost)}
      </View>);
    }
    function renderClubs() {
        if (clubsLoading) {
            return (<View style={styles.clubsLoading}>
          <ActivityIndicator size="small" color={colors.gold}/>
        </View>);
        }
        const isSearching = Boolean(clubSearch.trim());
        const filteredDiscoverClubs = activeClubGenre ===
            'all'
            ? discoverClubs
            : discoverClubs.filter((club) => club.genres?.includes(activeClubGenre));
        return (<View>
        <View style={styles.clubSearchWrap}>
          <Ionicons name="search-outline" size={19} color={colors.mutedText}/>

          <TextInput value={clubSearch} onChangeText={setClubSearch} placeholder="Search clubs by name or ID" placeholderTextColor={colors.mutedText} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={styles.clubSearchInput}/>

          {clubSearchLoading ? (<ActivityIndicator size="small" color={colors.gold}/>) : clubSearch ? (<Pressable onPress={() => setClubSearch('')} hitSlop={8} style={({ pressed, }) => [
                    styles.clubSearchClear,
                    pressed &&
                        styles.pressed
                ]}>
              <Ionicons name="close-circle" size={19} color={colors.mutedText}/>
            </Pressable>) : null}
        </View>

        <Text style={styles.clubSearchHint}>
          Search public clubs by name. Exact club IDs also work.
        </Text>

        {isSearching ? (<View>
            <View style={styles.searchResultsHeader}>
              <Text style={styles.sectionTitle}>
                Search Results
              </Text>

              {!clubSearchLoading &&
                    !clubSearchError ? (<Text style={styles.sectionSubtitle}>
                  {clubSearchResults.length}{' '}
                  {clubSearchResults.length ===
                        1
                        ? 'club'
                        : 'clubs'}
                </Text>) : null}
            </View>

            {clubSearchError ? (<View style={styles.searchEmpty}>
                <Ionicons name="cloud-offline-outline" size={25} color={colors.mutedText}/>

                <Text style={styles.searchEmptyTitle}>
                  Search unavailable
                </Text>

                <Text style={styles.searchEmptyText}>
                  {clubSearchError}
                </Text>
              </View>) : clubSearchLoading ? (<View style={styles.searchLoading}>
                <ActivityIndicator size="small" color={colors.gold}/>
              </View>) : clubSearchResults.length >
                    0 ? (<View style={styles.clubList}>
                {clubSearchResults.map((club) => renderClubCard(club))}
              </View>) : (<View style={styles.searchEmpty}>
                <Ionicons name="search-outline" size={25} color={colors.mutedText}/>

                <Text style={styles.searchEmptyTitle}>
                  No clubs found
                </Text>

                <Text style={styles.searchEmptyText}>
                  Try a different club name or paste an exact club ID.
                </Text>
              </View>)}
          </View>) : (<>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Your Clubs
            </Text>

            <Text style={styles.sectionSubtitle}>
              Communities you’ve joined or created.
            </Text>
          </View>

          <Pressable onPress={() => router.push('/create-club')} style={({ pressed }) => [
                    styles.createClubButton,
                    pressed &&
                        styles.pressed
                ]}>
            <Ionicons name="add" size={17} color={colors.background}/>

            <Text style={styles.createClubButtonText}>
              Create
            </Text>
          </Pressable>
        </View>

        {myClubs.length >
                    0 ? (<View style={styles.clubList}>
            {myClubs.map((club) => renderClubCard(club, true))}
          </View>) : (<Pressable onPress={() => router.push('/create-club')} style={({ pressed }) => [
                        styles.emptyClubsCard,
                        pressed &&
                            styles.pressed
                    ]}>
            <View style={styles.emptyClubsIcon}>
              <Ionicons name="people-outline" size={24} color={colors.gold}/>
            </View>

            <View style={styles.emptyClubsCopy}>
              <Text style={styles.emptyClubsTitle}>
                Start your first club
              </Text>

              <Text style={styles.emptyClubsText}>
                Build a reading community around a genre, author, series, or shared interest.
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
          </Pressable>)}

        <View style={styles.discoverHeader}>
          <Text style={styles.sectionTitle}>
            Discover Clubs
          </Text>

          <Text style={styles.sectionSubtitle}>
            Public communities open to new readers.
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clubGenreFilterRow} style={styles.clubGenreFilterScroll}>
          <Pressable onPress={() => setActiveClubGenre('all')} style={[
                    styles.clubGenreFilterChip,
                    activeClubGenre ===
                        'all' &&
                        styles.clubGenreFilterChipActive
                ]}>
            <Text style={[
                    styles.clubGenreFilterText,
                    activeClubGenre ===
                        'all' &&
                        styles.clubGenreFilterTextActive
                ]}>
              All Genres
            </Text>
          </Pressable>

          {CLUB_GENRES.map((genre) => {
                    const active = activeClubGenre ===
                        genre.key;
                    return (<Pressable key={genre.key} onPress={() => setActiveClubGenre(genre.key)} style={[
                            styles.clubGenreFilterChip,
                            active &&
                                styles.clubGenreFilterChipActive
                        ]}>
                  <Text style={[
                            styles.clubGenreFilterText,
                            active &&
                                styles.clubGenreFilterTextActive
                        ]}>
                    {genre.label}
                  </Text>
                </Pressable>);
                })}
        </ScrollView>

        {filteredDiscoverClubs.length >
                    0 ? (<View style={styles.clubList}>
            {filteredDiscoverClubs.map((club) => renderClubCard(club))}
          </View>) : (<View style={styles.discoverEmpty}>
            <Ionicons name="compass-outline" size={26} color={colors.mutedText}/>

            <Text style={styles.discoverEmptyTitle}>
              {activeClubGenre ===
                        'all'
                        ? 'No public clubs yet.'
                        : `No ${getClubGenreLabel(activeClubGenre)} clubs yet.`}
            </Text>

            <Text style={styles.discoverEmptyText}>
              {activeClubGenre ===
                        'all'
                        ? 'When readers create public clubs, they’ll appear here.'
                        : 'Try another genre or switch back to All Genres.'}
            </Text>
          </View>)}
          </>)}
      </View>);
    }
    const rootComments = sheetThreadData.roots;
    const canSubmitComment = Boolean(commentBody.trim()) &&
        !submittingComment;
    const composerDisplayName = composerProfile
        ?.display_name
        ?.trim() ||
        composerProfile
            ?.username
            ?.trim() ||
        'You';
    const composerAvatarInitial = composerDisplayName
        .charAt(0)
        .toUpperCase() ||
        'Y';
    const uiOwnPostOptions = useUiSheetMotion({ visible: Boolean(ownPostOptionsTarget), busy: false, embedded: false, onDismiss: () => {
            const finished = true;
            if (!finished) {
                return;
            }
            setOwnPostOptionsTarget(null);
        } });
    const uiReport = useUiSheetMotion({ visible: Boolean(reportTargetPost), busy: reportSubmitting, embedded: false, onDismiss: () => {
            const finished = true;
            reportSheetAnimating.current =
                false;
            if (finished) {
                setReportTargetPost(null);
                if (Platform.OS !==
                    'ios') {
                    handleReportDismiss();
                }
            }
        } });
    const uiCommentAction = useUiSheetMotion({ visible: Boolean(commentActionTarget), busy: false, embedded: true, onDismiss: () => {
            const finished = true;
            setHoldingCommentId(null);
            commentSelectionAccentOpacity.setValue(0);
            commentActionClosing.current =
                false;
            if (!finished) {
                return;
            }
            commentActionEntranceStarted.current =
                false;
            setCommentActionTarget(null);
        } });
    const uiCommentReport = useUiSheetMotion({ visible: Boolean(commentReportTarget), busy: commentReportSubmitting, embedded: true, onDismiss: () => {
            const finished = true;
            commentReportSheetAnimating.current =
                false;
            if (!finished) {
                commentReportSheetClosing.current =
                    false;
                return;
            }
            setCommentReportTarget(null);
            commentReportSheetClosing.current =
                false;
            commentReportEntranceStarted.current =
                false;
            commentReportSheetHeight.current =
                0;
        } });
    return (<>
      <SafeAreaView pointerEvents={commentsModalVisible ? "none" : "auto"} accessibilityElementsHidden={commentsModalVisible} importantForAccessibility={commentsModalVisible ? "no-hide-descendants" : "auto"} style={styles.safeArea} edges={[
            'top'
        ]}>
      <ScrollView ref={homeScrollRef} scrollEnabled={!commentsModalVisible} scrollsToTop={!commentsModalVisible} style={styles.screen} contentContainerStyle={styles.scrollContent} onScroll={(event) => {
            const y = event.nativeEvent
                .contentOffset.y;
            homeScrollOffsetRef.current =
                y;
            const shouldShow = y >
                76;
            if (shouldShow !==
                showStickyHomeHeader) {
                setShowStickyHomeHeader(shouldShow);
            }
        }} scrollEventThrottle={16} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.gold}/>} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={styles.brandBlock}>
              <Text style={styles.logo}>
                Novori
              </Text>

              <Text style={styles.slogan}>
                Read. Discuss. Belong.
              </Text>
            </View>

            <Pressable onPress={() => router.push('/(tabs)/notifications')} hitSlop={10} style={({ pressed, }) => [
            styles.notificationButton,
            pressed &&
                styles.pressed
        ]}>
              <Ionicons name={attentionCount >
            0
            ? 'notifications'
            : 'notifications-outline'} size={24} color={attentionCount >
            0
            ? colors.gold
            : colors.text}/>

              {attentionCount >
            0 ? (<View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {attentionCount >
                99
                ? '99+'
                : attentionCount}
                  </Text>
                </View>) : null}
            </Pressable>
          </View>

          <View style={styles.sectionSwitch}>
            <Pressable ref={feedTarget.ref} onLayout={feedTarget.onLayout} onPress={() => setActiveSection('feed')} style={[
            styles.sectionSwitchButton,
            activeSection ===
                'feed' &&
                styles.sectionSwitchButtonActive
        ]}>
              <Text style={[
            styles.sectionSwitchText,
            activeSection ===
                'feed' &&
                styles.sectionSwitchTextActive
        ]}>
                Feed
              </Text>
            </Pressable>

            <Pressable ref={clubsTarget.ref} onLayout={clubsTarget.onLayout} onPress={() => setActiveSection('clubs')} style={[
            styles.sectionSwitchButton,
            activeSection ===
                'clubs' &&
                styles.sectionSwitchButtonActive
        ]}>
              <Text style={[
            styles.sectionSwitchText,
            activeSection ===
                'clubs' &&
                styles.sectionSwitchTextActive
        ]}>
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

      {showStickyHomeHeader ? (<Pressable onPress={() => {
                homeScrollRef.current?.scrollTo({
                    y: 0,
                    animated: true,
                });
                void handleRefresh();
            }} style={styles.stickyHomeHeader}/>) : null}
      </SafeAreaView>

      <UiSheetModal visible={Boolean(ownPostOptionsTarget)} transparent animationType="none" onRequestClose={() => closeOwnPostOptions()} motion={uiOwnPostOptions}>
        <Pressable style={styles.ownPostOptionsBackdrop} onPress={() => closeOwnPostOptions()}>
          <UiSheetBackdrop pointerEvents="none" style={[
            styles.ownPostOptionsBackdropVisual,
            {}
        ]} motion={uiOwnPostOptions}/>

          <UiSheetSurface style={[
            styles.ownPostOptionsSheet,
            {
                paddingBottom: Math.max(18, insets.bottom +
                    12)
            }
        ]} motion={uiOwnPostOptions}>
            <Pressable onPress={(event) => event.stopPropagation()}>
              <View style={styles.ownPostOptionsHandle}/>

              <View style={styles.ownPostOptionsHeader}>
                <View style={styles.ownPostOptionsHeaderIcon}>
                  <Ionicons name="ellipsis-horizontal" size={19} color={colors.gold}/>
                </View>

                <View style={styles.ownPostOptionsHeaderCopy}>
                  <Text style={styles.ownPostOptionsTitle}>
                    Post options
                  </Text>

                  <Text style={styles.ownPostOptionsSubtitle}>
                    Manage your post.
                  </Text>
                </View>
              </View>

              <View style={styles.ownPostOptionsList}>
                <Pressable onPress={editSelectedOwnPost} style={({ pressed }) => [
            styles.ownPostOptionsRow,
            pressed &&
                styles.ownPostOptionsRowPressed
        ]}>
                  <View style={styles.ownPostOptionsRowIcon}>
                    <Ionicons name="create-outline" size={20} color={colors.gold}/>
                  </View>

                  <View style={styles.ownPostOptionsRowCopy}>
                    <Text style={styles.ownPostOptionsRowTitle}>
                      Edit Post
                    </Text>

                    <Text style={styles.ownPostOptionsRowSubtitle}>
                      Update what you shared.
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
                </Pressable>

                <View style={styles.ownPostOptionsDivider}/>

                <Pressable onPress={deleteSelectedOwnPost} style={({ pressed }) => [
            styles.ownPostOptionsRow,
            pressed &&
                styles.ownPostOptionsRowPressed
        ]}>
                  <View style={[
            styles.ownPostOptionsRowIcon,
            styles.ownPostOptionsDangerIcon
        ]}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger}/>
                  </View>

                  <View style={styles.ownPostOptionsRowCopy}>
                    <Text style={styles.ownPostOptionsDangerTitle}>
                      Delete Post
                    </Text>

                    <Text style={styles.ownPostOptionsRowSubtitle}>
                      Permanently remove this post.
                    </Text>
                  </View>
                </Pressable>
              </View>

              <Text style={styles.ownPostOptionsHint}>
                Tap outside to cancel
              </Text>
            </Pressable>
          </UiSheetSurface>
        </Pressable>
      </UiSheetModal>

      <ValidationWarningSheet visible={reportConfirmation.visible} title="Report submitted" message="Thanks for letting us know. Your report has been submitted for review." icon="checkmark-circle-outline" dismissLabel="Got it" onDismiss={reportConfirmation.dismiss}/>
      <DeletePostConfirmSheet title="Delete comment?" message="This comment and any replies underneath it will be permanently removed. This can’t be undone." visible={Boolean(deleteCommentTarget)} busy={Boolean(deletingCommentId)} onConfirm={async () => {
            if (deleteCommentTarget)
                await removeSheetComment(deleteCommentTarget.id);
        }} onDismiss={() => setDeleteCommentTarget(null)}/>
      <DeletePostConfirmSheet visible={Boolean(deletePostTarget)} busy={Boolean(deletingPostId)} onConfirm={async () => {
            if (!deletePostTarget) {
                return;
            }
            await removeOwnPost(deletePostTarget);
        }} onDismiss={() => setDeletePostTarget(null)}/>

      <UiSheetModal visible={Boolean(reportTargetPost)} transparent animationType="none" onDismiss={handleReportDismiss} onRequestClose={closePostReport} motion={uiReport}>
        <Pressable style={styles.reportBackdrop} onPress={closePostReport}>
          <UiSheetBackdrop pointerEvents="none" style={[
            styles.reportBackdropVisual,
            {}
        ]} motion={uiReport}/>

          <UiSheetSurface style={[
            styles.reportSheet,
            {
                paddingBottom: Math.max(18, insets.bottom + 12)
            }
        ]} motion={uiReport}>
            <Pressable onPress={(event) => event.stopPropagation()}>
            <View style={styles.reportHandle}/>

            <View style={styles.reportHeadingRow}>
              <View style={styles.reportHeadingCopy}>
                <Text style={styles.reportTitle}>
                  Report post
                </Text>

                <Text style={styles.reportSubtitle}>
                  Why are you reporting this post?
                </Text>
              </View>

              <Pressable onPress={closePostReport} hitSlop={10} style={({ pressed }) => [
            styles.reportCloseButton,
            pressed &&
                styles.pressed
        ]}>
                <Ionicons name="close" size={21} color={colors.text}/>
              </Pressable>
            </View>

            <View style={styles.reportReasonList}>
              {POST_REPORT_REASONS.map((reason) => (<Pressable key={reason.value} disabled={reportSubmitting} onPress={() => handlePostReport(reason.value)} style={({ pressed }) => [
                styles.reportReasonButton,
                pressed &&
                    styles.reportReasonButtonPressed
            ]}>
                    <View style={styles.reportReasonIcon}>
                      <Ionicons name={reason.icon} size={18} color={colors.gold}/>
                    </View>

                    <Text style={styles.reportReasonText}>
                      {reason.label}
                    </Text>

                    <Ionicons name="chevron-forward" size={17} color={colors.mutedText}/>
                  </Pressable>))}
            </View>

            <Text style={styles.reportPrivacyText}>
              Reports are private. The post author won’t be told who reported them.
            </Text>

            {reportSubmitting ? (<View style={styles.reportSubmitting}>
                <ActivityIndicator size="small" color={colors.gold}/>
              </View>) : null}
            </Pressable>
          </UiSheetSurface>
        </Pressable>
      </UiSheetModal>

      <CommentsWindowOverlay visible={commentsModalVisible} onShow={() => { commentsOverlayRoot.current?.setNativeProps({ style: { opacity: 1 } }); animateCommentsSheetIn(commentsContinuation.onShow()); }} onDismiss={handleCommentsModalDismiss} onRequestClose={closeCommentsSheet}>
        <View ref={commentsOverlayRoot} collapsable={false} style={[styles.commentsModalRoot, { opacity: 1 }]}>
          <View style={styles.commentsBackdrop}>
            <Reanimated.View pointerEvents="none" style={[
            styles.commentsBackdropVisual,
            commentsMotion.backdropStyle
        ]}>
              <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill}/>

              <View style={styles.commentsBackdropDim}/>
            </Reanimated.View>

            <Pressable style={styles.commentsBackdropTap} onPress={handleCommentsBackdropPress}/>

            <Reanimated.View pointerEvents="box-none" style={[
            styles.commentsEntranceLayer,
            commentsMotion.entranceStyle
        ]}>
              <Reanimated.View style={[
            styles.commentsSheet,
            commentsMotion.sheetStyle
        ]}>
                <Animated.View style={[
            styles.commentsKeyboardLayer,
            {
                opacity: commentsContentOpacity,
            }
        ]}>
              <GestureDetector gesture={commentsMotion.gestures.header}><View collapsable={false} onTouchStart={handleCommentComposerOutsideTouch} style={styles.commentsDragRegion}>
                <View style={styles.commentsSheetHandle}/>

                <View style={styles.commentsSheetHeader}>
                  <Text style={styles.commentsSheetTitle}>
                    Comments
                  </Text>
                </View>
              </View></GestureDetector>

              <View onTouchStart={handleCommentComposerOutsideTouch} style={styles.commentsMetaRow}>
                  <Text style={styles.commentsIdentityText} numberOfLines={1}>
                    On{' '}
                    <Text style={styles.commentsIdentityName}>
                      {commentsPost
            ?.author_username
            ?.trim()
            ? `@${commentsPost.author_username.trim()}`
            : commentsPost
                ?.author_display_name
                ?.trim() ||
                'Novori Reader'}
                    </Text>
                    {'’s post · '}
                    {commentsPost
            ? formatCommentContextTime(commentsPost.created_at)
            : ''}
                  </Text>

                  <View style={styles.commentsSortWrap}>
                    <Pressable onPress={() => setCommentSort((current) => current ===
            'top'
            ? 'newest'
            : 'top')} accessibilityRole="button" accessibilityLabel={commentSort ===
            'top'
            ? 'Sort comments by newest'
            : 'Sort comments by top'} hitSlop={8} style={({ pressed }) => [
            styles.commentsSortTrigger,
            pressed &&
                styles.pressed
        ]}>
                      <Ionicons name="swap-vertical-outline" size={15} color={colors.mutedText}/>

                      <Text style={styles.commentsSortTriggerText}>
                        {commentSort ===
            'top'
            ? 'Top'
            : 'Newest'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

              <View onTouchStart={handleCommentComposerOutsideTouch} style={styles.commentsListWrap}>
              <GestureDetector gesture={commentsMotion.gestures.left}><View collapsable={false} onTouchStart={handleCommentComposerOutsideTouch} style={[
            styles.commentsSideRail,
            styles.commentsSideRailLeft
        ]}/></GestureDetector>

              <GestureDetector gesture={commentsMotion.gestures.right}><View collapsable={false} onTouchStart={handleCommentComposerOutsideTouch} style={[
            styles.commentsSideRail,
            styles.commentsSideRailRight
        ]}/></GestureDetector>

                {commentsError ? <View style={{ paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 12 }}>{commentsError}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry loading comments" onPress={() => {
                if (commentsPost)
                    void loadCommentsSheet(commentsPost.id, true);
            }}><Text style={{ color: colors.gold, fontFamily: 'Inter_600SemiBold', paddingVertical: 6 }}>Try again</Text></Pressable></View> : null}
                {!commentsInitialLoadReady ? (<View style={styles.commentsLoading}><ActivityIndicator accessibilityLabel="Loading comments" size="small" color={colors.gold}/></View>) : (<Animated.View style={[
                styles.commentsResultLayer,
                {
                    opacity: commentsResultOpacity,
                }
            ]}>
                    {rootComments.length >
                0 ? (<ScrollView ref={commentsListRef} onScroll={event => commentsContinuation.onScroll(event.nativeEvent.contentOffset.y)} scrollEventThrottle={16} onTouchStart={handleCommentComposerOutsideTouch} style={styles.commentsList} contentContainerStyle={styles.commentsListContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always" keyboardDismissMode={Platform.OS ===
                    'ios'
                    ? 'interactive'
                    : 'on-drag'} alwaysBounceVertical>
                        {rootComments.map((comment) => renderSheetComment(comment))}
                      </ScrollView>) : commentsError ? null : (<Animated.View style={[
                    styles.commentsEmpty,
                    {
                        opacity: commentsEmptyOpacity,
                        transform: [
                            {
                                translateY: emptyStateKeyboardTranslateY,
                            }
                        ],
                    }
                ]}>
                        <Ionicons name="chatbubbles-outline" size={25} color={colors.mutedText}/>

                        <Text style={styles.commentsEmptyTitle}>
                          No comments yet
                        </Text>

                        <Text style={styles.commentsEmptyText}>
                          Start the conversation.
                        </Text>
                      </Animated.View>)}
                  </Animated.View>)}
              </View>

              <KeyboardStickyView style={{ zIndex: 70 }} offset={{
            closed: 0,
            opened: 0,
        }}>
                <Animated.View style={[
            styles.commentsComposerWrap,
            {
                paddingBottom: Math.max(insets.bottom +
                    8, 20),
            }
        ]}>
                <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: windowHeight, backgroundColor: colors.background }}/>
                {editingComment ? (<View style={styles.replyingToRow}>
                    <Text style={styles.replyingToText}>
                      Editing comment
                    </Text>

                    <Pressable onPress={cancelCommentEdit} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={colors.mutedText}/>
                    </Pressable>
                  </View>) : replyTarget ? (<ReplyComposerContext name={replyTarget.author_display_name?.trim() || replyTarget.author_username?.trim() || 'reader'} body={replyTarget.body} hideBody={!replyTarget.is_own && !allowExplicitLanguage && containsExplicitLanguage(replyTarget.body) && !isExplicitContentRevealed('comment', replyTarget.id)} onCancel={resetTemporaryCommentComposer}/>) : composerResetting ? (<View pointerEvents="none" style={[
                styles.replyingToRow,
                styles.replyingToRowSpacer
            ]}>
                    <Text style={styles.replyingToText} numberOfLines={1}>
                      Replying to reader
                    </Text>

                    <View style={styles.replyingToSpacerIcon}/>
                  </View>) : null}

                <View style={styles.commentsComposerRow}>
                  {composerProfile
            ?.avatar_url ? (<Image source={{
                uri: moderationMediaUrl(composerProfile.avatar_url),
            }} style={styles.commentsComposerAvatar}/>) : (<View style={styles.commentsComposerAvatarFallback}>
                      <Text style={styles.commentsComposerAvatarText}>
                        {composerAvatarInitial}
                      </Text>
                    </View>)}

                  <View style={styles.commentsComposer}>
                    <TextInput editable={!submittingComment} ref={commentInputRef} value={commentBody} onChangeText={setCommentBody} placeholder={composerResetting
            ? ''
            : editingComment
                ? 'Edit your comment…'
                : replyTarget
                    ? 'Write a reply…'
                    : 'Add a comment…'} placeholderTextColor={colors.mutedText} multiline maxLength={2000} style={styles.commentsInput}/>

                    <Pressable disabled={!canSubmitComment} onPress={() => void submitSheetComment()} style={({ pressed }) => [
            styles.commentsSendButton,
            !canSubmitComment &&
                styles.commentsSendButtonDisabled,
            pressed &&
                canSubmitComment &&
                styles.pressed
        ]}>
                      {submittingComment ? (<ActivityIndicator size="small" color={colors.background}/>) : (<Ionicons name={editingComment
                ? 'checkmark'
                : 'arrow-up'} size={18} color={colors.background}/>)}
                    </Pressable>
                  </View>
                </View>
                </Animated.View>
              </KeyboardStickyView>
                </Animated.View>
              {commentActionTarget ? (<View style={styles.longPressCommentActionModal}>
                  <Pressable style={StyleSheet.absoluteFill} onPress={() => {
                resetTemporaryCommentComposer();
                closeCommentActions();
            }}>
                    <UiSheetBackdrop pointerEvents="none" style={[
                styles.longPressCommentActionBackdrop,
                {}
            ]} motion={uiCommentAction}/>
                  </Pressable>

                  <UiSheetSurface style={[
                styles.longPressCommentActionSheet,
                {}
            ]} motion={uiCommentAction}>
            <View style={styles.longPressCommentActionHandle}/>

            <Text style={styles.longPressCommentActionTitle}>
              {commentActionTarget
                ?.is_own
                ? 'Comment options'
                : commentActionTarget
                    ? `Comment by ${commentActionTarget
                        .author_display_name
                        ?.trim() ||
                        commentActionTarget
                            .author_username
                            ?.trim() ||
                        'Novori Reader'}`
                    : 'Comment options'}
            </Text>

            <Text style={styles.longPressCommentActionHint}>
              Choose an action for this comment.
            </Text>

            <View style={styles.longPressCommentActionList}>
              <Pressable onPress={replyToSelectedComment} style={({ pressed }) => [
                styles.longPressCommentActionRow,
                pressed &&
                    styles.longPressCommentActionRowPressed
            ]}>
                <View style={styles.longPressCommentActionIcon}>
                  <Ionicons name="return-down-forward-outline" size={19} color={colors.gold}/>
                </View>

                <Text style={styles.longPressCommentActionText}>
                  Reply
                </Text>
              </Pressable>

              {commentActionTarget
                ?.is_own ? (<>
                  <View style={styles.longPressCommentActionDivider}/>

                  <Pressable onPress={editSelectedComment} style={({ pressed }) => [
                    styles.longPressCommentActionRow,
                    pressed &&
                        styles.longPressCommentActionRowPressed
                ]}>
                    <View style={styles.longPressCommentActionIcon}>
                      <Ionicons name="create-outline" size={19} color={colors.gold}/>
                    </View>

                    <Text style={styles.longPressCommentActionText}>
                      Edit
                    </Text>
                  </Pressable>

                  <View style={styles.longPressCommentActionDivider}/>

                  <Pressable onPress={deleteSelectedComment} style={({ pressed }) => [
                    styles.longPressCommentActionRow,
                    pressed &&
                        styles.longPressCommentActionRowPressed
                ]}>
                    <View style={[
                    styles.longPressCommentActionIcon,
                    styles.longPressCommentActionDangerIcon
                ]}>
                      <Ionicons name="trash-outline" size={19} color={colors.danger}/>
                    </View>

                    <Text style={[
                    styles.longPressCommentActionText,
                    styles.longPressCommentActionDangerText
                ]}>
                      Delete
                    </Text>
                  </Pressable>
                </>) : (<>
                  <View style={styles.longPressCommentActionDivider}/>

                  <Pressable onPress={reportSelectedComment} style={({ pressed }) => [
                    styles.longPressCommentActionRow,
                    pressed &&
                        styles.longPressCommentActionRowPressed
                ]}>
                    <View style={styles.longPressCommentActionIcon}>
                      <Ionicons name="flag-outline" size={19} color={colors.gold}/>
                    </View>

                    <Text style={styles.longPressCommentActionText}>
                      Report
                    </Text>
                  </Pressable>

                  <View style={styles.longPressCommentActionDivider}/>

                  <Pressable disabled={Boolean(blockingReaderId)} onPress={confirmBlockSelectedReader} style={({ pressed }) => [
                    styles.longPressCommentActionRow,
                    pressed &&
                        styles.longPressCommentActionRowPressed
                ]}>
                    <View style={[
                    styles.longPressCommentActionIcon,
                    styles.longPressCommentActionDangerIcon
                ]}>
                      <Ionicons name="ban-outline" size={19} color={colors.danger}/>
                    </View>

                    <Text style={[
                    styles.longPressCommentActionText,
                    styles.longPressCommentActionDangerText
                ]}>
                      Block reader
                    </Text>
                  </Pressable>
                </>)}
            </View>

            <Pressable onPress={() => closeCommentActions()} style={({ pressed }) => [
                styles.longPressCommentActionCancel,
                pressed &&
                    styles.pressed
            ]}>
              <Text style={styles.longPressCommentActionCancelText}>
                Cancel
              </Text>
            </Pressable>
                  </UiSheetSurface>
                </View>) : null}

              {commentReportTarget ? (<View style={styles.commentReportOverlay}>
                  <Pressable style={StyleSheet.absoluteFill} onPress={closeCommentReport}>
                    <UiSheetBackdrop pointerEvents="none" style={[
                styles.reportBackdropVisual,
                {}
            ]} motion={uiCommentReport}/>
                  </Pressable>

                  <UiSheetSurface style={[
                styles.reportSheet,
                {
                    paddingBottom: Math.max(18, insets.bottom +
                        12)
                }
            ]} motion={uiCommentReport}>
                    <Pressable onPress={(event) => event.stopPropagation()}>
                      <View style={styles.reportHandle}/>

                      <View style={styles.reportHeadingRow}>
                        <View style={styles.reportHeadingCopy}>
                          <Text style={styles.reportTitle}>
                            Report comment
                          </Text>

                          <Text style={styles.reportSubtitle}>
                            Why are you reporting this comment?
                          </Text>
                        </View>

                        <Pressable onPress={closeCommentReport} hitSlop={10} style={({ pressed }) => [
                styles.reportCloseButton,
                pressed &&
                    styles.pressed
            ]}>
                          <Ionicons name="close" size={21} color={colors.text}/>
                        </Pressable>
                      </View>

                      <View style={styles.reportReasonList}>
                        {POST_REPORT_REASONS.map((reason) => (<Pressable key={reason.value} disabled={commentReportSubmitting} onPress={() => void handleCommentReport(reason.value)} style={({ pressed }) => [
                    styles.reportReasonButton,
                    pressed &&
                        styles.reportReasonButtonPressed
                ]}>
                              <View style={styles.reportReasonIcon}>
                                <Ionicons name={reason.icon} size={18} color={colors.gold}/>
                              </View>

                              <Text style={styles.reportReasonText}>
                                {reason.label}
                              </Text>

                              <Ionicons name="chevron-forward" size={17} color={colors.mutedText}/>
                            </Pressable>))}
                      </View>

                      <Text style={styles.reportPrivacyText}>
                        Reports are private. The comment author won’t be told who reported them.
                      </Text>

                      {commentReportSubmitting ? (<View style={styles.reportSubmitting}>
                          <ActivityIndicator size="small" color={colors.gold}/>
                        </View>) : null}
                    </Pressable>
                  </UiSheetSurface>
                </View>) : null}

              </Reanimated.View>
            </Reanimated.View>
          </View>
          {commentWarning ? <ValidationWarningSheet embedded visible title={commentWarning.title} message={commentWarning.message} dismissLabel="Got it" onDismiss={() => setCommentWarning(null)}/> : null}
        </View>
      </CommentsWindowOverlay>

    </>);
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
        stickyHomeHeader: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            minHeight: 36,
            zIndex: 50,
            backgroundColor: colors.background,
        },
        scrollContent: {
            flexGrow: 1,
            paddingTop: 22,
            paddingBottom: 120,
        },
        content: {
            width: '100%',
            maxWidth: '100%',
            alignSelf: 'center',
            paddingHorizontal: 20,
        },
        topRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
        },
        brandBlock: {
            flex: 1,
            marginTop: 2,
        },
        logo: {
            color: colors.gold,
            fontSize: 43,
            fontFamily: 'PlayfairDisplay_700Bold',
            letterSpacing: 0.2,
        },
        slogan: {
            color: colors.secondaryText,
            fontFamily: 'Inter_500Medium',
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
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
        },
        notificationBadge: {
            position: 'absolute',
            top: -4,
            right: -5,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 4,
            backgroundColor: colors.gold,
            borderWidth: 2,
            borderColor: colors.background,
            alignItems: 'center',
            justifyContent: 'center',
        },
        notificationBadgeText: {
            color: colors.background,
            fontSize: 9,
            fontFamily: 'Inter_700Bold',
            lineHeight: 12,
        },
        sectionSwitch: {
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
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
            alignItems: 'center',
            justifyContent: 'center',
        },
        sectionSwitchButtonActive: {
            backgroundColor: colors.elevated,
        },
        sectionSwitchText: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
        },
        sectionSwitchTextActive: {
            color: colors.gold,
        },
        feedCard: {
            backgroundColor: colors.surface,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 21,
        },
        eyebrow: {
            color: colors.softGold,
            fontSize: 11,
            fontFamily: 'Inter_700Bold',
            letterSpacing: 1.4,
            marginBottom: 11,
        },
        cardTitle: {
            color: colors.text,
            fontSize: 24,
            fontFamily: 'PlayfairDisplay_600SemiBold',
            lineHeight: 31,
        },
        cardText: {
            color: colors.secondaryText,
            fontSize: 15,
            fontFamily: 'Inter_400Regular',
            lineHeight: 23,
            marginTop: 12,
        },
        clubSearchWrap: {
            minHeight: 48,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 15,
            paddingHorizontal: 13,
            gap: 9,
        },
        clubSearchInput: {
            flex: 1,
            color: colors.text,
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            paddingVertical: 0,
        },
        clubSearchClear: {
            width: 28,
            height: 28,
            alignItems: 'center',
            justifyContent: 'center',
        },
        clubSearchHint: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
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
            alignItems: 'center',
            justifyContent: 'center',
        },
        searchEmpty: {
            minHeight: 150,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 17,
            paddingHorizontal: 24,
            marginTop: 13,
        },
        searchEmptyTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
            marginTop: 9,
        },
        searchEmptyText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            lineHeight: 16,
            textAlign: 'center',
            marginTop: 4,
        },
        feedLoading: {
            minHeight: 220,
            alignItems: 'center',
            justifyContent: 'center',
        },
        feedList: {
            gap: 14,
        },
        feedHeadingRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 14,
            marginBottom: 2,
        },
        feedHeadingCopy: {
            flex: 1,
            minWidth: 0,
        },
        feedComposeButton: {
            minHeight: 44,
            paddingHorizontal: 16,
            flexShrink: 0,
            borderRadius: 12,
            backgroundColor: colors.gold,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
        },
        feedComposeButtonText: {
            color: colors.background,
            fontFamily: 'Inter_700Bold',
            fontSize: 14,
        },
        feedEmptyCard: {
            minHeight: 240,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 18,
            paddingHorizontal: 26,
            paddingVertical: 30,
        },
        feedEmptyIcon: {
            width: 54,
            height: 54,
            borderRadius: 17,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
        },
        feedEmptyTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 21,
            textAlign: 'center',
            marginTop: 9,
        },
        feedEmptyText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            lineHeight: 18,
            textAlign: 'center',
            maxWidth: 430,
            marginTop: 7,
        },
        feedActionButton: {
            minHeight: 40,
            borderRadius: 12,
            backgroundColor: colors.gold,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            paddingHorizontal: 14,
            marginTop: 16,
        },
        feedActionButtonText: {
            color: colors.background,
            fontFamily: 'Inter_700Bold',
            fontSize: 12,
        },
        feedPostCard: {
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
        feedPostCardPressed: {
            opacity: 0.95,
            transform: [
                {
                    scale: 0.998,
                }
            ],
        },
        feedPostHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingHorizontal: 16,
            paddingTop: 15,
        },
        feedHeaderActions: {
            flexDirection: 'row',
            alignItems: 'center',
            marginLeft: 4,
            marginTop: -2,
        },
        feedMoreButton: {
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 4,
            marginTop: -2,
        },
        feedAvatar: {
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            marginRight: 12,
        },
        feedAvatarFallback: {
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
        feedAvatarText: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 18,
        },
        feedAuthorCopy: {
            flex: 1,
            minWidth: 0,
            paddingTop: 2,
        },
        feedAuthorLine: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'nowrap',
            columnGap: 6,
            minWidth: 0,
        },
        feedIdentity: {
            flexDirection: 'row',
            alignItems: 'center',
            columnGap: 6,
            flexShrink: 1,
            minWidth: 0,
        },
        feedAuthorName: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 13.5,
            flexShrink: 0,
        },
        feedUsername: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11.5,
            flex: 1,
            flexShrink: 1,
            minWidth: 0,
        },
        feedTime: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10.5,
        },
        feedAudienceText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10.5,
            marginTop: 5,
        },
        feedClubLine: {
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 5,
            maxWidth: '100%',
        },
        feedClubIcon: {
            width: 18,
            height: 18,
            borderRadius: 6,
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
        },
        feedClubIconFallback: {
            width: 18,
            height: 18,
            borderRadius: 6,
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        feedClubIconText: {
            color: colors.gold,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 8,
        },
        feedClubText: {
            color: colors.softGold,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10.5,
            flexShrink: 1,
        },
        feedPostContent: {
            paddingHorizontal: 16,
            paddingTop: 14,
        },
        feedBody: {
            color: colors.text,
            fontFamily: 'Inter_400Regular',
            fontSize: 15,
            lineHeight: 22,
        },
        feedQuestionTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_600SemiBold',
            fontSize: 19,
            lineHeight: 26,
        },
        feedQuestionContextWrap: {
            marginTop: 8,
        },
        feedQuestionContext: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            lineHeight: 21,
        },
        feedCompactBookLink: {
            minHeight: 42,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 7,
            paddingHorizontal: 2,
            paddingVertical: 7,
        },
        feedCompactBookCopy: {
            flex: 1,
            minWidth: 0,
        },
        feedCompactBookTitle: {
            color: colors.gold,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12.5,
        },
        feedCompactBookMeta: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10.5,
            fontStyle: 'italic',
            marginTop: 2,
        },
        feedBookCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            padding: 11,
            marginTop: 15,
        },
        feedBookCover: {
            width: 52,
            height: 76,
            borderRadius: 8,
            backgroundColor: colors.surface,
            marginRight: 12,
        },
        feedBookCoverFallback: {
            width: 52,
            height: 76,
            borderRadius: 8,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        feedBookCopy: {
            flex: 1,
            minWidth: 0,
            paddingRight: 8,
        },
        feedBookEyebrow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginBottom: 5,
        },
        feedBookEyebrowText: {
            color: colors.gold,
            fontFamily: 'Inter_700Bold',
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
        },
        feedBookTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
            lineHeight: 18,
        },
        feedBookAuthor: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10.5,
            marginTop: 4,
        },
        feedBookRatingRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 7,
        },
        feedBookRating: {
            color: colors.gold,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11.5,
        },
        feedPostFooter: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginTop: 15,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 14,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        voteControl: {
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 36,
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 18,
            paddingHorizontal: 4,
        },
        voteButton: {
            width: 30,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
        },
        voteButtonActive: {
            backgroundColor: colors.surface,
        },
        voteButtonDisabled: {
            opacity: 0.5,
        },
        voteScore: {
            minWidth: 20,
            textAlign: 'center',
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12,
        },
        voteScoreActive: {
            color: colors.gold,
        },
        commentAction: {
            minHeight: 36,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 18,
            paddingHorizontal: 12,
        },
        commentActionText: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11,
        },
        clubsLoading: {
            minHeight: 220,
            alignItems: 'center',
            justifyContent: 'center',
        },
        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 14,
        },
        sectionTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 21,
        },
        sectionSubtitle: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            lineHeight: 18,
            marginTop: 3,
        },
        createClubButton: {
            minHeight: 37,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: colors.gold,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
        },
        createClubButtonText: {
            color: colors.background,
            fontFamily: 'Inter_700Bold',
            fontSize: 12,
        },
        clubList: {
            gap: 10,
            marginTop: 13,
        },
        compactClubCard: {
            minHeight: 76,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            padding: 11,
        },
        clubCard: {
            minHeight: 104,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 17,
            padding: 12,
        },
        compactClubImage: {
            width: 52,
            height: 52,
            borderRadius: 14,
            backgroundColor: colors.elevated,
            marginRight: 12,
        },
        compactClubImageFallback: {
            width: 52,
            height: 52,
            borderRadius: 14,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        compactClubInitial: {
            color: colors.gold,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 23,
        },
        clubImage: {
            width: 66,
            height: 66,
            borderRadius: 16,
            backgroundColor: colors.elevated,
            marginRight: 13,
        },
        clubImageFallback: {
            width: 66,
            height: 66,
            borderRadius: 16,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 13,
        },
        clubInitial: {
            color: colors.gold,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 28,
        },
        clubCardCopy: {
            flex: 1,
            minWidth: 0,
            paddingRight: 8,
        },
        clubMetaRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        clubMetaText: {
            color: colors.mutedText,
            fontFamily: 'Inter_500Medium',
            fontSize: 10,
        },
        clubMetaDot: {
            color: colors.mutedText,
            fontSize: 9,
        },
        clubName: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 15,
            marginTop: 4,
        },
        clubDescription: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            lineHeight: 17,
            marginTop: 4,
        },
        clubGenreRow: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 5,
            marginTop: 6,
        },
        clubGenreBadge: {
            backgroundColor: colors.elevated,
            borderRadius: 8,
            paddingHorizontal: 7,
            paddingVertical: 3,
        },
        clubGenreBadgeText: {
            color: colors.softGold,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 9,
        },
        clubGenreMore: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 9,
        },
        membershipBadge: {
            alignSelf: 'flex-start',
            backgroundColor: colors.elevated,
            borderRadius: 9,
            paddingHorizontal: 7,
            paddingVertical: 3,
            marginTop: 5,
        },
        membershipBadgeText: {
            color: colors.softGold,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 9,
        },
        emptyClubsCard: {
            minHeight: 96,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 17,
            padding: 14,
            marginTop: 13,
        },
        emptyClubsIcon: {
            width: 46,
            height: 46,
            borderRadius: 14,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        emptyClubsCopy: {
            flex: 1,
            paddingRight: 8,
        },
        emptyClubsTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
        },
        emptyClubsText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            lineHeight: 16,
            marginTop: 3,
        },
        discoverHeader: {
            marginTop: 30,
        },
        clubGenreFilterScroll: {
            marginTop: 12,
            marginHorizontal: -20,
        },
        clubGenreFilterRow: {
            paddingHorizontal: 20,
            gap: 8,
        },
        clubGenreFilterChip: {
            minHeight: 34,
            borderRadius: 17,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        clubGenreFilterChipActive: {
            borderColor: colors.gold,
            backgroundColor: colors.elevated,
        },
        clubGenreFilterText: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10,
        },
        clubGenreFilterTextActive: {
            color: colors.gold,
        },
        discoverEmpty: {
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 17,
            paddingHorizontal: 24,
            paddingVertical: 28,
            marginTop: 13,
        },
        discoverEmptyTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
            marginTop: 10,
        },
        discoverEmptyText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            lineHeight: 16,
            textAlign: 'center',
            marginTop: 4,
        },
        ownPostOptionsBackdrop: {
            flex: 1,
            backgroundColor: 'transparent',
            justifyContent: 'flex-end',
        },
        ownPostOptionsBackdropVisual: {
            ...StyleSheet.absoluteFill,
            backgroundColor: 'rgba(0,0,0,0.48)',
        },
        ownPostOptionsSheet: {
            width: '100%',
            alignSelf: 'center',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 18,
            overflow: 'hidden',
        },
        ownPostOptionsHandle: {
            width: 42,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: 'center',
            marginBottom: 16,
        },
        ownPostOptionsHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 14,
            paddingHorizontal: 2,
        },
        ownPostOptionsHeaderIcon: {
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 11,
        },
        ownPostOptionsHeaderCopy: {
            flex: 1,
        },
        ownPostOptionsTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 20,
        },
        ownPostOptionsSubtitle: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            marginTop: 2,
        },
        ownPostOptionsList: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: colors.background,
        },
        ownPostOptionsRow: {
            minHeight: 66,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 13,
            paddingVertical: 10,
            backgroundColor: colors.background,
        },
        ownPostOptionsRowPressed: {
            backgroundColor: colors.elevated,
        },
        ownPostOptionsRowIcon: {
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        ownPostOptionsDangerIcon: {
            backgroundColor: 'rgba(220, 80, 80, 0.10)',
        },
        ownPostOptionsRowCopy: {
            flex: 1,
            paddingRight: 10,
        },
        ownPostOptionsRowTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
        },
        ownPostOptionsDangerTitle: {
            color: colors.danger,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
        },
        ownPostOptionsRowSubtitle: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            lineHeight: 16,
            marginTop: 2,
        },
        ownPostOptionsDivider: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.border,
            marginLeft: 61,
        },
        ownPostOptionsHint: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10,
            textAlign: 'center',
            marginTop: 11,
        },
        commentReportOverlay: {
            ...StyleSheet.absoluteFill,
            zIndex: 200,
            justifyContent: 'flex-end',
            overflow: 'hidden',
        },
        explicitContentWrap: {
            position: 'relative',
            minHeight: 142,
            overflow: 'hidden',
            borderRadius: 16,
            marginTop: 4,
        },
        explicitContentSource: {
            opacity: 0.38,
        },
        explicitWarningCard: {
            ...StyleSheet.absoluteFill,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 18,
            paddingVertical: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        explicitWarningHeading: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
        },
        explicitWarningTitle: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 14,
            lineHeight: 19,
        },
        explicitWarningText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            lineHeight: 17,
            marginTop: 5,
            textAlign: 'center',
        },
        explicitWarningActions: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginTop: 12,
        },
        explicitWarningButton: {
            minHeight: 42,
            minWidth: 108,
            paddingHorizontal: 18,
            borderRadius: 21,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
        },
        explicitWarningButtonPrimary: {
            backgroundColor: colors.gold,
            borderColor: colors.gold,
        },
        explicitWarningButtonText: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12,
        },
        explicitWarningButtonPrimaryText: {
            color: colors.background,
        },
        reportBackdrop: {
            flex: 1,
            backgroundColor: 'transparent',
            justifyContent: 'flex-end',
        },
        reportBackdropVisual: {
            ...StyleSheet.absoluteFill,
            backgroundColor: 'rgba(0,0,0,0.52)',
        },
        reportSheet: {
            width: '100%',
            alignSelf: 'center',
            backgroundColor: colors.surface,
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
            backgroundColor: colors.border,
            alignSelf: 'center',
            marginBottom: 13,
        },
        reportHeadingRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            marginBottom: 14,
        },
        reportHeadingCopy: {
            flex: 1,
            paddingRight: 10,
        },
        reportTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 20,
        },
        reportSubtitle: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            marginTop: 3,
        },
        reportCloseButton: {
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
        },
        reportReasonList: {
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
        },
        reportReasonButton: {
            minHeight: 54,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            backgroundColor: colors.background,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        reportReasonButtonPressed: {
            backgroundColor: colors.elevated,
        },
        reportReasonIcon: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 11,
        },
        reportReasonText: {
            flex: 1,
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
        },
        reportPrivacyText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10,
            lineHeight: 15,
            marginTop: 12,
            paddingHorizontal: 3,
        },
        reportSubmitting: {
            ...StyleSheet.absoluteFill,
            backgroundColor: 'rgba(0,0,0,0.28)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        commentsModalRoot: {
            flex: 1,
        },
        commentsBackdrop: {
            flex: 1,
            backgroundColor: 'transparent',
            overflow: 'hidden',
        },
        commentsBackdropVisual: {
            ...StyleSheet.absoluteFill,
        },
        commentsBackdropDim: {
            ...StyleSheet.absoluteFill,
            backgroundColor: 'rgba(0, 0, 0, 0.42)',
        },
        commentsBackdropTap: {
            ...StyleSheet.absoluteFill,
            backgroundColor: 'transparent',
        },
        commentsEntranceLayer: {
            ...StyleSheet.absoluteFill,
            justifyContent: 'flex-end',
        },
        commentsSheet: {
            width: '100%',
            maxWidth: 720,
            alignSelf: 'center',
        },
        commentsKeyboardLayer: {
            flex: 1,
            backgroundColor: colors.background,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            overflow: 'hidden',
        },
        commentsDragRegion: {
            zIndex: 20,
            minHeight: 66,
            backgroundColor: colors.background,
            paddingBottom: 7,
        },
        commentsSheetHandle: {
            alignSelf: 'center',
            width: 38,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            marginTop: 9,
            marginBottom: 5,
        },
        commentsSheetHeader: {
            minHeight: 38,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 18,
        },
        commentsSheetTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 20,
            textAlign: 'center',
        },
        commentsMetaRow: {
            minHeight: 42,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 18,
            gap: 12,
        },
        commentsIdentityText: {
            flex: 1,
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            lineHeight: 20,
        },
        commentsIdentityName: {
            color: colors.secondaryText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14.5,
        },
        commentsSortWrap: {
            position: 'relative',
            zIndex: 40,
        },
        commentsSortTrigger: {
            minHeight: 32,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingLeft: 8,
            paddingRight: 5,
        },
        commentsSortTriggerText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11.5,
        },
        commentsSortMenu: {
            position: 'absolute',
            top: 34,
            right: 0,
            width: 202,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.elevated,
            shadowColor: '#000000',
            shadowOpacity: 0.18,
            shadowRadius: 14,
            shadowOffset: {
                width: 0,
                height: 6,
            },
            elevation: 8,
            overflow: 'hidden',
        },
        commentsSortMenuItem: {
            minHeight: 58,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 9,
        },
        commentsSortMenuItemPressed: {
            opacity: 0.72,
        },
        commentsSortMenuCheck: {
            width: 23,
            alignItems: 'flex-start',
        },
        commentsSortMenuCopy: {
            flex: 1,
        },
        commentsSortMenuTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12,
        },
        commentsSortMenuSubtitle: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 9.5,
            marginTop: 2,
        },
        commentsSortMenuDivider: {
            height: StyleSheet.hairlineWidth,
            marginLeft: 35,
            backgroundColor: colors.border,
        },
        commentsSideRail: {
            position: 'absolute',
            top: 0,
            bottom: 0,
            zIndex: 60,
            backgroundColor: 'transparent',
        },
        commentsSideRailLeft: {
            left: 0,
            width: 38,
        },
        commentsSideRailRight: {
            right: 0,
            width: 38,
        },
        commentsListWrap: {
            overflow: 'hidden',
            flex: 1,
            minHeight: 0,
        },
        commentsResultLayer: {
            flex: 1,
            minHeight: 0,
        },
        commentsList: {
            flex: 1,
        },
        commentsListContent: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, gap: 2,
        },
        commentsLoading: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        commentsEmpty: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 28,
        },
        commentsEmptyTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
            marginTop: 8,
        },
        commentsEmptyText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            marginTop: 3,
        },
        continueSheetConversation: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 23, paddingVertical: 5 },
        continueSheetConversationText: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 11, flexShrink: 1 },
        sheetCommentThread: { gap: 1,
        },
        sheetComment: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4,
        },
        sheetCommentActionAccent: {
            position: 'absolute',
            left: 29,
            top: 7,
            bottom: 7,
            width: 3,
            borderRadius: 2,
            backgroundColor: colors.gold,
            zIndex: 2,
        },
        commentHoldTarget: {
            alignSelf: 'stretch',
            borderRadius: 10,
        },
        sheetCommentPressed: {
            backgroundColor: colors.elevated,
        },
        sheetCommentAvatarButton: {
            marginRight: 9,
        },
        sheetCommentAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.elevated,
        },
        sheetCommentAvatarFallback: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center',
        },
        sheetCommentAvatarText: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 10,
        },
        sheetCommentCopy: {
            flex: 1,
            minWidth: 0,
        },
        sheetCommentIdentity: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            minWidth: 0,
        },
        sheetCommentNameButton: {
            flexShrink: 1,
            minHeight: 24,
            justifyContent: 'center',
        },
        sheetCommentName: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 13,
            flexShrink: 1,
        },
        sheetCommentUsername: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11.5,
            flexShrink: 1,
        },
        sheetCommentTime: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10.5,
            flexShrink: 0,
        },
        sheetCommentBody: {
            color: colors.text,
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            lineHeight: 20,
            marginTop: 3,
        },
        sheetCommentActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 3,
        },
        commentVoteControl: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 0,
        },
        commentVoteButton: {
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        commentVoteButtonActive: {
            backgroundColor: colors.elevated,
        },
        commentVoteScore: {
            minWidth: 18,
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12,
            textAlign: 'center',
        },
        commentVoteScoreActive: {
            color: colors.gold,
        },
        sheetReplyButton: {
            minHeight: 28,
            justifyContent: 'center',
        },
        sheetReplyText: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12.5,
        },
        sheetDeleteButton: {
            minHeight: 22,
            justifyContent: 'center',
        },
        sheetDeleteText: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10.5,
        },
        sheetReportButton: {
            minHeight: 28,
            alignItems: 'center',
            justifyContent: 'center',
        },
        sheetReportText: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12.5,
        },
        sheetReplies: { gap: 2,
        },
        viewMoreRepliesButton: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 7, marginLeft: 23,
        },
        replyGuide: {
            width: 20,
            height: 1,
            backgroundColor: colors.border,
        },
        viewMoreRepliesText: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 11,
        },
        commentsComposerWrap: {
            backgroundColor: colors.background,
            paddingHorizontal: 14,
            paddingTop: 11,
        },
        commentsComposerRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
        },
        commentsComposerAvatar: {
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: colors.elevated,
            marginBottom: 5,
        },
        commentsComposerAvatarFallback: {
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 5,
        },
        commentsComposerAvatarText: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 16,
        },
        replyingToRow: {
            minHeight: 24,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 4,
            paddingBottom: 5,
        },
        replyingToText: {
            flex: 1,
            color: colors.mutedText,
            fontFamily: 'Inter_500Medium',
            fontSize: 9,
            marginRight: 8,
        },
        replyingToRowSpacer: {
            opacity: 0,
        },
        replyingToSpacerIcon: {
            width: 18,
            height: 18,
        },
        commentsComposer: {
            flex: 1,
            minHeight: 52,
            maxHeight: 122,
            flexDirection: 'row',
            alignItems: 'flex-end',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 20,
            paddingLeft: 14,
            paddingRight: 5,
            paddingVertical: 5,
        },
        commentsInput: {
            flex: 1,
            minHeight: 40,
            maxHeight: 108,
            color: colors.text,
            fontFamily: 'Inter_400Regular',
            fontSize: 15,
            lineHeight: 20,
            paddingTop: 10,
            paddingBottom: 9,
            paddingRight: 8,
        },
        commentsSendButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.gold,
            alignItems: 'center',
            justifyContent: 'center',
        },
        commentsSendButtonDisabled: {
            opacity: 0.35,
        },
        pressed: {
            opacity: 0.68,
        },
        longPressCommentActionModal: {
            ...StyleSheet.absoluteFill,
            justifyContent: 'flex-end',
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            overflow: 'hidden',
            zIndex: 80,
            elevation: 80,
        },
        longPressCommentActionBackdrop: {
            ...StyleSheet.absoluteFill,
            backgroundColor: 'rgba(0,0,0,0.42)',
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
        },
        longPressCommentActionSheet: {
            width: '100%',
            maxWidth: '100%',
            alignSelf: 'center',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 24,
            borderWidth: 1,
            borderColor: colors.border,
        },
        longPressCommentActionHandle: {
            width: 42,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: 'center',
            marginBottom: 15,
        },
        longPressCommentActionTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 20,
            textAlign: 'center',
        },
        longPressCommentActionHint: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            textAlign: 'center',
            marginTop: 4,
            marginBottom: 14,
        },
        longPressCommentActionList: {
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
        },
        longPressCommentActionRow: {
            minHeight: 58,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 13,
            backgroundColor: colors.background,
        },
        longPressCommentActionRowPressed: {
            backgroundColor: colors.elevated,
        },
        longPressCommentActionIcon: {
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        longPressCommentActionDangerIcon: {
            backgroundColor: 'rgba(220,80,80,0.10)',
        },
        longPressCommentActionText: {
            flex: 1,
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
        },
        longPressCommentActionDangerText: {
            color: colors.danger,
        },
        longPressCommentActionDivider: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.border,
            marginLeft: 61,
        },
        longPressCommentActionCancel: {
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 12,
            borderRadius: 14,
            backgroundColor: colors.elevated,
        },
        longPressCommentActionCancelText: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
        },
    });
}
