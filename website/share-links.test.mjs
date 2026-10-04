import test from 'node:test';
import assert from 'node:assert/strict';
import { getSharedItem } from './public/share-links.mjs';

test('shared book preserves identifier and opens existing shared-book route', () => {
  assert.deepEqual(getSharedItem('/book/abc%2Fdef%3Fsource%3Devil'), {
    kind: 'book', label: 'book', appUrl: 'novori://book/abc%2Fdef%3Fsource%3Devil?source=shared',
  });
});
test('posts and stacks use the existing app destinations', () => {
  assert.equal(getSharedItem('/post/123/').appUrl, 'novori://post/123');
  assert.equal(getSharedItem('/stack/456').appUrl, 'novori://stack/456');
});
test('unknown routes, missing identifiers, and extra segments cannot open other app screens', () => {
  for (const path of ['/auth-confirm/token', '/book/', '/book/id/extra', '/stack', '/post//', '/']) {
    assert.equal(getSharedItem(path), null);
  }
});
test('malformed encoding and control characters fail cleanly', () => {
  for (const path of ['/book/%zz', '/book/%00', '/book/%0A', `/book/${'x'.repeat(513)}`]) {
    assert.equal(getSharedItem(path), null);
  }
});

test('profiles, clubs, and events open their existing app routes', () => {
  for (const kind of ['reader', 'club', 'club-event']) {
    assert.equal(getSharedItem(`/${kind}/id%3Fvalue/`).appUrl, `novori://${kind}/id%3Fvalue`);
    assert.equal(getSharedItem(`/${kind}/id/extra`), null);
  }
});
