const fs = require('fs');
const path = require('path');
const {createRequire} = require('module');
const {execFileSync} = require('child_process');
const decode = require('decode-uri-component');
const query = require('query-string');

test('security decoder keeps the upstream 0.5.0 algorithm and CommonJS function contract', () => {
  const root = path.join(__dirname, '../vendor/decode-uri-component');
  const original = fs.readFileSync(path.join(root, 'upstream-index.mjs'), 'utf8');
  const adapted = fs.readFileSync(path.join(root, 'index.cjs'), 'utf8');
  expect(adapted).toBe(original.replace('export default function decodeUriComponent', 'module.exports = function decodeUriComponent'));
  expect(typeof decode).toBe('function');
  const queryRequire = createRequire(require.resolve('query-string'));
  expect(queryRequire('decode-uri-component')).toBe(decode);
});

test('router query parameters preserve Unicode, repeated values, plus signs and encoded URLs', () => {
  const original = {title:'Dune & café 📚', tags:['a','b'], redirect:'novori://book/nv_9780441172719', literal:'a+b'};
  const encoded = query.stringify(original);
  expect({...query.parse(encoded)}).toEqual(original);
  expect(query.parse('q=hello+reader').q).toBe('hello reader');
});

test('malformed percent input remains usable without recursive decoding blowup', () => {
  const payload = '%FF'.repeat(20000);
  expect(decode(payload)).toBe(payload);
  expect(query.parse('q=' + payload).q).toBe(payload);
  expect(query.parse('title=%E0%A4%A&ok=caf%C3%A9').ok).toBe('café');
});

test('patched shell quoting rejects newline injection after a comment token', () => {
  expect(() => require('shell-quote').quote(['echo', {comment:'x'}, 'a\nid;#'])).toThrow(TypeError);
});

test('Xcode project UUID generation keeps its CommonJS API and identifier format', () => {
  // Xcode tooling runs in Node, not Jest's React Native/browser export condition.
  const ids = JSON.parse(execFileSync(process.execPath, ['-e', `
    const project = require('xcode').project('unused.pbxproj');
    project.hash = {project:{objects:{}}};
    process.stdout.write(JSON.stringify([project.generateUuid(), project.generateUuid()]));
  `], {encoding:'utf8'}));
  for (const id of ids) expect(id).toMatch(/^[A-F0-9]{24}$/);
  expect(ids[0]).not.toBe(ids[1]);
});
