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
    checking: 'Checking this phone…', enabled: '',
    off: 'Phone alerts are off.', denied: 'Notifications are disabled in your phone settings.',
    unavailable: 'Phone alerts need a physical device and the latest Novori build. Your in-app inbox still works.',
    error: 'Could not connect for phone alerts.',
  };
  async function action() {
    setBusy(true);
    try {
      if (status === 'denied') await Linking.openSettings();
      else await syncPushDevice(true);
    } catch { Alert.alert('Could not connect', 'Please try again. If this continues, check that you have the latest Novori build.'); }
    finally { setBusy(false); }
  }
  if (status === 'enabled') return null;
  return <SettingsSection icon="phone-portrait-outline" title="On this phone">
    <View style={{ padding: 16, gap: 14 }}>
      <Text style={{ color: colors.mutedText, fontFamily: 'Inter_400Regular', lineHeight: 21 }}>{descriptions[status]}</Text>
      {status !== 'unavailable' && status !== 'checking' ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void action()} style={{ padding: 13, borderRadius: 12, backgroundColor: colors.gold, opacity: busy ? 0.6 : 1 }}>
        <Text style={{ color: colors.background, textAlign: 'center', fontFamily: 'Inter_600SemiBold' }}>{busy ? 'Connecting…' : status === 'denied' ? 'Open phone settings' : 'Enable phone notifications'}</Text>
      </Pressable> : null}
    </View>
  </SettingsSection>;
}
