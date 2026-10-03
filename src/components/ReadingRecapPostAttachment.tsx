import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
import { getRecapCardTitle, getRecapSnapshotNote, type ReadingRecapSnapshot } from '../lib/reading-recap-card';
import BookCoverImage from './BookCoverImage';

// Feed, profile, club, detail, and composer render this same frozen snapshot.
// It never fetches the author's private history or calls a book provider.
export default function ReadingRecapPostAttachment({ snapshot }: { snapshot: ReadingRecapSnapshot }) {
  const { colors } = useNovoriTheme();
  const styles = useMemo(() => StyleSheet.create({
    card: { backgroundColor: colors.background, borderRadius: 15, borderWidth: 1, borderColor: `${colors.gold}40`, overflow: 'hidden', padding: 13, marginTop: 8 },
    accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: colors.gold },
    eyebrow: { color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 1.2, textAlign: 'center', marginTop: 2 },
    title: { color: colors.text, fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 23, lineHeight: 30, textAlign: 'center', marginTop: 5 },
    note: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 16, textAlign: 'center', marginTop: 4 },
    stats: { flexDirection: 'row', alignItems: 'center', marginTop: 13, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    stat: { flex: 1, alignItems: 'center', gap: 3 }, number: { color: colors.gold, fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 28 },
    label: { color: colors.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 9, textAlign: 'center' },
    divider: { height: 36, width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    covers: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 }, coverSlot: { width: '16.666667%', maxWidth: 58, paddingHorizontal: 3 },
    cover: { width: '100%', aspectRatio: 2/3, borderRadius: 5, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    image: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  }), [colors]);
  const note = getRecapSnapshotNote(snapshot);
  return <View style={styles.card}>
    <View style={styles.accent} pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
    <Text style={styles.eyebrow}>{snapshot.kind === 'year' ? 'A YEAR OF STORIES' : snapshot.kind === 'month' ? 'A MONTH IN BOOKS' : 'A WEEK IN BOOKS'}</Text>
    <Text style={styles.title}>{getRecapCardTitle(snapshot)}</Text>
    {note ? <Text style={styles.note}>{note}</Text> : null}
    <View style={styles.stats}>
      <View style={styles.stat}><Text style={styles.number}>{snapshot.finishedBooks}</Text><Text style={styles.label}>books read</Text></View><View style={styles.divider} />
      <View style={styles.stat}><Text style={styles.number}>{snapshot.daysRead}</Text><Text style={styles.label}>days logged</Text></View><View style={styles.divider} />
      <View style={styles.stat}><Text style={styles.number}>{snapshot.bestStreak}</Text><Text style={styles.label}>day best streak</Text></View>
    </View>
    {snapshot.books.length ? <View style={styles.covers}>{snapshot.books.map((book,index) => <View key={index} style={styles.coverSlot}>
      <View style={styles.cover}><Ionicons name="book-outline" size={16} color={colors.gold} />
        <BookCoverImage googleBookId={book.googleBookId} isbn={book.isbn} existingCoverUrl={book.coverUrl} resizeMode="cover" style={styles.image} accessibilityLabel={book.title} />
      </View></View>)}</View> : null}
    {snapshot.finishedBooks > snapshot.books.length ? <Text style={styles.note}>+{snapshot.finishedBooks - snapshot.books.length} more finished</Text> : null}
  </View>;
}
