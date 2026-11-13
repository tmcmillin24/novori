import { useEffect } from 'react';
import { AppState } from 'react-native';
import { createNotificationCountRefresh } from './notification-count-refresh';
import { getNotificationAttentionCount } from './notifications';
import { isTransientReadError } from './session-read-cache';
import { supabase } from './supabase';

export function useNotificationAttention(onValue: (count: number) => void) {
  useEffect(() => {
    let active = true, userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let refresh: ReturnType<typeof createNotificationCountRefresh> | null = null;
    let authRevision = 0;
    let authTimer: ReturnType<typeof setTimeout> | undefined;
    function connect(nextId: string | null) {
      if (!active || nextId === userId && refresh) return;
      refresh?.dispose(); refresh = null;
      if (channel) { void supabase.removeChannel(channel); channel = null; }
      userId = nextId; onValue(0);
      if (!nextId) return;
      const current = createNotificationCountRefresh({
        foreground: AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
        read: signal => getNotificationAttentionCount({ signal, expectedUserId: nextId }),
        apply: onValue,
        retryable: error => isTransientReadError(error) || (error as { name?: string })?.name === 'AuthRetryableFetchError' || /cancelled|canceled/i.test((error as { message?: string })?.message ?? ''),
        report: () => console.warn('[Novori notifications] Badge refresh unavailable; keeping the last count and retrying on reconnect or foreground.'),
      });
      refresh = current;
      channel = supabase.channel(`home-notification-count-${nextId}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${nextId}` }, () => current.request())
        .subscribe(status => { if (status === 'SUBSCRIBED') current.request(); });
      current.request();
    }
    async function session() {
      const revision = authRevision;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (revision === authRevision) connect(data.session?.user.id ?? null);
      } catch { if (active) console.warn('[Novori notifications] Waiting for session connectivity; the inbox is unchanged.'); }
    }
    void session();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      authRevision++;
      if (authTimer) clearTimeout(authTimer);
      authTimer = setTimeout(() => connect(session?.user.id ?? null), 0);
    });
    const foreground = AppState.addEventListener('change', state => {
      refresh?.setForeground(state === 'active');
      if (state === 'active') void session();
    });
    return () => { active = false; if (authTimer) clearTimeout(authTimer); refresh?.dispose(); subscription.unsubscribe(); foreground.remove(); if (channel) void supabase.removeChannel(channel); };
  }, [onValue]);
}
