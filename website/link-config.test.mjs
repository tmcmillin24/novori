import test from 'node:test';
import assert from 'node:assert/strict';
import { getLinkConfig } from './link-config.mjs';

test('no placeholder association or nonexistent store URL is emitted before setup', () => {
  assert.deepEqual(getLinkConfig({}, 'com.anonymous.Novori'), { download: { ios: '' }, association: null });
});
test('Apple association identifies the actual app and only permits shared-item paths', () => {
  const result = getLinkConfig({ NOVORI_APPLE_TEAM_ID: 'ABCDE12345' }, 'com.anonymous.Novori');
  assert.deepEqual(result.association.applinks.details, [{ appID: 'ABCDE12345.com.anonymous.Novori', paths: ['/book/*', '/post/*', '/stack/*'] }]);
});
test('store fallback accepts a real listing format and rejects arbitrary destinations', () => {
  assert.equal(getLinkConfig({ NOVORI_IOS_APP_STORE_URL: 'https://apps.apple.com/us/app/novori/id123456789' }, 'app').download.ios, 'https://apps.apple.com/us/app/novori/id123456789');
  for (const value of ['javascript:alert(1)', 'https://example.com/id123', 'https://apps.apple.com/', 'http://apps.apple.com/id123']) {
    assert.throws(() => getLinkConfig({ NOVORI_IOS_APP_STORE_URL: value }, 'app'));
  }
  assert.throws(() => getLinkConfig({ NOVORI_APPLE_TEAM_ID: 'missing' }, 'app'));
});
