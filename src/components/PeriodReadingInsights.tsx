import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { parseReadingInsights, type ReadingInsights } from '../lib/reading-insights';
import { useNovoriTheme } from '../context/theme-context';
import ReadingInsightStats from './ReadingInsightStats';

export default function PeriodReadingInsights({ start, end, revision }: { start: string; end: string; revision: number }) {
  const { colors } = useNovoriTheme();
  const [insights, setInsights] = useState<ReadingInsights>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setInsights(undefined); setFailed(false);
    void (async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Sign in to view insights.');
      const { data, error } = await supabase.rpc('get_reading_insights', {
        period_start: start, period_end: end, reader_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      if (error) throw error;
      const parsed = parseReadingInsights(data);
      if (!parsed) throw new Error('Could not load insights.');
      if (active) setInsights(parsed);
    })().catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [start, end, revision, retry]);
  return failed ? <View><Pressable accessibilityRole="button" accessibilityLabel="Retry reading insights" onPress={() => setRetry(value => value + 1)} style={{ padding: 12 }}>
    <Text style={{ color: colors.gold, textAlign: 'center', fontSize: 11 }}>Insights couldn’t load. Tap to retry.</Text>
  </Pressable></View> : <ReadingInsightStats insights={insights} />;
}
