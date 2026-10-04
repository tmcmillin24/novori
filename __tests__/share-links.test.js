jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Share: { share: jest.fn(async () => ({ action: 'sharedAction' })) },
}));

const { Platform, Share } = require('react-native');
process.env.EXPO_PUBLIC_NOVORI_SHARE_BASE_URL = 'https://novori.link';
const { shareBookLink, shareBookStackLink, sharePostLink } = require('../src/lib/share-links');

beforeEach(() => { Share.share.mockClear(); });

test.each(['ios', 'android'])('%s shares one occurrence of each destination URL', async (platform) => {
  Platform.OS = platform;
  await shareBookLink({ googleBookId: 'book123', title: 'Example book' });
  await shareBookStackLink({ stackId: 'stack123', name: 'Example stack' });
  await sharePostLink('post123');
  const paths = ['/book/book123?source=shared', '/stack/stack123', '/post/post123'];
  Share.share.mock.calls.forEach(([payload], i) => {
    const url = `https://novori.link${paths[i]}`;
    expect(`${payload.message ?? ''}\n${payload.url ?? ''}`.split(url).length - 1).toBe(1);
    if (platform === 'ios') expect(payload.url).toBe(url);
    else expect(payload.message).toContain(url);
  });
});
