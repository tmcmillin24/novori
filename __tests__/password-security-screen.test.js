import React from 'react';
import renderer, { act } from 'react-test-renderer';
import PasswordSecurityScreen from '../src/app/password-security';
import { supabase } from '../src/lib/supabase';
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios', select: v => v.ios ?? v.default }, TurboModuleRegistry: { get: () => null }, ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: v => v, hairlineWidth: .5 } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../src/components/ValidationWarningSheet', () => 'ValidationWarningSheet');
jest.mock('../src/components/DeletePostConfirmSheet', () => 'DeletePostConfirmSheet');
jest.mock('../src/context/theme-context', () => ({ useNovoriTheme: () => ({ colors: require('../src/constants/novori-theme').DARK_COLORS }) }));
jest.mock('../src/lib/supabase', () => ({ supabase: { auth: { getUser: jest.fn(), resetPasswordForEmail: jest.fn(), signOut: jest.fn() } } }));
let view, silence;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: { email: 'reader@example.com', email_confirmed_at: '2026-10-04' } }, error: null });
  supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null }); supabase.auth.signOut.mockResolvedValue({ error: null });
  silence = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => { if (view) await act(async () => view.unmount()); view = null; silence.mockRestore(); });
async function render() { await act(async () => { view = renderer.create(<PasswordSecurityScreen />); }); }
const button = label => view.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel === label);
async function press(label) { await act(async () => button(label).props.onPress()); }
const text = () => view.root.findAllByType('Text').map(n => [n.props.children].flat(Infinity).join('')).join(' ');
const notice = () => view.root.findByType('ValidationWarningSheet');
const confirm = () => view.root.findByType('DeletePostConfirmSheet');
test('verified account uses the working recovery callback and animated acknowledgement', async () => {
  await render(); expect(text()).toContain('reader@example.com'); expect(text()).toContain('Verified');
  await press('Change password'); expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('reader@example.com', { redirectTo: 'novori://auth-confirm?flow=recovery' });
  expect(notice().props.visible).toBe(true); expect(notice().props.title).toBe('Check your email');
  await act(async () => notice().props.onDismiss()); expect(notice().props.visible).toBe(false);
  await press('Get account help'); expect(mockRouter.push).toHaveBeenCalledWith('/help-support');
});
test('reset failure stays signed in and reports the error', async () => {
  supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'Please wait before requesting another email.' } });
  await render(); await press('Change password'); expect(notice().props.title).toBe('Could not send email'); expect(notice().props.message).toContain('Please wait'); expect(supabase.auth.signOut).not.toHaveBeenCalled();
});
test('other-device revocation requires confirmation, keeps this device and never navigates to login', async () => {
  await render(); await press('Sign out other devices'); expect(supabase.auth.signOut).not.toHaveBeenCalled(); expect(confirm().props.visible).toBe(true);
  await act(async () => confirm().props.onDismiss()); expect(confirm().props.visible).toBe(false); expect(supabase.auth.signOut).not.toHaveBeenCalled();
  await press('Sign out other devices'); await act(async () => confirm().props.onConfirm());
  expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'others' }); expect(mockRouter.replace).not.toHaveBeenCalled(); expect(confirm().props.visible).toBe(false); expect(text()).toContain('Other sessions have been revoked.');
});
test('failed device revocation permits a retry and does not falsely report success', async () => {
  supabase.auth.signOut.mockResolvedValueOnce({ error: { message: 'Offline' } }); await render(); await press('Sign out other devices'); await act(async () => confirm().props.onConfirm());
  expect(confirm().props.visible).toBe(true); expect(confirm().props.message).toBe('Offline'); expect(text()).not.toContain('Other sessions have been revoked.');
  await act(async () => confirm().props.onConfirm()); expect(confirm().props.visible).toBe(false); expect(supabase.auth.signOut).toHaveBeenCalledTimes(2);
});
test('temporary account errors retry without signing out any devices', async () => {
  supabase.auth.getUser.mockRejectedValueOnce(new Error('Offline')); await render(); expect(button('Retry account details')).toBeDefined(); expect(supabase.auth.signOut).not.toHaveBeenCalled();
  await press('Retry account details'); expect(text()).toContain('reader@example.com'); expect(button('Change password')).toBeDefined();
});
test('missing account returns to login without globally revoking sessions', async () => {
  supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null }); await render(); expect(mockRouter.replace).toHaveBeenCalledWith('/auth'); expect(supabase.auth.signOut).not.toHaveBeenCalled();
});
