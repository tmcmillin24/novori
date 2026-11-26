import { getBookLayout, getProfileBookWidth, getLibraryBookWidth, LIBRARY_COLUMN_OPTIONS } from '../src/lib/book-layout';

test.each([320, 360, 375, 390, 440, 600, 744])('phone %s matches Trending to Recent Releases and keeps two library columns', width => {
  expect(getBookLayout(width)).toEqual({ libraryColumns: 2, searchCoverWidth: 75, trendingCoverWidth: 112, releaseCoverWidth: 112 });
});

test.each([768, 820, 834, 1024, 1032, 1180, 1194, 1366])('tablet %s uses three or four library columns', width => {
  const layout = getBookLayout(width);
  expect(layout.libraryColumns).toBeGreaterThanOrEqual(3);
  expect(layout.libraryColumns).toBeLessThanOrEqual(4);
  expect(layout.searchCoverWidth).toBeGreaterThan(75);
  expect(layout.trendingCoverWidth).toBe(layout.releaseCoverWidth);
  expect(layout.releaseCoverWidth).toBe(Math.min(190, Math.max(150, Math.round(width * 0.15))));
  expect(layout.releaseCoverWidth).toBeLessThanOrEqual(190);
});

test('wide windows cap their default at four columns and a split window uses two', () => {
  expect(getBookLayout(1366).libraryColumns).toBe(4);
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

test.each([320, 390, 600, 768, 1032, 1366])('all three library sizes fit window width %s', width => {
  const sizes = LIBRARY_COLUMN_OPTIONS.map(columns => {
    const coverWidth = getLibraryBookWidth(width, columns);
    const used = coverWidth * columns + (columns - 1) * 8;
    expect(used).toBeLessThanOrEqual(width - 40);
    expect(width - 40 - used).toBeLessThan(columns);
    return coverWidth;
  });
  expect(sizes[0]).toBeGreaterThan(sizes[1]);
  expect(sizes[1]).toBeGreaterThan(sizes[2]);
});
