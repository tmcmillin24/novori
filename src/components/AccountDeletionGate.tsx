import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getAccountDeletionStatus, getStoredDeletionStatus, subscribeAccountDeletion, clearDeletedAccountLocalData, type AccountDeletionStatus } from '../lib/account-deletion';
import { supabase } from '../lib/supabase';

export default function AccountDeletionGate() {
  const router = useRouter(), pathname = usePathname(), navigation = useRootNavigationState();
  const [status, setStatus] = useState<AccountDeletionStatus | null>(null);
  const sequence = useRef(0), lastUser = useRef<string | null>(null), pendingUser = useRef<string | null>(null);
  useEffect(() => {
    let mounted = true;
    async function check() {
      const version = ++sequence.current;
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted || version !== sequence.current) return;
      if (!session) {
        if (lastUser.current) {
          if (pendingUser.current === lastUser.current) await clearDeletedAccountLocalData(lastUser.current).catch(() => {});
          lastUser.current = null; pendingUser.current = null; router.replace('/auth');
        }
        setStatus(null); return;
      }
      if (lastUser.current !== session.user.id) { setStatus(null); pendingUser.current = null; }
      lastUser.current = session.user.id;
      const stored = await getStoredDeletionStatus(session.user.id);
      if (stored && mounted && version === sequence.current) { pendingUser.current = session.user.id; setStatus(stored); }
      try {
        const latest = await getAccountDeletionStatus();
        if (mounted && version === sequence.current) { pendingUser.current = latest.state === 'active' ? null : session.user.id; setStatus(latest); }
      } catch (error) {
        // Missing rollout RPCs or a network failure never imply that an account was deleted.
        if ((error as { code?: string }).code === '42501') {
          const { data, error: accountError } = await supabase.auth.getUser();
          if (!mounted || version !== sequence.current) return;
          if ((!accountError && !data.user) || (accountError && ['user_not_found', 'session_not_found'].includes(accountError.code ?? ''))) {
            await clearDeletedAccountLocalData(session.user.id).catch(() => {});
            if (!mounted || version !== sequence.current) return;
            await supabase.auth.signOut({ scope: 'local' });
            if (mounted) { setStatus(null); router.replace('/auth'); }
          }
        }
      }
    }
    void check();
    // Do not await Supabase APIs inside onAuthStateChange; defer outside its auth lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => { setTimeout(() => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT' && lastUser.current && pendingUser.current === lastUser.current) {
        void clearDeletedAccountLocalData(lastUser.current).catch(() => {}); pendingUser.current = null; router.replace('/auth');
      }
      void check();
    }, 0); });
    // Completion happens on the server; an open screen must notice without an app restart.
    const poll = setInterval(() => { if (pendingUser.current) void check(); }, 15000);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    const unsubscribe = subscribeAccountDeletion(latest => { if (mounted) { pendingUser.current = latest.state === 'active' ? null : lastUser.current; setStatus(latest); } });
    return () => { mounted = false; sequence.current++; clearInterval(poll); subscription.unsubscribe(); foreground.remove(); unsubscribe(); };
  }, [router]);
  useEffect(() => {
    if (navigation?.key && status && status.state !== 'active' && pathname !== '/delete-account' && pathname !== '/auth' && pathname !== '/auth-confirm' && pathname !== '/help-support') router.replace('/delete-account');
  }, [status, pathname, navigation?.key, router]);
  return null;
}
