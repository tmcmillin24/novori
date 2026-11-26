import { Fragment, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SettingsDivider, SettingsSection, SettingsToggleRow, settingsStyles } from './SettingsPrimitives';
import { useNovoriTheme } from '../context/theme-context';
import { getReadingReminderPreferences, ReadingReminderKind,
  ReadingReminderPreferences, updateReadingReminderPreferences } from '../lib/reading-reminders';

const OPTIONS: { key: ReadingReminderKind; title: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { icon: 'checkmark-circle-outline', key: 'daily_checkin', title: 'Daily Check-in' },
  { icon: 'book-outline', key: 'still_reading', title: 'Still Reading?' },
  { icon: 'calendar-outline', key: 'weekly_recap', title: 'Weekly Recap' },
  { icon: 'sparkles-outline', key: 'yearly_recap', title: 'Yearly Recap' },
  { icon: 'albums-outline', key: 'monthly_recap', title: 'Monthly Recap' },
];

export default function ReadingReminderSettings() {
  const { colors } = useNovoriTheme();
  const styles = settingsStyles(colors);
  const [preferences, setPreferences] = useState<ReadingReminderPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    getReadingReminderPreferences().then((value) => {
      if (mounted) setPreferences(value);
    }).catch(() => { if (mounted) setFailed(true); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function retry() {
    setLoading(true);
    try {
      const value = await getReadingReminderPreferences();
      setPreferences(value); setFailed(false);
    } catch { setFailed(true); } finally { setLoading(false); }
  }

  async function save(changes: Parameters<typeof updateReadingReminderPreferences>[0]) {
    if (saving) return;
    setSaving(true);
    try {
      const value = await updateReadingReminderPreferences(changes);
      setPreferences(value);
    } catch (error) {
      Alert.alert('Could not save reminder', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  }

  return <SettingsSection icon="time-outline" title="Your reading rhythm">
    {loading ? <View style={styles.centered}><ActivityIndicator color={colors.gold}/></View> : failed || !preferences ?
      <View style={styles.centered}><Text style={styles.errorText}>Reading reminders are unavailable.</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry reading reminders" onPress={retry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : <>
        {OPTIONS.map(({ key, title, icon }, index) => <Fragment key={key}>
          {index ? <SettingsDivider/> : null}
          <SettingsToggleRow icon={icon} title={title} value={preferences[key]} disabled={saving} onValueChange={value => void save({ [key]: value })}/>
        </Fragment>)}
      </>}

  </SettingsSection>;
}
