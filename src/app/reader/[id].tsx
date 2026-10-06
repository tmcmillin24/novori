import ValidationWarningSheet from '../../components/ValidationWarningSheet';
import { useReportConfirmation } from '../../lib/use-report-confirmation';
import { moderationMediaUrl } from '../../lib/moderation-media-url';
import { useUiSheetMotion, UiSheetModal, UiSheetSurface, UiSheetBackdrop } from '../../components/UiSheet';
import { useFeedLanguagePreference } from '../../hooks/use-feed-language-preference';
import FeedPostCard from '../../components/FeedPostCard';
import DeletePostConfirmSheet from '../../components/DeletePostConfirmSheet';
import { getPostEditRoute } from '../../lib/post-edit-route';
import ClubEventPostAttachment from '../../components/ClubEventPostAttachment';
import ClubDiscussionPostAttachment from '../../components/ClubDiscussionPostAttachment';
import BookCoverImage from '../../components/BookCoverImage';
import { Ionicons } from '@expo/vector-icons';
import ReadingRecapPostAttachment from '../../components/ReadingRecapPostAttachment';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BlockReaderConfirmSheet from '../../components/BlockReaderConfirmSheet';
import BookStackPostAttachment from '../../components/BookStackPostAttachment';
import BookStackVisual from '../../components/BookStackVisual';
import FeedPostImage from '../../components/FeedPostImage';
import FullScreenImageViewer from '../../components/FullScreenImageViewer';
import PostTypeIdentifier from '../../components/PostTypeIdentifier';
import ReaderProfileActionsSheet from '../../components/ReaderProfileActionsSheet';
import { NovoriColors } from '../../constants/novori-theme';
import { useNovoriTheme } from '../../context/theme-context';
import { BookStack, getPublicBookStacks } from '../../lib/book-stacks';
import { ClubWithMembership, getMyClubs, inviteReaderToClub } from '../../lib/clubs';
import { cancelFollowRequest, FeedPost, getHomeFeed, followReader, PostVoteValue, togglePostVote, deletePost, unfollowReader } from '../../lib/feed';
import { shareProfileLink, sharePostLink } from '../../lib/share-links';
import { getLockedVerifiedCoverUrls } from '../../lib/user-books';
import { PROFILE_BOOK_STATUS_LABELS, sortProfileBooks } from '../../lib/profile-book-order';
import { ReportReason, submitProfileReport, submitPostReport } from '../../lib/reports';
import { blockReader, getReaderProfile, getReaderProfilePosts, getReaderPublicBooks, getReaderPublicOwnedBooks, getReaderPublicClubs, getReaderPublicReviews, isReaderBlockedByViewer, PublicReaderBook, PublicReaderReview, ReaderSocialProfile, unblockReader } from '../../lib/social';
type ReaderTab = 'library' | 'activity' | 'clubs';
type ReaderLibraryTab = 'books' | 'reviews' | 'stacks';
const PROFILE_REPORT_REASONS: Array<{
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
export default function ReaderProfileScreen() {
    const feedLanguage = useFeedLanguagePreference();
    const router = useRouter();
    const params = useLocalSearchParams<{
        id: string;
    }>();
    const { colors, } = useNovoriTheme();
    const insets = useSafeAreaInsets();
    const styles = createStyles(colors);
    const readerId = typeof params.id ===
        'string'
        ? params.id
        : '';
    const [profile, setProfile,] = useState<ReaderSocialProfile | null>(null);
    const [profileImageOpen, setProfileImageOpen,] = useState(false);
    const [books, setBooks,] = useState<PublicReaderBook[]>([]);
    const [reviews, setReviews,] = useState<PublicReaderReview[]>([]);
    const [posts, setPosts,] = useState<FeedPost[]>([]);
    const [clubs, setClubs,] = useState<ClubWithMembership[]>([]);
    const [stacks, setStacks,] = useState<BookStack[]>([]);
    const [votingPostId, setVotingPostId,] = useState<string | null>(null);
    const [activeTab, setActiveTab,] = useState<ReaderTab>('library');
    const [libraryTab, setLibraryTab,] = useState<ReaderLibraryTab>('books');
    const [loading, setLoading,] = useState(true);
    const [refreshing, setRefreshing,] = useState(false);
    const [followLoading, setFollowLoading,] = useState(false);
    const [error, setError,] = useState('');
    const [reportTargetProfile, setReportTargetProfile,] = useState<ReaderSocialProfile | null>(null);
    const [isBlocked, setIsBlocked,] = useState(false);
    const [blockConfirmProfile, setBlockConfirmProfile,] = useState<ReaderSocialProfile | null>(null);
    const [unblockConfirmProfile, setUnblockConfirmProfile,] = useState<ReaderSocialProfile | null>(null);
    const [blockBusy, setBlockBusy,] = useState(false);
    const blockSucceededRef = useRef(false);
    const unblockSucceededRef = useRef(false);
    const [profileActionsOpen, setProfileActionsOpen,] = useState(false);
    const [managerClubs, setManagerClubs,] = useState<ClubWithMembership[]>([]);
    const [inviteClubPickerOpen, setInviteClubPickerOpen,] = useState(false);
    const [invitingClubId, setInvitingClubId,] = useState<string | null>(null);
    const [reportSubmitting, setReportSubmitting,] = useState(false);
    const reportSheetHeight = useRef(0);
    const reportSheetAnimating = useRef(false);
    const reportSheetClosing = useRef(false);
    const reportEntranceStarted = useRef(false);
    const [reportPostTarget, setReportPostTarget] = useState<FeedPost | null>(null);
    const [ownPostTarget, setOwnPostTarget] = useState<FeedPost | null>(null);
    const [ownPostDeleting, setOwnPostDeleting] = useState(false);
    const [ownDeleteConfirmation, setOwnDeleteConfirmation] = useState(false);
    const loadReader = useCallback(async () => {
        if (!readerId) {
            setError('Reader profile not found.');
            setLoading(false);
            return;
        }
        try {
            setError('');
            const [profileData, blockedByViewer,] = await Promise.all([
                getReaderProfile(readerId),
                isReaderBlockedByViewer(readerId)
            ]);
            setProfile(profileData);
            setIsBlocked(blockedByViewer);
            let viewerClubIds = new Set<string>();
            try {
                const myClubData = await getMyClubs();
                viewerClubIds =
                    new Set(myClubData.map((club) => club.id));
                setManagerClubs(myClubData.filter((club) => club.membership_role ===
                    'owner' ||
                    club.membership_role ===
                        'admin'));
            }
            catch (clubLoadError) {
                console.error('Could not load viewer clubs:', clubLoadError);
                setManagerClubs([]);
            }
            if (blockedByViewer) {
                setBooks([]);
                setReviews([]);
                setPosts([]);
                setClubs([]);
                setStacks([]);
                return;
            }
            const [bookData, ownedBookData, reviewData, postData, viewerFeed, clubData, stackData,] = await Promise.all([
                getReaderPublicBooks(readerId),
                getReaderPublicOwnedBooks(readerId).catch((ownedBooksError) => {
                    console.warn('Could not load public owned books:', ownedBooksError);
                    return [];
                }),
                getReaderPublicReviews(readerId),
                getReaderProfilePosts(readerId),
                getHomeFeed(100).catch((feedError) => {
                    console.warn('Could not merge shared-club posts into reader activity:', feedError);
                    return [] as FeedPost[];
                }),
                getReaderPublicClubs(readerId),
                getPublicBookStacks(readerId).catch((stackError) => {
                    console.warn('Could not load reader Book Stacks:', stackError);
                    return [];
                })
            ]);
            const verifiedCovers = await getLockedVerifiedCoverUrls([
                ...bookData,
                ...ownedBookData,
                ...reviewData
            ].map((item) => item.google_book_id));
            function applyVerifiedCover<T extends {
                google_book_id: string;
                cover_url: string | null;
            }>(item: T): T {
                const verifiedCover = verifiedCovers.get(item.google_book_id);
                return verifiedCover
                    ? {
                        ...item,
                        cover_url: verifiedCover,
                    }
                    : item;
            }
            const mergedBookData = Array.from(new Map([
                ...bookData.map(applyVerifiedCover),
                ...ownedBookData.map(applyVerifiedCover)
            ].map((item) => [
                item.id,
                item
            ])).values());
            setBooks(sortProfileBooks(mergedBookData));
            setReviews(reviewData.map(applyVerifiedCover));
            const visibleProfilePosts = postData.filter((post) => !post.club_id ||
                viewerClubIds.has(post.club_id));
            const sharedFeedPosts = viewerFeed.filter((post) => post.author_id ===
                readerId);
            const mergedPosts = Array.from(new Map([
                ...visibleProfilePosts,
                ...sharedFeedPosts
            ].map((post) => [
                post.id,
                post
            ])).values()).sort((a, b) => new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime());
            setPosts(mergedPosts);
            setClubs(clubData);
            setStacks(stackData);
        }
        catch (loadError) {
            console.error('Could not load reader profile:', loadError);
            setError('This reader profile could not be loaded.');
        }
        finally {
            setLoading(false);
        }
    }, [
        readerId
    ]);
    const refreshReader = useCallback(async () => {
        if (refreshing) {
            return;
        }
        setRefreshing(true);
        try {
            await loadReader();
        }
        finally {
            setRefreshing(false);
        }
    }, [
        loadReader,
        refreshing
    ]);
    useFocusEffect(useCallback(() => {
        setLoading(true);
        loadReader();
    }, [
        loadReader
    ]));
    function openProfileReport(post?: FeedPost) {
        if (!profile ||
            profile.is_self ||
            reportSubmitting ||
            reportTargetProfile ||
            reportSheetClosing.current) {
            return;
        }
        reportSheetHeight.current =
            0;
        reportEntranceStarted.current =
            false;
        reportSheetAnimating.current =
            false;
        reportSheetClosing.current =
            false;
        setReportPostTarget(post ?? null);
        setReportTargetProfile(profile);
    }
    function closeProfileReport() {
        if (reportSubmitting ||
            reportSheetClosing.current) {
            return;
        }
        dismissProfileReport();
    }
    function dismissProfileReport(afterClose?: () => void) {
        if (reportSheetClosing.current) {
            return;
        }
        reportSheetClosing.current =
            true;
        reportSheetAnimating.current =
            true;
        uiReport.closeAfterActionWithCallback(afterClose);
    }
    const reportConfirmation = useReportConfirmation(Boolean(reportTargetProfile));
    async function handleProfileReport(reason: ReportReason) {
        if (!reportTargetProfile ||
            reportSubmitting) {
            return;
        }
        try {
            setReportSubmitting(true);
            if (reportPostTarget)
                await submitPostReport(reportPostTarget.id, reason);
            else
                await submitProfileReport(reportTargetProfile.id, reason);
            dismissProfileReport(() => {
                reportConfirmation.queue();
            });
        }
        catch (reportError) {
            console.error('Could not report profile:', reportError);
            Alert.alert('Could not submit report', 'Please try again.');
        }
        finally {
            setReportSubmitting(false);
        }
    }
    function openProfileActions() {
        if (!profile ||
            profile.is_self) {
            return;
        }
        setProfileActionsOpen(true);
    }
    async function shareProfile() {
        if (!profile) {
            return;
        }
        const name = profile.display_name
            ?.trim() ||
            profile.username
                ?.trim() ||
            'Novori Reader';
        const username = profile.username
            ?.trim()
            ? `@${profile.username.trim()}`
            : '';
        setProfileActionsOpen(false);
        try {
            await shareProfileLink({ readerId: profile.id, name: username ? `${name} (${username})` : name });
        }
        catch (shareError) {
            console.error('Could not share profile:', shareError);
        }
    }
    async function inviteProfileToClub(targetClub: ClubWithMembership) {
        if (!profile ||
            invitingClubId) {
            return;
        }
        try {
            setInvitingClubId(targetClub.id);
            await inviteReaderToClub(targetClub.id, profile.id);
            setInviteClubPickerOpen(false);
            Alert.alert('Invitation sent', `${profile.display_name?.trim() ||
                profile.username?.trim() ||
                'This reader'} was invited to ${targetClub.name}.`);
        }
        catch (inviteError) {
            console.error('Could not invite reader from profile:', inviteError);
            Alert.alert('Could not send invitation', inviteError instanceof Error
                ? inviteError.message
                : 'Please try again.');
        }
        finally {
            setInvitingClubId(null);
        }
    }
    async function confirmBlockProfile() {
        if (!blockConfirmProfile ||
            blockBusy) {
            return;
        }
        try {
            setBlockBusy(true);
            blockSucceededRef.current =
                false;
            await blockReader(blockConfirmProfile.id);
            blockSucceededRef.current =
                true;
        }
        catch (blockError) {
            console.error('Could not block reader from profile:', blockError);
            Alert.alert('Could not block reader', blockError instanceof Error
                ? blockError.message
                : 'Please try again.');
            throw blockError;
        }
        finally {
            setBlockBusy(false);
        }
    }
    async function confirmUnblockProfile() {
        if (!unblockConfirmProfile ||
            blockBusy) {
            return;
        }
        try {
            setBlockBusy(true);
            unblockSucceededRef.current =
                false;
            await unblockReader(unblockConfirmProfile.id);
            unblockSucceededRef.current =
                true;
        }
        catch (unblockError) {
            console.error('Could not unblock reader from profile:', unblockError);
            Alert.alert('Could not unblock reader', unblockError instanceof Error
                ? unblockError.message
                : 'Please try again.');
            throw unblockError;
        }
        finally {
            setBlockBusy(false);
        }
    }
    async function toggleFollow() {
        if (!profile ||
            profile.is_self) {
            return;
        }
        if (isBlocked) {
            setUnblockConfirmProfile(profile);
            return;
        }
        try {
            setFollowLoading(true);
            if (profile.is_following) {
                await unfollowReader(profile.id);
            }
            else if (profile.follow_request_pending) {
                await cancelFollowRequest(profile.id);
            }
            else {
                await followReader(profile.id);
            }
            await loadReader();
        }
        catch (followError) {
            console.error('Could not update follow:', followError);
            Alert.alert('Could not update follow', 'Please try again.');
        }
        finally {
            setFollowLoading(false);
        }
    }
    function openConnections(mode: 'followers' | 'following') {
        if (!profile) {
            return;
        }
        if (profile.is_private &&
            !profile.can_view_content) {
            Alert.alert('Private profile', 'Follow this reader and wait for approval to see their connections.');
            return;
        }
        router.push({
            pathname: '/reader-connections',
            params: {
                readerId: profile.id,
                mode,
                name: profile.display_name ??
                    profile.username ??
                    'Reader',
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
    function openBook(googleBookId: string) {
        router.push({
            pathname: '/book/[id]',
            params: {
                id: googleBookId,
            },
        });
    }
    function formatTime(createdAt: string) {
        const created = new Date(createdAt);
        const minutes = Math.max(0, Math.floor((Date.now() -
            created.getTime()) /
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
            setPosts((current) => current.map((post) => post.id ===
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
    function renderPost(post: FeedPost) {
        return <FeedPostCard {...feedLanguage} key={post.id} post={post} currentUserId={profile?.is_self ? profile.id : null} votingPostId={votingPostId} onComments={post => router.push({ pathname: '/post/[id]', params: { id: post.id } })} onVote={handlePostVote} onMore={post => {
                if (profile?.is_self)
                    setOwnPostTarget(post);
                else
                    openProfileReport(post);
            }} onShare={post => { void shareRenderedPost(post.id); }}/>;
    }
    function renderBook(book: PublicReaderBook) {
        const statusLabel = book.status
            ? PROFILE_BOOK_STATUS_LABELS[book.status]
            : book.owned
                ? 'Owned'
                : '';
        return (<Pressable key={book.id} onPress={() => openBook(book.google_book_id)} style={({ pressed }) => [
                styles.publicBookCard,
                pressed &&
                    styles.pressed
            ]}>
        <View style={styles.publicBookCoverWrap}>
          {(book.google_book_id || book.cover_url) ? (<BookCoverImage googleBookId={book.google_book_id} existingCoverUrl={book.cover_url} style={styles.publicBookCover}/>) : (<View style={styles.publicBookCoverFallback}>
              <Ionicons name="book-outline" size={24} color={colors.gold}/>
            </View>)}

          <View style={styles.publicBookStatus}>
            <Text style={styles.publicBookStatusText}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <Text style={styles.publicBookTitle} numberOfLines={2}>
          {book.title}
        </Text>

        <Text style={styles.publicBookAuthor} numberOfLines={1}>
          {book.authors?.[0] ??
                'Unknown author'}
        </Text>
      </Pressable>);
    }
    function renderReview(review: PublicReaderReview) {
        return (<Pressable key={review.id} onPress={() => openBook(review.google_book_id)} style={({ pressed }) => [
                styles.reviewCard,
                pressed &&
                    styles.pressed
            ]}>
        <View style={styles.reviewHeader}>
          {(review.google_book_id || review.cover_url) ? (<BookCoverImage googleBookId={review.google_book_id} existingCoverUrl={review.cover_url} style={styles.reviewCover}/>) : (<View style={styles.reviewCoverFallback}>
              <Ionicons name="book-outline" size={19} color={colors.gold}/>
            </View>)}

          <View style={styles.reviewBookCopy}>
            <Text style={styles.reviewTitle} numberOfLines={2}>
              {review.title}
            </Text>

            <Text style={styles.reviewAuthor} numberOfLines={1}>
              {review.authors?.[0] ??
                'Unknown author'}
            </Text>

            {review.rating !==
                null ? (<View style={styles.reviewRatingRow}>
                <Ionicons name="star" size={13} color={colors.gold}/>

                <Text style={styles.reviewRatingText}>
                  {review.rating.toFixed(1)}
                </Text>
              </View>) : null}
          </View>

          <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
        </View>

        {review.review_text
                ?.trim() ? (<Text style={styles.reviewText}>
            {review.review_text.trim()}
          </Text>) : null}
      </Pressable>);
    }
    function renderClub(club: ClubWithMembership) {
        const initial = club.name
            .charAt(0)
            .toUpperCase();
        return (<Pressable key={club.id} onPress={() => openClub(club.id)} style={({ pressed, }) => [
                styles.clubCard,
                pressed &&
                    styles.pressed
            ]}>
        {club.cover_url ? (<Image source={{
                    uri: moderationMediaUrl(club.cover_url),
                }} style={styles.clubImage}/>) : (<View style={styles.clubImageFallback}>
            <Text style={styles.clubInitial}>
              {initial}
            </Text>
          </View>)}

        <View style={styles.clubCopy}>
          <Text style={styles.clubName} numberOfLines={1}>
            {club.name}
          </Text>

          <Text style={styles.clubMeta}>
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

        <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
      </Pressable>);
    }
    const uiReport = useUiSheetMotion({ visible: Boolean(reportTargetProfile), busy: reportSubmitting, embedded: false, onDismiss: () => {
            const finished = true;
            reportSheetAnimating.current =
                false;
            if (!finished) {
                reportSheetClosing.current =
                    false;
                return;
            }
            setReportTargetProfile(null);
            reportSheetClosing.current =
                false;
            reportEntranceStarted.current =
                false;
            reportSheetHeight.current =
                0;
        } });
    if (loading) {
        return (<SafeAreaView style={styles.safeArea} edges={[
                'top',
                'bottom'
            ]}>
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={colors.gold}/>
        </View>
      </SafeAreaView>);
    }
    if (!profile ||
        error) {
        return (<SafeAreaView style={styles.safeArea} edges={[
                'top',
                'bottom'
            ]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text}/>
          </Pressable>

          <Text style={styles.headerTitle}>
            Reader
          </Text>

          <View style={styles.headerSpacer}/>
        </View>

        <View style={styles.centered}>
          <Text style={styles.errorTitle}>
            Reader unavailable
          </Text>

          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      </SafeAreaView>);
    }
    const displayName = profile.display_name
        ?.trim() ||
        profile.username
            ?.trim() ||
        'Novori Reader';
    const username = profile.username
        ?.trim()
        ? `@${profile.username.trim()}`
        : '';
    const bio = profile.bio
        ?.trim() ||
        'No bio yet.';
    const initial = displayName
        .charAt(0)
        .toUpperCase();
    return (<SafeAreaView style={styles.safeArea} edges={[
            'top'
        ]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [
            styles.headerButton,
            pressed &&
                styles.pressed
        ]}>
          <Ionicons name="chevron-back" size={24} color={colors.text}/>
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          Reader
        </Text>

        {profile.is_self ? (<View style={styles.headerSpacer}/>) : (<Pressable onPress={openProfileActions} hitSlop={10} style={({ pressed }) => [
                styles.headerButton,
                pressed &&
                    styles.pressed
            ]}>
            <Ionicons name="ellipsis-horizontal" size={23} color={colors.text}/>
          </Pressable>)}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} alwaysBounceVertical refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshReader} tintColor={colors.gold} colors={[
                colors.gold
            ]}/>}>
        <View style={styles.profileHeader}>
          {profile.avatar_url ? (<Pressable onPress={() => setProfileImageOpen(true)} accessibilityRole="button" accessibilityLabel="Enlarge profile photo" style={({ pressed }) => [
                pressed &&
                    styles.pressed
            ]}>
              <Image source={{
                uri: moderationMediaUrl(profile.avatar_url),
            }} style={styles.avatar}/>
            </Pressable>) : (<View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>
                {initial}
              </Text>
            </View>)}

          <Text style={styles.name}>
            {displayName}
          </Text>

          {username ? (<Text style={styles.username}>
              {username}
            </Text>) : null}

          {profile.is_private ? (<View style={styles.privateBadge}>
              <Ionicons name="lock-closed" size={11} color={colors.gold}/>

              <Text style={styles.privateBadgeText}>
                Private
              </Text>
            </View>) : null}

          <Text style={styles.bio}>
            {bio}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>
              {books.length}
            </Text>

            <Text style={styles.statLabel}>
              Books
            </Text>
          </View>

          <Pressable onPress={() => openConnections('followers')} style={({ pressed }) => [
            styles.stat,
            pressed &&
                styles.pressed
        ]}>
            <Text style={styles.statNumber}>
              {profile.follower_count}
            </Text>

            <Text style={styles.statLabel}>
              Followers
            </Text>
          </Pressable>

          <Pressable onPress={() => openConnections('following')} style={({ pressed }) => [
            styles.stat,
            pressed &&
                styles.pressed
        ]}>
            <Text style={styles.statNumber}>
              {profile.following_count}
            </Text>

            <Text style={styles.statLabel}>
              Following
            </Text>
          </Pressable>
        </View>

        {profile.is_self ? (<Pressable onPress={() => router.replace('/(tabs)/profile')} style={({ pressed }) => [
                styles.followButtonSecondary,
                pressed &&
                    styles.pressed
            ]}>
            <Text style={styles.followButtonSecondaryText}>
              Open My Profile
            </Text>
          </Pressable>) : (<Pressable disabled={followLoading ||
                blockBusy} onPress={toggleFollow} style={({ pressed }) => [
                isBlocked ||
                    profile.is_following ||
                    profile.follow_request_pending
                    ? styles.followButtonSecondary
                    : styles.followButton,
                pressed &&
                    !followLoading &&
                    !blockBusy &&
                    styles.pressed
            ]}>
            {followLoading ||
                blockBusy ? (<ActivityIndicator size="small" color={isBlocked ||
                    profile.is_following ||
                    profile.follow_request_pending
                    ? colors.text
                    : colors.background}/>) : (<>
                <Ionicons name={isBlocked
                    ? 'ban-outline'
                    : profile.is_following
                        ? 'checkmark'
                        : profile.follow_request_pending
                            ? 'time-outline'
                            : profile.is_private
                                ? 'lock-closed-outline'
                                : 'person-add-outline'} size={17} color={isBlocked ||
                    profile.is_following ||
                    profile.follow_request_pending
                    ? colors.text
                    : colors.background}/>

                <Text style={isBlocked ||
                    profile.is_following ||
                    profile.follow_request_pending
                    ? styles.followButtonSecondaryText
                    : styles.followButtonText}>
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
              </>)}
          </Pressable>)}

        {isBlocked &&
            !profile.is_self ? (<View style={styles.privateLockedCard}>
            <View style={styles.privateLockedIcon}>
              <Ionicons name="ban-outline" size={25} color={colors.gold}/>
            </View>

            <Text style={styles.emptyTitle}>
              You blocked this reader.
            </Text>

            <Text style={styles.emptyText}>
              Their posts and comments are hidden from you. Tap Blocked above if you want to unblock them.
            </Text>
          </View>) : profile.is_private &&
            !profile.can_view_content &&
            !profile.is_self ? (<View style={styles.privateLockedCard}>
            <View style={styles.privateLockedIcon}>
              <Ionicons name="lock-closed" size={25} color={colors.gold}/>
            </View>

            <Text style={styles.emptyTitle}>
              This profile is private.
            </Text>

            <Text style={styles.emptyText}>
              Send a follow request to see this reader’s books, reviews, posts, clubs, and connections.
            </Text>

            {profile.follow_request_pending ? (<Text style={styles.requestPendingText}>
                Follow request pending
              </Text>) : null}
          </View>) : (<>
        <View style={styles.tabRow}>
          {([
                {
                    key: 'library',
                    label: 'Library',
                },
                {
                    key: 'activity',
                    label: 'Activity',
                },
                {
                    key: 'clubs',
                    label: 'Clubs',
                }
            ] as {
                key: ReaderTab;
                label: string;
            }[]).map((tab) => (<Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={[
                    styles.tabButton,
                    activeTab ===
                        tab.key &&
                        styles.tabButtonActive
                ]}>
                <Text style={[
                    styles.tabText,
                    activeTab ===
                        tab.key &&
                        styles.tabTextActive
                ]}>
                  {tab.label}
                </Text>
              </Pressable>))}
        </View>

        {activeTab ===
                'library' ? (<>
            <View style={styles.libraryTabRow}>
              {([
                    {
                        key: 'books',
                        label: 'Books',
                    },
                    {
                        key: 'reviews',
                        label: 'Reviews',
                    },
                    {
                        key: 'stacks',
                        label: 'Stacks',
                    }
                ] as {
                    key: ReaderLibraryTab;
                    label: string;
                }[]).map((tab) => (<Pressable key={tab.key} onPress={() => setLibraryTab(tab.key)} style={[
                        styles.libraryTabButton,
                        libraryTab ===
                            tab.key &&
                            styles.libraryTabButtonActive
                    ]}>
                    <Text style={[
                        styles.libraryTabText,
                        libraryTab ===
                            tab.key &&
                            styles.libraryTabTextActive
                    ]}>
                      {tab.label}
                    </Text>
                  </Pressable>))}
            </View>

            {libraryTab ===
                    'books' ? (!profile.can_view_books ? (<View style={styles.emptyCard}>
                  <Ionicons name="lock-closed-outline" size={26} color={colors.gold}/>

                  <Text style={styles.emptyTitle}>
                    Books are private.
                  </Text>

                  <Text style={styles.emptyText}>
                    This reader has chosen not to show their reading history publicly.
                  </Text>
                </View>) : books.length >
                    0 ? (<View style={styles.publicBookGrid}>
                  {books.map(renderBook)}
                </View>) : (<View style={styles.emptyCard}>
                  <Ionicons name="library-outline" size={26} color={colors.gold}/>

                  <Text style={styles.emptyTitle}>
                    No books to show yet.
                  </Text>

                  <Text style={styles.emptyText}>
                    Reading, TBR, Read, and DNF books appear here in that order when they are visible on this profile.
                  </Text>
                </View>)) : libraryTab ===
                    'reviews' ? (!profile.can_view_reviews ? (<View style={styles.emptyCard}>
                  <Ionicons name="lock-closed-outline" size={26} color={colors.gold}/>

                  <Text style={styles.emptyTitle}>
                    Reviews are private.
                  </Text>

                  <Text style={styles.emptyText}>
                    This reader has chosen not to show ratings and reviews publicly.
                  </Text>
                </View>) : reviews.length >
                    0 ? (<View style={styles.list}>
                  {reviews.map(renderReview)}
                </View>) : (<View style={styles.emptyCard}>
                  <Ionicons name="star-outline" size={26} color={colors.gold}/>

                  <Text style={styles.emptyTitle}>
                    No reviews yet.
                  </Text>

                  <Text style={styles.emptyText}>
                    Ratings and written reviews will appear here.
                  </Text>
                </View>)) : stacks.length >
                    0 ? (<View style={styles.stackGrid}>
                {stacks.map((stack) => (<Pressable key={stack.id} onPress={() => router.push({
                            pathname: '/stack/[id]',
                            params: {
                                id: stack.id,
                            },
                        })} style={({ pressed }) => [
                            styles.stackTile,
                            pressed &&
                                styles.pressed
                        ]}>
                      <View style={styles.stackTileVisual}>
                        <BookStackVisual variant="profile" items={stack.items}/>
                      </View>

                      <Text style={styles.stackTileTitle} numberOfLines={2}>
                        {stack.name}
                      </Text>

                      <Text style={styles.stackTileMeta}>
                        {stack.items.length}{' '}
                        {stack.items.length ===
                            1
                            ? 'book'
                            : 'books'}
                      </Text>
                    </Pressable>))}
              </View>) : (<View style={styles.emptyCard}>
                <Ionicons name="albums-outline" size={26} color={colors.gold}/>

                <Text style={styles.emptyTitle}>
                  No Book Stacks yet.
                </Text>

                <Text style={styles.emptyText}>
                  Book Stacks saved to this profile will appear here.
                </Text>
              </View>)}
          </>) : activeTab ===
                'activity' ? (posts.length >
                0 ? (<View style={styles.list}>
              {posts.map(renderPost)}
            </View>) : (<View style={styles.emptyCard}>
              <Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.gold}/>

              <Text style={styles.emptyTitle}>
                No activity yet.
              </Text>

              <Text style={styles.emptyText}>
                Posts, reading updates, Ask Readers questions, and shared reviews will appear here.
              </Text>
            </View>)) : clubs.length >
                0 ? (<View style={styles.list}>
            {clubs.map(renderClub)}
          </View>) : (<View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={26} color={colors.gold}/>

            <Text style={styles.emptyTitle}>
              No public clubs yet.
            </Text>

            <Text style={styles.emptyText}>
              Public clubs this reader belongs to will appear here. Private memberships stay private.
            </Text>
          </View>)}
          </>)}
      </ScrollView>
      <ReaderProfileActionsSheet visible={profileActionsOpen} isBlocked={isBlocked} canInviteToClub={managerClubs.length >
            0} onInviteToClub={() => setInviteClubPickerOpen(true)} onBlock={() => {
            if (profile) {
                setBlockConfirmProfile(profile);
            }
        }} onUnblock={() => {
            if (profile) {
                setUnblockConfirmProfile(profile);
            }
        }} onReport={() => openProfileReport()} onShare={() => void shareProfile()} onDismiss={() => setProfileActionsOpen(false)}/>

      <Modal visible={inviteClubPickerOpen} transparent animationType="fade" onRequestClose={() => setInviteClubPickerOpen(false)}>
        <View style={styles.profileActionsBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInviteClubPickerOpen(false)}/>

          <View style={[
            styles.profileActionsSheet,
            {
                paddingBottom: Math.max(18, insets.bottom +
                    12),
            }
        ]}>
            <View style={styles.profileActionsHandle}/>

            <Text style={styles.profileActionsTitle}>
              Invite to a club
            </Text>

            <Text style={styles.profileActionsHint}>
              Choose one of the clubs you manage.
            </Text>

            {managerClubs.map((managedClub, index) => (<View key={managedClub.id}>
                  {index >
                0 ? (<View style={styles.profileActionsDivider}/>) : null}

                  <Pressable disabled={Boolean(invitingClubId)} onPress={() => void inviteProfileToClub(managedClub)} style={({ pressed }) => [
                styles.profileActionsRow,
                pressed &&
                    styles.pressed
            ]}>
                    <Ionicons name="people-outline" size={19} color={colors.gold}/>

                    <View style={styles.profileInviteClubCopy}>
                      <Text style={styles.profileActionsText} numberOfLines={1}>
                        {managedClub.name}
                      </Text>

                      <Text style={styles.profileInviteClubRole}>
                        {managedClub.membership_role ===
                'owner'
                ? 'Owner'
                : 'Admin'}
                      </Text>
                    </View>

                    {invitingClubId ===
                managedClub.id ? (<ActivityIndicator size="small" color={colors.gold}/>) : (<Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>)}
                  </Pressable>
                </View>))}
          </View>
        </View>
      </Modal>

      <BlockReaderConfirmSheet visible={Boolean(blockConfirmProfile)} readerName={blockConfirmProfile?.display_name
            ?.trim() ||
            blockConfirmProfile?.username
                ?.trim() ||
            'this reader'} busy={blockBusy} onConfirm={confirmBlockProfile} onDismiss={() => {
            const didBlock = blockSucceededRef.current;
            blockSucceededRef.current =
                false;
            setBlockConfirmProfile(null);
            if (didBlock) {
                setIsBlocked(true);
                setBooks([]);
                setReviews([]);
                setPosts([]);
                setClubs([]);
            }
        }}/>

      <BlockReaderConfirmSheet visible={Boolean(unblockConfirmProfile)} readerName={unblockConfirmProfile?.display_name
            ?.trim() ||
            unblockConfirmProfile?.username
                ?.trim() ||
            'this reader'} mode="unblock" busy={blockBusy} onConfirm={confirmUnblockProfile} onDismiss={() => {
            const didUnblock = unblockSucceededRef.current;
            unblockSucceededRef.current =
                false;
            setUnblockConfirmProfile(null);
            if (didUnblock) {
                setIsBlocked(false);
                void loadReader();
            }
        }}/>

      <UiSheetModal onDismiss={reportConfirmation.afterDismiss} visible={Boolean(reportTargetProfile)} transparent animationType="none" onRequestClose={closeProfileReport} motion={uiReport}>
        <Pressable style={styles.reportBackdrop} onPress={closeProfileReport}>
          <UiSheetBackdrop pointerEvents="none" style={[
            styles.reportBackdropVisual,
            {}
        ]} motion={uiReport}/>

          <UiSheetSurface style={[
            styles.reportSheet,
            {
                paddingBottom: Math.max(18, insets.bottom +
                    12)
            }
        ]} motion={uiReport}>
            <Pressable onPress={(event) => event.stopPropagation()}>
              <View style={styles.reportHandle}/>

              <View style={styles.reportHeadingRow}>
                <View style={styles.reportHeadingCopy}>
                  <Text style={styles.reportTitle}>
                    {reportPostTarget ? 'Report post' : 'Report profile'}
                  </Text>

                  <Text style={styles.reportSubtitle}>
                    {reportPostTarget ? 'Why are you reporting this post?' : 'Why are you reporting this profile?'}
                  </Text>
                </View>

                <Pressable onPress={closeProfileReport} hitSlop={10} style={({ pressed }) => [
            styles.reportCloseButton,
            pressed &&
                styles.pressed
        ]}>
                  <Ionicons name="close" size={21} color={colors.text}/>
                </Pressable>
              </View>

              <View style={styles.reportReasonList}>
                {PROFILE_REPORT_REASONS.map((reason) => (<Pressable key={reason.value} disabled={reportSubmitting} onPress={() => void handleProfileReport(reason.value)} style={({ pressed }) => [
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
                Reports are private. This reader won’t be told who reported them.
              </Text>

              {reportSubmitting ? (<View style={styles.reportSubmitting}>
                  <ActivityIndicator size="small" color={colors.gold}/>
                </View>) : null}
            </Pressable>
          </UiSheetSurface>
        </Pressable>
      </UiSheetModal>

      <FullScreenImageViewer visible={profileImageOpen} uri={profile.avatar_url} onClose={() => setProfileImageOpen(false)} shape="circle"/>
      <DeletePostConfirmSheet visible={!!ownPostTarget} icon="ellipsis-horizontal" title={ownDeleteConfirmation ? 'Delete post?' : 'Post options'} message={ownDeleteConfirmation ? 'This post and its comments will be permanently deleted. This cannot be undone.' : 'Manage your post.'} confirmLabel={ownDeleteConfirmation ? 'Delete permanently' : 'Delete post'} busy={ownPostDeleting} onDismiss={() => {
            if (!ownPostDeleting) {
                setOwnPostTarget(null);
                setOwnDeleteConfirmation(false);
            }
        }} onConfirm={async () => {
            if (!ownPostTarget)
                return;
            if (!ownDeleteConfirmation) {
                setOwnDeleteConfirmation(true);
                return;
            }
            setOwnPostDeleting(true);
            try {
                await deletePost(ownPostTarget.id);
                setPosts(current => current.filter(post => post.id !== ownPostTarget.id));
                setOwnPostTarget(null);
                setOwnDeleteConfirmation(false);
            }
            catch {
                Alert.alert('Could not delete post', 'Please try again.');
            }
            finally {
                setOwnPostDeleting(false);
            }
        }}>
        {!ownDeleteConfirmation && ownPostTarget ? <Pressable accessibilityRole="button" accessibilityLabel="Edit post" onPress={() => { const route = getPostEditRoute(ownPostTarget); setOwnPostTarget(null); router.push(route); }} style={{ paddingVertical: 14, alignItems: 'center' }}><Text style={{ color: colors.gold, fontFamily: 'Inter_600SemiBold' }}>Edit post</Text></Pressable> : null}
      </DeletePostConfirmSheet>
      <ValidationWarningSheet visible={reportConfirmation.visible} title="Report submitted" message="Thanks for letting us know. Your report has been submitted for review." icon="checkmark-circle-outline" dismissLabel="Got it" onDismiss={reportConfirmation.dismiss}/>
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
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 20,
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
        profileHeader: {
            alignItems: 'center',
        },
        avatar: {
            width: 104,
            height: 104,
            borderRadius: 52,
            backgroundColor: colors.elevated,
        },
        avatarFallback: {
            width: 104,
            height: 104,
            borderRadius: 52,
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        avatarText: {
            color: colors.gold,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 40,
        },
        name: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 27,
            marginTop: 14,
            textAlign: 'center',
        },
        username: {
            color: colors.mutedText,
            fontFamily: 'Inter_500Medium',
            fontSize: 13,
            marginTop: 4,
        },
        privateBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: colors.elevated,
            borderRadius: 9,
            paddingHorizontal: 7,
            paddingVertical: 4,
            marginTop: 7,
        },
        privateBadgeText: {
            color: colors.gold,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 9,
        },
        bio: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            lineHeight: 20,
            textAlign: 'center',
            maxWidth: 520,
            marginTop: 12,
        },
        statsRow: {
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 17,
            marginTop: 22,
            overflow: 'hidden',
        },
        stat: {
            flex: 1,
            minHeight: 70,
            alignItems: 'center',
            justifyContent: 'center',
        },
        statNumber: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 16,
        },
        statLabel: {
            color: colors.mutedText,
            fontFamily: 'Inter_500Medium',
            fontSize: 10,
            marginTop: 4,
        },
        followButton: {
            minHeight: 46,
            backgroundColor: colors.gold,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            marginTop: 14,
        },
        followButtonText: {
            color: colors.background,
            fontFamily: 'Inter_700Bold',
            fontSize: 13,
        },
        followButtonSecondary: {
            minHeight: 46,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            marginTop: 14,
        },
        followButtonSecondaryText: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 13,
        },
        privateLockedCard: {
            minHeight: 220,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 28,
            paddingVertical: 30,
            marginTop: 18,
        },
        privateLockedIcon: {
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 13,
        },
        requestPendingText: {
            color: colors.gold,
            fontFamily: 'Inter_700Bold',
            fontSize: 10,
            marginTop: 13,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
        },
        tabRow: {
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            marginTop: 28,
            marginBottom: 14,
        },
        libraryTabRow: {
            flexDirection: 'row',
            alignSelf: 'center',
            marginTop: 12,
            marginBottom: 16,
            gap: 18,
            paddingHorizontal: 4,
        },
        libraryTabButton: {
            minHeight: 32,
            justifyContent: 'center',
            borderBottomWidth: 2,
            borderBottomColor: 'transparent',
            paddingHorizontal: 4,
        },
        libraryTabButtonActive: {
            borderBottomColor: colors.gold,
        },
        libraryTabText: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12,
        },
        libraryTabTextActive: {
            color: colors.gold,
            fontFamily: 'Inter_700Bold',
            fontSize: 12,
        },
        tabButton: {
            flex: 1,
            alignItems: 'center',
            paddingVertical: 12,
            borderBottomWidth: 2,
            borderBottomColor: 'transparent',
        },
        tabButtonActive: {
            borderBottomColor: colors.gold,
        },
        tabText: {
            color: colors.mutedText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10,
        },
        tabTextActive: {
            color: colors.text,
        },
        list: {
            gap: 11,
        },
        stackGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            columnGap: 12,
            rowGap: 18,
            marginTop: 16,
        },
        stackTile: {
            width: '48%',
            minHeight: 225,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 17,
            backgroundColor: colors.surface,
            padding: 12,
            overflow: 'hidden',
        },
        stackTileVisual: {
            height: 145,
            alignItems: 'center',
            justifyContent: 'flex-start',
            overflow: 'hidden',
        },
        stackTileTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_600SemiBold',
            fontSize: 15,
            lineHeight: 20,
            marginTop: 8,
        },
        stackTileMeta: {
            color: colors.mutedText,
            fontFamily: 'Inter_500Medium',
            fontSize: 10,
            marginTop: 5,
        },
        publicBookGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
        },
        postVoteRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 15,
        },
        postVoteButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        postVoteButtonActive: {
            backgroundColor: colors.elevated,
        },
        postVoteButtonDisabled: {
            opacity: 0.55,
        },
        postVoteScore: {
            minWidth: 24,
            color: colors.secondaryText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12,
            textAlign: 'center',
        },
        postVoteScoreActive: {
            color: colors.gold,
        },
        publicBookCard: {
            width: '31%',
            minWidth: 96,
        },
        publicBookCoverWrap: {
            width: '100%',
            aspectRatio: 0.66,
            borderRadius: 11,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            position: 'relative',
        },
        publicBookCover: {
            width: '100%',
            height: '100%',
        },
        publicBookCoverFallback: {
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.elevated,
        },
        publicBookStatus: {
            position: 'absolute',
            left: 6,
            bottom: 6,
            backgroundColor: colors.background,
            borderRadius: 7,
            paddingHorizontal: 6,
            paddingVertical: 3,
        },
        publicBookStatusText: {
            color: colors.gold,
            fontFamily: 'Inter_700Bold',
            fontSize: 8,
        },
        publicBookTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11,
            lineHeight: 15,
            marginTop: 6,
        },
        publicBookAuthor: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 9,
            marginTop: 2,
        },
        reviewCard: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 17,
            padding: 13,
        },
        reviewHeader: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        reviewCover: {
            width: 46,
            height: 68,
            borderRadius: 7,
            backgroundColor: colors.elevated,
            marginRight: 11,
        },
        reviewCoverFallback: {
            width: 46,
            height: 68,
            borderRadius: 7,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 11,
        },
        reviewBookCopy: {
            flex: 1,
            minWidth: 0,
        },
        reviewTitle: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 13,
            lineHeight: 18,
        },
        reviewAuthor: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10,
            marginTop: 3,
        },
        reviewRatingRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 6,
        },
        reviewRatingText: {
            color: colors.gold,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11,
        },
        reviewText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            lineHeight: 18,
            marginTop: 12,
        },
        postCard: {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 22,
            overflow: 'hidden',
            shadowColor: '#000000',
            shadowOpacity: 0.1,
            shadowRadius: 14,
            shadowOffset: {
                width: 0,
                height: 5,
            },
            elevation: 3,
        },
        postHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            paddingHorizontal: 16,
            paddingTop: 15,
        },
        postAvatar: {
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            marginRight: 12,
        },
        postAvatarFallback: {
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
            gap: 6,
            minWidth: 0,
        },
        postAuthorName: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 13.5,
            flexShrink: 0,
        },
        postUsername: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11.5,
            flex: 1,
            flexShrink: 1,
            minWidth: 0,
        },
        postContent: {
            paddingHorizontal: 16,
            paddingTop: 11,
        },
        postHeaderShare: {
            width: 34,
            height: 34,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 4,
            marginTop: -2,
        },
        postMetaRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
        },
        postMetaText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10,
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
            marginTop: 11,
        },
        compactBookLink: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            paddingVertical: 6,
        },
        compactBookCopy: {
            flex: 1,
            minWidth: 0,
        },
        bookCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.elevated,
            borderRadius: 12,
            padding: 9,
            marginTop: 12,
        },
        bookCover: {
            width: 36,
            height: 52,
            borderRadius: 5,
            backgroundColor: colors.surface,
            marginRight: 9,
        },
        bookCoverFallback: {
            width: 36,
            height: 52,
            borderRadius: 5,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 9,
        },
        bookCopy: {
            flex: 1,
        },
        bookAuthor: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10.5,
            marginTop: 2,
        },
        bookTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 12,
            lineHeight: 17,
        },
        bookRating: {
            color: colors.gold,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11,
            marginTop: 4,
        },
        clubCard: {
            minHeight: 72,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            padding: 11,
        },
        clubImage: {
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: colors.elevated,
            marginRight: 11,
        },
        clubImageFallback: {
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 11,
        },
        clubInitial: {
            color: colors.gold,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 20,
        },
        clubCopy: {
            flex: 1,
            minWidth: 0,
        },
        clubName: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 13,
        },
        clubMeta: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10,
            marginTop: 4,
        },
        emptyCard: {
            minHeight: 190,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
        },
        emptyTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 18,
            marginTop: 10,
            textAlign: 'center',
        },
        emptyText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            lineHeight: 17,
            textAlign: 'center',
            marginTop: 6,
            maxWidth: 430,
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
        },
        errorText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            marginTop: 7,
            textAlign: 'center',
        },
        profileActionsBackdrop: {
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.48)',
        },
        profileActionsSheet: {
            width: '100%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 16,
            paddingTop: 10,
            overflow: 'hidden',
        },
        profileActionsHandle: {
            width: 42,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: 'center',
            marginBottom: 13,
        },
        profileActionsTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 19,
            marginBottom: 12,
        },
        profileActionsRow: {
            minHeight: 58,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 12,
        },
        profileActionsText: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
        },
        profileActionsHint: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12.5,
            lineHeight: 18,
            marginBottom: 8,
            paddingHorizontal: 12,
        },
        profileInviteClubCopy: {
            flex: 1,
            minWidth: 0,
        },
        profileInviteClubRole: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            marginTop: 2,
        },
        profileActionsDivider: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.border,
            marginLeft: 12,
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
        pressed: {
            opacity: 0.68,
        },
    });
}
