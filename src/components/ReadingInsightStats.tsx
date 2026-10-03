import { Text, View, StyleSheet } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
import { getReadingInsightStats, type ReadingInsights } from '../lib/reading-insights';

export default function ReadingInsightStats({ insights }: { insights?: ReadingInsights }) {
  const { colors } = useNovoriTheme();
  const stats = getReadingInsightStats(insights);
  if (!stats.length) return null;
  return <View testID="reading-insights" style={{ alignSelf: 'stretch', marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${colors.gold}35`, paddingTop: 10 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {stats.map(stat => <View key={stat.field} style={{ flexGrow: 1, flexBasis: '45%', borderRadius: 12, padding: 10, backgroundColor: `${colors.gold}08`, borderWidth: 1, borderColor: `${colors.gold}25`, alignItems: 'center' }}>
        <Text style={{ color: colors.gold, fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 23 }}>{stat.value.toLocaleString()}</Text>
        <Text style={{ color: colors.secondaryText, fontFamily: 'Inter_500Medium', fontSize: 10 }}>{stat.label}</Text>
      </View>)}
    </View>
    {insights?.finishedBookPages && insights.finishedBooksWithPageCounts ? <Text style={{ color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 7 }}>Page counts available for {insights.finishedBooksWithPageCounts.toLocaleString()} finished {insights.finishedBooksWithPageCounts === 1 ? 'book' : 'books'}. Counted when finished; checkpoint progress is separate.</Text> : null}
    {insights?.pagesTracked ? <Text style={{ color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 7 }}>Pages tracked between recorded checkpoints. Your first checkpoint sets the starting point.</Text> : null}
  </View>;
}
