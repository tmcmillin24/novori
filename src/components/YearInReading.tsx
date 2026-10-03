import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
import { getReadingGoalBooks, type ReadingGoalBook } from '../lib/reading-goal-books';
import { getBusiestReadingMonth, getYearInReading, type ReadingYearSummary } from '../lib/year-in-reading';
import BookCoverImage from './BookCoverImage';

type Props = {
  year: number; onYearChange: (year: number) => void; onOpenMonth: (monthIndex: number) => void;
  refreshRevision: number; onRefreshComplete: () => void;
};

function monthLabel(year: number, monthIndex: number, long = false) {
  return new Date(year, monthIndex, 1, 12).toLocaleDateString(undefined, { month: long ? 'long' : 'short' });
}

function FinishedYearShelf({ summary, colors }: { summary: ReadingYearSummary; colors: NovoriColors }) {
  const router = useRouter();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const size = 6;
  const pageCount = Math.ceil(summary.finishedBooks / size);
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const books = useRef(new Map<number, ReadingGoalBook[]>());
  const pending = useRef(new Map<number, Promise<ReadingGoalBook[]>>());
  const list = useRef<FlatList<number>>(null);
  const pages = useMemo(() => Array.from({ length: pageCount }, (_, index) => index), [pageCount]);

  useEffect(() => {
    if (!pageCount) return;
    let active = true;
    setFailed(false);
    const offset = page * size;
    let request = pending.current.get(offset);
    if (!request && !books.current.has(offset)) {
      request = getReadingGoalBooks('annual', `${summary.year}-01-01`, offset, size);
      pending.current.set(offset, request);
      void request.finally(() => pending.current.delete(offset)).catch(() => {});
    }
    if (request) void request.then(result => {
      books.current.set(offset, result);
      if (active) setLoaded(value => value + 1);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [page, pageCount, summary.year, retry]);

  useEffect(() => { if (width > 0) list.current?.scrollToOffset({ offset: page * width, animated: false }); }, [page, width]);

  function renderPage(index: number) {
    const offset = index * size;
    const count = Math.min(size, summary.finishedBooks - offset);
    return <View style={[styles.covers, { width }]}>
      {Array.from({ length: size }, (_, slot) => {
        const book = books.current.get(offset)?.[slot];
        return <View key={slot} style={styles.coverSlot}>
          {slot < count ? <>
            <Pressable disabled={!book?.userBookId} accessibilityRole="button" accessibilityLabel={book ? `Open ${book.title} in Reading Details` : `Finished book ${offset + slot + 1}`}
              onPress={() => { if (book?.userBookId) router.push(`/reading-details/${book.userBookId}`); }}
              style={({ pressed }) => [styles.coverFrame, pressed && styles.pressed]}>
              <Ionicons name="book-outline" size={18} color={colors.gold} />
              {book ? <BookCoverImage googleBookId={book.googleBookId} isbn={book.isbn} existingCoverUrl={book.coverUrl}
                resizeMode="cover" style={styles.coverImage} accessibilityLabel={book.title} /> : null}
            </Pressable>
            <Text style={styles.coverNumber}>{offset + slot + 1}</Text>
          </> : null}
        </View>;
      })}
    </View>;
  }

  return <View style={styles.card}>
    <View style={styles.sectionHeading}><Ionicons name="library-outline" size={16} color={colors.gold} /><Text style={styles.sectionTitle}>The books you finished</Text></View>
    {summary.finishedBooks ? <>
      <View testID="year-books-viewport" style={styles.coverViewport} onLayout={event => { if (event.nativeEvent.layout.width > 0) setWidth(event.nativeEvent.layout.width); }}>
        {width > 0 ? <FlatList ref={list} horizontal pagingEnabled data={pages} renderItem={({ item }) => renderPage(item)}
          keyExtractor={item => String(item)} extraData={loaded} initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3}
          showsHorizontalScrollIndicator={false} scrollEnabled={pageCount > 1} decelerationRate="fast" directionalLockEnabled
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={event => setPage(Math.max(0, Math.min(pageCount - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
          accessibilityRole="adjustable" accessibilityLabel="Year in Reading book carousel"
          accessibilityValue={{ min: 1, max: pageCount, now: page + 1, text: `Books ${page * size + 1}–${Math.min(summary.finishedBooks, (page + 1) * size)} of ${summary.finishedBooks}` }}
          accessibilityActions={[{ name: 'increment', label: 'Next books' }, { name: 'decrement', label: 'Previous books' }]}
          onAccessibilityAction={event => { const step = event.nativeEvent.actionName === 'increment' ? 1 : event.nativeEvent.actionName === 'decrement' ? -1 : 0;
            if (step) setPage(current => Math.max(0, Math.min(pageCount - 1, current + step))); }} /> : null}
      </View>
      {pageCount > 1 ? <View style={styles.shelfFooter}><Text style={styles.note}>Swipe through your finished books</Text><Text style={styles.pageCount}>{page + 1}/{pageCount}</Text></View> : null}
      {failed ? <Pressable accessibilityRole="button" accessibilityLabel="Retry annual book covers" onPress={() => setRetry(value => value + 1)} style={styles.retry}>
        <Text style={styles.linkText}>Tap to reload covers</Text></Pressable> : null}
    </> : <View style={styles.emptyShelf}><Ionicons name="book-outline" size={30} color={colors.gold} /><Text style={styles.emptyTitle}>Room for your next story</Text>
      <Text style={styles.note}>Books with a recorded finish date will appear here.</Text></View>}
  </View>;
}

export default function YearInReading({ year, onYearChange, onOpenMonth, refreshRevision, onRefreshComplete }: Props) {
  const router = useRouter();
  const { colors } = useNovoriTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [summary, setSummary] = useState<ReadingYearSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [retry, setRetry] = useState(0);
  const completed = useRef(onRefreshComplete);
  completed.current = onRefreshComplete;
  const currentYear = new Date().getFullYear();

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError(null);
    void getYearInReading(year).then(result => {
      if (active) { setSummary(result); setRevision(value => value + 1); }
    }).catch(loadError => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load your year in reading.');
    }).finally(() => {
      if (active) { setLoading(false); completed.current(); }
    });
    return () => { active = false; };
  }, [year, refreshRevision, retry]));

  const busiest = summary ? getBusiestReadingMonth(summary.months) : null;
  const maximumDays = Math.max(1, ...(summary?.months.map(month => month.daysRead) ?? []));
  const fraction = summary?.annualTarget ? Math.min(1, summary.finishedBooks / summary.annualTarget) : 0;

  return <View>
    <View style={styles.yearNav}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous reading year" disabled={year <= 1970} onPress={() => onYearChange(year - 1)} style={styles.yearArrow}>
        <Ionicons name="chevron-back" size={20} color={year <= 1970 ? colors.border : colors.gold} /></Pressable>
      <Text style={styles.yearLabel}>{year}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next reading year" disabled={year >= currentYear} onPress={() => onYearChange(year + 1)} style={styles.yearArrow}>
        <Ionicons name="chevron-forward" size={20} color={year >= currentYear ? colors.border : colors.gold} /></Pressable>
    </View>
    {loading || (!error && summary?.year !== year) ? <View style={styles.loading}><ActivityIndicator color={colors.gold} /></View>
      : error ? <View style={styles.card}><Text style={styles.emptyTitle}>Your year is taking a moment</Text><Text style={styles.note}>{error}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Retry Year in Reading" onPress={() => setRetry(value => value + 1)} style={styles.retry}><Text style={styles.linkText}>Try again</Text></Pressable></View>
      : summary ? <>
        <View style={styles.cardShadow}><View style={[styles.card, styles.hero]}>
          <View style={styles.accent} pointerEvents="none" />
          <View style={styles.glow} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          <View style={styles.eyebrowRow}><Ionicons name="sparkles-outline" size={14} color={colors.gold} /><Text style={styles.eyebrow}>{year === Number(summary.asOfDate.slice(0, 4)) ? 'YOUR YEAR SO FAR' : 'YOUR YEAR IN STORIES'}</Text></View>
          <Text style={styles.heroNumber}>{summary.finishedBooks}</Text><Text style={styles.heroLabel}>books read</Text>
          <View style={styles.stats}>
            <View style={styles.stat}><Ionicons name="calendar-outline" size={18} color={colors.gold} /><Text style={styles.statNumber}>{summary.daysRead}</Text><Text style={styles.statLabel}>days logged</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.stat}><Ionicons name="flame-outline" size={18} color={colors.gold} /><Text style={styles.statNumber}>{summary.bestStreak}</Text><Text style={styles.statLabel}>day best streak</Text></View>
          </View>
          {summary.annualTarget !== null ? <View style={styles.goal}>
            <View style={styles.goalHeading}><Text style={styles.note}>Annual goal</Text><Text style={styles.linkText}>{summary.finishedBooks}/{summary.annualTarget} books</Text></View>
            <View style={styles.goalTrack} accessibilityRole="progressbar" accessibilityLabel="Annual goal progress"
              accessibilityValue={{ min: 0, max: summary.annualTarget, now: Math.min(summary.finishedBooks, summary.annualTarget), text: `${summary.finishedBooks} of ${summary.annualTarget} books` }}>
              <View style={[styles.goalFill, { width: `${fraction * 100}%` }]} /></View>
            {summary.finishedBooks >= summary.annualTarget ? <Text style={styles.goalCelebration}>Goal reached. Every next book is a bonus.</Text> : null}
          </View> : null}
          {!summary.daysRead && !summary.finishedBooks ? <Text style={styles.heroNote}>Every story starts somewhere. Your check-ins and finished books will build this year.</Text>
            : <Text style={styles.heroNote}>{year === Number(summary.asOfDate.slice(0, 4)) ? 'A year still being written.' : 'A chapter worth looking back on.'}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel="Share Year in Reading" onPress={() => router.push({ pathname: '/share-reading-recap', params: { kind: 'year', periodStart: `${year}-01-01` } })}
            style={({ pressed }) => [styles.share, pressed && styles.pressed]}><Ionicons name="share-social-outline" size={16} color={colors.gold} /><Text style={styles.shareText}>Share your year</Text></Pressable>
        </View></View>
        <View style={styles.card}>
          <View style={styles.sectionHeading}><Ionicons name="calendar-outline" size={16} color={colors.gold} /><Text style={styles.sectionTitle}>Your reading rhythm</Text></View>
          {busiest ? <Text style={styles.highlight}><Text style={styles.linkText}>{monthLabel(year, busiest.monthIndex, true)}</Text> held your most reading days · {busiest.daysRead}</Text> : <Text style={styles.note}>Your check-ins bring each month to life.</Text>}
          <View style={styles.months}>
            {summary.months.map(month => {
              const upcoming = `${year}-${String(month.monthIndex + 1).padStart(2, '0')}-01` > summary.asOfDate;
              return <Pressable key={month.monthIndex} disabled={upcoming} accessibilityRole="button"
                accessibilityLabel={`${monthLabel(year, month.monthIndex, true)} ${year}: ${upcoming ? 'upcoming' : `${month.daysRead} days logged, ${month.finishedBooks} books read. Open monthly recap`}`}
                onPress={() => onOpenMonth(month.monthIndex)} style={({ pressed }) => [styles.month, upcoming && styles.upcoming, pressed && styles.pressed]}>
                <View style={styles.monthHeading}><Text style={styles.monthName}>{monthLabel(year, month.monthIndex)}</Text>{month.daysRead ? <View style={styles.monthDot} /> : null}</View>
                <View style={styles.monthTrack}><View style={[styles.monthFill, { width: `${month.daysRead / maximumDays * 100}%` }]} /></View>
                <Text style={styles.monthMetric}>{upcoming ? 'Upcoming' : `${month.daysRead}d · ${month.finishedBooks} ${month.finishedBooks === 1 ? 'book' : 'books'}`}</Text>
              </Pressable>;
            })}
          </View>
          <Text style={styles.note}>Tap a month to open its recap.</Text>
        </View>
        <FinishedYearShelf key={`${year}:${revision}`} summary={summary} colors={colors} />
        <View style={styles.privacy}><Ionicons name="lock-closed-outline" size={11} color={colors.mutedText} /><Text style={styles.note}>Your year in reading is private.</Text></View>
      </> : null}
  </View>;
}

function createStyles(colors: NovoriColors) {
  return StyleSheet.create({
    yearNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 12 },
    yearArrow: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    yearLabel: { minWidth: 150, textAlign: 'center', color: colors.secondaryText, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
    loading: { minHeight: 300, alignItems: 'center', justifyContent: 'center' },
    cardShadow: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
    card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 18, padding: 16, marginBottom: 14, overflow: 'hidden' },
    hero: { borderColor: `${colors.gold}55`, paddingTop: 20, alignItems: 'center' },
    accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: colors.gold },
    glow: { position: 'absolute', top: -70, right: -45, width: 190, height: 190, borderRadius: 95, backgroundColor: `${colors.gold}08` },
    eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    eyebrow: { color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
    heroNumber: { color: colors.gold, fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 52, lineHeight: 60, marginTop: 8 },
    heroLabel: { color: colors.secondaryText, fontFamily: 'Inter_500Medium', fontSize: 13 },
    stats: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: 18, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    stat: { flex: 1, alignItems: 'center', gap: 3 }, statDivider: { width: StyleSheet.hairlineWidth, height: 48, backgroundColor: colors.border },
    statNumber: { color: colors.text, fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 26 }, statLabel: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10 },
    heroNote: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 8 },
    share: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: `${colors.gold}40`, backgroundColor: `${colors.gold}08` },
    shareText: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
    goal: { alignSelf: 'stretch', marginTop: 4 }, goalHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 },
    goalTrack: { height: 6, borderRadius: 3, backgroundColor: colors.elevated, overflow: 'hidden' }, goalFill: { height: '100%', backgroundColor: colors.gold, borderRadius: 3 },
    goalCelebration: { color: colors.gold, fontFamily: 'Inter_500Medium', fontSize: 10, marginTop: 7, textAlign: 'center' },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 }, sectionTitle: { flex: 1, color: colors.text, fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18 },
    highlight: { color: colors.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 10.5, lineHeight: 16, marginBottom: 2 },
    months: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginTop: 12, marginBottom: 12 },
    month: { width: '31%', minHeight: 58, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 10, backgroundColor: colors.background },
    monthHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, monthName: { color: colors.secondaryText, fontFamily: 'Inter_600SemiBold', fontSize: 11 },
    monthDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.gold }, monthTrack: { height: 3, borderRadius: 2, backgroundColor: colors.elevated, marginVertical: 6, overflow: 'hidden' },
    monthFill: { height: '100%', borderRadius: 2, backgroundColor: colors.gold }, monthMetric: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 9 }, upcoming: { opacity: 0.4 },
    note: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 16 }, linkText: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 10.5 },
    coverViewport: { minHeight: 105, marginTop: 8 }, covers: { flexDirection: 'row', gap: 7, paddingTop: 4, paddingBottom: 4 }, coverSlot: { flex: 1, minWidth: 0 },
    coverFrame: { width: '100%', aspectRatio: 2 / 3, borderRadius: 5, backgroundColor: colors.elevated, borderWidth: 1, borderColor: `${colors.gold}30`, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    coverImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' }, coverNumber: { color: colors.mutedText, fontFamily: 'Inter_500Medium', fontSize: 9, textAlign: 'center', marginTop: 6 },
    shelfFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 3 }, pageCount: { color: colors.gold, fontFamily: 'Inter_500Medium', fontSize: 10 },
    emptyShelf: { alignItems: 'center', paddingVertical: 15, gap: 8 }, emptyTitle: { color: colors.text, fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 18, marginBottom: 6 },
    retry: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, pressed: { opacity: 0.7 },
    privacy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  });
}
