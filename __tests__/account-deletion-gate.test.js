import React from 'react';
import renderer, { act } from 'react-test-renderer';
import AccountDeletionGate from '../src/components/AccountDeletionGate';
import { getAccountDeletionStatus, getStoredDeletionStatus, subscribeAccountDeletion, clearDeletedAccountLocalData } from '../src/lib/account-deletion';
import { supabase } from '../src/lib/supabase';
const mockRouter = { replace: jest.fn() }; let mockPath = '/(tabs)/profile', mockAuthEvent, mockForeground, mockStatusEvent;
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, usePathname: () => mockPath, useRootNavigationState: () => ({ key: 'ready' }) }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios', select: v => v.ios ?? v.default }, TurboModuleRegistry: { get: () => null }, AppState: { addEventListener: jest.fn((_, callback) => { mockForeground = callback; return { remove: jest.fn() }; }) } }));
jest.mock('../src/lib/account-deletion', () => ({ getAccountDeletionStatus: jest.fn(), getStoredDeletionStatus: jest.fn(), subscribeAccountDeletion: jest.fn(callback => { mockStatusEvent = callback; return jest.fn(); }), clearDeletedAccountLocalData: jest.fn() }));
jest.mock('../src/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn(), getUser: jest.fn(), signOut: jest.fn(), onAuthStateChange: jest.fn(callback => { mockAuthEvent = callback; return { data: { subscription: { unsubscribe: jest.fn() } } }; }) } } }));
const active = { state: 'active', owned_clubs: [], enabled: true, delete_after: null };
const pending = { ...active, state: 'pending', delete_after: '2099-01-01' };
let view, silence;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks(); jest.useFakeTimers(); mockPath = '/(tabs)/profile';
 supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user' } } } }); getAccountDeletionStatus.mockResolvedValue(active); getStoredDeletionStatus.mockResolvedValue(null); clearDeletedAccountLocalData.mockResolvedValue(); supabase.auth.signOut.mockResolvedValue({ error: null }); silence = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(async () => { if (view) await act(async () => view.unmount()); view = null; jest.useRealTimers(); silence.mockRestore(); });
async function render() { await act(async () => { view = renderer.create(<AccountDeletionGate/>); }); }
test('pending accounts are redirected from normal app routes', async () => { getAccountDeletionStatus.mockResolvedValue(pending); await render(); expect(mockRouter.replace).toHaveBeenCalledWith('/delete-account'); });
test('a previously verified pending state stays restricted offline', async () => { getStoredDeletionStatus.mockResolvedValue(pending); getAccountDeletionStatus.mockRejectedValue(Error('Offline')); await render(); expect(mockRouter.replace).toHaveBeenCalledWith('/delete-account'); });
test('active accounts and deployments awaiting SQL remain usable', async () => { getAccountDeletionStatus.mockRejectedValue({ code: 'PGRST202' }); await render(); expect(mockRouter.replace).not.toHaveBeenCalled(); expect(supabase.auth.signOut).not.toHaveBeenCalled(); });
test('cancellation updates the gate without a second route-triggered request', async () => { getAccountDeletionStatus.mockResolvedValue(pending); mockPath = '/delete-account'; await render(); mockRouter.replace.mockClear(); await act(async () => mockStatusEvent(active)); expect(mockRouter.replace).not.toHaveBeenCalled(); expect(getAccountDeletionStatus).toHaveBeenCalledTimes(1); });
test('a confirmed deleted auth user clears only personalized data and signs out locally', async () => {
 getStoredDeletionStatus.mockResolvedValue(pending); getAccountDeletionStatus.mockRejectedValue({ code: '42501' }); supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { code: 'user_not_found' } });
 await render(); expect(clearDeletedAccountLocalData).toHaveBeenCalledWith('user'); expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' }); expect(mockRouter.replace).toHaveBeenCalledWith('/auth');
});
test('foreground return checks for deletion scheduled on another device', async () => { await render(); getAccountDeletionStatus.mockResolvedValue(pending); await act(async () => mockForeground('active')); expect(mockRouter.replace).toHaveBeenCalledWith('/delete-account'); });

test('auth expiry after a pending request returns to sign-in and clears personalized local data', async () => {
 getAccountDeletionStatus.mockResolvedValue(pending); await render(); mockRouter.replace.mockClear();
 supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
 await act(async () => { mockAuthEvent('SIGNED_OUT'); jest.runOnlyPendingTimers(); });
 expect(clearDeletedAccountLocalData).toHaveBeenCalledWith('user'); expect(mockRouter.replace).toHaveBeenCalledWith('/auth');
});

test('an open pending screen detects server deletion without a foreground event', async () => {
 mockPath = '/delete-account'; getAccountDeletionStatus.mockResolvedValue(pending); await render();
 getAccountDeletionStatus.mockRejectedValue({code:'42501'});
 supabase.auth.getUser.mockResolvedValue({data:{user:null},error:{code:'user_not_found'}});
 await act(async () => { jest.advanceTimersByTime(15000); });
 expect(clearDeletedAccountLocalData).toHaveBeenCalledWith('user');
 expect(mockRouter.replace).toHaveBeenCalledWith('/auth');
});
test('switching from a paused account to an active account clears the old restriction', async () => {
 getAccountDeletionStatus.mockResolvedValue(pending); await render(); mockRouter.replace.mockClear();
 supabase.auth.getSession.mockResolvedValue({data:{session:{user:{id:'other'}}}});
 getStoredDeletionStatus.mockResolvedValue(null); getAccountDeletionStatus.mockResolvedValue(active);
 await act(async () => { mockAuthEvent('SIGNED_IN'); jest.advanceTimersByTime(0); });
 expect(mockRouter.replace).not.toHaveBeenCalledWith('/delete-account');
});
