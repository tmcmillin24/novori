import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useFocusEffect,useNavigation,useRouter } from 'expo-router';
import { useCallback,useEffect,useRef,useState } from 'react';
import { ActivityIndicator,Alert,Keyboard,Pressable,RefreshControl,ScrollView,StyleSheet,Text,TextInput,useWindowDimensions,View } from 'react-native';
import { SafeAreaView,useSafeAreaInsets } from 'react-native-safe-area-context';
import CachedMediaImage from '../../components/CachedMediaImage';
import FeedPostCard from '../../components/FeedPostCard';
import PostActions from '../../components/PostActions';
import { usePostCommentsSheet } from '../../components/usePostCommentsSheet';
import { CLUB_GENRES,ClubGenreKey,getClubGenreLabel } from '../../constants/club-genres';
import { NovoriColors } from '../../constants/novori-theme';
import { useNovoriTheme } from '../../context/theme-context';
import { useTutorial,useTutorialTarget } from '../../context/tutorial-context';
import { getAccountEntryRoute } from '../../lib/account-entry';
import { rememberAccountRestriction,restrictedAccountRoute } from '../../lib/account-restriction-notice';
import { isAccountRestrictedError,isAccountUnavailableError } from '../../lib/account-session-errors';
import { currentFeedComposerPreviewKey } from '../../lib/club-composer-preview';
import { ClubWithMembership,getDiscoverClubs,getMyClubs,searchClubs } from '../../lib/clubs';
import { containsExplicitLanguage,getExplicitLanguagePreference,isExplicitContentRevealed,revealExplicitContentOnce,setExplicitLanguagePreference } from '../../lib/content-filter';
import { FeedPost,getHomeFeed,getPostMutationVersion,PostVoteValue,togglePostVote } from '../../lib/feed';
import { moderationMediaUrl } from '../../lib/moderation-media-url';
import { getNotificationAttentionCount } from '../../lib/notifications';
import { isTransientReadError } from '../../lib/session-read-cache';
import { sharePostLink } from '../../lib/share-links';
import { signOutCurrentDevice } from '../../lib/sign-out';
import { supabase } from '../../lib/supabase';
import { useNotificationAttention } from '../../lib/use-notification-attention';
type HomeSection = 'feed' | 'clubs';
type ComposerProfile = {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
};
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
    const { height: windowHeight, width: windowWidth, } = useWindowDimensions();
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
    const [composerProfile, setComposerProfile,] = useState<ComposerProfile | null>(null);
    const [myClubs, setMyClubs,] = useState<ClubWithMembership[]>([]);
    const [discoverClubs, setDiscoverClubs,] = useState<ClubWithMembership[]>([]);
    const [clubsLoading, setClubsLoading,] = useState(true);
    const [feedPosts, setFeedPosts,] = useState<FeedPost[]>([]);
    const {openCommentsSheet, commentsModalVisible, sheet} = usePostCommentsSheet({setFeedPosts, composerProfile, onNavigate: () => { preserveHomeStateOnNextBlur.current = true; }});
    const [feedLoading, setFeedLoading,] = useState(true);
    const [feedError, setFeedError,] = useState('');
    const [refreshing, setRefreshing,] = useState(false);
    const [allowExplicitLanguage, setAllowExplicitLanguage,] = useState(false);
    const [revealedExplicitPosts, setRevealedExplicitPosts,] = useState<Record<string, boolean>>({});
    const [revealedExplicitComments, setRevealedExplicitComments,] = useState<Record<string, boolean>>({});
    const [votingPostId, setVotingPostId,] = useState<string | null>(null);
    const [ownPostOptionsTarget, setOwnPostOptionsTarget,] = useState<FeedPost | null>(null);
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
    const homeLoadSequence = useRef(0);
    const loadHomeData = useCallback(async (showClubLoader = false) => {
        const request = ++homeLoadSequence.current;
        const mutationAtStart = getPostMutationVersion();
        let redirecting = false;
        const isCurrent = () => request === homeLoadSequence.current && !redirecting;
        if (showClubLoader) {
            setClubsLoading(true);
            setFeedLoading(true);
        }
        const accountRoute = await getAccountEntryRoute().catch(() => null);
        if (!isCurrent()) return;
        if (accountRoute) {
            setFeedLoading(false);
            setClubsLoading(false);
            router.replace(accountRoute);
            return;
        }

        async function redirectIfUnavailable(error: unknown) {
            if (!isCurrent() || !isAccountUnavailableError(error)) return;
            redirecting = true;
            const restricted = isAccountRestrictedError(error);
            if (restricted) rememberAccountRestriction();
            setFeedLoading(false);
            setClubsLoading(false);
            const route = restricted ? restrictedAccountRoute : await getAccountEntryRoute().catch(() => null);
            if (request !== homeLoadSequence.current) return;
            if (!route || restricted) await signOutCurrentDevice().catch(() => {});
            if (request === homeLoadSequence.current) router.replace(route ?? '/auth');
        }

        async function section<T>(promise: Promise<T>, apply: (data: T) => void, onError: (error: unknown) => void) {
            try {
                const data = await promise;
                if (isCurrent()) apply(data);
            } catch (error) {
                if (!isCurrent()) return;
                if (isAccountUnavailableError(error)) await redirectIfUnavailable(error);
                else onError(error);
            }
        }

        // Feed readiness is independent from the club directory and the bell.
        const feed = section(getHomeFeed(), posts => {
            setFeedPosts(posts);
            setFeedError('');
            hasLoadedHomeData.current = true;
            lastHomeDataLoadAt.current = Date.now();
            lastSeenPostMutationRef.current = mutationAtStart;
        }, error => {
            console.warn('Could not load Home feed:', error);
            if (!hasLoadedHomeData.current) setFeedError('Could not load your feed.');
        });

        void section(getNotificationAttentionCount(), setAttentionCount, () => {
            console.warn('[Novori notifications] Home badge refresh deferred; keeping the last count.');
        });
        void Promise.all([
            section(getMyClubs(), setMyClubs, error => console.warn('Could not load your clubs:', error)),
            section(getDiscoverClubs(), setDiscoverClubs, error => console.warn('Could not load discover clubs:', error)),
        ]).then(() => {
            if (isCurrent()) setClubsLoading(false);
        });
        await feed;
        if (isCurrent()) setFeedLoading(false);
    }, []);
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
    useNotificationAttention(setAttentionCount);

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
    function renderClubCard(club: ClubWithMembership, compact = false, separated = false) {
        const role = club.membership_role === 'owner' ? 'Owner' : club.membership_role === 'admin' ? 'Admin' : club.membership_role ? 'Member' : null;
        const count = club.member_count.toLocaleString();
        const genre = club.genres?.[0];
        return (
          <Pressable key={club.id} accessibilityRole="button" accessibilityLabel={`Open ${club.name}`}
            onPress={() => openClub(club.id)} style={({ pressed }) => [
              styles.clubCard, compact && styles.compactClubCard, separated && styles.clubRowDivider, pressed && styles.pressed,
            ]}>
            {club.cover_url ? <CachedMediaImage source={{ uri: moderationMediaUrl(club.cover_url) }}
              style={[styles.clubImage, compact && styles.compactClubImage]}/> : (
              <View style={[styles.clubImage, compact && styles.compactClubImage, styles.clubImageFallback]}>
                <Text style={styles.clubInitial}>{club.name.trim().charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.clubCardCopy}>
              <Text style={styles.clubName} numberOfLines={2}>{club.name}</Text>
              <View style={styles.clubMetaRow}>
                <Ionicons name={club.privacy === 'public' ? 'earth-outline' : 'lock-closed-outline'} size={12} color={colors.mutedText}/>
                <Text style={styles.clubMetaText}>{club.privacy === 'public' ? 'Public' : 'Private'} · {count} {club.member_count === 1 ? 'member' : 'members'}</Text>
                {role ? <Text style={styles.clubRoleText}>· {role}</Text> : null}
              </View>
              {!compact && club.description?.trim() ? <Text style={styles.clubDescription} numberOfLines={2}>{club.description}</Text> : null}
              {!compact && genre ? <Text style={styles.clubGenreText} numberOfLines={1}>
                {getClubGenreLabel(genre)}{club.genres.length > 1 ? ` +${club.genres.length - 1}` : ''}
              </Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedText}/>
          </Pressable>
        );
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
        return <FeedPostCard key={post.id} post={post} currentUserId={currentUserId} votingPostId={votingPostId} onOpen={post => router.push({ pathname: '/post/[id]', params: { id: post.id } })} onComments={openCommentsSheet} onVote={handlePostVote} onMore={setOwnPostOptionsTarget} onShare={shareFeedPost} onReader={openReader} onClub={openClub} renderText={renderExplicitContentWarning}/>;
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

          <Pressable onPress={() => router.push({ pathname: '/create-post', params: { previewKey: currentFeedComposerPreviewKey() } })} style={({ pressed }) => [
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

          <Pressable onPress={() => router.push({ pathname: '/create-post', params: { previewKey: currentFeedComposerPreviewKey() } })} style={({ pressed }) => [
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
        const isSearching = Boolean(clubSearch.trim());
        const filteredDiscoverClubs = activeClubGenre ===
            'all'
            ? discoverClubs
            : discoverClubs.filter((club) => club.genres?.includes(activeClubGenre));
        return (<View>
        <View style={styles.clubSearchWrap}>
          <Ionicons name="search-outline" size={19} color={colors.mutedText}/>

          <TextInput value={clubSearch} onChangeText={setClubSearch} accessibilityLabel="Search clubs by name or ID" placeholder="Search clubs" placeholderTextColor={colors.mutedText} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={styles.clubSearchInput}/>

          {clubSearch ? (<Pressable accessibilityRole="button" accessibilityLabel="Clear club search" onPress={() => setClubSearch('')} hitSlop={8} style={({ pressed, }) => [
                    styles.clubSearchClear,
                    pressed &&
                        styles.pressed
                ]}>
              <Ionicons name="close-circle" size={19} color={colors.mutedText}/>
            </Pressable>) : null}
        </View>

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
                {clubSearchResults.map((club, index) => renderClubCard(club, false, index > 0))}
              </View>) : (<View style={styles.searchEmpty}>
                <Ionicons name="search-outline" size={25} color={colors.mutedText}/>

                <Text style={styles.searchEmptyTitle}>
                  No clubs found
                </Text>

                <Text style={styles.searchEmptyText}>
                  Try a different club name or paste an exact club ID.
                </Text>
              </View>)}
          </View>) : clubsLoading && !myClubs.length && !discoverClubs.length ? (
            <View style={styles.clubsLoading}><ActivityIndicator size="small" color={colors.gold}/></View>
          ) : (<>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Your Clubs
            </Text>

            <Text style={styles.sectionSubtitle}>
              {myClubs.length ? `${myClubs.length} ${myClubs.length === 1 ? 'club' : 'clubs'}` : 'Find your next reading group'}
            </Text>
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel="Create a club" onPress={() => router.push('/create-club')} style={({ pressed }) => [
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
            {myClubs.map((club, index) => renderClubCard(club, true, index > 0))}
          </View>) : (<View style={styles.emptyClubsCard}>
            <View style={styles.emptyClubsIcon}><Ionicons name="people-outline" size={22} color={colors.gold}/></View>
            <View style={styles.emptyClubsCopy}>
              <Text style={styles.emptyClubsTitle}>No clubs joined yet</Text>
              <Text style={styles.emptyClubsText}>Browse public clubs below or create one of your own.</Text>
            </View>
          </View>)}

        <View style={styles.discoverHeader}>
          <Text style={styles.sectionTitle}>
            Discover Clubs
          </Text>

          <Text style={styles.sectionSubtitle}>
            Find a public club by genre.
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.clubGenreFilterRow} style={styles.clubGenreFilterScroll}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: activeClubGenre === 'all' }} onPress={() => setActiveClubGenre('all')} style={[
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
                    return (<Pressable key={genre.key} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setActiveClubGenre(genre.key)} style={[
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
            {filteredDiscoverClubs.map((club, index) => renderClubCard(club, false, index > 0))}
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

      <PostActions post={ownPostOptionsTarget} currentUserId={currentUserId}
        onDismiss={() => setOwnPostOptionsTarget(null)}
        onDeleted={post => {
          setFeedPosts(current => current.filter(item => item.id !== post.id));
          lastSeenPostMutationRef.current = getPostMutationVersion();
        }}/>
    {sheet}
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
        searchResultsHeader: {
            marginTop: 20,
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
        clubsLoading: {
            minHeight: 220,
            alignItems: 'center',
            justifyContent: 'center',
        },
        sectionHeader: {
            marginTop: 22,
            flexDirection: 'row',
            alignItems: 'center',
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
            minHeight: 44,
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
        clubList: { marginTop: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, overflow: 'hidden' },
        clubCard: { minHeight: 91, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, paddingVertical: 12 },
        compactClubCard: { minHeight: 69, paddingVertical: 10 },
        clubRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        clubImage: { width: 58, height: 58, borderRadius: 13, backgroundColor: colors.elevated },
        compactClubImage: { width: 46, height: 46, borderRadius: 11 },
        clubImageFallback: { alignItems: 'center', justifyContent: 'center' },
        clubInitial: { color: colors.gold, fontFamily: 'PlayfairDisplay_700Bold', fontSize: 23 },
        clubCardCopy: { flex: 1, minWidth: 0, gap: 3 },
        clubName: { color: colors.text, fontFamily: 'Inter_700Bold', fontSize: 14 },
        clubMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
        clubMetaText: { color: colors.mutedText, fontFamily: 'Inter_500Medium', fontSize: 11 },
        clubRoleText: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
        clubDescription: { color: colors.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 2 },
        clubGenreText: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 10, marginTop: 2 },
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
            marginTop: 26,
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
            minHeight: 44,
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
        pressed: {
            opacity: 0.68,
        },
    });
}
