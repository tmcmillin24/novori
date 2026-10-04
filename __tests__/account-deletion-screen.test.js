import React from 'react';
import renderer, { act } from 'react-test-renderer';
import DeleteAccountScreen from '../src/app/delete-account';
import { supabase } from '../src/lib/supabase';
import { getAccountDeletionStatus, requestAccountDeletion, cancelAccountDeletion, transferDeletionClub } from '../src/lib/account-deletion';
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ Stack:{Screen:'StackScreen'}, useRouter: () => mockRouter }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios', select: v => v.ios ?? v.default }, TurboModuleRegistry: { get: () => null }, BackHandler:{addEventListener:jest.fn(()=>({remove:jest.fn()}))}, ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: v => v, hairlineWidth: .5 } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../src/components/ValidationWarningSheet', () => 'ValidationWarningSheet');
jest.mock('../src/components/DeletePostConfirmSheet', () => 'DeletePostConfirmSheet');
jest.mock('../src/context/theme-context', () => ({ useNovoriTheme: () => ({ colors: require('../src/constants/novori-theme').DARK_COLORS }) }));
jest.mock('../src/lib/account-deletion', () => ({ getAccountDeletionStatus: jest.fn(), requestAccountDeletion: jest.fn(), cancelAccountDeletion: jest.fn(), transferDeletionClub: jest.fn() }));
jest.mock('../src/lib/supabase', () => ({ supabase: { auth: { signOut: jest.fn() } } }));
const active = { state: 'active', delete_after: null, enabled: true, can_cancel: false, owned_clubs: [] };
const pending = { ...active, state: 'pending', delete_after: new Date(Date.now() + 7 * 86400000).toISOString(), can_cancel: true };
let view, silence;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks(); mockRouter.replace.mockClear(); supabase.auth.signOut.mockResolvedValue({error:null}); getAccountDeletionStatus.mockResolvedValue(active); requestAccountDeletion.mockResolvedValue(pending); cancelAccountDeletion.mockResolvedValue(active); silence = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(async () => { if (view) await act(async () => view.unmount()); view = null; silence.mockRestore(); });
const button = label => view.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel === label);
const confirmation = () => view.root.findByType('DeletePostConfirmSheet');
const notice = () => view.root.findByType('ValidationWarningSheet');
const text = () => view.root.findAllByType('Text').map(n => [n.props.children].flat(Infinity).join('')).join(' ');
async function render() { await act(async () => { view = renderer.create(<DeleteAccountScreen/>); }); }
async function press(label) { await act(async () => button(label).props.onPress()); }
test('scheduling requires the existing animated confirmation and submits seven-day mode', async () => {
  await render(); await press('Schedule deletion'); expect(requestAccountDeletion).not.toHaveBeenCalled(); expect(confirmation().props.visible).toBe(true);
  await act(async () => confirmation().props.onConfirm()); expect(requestAccountDeletion).toHaveBeenCalledWith(false); expect(button('Keep my account')).toBeDefined(); expect(text()).toContain('Your account is paused.'); expect(button('Go back').props.disabled).toBe(true); expect(mockRouter.back).not.toHaveBeenCalled();
});
test('delete now has irreversible copy and sends immediate mode', async () => {
  await render(); await press('Delete now'); expect(confirmation().props.message).toContain('cannot be cancelled'); await act(async () => confirmation().props.onConfirm()); expect(requestAccountDeletion).toHaveBeenCalledWith(true); expect(supabase.auth.signOut).toHaveBeenCalledWith({scope:'local'}); expect(mockRouter.replace).toHaveBeenCalledWith('/auth');
});
test('cancellation must succeed before returning to the profile', async () => {
  getAccountDeletionStatus.mockResolvedValue(pending); cancelAccountDeletion.mockRejectedValueOnce(Error('Offline')); await render(); await press('Keep my account'); expect(mockRouter.replace).not.toHaveBeenCalled(); expect(notice().props.message).toBe('Offline');
  await press('Keep my account'); expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/profile');
});
test('ownership blocks deletion and each transfer requires confirmation', async () => {
  const club = { id: 'club', name: 'Readers', members: [{ id: 'next', name: 'A reader', role: 'member' }] };
  getAccountDeletionStatus.mockResolvedValue({ ...active, owned_clubs: [club] }); transferDeletionClub.mockResolvedValue(active); await render(); expect(button('Schedule deletion').props.disabled).toBe(true);
  await press('Transfer Readers to A reader'); expect(transferDeletionClub).not.toHaveBeenCalled(); await act(async () => confirmation().props.onConfirm()); expect(transferDeletionClub).toHaveBeenCalledWith('club', 'next'); expect(button('Schedule deletion').props.disabled).toBe(false);
});
test('expired deadlines and processing claims never offer cancellation', async () => {
  getAccountDeletionStatus.mockResolvedValue({ ...pending, delete_after: new Date(Date.now() - 1).toISOString() }); await render(); expect(button('Keep my account')).toBeUndefined(); expect(text()).toContain('Deletion is underway');
});
test('worker configuration disables new requests; a load failure permits retry', async () => {
  getAccountDeletionStatus.mockRejectedValueOnce(Error('Offline')).mockResolvedValue({ ...active, enabled: false }); await render(); await press('Retry deletion status'); expect(button('Schedule deletion').props.disabled).toBe(true); expect(button('Delete now').props.disabled).toBe(true);
});

test('a failed deletion request stays in its confirmation sheet without stacking native modals', async () => {
  requestAccountDeletion.mockRejectedValue(Error('Worker unavailable')); await render(); await press('Schedule deletion'); await act(async () => confirmation().props.onConfirm());
  expect(confirmation().props.visible).toBe(true); expect(confirmation().props.message).toBe('Worker unavailable'); expect(notice().props.visible).toBe(false);
});
