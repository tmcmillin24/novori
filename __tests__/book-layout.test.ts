import { getBookLayout, getProfileBookWidth } from '../src/lib/book-layout';

test.each([375, 390, 440])('phone %s keeps its existing cover sizes and two columns', width => {
  expect(getBookLayout(width)).toEqual({ libraryColumns: 2, searchCoverWidth: 75, trendingCoverWidth: 122, releaseCoverWidth: 112 });
});

test.each([768, 820, 834, 1024, 1032, 1180, 1194, 1366])('tablet %s keeps library covers near a practical size', width => {
  const layout = getBookLayout(width);
  const coverWidth = (width - 40) * (1 / layout.libraryColumns - 0.01);
  expect(coverWidth).toBeGreaterThan(150);
  expect(coverWidth).toBeLessThan(240);
  expect(layout.searchCoverWidth).toBeGreaterThan(75);
  expect(layout.trendingCoverWidth).toBeLessThanOrEqual(200);
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
