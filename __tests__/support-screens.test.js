import React from 'react';
import renderer, { act } from 'react-test-renderer';
import HelpSupportScreen from '../src/app/help-support';
import AboutNovoriScreen from '../src/app/about-novori';
import { contactNovoriSupport, openNovoriWebsite } from '../src/lib/support-links';
const mockRouter = { back: jest.fn(), push: jest.fn() };
jest.mock('../src/components/ValidationWarningSheet', () => 'ValidationWarningSheet');
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios', select: v => v.ios ?? v.default }, TurboModuleRegistry: { get: () => null }, Alert: { alert: jest.fn() }, Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', StyleSheet: { create: v => v } }));
jest.mock('../src/context/theme-context', () => ({ useNovoriTheme: () => ({ colors: require('../src/constants/novori-theme').DARK_COLORS }) }));
jest.mock('../src/lib/support-links', () => ({ contactNovoriSupport: jest.fn(), openNovoriWebsite: jest.fn(), NOVORI_SUPPORT_URL: 'https://novori.link/support/', NOVORI_SUPPORT_EMAIL: 'support@novori.link', NOVORI_APP_VERSION: '2.3.4' }));
let view, silence;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; jest.clearAllMocks(); silence = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(async () => { if (view) await act(async () => view.unmount()); view = null; silence.mockRestore(); });
async function press(label) { await act(async () => view.root.findAllByType('Pressable').find(n => n.props.accessibilityLabel === label).props.onPress()); }
function text() { return view.root.findAllByType('Text').map(n => [n.props.children].flat(Infinity).join('')).join(' '); }
test('help actions open the correct draft or support website and show the current version', async () => {
  await act(async () => { view = renderer.create(<HelpSupportScreen />); });
  await press('Contact Support'); expect(contactNovoriSupport).toHaveBeenLastCalledWith();
  await press('Report a Problem'); expect(contactNovoriSupport).toHaveBeenLastCalledWith('problem');
  await press('Feature Request'); expect(contactNovoriSupport).toHaveBeenLastCalledWith('suggestion');
  await press('Help on the web'); expect(openNovoriWebsite).toHaveBeenLastCalledWith('https://novori.link/support/');
  expect(text()).toContain('Novori 2.3.4'); expect(text()).toContain('support@novori.link');
});
test('about links reach the website and in-app help without changing existing legal actions', async () => {
  await act(async () => { view = renderer.create(<AboutNovoriScreen />); });
  await press('Visit Novori'); expect(openNovoriWebsite).toHaveBeenCalledWith();
  await press('Help & Support'); expect(mockRouter.push).toHaveBeenCalledWith('/help-support');
  expect(text()).toContain('2.3.4'); expect(text()).toContain('Read. Discuss. Belong.');
});

test('each help topic opens and dismisses the shared animated sheet with its own content', async () => {
  await act(async () => { view = renderer.create(<HelpSupportScreen />); });
  for (const title of ['Account & Login', 'Books & Library', 'Clubs & Community', 'Privacy & Safety']) {
    await press(title);
    const sheet = view.root.findByType('ValidationWarningSheet');
    expect(sheet.props.visible).toBe(true);
    expect(sheet.props.title).toBe(title);
    expect(sheet.props.message.length).toBeGreaterThan(0);
    expect(sheet.props.icon).toBe('help-circle-outline');
    await act(async () => sheet.props.onDismiss());
    expect(view.root.findByType('ValidationWarningSheet').props.visible).toBe(false);
  }
});
