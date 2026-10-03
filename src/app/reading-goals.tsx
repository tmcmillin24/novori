import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, AppState, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ValidationWarningSheet from '../components/ValidationWarningSheet';
import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
import { getGoalPeriodStart, getGoalProgressDisplay, getReadingGoalsProgress, parseGoalTarget,
  ReadingGoalKind, ReadingGoalProgress, ReadingGoalsProgress, removeReadingGoal,
  saveReadingGoal, shiftGoalPeriod } from '../lib/reading-goals';

type GoalCardProps = {
  kind: ReadingGoalKind; periodStart: string; goal: ReadingGoalProgress | null;
  busy: boolean; loading: boolean; onShift: (amount: number) => void;
  onSave: (value: string) => Promise<boolean>; onRemove: () => Promise<void>;
};

// Decorative spines represent progress, rather than individual books or cover images.
function GoalShelf({ fraction, complete, colors }: { fraction: number; complete: boolean; colors: NovoriColors }) {
  const styles = createStyles(colors);
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.shelf}>
    <View style={styles.spines}>
      {[34, 43, 38, 48, 40, 45, 35, 42].map((height, index) => {
        const filled = (index + 1) / 8 <= fraction;
        return <View key={index} style={[styles.spine, { height, backgroundColor: filled ? index % 2 ? colors.softGold : colors.gold : colors.elevated,
          borderColor: filled ? colors.gold : colors.border, transform: [{ rotate: index === 7 ? '9deg' : '0deg' }] }]}>
          <View style={[styles.spineLine, { backgroundColor: filled ? colors.background : colors.border }]} />
        </View>;
      })}
    </View>
    <View style={styles.shelfBase} />
    {complete ? <View style={styles.shelfStar}><Ionicons name="sparkles" size={20} color={colors.gold} /></View> : null}
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

function GoalCard({ kind, periodStart, goal, busy, loading, onShift, onSave, onRemove }: GoalCardProps) {
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
  const presets = kind === 'annual' ? [12, 24, 52] : [1, 2, 4];

  return <View style={[styles.card, display?.complete && styles.cardComplete]}>
    <View style={styles.cardTop}>
      <View style={styles.icon}><Ionicons name={kind === 'annual' ? 'ribbon-outline' : 'calendar-outline'} size={20} color={colors.gold} /></View>
      <View style={styles.cardHeading}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{kind === 'annual' ? 'The bigger picture' : 'One chapter at a time'}</Text>
      </View>
      {display?.complete ? <View style={styles.completeBadge}><Ionicons name="checkmark-circle" size={13} color={colors.gold} /><Text style={styles.completeText}>Reached!</Text></View> : null}
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
          <Text style={styles.description}>book{goal.finishedBooks === 1 ? '' : 's'} finished</Text>
        </View>
        <GoalShelf fraction={display?.fraction ?? 0} complete={display?.complete ?? false} colors={colors} />
      </View>
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
        <View style={styles.presetRow}>
          <Text style={styles.inputLabel}>Aim for</Text>
          {presets.map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${title}: ${value} books`}
            accessibilityState={{ selected: draft === String(value), disabled: busy || loading }} disabled={busy || loading}
            onPress={() => setDraft(String(value))} style={({ pressed }) => [styles.preset, draft === String(value) && styles.presetSelected, pressed && styles.pressed]}>
            <Text style={[styles.presetText, draft === String(value) && styles.presetTextSelected]}>{value}</Text>
          </Pressable>)}
          <Text style={styles.presetHint}>or your own</Text>
        </View>
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
  </View>;
}

export default function ReadingGoalsScreen() {
  const router = useRouter();
  const { colors } = useNovoriTheme();
  const styles = createStyles(colors);
  const [annualStart, setAnnualStart] = useState(() => getGoalPeriodStart('annual'));
  const [monthlyStart, setMonthlyStart] = useState(() => getGoalPeriodStart('monthly'));
  const [progress, setProgress] = useState<ReadingGoalsProgress | null>(null);
  const [loading, setLoading] = useState(true);
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
      if (version === loadVersion.current) setProgress(next);
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
        <GoalCard key={`annual:${annualStart}`} kind="annual" periodStart={annualStart} busy={busy} loading={loading}
          goal={progress?.annual.periodStart === annualStart ? progress.annual : null}
          onShift={amount => setAnnualStart(shiftGoalPeriod('annual', annualStart, amount))}
          onSave={value => save('annual', value)} onRemove={() => remove('annual')} />
        <GoalCard key={`monthly:${monthlyStart}`} kind="monthly" periodStart={monthlyStart} busy={busy} loading={loading}
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
    heroMark: { width: 54, height: 58, borderRadius: 18, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
    heroSpark: { position: 'absolute', top: -4, right: -4, backgroundColor: colors.background, padding: 3, borderRadius: 12 },
    card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 14, overflow: 'hidden' },
    cardComplete: { borderColor: colors.gold },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    icon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
    cardHeading: { flex: 1 }, cardTitle: { color: colors.text, fontSize: 17, fontFamily: 'PlayfairDisplay_600SemiBold' },
    cardSubtitle: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 2 },
    completeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 5, backgroundColor: colors.elevated, borderRadius: 10 },
    completeText: { color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: 10 },
    periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7, backgroundColor: colors.elevated, borderRadius: 11 },
    arrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    period: { flex: 1, textAlign: 'center', color: colors.secondaryText, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
    readingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 7, marginBottom: 3 }, countBlock: { flex: 1 },
    countRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 5 },
    finishedCount: { color: colors.gold, fontSize: 38, fontFamily: 'PlayfairDisplay_600SemiBold' },
    targetCount: { color: colors.mutedText, fontFamily: 'Inter_500Medium', fontSize: 16 },
    description: { color: colors.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 11 },
    shelf: { width: 102, paddingTop: 8, paddingHorizontal: 3 }, spines: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 50 },
    spine: { width: 9, borderWidth: 1, borderRadius: 2, justifyContent: 'flex-end', paddingBottom: 6 },
    spineLine: { height: 2, marginHorizontal: 1, opacity: 0.6 }, shelfBase: { height: 3, borderRadius: 2, backgroundColor: colors.border, marginTop: 2 },
    shelfStar: { position: 'absolute', right: 0, top: -4 },
    progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 6 },
    progressLabel: { flex: 1, color: colors.secondaryText, fontFamily: 'Inter_500Medium', fontSize: 10 },
    progressPercent: { color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: 11 },
    progressTrack: { height: 6, borderRadius: 6, backgroundColor: colors.elevated, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 6 },
    progressCopy: { color: colors.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 7 },
    editor: { marginTop: 10 }, presetRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
    inputLabel: { color: colors.secondaryText, fontFamily: 'Inter_500Medium', fontSize: 10, marginRight: 1 },
    preset: { minWidth: 44, minHeight: 44, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    presetSelected: { borderColor: colors.gold, backgroundColor: colors.gold },
    presetText: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 12 }, presetTextSelected: { color: colors.background },
    presetHint: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10 },
    editorRow: { flexDirection: 'row', gap: 8 },
    input: { flex: 1, minWidth: 65, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontFamily: 'Inter_500Medium', fontSize: 14 },
    save: { backgroundColor: colors.gold, borderRadius: 11, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', minHeight: 44, flexDirection: 'row', gap: 5 },
    saveText: { color: colors.background, fontFamily: 'Inter_700Bold', fontSize: 12 }, disabled: { opacity: 0.55 }, pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
    actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 7 },
    editButton: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, paddingHorizontal: 10, borderRadius: 11, backgroundColor: colors.elevated },
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
