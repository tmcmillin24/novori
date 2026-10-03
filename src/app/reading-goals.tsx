import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BookCoverImage from '../components/BookCoverImage';
import { getReadingGoalBooks, ReadingGoalBook } from '../lib/reading-goal-books';
import ValidationWarningSheet from '../components/ValidationWarningSheet';
import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
import { getGoalPeriodStart, getGoalProgressDisplay, getReadingGoalsProgress, parseGoalTarget,
  ReadingGoalKind, ReadingGoalProgress, ReadingGoalsProgress, removeReadingGoal,
  saveReadingGoal, shiftGoalPeriod } from '../lib/reading-goals';

type GoalCardProps = {
  kind: ReadingGoalKind; periodStart: string; goal: ReadingGoalProgress | null;
  busy: boolean; loading: boolean; coverRevision: number; onShift: (amount: number) => void;
  onSave: (value: string) => Promise<boolean>; onRemove: () => Promise<void>;
};

// Swipe between numbered finishes; only the selected page reads cover metadata.
function GoalShelf({ goal, title, colors, revision }: { goal: ReadingGoalProgress; title: string; colors: NovoriColors; revision: number }) {
  const styles = createStyles(colors);
  const pageSize = 6;
  const total = Math.max(goal.targetBooks ?? 0, goal.finishedBooks);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentShelf = Math.min(pageCount - 1, Math.floor(Math.max(0, goal.finishedBooks - 1) / pageSize));
  const shelfKey = `${goal.kind}:${goal.periodStart}:${goal.finishedBooks}:${goal.targetBooks}`;
  const [selection, setSelection] = useState({ key: shelfKey, page: currentShelf });
  const [viewportWidth, setViewportWidth] = useState(0);
  const list = useRef<FlatList<number>>(null);
  const [retry, setRetry] = useState(0);
  const namespace = `${revision}:${goal.kind}:${goal.periodStart}:${goal.finishedBooks}`;
  const cache = useRef({ key: namespace, requests: new Map<number, Promise<ReadingGoalBook[]>>(), books: new Map<number, ReadingGoalBook[]>() });
  if (cache.current.key !== namespace) cache.current = { key: namespace, requests: new Map(), books: new Map() };
  const [covers, setCovers] = useState<{ key: string; failed: boolean } | null>(null);
  const page = Math.min(selection.key === shelfKey ? selection.page : currentShelf, pageCount - 1);
  const first = page * pageSize;
  const requestKey = `${namespace}:${first}:${retry}`;
  const pages = useMemo(() => Array.from({ length: pageCount }, (_, index) => index), [pageCount]);
  useEffect(() => {
    if (first >= goal.finishedBooks) return;
    let active = true;
    const store = cache.current;
    let request = store.requests.get(first);
    if (!request) { request = getReadingGoalBooks(goal.kind, goal.periodStart, first, pageSize); store.requests.set(first, request); }
    void request.then(books => { store.books.set(first, books); if (active) setCovers({ key: requestKey, failed: false }); })
      .catch(() => { store.requests.delete(first); if (active) setCovers({ key: requestKey, failed: true }); });
    return () => { active = false; };
  }, [requestKey, first, goal.kind, goal.periodStart, goal.finishedBooks]);
  useEffect(() => {
    if (viewportWidth > 0) list.current?.scrollToOffset({ offset: page * viewportWidth, animated: false });
  }, [page, viewportWidth, shelfKey]);
  const complete = goal.targetBooks !== null && goal.finishedBooks >= goal.targetBooks;
  const dotCount = Math.min(5, pageCount);
  const dotStart = Math.max(0, Math.min(page - 2, pageCount - dotCount));

  function renderShelf(shelf: number) {
    const offset = shelf * pageSize;
    const numbers = Array.from({ length: Math.min(pageSize, total - offset) }, (_, index) => offset + index + 1);
    const filled = numbers.filter(number => number <= goal.finishedBooks).length;
    const books = cache.current.books.get(offset) ?? [];
    return <View accessible accessibilityLabel={`Books ${offset + 1}–${offset + numbers.length} of ${total}: ${filled} finished, ${numbers.length - filled} to go.`}
      style={[styles.miniCovers, viewportWidth > 0 && { width: viewportWidth }]}>
      {numbers.map((number, index) => {
        const finished = number <= goal.finishedBooks;
        const book = finished ? books[index] : null;
        const bonus = goal.targetBooks !== null && number > goal.targetBooks;
        return <View key={number} style={styles.coverSlot}>
          <View style={styles.coverFrame}>
            <View style={[styles.miniCover, finished && styles.miniCoverRead]}>
              <Ionicons name={finished ? 'checkmark' : 'book-outline'} size={13} color={finished ? colors.gold : colors.mutedText} />
              {book ? <BookCoverImage googleBookId={book.googleBookId} isbn={book.isbn} existingCoverUrl={book.coverUrl}
                resizeMode="cover" style={styles.coverImage} accessibilityLabel={book.title} /> : null}
              {bonus ? <View style={styles.bonusStar}><Ionicons name="star" size={9} color={colors.gold} /></View> : null}
            </View>
          </View>
          <Text style={[styles.coverNumber, finished && styles.coverNumberRead]}>{number}</Text>
        </View>;
      })}
    </View>;
  }

  return <View style={styles.shelf}>
    <View style={styles.shelfHeading}>
      <Ionicons name="library-outline" size={12} color={colors.gold} />
      <Text style={styles.shelfTitle}>YOUR STORY SHELF</Text>
      {pageCount > 1 ? <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.carouselDots}>
        {Array.from({ length: dotCount }, (_, index) => <View key={dotStart + index} style={[styles.carouselDot, dotStart + index === page && styles.carouselDotActive]} />)}
      </View> : complete ? <Ionicons name="sparkles" size={14} color={colors.gold} /> : null}
    </View>
    {total > 0 ? <View testID={`${goal.kind}-goal-carousel-viewport`} style={styles.carouselViewport}
      onLayout={event => { const width = event.nativeEvent.layout.width; if (width > 0) setViewportWidth(width); }}>
      {viewportWidth > 0 ? <FlatList key={shelfKey} ref={list} horizontal pagingEnabled data={pages}
        renderItem={({ item }) => renderShelf(item)} keyExtractor={item => String(item)}
        initialScrollIndex={page} initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3}
        extraData={{ page, covers, namespace }} style={styles.carousel} showsHorizontalScrollIndicator={false}
        scrollEnabled={pageCount > 1} decelerationRate="fast" directionalLockEnabled
        getItemLayout={(_, index) => ({ length: viewportWidth, offset: viewportWidth * index, index })}
        onMomentumScrollEnd={event => setSelection({ key: shelfKey,
          page: Math.max(0, Math.min(pageCount - 1, Math.round(event.nativeEvent.contentOffset.x / viewportWidth))) })}
        accessible accessibilityRole="adjustable" accessibilityLabel={`${title} book carousel`}
        accessibilityValue={{ min: 1, max: pageCount, now: page + 1, text: `Books ${first + 1}–${Math.min(total, first + pageSize)} of ${total}` }}
        accessibilityActions={[{ name: 'increment', label: 'Next books' }, { name: 'decrement', label: 'Previous books' }]}
        onAccessibilityAction={event => {
          const step = event.nativeEvent.actionName === 'increment' ? 1 : event.nativeEvent.actionName === 'decrement' ? -1 : 0;
          if (step) setSelection({ key: shelfKey, page: Math.max(0, Math.min(pageCount - 1, page + step)) });
        }} /> : renderShelf(page)}
    </View> : <View style={styles.emptyShelf}>
      <Ionicons name="book-outline" size={24} color={colors.gold} />
      <Text style={styles.emptyShelfCopy}>Your next story starts here.</Text>
    </View>}
    {covers?.key === requestKey && covers.failed ? <Pressable accessibilityRole="button" accessibilityLabel={`${title}: retry covers`}
      onPress={() => setRetry(value => value + 1)} style={styles.coverRetry}><Text style={styles.coverRetryText}>Tap to reload covers</Text></Pressable> : null}
  </View>;
}

function GoalProgress({ fraction, style }: { fraction: number; style: object }) {
  const fill = useRef(new Animated.Value(fraction)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    const animation = Animated.timing(fill, { toValue: fraction, duration: reduceMotion ? 0 : 420, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [fill, fraction, reduceMotion]);
  return <Animated.View style={[style, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />;
}

function GoalCard({ kind, periodStart, goal, busy, loading, coverRevision, onShift, onSave, onRemove }: GoalCardProps) {
  const { colors } = useNovoriTheme();
  const styles = createStyles(colors);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  useEffect(() => { if (!editing) setDraft(goal?.targetBooks?.toString() ?? ''); }, [goal?.targetBooks, editing]);
  const title = kind === 'annual' ? 'Annual Goal' : 'Monthly Goal';
  const [year, month] = periodStart.split('-').map(Number);
  const label = kind === 'annual' ? String(year)
    : new Date(year, month - 1, 1, 12).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const display = goal ? getGoalProgressDisplay(goal) : null;
  const showEditor = goal !== null && (editing || goal.targetBooks === null);

  return <View style={styles.cardShadow}><View style={[styles.card, display?.complete && styles.cardComplete]}>
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.cardAccent, { backgroundColor: kind === 'annual' ? colors.gold : colors.softGold }]} />
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.cardGlow} />
    <View style={styles.cardTop}>
      <View style={styles.icon}><Ionicons name={kind === 'annual' ? 'ribbon-outline' : 'calendar-outline'} size={20} color={colors.gold} /></View>
      <View style={styles.cardHeading}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{kind === 'annual' ? 'The bigger picture' : 'One chapter at a time'}</Text>
      </View>
      {display?.complete ? <View style={styles.completeBadge}><Ionicons name="checkmark-circle" size={13} color={colors.background} /><Text style={styles.completeText}>Reached!</Text></View> : null}
    </View>
    <View style={styles.periodRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Previous ${kind === 'annual' ? 'year' : 'month'}`}
        disabled={busy || shiftGoalPeriod(kind, periodStart, -1) === periodStart} onPress={() => onShift(-1)} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
        <Ionicons name="chevron-back" size={17} color={colors.secondaryText} />
      </Pressable>
      <Text style={styles.period}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Next ${kind === 'annual' ? 'year' : 'month'}`}
        disabled={busy || shiftGoalPeriod(kind, periodStart, 1) === periodStart} onPress={() => onShift(1)} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
        <Ionicons name="chevron-forward" size={17} color={colors.secondaryText} />
      </Pressable>
    </View>
    {goal ? <>
      <View style={styles.readingRow}>
        <View style={styles.countBlock}>
          <View style={styles.countRow}>
            <Text style={styles.finishedCount}>{goal.finishedBooks}</Text>
            {goal.targetBooks !== null ? <Text style={styles.targetCount}>/ {goal.targetBooks}</Text> : null}
          </View>
          <Text style={styles.description}>books read</Text>
        </View>
      </View>
      <GoalShelf goal={goal} title={title} colors={colors} revision={coverRevision} />
      {goal.targetBooks !== null && display ? <>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>{display.complete ? 'You did it!' : 'Your reading is adding up'}</Text>
          <Text style={styles.progressPercent}>{Math.round(display.fraction * 100)}%</Text>
        </View>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: goal.targetBooks,
          now: Math.min(goal.finishedBooks, goal.targetBooks), text: `${goal.finishedBooks} of ${goal.targetBooks} books` }} style={styles.progressTrack}>
          <GoalProgress fraction={display.fraction} style={styles.progressFill} />
        </View>
        <Text style={styles.progressCopy}>{display.complete
          ? goal.finishedBooks > goal.targetBooks ? `${goal.finishedBooks - goal.targetBooks} beyond your goal. Look at you go!` : 'A whole shelf of stories. Worth celebrating.'
          : `${display.remaining} more book${display.remaining === 1 ? '' : 's'} to reach your goal`}</Text>
      </> : <Text style={styles.progressCopy}>A little reading, a shelf full of stories. Pick your pace.</Text>}
      {showEditor ? <View style={styles.editor}>
        <View style={styles.editorRow}>
          <TextInput accessibilityLabel={`${title} book target`} value={draft} onChangeText={setDraft}
            keyboardType="number-pad" placeholder="Book target"
            placeholderTextColor={colors.mutedText} maxLength={5} editable={!busy} style={styles.input} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Save ${title}`} disabled={busy || loading}
            style={({ pressed }) => [styles.save, (busy || loading) && styles.disabled, pressed && styles.pressed]} onPress={async () => { if (await onSave(draft)) setEditing(false); }}>
            {busy ? <ActivityIndicator color={colors.background} /> : <><Ionicons name={editing ? 'checkmark' : 'flag-outline'} size={15} color={colors.background} /><Text style={styles.saveText}>{editing ? 'Save' : 'Set Goal'}</Text></>}
          </Pressable>
        </View>
        {editing ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => setEditing(false)} style={styles.textButton}><Text style={styles.secondaryAction}>Cancel</Text></Pressable> : null}
      </View> : <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${title}`} disabled={busy || loading} onPress={() => setEditing(true)} style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
          <Ionicons name="create-outline" size={14} color={colors.gold} /><Text style={styles.primaryAction}>Edit Goal</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${title}`} disabled={busy || loading} onPress={onRemove} style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
          <Text style={styles.secondaryAction}>Remove</Text>
        </Pressable>
      </View>}
    </> : <View style={styles.loadingCard}>{loading ? <ActivityIndicator color={colors.gold} /> : <Text style={styles.description}>Your goal couldn’t be loaded.</Text>}</View>}
  </View></View>;
}

export default function ReadingGoalsScreen() {
  const router = useRouter();
  const { colors } = useNovoriTheme();
  const styles = createStyles(colors);
  const [annualStart, setAnnualStart] = useState(() => getGoalPeriodStart('annual'));
  const [monthlyStart, setMonthlyStart] = useState(() => getGoalPeriodStart('monthly'));
  const [progress, setProgress] = useState<ReadingGoalsProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [coverRevision, setCoverRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [warning, setWarning] = useState<{ title: string; message: string } | null>(null);
  const loadVersion = useRef(0);
  const focused = useRef(false);
  const mutationInFlight = useRef(false);
  const selectedPeriods = useRef({ annualStart, monthlyStart });
  selectedPeriods.current = { annualStart, monthlyStart };
  const currentPeriods = useRef({ annual: getGoalPeriodStart('annual'), monthly: getGoalPeriodStart('monthly') });

  const load = useCallback(async () => {
    if (!focused.current || mutationInFlight.current) return;
    const version = ++loadVersion.current;
    setLoading(true); setError('');
    try {
      const selected = selectedPeriods.current;
      const next = await getReadingGoalsProgress(selected.annualStart, selected.monthlyStart);
      if (version === loadVersion.current) { setProgress(next); setCoverRevision(value => value + 1); }
    } catch {
      if (version === loadVersion.current) setError('Reading goals are temporarily unavailable. Tap to try again.');
    } finally { if (version === loadVersion.current) { setLoading(false); setRefreshing(false); } }
  }, []);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    void load();
    return () => { focused.current = false; loadVersion.current += 1; };
  }, [load, annualStart, monthlyStart]));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function syncCalendar() {
      const now = new Date();
      const next = { annual: getGoalPeriodStart('annual', now), monthly: getGoalPeriodStart('monthly', now) };
      const previous = currentPeriods.current;
      setAnnualStart(value => value === previous.annual ? next.annual : value);
      setMonthlyStart(value => value === previous.monthly ? next.monthly : value);
      currentPeriods.current = next;
      clearTimeout(timer);
      timer = setTimeout(syncCalendar, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 50);
    }
    syncCalendar();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { syncCalendar(); void load(); }
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [load]);

  async function save(kind: ReadingGoalKind, value: string) {
    const target = parseGoalTarget(value);
    if (target === null) { setWarning({ title: 'Choose a book target', message: 'Enter a whole number of books from 1 to 10,000.' }); return false; }
    if (mutationInFlight.current) return false;
    const periodStart = kind === 'annual' ? annualStart : monthlyStart;
    mutationInFlight.current = true;
    loadVersion.current += 1;
    setLoading(false); setBusy(true);
    try {
      await saveReadingGoal(kind, periodStart, target);
      setProgress(previous => previous ? { ...previous, [kind]: { ...previous[kind], targetBooks: target } } : previous);
      return true;
    } catch {
      setWarning({ title: 'Could not save goal', message: 'Your target wasn’t changed. Please try again.' }); return false;
    } finally { mutationInFlight.current = false; setBusy(false); void load(); }
  }

  async function remove(kind: ReadingGoalKind) {
    if (mutationInFlight.current) return;
    const periodStart = kind === 'annual' ? annualStart : monthlyStart;
    mutationInFlight.current = true;
    loadVersion.current += 1;
    setLoading(false); setBusy(true);
    try {
      await removeReadingGoal(kind, periodStart);
      setProgress(previous => previous ? { ...previous, [kind]: { ...previous[kind], targetBooks: null } } : previous);
    } catch { setWarning({ title: 'Could not remove goal', message: 'Your goal is still saved. Please try again.' }); }
    finally { mutationInFlight.current = false; setBusy(false); void load(); }
  }

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>Reading Goals</Text>
      <Ionicons name="flag-outline" size={22} color={colors.gold} />
    </View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.gold} onRefresh={() => { if (!busy) { setRefreshing(true); void load(); } }} />}>
        <View style={styles.introCard}>
          <View style={styles.introCopy}>
            <Text style={styles.eyebrow}>YOUR NEXT CHAPTER</Text>
            <Text style={styles.hero}>Small goals. Big stories.</Text>
            <Text style={styles.intro}>Your pace, your next great read.</Text>
          </View>
          <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.heroMark}>
            <Ionicons name="book-outline" size={33} color={colors.gold} />
            <View style={styles.heroSpark}><Ionicons name="sparkles" size={15} color={colors.gold} /></View>
          </View>
        </View>
        {error ? <Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></Pressable> : null}
        <GoalCard key={`annual:${annualStart}`} kind="annual" periodStart={annualStart} busy={busy} loading={loading} coverRevision={coverRevision}
          goal={progress?.annual.periodStart === annualStart ? progress.annual : null}
          onShift={amount => setAnnualStart(shiftGoalPeriod('annual', annualStart, amount))}
          onSave={value => save('annual', value)} onRemove={() => remove('annual')} />
        <GoalCard key={`monthly:${monthlyStart}`} kind="monthly" periodStart={monthlyStart} busy={busy} loading={loading} coverRevision={coverRevision}
          goal={progress?.monthly.periodStart === monthlyStart ? progress.monthly : null}
          onShift={amount => setMonthlyStart(shiftGoalPeriod('monthly', monthlyStart, amount))}
          onSave={value => save('monthly', value)} onRemove={() => remove('monthly')} />
        <View style={styles.details}>
          <View style={styles.privacyRow}><Ionicons name="lock-closed-outline" size={12} color={colors.mutedText} /><Text style={styles.privacyCopy}>Just for you. Every finish counts.</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="How goals count" accessibilityState={{ expanded: showDetails }}
            onPress={() => setShowDetails(value => !value)} style={({ pressed }) => [styles.explainerToggle, pressed && styles.pressed]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.gold} />
            <Text style={styles.explainerTitle}>How goals count</Text>
            <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={15} color={colors.gold} />
          </Pressable>
          {showDetails ? <Text style={styles.explainerCopy}>Each recorded finish counts, including rereads. Read books need a finish date; DNF journeys don’t count. Goals use calendar periods in your phone’s time zone, with a separate target for each month.</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    <ValidationWarningSheet visible={warning !== null} title={warning?.title ?? ''} message={warning?.message ?? ''} onDismiss={() => setWarning(null)} />
  </SafeAreaView>;
}

function createStyles(colors: NovoriColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
    back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, fontSize: 20, fontFamily: 'PlayfairDisplay_600SemiBold', color: colors.text },
    content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 22, gap: 12 },
    introCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 2, paddingBottom: 2 }, introCopy: { flex: 1 },
    eyebrow: { color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.3 },
    hero: { color: colors.text, fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 23, lineHeight: 29, marginTop: 4 },
    intro: { color: colors.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 3 },
    heroMark: { borderWidth: 1, borderColor: `${colors.gold}45`, width: 54, height: 58, borderRadius: 18, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
    heroSpark: { position: 'absolute', top: -4, right: -4, backgroundColor: colors.background, padding: 3, borderRadius: 12 },
    cardShadow: { borderRadius: 18, backgroundColor: colors.surface, shadowColor: '#000000', shadowOpacity: 0.13, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
    cardAccent: { position: 'absolute', top: 0, left: 16, right: 16, height: 2, borderRadius: 2, opacity: 0.85 },
    cardGlow: { position: 'absolute', top: -55, right: -35, width: 160, height: 160, borderRadius: 80, backgroundColor: colors.gold, opacity: 0.035 },
    card: { backgroundColor: colors.surface, borderColor: `${colors.gold}40`, borderWidth: 1, borderRadius: 18, padding: 12, overflow: 'hidden' },
    cardComplete: { borderColor: colors.gold },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    icon: { width: 34, height: 34, borderRadius: 11, backgroundColor: `${colors.gold}16`, borderWidth: 1, borderColor: `${colors.gold}40`, alignItems: 'center', justifyContent: 'center' },
    cardHeading: { flex: 1 }, cardTitle: { color: colors.text, fontSize: 17, fontFamily: 'PlayfairDisplay_600SemiBold' },
    cardSubtitle: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 2 },
    completeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 5, backgroundColor: colors.gold, borderRadius: 10 },
    completeText: { color: colors.background, fontFamily: 'Inter_700Bold', fontSize: 10 },
    periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 11 },
    arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    period: { flex: 1, textAlign: 'center', color: colors.secondaryText, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
    readingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 0, marginBottom: 0 }, countBlock: { flex: 1 },
    countRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 5 },
    finishedCount: { color: colors.gold, fontSize: 36, lineHeight: 40, fontFamily: 'PlayfairDisplay_600SemiBold' },
    targetCount: { color: colors.mutedText, fontFamily: 'Inter_500Medium', fontSize: 16 },
    description: { color: colors.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 11 },
    shelf: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 6, paddingVertical: 6, marginTop: 5 },
    shelfHeading: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 4, marginBottom: 1 },
    shelfTitle: { flex: 1, color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 0.7 },
    carouselViewport: { minHeight: 76 }, carousel: { flexGrow: 0 },
    carouselDots: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    carouselDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.border },
    carouselDotActive: { width: 12, backgroundColor: colors.gold },
    miniCovers: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 4 },
    coverSlot: { flex: 1, maxWidth: 44, minWidth: 0, alignItems: 'center' },
    coverFrame: { width: '100%', maxWidth: 40, borderRadius: 5, backgroundColor: colors.surface,
      shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    miniCover: { width: '100%', aspectRatio: 2 / 3, borderWidth: 1, borderColor: colors.border, borderRadius: 5,
      backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    miniCoverRead: { borderColor: `${colors.gold}B3` },
    coverImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 4 },
    coverNumber: { color: colors.mutedText, fontFamily: 'Inter_500Medium', fontSize: 8, lineHeight: 12, marginTop: 3, paddingHorizontal: 4, borderRadius: 5 },
    coverNumberRead: { color: colors.gold, backgroundColor: `${colors.gold}12` },
    bonusStar: { position: 'absolute', right: 0, top: 0, backgroundColor: colors.surface, padding: 2, borderBottomLeftRadius: 4 },
    emptyShelf: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 4 },
    emptyShelfCopy: { flex: 1, color: colors.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 11 },
    coverRetry: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    coverRetryText: { color: colors.gold, fontFamily: 'Inter_500Medium', fontSize: 10 },
    progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5, marginBottom: 4 },
    progressLabel: { flex: 1, color: colors.secondaryText, fontFamily: 'Inter_500Medium', fontSize: 10 },
    progressPercent: { color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: `${colors.gold}12` },
    progressTrack: { height: 7, borderRadius: 7, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 6 },
    progressCopy: { color: colors.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 15, marginTop: 4 },
    editor: { marginTop: 6 },
    editorRow: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, minWidth: 65, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontFamily: 'Inter_500Medium', fontSize: 14 },
    save: { backgroundColor: colors.gold, borderRadius: 11, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', minHeight: 44, flexDirection: 'row', gap: 5 },
    saveText: { color: colors.background, fontFamily: 'Inter_700Bold', fontSize: 12 }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
    actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 5, paddingTop: 2, borderTopWidth: 1, borderTopColor: colors.border },
    editButton: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, paddingHorizontal: 10, borderRadius: 11, backgroundColor: `${colors.gold}12`, borderWidth: 1, borderColor: `${colors.gold}30` },
    textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
    primaryAction: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 11 }, secondaryAction: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 11 },
    loadingCard: { paddingVertical: 28, alignItems: 'center' }, errorBox: { padding: 12, borderRadius: 12, backgroundColor: colors.elevated }, errorText: { color: colors.gold, fontSize: 12, lineHeight: 18 },
    details: { paddingHorizontal: 2 }, privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
    privacyCopy: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10 },
    explainerToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
    explainerTitle: { color: colors.gold, fontFamily: 'Inter_500Medium', fontSize: 11 },
    explainerCopy: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, paddingBottom: 4 },
  });
}
