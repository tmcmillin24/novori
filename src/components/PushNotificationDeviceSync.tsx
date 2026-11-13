import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import { getNotificationDestination } from '../lib/notification-destination';
import type { NovoriNotification } from '../lib/notifications';
import { nativeNotifications, syncPushDevice } from '../lib/push-notifications';
import { supabase } from '../lib/supabase';

export default function PushNotificationDeviceSync() {
  const router = useRouter();
  const navigation = useRootNavigationState();
  const ready = useRef(false);
  ready.current = Boolean(navigation?.key);
  useEffect(() => {
    let mounted = true;
    let pending: { id: string; recipient: string; response: string } | null = null;
    let handling = false;
    const handled = new Set<string>();
    const cleanup: (() => void)[] = [];
    async function openPending() {
      if (!mounted || !ready.current || !pending || handling) return;
      handling = true;
      const target = pending;
      try {
        const session = (await supabase.auth.getSession()).data.session;
        if (!session) return; // Keep the tap until sign-in; never open another user's item.
        if (session.user.id !== target.recipient) { pending = null; await (await nativeNotifications())?.clearLastNotificationResponseAsync(); return; }
        const { data, error } = await supabase.from('notifications').select('*').eq('id', target.id).eq('recipient_id', session.user.id).maybeSingle();
        if (error) return; // A transient offline failure can retry on foreground.
        if (!mounted) return;
        handled.add(target.response);
        if (pending === target) pending = null;
        await (await nativeNotifications())?.clearLastNotificationResponseAsync();
        if (!data) return;
        const stillSignedIn = (await supabase.auth.getSession()).data.session?.user.id === target.recipient;
        if (!stillSignedIn || !mounted) return;
        await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', target.id).eq('recipient_id', target.recipient);
        router.push(getNotificationDestination(data as NovoriNotification) ?? '/(tabs)/notifications');
      } finally { handling = false; }
    }
    function sync() {
      void syncPushDevice().then(() => explain()).catch(() => console.warn('[Novori push] Device registration failed; retry in notification settings.'));
      void openPending();
    }
    async function initialize() {
      const notifications = await nativeNotifications();
      if (!mounted || !notifications) return;
      notifications.setNotificationHandler({ handleNotification: async notification => {
        const user = (await supabase.auth.getSession()).data.session?.user.id;
        const ours = notification.request.content.data?.recipient_id === user && Boolean(user);
        return { shouldShowBanner: ours, shouldShowList: ours, shouldPlaySound: ours, shouldSetBadge: false };
      } });
      function accept(response: import('expo-notifications').NotificationResponse) {
        const data = response.notification.request.content.data ?? {};
        const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
        if (handled.has(key) || typeof data.notification_id !== 'string' || typeof data.recipient_id !== 'string') return;
        pending = { id: data.notification_id, recipient: data.recipient_id, response: key };
        void openPending();
      }
      const listener = notifications.addNotificationResponseReceivedListener(accept);
      const rotated = notifications.addPushTokenListener(() => sync());
      cleanup.push(() => listener.remove(), () => rotated.remove());
      const last = await notifications.getLastNotificationResponseAsync();
      if (mounted && last) accept(last);
      sync();
    }
    let explaining = false;
    async function explain() {
      if (explaining || !mounted) return;
      explaining = true;
      try {
        const notifications = await nativeNotifications();
        if (!notifications || !mounted) return;
      const session = (await supabase.auth.getSession()).data.session;
      const permission = await notifications.getPermissionsAsync();
      const prompted = await AsyncStorage.getItem('novori:push-explained:v1');
      if (mounted && session && !prompted && permission.canAskAgain && !permission.granted) {
        await AsyncStorage.setItem('novori:push-explained:v1', '1');
        if (mounted) Alert.alert('Stay in the loop', 'Get reading reminders, recap updates, and activity from your circle on your phone. You can choose what you receive in Settings.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Enable notifications', onPress: () => { void syncPushDevice(true).catch(() => Alert.alert('Could not enable notifications', 'Try again in Settings → Notifications.')); } },
        ]);
      }
      } finally { explaining = false; }
    }

    void initialize().catch(() => console.warn('[Novori push] Setup unavailable; the inbox remains available.'));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(sync, 0);
    });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') sync(); });
    return () => { mounted = false; if (timer) clearTimeout(timer); subscription.unsubscribe(); foreground.remove(); cleanup.forEach(fn => fn()); };
  }, [router, navigation?.key]);
  return null;
}
