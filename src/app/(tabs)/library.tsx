import { useTabBrowsingNavigationScroll } from '../../components/BrowsingNavigation';
import {getCanonicalBookCover} from '../../lib/canonical-book-covers';
import { hasLibraryMembership } from '../../lib/library-membership';
import CartShortcut from '../../components/CartShortcut';
import { displayBookTitle } from '../../lib/book-title';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBookLayout, getLibraryBookWidth, LIBRARY_COLUMN_OPTIONS, type LibraryColumns } from '../../lib/book-layout';
import { useUiSheetMotion, UiSheetModal, UiSheetSurface, UiSheetBackdrop } from '../../components/UiSheet';
import BookCoverImage from '../../components/BookCoverImage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, type GestureResponderEvent, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NovoriColors } from '../../constants/novori-theme';
import { useNovoriTheme } from '../../context/theme-context';
import RemoveBookConfirmSheet from '../../components/RemoveBookConfirmSheet';
import LibrarySortFilterSheet, { DEFAULT_LIBRARY_FILTERS, parseLibraryFilters, type LibraryFilters } from '../../components/LibrarySortFilterSheet';
import { getUserBooks, getLibraryMutationVersion, removeUserBook, saveUserBook, updateUserBookOwned, UserBook, UserBookStatus } from '../../lib/user-books';
import { refreshBookCartCount, getBookCartCountSnapshot } from '../../lib/book-cart-count';
import { transitionReadingJourney } from '../../lib/reading-details';
const STATUS_LABELS: Record<UserBookStatus, string> = {
    reading: 'Reading',
    want_to_read: 'TBR',
    read: 'Read',
    dnf: 'DNF',
};
const STATUS_ORDER: Record<UserBookStatus, number> = {
    reading: 0,
    want_to_read: 1,
    read: 2,
    dnf: 3,
};
const STATUS_ICONS: Record<UserBookStatus, keyof typeof Ionicons.glyphMap> = {
    reading: 'book-outline',
    want_to_read: 'bookmark-outline',
    read: 'checkmark-circle-outline',
    dnf: 'close-circle-outline',
};
// A block contains whole rows at every supported size (2, 3, or 4).
const LIBRARY_GRID_BLOCK_SIZE = 12;
const LIBRARY_COLUMNS_KEY = 'novori:library-columns';
const LIBRARY_FILTERS_KEY = 'novori:library-filters';
const LIBRARY_STALE_MS = 5 * 60 * 1000;
let librarySessionCache: {
    books: UserBook[];
    cartCount: number;
    refreshedAt: number;
    mutationVersion: number;
} | null = null;
function normalizeLibrarySearch(value: string) {
    return value
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '');
}
type LibraryStyles = ReturnType<typeof createStyles>;
const LibraryBookCard = memo(function LibraryBookCard({ item, updating, styles, goldColor, mutedTextColor, onOpenBook, onShowBookActions, }: {
    item: UserBook;
    updating: boolean;
    styles: LibraryStyles;
    goldColor: string;
    mutedTextColor: string;
    onOpenBook: (googleBookId: string) => void;
    onShowBookActions: (book: UserBook) => void;
}) {
    const author = item.authors?.length
        ? item.authors.join(', ')
        : 'Unknown author';
    return (<Pressable onPress={() => onOpenBook(item.google_book_id)} style={({ pressed }) => [
            styles.bookCard,
            pressed &&
                styles.pressed
        ]}>
        <View style={styles.coverWrap}>
          {(item.google_book_id || item.cover_url) ? (<BookCoverImage googleBookId={item.google_book_id} existingCoverUrl={item.cover_url} style={styles.cover}/>) : (<View style={styles.coverPlaceholder}>
              <Ionicons name="book-outline" size={32} color={mutedTextColor}/>
            </View>)}

          {item.status ? (<View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText} numberOfLines={1}>
                {STATUS_LABELS[item.status]}
              </Text>
            </View>) : null}
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.bookTitle} numberOfLines={2}>
            {displayBookTitle(item.title ?? '')}
          </Text>

          <Pressable accessibilityLabel={`Manage ${item.title}`} hitSlop={8} disabled={updating} onPress={(event) => {
            event.stopPropagation();
            onShowBookActions(item);
        }} style={({ pressed }) => [
            styles.inlineManageButton,
            pressed &&
                styles.inlineManageButtonPressed
        ]}>
            {updating ? (<ActivityIndicator size="small" color={goldColor}/>) : (<Ionicons name="ellipsis-horizontal" size={18} color={goldColor}/>)}
          </Pressable>
        </View>

        <View style={styles.authorRow}>
          <Text style={styles.bookAuthor} numberOfLines={1}>
            {author}
          </Text>

          {item.owned ? (<Ionicons name="checkmark-circle" size={15} color={goldColor}/>) : null}
        </View>

      </Pressable>);
});
export default function LibraryScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const libraryFocusedRef = useRef(false);
    const lastSeenLibraryMutationRef = useRef(librarySessionCache
        ?.mutationVersion ??
        getLibraryMutationVersion());
    const { colors, } = useNovoriTheme();
    const { width: windowWidth } = useWindowDimensions();
    const [preferredColumns, setPreferredColumns] = useState<LibraryColumns | null>(null);
    const hasChosenColumns = useRef(false);
    const saveColumnPreference = useRef(Promise.resolve());
    const libraryColumns = preferredColumns ?? getBookLayout(windowWidth).libraryColumns;
    const styles = useMemo(() => createStyles(colors, windowWidth, libraryColumns), [colors, windowWidth, libraryColumns]);

    useEffect(() => {
        let active = true;
        void AsyncStorage.getItem(LIBRARY_COLUMNS_KEY).then(value => {
            const columns = LIBRARY_COLUMN_OPTIONS.find(option => String(option) === value);
            if (active && !hasChosenColumns.current && columns) setPreferredColumns(columns);
        }).catch(() => {});
        return () => { active = false; };
    }, []);

    function selectLibraryColumns(columns: LibraryColumns) {
        hasChosenColumns.current = true;
        setPreferredColumns(columns);
        saveColumnPreference.current = saveColumnPreference.current
            .then(() => AsyncStorage.setItem(LIBRARY_COLUMNS_KEY, String(columns)))
            .catch(() => {});
    }
    const [books, setBooks,] = useState<UserBook[]>((librarySessionCache?.books ?? []).filter(hasLibraryMembership));
    const [cartCount, setCartCount,] = useState(librarySessionCache
        ?.cartCount ??
        0);
    const [loading, setLoading,] = useState(!librarySessionCache);
    const [error, setError,] = useState('');
    const [searchQuery, setSearchQuery,] = useState('');
    const [searchOpen, setSearchOpen,] = useState(false);
    const [filters, setFilters] = useState(DEFAULT_LIBRARY_FILTERS);
    const { status: activeFilter, ownership: ownershipFilter, sort: sortMode } = filters;
    const activeFilterCount = Number(activeFilter !== 'all') + Number(ownershipFilter !== 'all') + Number(sortMode !== 'recent');
    const [filtersReady, setFiltersReady] = useState(false);
    const saveFilterPreference = useRef(Promise.resolve());
    useEffect(() => {
        let mounted = true;
        void AsyncStorage.getItem(LIBRARY_FILTERS_KEY).then(raw => {
            if (mounted) setFilters(parseLibraryFilters(raw));
        }).catch(() => {}).finally(() => { if (mounted) setFiltersReady(true); });
        return () => { mounted = false; };
    }, []);

    function applyLibraryFilters(next: LibraryFilters) {
        setFilters(next);
        saveFilterPreference.current = saveFilterPreference.current
            .then(() => AsyncStorage.setItem(LIBRARY_FILTERS_KEY, JSON.stringify(next)))
            .catch(() => {});
    }
    const [sortFilterSheetVisible, setSortFilterSheetVisible,] = useState(false);
    const [updatingBookId, setUpdatingBookId,] = useState<string | null>(null);
    const [selectedBook, setSelectedBook,] = useState<UserBook | null>(null);
    const [removeConfirmBook, setRemoveConfirmBook,] = useState<UserBook | null>(null);
    const [actionSheetMode, setActionSheetMode,] = useState<'actions' | 'status'>('actions');
    const insets = useSafeAreaInsets();
    const sheetHeight = useRef(0);
    const sheetShown = useRef(false);
    const sheetStarted = useRef(false);
    const sheetClosing = useRef(false);
    const afterSheetDismiss = useRef<(() => void) | null>(null);
    const searchWrapRef = useRef<View | null>(null);
    const searchBoundsRef = useRef<{
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>(null);
    function handleBookSheetDismiss() {
        sheetShown.current = false;
        sheetClosing.current = false;
        setActionSheetMode('actions');
        const action = afterSheetDismiss.current;
        afterSheetDismiss.current = null;
        action?.();
    }
    function dismissBookSheet(afterDismiss?: () => void) {
        if (sheetClosing.current) {
            return;
        }
        sheetClosing.current =
            true;
        afterSheetDismiss.current =
            afterDismiss ??
                null;
        uiSheet.closeAfterActionWithCallback();
    }
    const libraryListRef = useRef<FlatList<UserBook[]> | null>(null);
    const libraryScrollOffsetRef = useRef(0);
    const navigationScroll = useTabBrowsingNavigationScroll('library', event => {
        libraryScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
    });
    const restoreLibraryScrollRef = useRef(false);
    const hasLoadedLibraryRef = useRef(Boolean(librarySessionCache));
    const lastLibraryRefreshRef = useRef(librarySessionCache
        ?.refreshedAt ??
        0);
    function restoreLibraryScrollPosition() {
        requestAnimationFrame(() => {
            libraryListRef.current?.scrollToOffset({
                offset: libraryScrollOffsetRef.current,
                animated: false,
            });
        });
    }
    useFocusEffect(useCallback(() => {
        libraryFocusedRef.current =
            true;
        let active = true;
        const currentLibraryMutationVersion = getLibraryMutationVersion();
        const libraryChanged = currentLibraryMutationVersion !==
            lastSeenLibraryMutationRef.current;
        const libraryIsFresh = hasLoadedLibraryRef.current &&
            Date.now() -
                lastLibraryRefreshRef.current <
                LIBRARY_STALE_MS;
        if (libraryIsFresh &&
            !libraryChanged) {
            return () => {
                active = false;
                libraryFocusedRef.current =
                    false;
            };
        }
        async function loadLibrary() {
            const isFirstLoad = !hasLoadedLibraryRef.current;
            try {
                if (isFirstLoad) {
                    setLoading(true);
                }
                setError('');
                const [data, cartItems,] = await Promise.all([
                    getUserBooks(),
                    refreshBookCartCount().then(() => getBookCartCountSnapshot() ?? 0)
                ]);
                if (active) {
                    setCartCount(cartItems);
                    if (!isFirstLoad) {
                        restoreLibraryScrollRef.current =
                            true;
                    }
                    const refreshedAt = Date.now();
                    setBooks(data);
                    lastSeenLibraryMutationRef.current =
                        currentLibraryMutationVersion;
                    hasLoadedLibraryRef.current =
                        true;
                    lastLibraryRefreshRef.current =
                        refreshedAt;
                    librarySessionCache = {
                        books: data,
                        cartCount: cartItems,
                        refreshedAt,
                        mutationVersion: currentLibraryMutationVersion,
                    };
                    if (!isFirstLoad) {
                        restoreLibraryScrollPosition();
                    }
                }
            }
            catch (loadError) {
                console.error('Could not load library:', loadError);
                if (active) {
                    setError('Could not load your library.');
                }
            }
            finally {
                if (active) {
                    setLoading(false);
                }
            }
        }
        loadLibrary();
        return () => {
            active = false;
            libraryFocusedRef.current =
                false;
        };
    }, []));
    useEffect(() => {
        const unsubscribe = (navigation as any).addListener('tabPress', () => {
            if (!libraryFocusedRef.current) {
                return;
            }
            if (libraryScrollOffsetRef.current >
                24) {
                libraryScrollOffsetRef.current =
                    0;
                libraryListRef.current?.scrollToOffset({
                    offset: 0,
                    animated: true,
                });
                return;
            }
            // Keep the in-memory Library snapshot. A book mutation
            // or the five-minute TTL will refresh it automatically.
        });
        return unsubscribe;
    }, [
        navigation
    ]);
    const visibleBooks = useMemo(() => {
        const normalizedSearch = normalizeLibrarySearch(searchQuery);
        const filtered = (activeFilter ===
            'all'
            ? [...books]
            : books.filter((book) => book.status ===
                activeFilter))
            .filter((book) => ownershipFilter ===
            'all' ||
            (ownershipFilter ===
                'owned'
                ? Boolean(book.owned)
                : !book.owned))
            .filter((book) => {
            if (!normalizedSearch) {
                return true;
            }
            const title = normalizeLibrarySearch(book.title);
            const authors = normalizeLibrarySearch((book.authors ??
                []).join(' '));
            return (title.includes(normalizedSearch) ||
                authors.includes(normalizedSearch));
        });
        filtered.sort((a, b) => {
            if (activeFilter ===
                'all') {
                const statusDifference = (a.status
                    ? STATUS_ORDER[a.status]
                    : 4) -
                    (b.status
                        ? STATUS_ORDER[b.status]
                        : 4);
                if (statusDifference !==
                    0) {
                    return statusDifference;
                }
            }
            if (sortMode ===
                'title') {
                return a.title.localeCompare(b.title);
            }
            if (sortMode ===
                'author') {
                const aAuthor = a.authors?.[0] ??
                    '';
                const bAuthor = b.authors?.[0] ??
                    '';
                return aAuthor.localeCompare(bAuthor);
            }
            const aTime = new Date(a.updated_at).getTime();
            const bTime = new Date(b.updated_at).getTime();
            return bTime - aTime;
        });
        return filtered;
    }, [
        activeFilter,
        books,
        ownershipFilter,
        searchQuery,
        sortMode
    ]);
    const openBook = useCallback((googleBookId: string) => {
        const preview=books.find(book=>book.google_book_id===googleBookId);
        const selectedCover=getCanonicalBookCover({googleBookId});
        router.push({
            pathname: '/book/[id]',
            params: {
                id: googleBookId,
                source: 'library',
                ...(preview?{clickedTitle:preview.title,clickedAuthors:JSON.stringify(preview.authors??[])}:{}),
                ...(selectedCover?{coverUrl:selectedCover}:{}),
            },
        });
    }, [
        router,books
    ]);
    function openSortMenu() {
        setSortFilterSheetVisible(true);
    }
    const showBookActions = useCallback((book: UserBook) => {
        if (selectedBook ||
            sheetClosing.current) {
            return;
        }
        sheetShown.current = false;
        sheetStarted.current = false;
        sheetHeight.current = 0;
        setSelectedBook(book);
        setActionSheetMode('actions');
    }, [
        selectedBook
    ]);
    function closeBookActions() {
        if (updatingBookId) {
            return;
        }
        dismissBookSheet();
    }
    function openSelectedBook() {
        if (!selectedBook) {
            return;
        }
        const googleBookId = selectedBook.google_book_id;
        dismissBookSheet(() => openBook(googleBookId));
    }
    function openSelectedReadingDetails() {
        if (!selectedBook ||
            !selectedBook.status ||
            selectedBook.status ===
                'want_to_read') {
            return;
        }
        const googleBookId = selectedBook.google_book_id;
        dismissBookSheet(() => {
            router.push({
                pathname: '/reading-details/[id]',
                params: { id: googleBookId },
            });
        });
    }
    function openSelectedReview() {
        if (!selectedBook ||
            (selectedBook.status !==
                'read' &&
                selectedBook.status !==
                    'dnf')) {
            return;
        }
        const googleBookId = selectedBook.google_book_id;
        dismissBookSheet(() => {
            router.push({
                pathname: '/rate-review',
                params: {
                    googleBookId,
                },
            });
        });
    }
    function shareSelectedReview() {
        if (!selectedBook ||
            selectedBook.status !==
                'read' ||
            !selectedBook.review_text
                ?.trim()) {
            return;
        }
        const book = selectedBook;
        dismissBookSheet(() => {
            router.push({
                pathname: '/create-review',
                params: {
                    bookId: book.google_book_id,
                    rating: book.rating !==
                        null
                        ? String(book.rating)
                        : '',
                    review: book.review_text
                        ?.trim() ??
                        '',
                },
            });
        });
    }
    function removeSelectedBook() {
        if (!selectedBook) {
            return;
        }
        const book = selectedBook;
        dismissBookSheet(() => confirmRemove(book));
    }
    async function changeBookStatus(book: UserBook, status: UserBookStatus) {
        if (updatingBookId) {
            return;
        }
        try {
            setUpdatingBookId(book.id);
            const updatedBook = await saveUserBook({
                googleBookId: book.google_book_id,
                title: book.title,
                authors: book.authors ?? [],
                coverUrl: book.cover_url,
                isbn: book.isbn,
                publishedDate: book.published_date,
                status,
            });
            setBooks((current) => current.map((item) => item.id ===
                book.id
                ? updatedBook
                : item));
            dismissBookSheet(() => {
                if (status === 'read' || status === 'dnf') {
                    router.push({ pathname: '/rate-review', params: { googleBookId: book.google_book_id } });
                }
            });
        }
        catch (updateError) {
            console.error('Could not update book status:', updateError);
            Alert.alert('Could not update book', 'Novori had trouble changing this book status. Please try again.');
        }
        finally {
            setUpdatingBookId(null);
        }
    }
    async function startSelectedReadingJourney() {
        if (!selectedBook ||
            selectedBook.status !==
                'want_to_read' ||
            updatingBookId) {
            return;
        }
        const book = selectedBook;
        try {
            setUpdatingBookId(book.id);
            const session = await transitionReadingJourney(book.google_book_id, 'start');
            const updatedBook: UserBook = {
                ...book,
                status: 'reading',
                started_at: session.started_at,
                finished_at: null,
                dnf_at: null,
                updated_at: new Date()
                    .toISOString(),
            };
            setBooks((current) => current.map((item) => item.id ===
                book.id
                ? updatedBook
                : item));
            setSelectedBook(updatedBook);
            dismissBookSheet(() => {
                router.push({
                    pathname: '/reading-details/[id]',
                    params: {
                        id: book.google_book_id,
                    },
                });
            });
        }
        catch (startError) {
            console.error('Could not start reading journey:', startError);
            Alert.alert('Could not start reading', startError instanceof
                Error
                ? startError.message
                : 'Novori had trouble starting this reading journey. Please try again.');
        }
        finally {
            setUpdatingBookId(null);
        }
    }
    async function toggleBookOwned(book: UserBook) {
        if (updatingBookId) {
            return;
        }
        try {
            setUpdatingBookId(book.id);
            const updatedBook = await updateUserBookOwned(book.google_book_id, !book.owned);
            setBooks((current) => current.map((item) => item.id ===
                book.id
                ? updatedBook
                : item).filter(hasLibraryMembership));
            setSelectedBook(hasLibraryMembership(updatedBook) ? updatedBook : null);
        }
        catch (updateError) {
            console.error('Could not update book ownership:', updateError);
            Alert.alert('Could not update ownership', 'Please try again.');
        }
        finally {
            setUpdatingBookId(null);
        }
    }
    function confirmRemove(book: UserBook) {
        setRemoveConfirmBook(book);
    }
    async function removeBook(book: UserBook) {
        if (updatingBookId) {
            return;
        }
        try {
            setUpdatingBookId(book.id);
            await removeUserBook(book.google_book_id);
            setBooks((current) => current.filter((item) => item.id !==
                book.id));
        }
        catch (removeError) {
            console.error('Could not remove book:', removeError);
            Alert.alert('Could not remove book', 'Novori had trouble removing this book from your library. Please try again.');
            throw removeError;
        }
        finally {
            setUpdatingBookId(null);
        }
    }
    function getEmptyTitle() {
        if (ownershipFilter ===
            'owned') {
            return 'No owned books yet.';
        }
        if (ownershipFilter ===
            'not_owned') {
            return 'No not-owned books here.';
        }
        if (activeFilter ===
            'all') {
            return 'Your library is empty.';
        }
        if (activeFilter ===
            'want_to_read') {
            return 'No TBR books yet.';
        }
        return `No ${STATUS_LABELS[activeFilter].toLowerCase()} books yet.`;
    }
    function closeLibrarySearch() {
        setSearchQuery('');
        setSearchOpen(false);
        searchBoundsRef.current =
            null;
    }
    function measureSearchBounds() {
        requestAnimationFrame(() => {
            searchWrapRef.current?.measureInWindow((x, y, width, height) => {
                searchBoundsRef.current = {
                    x,
                    y,
                    width,
                    height,
                };
            });
        });
    }
    function captureSearchDismiss(event: GestureResponderEvent) {
        if (!searchOpen) {
            return false;
        }
        const bounds = searchBoundsRef.current;
        const { pageX, pageY, } = event.nativeEvent;
        if (bounds &&
            pageX >=
                bounds.x &&
            pageX <=
                bounds.x +
                    bounds.width &&
            pageY >=
                bounds.y &&
            pageY <=
                bounds.y +
                    bounds.height) {
            return false;
        }
        closeLibrarySearch();
        return true;
    }
    function renderHeader() {
        return (<>
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Text style={styles.heading}>
              Library
            </Text>

            <View style={styles.headerActions}>
              <Pressable onPress={() => {
                if (searchOpen) {
                    closeLibrarySearch();
                    return;
                }
                setSearchOpen(true);
            }} hitSlop={8} style={({ pressed }) => [
                styles.headerIconButton,
                searchOpen &&
                    styles.headerIconButtonActive,
                pressed &&
                    styles.pressed
            ]}>
                <Ionicons name={searchOpen
                ? 'close'
                : 'search-outline'} size={21} color={colors.gold}/>
              </Pressable>

              <CartShortcut/>
            </View>
          </View>
        </View>

        {searchOpen ? (<View ref={searchWrapRef} onLayout={measureSearchBounds} style={styles.searchWrap}>
            <Ionicons name="search-outline" size={19} color={colors.mutedText}/>

            <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search your library" placeholderTextColor={colors.mutedText} autoCorrect={false} autoCapitalize="none" returnKeyType="search" clearButtonMode="never" autoFocus style={styles.searchInput}/>

            {searchQuery ? (<Pressable onPress={() => setSearchQuery('')} hitSlop={8} style={({ pressed }) => [
                        styles.searchClear,
                        pressed &&
                            styles.pressed
                    ]}>
                <Ionicons name="close-circle" size={19} color={colors.mutedText}/>
              </Pressable>) : null}
          </View>) : null}

        <View style={styles.libraryControls}>
          <Pressable onPress={openSortMenu} style={({ pressed }) => [
                styles.sortButton,
                activeFilterCount > 0 && styles.sortButtonFiltered,
                pressed &&
                    styles.pressed
            ]}>
            <Ionicons name="options-outline" size={16} color={colors.gold}/>

            <Text style={styles.sortText}>
              Sort & Filter
            </Text>

            {activeFilterCount > 0 && <View style={styles.activeFilterDot}/>}

            <Ionicons name="chevron-down" size={14} color={colors.mutedText}/>
          </Pressable>

          <View style={styles.coverSizeControl}>
            <Ionicons name="grid-outline" size={14} color={colors.mutedText} style={styles.coverSizeIcon}/>
            {LIBRARY_COLUMN_OPTIONS.map(columns => {
                const selected = libraryColumns === columns;
                return <Pressable key={columns} accessibilityRole="button"
                    accessibilityLabel={`${columns} covers per row`} accessibilityState={{ selected }}
                    onPress={() => selectLibraryColumns(columns)} style={({ pressed }) => [
                        styles.coverSizeOption, selected && styles.coverSizeOptionSelected, pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.coverSizeText, selected && styles.coverSizeTextSelected]}>{columns}</Text>
                </Pressable>;
            })}
          </View>
        </View>
      </>);
    }
    const gridBlocks = useMemo(() => {
        const blocks: UserBook[][] = [];
        for (let start = 0; start < visibleBooks.length; start += LIBRARY_GRID_BLOCK_SIZE) {
            blocks.push(visibleBooks.slice(start, start + LIBRARY_GRID_BLOCK_SIZE));
        }
        return blocks;
    }, [visibleBooks]);
    const renderGridBlock = useCallback(({ item: block }: { item: UserBook[] }) => (
        <View style={styles.gridBlock}>
            {block.map(item => <LibraryBookCard key={item.id} item={item} updating={updatingBookId === item.id}
                styles={styles} goldColor={colors.gold} mutedTextColor={colors.mutedText}
                onOpenBook={openBook} onShowBookActions={showBookActions}/>)}
        </View>
    ), [
        colors.gold,
        colors.mutedText,
        openBook,
        showBookActions,
        styles,
        updatingBookId
    ]);
    const uiSheet = useUiSheetMotion({ visible: selectedBook !== null, busy: false, embedded: false, onDismiss: () => {
            const finished = true;
            if (!finished) {
                return;
            }
            setSelectedBook(null);
            if (Platform.OS !==
                'ios') {
                handleBookSheetDismiss();
            }
        } });
    if (loading || !filtersReady) {
        return (<SafeAreaView style={styles.safeArea} edges={[
                'top'
            ]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold}/>

          <Text style={styles.loadingText}>
            Loading your books...
          </Text>
        </View>
      </SafeAreaView>);
    }
    if (error) {
        return (<SafeAreaView style={styles.safeArea} edges={[
                'top'
            ]}>
        <View style={styles.contentShell}>
          <View style={styles.header}>
            <Text style={styles.heading}>
              Library
            </Text>

            <Text style={styles.subheading}>
              Your books, shelves,
              and reading history.
            </Text>
          </View>

          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={26} color={colors.danger}/>

            <Text style={styles.errorTitle}>
              Something went wrong
            </Text>

            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        </View>
      </SafeAreaView>);
    }
    return (<>
      <SafeAreaView style={styles.safeArea} edges={[
            'top'
        ]} onStartShouldSetResponderCapture={captureSearchDismiss}>
        <FlatList ref={libraryListRef} data={gridBlocks} keyExtractor={(_block, index) => String(index)}
            renderItem={renderGridBlock} initialNumToRender={2} maxToRenderPerBatch={2} ListHeaderComponent={renderHeader()} ListEmptyComponent={<View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="library-outline" size={27} color={colors.gold}/>
              </View>

              <Text style={styles.emptyTitle}>
                {searchQuery.trim()
                ? 'No matching books'
                : getEmptyTitle()}
              </Text>

              <Text style={styles.emptyText}>
                {searchQuery.trim()
                ? 'Try a different title or author.'
                : 'Books you save will appear here.'}
              </Text>
            </View>} contentContainerStyle={styles.listContent} {...navigationScroll} onContentSizeChange={(width, height) => {
            navigationScroll.onContentSizeChange(width, height);
            if (restoreLibraryScrollRef.current) {
                restoreLibraryScrollRef.current =
                    false;
                restoreLibraryScrollPosition();
            }
        }} showsVerticalScrollIndicator={false}/>
      </SafeAreaView>

      <LibrarySortFilterSheet visible={sortFilterSheetVisible} filters={filters} onApply={applyLibraryFilters} onDismiss={() => setSortFilterSheetVisible(false)}/>

      <RemoveBookConfirmSheet visible={removeConfirmBook !==
            null} bookTitle={removeConfirmBook
            ?.title ??
            ''} hasReadingDetails={Boolean(removeConfirmBook &&
            Boolean(removeConfirmBook.status &&
                removeConfirmBook.status !==
                    'want_to_read'))} busy={Boolean(removeConfirmBook &&
            updatingBookId ===
                removeConfirmBook.id)} onDismiss={() => setRemoveConfirmBook(null)} onConfirm={async () => {
            if (!removeConfirmBook) {
                return;
            }
            await removeBook(removeConfirmBook);
        }}/>

      <UiSheetModal visible={selectedBook !==
            null} transparent animationType="none" onDismiss={handleBookSheetDismiss} onRequestClose={closeBookActions} motion={uiSheet}>
        <Pressable style={styles.sheetBackdrop} onPress={closeBookActions}>
          <UiSheetBackdrop pointerEvents="none" style={[styles.sheetBackdropVisual, {}]} motion={uiSheet}/>
          <UiSheetSurface style={[styles.actionSheet, {
                paddingBottom: Math.max(18, insets.bottom + 12)
            }]} motion={uiSheet}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View style={styles.sheetHandle}/>

            {selectedBook ? (<>
                <View style={styles.sheetHeader}>
                  {(selectedBook.google_book_id || selectedBook.cover_url) ? (<BookCoverImage googleBookId={selectedBook.google_book_id} existingCoverUrl={selectedBook.cover_url} style={styles.sheetCover}/>) : (<View style={styles.sheetCoverPlaceholder}>
                      <Ionicons name="book-outline" size={20} color={colors.gold}/>
                    </View>)}

                  <View style={styles.sheetHeaderText}>
                    <Text style={styles.sheetTitle} numberOfLines={2}>
                      {displayBookTitle(selectedBook.title ?? '')}
                    </Text>

                    <View style={styles.sheetStatusPill}>
                      <Text style={styles.sheetStatusText}>
                        {selectedBook.status ? STATUS_LABELS[selectedBook.status] : 'Owned'}
                      </Text>
                    </View>
                  </View>

                  <Pressable onPress={closeBookActions} hitSlop={8} style={({ pressed, }) => [
                styles.sheetCloseButton,
                pressed &&
                    styles.sheetRowPressed
            ]}>
                    <Ionicons name="close" size={20} color={colors.mutedText}/>
                  </Pressable>
                </View>

                {actionSheetMode ===
                'actions' ? (<View style={styles.sheetActions}>
                    {(selectedBook.status ===
                    'read' ||
                    selectedBook.status ===
                        'dnf') ? (<>
                        {selectedBook.rating !==
                        null ||
                        Boolean(selectedBook.review_text
                            ?.trim()) ? (<View style={styles.reviewPreviewCard}>
                            <View style={styles.reviewPreviewTop}>
                              <View style={styles.reviewStarsRow}>
                                {[
                            1,
                            2,
                            3,
                            4,
                            5
                        ].map((starNumber) => {
                            let icon: 'star' | 'star-half' | 'star-outline' = 'star-outline';
                            if (selectedBook.rating !==
                                null &&
                                selectedBook.rating >=
                                    starNumber) {
                                icon =
                                    'star';
                            }
                            else if (selectedBook.rating !==
                                null &&
                                selectedBook.rating >=
                                    starNumber -
                                        0.5) {
                                icon =
                                    'star-half';
                            }
                            return (<Ionicons key={starNumber} name={icon} size={16} color={colors.gold}/>);
                        })}
                              </View>

                              {selectedBook.rating !==
                            null ? (<Text style={styles.reviewRatingText}>
                                  {selectedBook.rating.toFixed(1)}
                                </Text>) : null}
                            </View>

                            <Text style={styles.reviewPreviewLabel}>
                              YOUR REVIEW
                            </Text>

                            <Text style={styles.reviewPreviewText} numberOfLines={3}>
                              {selectedBook.review_text
                            ?.trim() ||
                            'You rated this book but have not added a written review yet.'}
                            </Text>
                          </View>) : null}

                        <Pressable onPress={openSelectedReview} style={({ pressed, }) => [
                        styles.sheetRow,
                        pressed &&
                            styles.sheetRowPressed
                    ]}>
                          <View style={styles.sheetRowIcon}>
                            <Ionicons name={selectedBook.rating !==
                        null ||
                        Boolean(selectedBook.review_text
                            ?.trim())
                        ? 'create-outline'
                        : 'star-outline'} size={20} color={colors.gold}/>
                          </View>

                          <View style={styles.sheetRowText}>
                            <Text style={styles.sheetRowTitle}>
                              {selectedBook.rating !==
                        null ||
                        Boolean(selectedBook.review_text
                            ?.trim())
                        ? selectedBook.review_text
                            ?.trim()
                            ? 'Edit Review'
                            : 'Add Review'
                        : 'Rate & Review'}
                            </Text>

                            <Text style={styles.sheetRowSubtitle}>
                              {selectedBook.rating !==
                        null ||
                        Boolean(selectedBook.review_text
                            ?.trim())
                        ? 'Update your saved rating or review'
                        : 'Add your rating and thoughts whenever you are ready'}
                            </Text>
                          </View>

                          <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
                        </Pressable>

                        {selectedBook.status ===
                        'read' &&
                        Boolean(selectedBook.review_text
                            ?.trim()) ? (<Pressable onPress={shareSelectedReview} style={({ pressed, }) => [
                            styles.sheetRow,
                            pressed &&
                                styles.sheetRowPressed
                        ]}>
                            <View style={styles.sheetRowIcon}>
                              <Ionicons name="share-social-outline" size={20} color={colors.gold}/>
                            </View>

                            <View style={styles.sheetRowText}>
                              <Text style={styles.sheetRowTitle}>
                                Share Review
                              </Text>

                              <Text style={styles.sheetRowSubtitle}>
                                Share this saved review to your Feed or a Club
                              </Text>
                            </View>

                            <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
                          </Pressable>) : null}

                        <View style={styles.sheetDivider}/>
                      </>) : null}

                    <Pressable onPress={openSelectedBook} style={({ pressed, }) => [
                    styles.sheetRow,
                    pressed &&
                        styles.sheetRowPressed
                ]}>
                      <View style={styles.sheetRowIcon}>
                        <Ionicons name="book-outline" size={20} color={colors.gold}/>
                      </View>

                      <View style={styles.sheetRowText}>
                        <Text style={styles.sheetRowTitle}>
                          Open Book
                        </Text>

                        <Text style={styles.sheetRowSubtitle}>
                          View details and your saved activity
                        </Text>
                      </View>

                      <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
                    </Pressable>

                    {selectedBook.status ===
                    'want_to_read' ? (<Pressable onPress={() => void startSelectedReadingJourney()} disabled={updatingBookId !==
                        null} style={({ pressed, }) => [
                        styles.sheetRow,
                        pressed &&
                            styles.sheetRowPressed
                    ]}>
                        <View style={styles.sheetRowIcon}>
                          {updatingBookId ===
                        selectedBook.id ? (<ActivityIndicator size="small" color={colors.gold}/>) : (<Ionicons name="play-outline" size={20} color={colors.gold}/>)}
                        </View>

                        <View style={styles.sheetRowText}>
                          <Text style={styles.sheetRowTitle}>
                            Start Reading
                          </Text>

                          <Text style={styles.sheetRowSubtitle}>
                            Begin a new reading journey
                          </Text>
                        </View>

                        <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
                      </Pressable>) : selectedBook.status ? (<Pressable onPress={openSelectedReadingDetails} style={({ pressed, }) => [
                        styles.sheetRow,
                        pressed &&
                            styles.sheetRowPressed
                    ]}>
                        <View style={styles.sheetRowIcon}>
                          <Ionicons name="journal-outline" size={20} color={colors.gold}/>
                        </View>

                        <View style={styles.sheetRowText}>
                          <Text style={styles.sheetRowTitle}>
                            View Reading Details
                          </Text>

                          <Text style={styles.sheetRowSubtitle}>
                            Manage progress, dates, pause or resume, and history
                          </Text>
                        </View>

                        <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
                      </Pressable>) : (<Pressable onPress={() => setActionSheetMode('status')} style={({ pressed, }) => [
                        styles.sheetRow,
                        pressed &&
                            styles.sheetRowPressed
                    ]}>
                        <View style={styles.sheetRowIcon}>
                          <Ionicons name="bookmark-outline" size={20} color={colors.gold}/>
                        </View>

                        <View style={styles.sheetRowText}>
                          <Text style={styles.sheetRowTitle}>
                            Choose Reading Status
                          </Text>

                          <Text style={styles.sheetRowSubtitle}>
                            Set the initial place for this book
                          </Text>
                        </View>

                        <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
                      </Pressable>)}

                    <Pressable onPress={() => void toggleBookOwned(selectedBook)} disabled={updatingBookId !==
                    null} style={({ pressed }) => [
                    styles.sheetRow,
                    pressed &&
                        styles.sheetRowPressed
                ]}>
                      <View style={styles.sheetRowIcon}>
                        <Ionicons name={selectedBook.owned
                    ? 'checkmark-circle'
                    : 'checkmark-circle-outline'} size={20} color={colors.gold}/>
                      </View>

                      <View style={styles.sheetRowText}>
                        <Text style={styles.sheetRowTitle}>
                          {selectedBook.owned
                    ? 'Remove Owned'
                    : 'Mark as Owned'}
                        </Text>

                        <Text style={styles.sheetRowSubtitle}>
                          {selectedBook.owned
                    ? 'This book will stay in your Library'
                    : 'Mark this as a book you own'}
                        </Text>
                      </View>
                    </Pressable>

                    <View style={styles.sheetDivider}/>

                    <Pressable onPress={removeSelectedBook} style={({ pressed, }) => [
                    styles.sheetRow,
                    pressed &&
                        styles.sheetRowPressed
                ]}>
                      <View style={[
                    styles.sheetRowIcon,
                    styles.sheetDangerIcon
                ]}>
                        <Ionicons name="trash-outline" size={20} color={colors.danger}/>
                      </View>

                      <View style={styles.sheetRowText}>
                        <Text style={styles.sheetDangerText}>
                          Remove from Library
                        </Text>

                        <Text style={styles.sheetRowSubtitle}>
                          Removes the saved rating and review too
                        </Text>
                      </View>
                    </Pressable>
                  </View>) : (<View style={styles.sheetActions}>
                    <Pressable onPress={() => setActionSheetMode('actions')} style={({ pressed, }) => [
                    styles.statusBackRow,
                    pressed &&
                        styles.sheetRowPressed
                ]}>
                      <Ionicons name="chevron-back" size={18} color={colors.gold}/>

                      <Text style={styles.statusBackText}>
                        Change Status
                      </Text>
                    </Pressable>

                    {([
                    'reading',
                    'want_to_read',
                    'read',
                    'dnf'
                ] as UserBookStatus[]).map((status) => {
                    const isCurrent = status ===
                        selectedBook.status;
                    return (<Pressable key={status} disabled={isCurrent ||
                            updatingBookId !==
                                null} onPress={() => changeBookStatus(selectedBook, status)} style={({ pressed, }) => [
                            styles.statusOption,
                            isCurrent &&
                                styles.statusOptionCurrent,
                            pressed &&
                                !isCurrent &&
                                styles.sheetRowPressed
                        ]}>
                            <View style={styles.sheetRowIcon}>
                              <Ionicons name={STATUS_ICONS[status]} size={20} color={isCurrent
                            ? colors.gold
                            : colors.secondaryText}/>
                            </View>

                            <Text style={[
                            styles.statusOptionText,
                            isCurrent &&
                                styles.statusOptionTextCurrent
                        ]}>
                              {STATUS_LABELS[status]}
                            </Text>

                            {isCurrent ? (<Ionicons name="checkmark" size={19} color={colors.gold}/>) : null}
                          </Pressable>);
                })}
                  </View>)}
              </>) : null}
          </Pressable>
          </UiSheetSurface>
        </Pressable>
      </UiSheetModal>
    </>);
}
function createStyles(colors: NovoriColors, windowWidth: number, libraryColumns: LibraryColumns) {
    const cardWidth = getLibraryBookWidth(windowWidth, libraryColumns);
    const compact = cardWidth < 92;
    return StyleSheet.create({
        safeArea: {
            flex: 1,
            backgroundColor: colors.background,
        },
        listContent: {
            width: '100%',
            maxWidth: '100%',
            alignSelf: 'center',
            paddingHorizontal: 20,
            paddingTop: 22,
            paddingBottom: 120,
        },
        contentShell: {
            width: '100%',
            maxWidth: '100%',
            alignSelf: 'center',
            paddingHorizontal: 20,
            paddingTop: 22,
        },
        header: {
            marginBottom: 0,
        },
        headerTopRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        headerActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        headerIconButton: {
            width: 42,
            height: 42,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
        },
        headerIconButtonActive: {
            borderColor: colors.gold,
            backgroundColor: colors.elevated,
        },
        cartButton: {
            width: 42,
            height: 42,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            position: 'relative',
        },
        cartBadge: {
            position: 'absolute',
            top: -5,
            right: -5,
            minWidth: 19,
            height: 19,
            paddingHorizontal: 5,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.gold,
            borderWidth: 2,
            borderColor: colors.background,
        },
        cartBadgeText: {
            color: colors.background,
            fontFamily: 'Inter_700Bold',
            fontSize: 9,
        },
        heading: {
            color: colors.gold,
            fontSize: 43,
            fontFamily: 'PlayfairDisplay_700Bold',
            letterSpacing: 0.2,
        },
        subheading: {
            color: colors.secondaryText,
            fontFamily: 'Inter_500Medium',
            fontSize: 15,
            marginTop: 5,
            letterSpacing: 0.15,
        },
        searchWrap: {
            minHeight: 48,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            paddingHorizontal: 13,
            marginBottom: 12,
        },
        searchInput: {
            flex: 1,
            color: colors.text,
            fontFamily: 'Inter_400Regular',
            fontSize: 14,
            paddingVertical: 0,
        },
        searchClear: {
            alignItems: 'center',
            justifyContent: 'center',
        },
        libraryControls: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 8,
            alignItems: 'center',
            marginTop: 12,
            marginBottom: 12,
        },
        coverSizeControl: {
            flexDirection: 'row', alignItems: 'center', padding: 3, borderRadius: 999,
            borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
        },
        coverSizeIcon: { marginHorizontal: 6 },
        coverSizeOption: {
            minWidth: 34, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 999,
        },
        coverSizeOptionSelected: { backgroundColor: colors.gold },
        coverSizeText: { color: colors.secondaryText, fontFamily: 'Inter_700Bold', fontSize: 12 },
        coverSizeTextSelected: { color: colors.background },
        sortButton: {
            minHeight: 36,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 7,
            gap: 7,
        },
        sortText: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11,
        },
        sortButtonFiltered: {
            borderColor: colors.gold,
        },
        activeFilterDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.gold,
        },
        gridBlock: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            columnGap: 8,
        },
        bookCard: {
            width: cardWidth,
            marginBottom: 18,
        },
        coverWrap: {
            width: '100%',
            aspectRatio: 0.67,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            position: 'relative',
        },
        cover: {
            width: '100%',
            height: '100%',
            resizeMode: 'cover',
        },
        coverPlaceholder: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.elevated,
        },
        statusBadge: {
            position: 'absolute',
            left: compact ? 4 : 8,
            bottom: compact ? 4 : 8,
            maxWidth: compact ? '86%' : '72%',
            backgroundColor: colors.background,
            borderRadius: 999,
            paddingHorizontal: compact ? 4 : 8,
            paddingVertical: compact ? 3 : 5,
            borderWidth: 1,
            borderColor: colors.border,
        },
        statusBadgeText: {
            color: colors.softGold,
            fontFamily: 'Inter_700Bold',
            fontSize: 9,
            letterSpacing: 0.25,
        },
        titleRow: {
            minHeight: compact ? 32 : 38,
            flexDirection: 'row',
            alignItems: 'flex-start',
            marginTop: 8,
            gap: 4,
        },
        inlineManageButton: {
            width: compact ? 19 : 26,
            height: 26,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: -3,
            marginRight: -3,
        },
        inlineManageButtonPressed: {
            backgroundColor: colors.elevated,
        },
        bookTitle: {
            flex: 1,
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: compact ? 12 : 14,
            lineHeight: compact ? 16 : 19,
        },
        authorRow: {
            minHeight: 15,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 5,
            marginTop: 3,
        },
        bookAuthor: {
            flex: 1,
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
        },
        emptyState: {
            alignItems: 'center',
            paddingVertical: 60,
            paddingHorizontal: 30,
        },
        emptyIcon: {
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        emptyTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 16,
            textAlign: 'center',
            marginTop: 14,
        },
        emptyText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            textAlign: 'center',
            marginTop: 5,
        },
        loadingContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        loadingText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            marginTop: 12,
        },
        errorCard: {
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 18,
            padding: 28,
        },
        errorTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 16,
            marginTop: 10,
        },
        errorText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            textAlign: 'center',
            marginTop: 5,
        },
        sheetBackdrop: {
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'transparent',
        },
        sheetBackdropVisual: {
            ...StyleSheet.absoluteFill,
            backgroundColor: 'rgba(0, 0, 0, 0.52)',
        },
        actionSheet: {
            width: '100%',
            alignSelf: 'center',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
            paddingHorizontal: 18,
            paddingTop: 9,
            paddingBottom: 34,
        },
        sheetHandle: {
            width: 38,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: 'center',
            marginBottom: 15,
        },
        sheetHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingBottom: 15,
        },
        sheetCover: {
            width: 42,
            height: 62,
            borderRadius: 6,
            backgroundColor: colors.elevated,
        },
        sheetCoverPlaceholder: {
            width: 42,
            height: 62,
            borderRadius: 6,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
        },
        sheetHeaderText: {
            flex: 1,
            marginLeft: 12,
            marginRight: 10,
        },
        sheetTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 15,
            lineHeight: 20,
        },
        sheetStatusPill: {
            alignSelf: 'flex-start',
            backgroundColor: colors.elevated,
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 4,
            marginTop: 7,
        },
        sheetStatusText: {
            color: colors.softGold,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 10,
        },
        sheetCloseButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        sheetActions: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 7,
        },
        reviewPreviewCard: {
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            paddingHorizontal: 13,
            paddingVertical: 12,
            marginHorizontal: 4,
            marginTop: 3,
            marginBottom: 5,
        },
        reviewPreviewTop: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
        },
        reviewStarsRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
        },
        reviewRatingText: {
            color: colors.softGold,
            fontFamily: 'Inter_700Bold',
            fontSize: 12,
        },
        reviewPreviewLabel: {
            color: colors.mutedText,
            fontFamily: 'Inter_700Bold',
            fontSize: 9.5,
            letterSpacing: 1.15,
            marginBottom: 4,
        },
        reviewPreviewText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            lineHeight: 18,
        },
        sheetRow: {
            minHeight: 64,
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 14,
            paddingHorizontal: 10,
            paddingVertical: 8,
        },
        sheetRowPressed: {
            backgroundColor: colors.elevated,
        },
        sheetRowIcon: {
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.elevated,
            marginRight: 11,
        },
        sheetDangerIcon: {
            backgroundColor: colors.background,
        },
        sheetRowText: {
            flex: 1,
            marginRight: 8,
        },
        sheetRowTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
        },
        sheetRowSubtitle: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            lineHeight: 16,
            marginTop: 3,
        },
        sheetDivider: {
            height: 1,
            backgroundColor: colors.border,
            marginVertical: 5,
        },
        sheetDangerText: {
            color: colors.danger,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
        },
        statusBackRow: {
            minHeight: 44,
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            borderRadius: 10,
            paddingHorizontal: 6,
            paddingRight: 10,
            marginBottom: 5,
        },
        statusBackText: {
            color: colors.gold,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
            marginLeft: 2,
        },
        statusOption: {
            minHeight: 56,
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 14,
            paddingHorizontal: 10,
            paddingVertical: 7,
        },
        statusOptionCurrent: {
            backgroundColor: colors.elevated,
        },
        statusOptionText: {
            flex: 1,
            color: colors.secondaryText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
        },
        statusOptionTextCurrent: {
            color: colors.gold,
        },
        pressed: {
            opacity: 0.68,
        },
    });
}
