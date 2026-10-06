import { useReportConfirmation } from '../../lib/use-report-confirmation';
import ValidationWarningSheet from '../../components/ValidationWarningSheet';
import { moderationMediaUrl } from '../../lib/moderation-media-url';
import { useUiSheetMotion, UiSheetSurface, UiSheetBackdrop } from '../../components/UiSheet';
import { openCommentConversation } from '../../lib/open-comment-conversation';
import { conversationDestinationLaidOut } from '../../lib/conversation-handoff';
import CommentBranchGuide from '../../components/CommentBranchGuide';
import { getSessionReadScope, isTransientReadError } from '../../lib/session-read-cache';
import DeletePostConfirmSheet from '../../components/DeletePostConfirmSheet';
import ReplyComposerContext from '../../components/ReplyComposerContext';
import { COMMENT_REPLY_BATCH_SIZE, getCommentBranchIds, buildCommentThreads, getCommentDepthLimit, getFocusedConversationId, countThreadReplies, type CommentThread } from '../../lib/comment-conversations';
import ClubEventPostAttachment from '../../components/ClubEventPostAttachment';
import ClubDiscussionPostAttachment from '../../components/ClubDiscussionPostAttachment';
import { discussionRevealKey } from '../../lib/club-discussion';
import BookCoverImage from '../../components/BookCoverImage';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import ReadingRecapPostAttachment from '../../components/ReadingRecapPostAttachment';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, Keyboard, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import BlockReaderConfirmSheet from '../../components/BlockReaderConfirmSheet';
import BookStackPostAttachment from '../../components/BookStackPostAttachment';
import CanonicalBookRating from '../../components/CanonicalBookRating';
import PostTypeIdentifier from '../../components/PostTypeIdentifier';
import { NovoriColors } from '../../constants/novori-theme';
import { useNovoriTheme } from '../../context/theme-context';
import { CommentVoteValue, createPostComment, deletePostComment, getPostComments, PostComment, toggleCommentVote, updatePostComment } from '../../lib/comments';
import { containsExplicitLanguage, getExplicitLanguagePreference, isExplicitContentRevealed, revealExplicitContentOnce, setExplicitLanguagePreference } from '../../lib/content-filter';
import { FeedPost, getPostDetail, PostVoteValue, splitQuestionPostBody, togglePostVote } from '../../lib/feed';
import { ReportReason, submitCommentReport } from '../../lib/reports';
import { blockReader } from '../../lib/social';
import { sharePostLink } from '../../lib/share-links';
type ThreadComment = CommentThread;
type ReplyTarget = {
    id: string;
    name: string;
};
const COMMENT_REPORT_REASONS: Array<{
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
function formatRelativeTime(value: string) {
    const difference = Date.now() -
        new Date(value).getTime();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (difference <
        minute) {
        return 'now';
    }
    if (difference <
        hour) {
        return `${Math.max(1, Math.floor(difference /
            minute))}m`;
    }
    if (difference <
        day) {
        return `${Math.floor(difference /
            hour)}h`;
    }
    if (difference <
        7 * day) {
        return `${Math.floor(difference /
            day)}d`;
    }
    return new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
}
export default function PostDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        id?: string;
        commentId?: string;
        threadId?: string;
    }>();
    const postId = typeof params.id ===
        'string'
        ? params.id
        : '';
    const targetCommentId = typeof params.commentId ===
        'string'
        ? params.commentId
        : '';
    const { colors, } = useNovoriTheme();
    const styles = createStyles(colors);
    const [post, setPost,] = useState<FeedPost | null>(null);
    const [comments, setComments,] = useState<PostComment[]>([]);
    const [revealedDiscussion, setRevealedDiscussion] = useState('');
    const discussionSpoilersHidden = Boolean(post?.club_discussion?.contains_spoilers && revealedDiscussion !== discussionRevealKey(post.club_discussion));
    const [currentUserId, setCurrentUserId,] = useState<string | null>(null);
    const [allowExplicitLanguage, setAllowExplicitLanguage,] = useState(false);
    const [revealedExplicitPosts, setRevealedExplicitPosts,] = useState<Record<string, boolean>>({});
    const [revealedExplicitComments, setRevealedExplicitComments,] = useState<Record<string, boolean>>({});
    const [loading, setLoading,] = useState(true);
    const [refreshing, setRefreshing,] = useState(false);
    const [error, setError,] = useState('');
    const [voting, setVoting,] = useState(false);
    const [commentBody, setCommentBody,] = useState('');
    const [composerResetting, setComposerResetting,] = useState(false);
    const [replyResetting, setReplyResetting,] = useState(false);
    const [replyTo, setReplyTo,] = useState<ReplyTarget | null>(null);
    const [commentActionTarget, setCommentActionTarget,] = useState<ThreadComment | null>(null);
    const [blockConfirmTarget, setBlockConfirmTarget,] = useState<ThreadComment | null>(null);
    const [holdingCommentId, setHoldingCommentId,] = useState<string | null>(null);
    const commentSelectionAccentOpacity = useRef(new Animated.Value(0)).current;
    const commentActionSheetHeight = useRef(0);
    const commentActionEntranceStarted = useRef(false);
    const commentActionClosing = useRef(false);
    const pendingCommentActionHandoff = useRef<(() => void) | null>(null);
    const [editingComment, setEditingComment,] = useState<ThreadComment | null>(null);
    const [commentReportTarget, setCommentReportTarget,] = useState<ThreadComment | null>(null);
    const [commentReportSubmitting, setCommentReportSubmitting,] = useState(false);
    const [blockingReaderId, setBlockingReaderId,] = useState<string | null>(null);
    const blockNavigateBackAfterDismiss = useRef(false);
    const [submitting, setSubmitting,] = useState(false);
    const [deletingCommentId, setDeletingCommentId,] = useState<string | null>(null);
    const [commentSort, setCommentSort,] = useState<'top' | 'newest'>('top');
    const [votingCommentIds, setVotingCommentIds,] = useState<Record<string, boolean>>({});
    const [highlightedCommentId, setHighlightedCommentId,] = useState<string | null>(null);
    const scrollRef = useRef<ScrollView>(null);
    const commentInputRef = useRef<TextInput>(null);
    const scrollYRef = useRef(0);
    const commentRefs = useRef<Record<string, View | null>>({});
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
        const hide = Keyboard.addListener('keyboardDidHide', () => {
            setComposerResetting(false);
            setReplyResetting(false);
        });
        return () => {
            hide.remove();
        };
    }, []);
    const loadSequence = useRef(0);
    const viewPostId = useRef(postId);
    viewPostId.current = postId;
    const mounted = useRef(true);
    const commentsState = useRef(comments);
    commentsState.current = comments;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const loadedPostId = useRef('');
    const commentSubmitInFlight = useRef(false);
    const [loadWarning, setLoadWarning] = useState('');
    const loadData = useCallback(async (showLoader = true, force = false) => {
        const request = ++loadSequence.current;
        if (!postId) {
            setError('This post could not be found.');
            setLoading(false);
            return;
        }
        if (showLoader && loadedPostId.current !== postId)
            setLoading(true);
        setError('');
        setLoadWarning('');
        setAllowExplicitLanguage(false);
        // A preference is optional, fail-closed UI data. Never hold the thread spinner for it.
        void getExplicitLanguagePreference().then(value => {
            if (request === loadSequence.current)
                setAllowExplicitLanguage(value);
        }).catch(preferenceError => {
            if (request === loadSequence.current)
                setAllowExplicitLanguage(false);
            if (!isTransientReadError(preferenceError))
                console.warn('Could not load explicit-language preference:', preferenceError);
        });
        try {
            const [postData, commentData, scope] = await Promise.all([
                getPostDetail(postId, { force }), getPostComments(postId, 500, { force }), getSessionReadScope()
            ]);
            if (request !== loadSequence.current)
                return;
            setPost(postData);
            setComments(commentData);
            setCurrentUserId(scope.userId);
            loadedPostId.current = postId;
        }
        catch (loadError) {
            if (request !== loadSequence.current)
                return;
            if (isTransientReadError(loadError)) {
                if (loadedPostId.current === postId)
                    setLoadWarning('Could not refresh the conversation. Check your connection and try again.');
                else
                    setError('Could not load this thread. Check your connection and try again.');
            }
            else {
                console.warn('Could not load post thread:', loadError);
                setError('This post is unavailable or you no longer have access to it.');
            }
        }
        finally {
            if (request === loadSequence.current)
                setLoading(false);
        }
    }, [postId]);
    useFocusEffect(useCallback(() => {
        void loadData(true);
        return () => { loadSequence.current += 1; };
    }, [loadData]));
    useEffect(() => {
        if (!targetCommentId ||
            !comments.some((comment) => comment.id ===
                targetCommentId)) {
            return;
        }
        setHighlightedCommentId(targetCommentId);
        const highlightTimer = setTimeout(() => {
            setHighlightedCommentId((current) => current ===
                targetCommentId
                ? null
                : current);
        }, 2400);
        return () => {
            clearTimeout(highlightTimer);
        };
    }, [
        targetCommentId,
        comments,
        commentSort,
        discussionSpoilersHidden
    ]);
    const { height: windowHeight } = useWindowDimensions();
    const [commentAreaWidth, setCommentAreaWidth] = useState(360);
    const commentDepthLimit = getCommentDepthLimit(commentAreaWidth);
    const requestedThreadId = typeof params.threadId === 'string' ? params.threadId : '';
    const threadData = useMemo(() => buildCommentThreads(comments, commentSort), [comments, commentSort]);
    const focusedThreadId = getFocusedConversationId(comments, requestedThreadId, targetCommentId, commentDepthLimit);
    const focusedThread = threadData.nodes.get(focusedThreadId);
    const [deleteCommentTarget, setDeleteCommentTarget] = useState<ThreadComment | null>(null);
    const [visibleReplyCounts, setVisibleReplyCounts] = useState<Record<string, number>>({});
    const thread = focusedThreadId ? (focusedThread ? [focusedThread] : []) : threadData.roots;
    const activeReplyTarget = replyTo;
    const activeReplyComment = activeReplyTarget ? threadData.nodes.get(activeReplyTarget.id) : null;
    function openConversation(commentId: string) { openCommentConversation(destination => router.push(destination), postId, commentId); }
    async function refresh() {
        if (commentSubmitInFlight.current)
            return;
        try {
            setRefreshing(true);
            await loadData(false, true);
        }
        finally {
            setRefreshing(false);
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
    function openClub(clubId: string) {
        router.push({
            pathname: '/club/[id]',
            params: {
                id: clubId,
            },
        });
    }
    async function shareCurrentPost() {
        if (!post) {
            return;
        }
        try {
            await sharePostLink(post.id);
        }
        catch (shareError) {
            console.error('Could not share post:', shareError);
            Alert.alert('Could not share post', 'Please try again.');
        }
    }
    async function handleVote(voteValue: PostVoteValue) {
        if (!post ||
            voting) {
            return;
        }
        try {
            setVoting(true);
            const nextVote = await togglePostVote(post.id, voteValue);
            setPost((current) => current
                ? {
                    ...current,
                    ...nextVote,
                }
                : current);
        }
        catch (voteError) {
            console.error('Could not update post vote:', voteError);
            Alert.alert('Could not vote', 'Please try again.');
        }
        finally {
            setVoting(false);
        }
    }
    async function handleCommentVote(comment: PostComment, voteValue: CommentVoteValue) {
        if (comment.is_deleted || comment.is_blocked_author || comment.id.startsWith('optimistic-'))
            return;
        if (comment.id.startsWith('optimistic-') ||
            votingCommentIds[comment.id]) {
            return;
        }
        loadSequence.current += 1;
        const previous = comment;
        const previousVote = comment.viewer_vote ??
            0;
        const nextVote = previousVote ===
            voteValue
            ? 0
            : voteValue;
        const optimistic: PostComment = {
            ...comment,
            viewer_vote: nextVote,
            vote_score: (comment.vote_score ??
                0) +
                (nextVote -
                    previousVote),
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
        setComments((current) => current.map((item) => item.id ===
            comment.id
            ? optimistic
            : item));
        setVotingCommentIds((current) => ({
            ...current,
            [comment.id]: true,
        }));
        try {
            const result = await toggleCommentVote(comment.id, voteValue);
            setComments((current) => current.map((item) => item.id ===
                comment.id
                ? {
                    ...item,
                    ...result,
                }
                : item));
        }
        catch (voteError) {
            console.error('Could not update comment vote:', voteError);
            setComments((current) => current.map((item) => item.id ===
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
    const [commentWarning, setCommentWarning] = useState<{title: string; message: string} | null>(null);
    function showCommentWarning(error: unknown, fallbackTitle: string) {
        const details = error && typeof error === 'object' ? error as {code?: string; message?: string} : null;
        const message = details?.message || 'Please try again.';
        Keyboard.dismiss();
        setCommentWarning({
            title: details?.code === 'NOVORI_MODERATION' && /review/i.test(message)
                ? 'Submission under review' : fallbackTitle,
            message,
        });
    }
    async function submitComment() {
        if (!post ||
            submitting || commentSubmitInFlight.current || (focusedThreadId && !replyTo && !editingComment)) {
            return;
        }
        const cleaned = commentBody.trim();
        if (!cleaned) {
            return;
        }
        commentSubmitInFlight.current = true;
        loadSequence.current += 1;
        const writePostId = post.id;
        if (editingComment) {
            const target = editingComment;
            const previousBody = target.body;
            setSubmitting(true);
            try {
                await updatePostComment(target.id, cleaned);
                setEditingComment(null);
                setCommentBody('');
            setComments((current) => current.map((item) => item.id ===
                target.id
                ? {
                    ...item,
                    body: cleaned,
                    updated_at: new Date().toISOString(),
                }
                : item));

            }
            catch (submitError) {
                if (!mounted.current || viewPostId.current !== writePostId)
                    return;
                if ((submitError as {code?: string})?.code !== 'NOVORI_MODERATION') console.warn('Could not edit comment:', submitError);
                setComments((current) => current.map((item) => item.id ===
                    target.id
                    ? {
                        ...item,
                        body: previousBody,
                    }
                    : item));
                setEditingComment(target);
                setCommentBody(cleaned);
                showCommentWarning(submitError, 'Could not edit comment');
            }
            finally {
                commentSubmitInFlight.current = false;
                setSubmitting(false);
            }
            return;
        }
        const postIdForComment = post.id;
        const parentId = activeReplyTarget?.id ??
            null;
        const optimisticId = `optimistic-${Date.now()}`;
        const optimisticComment: PostComment = {
            id: optimisticId,
            post_id: postIdForComment,
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
        const previousReply = replyTo;
        try {
            setSubmitting(true);
            const confirmedId = await createPostComment(postIdForComment, cleaned, parentId);
            if (!mounted.current || viewPostId.current !== postIdForComment)
                return;
        setComments((current) => [
            ...current,
            optimisticComment
        ]);
        setPost((current) => current
            ? {
                ...current,
                comment_count: (current.comment_count ??
                    0) +
                    1,
            }
            : current);
        setCommentBody('');
        setReplyTo(null);
            if (typeof confirmedId === 'string') {
                if (parentId)
                    setVisibleReplyCounts(current => ({ ...current, [parentId]: Math.max(current[parentId] ?? COMMENT_REPLY_BATCH_SIZE, (threadData.nodes.get(parentId)?.children.length ?? 0) + 1) }));
                const missingLocalComment = !commentsState.current.some(item => item.id === optimisticId || item.id === confirmedId);
                if (missingLocalComment)
                    setPost(current => current ? { ...current, comment_count: (current.comment_count ?? 0) + 1 } : current);
                setComments(current => current.some(item => item.id === confirmedId) ? current.filter(item => item.id !== optimisticId) : current.some(item => item.id === optimisticId) ? current.map(item => item.id === optimisticId ? { ...item, id: confirmedId } : item) : [...current, { ...optimisticComment, id: confirmedId }]);
            }
            // The write is confirmed. A failed refresh must never undo it or invite duplicate submission.
            const request = loadSequence.current;
            void getPostComments(postIdForComment).then(nextComments => {
                if (request !== loadSequence.current || loadedPostId.current !== postIdForComment)
                    return;
                setComments(current => [...nextComments, ...current.filter(item => item.id.startsWith('optimistic-') || (nextComments.length >= 500 && item.id === confirmedId && !nextComments.some(next => next.id === item.id)))]);
                setPost(current => current ? { ...current, comment_count: nextComments.length >= 500 ? Math.max(current.comment_count ?? 0, nextComments.length) : nextComments.length } : current);
            }).catch(refreshError => {
                if (request !== loadSequence.current || loadedPostId.current !== postIdForComment)
                    return;
                if (!isTransientReadError(refreshError))
                    console.warn('Comment saved; refresh failed:', refreshError);
                setLoadWarning('Your comment was saved. The conversation could not refresh. Try again when your connection is back.');
            });
        }
        catch (submitError) {
            if (!mounted.current || viewPostId.current !== writePostId)
                return;
            if ((submitError as {code?: string})?.code !== 'NOVORI_MODERATION') console.warn('Could not add comment:', submitError);
            setCommentBody(previousBody);
            setReplyTo(previousReply);
            showCommentWarning(submitError, previousReply ? 'Could not reply' : 'Could not comment');
        }
        finally {
            commentSubmitInFlight.current = false;
            setSubmitting(false);
        }
    }
    function openCommentActions(comment: ThreadComment) {
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
    function startReply(comment: ThreadComment) {
        const displayName = comment.author_display_name
            ?.trim() ||
            comment.author_username
                ?.trim() ||
            'Novori Reader';
        startComposerWithKeyboard(() => {
            setEditingComment(null);
            setCommentBody('');
            setReplyTo({
                id: comment.id,
                name: displayName,
            });
        });
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
    function startEditComment(comment: ThreadComment) {
        startComposerWithKeyboard(() => {
            setReplyTo(null);
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
            !replyTo) {
            return;
        }
        setComposerResetting(true);
        setReplyResetting(Boolean(replyTo));
        commentInputRef
            .current
            ?.clear();
        commentInputRef
            .current
            ?.blur();
        setCommentBody('');
        setEditingComment(null);
        setReplyTo(null);
        Keyboard.dismiss();
    }
    function cancelCommentEdit() {
        resetTemporaryCommentComposer();
    }
    function handleCommentComposerOutsideTouch() {
        if (editingComment ||
            replyTo) {
            resetTemporaryCommentComposer();
            return;
        }
        Keyboard.dismiss();
    }
    function reportSelectedComment() {
        if (!commentActionTarget ||
            commentActionTarget.is_own) {
            return;
        }
        const target = commentActionTarget;
        beginCommentActionHandoff(() => {
            setCommentReportTarget(target);
        }, 70);
    }
    const reportConfirmation = useReportConfirmation(Boolean(commentReportTarget));
    async function handleCommentReport(reason: ReportReason) {
        if (!commentReportTarget ||
            commentReportSubmitting) {
            return;
        }
        try {
            setCommentReportSubmitting(true);
            await submitCommentReport(commentReportTarget.id, reason);
            reportConfirmation.queue();
            setCommentReportTarget(null);
        }
        catch (reportError) {
            console.error('Could not report comment:', reportError);
            Alert.alert('Could not submit report', 'Please try again.');
        }
        finally {
            setCommentReportSubmitting(false);
        }
    }
    function deleteSelectedComment() {
        if (!commentActionTarget ||
            !commentActionTarget.is_own) {
            return;
        }
        const target = commentActionTarget;
        beginCommentActionHandoff(() => {
            confirmDelete(target);
        }, 105);
    }
    function confirmBlockSelectedReader() {
        if (!commentActionTarget ||
            commentActionTarget.is_own) {
            return;
        }
        const target = commentActionTarget;
        beginCommentActionHandoff(() => {
            setBlockConfirmTarget(target);
        }, 105);
    }
    async function blockSelectedReader(comment: ThreadComment) {
        if (blockingReaderId) {
            return;
        }
        loadSequence.current += 1;
        try {
            setBlockingReaderId(comment.author_id);
            await blockReader(comment.author_id);
            setComments(current => current.map(item => item.author_id === comment.author_id ? { ...item, is_blocked_author: true, body: 'This comment is hidden.', author_display_name: 'Blocked reader', author_username: null, author_avatar_url: null } : item));
            setReplyTo(current => current && comments.some(item => item.id === current.id && item.author_id === comment.author_id) ? null : current);
            if (post?.author_id ===
                comment.author_id) {
                blockNavigateBackAfterDismiss.current =
                    true;
            }
            else {
                await loadData(false, true);
            }
        }
        catch (blockError) {
            console.error('Could not block reader:', blockError);
            Alert.alert('Could not block reader', 'Please try again.');
            throw blockError;
        }
        finally {
            setBlockingReaderId(null);
        }
    }
    function confirmDelete(comment: ThreadComment) { setDeleteCommentTarget(comment); }
    async function removeComment(commentId: string) {
        if (deletingCommentId) {
            return;
        }
        const request = ++loadSequence.current;
        const deletedIds = getCommentBranchIds(comments, commentId);
        try {
            setDeletingCommentId(commentId);
            await deletePostComment(commentId);
            if (request !== loadSequence.current)
                return;
            setComments(current => current.filter(item => !deletedIds.has(item.id)));
            setPost(current => current ? { ...current, comment_count: Math.max(0, (current.comment_count ?? 0) - deletedIds.size) } : current);
            if (replyTo && deletedIds.has(replyTo.id)) {
                setReplyTo(null);
            }
            await loadData(false, true);
        }
        catch (deleteError) {
            console.error('Could not delete comment:', deleteError);
            Alert.alert('Could not delete comment', 'Please try again.');
            throw deleteError;
        }
        finally {
            setDeletingCommentId(null);
        }
    }
    async function alwaysShowExplicitLanguage() {
        try {
            setAllowExplicitLanguage(true);
            await setExplicitLanguagePreference(true);
        }
        catch (preferenceError) {
            console.error('Could not save explicit-language preference:', preferenceError);
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
    function renderComment(comment: ThreadComment, depth = 0) {
        const name = comment.author_display_name?.trim() || comment.author_username?.trim() || 'Novori Reader';
        const nested = depth > 0;
        const limit = visibleReplyCounts[comment.id] ?? COMMENT_REPLY_BATCH_SIZE;
        const visibleChildren = comment.children.slice(0, limit);
        const hiddenCount = comment.children.length - visibleChildren.length;
        const children = comment.children.length ? (depth < commentDepthLimit ? <>
      {visibleChildren.map(child => renderComment(child, depth + 1))}
      {hiddenCount > 0 ? <Pressable accessibilityRole="button" accessibilityLabel={`Show more replies: ${comment.id}`} onPress={() => setVisibleReplyCounts(current => ({ ...current, [comment.id]: limit + COMMENT_REPLY_BATCH_SIZE }))} style={[styles.continueConversation, styles.continueConversationBranch]}><Ionicons name="add-outline" size={14} color={colors.gold}/><Text style={styles.continueConversationText}>Show more replies · {hiddenCount}</Text></Pressable> : null}
      {limit > COMMENT_REPLY_BATCH_SIZE ? <Pressable accessibilityRole="button" accessibilityLabel={`Show fewer replies: ${comment.id}`} onPress={() => setVisibleReplyCounts(current => ({ ...current, [comment.id]: COMMENT_REPLY_BATCH_SIZE }))} style={[styles.continueConversation, styles.continueConversationBranch]}><Text style={styles.continueConversationText}>Show fewer replies</Text></Pressable> : null}
    </> :
            <Pressable accessibilityRole="button" accessibilityLabel={`View conversation: ${comment.id}`} onPress={() => openConversation(comment.id)} style={[styles.continueConversation, styles.continueConversationBranch]}>
        <Ionicons name="chatbubbles-outline" size={14} color={colors.gold}/><Text style={styles.continueConversationText}>View conversation · {countThreadReplies(comment)} {countThreadReplies(comment) === 1 ? 'reply' : 'replies'}</Text><Ionicons name="chevron-forward" size={13} color={colors.gold}/>
      </Pressable>) : null;
        return <View key={comment.id} ref={node => { commentRefs.current[comment.id] = node; }} style={[styles.commentThread, nested && styles.commentThreadNested]}>
      {nested ? <CommentBranchGuide /> : null}
      <Pressable delayLongPress={220} onLongPress={() => {
                if (!comment.is_deleted && !comment.is_blocked_author)
                    openCommentActions(comment);
            }} style={[styles.commentCard, focusedThreadId && !nested && styles.conversationAnchor, highlightedCommentId === comment.id && styles.commentCardHighlighted]}>
        {holdingCommentId === comment.id ? <Animated.View pointerEvents="none" style={[styles.commentCardActionAccent, { opacity: commentSelectionAccentOpacity }]}/> : null}
        {comment.is_blocked_author ? <Text style={styles.blockedCommentText}>Blocked reader · This comment is hidden.</Text> : <View style={styles.commentRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={`View reader avatar: ${name}`} disabled={comment.is_deleted} delayLongPress={220} onLongPress={() => openCommentActions(comment)} onPress={() => openReader(comment.author_id)} style={styles.commentAvatarButton}>{comment.author_avatar_url ? <Image source={{ uri: moderationMediaUrl(comment.author_avatar_url) }} style={styles.commentAvatar}/> : <View style={styles.commentAvatarFallback}><Text style={styles.commentAvatarText}>{name.charAt(0).toUpperCase()}</Text></View>}</Pressable>
          <View style={styles.commentAuthorCopy}>
          <View style={styles.commentHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel={`View reader: ${name}`} disabled={comment.is_deleted} delayLongPress={220} onLongPress={() => openCommentActions(comment)} onPress={() => openReader(comment.author_id)} style={styles.commentIdentity}>
              <Text style={styles.commentAuthorName} numberOfLines={1}>{name}</Text>
            </Pressable>
            {comment.author_username ? <Text style={styles.commentUsername} numberOfLines={1}>@{comment.author_username}</Text> : null}
            <Text style={styles.commentTime}>· {formatRelativeTime(comment.created_at)}</Text>
            {comment.updated_at !== comment.created_at ? <Text style={styles.commentTime}>· edited</Text> : null}
          </View>
          <Pressable accessibilityLabel={`Comment: ${comment.id}`} delayLongPress={220} onLongPress={() => {
                    if (!comment.is_deleted)
                        openCommentActions(comment);
                }} style={styles.commentHoldTarget}>
            {renderExplicitContentWarning(comment.body, 'comment', comment.id, styles.commentBody, comment.is_own)}
          </Pressable>
          <View style={styles.commentFooter}>
            <View style={styles.commentVoteControl}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Upvote comment: ${comment.id}`} disabled={comment.is_deleted || comment.id.startsWith('optimistic-') || Boolean(votingCommentIds[comment.id])} delayLongPress={220} onLongPress={() => openCommentActions(comment)} onPress={() => void handleCommentVote(comment, 1)} style={styles.commentVoteButton}><Ionicons name={comment.viewer_vote === 1 ? 'arrow-up' : 'arrow-up-outline'} size={21} color={comment.viewer_vote === 1 ? colors.gold : colors.mutedText}/></Pressable>
              <Text style={[styles.commentVoteScore, comment.viewer_vote !== 0 && styles.commentVoteScoreActive]}>{comment.vote_score ?? 0}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Downvote comment: ${comment.id}`} disabled={comment.is_deleted || comment.id.startsWith('optimistic-') || Boolean(votingCommentIds[comment.id])} delayLongPress={220} onLongPress={() => openCommentActions(comment)} onPress={() => void handleCommentVote(comment, -1)} style={styles.commentVoteButton}><Ionicons name={comment.viewer_vote === -1 ? 'arrow-down' : 'arrow-down-outline'} size={21} color={comment.viewer_vote === -1 ? colors.gold : colors.mutedText}/></Pressable>
            </View>
            {!comment.is_deleted && <Pressable accessibilityRole="button" accessibilityLabel={`Reply to comment: ${comment.id}`} disabled={submitting || comment.id.startsWith('optimistic-')} onPress={() => startReply(comment)} delayLongPress={220} onLongPress={() => openCommentActions(comment)} hitSlop={6} style={styles.commentVoteButton}><Ionicons name="return-down-forward-outline" size={18} color={colors.mutedText}/></Pressable>}
          </View>
          </View>
        </View>}
      </Pressable>{children}
    </View>;
    }
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
    if (loading && (requestedThreadId || targetCommentId)) {
        return <SafeAreaView onLayout={() => conversationDestinationLaidOut(postId, requestedThreadId || targetCommentId)} style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={[styles.header, styles.conversationHeader]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to previous screen" onPress={() => router.back()} style={[styles.headerButton, styles.focusedHeaderBack]}><Ionicons name="chevron-back" size={24} color={colors.text}/></Pressable>
        <Text style={[styles.headerTitle, styles.focusedHeaderTitle]}>Conversation</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to post" onPress={() => router.dismissTo({ pathname: '/post/[id]', params: { id: postId } })} style={styles.focusedHeaderAction}><Text style={styles.backToPost}>Back to post</Text></Pressable>
      </View>
      <View style={styles.scrollContent}>
        <View style={styles.conversationLoading}><ActivityIndicator size="small" color={colors.gold}/><Text style={styles.commentsCountLabel}>Loading conversation…</Text></View>
        {[0, 1, 2].map(index => <View key={index} accessible={false} style={[styles.conversationPlaceholder, index > 0 && { marginLeft: 23 }]}><View style={[styles.placeholderLine, { width: '35%' }]}/><View style={[styles.placeholderLine, { width: '90%' }]}/><View style={[styles.placeholderLine, { width: '65%' }]}/></View>)}
      </View>
    </SafeAreaView>;
    }
    if (loading) {
        return (<SafeAreaView onLayout={() => conversationDestinationLaidOut(postId, requestedThreadId || targetCommentId)} style={styles.safeArea} edges={[
                'top',
                'bottom'
            ]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold}/>
        </View>
      </SafeAreaView>);
    }
    if (error ||
        !post) {
        return (<SafeAreaView onLayout={() => conversationDestinationLaidOut(postId, requestedThreadId || targetCommentId)} style={styles.safeArea} edges={[
                'top',
                'bottom'
            ]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [
                styles.headerButton,
                pressed &&
                    styles.pressed
            ]}>
            <Ionicons name="chevron-back" size={24} color={colors.text}/>
          </Pressable>

          <Text style={styles.headerTitle}>
            Post
          </Text>

          <View style={styles.headerButton}/>
        </View>

        <View style={styles.centered}>
          <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.mutedText}/>

          <Text style={styles.errorTitle}>
            Post unavailable
          </Text>

          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      </SafeAreaView>);
    }
    const displayName = post.author_display_name
        ?.trim() ||
        post.author_username
            ?.trim() ||
        'Novori Reader';
    const username = post.author_username
        ?.trim()
        ? `@${post.author_username.trim()}`
        : '';
    const authorInitial = displayName
        .charAt(0)
        .toUpperCase();
    const clubInitial = post.club_name
        ?.charAt(0)
        .toUpperCase() ||
        'C';
    const canSubmit = commentBody
        .trim()
        .length >
        0 &&
        commentBody
            .trim()
            .length <=
            2000 &&
        !submitting && Boolean(!focusedThreadId || replyTo || editingComment);
    return (<SafeAreaView onLayout={() => conversationDestinationLaidOut(postId, requestedThreadId || targetCommentId)} style={styles.safeArea} edges={[
            'top',
            'bottom'
        ]}>
      <View style={[styles.header, focusedThreadId && styles.conversationHeader]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to previous screen" onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [
            styles.headerButton,
            focusedThreadId && styles.focusedHeaderBack,
            pressed &&
                styles.pressed
        ]}>
          <Ionicons name="chevron-back" size={24} color={colors.text}/>
        </Pressable>

        <Text style={[styles.headerTitle, focusedThreadId && styles.focusedHeaderTitle]}>
          {focusedThreadId ? 'Conversation' : 'Post'}
        </Text>

        {focusedThreadId ? <Pressable accessibilityRole="button" accessibilityLabel="Back to post" style={styles.focusedHeaderAction} onPress={() => router.dismissTo({ pathname: '/post/[id]', params: { id: postId } })} hitSlop={8}><Text style={styles.backToPost}>Back to post</Text></Pressable> : <View style={styles.headerButton}/>}
      </View>

      {loadWarning ? <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.background }}><Text style={{ color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 12 }}>{loadWarning}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry refreshing thread" onPress={() => void loadData(false, true)}><Text style={{ color: colors.gold, fontFamily: 'Inter_600SemiBold', paddingVertical: 6 }}>Try again</Text></Pressable></View> : null}
      <View style={styles.keyboardView}>
        <ScrollView ref={scrollRef} onTouchStart={handleCommentComposerOutsideTouch} style={styles.scroll} contentContainerStyle={styles.scrollContent} onScroll={(event) => {
            scrollYRef.current =
                event.nativeEvent
                    .contentOffset.y;
        }} scrollEventThrottle={16} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always" keyboardDismissMode={Platform.OS ===
            'ios'
            ? 'interactive'
            : 'on-drag'} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold}/>}>
          {!focusedThreadId ? <View style={styles.postCard}>
            <View style={styles.postHeader}>
              <Pressable onPress={() => openReader(post.author_id)} style={({ pressed }) => [
                pressed &&
                    styles.pressed
            ]}>
                {post.author_avatar_url ? (<Image source={{
                    uri: moderationMediaUrl(post.author_avatar_url),
                }} style={styles.postAvatar}/>) : (<View style={styles.postAvatarFallback}>
                    <Text style={styles.postAvatarText}>
                      {authorInitial}
                    </Text>
                  </View>)}
              </Pressable>

              <View style={styles.postAuthorCopy}>
                <Pressable onPress={() => openReader(post.author_id)} style={({ pressed }) => [
                pressed &&
                    styles.pressed
            ]}>
                  <View style={styles.postIdentity}>
                    <Text style={styles.postAuthorName} numberOfLines={1}>
                      {displayName}
                    </Text>

                    {username ? (<Text style={styles.postUsername} numberOfLines={1}>
                        {username}
                      </Text>) : null}
                  </View>
                </Pressable>

                {post.club_id &&
                post.club_name ? (<Pressable onPress={() => openClub(post.club_id!)} style={({ pressed }) => [
                    styles.postAudience,
                    pressed &&
                        styles.pressed
                ]}>
                    {post.club_cover_url ? (<Image source={{
                        uri: moderationMediaUrl(post.club_cover_url),
                    }} style={styles.clubIcon}/>) : (<View style={styles.clubIconFallback}>
                        <Text style={styles.clubIconText}>
                          {clubInitial}
                        </Text>
                      </View>)}

                    <Text style={styles.postAudienceText} numberOfLines={1}>
                      in{' '}
                      {post.club_name}{' '}
                      <Text style={styles.postTime}>
                        ·{' '}
                        {formatRelativeTime(post.created_at)}
                      </Text>
                    </Text>
                  </Pressable>) : (<Text style={styles.postAudienceText}>
                    posted to their profile{' '}
                    <Text style={styles.postTime}>
                      ·{' '}
                      {formatRelativeTime(post.created_at)}
                    </Text>
                  </Text>)}
              </View>

              <Pressable onPress={() => void shareCurrentPost()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Share post" style={({ pressed }) => [
                styles.postHeaderShare,
                pressed &&
                    styles.pressed
            ]}>
                <Ionicons name="share-social-outline" size={19} color={colors.mutedText}/>
              </Pressable>
            </View>

            <PostTypeIdentifier event={Boolean(post.club_event)} discussion={Boolean(post.club_discussion)} poll={post.club_discussion?.kind === 'poll'} announcement={post.is_club_announcement} readingRecap={Boolean(post.reading_recap)} postType={post.post_type} rating={post.rating} colors={colors}/>

            {post.post_type ===
                'question' ? ((() => {
                const questionContent = splitQuestionPostBody(post.body);
                return (<>
                    {renderExplicitContentWarning(questionContent.question, 'post', post.id, styles.questionPostTitle, Boolean(currentUserId &&
                        post.author_id ===
                            currentUserId))}

                    {questionContent.context ? (<View style={styles.questionPostContextWrap}>
                        {renderExplicitContentWarning(questionContent.context, 'post', post.id, styles.questionPostContext, Boolean(currentUserId &&
                            post.author_id ===
                                currentUserId))}
                      </View>) : null}
                  </>);
            })()) : post.body.trim() && !post.club_discussion ? (renderExplicitContentWarning(post.body, 'post', post.id, styles.postBody, Boolean(currentUserId &&
                post.author_id ===
                    currentUserId))) : null}

            {post.club_discussion ? <ClubDiscussionPostAttachment discussion={post.club_discussion} detail revealed={!discussionSpoilersHidden} onReveal={() => setRevealedDiscussion(discussionRevealKey(post.club_discussion!))} onStateChange={row => setPost(current => current ? { ...current, club_discussion: row } : current)}/> : null}
            {post.club_event ? <ClubEventPostAttachment event={post.club_event}/> : null}
        {post.reading_recap ? <ReadingRecapPostAttachment snapshot={post.reading_recap}/> : null}

            {post.post_type ===
                'book_stack' &&
                post.book_stack_id ? (<BookStackPostAttachment stackId={post.book_stack_id} compactTopSpacing={!post.body.trim()}/>) : null}

            {post.book_title ? (<View style={styles.bookCard}>
                {(post.google_book_id || post.book_cover_url) ? (<BookCoverImage googleBookId={post.google_book_id} existingCoverUrl={post.book_cover_url} style={styles.bookCover}/>) : (<View style={styles.bookCoverFallback}>
                    <Ionicons name="book-outline" size={20} color={colors.gold}/>
                  </View>)}

                <View style={styles.bookCopy}>
                  <Text style={styles.bookTitle}>
                    {post.book_title}
                  </Text>

                  {(post.post_type ===
                    'question' ||
                    post.post_type ===
                        'reading_update') ? (<CanonicalBookRating googleBookId={post.google_book_id} title={post.book_title} authors={post.book_authors}/>) : null}

                  {post.rating ? (<Text style={styles.bookRating}>
                      ★ {post.rating}
                    </Text>) : null}
                </View>
              </View>) : null}

            <View style={styles.postFooter}>
              <View style={styles.voteControl}>
                <Pressable disabled={voting} onPress={() => handleVote(1)} hitSlop={8} style={({ pressed }) => [
                styles.voteButton,
                post.viewer_vote ===
                    1 &&
                    styles.voteButtonActive,
                pressed &&
                    styles.pressed
            ]}>
                  <Ionicons name={post.viewer_vote ===
                1
                ? 'arrow-up-circle'
                : 'arrow-up-circle-outline'} size={21} color={post.viewer_vote ===
                1
                ? colors.gold
                : colors.mutedText}/>
                </Pressable>

                <Text style={[
                styles.voteScore,
                post.viewer_vote !==
                    0 &&
                    styles.voteScoreActive
            ]}>
                  {post.vote_score ??
                0}
                </Text>

                <Pressable disabled={voting} onPress={() => handleVote(-1)} hitSlop={8} style={({ pressed }) => [
                styles.voteButton,
                post.viewer_vote ===
                    -1 &&
                    styles.voteButtonActive,
                pressed &&
                    styles.pressed
            ]}>
                  <Ionicons name={post.viewer_vote ===
                -1
                ? 'arrow-down-circle'
                : 'arrow-down-circle-outline'} size={21} color={post.viewer_vote ===
                -1
                ? colors.gold
                : colors.mutedText}/>
                </Pressable>
              </View>

              <View style={styles.commentCount}>
                <Ionicons name="chatbubble-outline" size={15} color={colors.mutedText}/>

                <Text style={styles.commentCountText}>
                  {post.comment_count ??
                comments.length}
                </Text>
              </View>
            </View>
          </View> : discussionSpoilersHidden && post.club_discussion ? <ClubDiscussionPostAttachment discussion={post.club_discussion} detail revealed={false} onReveal={() => setRevealedDiscussion(discussionRevealKey(post.club_discussion!))}/> : null}

          {!discussionSpoilersHidden ? <>
          <View style={focusedThreadId ? styles.conversationToolbar : undefined}>
          {focusedThread ? <Text accessibilityLabel="Conversation comment count" style={[styles.commentsCountLabel, styles.conversationCountText]}>{`${countThreadReplies(focusedThread) + 1} ${countThreadReplies(focusedThread) === 0 ? 'comment' : 'comments'}`}</Text> : <View style={styles.commentsHeader}><Text style={styles.commentsTitle}>Comments</Text><Text style={styles.commentsCountLabel}>{comments.length}</Text></View>}

          <View style={[styles.commentSortRow, focusedThreadId && styles.conversationSortRow]}>
            <Pressable onPress={() => setCommentSort('top')} style={({ pressed }) => [
                styles.commentSortButton,
                commentSort ===
                    'top' &&
                    styles.commentSortButtonActive,
                pressed &&
                    styles.pressed
            ]}>
              <Text style={[
                styles.commentSortText,
                commentSort ===
                    'top' &&
                    styles.commentSortTextActive
            ]}>
                Top
              </Text>
            </Pressable>

            <Pressable onPress={() => setCommentSort('newest')} style={({ pressed }) => [
                styles.commentSortButton,
                commentSort ===
                    'newest' &&
                    styles.commentSortButtonActive,
                pressed &&
                    styles.pressed
            ]}>
              <Text style={[
                styles.commentSortText,
                commentSort ===
                    'newest' &&
                    styles.commentSortTextActive
            ]}>
                Newest
              </Text>
            </Pressable>
          </View>

          </View>
          {thread.length >
                0 ? (<View onLayout={event => setCommentAreaWidth(event.nativeEvent.layout.width)} style={styles.threadList}>
              {thread.map(comment => renderComment(comment))}
            </View>) : (<View style={styles.emptyComments}>
              <Ionicons name="chatbubbles-outline" size={25} color={colors.mutedText}/>

              <Text style={styles.emptyCommentsTitle}>
                {focusedThreadId ? 'This conversation is no longer available' : 'No comments yet'}
              </Text>

              <Text style={styles.emptyCommentsText}>
                Start the conversation.
              </Text>
            </View>)}
          </> : null}
        </ScrollView>

        {!discussionSpoilersHidden && (!focusedThreadId || (focusedThread && (activeReplyTarget || editingComment))) ? <KeyboardStickyView offset={{
                closed: 0,
                opened: 0,
            }}>
          <View style={styles.composerWrap}>
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: windowHeight, backgroundColor: colors.background }}/>
          {editingComment ? (<View style={styles.replyingRow}>
              <Text style={styles.replyingText}>
                Editing comment
              </Text>

              <Pressable onPress={cancelCommentEdit} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.mutedText}/>
              </Pressable>
            </View>) : activeReplyTarget ? (<ReplyComposerContext name={activeReplyTarget.name} body={activeReplyComment?.body ?? ''} hideBody={Boolean(activeReplyComment && !activeReplyComment.is_own && !allowExplicitLanguage && containsExplicitLanguage(activeReplyComment.body) && !isExplicitContentRevealed('comment', activeReplyComment.id))} onCancel={replyTo ? resetTemporaryCommentComposer : undefined}/>) : composerResetting ? (<View pointerEvents="none" style={[
                    styles.replyingRow,
                    styles.replyingRowSpacer
                ]}>
              <Text style={styles.replyingText} numberOfLines={1}>
                Replying to reader
              </Text>

              <View style={styles.replyingSpacerIcon}/>
            </View>) : null}

          <View style={styles.composer}>
            <TextInput accessibilityLabel="Comment reply text" editable={!submitting && Boolean(!focusedThreadId || activeReplyTarget || editingComment)} ref={commentInputRef} value={commentBody} onChangeText={setCommentBody} placeholder={composerResetting
                ? ''
                : editingComment
                    ? 'Edit your comment…'
                    : activeReplyTarget
                        ? 'Write a reply…'
                        : 'Add a comment…'} placeholderTextColor={colors.mutedText} multiline maxLength={2000} style={styles.commentInput}/>

            <Pressable accessibilityRole="button" accessibilityLabel="Send comment" disabled={!canSubmit} onPress={submitComment} style={({ pressed }) => [
                styles.sendButton,
                !canSubmit &&
                    styles.sendButtonDisabled,
                pressed &&
                    canSubmit &&
                    styles.pressed
            ]}>
              {submitting ? (<ActivityIndicator size="small" color={colors.background}/>) : (<Ionicons name={editingComment
                    ? 'checkmark'
                    : 'arrow-up'} size={19} color={colors.background}/>)}
            </Pressable>
          </View>
          </View>
        </KeyboardStickyView> : null}
        <ValidationWarningSheet visible={commentWarning !== null} title={commentWarning?.title ?? "Could not comment"} message={commentWarning?.message ?? ""} dismissLabel="Got it" onDismiss={() => setCommentWarning(null)}/>
        <DeletePostConfirmSheet title="Delete comment?" message="This comment and any replies underneath it will be permanently removed. This can’t be undone." visible={Boolean(deleteCommentTarget)} busy={Boolean(deletingCommentId)} onConfirm={async () => {
            if (deleteCommentTarget)
                await removeComment(deleteCommentTarget.id);
        }} onDismiss={() => setDeleteCommentTarget(null)}/>
      </View>

      {commentActionTarget ? (<View style={styles.commentActionModal}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => {
                resetTemporaryCommentComposer();
                closeCommentActions();
            }}>
            <UiSheetBackdrop pointerEvents="none" style={[
                styles.commentActionBackdrop,
                {}
            ]} motion={uiCommentAction}/>
          </Pressable>

          <UiSheetSurface style={[
                styles.commentActionSheet,
                {}
            ]} motion={uiCommentAction}>
            <View style={styles.commentActionHandle}/>

            <Text style={styles.commentActionTitle}>
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

            <Text style={styles.commentActionHint}>
              Choose an action for this comment.
            </Text>

            <View style={styles.commentActionList}>
              <Pressable onPress={replyToSelectedComment} style={({ pressed }) => [
                styles.commentActionRow,
                pressed &&
                    styles.commentActionRowPressed
            ]}>
                <View style={styles.commentActionIcon}>
                  <Ionicons name="return-down-forward-outline" size={19} color={colors.gold}/>
                </View>

                <Text style={styles.commentActionText}>
                  Reply
                </Text>
              </Pressable>

              {commentActionTarget
                ?.is_own ? (<>
                  <View style={styles.commentActionDivider}/>

                  <Pressable onPress={editSelectedComment} style={({ pressed }) => [
                    styles.commentActionRow,
                    pressed &&
                        styles.commentActionRowPressed
                ]}>
                    <View style={styles.commentActionIcon}>
                      <Ionicons name="create-outline" size={19} color={colors.gold}/>
                    </View>

                    <Text style={styles.commentActionText}>
                      Edit
                    </Text>
                  </Pressable>

                  <View style={styles.commentActionDivider}/>

                  <Pressable onPress={deleteSelectedComment} style={({ pressed }) => [
                    styles.commentActionRow,
                    pressed &&
                        styles.commentActionRowPressed
                ]}>
                    <View style={[
                    styles.commentActionIcon,
                    styles.commentActionDangerIcon
                ]}>
                      <Ionicons name="trash-outline" size={19} color={colors.danger}/>
                    </View>

                    <Text style={[
                    styles.commentActionText,
                    styles.commentActionDangerText
                ]}>
                      Delete
                    </Text>
                  </Pressable>
                </>) : (<>
                  <View style={styles.commentActionDivider}/>

                  <Pressable onPress={reportSelectedComment} style={({ pressed }) => [
                    styles.commentActionRow,
                    pressed &&
                        styles.commentActionRowPressed
                ]}>
                    <View style={styles.commentActionIcon}>
                      <Ionicons name="flag-outline" size={19} color={colors.gold}/>
                    </View>

                    <Text style={styles.commentActionText}>
                      Report
                    </Text>
                  </Pressable>

                  <View style={styles.commentActionDivider}/>

                  <Pressable disabled={Boolean(blockingReaderId)} onPress={confirmBlockSelectedReader} style={({ pressed }) => [
                    styles.commentActionRow,
                    pressed &&
                        styles.commentActionRowPressed
                ]}>
                    <View style={[
                    styles.commentActionIcon,
                    styles.commentActionDangerIcon
                ]}>
                      <Ionicons name="ban-outline" size={19} color={colors.danger}/>
                    </View>

                    <Text style={[
                    styles.commentActionText,
                    styles.commentActionDangerText
                ]}>
                      Block reader
                    </Text>
                  </Pressable>
                </>)}
            </View>

            <Pressable onPress={() => closeCommentActions()} style={({ pressed }) => [
                styles.commentActionCancel,
                pressed &&
                    styles.pressed
            ]}>
              <Text style={styles.commentActionCancelText}>
                Cancel
              </Text>
            </Pressable>
          </UiSheetSurface>
        </View>) : null}

      <Modal supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']} onDismiss={reportConfirmation.afterDismiss} visible={Boolean(commentReportTarget)} transparent animationType="fade" onRequestClose={() => {
            if (!commentReportSubmitting) {
                setCommentReportTarget(null);
            }
        }}>
        <View style={styles.commentActionModal}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => {
            if (!commentReportSubmitting) {
                setCommentReportTarget(null);
            }
        }}/>

          <View style={styles.commentActionSheet}>
            <View style={styles.commentActionHandle}/>

            <Text style={styles.commentActionTitle}>
              Report comment
            </Text>

            <Text style={styles.commentActionHint}>
              Why are you reporting this comment?
            </Text>

            <View style={styles.commentActionList}>
              {COMMENT_REPORT_REASONS.map((reason, index) => (<View key={reason.value}>
                    {index >
                0 ? (<View style={styles.commentActionDivider}/>) : null}

                    <Pressable disabled={commentReportSubmitting} onPress={() => void handleCommentReport(reason.value)} style={({ pressed }) => [
                styles.commentActionRow,
                pressed &&
                    styles.commentActionRowPressed
            ]}>
                      <View style={styles.commentActionIcon}>
                        <Ionicons name={reason.icon} size={19} color={colors.gold}/>
                      </View>

                      <Text style={styles.commentActionText}>
                        {reason.label}
                      </Text>
                    </Pressable>
                  </View>))}
            </View>

            <Text style={styles.commentReportPrivacy}>
              Reports are private. The comment author won’t be told who reported them.
            </Text>

            {commentReportSubmitting ? (<View style={styles.commentReportLoading}>
                <ActivityIndicator size="small" color={colors.gold}/>
              </View>) : null}
          </View>
        </View>
      </Modal>
      <BlockReaderConfirmSheet visible={Boolean(blockConfirmTarget)} readerName={blockConfirmTarget?.author_display_name
            ?.trim() ||
            blockConfirmTarget?.author_username
                ?.trim() ||
            'this reader'} busy={Boolean(blockingReaderId)} onConfirm={() => blockConfirmTarget
            ? blockSelectedReader(blockConfirmTarget)
            : Promise.resolve()} onDismiss={() => {
            setBlockConfirmTarget(null);
            if (blockNavigateBackAfterDismiss.current) {
                blockNavigateBackAfterDismiss.current =
                    false;
                router.back();
            }
        }}/>

      <ValidationWarningSheet visible={reportConfirmation.visible} title="Report submitted" message="Thanks for letting us know. Your report has been submitted for review." icon="checkmark-circle-outline" dismissLabel="Got it" onDismiss={reportConfirmation.dismiss}/>
    </SafeAreaView>);
}
function createStyles(colors: NovoriColors) {
    return StyleSheet.create({
        safeArea: {
            flex: 1,
            backgroundColor: colors.background,
        },
        keyboardView: {
            flex: 1,
        },
        conversationHeader: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16 },
        conversationLoading: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
        conversationPlaceholder: { paddingVertical: 14, gap: 9 },
        placeholderLine: { height: 9, borderRadius: 5, backgroundColor: colors.surface },
        focusedHeaderBack: { width: 88, alignItems: 'flex-start' },
        focusedHeaderAction: { width: 88, height: 42, alignItems: 'flex-end', justifyContent: 'center' },
        focusedHeaderTitle: { flex: 1, textAlign: 'center', fontSize: 18 },
        conversationToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 12, marginBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        conversationCountText: { textAlign: 'left', padding: 0, margin: 0 },
        conversationCountRow: { marginTop: 0, marginBottom: 0, paddingHorizontal: 0 },
        conversationSortRow: { marginBottom: 0 },
        conversationAnchor: { paddingVertical: 10, marginBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        header: {
            height: 54,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        headerButton: {
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: 'center',
            justifyContent: 'center',
        },
        headerTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 20,
        },
        scroll: {
            flex: 1,
        },
        scrollContent: {
            width: '100%',
            maxWidth: 720,
            alignSelf: 'center',
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 24,
        },
        centered: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 28,
        },
        errorTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 21,
            marginTop: 12,
        },
        errorText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            lineHeight: 19,
            textAlign: 'center',
            marginTop: 7,
        },
        postCard: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 18,
            padding: 15,
        },
        postHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
        },
        postHeaderShare: {
            width: 36,
            height: 36,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 6,
            marginTop: -2,
        },
        postAvatar: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.elevated,
            marginRight: 11,
        },
        postAvatarFallback: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 11,
        },
        postAvatarText: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 18,
        },
        postAuthorCopy: {
            flex: 1,
            minWidth: 0,
            paddingTop: 2,
        },
        postIdentity: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            minWidth: 0,
        },
        postAuthorName: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 13,
            flexShrink: 0,
        },
        postUsername: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            flex: 1,
            flexShrink: 1,
            minWidth: 0,
        },
        postAudience: {
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            marginTop: 4,
            maxWidth: '100%',
        },
        postAudienceText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10,
            marginTop: 4,
            flexShrink: 1,
        },
        postTime: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10,
        },
        clubIcon: {
            width: 17,
            height: 17,
            borderRadius: 5,
            backgroundColor: colors.elevated,
        },
        clubIconFallback: {
            width: 17,
            height: 17,
            borderRadius: 5,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
        },
        clubIconText: {
            color: colors.gold,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 8,
        },
        questionPostTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_600SemiBold',
            fontSize: 22,
            lineHeight: 30,
            marginTop: 10,
        },
        questionPostContextWrap: {
            marginTop: 9,
        },
        questionPostContext: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 14.5,
            lineHeight: 22,
        },
        postBody: {
            color: colors.text,
            fontFamily: 'Inter_400Regular',
            fontSize: 15,
            lineHeight: 23,
            marginTop: 14,
        },
        bookCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.elevated,
            borderRadius: 13,
            padding: 10,
            marginTop: 13,
        },
        bookCover: {
            width: 42,
            height: 62,
            borderRadius: 6,
            backgroundColor: colors.surface,
            marginRight: 10,
        },
        bookCoverFallback: {
            width: 42,
            height: 62,
            borderRadius: 6,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
        },
        bookCopy: {
            flex: 1,
        },
        bookTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
            lineHeight: 18,
        },
        bookRating: {
            color: colors.gold,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11,
            marginTop: 4,
        },
        postFooter: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTopWidth: 1,
            borderTopColor: colors.border,
            marginTop: 14,
            paddingTop: 10,
        },
        voteControl: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 0,
        },
        voteButton: {
            width: 26,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        voteButtonActive: {
            backgroundColor: colors.elevated,
        },
        voteScore: {
            minWidth: 14,
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12,
            textAlign: 'center',
        },
        voteScoreActive: {
            color: colors.gold,
        },
        commentCount: {
            height: 32,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
        },
        commentCountText: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11,
        },
        commentsHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            marginTop: 20,
            marginBottom: 10,
            paddingHorizontal: 3,
        }, commentSortRow: {
            height: 32,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 10,
        },
        commentSortButton: {
            height: 25,
            minWidth: 58,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            paddingHorizontal: 10,
        },
        commentSortButtonActive: {
            backgroundColor: colors.elevated,
        },
        commentSortText: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10,
        },
        commentSortTextActive: {
            color: colors.gold,
        },
        commentsTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 19,
        },
        commentsCountLabel: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11,
        },
        conversationContext: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, marginBottom: 8 },
        conversationContextHint: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
        conversationContextTitle: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
        continueConversation: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 36, paddingVertical: 7 },
        continueConversationBranch: { marginLeft: 23 },
        continueConversationText: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
        commentThreadNested: { marginLeft: 14, paddingLeft: 9 },
        backToPost: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
        threadList: { gap: 2 },
        commentThread: { gap: 1 },
        commentCard: { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0, paddingVertical: 4, paddingHorizontal: 0 },
        commentCardHighlighted: { backgroundColor: `${colors.gold}10` },
        commentCardActionAccent: {
            position: 'absolute',
            left: 29,
            top: 9,
            bottom: 9,
            width: 3,
            borderRadius: 2,
            backgroundColor: colors.gold,
            zIndex: 2,
        },
        commentHoldTarget: {
            alignSelf: 'stretch',
            borderRadius: 10,
        },
        commentCardPressed: {
            backgroundColor: colors.elevated,
        },
        commentRow: { flexDirection: 'row', alignItems: 'flex-start' },
        commentAvatarButton: { marginRight: 9 },
        commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 3 },
        commentAvatar: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.elevated, marginRight: 0 },
        commentAvatarFallback: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center', marginRight: 0 },
        commentAvatarText: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 10 },
        commentAuthorCopy: {
            flex: 1,
            minWidth: 0,
        },
        commentIdentity: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, minWidth: 0 },
        commentAuthorName: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 13,
            flexShrink: 1,
        },
        commentUsername: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11.5,
            flexShrink: 1,
        },
        commentTime: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10.5, marginLeft: 0 },
        commentDelete: {
            width: 30,
            height: 30,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 4,
        },
        commentBody: { color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, marginTop: 3 },
        explicitContentWrap: {
            position: 'relative',
            minHeight: 150,
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
            paddingVertical: 15,
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
            fontSize: 15,
            lineHeight: 20,
        },
        explicitWarningText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12.5,
            lineHeight: 18,
            marginTop: 6,
            textAlign: 'center',
        },
        explicitWarningActions: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginTop: 13,
        },
        explicitWarningButton: {
            minHeight: 44,
            minWidth: 112,
            paddingHorizontal: 20,
            borderRadius: 22,
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
            fontSize: 12.5,
        },
        explicitWarningButtonPrimaryText: {
            color: colors.background,
        },
        commentFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 3 },
        commentVoteControl: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 0,
        },
        commentVoteButton: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
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
        replyButton: {
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            minHeight: 24,
        },
        replyButtonText: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10,
        },
        emptyComments: {
            minHeight: 150,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            paddingHorizontal: 24,
        },
        emptyCommentsTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
            marginTop: 8,
        },
        emptyCommentsText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            marginTop: 3,
        },
        composerWrap: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingHorizontal: 14,
            paddingTop: 8,
            paddingBottom: 8,
        },
        replyingRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 4,
            marginBottom: 6,
        },
        replyingText: {
            flex: 1,
            color: colors.mutedText,
            fontFamily: 'Inter_500Medium',
            fontSize: 10,
            marginRight: 8,
        },
        replyingRowSpacer: {
            opacity: 0,
        },
        replyingSpacerIcon: {
            width: 18,
            height: 18,
        },
        composer: {
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
        commentInput: {
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
        sendButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.gold,
            alignItems: 'center',
            justifyContent: 'center',
        },
        sendButtonDisabled: {
            opacity: 0.35,
        },
        commentActionModal: {
            ...StyleSheet.absoluteFill,
            justifyContent: 'flex-end',
            zIndex: 80,
            elevation: 80,
        },
        commentActionBackdrop: {
            ...StyleSheet.absoluteFill,
            backgroundColor: 'rgba(0,0,0,0.42)',
        },
        commentActionSheet: {
            width: '100%',
            maxWidth: 720,
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
        commentActionHandle: {
            width: 42,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: 'center',
            marginBottom: 15,
        },
        commentActionTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 20,
            textAlign: 'center',
        },
        commentActionHint: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            textAlign: 'center',
            marginTop: 4,
            marginBottom: 14,
        },
        commentActionList: {
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
        },
        commentActionRow: {
            minHeight: 58,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 13,
            backgroundColor: colors.background,
        },
        commentActionRowPressed: {
            backgroundColor: colors.elevated,
        },
        commentActionIcon: {
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        commentActionDangerIcon: {
            backgroundColor: 'rgba(220,80,80,0.10)',
        },
        commentActionText: {
            flex: 1,
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
        },
        commentActionDangerText: {
            color: colors.danger,
        },
        commentActionDivider: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.border,
            marginLeft: 61,
        },
        commentActionCancel: {
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 12,
            borderRadius: 14,
            backgroundColor: colors.elevated,
        },
        commentActionCancelText: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
        },
        commentReportPrivacy: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10,
            lineHeight: 15,
            textAlign: 'center',
            marginTop: 12,
            paddingHorizontal: 4,
        },
        commentReportLoading: {
            ...StyleSheet.absoluteFill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.20)',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
        },
        blockedCommentCard: {
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.elevated,
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 11,
            marginVertical: 4,
        },
        blockedCommentIcon: {
            width: 30,
            height: 30,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            marginRight: 10,
        },
        blockedCommentCopy: {
            flex: 1,
            minWidth: 0,
        },
        blockedCommentTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12.5,
        },
        blockedCommentText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11.5,
            marginTop: 2,
        },
        pressed: {
            opacity: 0.67,
        },
    });
}
