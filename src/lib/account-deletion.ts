import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
export type DeletionClub = { id: string; name: string; members: { id: string; name: string; role: string }[] };
export type AccountDeletionStatus = { state: 'active' | 'pending' | 'processing'; delete_after: string | null; can_cancel: boolean; enabled: boolean; owned_clubs: DeletionClub[] };
const listeners = new Set<(status: AccountDeletionStatus) => void>();
const pendingKey = (userId: string) => `novori:account-deletion:${userId}`;
export function subscribeAccountDeletion(listener: (status: AccountDeletionStatus) => void) {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
async function rpc(name: string, args?: Record<string, unknown>): Promise<AccountDeletionStatus> {
  const { data: { session: initialSession } } = await supabase.auth.getSession();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  if (!data || !['active', 'pending', 'processing'].includes(data.state) || !Array.isArray(data.owned_clubs)) throw new Error('Could not verify your account deletion status.');
  const status = data as AccountDeletionStatus;
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user.id !== initialSession?.user.id) throw new Error('Your signed-in account changed. Please try again.');
  if (session?.user.id) {
    try {
      if (status.state === 'active') await AsyncStorage.removeItem(pendingKey(session.user.id));
      else { await AsyncStorage.setItem(pendingKey(session.user.id), JSON.stringify(status)); await AsyncStorage.removeItem(`novori:profile-cache:${session.user.id}`); }
    } catch { /* Backend status remains authoritative if local storage is unavailable. */ }
  }
  for (const listener of listeners) listener(status);
  return status;
}
export const getAccountDeletionStatus = () => rpc('get_account_deletion_status');
export const requestAccountDeletion = (immediate = false) => rpc('request_account_deletion', { delete_immediately: immediate });
export const cancelAccountDeletion = () => rpc('cancel_account_deletion');
export async function transferDeletionClub(clubId: string, ownerId: string) {
  const { error } = await supabase.rpc('transfer_club_for_account_deletion', { target_club_id: clubId, new_owner_id: ownerId });
  if (error) throw error;
  return getAccountDeletionStatus();
}
export async function getStoredDeletionStatus(userId: string): Promise<AccountDeletionStatus | null> {
  try { const raw = await AsyncStorage.getItem(pendingKey(userId)); const status = raw ? JSON.parse(raw) : null;
    return ['pending', 'processing'].includes(status?.state) ? status : null;
  } catch { return null; }
}
/** Only personalized local state is cleared; shared book data and image caches remain untouched. */
export async function clearDeletedAccountLocalData(userId: string) {
  const keys = await AsyncStorage.getAllKeys();
  const personal = keys.filter(key => key === pendingKey(userId) || key === `novori:profile-cache:${userId}` || key.startsWith(`novori:reading-month:${userId}:`));
  if (personal.length) await AsyncStorage.multiRemove(personal);
}
