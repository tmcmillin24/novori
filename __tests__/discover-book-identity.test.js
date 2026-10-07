const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const React = require('react');
const { displayBookTitle } = require('../src/lib/book-title');

test('tapping the rendered search card keeps its verified edition ID and does not request re-canonicalization', () => {
 const source = fs.readFileSync(path.join(__dirname, '../src/app/(tabs)/discover.tsx'), 'utf8');
 const start = source.indexOf('const DiscoverBookCard = memo(');
 const end = source.indexOf('const DiscoverReaderCard = memo(', start);
 const code = ts.transpileModule(source.slice(start, end) + '\nexports.Card = DiscoverBookCard;', {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
 }).outputText;
 const exports = {};
 vm.runInNewContext(code, {
  exports, React, memo: fn => fn, useSyncExternalStore() {}, subscribeBookPublications() {}, getPublicationVersion() {},
  getBookPublication: () => ({}), getNovoriSearchBookCover: () => 'https://art/catching-fire.jpg', displayBookTitle,
  Pressable: 'Pressable', View: 'View', Text: 'Text', BookCoverImage: 'BookCoverImage', Ionicons: 'Ionicons',
 });
 const open = jest.fn();
 const item = { id: 'nv_verified', volumeInfo: { title: 'Catching Fire', authors: ['Suzanne Collins'], industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780439023498' }] } };
 const card = exports.Card({ item, styles: {}, goldColor: '#b09050', onOpenBook: open });
 card.props.onPress();
 expect(open).toHaveBeenCalledWith('nv_verified', expect.objectContaining({ canonicalizeWork: false, title: 'Catching Fire', isbn: '9780439023498' }));
});
