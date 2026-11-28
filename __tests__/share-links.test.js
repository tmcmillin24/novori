jest.mock('expo', () => ({ requireNativeModule: jest.fn() }));
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Share: { share: jest.fn(async () => ({ action: 'sharedAction' })) },
}));

const { requireNativeModule } = require('expo');
const { Platform, Share } = require('react-native');
process.env.EXPO_PUBLIC_NOVORI_SHARE_BASE_URL = 'https://novori.link';
const { shareBookLink, shareBookStackLink, sharePostLink, shareProfileLink, shareClubLink, shareClubEventLink } = require('../src/lib/share-links');

beforeEach(() => {
  Share.share.mockClear();
  requireNativeModule.mockReset().mockImplementation(() => { throw new Error('Not installed'); });
});

test.each(['ios', 'android'])('%s shares one occurrence of each destination URL', async (platform) => {
  Platform.OS = platform;
  await shareBookLink({ googleBookId: 'book123', title: 'Example book' });
  await shareBookStackLink({ stackId: 'stack123', name: 'Example stack' });
  await sharePostLink('post123');
  await shareProfileLink({ readerId: 'reader123', name: 'Example reader' });
  await shareClubLink({ clubId: 'club123', name: 'Example club' });
  await shareClubEventLink({ eventId: 'event123', title: 'Example event' });
  const paths = ['/book/book123?source=shared', '/stack/stack123', '/post/post123', '/reader/reader123', '/club/club123', '/club-event/event123'];
  expect(Share.share).toHaveBeenCalledTimes(paths.length);
  Share.share.mock.calls.forEach(([payload], i) => {
    const url = `https://novori.link${paths[i]}`;
    expect(`${payload.message ?? ''}\n${payload.url ?? ''}`.split(url).length - 1).toBe(1);
    if (platform === 'ios') expect(payload.url).toBe(url);
    else expect(payload.message).toContain(url);
  });
});

test('iOS uses the Novori preview for every link without opening a second sheet', async () => {
  Platform.OS = 'ios';
  const shareAsync = jest.fn(async () => true);
  requireNativeModule.mockReturnValue({ shareAsync });
  await shareBookLink({ googleBookId: 'book123' });
  await shareBookStackLink({ stackId: 'stack123' });
  await sharePostLink('post123');
  await shareProfileLink({ readerId: 'reader123' });
  await shareClubLink({ clubId: 'club123' });
  await shareClubEventLink({ eventId: 'event123' });
  expect(shareAsync.mock.calls.map(([, url]) => url)).toEqual([
    '/book/book123?source=shared', '/stack/stack123', '/post/post123',
    '/reader/reader123', '/club/club123', '/club-event/event123',
  ].map(path => `https://novori.link${path}`));
  expect(Share.share).not.toHaveBeenCalled();
});

test('iOS falls back when the native module cannot present', async () => {
  Platform.OS = 'ios';
  requireNativeModule.mockReturnValue({ shareAsync: jest.fn(async () => false) });
  await sharePostLink('post123');
  expect(Share.share).toHaveBeenCalledTimes(1);
});
