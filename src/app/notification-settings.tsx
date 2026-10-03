import { Ionicons } from '@expo/vector-icons';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReadingReminderSettings from '../components/ReadingReminderSettings';
import { SettingsDivider, SettingsHeader, SettingsIntro, SettingsSection, SettingsToggleRow, settingsStyles } from '../components/SettingsPrimitives';
import { useNovoriTheme } from '../context/theme-context';
import { getNotificationPreferences, updateNotificationPreference, type NotificationPreferenceKey, type NotificationPreferences } from '../lib/notifications';

type Preference = { key: NotificationPreferenceKey; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap };
const READERS: Preference[] = [
  { key: 'new_followers', title: 'New Followers', subtitle: 'When a reader follows you.', icon: 'person-add-outline' },
  { key: 'reactions_and_replies', title: 'Likes & Replies', subtitle: 'Reactions, comments, and replies to your posts and reviews.', icon: 'chatbubbles-outline' },
];
const CLUBS: Preference[] = [
  { key: 'club_activity', title: 'Club Notifications', subtitle: 'Posts, announcements, events, shared reads, and club replies.', icon: 'megaphone-outline' },
  { key: 'club_invites', title: 'Club Invites', subtitle: 'Invitations to join a reading circle.', icon: 'people-outline' },
];
const READING: Preference[] = [
  { key: 'reading_started', title: 'Started Reading', subtitle: 'When readers you follow pick up a book.', icon: 'book-outline' },
  { key: 'reading_finished', title: 'Finished Reading', subtitle: 'When readers you follow finish a book.', icon: 'checkmark-circle-outline' },
];

export default function NotificationSettingsScreen() {
  const { colors } = useNovoriTheme();
  const styles = settingsStyles(colors);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [savingKey, setSavingKey] = useState<NotificationPreferenceKey | null>(null);

  const load = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true);
    try {
      const value = await getNotificationPreferences();
      if (isActive()) { setPreferences(value); setFailed(false); }
    } catch (error) {
      console.error('Could not load notification preferences:', error);
      if (isActive()) setFailed(true);
    } finally { if (isActive()) setLoading(false); }
  }, []);
  useEffect(() => {
    let mounted = true;
    void load(() => mounted);
    return () => { mounted = false; };
  }, [load]);

  async function save(key: NotificationPreferenceKey, enabled: boolean) {
    if (!preferences || savingKey) return;
    const previous = preferences;
    setPreferences({ ...previous, [key]: enabled });
    setSavingKey(key);
    try { setPreferences(await updateNotificationPreference(key, enabled)); }
    catch (error) {
      console.error('Could not save notification preference:', error);
      setPreferences(previous);
      Alert.alert('Could not save', 'That notification preference was not changed. Please try again.');
    } finally { setSavingKey(null); }
  }

  function rows(options: Preference[]) {
    return options.map(({ key, icon, title, subtitle }, index) => <Fragment key={key}>
      {index ? <SettingsDivider/> : null}
      <SettingsToggleRow icon={icon} title={title} subtitle={subtitle} value={Boolean(preferences?.[key])} disabled={savingKey !== null} onValueChange={value => void save(key, value)}/>
    </Fragment>);
  }
  const enabledCount = [...READERS, ...CLUBS, ...READING].filter(option => preferences?.[option.key]).length;

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <SettingsHeader title="Notifications"/>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SettingsIntro icon="notifications-outline" title="Keep your circle close." detail="Choose the moments you want to hear about. These alerts appear in your Novori inbox.">
        {preferences && !loading ? <View style={styles.statusPill}><Ionicons name="checkmark-circle-outline" size={13} color={colors.gold}/><Text style={styles.statusText}>{enabledCount} of 6 activity alerts on</Text></View> : null}
      </SettingsIntro>
      {loading ? <View style={styles.centered}><ActivityIndicator color={colors.gold}/></View> : failed || !preferences ?
        <View style={styles.centered}><Ionicons name="cloud-offline-outline" size={28} color={colors.gold}/><Text style={styles.errorText}>Your notification preferences couldn’t be loaded.</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry notification preferences" onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : <>
          <SettingsSection icon="chatbubbles-outline" title="Your readers">{rows(READERS)}</SettingsSection>
          <SettingsSection icon="people-outline" title="Your clubs">
            {rows(CLUBS)}
            <View style={styles.note}><Ionicons name={preferences.club_activity ? 'notifications-off-outline' : 'notifications-outline'} size={16} color={colors.gold}/><Text style={styles.noteText}>{preferences.club_activity ? 'Want to quiet just one club? Open that club’s … menu and choose Mute club notifications. Your other clubs stay on.' : 'Club activity is off for every club. Turn it on here to receive alerts from clubs you haven’t muted.'}</Text></View>
          </SettingsSection>
          <SettingsSection icon="library-outline" title="Their reading journey">{rows(READING)}</SettingsSection>
        </>}
      <ReadingReminderSettings/>
    </ScrollView>
  </SafeAreaView>;
}
