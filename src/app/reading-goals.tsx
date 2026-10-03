import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
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

  return <View style={styles.card}>
    <View style={styles.cardTop}>
      <View style={styles.icon}><Ionicons name={kind === 'annual' ? 'ribbon-outline' : 'calendar-outline'} size={21} color={colors.gold} /></View>
      <Text style={styles.cardTitle}>{title}</Text>
      {display?.complete ? <View style={styles.completeBadge}><Ionicons name="checkmark" size={14} color={colors.gold} /><Text style={styles.completeText}>Reached</Text></View> : null}
    </View>
    <View style={styles.periodRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Previous ${kind === 'annual' ? 'year' : 'month'}`}
        disabled={busy || shiftGoalPeriod(kind, periodStart, -1) === periodStart} onPress={() => onShift(-1)} style={styles.arrow}>
        <Ionicons name="chevron-back" size={20} color={colors.secondaryText} />
      </Pressable>
      <Text style={styles.period}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Next ${kind === 'annual' ? 'year' : 'month'}`}
        disabled={busy || shiftGoalPeriod(kind, periodStart, 1) === periodStart} onPress={() => onShift(1)} style={styles.arrow}>
        <Ionicons name="chevron-forward" size={20} color={colors.secondaryText} />
      </Pressable>
    </View>
    {goal ? <>
      <View style={styles.countRow}>
        <Text style={styles.finishedCount}>{goal.finishedBooks}</Text>
        {goal.targetBooks !== null ? <Text style={styles.targetCount}>/ {goal.targetBooks}</Text> : null}
      </View>
      <Text style={styles.description}>book{goal.finishedBooks === 1 ? '' : 's'} finished</Text>
      {goal.targetBooks !== null && display ? <>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: goal.targetBooks,
          now: Math.min(goal.finishedBooks, goal.targetBooks), text: `${goal.finishedBooks} of ${goal.targetBooks} books` }} style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${display.fraction * 100}%` }]} />
        </View>
        <Text style={styles.progressCopy}>{display.complete
          ? goal.finishedBooks > goal.targetBooks ? `${goal.finishedBooks - goal.targetBooks} beyond your goal. Keep reading your way.` : 'Goal reached. Every book is a little more to celebrate.'
          : `${display.remaining} more book${display.remaining === 1 ? '' : 's'} to reach your goal`}</Text>
      </> : <Text style={styles.progressCopy}>Set a target to give your reading something to work toward.</Text>}
      {showEditor ? <View style={styles.editor}>
        <Text style={styles.inputLabel}>How many books?</Text>
        <View style={styles.editorRow}>
          <TextInput accessibilityLabel={`${title} book target`} value={draft} onChangeText={setDraft}
            keyboardType="number-pad" placeholder={kind === 'annual' ? 'e.g. 24' : 'e.g. 2'}
            placeholderTextColor={colors.mutedText} maxLength={5} editable={!busy} style={styles.input} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Save ${title}`} disabled={busy || loading}
            style={[styles.save, (busy || loading) && styles.disabled]} onPress={async () => { if (await onSave(draft)) setEditing(false); }}>
            {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.saveText}>{editing ? 'Save Changes' : 'Set Goal'}</Text>}
          </Pressable>
        </View>
        {editing ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => setEditing(false)} style={styles.textButton}><Text style={styles.secondaryAction}>Cancel</Text></Pressable> : null}
      </View> : <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${title}`} disabled={busy || loading} onPress={() => setEditing(true)} style={styles.textButton}>
          <Text style={styles.primaryAction}>Edit Goal</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${title}`} disabled={busy || loading} onPress={onRemove} style={styles.textButton}>
          <Text style={styles.secondaryAction}>Remove Goal</Text>
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
        <Text style={styles.eyebrow}>YOUR NEXT CHAPTER</Text>
        <Text style={styles.hero}>Make room for more reading.</Text>
        <Text style={styles.intro}>Set your own pace with an annual target and a monthly target. These goals are private to you.</Text>
        {error ? <Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></Pressable> : null}
        <GoalCard key={`annual:${annualStart}`} kind="annual" periodStart={annualStart} busy={busy} loading={loading}
          goal={progress?.annual.periodStart === annualStart ? progress.annual : null}
          onShift={amount => setAnnualStart(shiftGoalPeriod('annual', annualStart, amount))}
          onSave={value => save('annual', value)} onRemove={() => remove('annual')} />
        <GoalCard key={`monthly:${monthlyStart}`} kind="monthly" periodStart={monthlyStart} busy={busy} loading={loading}
          goal={progress?.monthly.periodStart === monthlyStart ? progress.monthly : null}
          onShift={amount => setMonthlyStart(shiftGoalPeriod('monthly', monthlyStart, amount))}
          onSave={value => save('monthly', value)} onRemove={() => remove('monthly')} />
        <View style={styles.explainer}>
          <Ionicons name="information-circle-outline" size={19} color={colors.gold} />
          <Text style={styles.explainerCopy}>Each recorded finish counts, including rereads. Read books need a finish date; DNF journeys don’t count. Goals use calendar periods in your phone’s time zone, with a separate target for each month.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    <ValidationWarningSheet visible={warning !== null} title={warning?.title ?? ''} message={warning?.message ?? ''} onDismiss={() => setWarning(null)} />
  </SafeAreaView>;
}

function createStyles(colors: NovoriColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
    back: { padding: 4 }, headerTitle: { flex: 1, fontSize: 20, fontFamily: 'PlayfairDisplay_600SemiBold', color: colors.text },
    content: { padding: 20, paddingBottom: 32, gap: 18 }, eyebrow: { color: colors.gold, fontSize: 10, letterSpacing: 1.5, fontWeight: '700' },
    hero: { color: colors.text, fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 30, lineHeight: 36, marginTop: -7 },
    intro: { color: colors.secondaryText, fontSize: 14, lineHeight: 21, marginTop: -7 },
    card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 22, padding: 20 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 }, icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { flex: 1, color: colors.text, fontSize: 18, fontFamily: 'PlayfairDisplay_600SemiBold' },
    completeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 }, completeText: { color: colors.gold, fontSize: 11, fontWeight: '700' },
    periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15 },
    arrow: { padding: 8 }, period: { color: colors.secondaryText, fontSize: 14, fontWeight: '600' },
    countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 }, finishedCount: { color: colors.gold, fontSize: 48, fontWeight: '600' },
    targetCount: { color: colors.mutedText, fontSize: 23 }, description: { color: colors.secondaryText, fontSize: 13 },
    progressTrack: { height: 7, borderRadius: 7, backgroundColor: colors.elevated, overflow: 'hidden', marginTop: 20 },
    progressFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 7 }, progressCopy: { color: colors.secondaryText, fontSize: 13, lineHeight: 19, marginTop: 12 },
    editor: { marginTop: 20 }, inputLabel: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 9 },
    editorRow: { flexDirection: 'row', gap: 12 }, input: { flex: 1, minWidth: 65, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 17 },
    save: { backgroundColor: colors.gold, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center', minHeight: 46 }, saveText: { color: colors.background, fontSize: 13, fontWeight: '700' }, disabled: { opacity: 0.55 },
    actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }, textButton: { paddingVertical: 9 }, primaryAction: { color: colors.gold, fontSize: 13, fontWeight: '600' }, secondaryAction: { color: colors.mutedText, fontSize: 13 },
    loadingCard: { paddingVertical: 35, alignItems: 'center' }, errorBox: { padding: 14, borderRadius: 14, backgroundColor: colors.elevated }, errorText: { color: colors.gold, fontSize: 13, lineHeight: 19 },
    explainer: { flexDirection: 'row', gap: 9, paddingHorizontal: 3 }, explainerCopy: { flex: 1, color: colors.mutedText, fontSize: 12, lineHeight: 19 },
  });
}
