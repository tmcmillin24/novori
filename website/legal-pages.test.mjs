import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { escapeHtml } from './legal-pages.mjs';

execFileSync(process.execPath, [new URL('./build.mjs', import.meta.url).pathname]);
const legal = JSON.parse(readFileSync(new URL('./legal-documents.json', import.meta.url)));
const notices = JSON.parse(readFileSync(new URL('../src/generated/open-source-notices.json', import.meta.url)));
test('public documents contain the same full text and provider disclosures used in the app', () => {
  for (const [path, doc] of Object.entries(legal.documents)) {
    const html = readFileSync(new URL(`./dist/${path}/index.html`, import.meta.url), 'utf8');
    assert.ok(html.includes(escapeHtml(doc.title)));
    for (const section of doc.sections) for (const paragraph of section.paragraphs) assert.ok(html.includes(escapeHtml(paragraph)), `${path}: missing ${section.title}`);
    assert.ok(!/<script\b|<form\b/.test(html));
    assert.ok(!/will be added before launch|TODO|PLACEHOLDER/i.test(html));
  }
  const privacy = JSON.stringify(legal.documents.privacy);
  for (const provider of ['Supabase', 'Google Books', 'Hardcover', 'Open Library', 'Resend', 'Cloudflare', 'Expo', 'Google ML Kit']) assert.ok(privacy.includes(provider));
  assert.equal(legal.minimumAge, 18);
  assert.equal(legal.operator, 'Tristan McMillin');
});
test('external deletion can start by email without reinstalling or authenticating', () => {
  const html = readFileSync(new URL('./dist/delete-account/index.html', import.meta.url), 'utf8');
  assert.match(html, /mailto:support@novori\.link\?subject=Delete/);
  assert.match(html, /associated personal data/);
  assert.match(html, /sending it initiates a support request/);
  assert.match(html, /verification/);
});
test('license inventory retains full copyright and permission text, including font and icon notices', () => {
  assert.ok(notices.packages.length > 600);
  for (const p of notices.packages) {
    assert.ok(p.license && p.notices.length, p.name);
    for (const n of p.notices) assert.ok(n.text.length > 100, p.name);
  }
  for (const name of ['@expo-google-fonts/inter', '@expo-google-fonts/playfair-display']) {
    const p = notices.packages.find(p => p.name === name);
    assert.ok(p.notices.some(n => /SIL OPEN FONT LICENSE/.test(n.text)));
  }
  assert.ok(notices.packages.some(p => p.name === 'Ionicons'));
  assert.equal(notices.lockfileSha256, createHash('sha256').update(readFileSync(new URL('../package-lock.json', import.meta.url))).digest('hex'));
  const html = readFileSync(new URL('./dist/licenses/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('/open-source-notices.txt'));
  const full = readFileSync(new URL('./dist/open-source-notices.txt', import.meta.url), 'utf8');
  for (const p of notices.packages) for (const n of p.notices) assert.ok(full.includes(n.text), p.name);
});
test('all entry pages expose accessible legal and deletion links', () => {
  for (const path of ['index.html', 'support/index.html', 'share/index.html', 'privacy/index.html', 'terms/index.html', 'licenses/index.html']) {
    const html = readFileSync(new URL(`./dist/${path}`, import.meta.url), 'utf8');
    for (const link of ['/privacy/', '/terms/', '/licenses/', '/child-safety/', '/delete-account/']) assert.ok(html.includes(`href="${link}"`), `${path} missing ${link}`);
  }
});
test('license and policy text is escaped as content instead of interpreted as HTML', () => {
  assert.equal(escapeHtml('<script>"x" & \'y\'</script>'), '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;');
});
