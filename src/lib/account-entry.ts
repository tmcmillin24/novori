import { supabase } from './supabase';
import { getAccountDeletionStatus, getStoredDeletionStatus } from './account-deletion';
import { isAccountUnavailableError } from './account-session-errors';
import { signOutCurrentDevice } from './sign-out';

/** Decide the account's destination before normal app data is requested. */
export async function getAccountEntryRoute(): Promise<'/auth' | '/delete-account' | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (isAccountUnavailableError(error) || (!user && !error)) {
    await signOutCurrentDevice().catch(() => {});
    return '/auth';
  }
  if (error) throw error;
  if (!user) return '/auth';
  const stored = await getStoredDeletionStatus(user.id);
  const status = stored ?? await getAccountDeletionStatus().catch(() => null);
  return status && status.state !== 'active' ? '/delete-account' : null;
}
