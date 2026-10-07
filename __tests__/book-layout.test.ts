import { getBookLayout, getProfileBookWidth, getLibraryBookWidth } from '../src/lib/book-layout';

test.each([320, 360, 375, 390, 440, 600, 744])('phone %s matches Trending to Recent Releases and keeps two library columns', width => {
  expect(getBookLayout(width)).toEqual({ libraryColumns: 2, searchCoverWidth: 75, trendingCoverWidth: 112, releaseCoverWidth: 112 });
});

test.each([768, 820, 834, 1024, 1032, 1180, 1194, 1366])('tablet %s keeps library covers near a practical size', width => {
  const layout = getBookLayout(width);
  const coverWidth = (width - 40) * (1 / layout.libraryColumns - 0.01);
  expect(coverWidth).toBeGreaterThan(150);
  expect(coverWidth).toBeLessThan(240);
  expect(layout.searchCoverWidth).toBeGreaterThan(75);
  expect(layout.trendingCoverWidth).toBe(layout.releaseCoverWidth);
  expect(layout.releaseCoverWidth).toBe(Math.min(190, Math.max(150, Math.round(width * 0.15))));
  expect(layout.releaseCoverWidth).toBeLessThanOrEqual(190);
});

test('rotation adds columns and a narrow split window returns to phone sizing', () => {
  expect(getBookLayout(1366).libraryColumns).toBeGreaterThan(getBookLayout(1032).libraryColumns);
  expect(getBookLayout(600).libraryColumns).toBe(2);
});

 test.each([768, 820, 834, 1032, 1180, 1194, 1366])('profile width %s fits exactly four covers with existing gutters', width => {
  const cover = getProfileBookWidth(width) as number;
  expect(cover * 4 + 24).toBeLessThanOrEqual(width - 40);
  expect(cover * 5 + 32).toBeGreaterThan(width - 40);
  expect(width - 40 - (cover * 4 + 24)).toBeLessThan(4);
 });
 test('phone profile retains three-column sizing', () => expect(getProfileBookWidth(440)).toBe('31%'));

test.each([390, 440, 834, 1032, 1194, 1366, 1032])('library width %s fits rows with a fixed gap during rotation', width => {
 const columns = getBookLayout(width).libraryColumns;
 const card = getLibraryBookWidth(width);
 expect(card * columns + (columns - 1) * 8).toBeLessThanOrEqual(width - 40);
 expect(width - 40 - (card * columns + (columns - 1) * 8)).toBeLessThan(columns);
});
