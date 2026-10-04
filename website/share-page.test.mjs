import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { getSharedItem } from './public/share-links.mjs';

const source = readFileSync(new URL('./public/share.mjs', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
function page({ store = '', userAgent = 'iPhone', path = '/book/123' } = {}) {
  const elements = new Map();
  const timers = new Map();
  const listeners = {};
  const document = { visibilityState: 'visible', getElementById(id) {
    if (!elements.has(id)) elements.set(id, { hidden: true, addEventListener(name, fn) { this[name] = fn; } });
    return elements.get(id);
  }, addEventListener(name, fn) { listeners[name] = fn; } };
  const redirects = [];
  const window = { location: { pathname: path, replace(url) { redirects.push(url); } },
    setTimeout(fn) { timers.set(1, fn); return 1; }, clearTimeout(id) { timers.delete(id); },
    addEventListener(name, fn) { listeners[name] = fn; } };
  runInNewContext(source, { getSharedItem, downloadConfig: { ios: store }, navigator: { userAgent, maxTouchPoints: 0 }, document, window });
  return { elements, timers, listeners, document, redirects };
}
const store = 'https://apps.apple.com/us/app/novori/id123456789';
test('before store publication the exact item opens in app and no store redirect runs', () => {
  const p = page();
  assert.equal(p.elements.get('open-item').href, 'novori://book/123?source=shared');
  assert.equal(p.timers.size, 0);
  assert.equal(p.elements.get('download-app').hidden, true);
});
test('published listing redirects only an iOS browser remaining on a valid shared page', () => {
  const p = page({ store });
  p.timers.get(1)();
  assert.deepEqual(p.redirects, [store]);
  assert.equal(p.elements.get('download-app').href, store);
  assert.equal(page({ store, userAgent: 'Android' }).timers.size, 0);
  assert.equal(page({ store, path: '/book/' }).timers.size, 0);
});
test('opening the app or leaving the page cancels store fallback', () => {
  const p = page({ store });
  p.elements.get('open-item').click();
  assert.equal(p.timers.size, 0);
  const q = page({ store });
  q.document.visibilityState = 'hidden';
  q.listeners.visibilitychange();
  assert.equal(q.timers.size, 0);
  const r = page({ store });
  r.listeners.pagehide();
  assert.equal(r.timers.size, 0);
});
