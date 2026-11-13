import { useEffect, useState, useSyncExternalStore } from 'react';
import { Alert, AppState, Linking, Pressable, Text, View } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
import { getPushStatus, subscribePushStatus, syncPushDevice } from '../lib/push-notifications';
import { SettingsSection } from './SettingsPrimitives';

export default function PushNotificationSettings() {
  const { colors } = useNovoriTheme();
  const status = useSyncExternalStore(subscribePushStatus, getPushStatus, getPushStatus);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const refresh = () => { void syncPushDevice().catch(() => undefined); };
    refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => listener.remove();
  }, []);
  const descriptions = {
    checking: 'Checking this phone…', enabled: 'Phone notifications are enabled. Your choices below also control which alerts are sent.',
    off: 'Enable alerts on your lock screen and in Notification Center.', denied: 'Notifications are disabled in your phone settings.',
    unavailable: 'Phone alerts need a physical device and the latest Novori build. Your in-app inbox still works.',
    error: 'This phone could not connect for notifications. Check your connection and try again.',
  };
  async function action() {
    setBusy(true);
    try {
      if (status === 'denied') await Linking.openSettings();
      else await syncPushDevice(true);
    } catch { Alert.alert('Could not connect', 'Please try again. If this continues, check that you have the latest Novori build.'); }
    finally { setBusy(false); }
  }
  return <SettingsSection icon="phone-portrait-outline" title="On this phone">
    <View style={{ padding: 16, gap: 14 }}>
      <Text style={{ color: colors.mutedText, fontFamily: 'Inter_400Regular', lineHeight: 21 }}>{descriptions[status]}</Text>
      {status !== 'unavailable' && status !== 'checking' && status !== 'enabled' ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void action()} style={{ padding: 13, borderRadius: 12, backgroundColor: colors.gold, opacity: busy ? 0.6 : 1 }}>
        <Text style={{ color: colors.background, textAlign: 'center', fontFamily: 'Inter_600SemiBold' }}>{busy ? 'Connecting…' : status === 'denied' ? 'Open phone settings' : 'Enable phone notifications'}</Text>
      </Pressable> : null}
    </View>
  </SettingsSection>;
}
