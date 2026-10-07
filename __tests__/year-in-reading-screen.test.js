import React from 'react';
import renderer, { act } from 'react-test-renderer';
import YearInReading from '../src/components/YearInReading';
import ReadingRecapsScreen from '../src/app/reading-recaps';
import { getYearInReading } from '../src/lib/year-in-reading';
import { getReadingGoalBooks } from '../src/lib/reading-goal-books';
import { getReadingActivityMonth } from '../src/lib/reading-activity';
import { getReadingRecapJourneyData } from '../src/lib/reading-recaps';

const mockRouter = { push: jest.fn(), back: jest.fn() };
let mockParams;
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams,
  useFocusEffect: callback => require('react').useEffect(callback, [callback]),
}));
jest.mock('react-native', () => ({ ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Text: 'Text', View: 'View', RefreshControl: 'RefreshControl', StyleSheet: { create: v => v, absoluteFill: {}, hairlineWidth: 0.5 },
  Platform: { OS: 'ios', select: v => v.ios ?? v.default }, TurboModuleRegistry: { get: () => null },
  FlatList: require('react').forwardRef((props, ref) => {
    require('react').useImperativeHandle(ref, () => ({ scrollToOffset: jest.fn() }), []);
    return require('react').createElement('FlatList', props, props.data.map(item => require('react').createElement('ListPage', { key: item }, props.renderItem({ item }))));
  }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../src/context/theme-context', () => ({ useNovoriTheme: () => ({ colors: require('../src/constants/novori-theme').DARK_COLORS }) }));
jest.mock('../src/components/BookCoverImage', () => 'BookCoverImage');
jest.mock('../src/lib/supabase', () => ({ supabase: {} }));
jest.mock('../src/lib/year-in-reading', () => ({ ...jest.requireActual('../src/lib/year-in-reading'), getYearInReading: jest.fn() }));
jest.mock('../src/lib/reading-goal-books', () => ({ getReadingGoalBooks: jest.fn() }));
jest.mock('../src/lib/reading-activity', () => ({ getReadingActivityMonth: jest.fn() }));
jest.mock('../src/lib/reading-recaps', () => ({ getReadingRecapJourneyData: jest.fn() }));

function summary(year = 2026, finishedBooks = 8) {
  return { year, timezone: 'America/Chicago', asOfDate: '2026-10-03', finishedBooks, daysRead: 10, bestStreak: 4,
    bestStreakStart: `${year}-03-09`, bestStreakEnd: `${year}-03-12`, annualTarget: 24,
    months: Array.from({ length: 12 }, (_, monthIndex) => ({ monthIndex, daysRead: monthIndex === 2 ? 4 : 0, finishedBooks: monthIndex === 2 ? finishedBooks : 0 })) };
}
let view, props, silence;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-03T15:00Z')); jest.clearAllMocks();
  mockParams = { mode: 'year', referenceDate: '2026-01-01' };
  props = { year: 2026, onYearChange: jest.fn(), onOpenMonth: jest.fn(), refreshRevision: 0, onRefreshComplete: jest.fn() };
  getYearInReading.mockImplementation(async year => summary(year));
  getReadingGoalBooks.mockImplementation(async (kind, period, offset, limit) => Array.from({ length: Math.min(limit, 8 - offset) }, (_, i) => ({
    completionId: `journey:${offset + i}`, userBookId: `private-book-${offset + i}`, googleBookId: `google-${offset + i}`,
    isbn: '9781234567897', title: `Book ${offset + i + 1}`, coverUrl: 'https://example.com/stored.jpg',
  })));
  getReadingActivityMonth.mockResolvedValue({ days: {}, checkedDates: [], daysRead: 0, bestStreak: 0, booksFinished: 0, readingUpdates: 0 });
  getReadingRecapJourneyData.mockResolvedValue({ events: [], continuing: [] });
  silence = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => { if (view) await act(async () => view.unmount()); view = null; jest.useRealTimers(); silence.mockRestore(); });
async function render(component = <YearInReading {...props} />) {
  await act(async () => { view = renderer.create(component); });
  await layout();
}
async function layout() {
  const viewport = view.root.findAllByType('View').find(node => node.props.testID === 'year-books-viewport');
  if (viewport) await act(async () => viewport.props.onLayout({ nativeEvent: { layout: { width: 300 } } }));
}
function button(label) { return view.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === label); }
async function press(label) { await act(async () => button(label).props.onPress()); }
async function swipe(page) { await act(async () => view.root.findByType('FlatList').props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: page * 300 } } })); }

test('annual summary shows real goal progress and uses stored canonical identities for six visible covers', async () => {
  await render();
  expect(getYearInReading).toHaveBeenCalledTimes(1);
  expect(getReadingGoalBooks.mock.calls).toEqual([['annual', '2026-01-01', 0, 6]]);
  const covers = view.root.findAllByType('BookCoverImage'); expect(covers).toHaveLength(6);
  expect(covers[0].props).toMatchObject({ googleBookId: 'google-0', isbn: '9781234567897', existingCoverUrl: 'https://example.com/stored.jpg' });
  expect(view.root.findAllByType('View').find(node => node.props.accessibilityRole === 'progressbar').props.accessibilityValue.text).toBe('8 of 24 books');
  expect(button('Next reading year').props.disabled).toBe(true);
  await press('Previous reading year'); expect(props.onYearChange).toHaveBeenCalledWith(2025);
  expect(button('November 2026: upcoming').props.disabled).toBe(true);
  await press('March 2026: 4 days logged, 8 books read. Open monthly recap'); expect(props.onOpenMonth).toHaveBeenCalledWith(2);
});
test('swiping loads only the new page and revisiting it reuses local metadata', async () => {
  await render(); await swipe(1); await swipe(0); await swipe(1);
  expect(getReadingGoalBooks.mock.calls).toEqual([['annual', '2026-01-01', 0, 6], ['annual', '2026-01-01', 6, 6]]);
  await press('Open Book 7 in Reading Details'); expect(mockRouter.push).toHaveBeenCalledWith('/reading-details/private-book-6');
});
test('cover failures retry independently without refetching or changing year statistics', async () => {
  getReadingGoalBooks.mockRejectedValueOnce(new Error('Offline'));
  await render(); expect(button('Retry annual book covers')).toBeDefined();
  await press('Retry annual book covers'); expect(getReadingGoalBooks).toHaveBeenCalledTimes(2); expect(getYearInReading).toHaveBeenCalledTimes(1);
});
test('annual summary errors have a working retry', async () => {
  getYearInReading.mockRejectedValueOnce(new Error('Offline'));
  await render(); expect(getReadingGoalBooks).not.toHaveBeenCalled();
  await press('Retry Year in Reading'); await layout();
  expect(getYearInReading).toHaveBeenCalledTimes(2); expect(getReadingGoalBooks).toHaveBeenCalledTimes(1);
});
test('an older year response cannot replace the newly selected year', async () => {
  const pending = [];
  getYearInReading.mockImplementation(year => new Promise(resolve => pending.push({ year, resolve })));
  await render();
  await act(async () => { view.update(<YearInReading {...props} year={2025} />); });
  await act(async () => pending[1].resolve(summary(2025, 2)));
  await act(async () => pending[0].resolve(summary(2026, 9)));
  await layout();
  expect(getReadingGoalBooks.mock.calls).toEqual([['annual', '2025-01-01', 0, 6]]);
  expect(view.root.findAllByType('View').find(node => node.props.accessibilityRole === 'progressbar').props.accessibilityValue.text).toBe('2 of 24 books');
});
test('empty years do not fetch covers or invent a busiest month', async () => {
  getYearInReading.mockResolvedValue({ ...summary(2026, 0), daysRead: 0, bestStreak: 0, annualTarget: null,
    months: Array.from({ length: 12 }, (_, monthIndex) => ({ monthIndex, daysRead: 0, finishedBooks: 0 })) });
  await render(); expect(getReadingGoalBooks).not.toHaveBeenCalled(); expect(view.root.findAllByType('FlatList')).toHaveLength(0);
  expect(view.root.findAllByType('Text').some(node => node.props.children === 'Room for your next story')).toBe(true);
});
test('Year mode bypasses monthly queries and tapping a month opens that actual monthly recap', async () => {
  await render(<ReadingRecapsScreen />);
  expect(getReadingActivityMonth).not.toHaveBeenCalled(); expect(getReadingRecapJourneyData).not.toHaveBeenCalled();
  await press('March 2026: 4 days logged, 8 books read. Open monthly recap');
  expect(getReadingActivityMonth.mock.calls).toEqual([[2026, 2]]);
  expect(button('Monthly recap').props.accessibilityState.selected).toBe(true);
});
test('pull-to-refresh updates the annual data and invalidates its paged metadata', async () => {
  await render(<ReadingRecapsScreen />);
  await act(async () => view.root.findByType('ScrollView').props.refreshControl.props.onRefresh()); await layout();
  expect(getYearInReading).toHaveBeenCalledTimes(2); expect(getReadingGoalBooks).toHaveBeenCalledTimes(2);
  expect(view.root.findByType('ScrollView').props.refreshControl.props.refreshing).toBe(false); expect(getReadingActivityMonth).not.toHaveBeenCalled();
});
test('weekly recap links keep their existing destination and never load annual data', async () => {
  mockParams = { mode: 'week', referenceDate: '2026-09-30' }; await render(<ReadingRecapsScreen />);
  expect(button('Weekly recap').props.accessibilityState.selected).toBe(true);
  expect(getReadingActivityMonth).toHaveBeenCalled(); expect(getYearInReading).not.toHaveBeenCalled();
});
test('the year share action passes the selected calendar year without publishing', async () => {
  await render(); await press('Share Year in Reading');
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/share-reading-recap', params: { kind: 'year', periodStart: '2026-01-01' } });
});
test('weekly and monthly share actions pass their exact local period starts', async () => {
  mockParams = { mode: 'week', referenceDate: '2026-09-30' }; await render(<ReadingRecapsScreen />);
  await press('Share reading recap');
  expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/share-reading-recap', params: { kind: 'week', periodStart: '2026-09-28' } });
  await press('Monthly recap'); await press('Share reading recap');
  expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/share-reading-recap', params: { kind: 'month', periodStart: '2026-09-01' } });
});
