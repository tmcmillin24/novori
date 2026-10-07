import { isAccountUnavailableError } from '../lib/account-session-errors';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { resetReadingReminderDeviceSync, syncReadingReminderDevice } from '../lib/reading-reminders';
import { supabase } from '../lib/supabase';

// Register defaults without requiring a visit to notification settings.
export default function ReadingReminderDeviceSync() {
  useEffect(() => {
    let mounted = true;
    let authTimer: ReturnType<typeof setTimeout> | null = null;

    function sync(userId?: string) {
      if (!mounted || !userId) return;
      void syncReadingReminderDevice(userId).catch((error) => {
        if (isAccountUnavailableError(error)) return;
        // Missing rollout SQL/network errors must never block signing in or navigation.
        console.warn('Reading reminder device sync unavailable:', error);
      });
    }

    function syncSession() {
      void supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (!error) sync(session?.user.id);
      }).catch(() => { /* Retry on the next foreground/sign-in event. */ });
    }

    syncSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') resetReadingReminderDeviceSync();
      if (authTimer !== null) clearTimeout(authTimer);
      // Leave the auth callback before invoking Supabase again.
      authTimer = setTimeout(() => sync(session?.user.id), 0);
    });
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncSession();
    });
    return () => {
      mounted = false;
      if (authTimer !== null) clearTimeout(authTimer);
      subscription.unsubscribe();
      foreground.remove();
    };
  }, []);
  return null;
}
