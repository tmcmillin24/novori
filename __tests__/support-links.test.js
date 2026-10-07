jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '2.3.4' } } }));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' }, Linking: { openURL: jest.fn(async () => {}) }, Alert: { alert: jest.fn() },
}));
const { Linking, Alert } = require('react-native');
const { contactNovoriSupport, openNovoriWebsite, NOVORI_APP_VERSION } = require('../src/lib/support-links');
beforeEach(() => jest.clearAllMocks());
test.each(['support', 'problem', 'suggestion'])('%s opens a user-editable support email with correctly encoded content', async (kind) => {
  await contactNovoriSupport(kind);
  const url = new URL(Linking.openURL.mock.calls[0][0]);
  expect(url.protocol).toBe('mailto:');
  expect(url.pathname).toBe('support@novori.link');
  expect(url.searchParams.get('subject')).toContain('Novori');
  expect(url.searchParams.get('body')).toContain('Novori 2.3.4 · ios');
  expect(Alert.alert).not.toHaveBeenCalled();
});
test('when no email app opens, support address and working website remain available', async () => {
  Linking.openURL.mockRejectedValueOnce(new Error('No handler'));
  await contactNovoriSupport('problem');
  const [, message, actions] = Alert.alert.mock.calls[0];
  expect(message).toContain('support@novori.link');
  await actions.find(a => a.text === 'Support website').onPress();
  expect(Linking.openURL).toHaveBeenLastCalledWith('https://novori.link/support/');
});
test('website failure displays its actual address, and the version follows Expo config', async () => {
  expect(NOVORI_APP_VERSION).toBe('2.3.4');
  Linking.openURL.mockRejectedValueOnce(new Error('Unavailable'));
  await openNovoriWebsite();
  expect(Alert.alert).toHaveBeenCalledWith('Could not open the website', expect.stringContaining('https://novori.link'));
});
