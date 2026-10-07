import React from 'react';
import renderer, { act } from 'react-test-renderer';
import PrivacySettingsScreen from '../src/app/privacy-settings';
import { getProfilePrivacy, updateProfilePrivacy } from '../src/lib/profile-privacy';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock('react-native', () => ({
  Platform: {OS:'ios',select: value => value.ios ?? value.default},
  ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Switch: 'Switch', Text: 'Text', View: 'View', StyleSheet: { create: value => value },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../src/context/theme-context', () => ({ useNovoriTheme: () => ({ colors: require('../src/constants/novori-theme').DARK_COLORS }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}) }));
jest.mock('../src/lib/profile-privacy', () => ({ getProfilePrivacy: jest.fn(), updateProfilePrivacy: jest.fn() }));

const saved = { is_private: false, show_books: true, show_reviews: true,
  show_tbr_books: false, show_reading_books: true, show_read_books: false,
  show_dnf_books: true, show_owned_books: false };
let view, silence;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  getProfilePrivacy.mockResolvedValue(saved);
  updateProfilePrivacy.mockResolvedValue(undefined);
  silence = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => { if (view) await act(async () => view.unmount()); view = null; silence.mockRestore(); });
async function render() { await act(async () => { view = renderer.create(<PrivacySettingsScreen />); }); }
function switches() { return view.root.findAllByType('Switch'); }

test.each([[0, 'is_private', true], [2, 'show_reviews', false]])('changing switch %i preserves each saved book visibility', async (index, key, value) => {
  await render();
  await act(async () => switches()[index].props.onValueChange(value));
  expect(updateProfilePrivacy).toHaveBeenCalledWith({ ...saved, [key]: value });
});
test('Library Books deliberately toggles all book categories', async () => {
  await render();
  await act(async () => switches()[1].props.onValueChange(false));
  expect(updateProfilePrivacy).toHaveBeenCalledWith({ ...saved, show_books: false,
    show_tbr_books: false, show_reading_books: false, show_read_books: false,
    show_dnf_books: false, show_owned_books: false });
});
test('failed preference loading cannot overwrite existing server privacy with defaults', async () => {
  getProfilePrivacy.mockRejectedValue(new Error('Offline'));
  await render();
  for (const index of [0, 1, 2]) {
    expect(switches()[index].props.disabled).toBe(true);
    await act(async () => switches()[index].props.onValueChange(false));
  }
  expect(updateProfilePrivacy).not.toHaveBeenCalled();
});
test('failed writes restore the displayed value and retain saved category choices for retry', async () => {
  await render();
  updateProfilePrivacy.mockRejectedValueOnce(new Error('Offline'));
  await act(async () => switches()[0].props.onValueChange(true));
  expect(switches()[0].props.value).toBe(false);
  await act(async () => switches()[2].props.onValueChange(false));
  expect(updateProfilePrivacy).toHaveBeenLastCalledWith({ ...saved, show_reviews: false });
});
test('a pending write disables server switches and rapid taps issue only one write', async () => {
  let resolve;
  updateProfilePrivacy.mockReturnValue(new Promise(done => { resolve = done; }));
  await render();
  const onChange = switches()[0].props.onValueChange;
  let pending;
  await act(async () => { pending = onChange(true); onChange(false); });
  expect(updateProfilePrivacy).toHaveBeenCalledTimes(1);
  expect(switches()[2].props.disabled).toBe(true);
  await act(async () => { resolve(); await pending; });
  expect(switches()[0].props.value).toBe(true);
  expect(switches()[2].props.disabled).toBe(false);
});
