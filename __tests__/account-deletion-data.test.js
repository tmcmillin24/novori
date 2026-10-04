import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccountDeletionStatus, requestAccountDeletion, clearDeletedAccountLocalData, subscribeAccountDeletion } from '../src/lib/account-deletion';
import { supabase } from '../src/lib/supabase';
jest.mock('@react-native-async-storage/async-storage', () => ({ getAllKeys: jest.fn(), multiRemove: jest.fn(), removeItem: jest.fn(), setItem: jest.fn() }));
jest.mock('../src/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() }, rpc: jest.fn() } }));
const status = { state: 'pending', delete_after: '2099-01-01', can_cancel: true, enabled: true, owned_clubs: [] };
beforeEach(() => { jest.clearAllMocks(); supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'reader' } } } }); supabase.rpc.mockResolvedValue({ data: status, error: null }); });
test('deleted-account cleanup removes personalized keys and preserves shared book caches', async () => {
 AsyncStorage.getAllKeys.mockResolvedValue(['novori:account-deletion:reader', 'novori:profile-cache:reader', 'novori:reading-month:reader:2026-10', 'novori:profile-cache:other', 'google-books:detail:cached-book', 'novori:theme']);
 await clearDeletedAccountLocalData('reader'); expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(['novori:account-deletion:reader', 'novori:profile-cache:reader', 'novori:reading-month:reader:2026-10']);
});
test('a pending request records its local restriction and only invalidates the rebuildable profile snapshot', async () => {
 await requestAccountDeletion(false); expect(supabase.rpc).toHaveBeenCalledWith('request_account_deletion', { delete_immediately: false });
 expect(AsyncStorage.setItem).toHaveBeenCalledWith('novori:account-deletion:reader', JSON.stringify(status)); expect(AsyncStorage.removeItem).toHaveBeenCalledWith('novori:profile-cache:reader'); expect(AsyncStorage.multiRemove).not.toHaveBeenCalled();
});
test('a session change cannot write or broadcast the previous account status into another account', async () => {
 supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'reader' } } } }).mockResolvedValueOnce({ data: { session: { user: { id: 'other' } } } });
 const listener = jest.fn(), stop = subscribeAccountDeletion(listener);
 await expect(getAccountDeletionStatus()).rejects.toThrow('signed-in account changed'); expect(AsyncStorage.setItem).not.toHaveBeenCalled(); expect(listener).not.toHaveBeenCalled(); stop();
});
