import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
import { getReadingReminderPreferences, parseReminderTime, ReadingReminderKind,
  ReadingReminderPreferences, updateReadingReminderPreferences } from '../lib/reading-reminders';

const OPTIONS: { key: ReadingReminderKind; title: string; detail: string }[] = [
  { key: 'daily_checkin', title: 'Daily Check-in', detail: 'A reminder if you have a book in Reading and haven’t checked in today.' },
  { key: 'still_reading', title: 'Still Reading?', detail: 'A gentle weekly nudge after seven days without reading activity. Paused journeys are skipped.' },
  { key: 'weekly_recap', title: 'Weekly Recap', detail: 'On Mondays, when the previous week has reading activity.' },
  { key: 'monthly_recap', title: 'Monthly Recap', detail: 'On the first of the month, when the previous month has reading activity.' },
];

export default function ReadingReminderSettings() {
  const { colors } = useNovoriTheme();
  const [preferences, setPreferences] = useState<ReadingReminderPreferences | null>(null);
  const [time, setTime] = useState('18:00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    getReadingReminderPreferences().then((value) => {
      if (mounted) { setPreferences(value); setTime(value.reminder_time.slice(0, 5)); }
    }).catch(() => { if (mounted) setFailed(true); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function retry() {
    setLoading(true);
    try {
      const value = await getReadingReminderPreferences();
      setPreferences(value); setTime(value.reminder_time.slice(0, 5)); setFailed(false);
    } catch { setFailed(true); } finally { setLoading(false); }
  }

  async function save(changes: Parameters<typeof updateReadingReminderPreferences>[0]) {
    if (saving) return;
    setSaving(true);
    try {
      const value = await updateReadingReminderPreferences(changes);
      setPreferences(value); setTime(value.reminder_time.slice(0, 5));
    } catch (error) {
      Alert.alert('Could not save reminder', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  }

  return <View style={styles.section}>
    <Text style={[styles.label, { color: colors.mutedText }]}>READING REMINDERS</Text>
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.description, { color: colors.secondaryText }]}>Reading reminders start on at 6 p.m. in your phone’s time zone. Change the time or turn any reminder off here. These appear in Novori’s inbox, not as phone push notifications.</Text>
      {loading ? <ActivityIndicator color={colors.gold} /> : failed || !preferences ?
        <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
          <Text style={{ color: colors.gold }}>Reminders unavailable. Tap to retry.</Text>
        </Pressable> : <>
          {OPTIONS.map(({ key, title, detail }) => <View key={key} style={[styles.row, { borderBottomColor: colors.border }]}>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.detail, { color: colors.secondaryText }]}>{detail}</Text>
            </View>
            <Switch accessibilityLabel={title} value={preferences[key]} disabled={saving}
              onValueChange={(value) => save({ [key]: value })} trackColor={{ false: colors.elevated, true: colors.gold }} />
          </View>)}
          <Text style={[styles.title, { color: colors.text }]}>Reminder Time</Text>
          <Text style={[styles.detail, { color: colors.secondaryText }]}>24-hour time · {preferences.timezone}. Delivery can take up to 15 minutes. Your phone’s time zone updates when you reopen Novori.</Text>
          <View style={styles.timeRow}>
            <TextInput accessibilityLabel="Reminder time in 24-hour format" value={time} onChangeText={setTime}
              placeholder="18:00" placeholderTextColor={colors.mutedText} maxLength={5} editable={!saving}
              keyboardType="numbers-and-punctuation" style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
            <Pressable accessibilityRole="button" disabled={saving} onPress={() => {
              if (!parseReminderTime(time)) { Alert.alert('Enter a valid time', 'Use 24-hour time, such as 18:00.'); return; }
              save({ reminder_time: time });
            }} style={styles.retry}>
              <Text style={{ color: colors.gold }}>{saving ? 'Saving…' : 'Save Time'}</Text>
            </Pressable>
          </View>
        </>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 24 }, label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.3, marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 20, padding: 18 }, description: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 16, marginBottom: 8 },
  copy: { flex: 1 }, title: { fontSize: 14, fontWeight: '600' }, detail: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, width: 100, fontSize: 16 }, retry: { paddingVertical: 12 },
});
