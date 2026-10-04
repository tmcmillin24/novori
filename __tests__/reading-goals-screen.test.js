jest.mock('react-native-reanimated',()=>({__esModule:true,default:{View:'AnimatedView'},useSharedValue:value=>require('react').useRef({value}).current,useAnimatedStyle:fn=>fn(),withTiming:value=>value,cancelAnimation:jest.fn()}));
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ReadingGoalsScreen from '../src/app/reading-goals';
import { getReadingGoalBooks } from '../src/lib/reading-goal-books';
import { getReadingGoalsProgress, saveReadingGoal, removeReadingGoal } from '../src/lib/reading-goals';

const mockRouter = { back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter,
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));
jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Text: 'Text', TextInput: 'TextInput', View: 'View', RefreshControl: 'RefreshControl',
  FlatList: require('react').forwardRef((props, ref) => {
    const React = require('react');
    React.useImperativeHandle(ref, () => ({ scrollToOffset: jest.fn() }), []);
    return React.createElement('FlatList', props, props.renderItem({ item: props.data[props.extraData.page] }));
  }),
  KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'ios', select: options => options.ios ?? options.default },
  TurboModuleRegistry: { get: () => null },
  AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove: jest.fn() }) },
  Animated: { View: 'AnimatedView', Value: class { constructor(value) { this.value = value; } interpolate() { return `${this.value * 100}%`; } },
    timing: () => ({ start: jest.fn(), stop: jest.fn() }) },
  StyleSheet: { create: value => value }, AppState: { addEventListener: () => ({ remove: jest.fn() }) },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('../src/context/theme-context', () => ({
  useNovoriTheme: () => ({ colors: require('../src/constants/novori-theme').DARK_COLORS }),
}));
jest.mock('../src/components/ReadingGoalActionsSheet', () => ({ visible, title, onEdit, onRemove, onDismiss }) => {
  if (!visible) return null;
  const React = require('react');
  return React.createElement('GoalActionsSheet', {},
    React.createElement('Pressable', { accessibilityLabel: `Edit ${title}`, onPress: () => { onDismiss(); onEdit(); } }),
    React.createElement('Pressable', { accessibilityLabel: `Remove ${title}`, onPress: () => { onDismiss(); onRemove(); } }));
});
jest.mock('../src/components/BookCoverImage', () => 'BookCoverImage');
jest.mock('../src/lib/reading-goal-books', () => ({ getReadingGoalBooks: jest.fn() }));
jest.mock('../src/components/ValidationWarningSheet', () => 'ValidationWarningSheet');
jest.mock('../src/lib/supabase', () => ({ supabase: {} }));
jest.mock('../src/lib/reading-goals', () => ({ ...jest.requireActual('../src/lib/reading-goals'),
  getReadingGoalsProgress: jest.fn(), saveReadingGoal: jest.fn(), removeReadingGoal: jest.fn(),
}));

let view;
let targets;
let consoleError;
const key = (kind, date) => `${kind}:${date}`;
function response(annual, monthly, annualCount = 4) {
  return { annual: { kind: 'annual', periodStart: annual, targetBooks: targets.get(key('annual', annual)) ?? null, finishedBooks: annualCount },
    monthly: { kind: 'monthly', periodStart: monthly, targetBooks: targets.get(key('monthly', monthly)) ?? null, finishedBooks: 1 } };
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-03T03:25:00Z')); jest.clearAllMocks();
  targets = new Map();
  getReadingGoalBooks.mockImplementation(async (kind, period, offset) => Array.from({ length: 6 }, (_, index) => ({
    completionId: `${kind}:${period}:${offset + index}`, userBookId: `book-${offset + index}`,
    googleBookId: `${kind}-book-${offset + index}`, isbn: '9781234567897', title: `Story ${offset + index + 1}`, coverUrl: 'https://example.com/stored-cover.jpg',
  })));
  getReadingGoalsProgress.mockImplementation(async (annual, monthly) => response(annual, monthly));
  saveReadingGoal.mockImplementation(async (kind, period, target) => { targets.set(key(kind, period), target); });
  removeReadingGoal.mockImplementation(async (kind, period) => { targets.delete(key(kind, period)); });
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
  if (view) await act(async () => view.unmount());
  view = null; jest.useRealTimers(); consoleError.mockRestore();
});
async function render() {
  await act(async () => { view = renderer.create(<ReadingGoalsScreen />); });
  await act(async () => {
    for (const node of view.root.findAllByType('View').filter(node => node.props.testID?.endsWith('-goal-carousel-viewport'))) {
      node.props.onLayout({ nativeEvent: { layout: { width: 300 } } });
    }
  });
}
function carousel(title) { return view.root.findAllByType('FlatList').find(node => node.props.accessibilityLabel === `${title} book carousel`); }
async function swipe(title, page) { await act(async () => carousel(title).props.onMomentumScrollEnd({ nativeEvent: { contentOffset: { x: page * 300 } } })); }
function button(label) { return view.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === label); }
function field(label) { return view.root.findAllByType('TextInput').find(node => node.props.accessibilityLabel === label); }
async function fill(label, value) { await act(async () => field(label).props.onChangeText(value)); }
async function press(label) { await act(async () => button(label).props.onPress()); }

test('annual and monthly forms save their own period and refresh actual goal progress', async () => {
  await render();
  await fill('Annual Goal book target','24');
  expect(field('Annual Goal book target').props.value).toBe('24');
  expect(saveReadingGoal).not.toHaveBeenCalled();
  await press('Save Annual Goal');
  await fill('Monthly Goal book target','3'); await press('Save Monthly Goal');
  expect(saveReadingGoal.mock.calls).toEqual([['annual','2026-01-01',24],['monthly','2026-10-01',3]]);
  const bars = view.root.findAllByType('View').filter(node => node.props.accessibilityRole === 'progressbar');
  expect(bars.map(node => node.props.accessibilityValue.text)).toEqual(['4 of 24 books','1 of 3 books']);
});

test('invalid goals use the shared animated warning component without sending a write', async () => {
  await render(); await fill('Annual Goal book target','0'); await press('Save Annual Goal');
  expect(saveReadingGoal).not.toHaveBeenCalled();
  expect(view.root.findByType('ValidationWarningSheet').props).toMatchObject({ visible: true, title: 'Choose a book target' });
  expect(field('Annual Goal book target').props.value).toBe('0');
});

test('removing the monthly target leaves annual progress and finished-book counts visible', async () => {
  targets.set(key('annual','2026-01-01'),24); targets.set(key('monthly','2026-10-01'),3);
  await render(); await press('Options for Monthly Goal'); await press('Remove Monthly Goal');
  expect(removeReadingGoal).toHaveBeenCalledWith('monthly','2026-10-01');
  expect(field('Monthly Goal book target')).toBeDefined();
  expect(button('Options for Annual Goal')).toBeDefined();
  const bars = view.root.findAllByType('View').filter(node => node.props.accessibilityRole === 'progressbar');
  expect(bars).toHaveLength(1); expect(bars[0].props.accessibilityValue.text).toBe('4 of 24 books');
});

test('a late response for the previous year cannot replace the year the reader has navigated to', async () => {
  targets.set(key('annual','2028-01-01'),24);
  await render();
  const pending = [];
  getReadingGoalsProgress.mockImplementation((annual, monthly) => new Promise(resolve => pending.push({ annual, monthly, resolve })));
  await press('Next year'); await press('Next year');
  expect(pending.map(item => item.annual)).toEqual(['2027-01-01','2028-01-01']);
  await act(async () => pending[1].resolve(response(pending[1].annual,pending[1].monthly,2)));
  await act(async () => pending[0].resolve(response(pending[0].annual,pending[0].monthly,9)));
  const bars = view.root.findAllByType('View').filter(node => node.props.accessibilityRole === 'progressbar');
  expect(bars[0].props.accessibilityValue.text).toBe('2 of 24 books');
});

test('one finished book in a four-book monthly goal uses one canonical cover and three placeholders', async () => {
  targets.set(key('monthly','2026-10-01'),4);
  await render();
  const shelf = view.root.findAllByType('View').find(node => node.props.accessibilityLabel === 'Books 1–4 of 4: 1 finished, 3 to go.');
  expect(shelf).toBeDefined();
  const covers = shelf.findAllByType('BookCoverImage');
  expect(covers).toHaveLength(1);
  expect(covers[0].props).toMatchObject({ googleBookId: 'monthly-book-0', isbn: '9781234567897', existingCoverUrl: 'https://example.com/stored-cover.jpg' });
  const bar = view.root.findAllByType('View').find(node => node.props.accessibilityValue?.text === '1 of 4 books');
  expect(bar.props.accessibilityValue).toMatchObject({ now: 1, max: 4 });
  expect(button('Monthly Goal: next shelf')).toBeUndefined();
  expect(carousel('Monthly Goal').props.scrollEnabled).toBe(false);
});

test('large goals swipe and return through accessibility without refetching loaded progress or covers', async () => {
  targets.set(key('annual','2026-01-01'),10000);
  await render();
  const initialCalls = getReadingGoalsProgress.mock.calls.length;
  const initialCoverCalls = getReadingGoalBooks.mock.calls.length;
  await swipe('Annual Goal',1);
  const shelf = view.root.findAllByType('View').find(node => node.props.accessibilityLabel === 'Books 7–12 of 10000: 0 finished, 6 to go.');
  expect(shelf).toBeDefined();
  expect(getReadingGoalsProgress).toHaveBeenCalledTimes(initialCalls);
  expect(saveReadingGoal).not.toHaveBeenCalled();
  await act(async () => carousel('Annual Goal').props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
  expect(getReadingGoalBooks).toHaveBeenCalledTimes(initialCoverCalls);
  expect(view.root.findAllByType('View').some(node => node.props.accessibilityLabel === 'Books 1–6 of 10000: 4 finished, 2 to go.')).toBe(true);
});

test('a late cover response for a different shelf cannot show the wrong book', async () => {
  targets.set(key('annual','2026-01-01'),24);
  getReadingGoalsProgress.mockImplementation(async (annual, monthly) => response(annual,monthly,13));
  const pending = new Map();
  getReadingGoalBooks.mockImplementation((kind,period,offset) => kind === 'monthly' ? Promise.resolve([]) : new Promise(resolve => pending.set(offset,resolve)));
  await render();
  expect(carousel('Annual Goal').props.initialScrollIndex).toBe(2);
  expect(carousel('Annual Goal').props.getItemLayout(null,2)).toEqual({ length: 300, offset: 600, index: 2 });
  await swipe('Annual Goal',1);
  const cover = id => ({ completionId:id, userBookId:id, googleBookId:id, isbn:null, title:id, coverUrl:'https://example.com/stored.jpg' });
  await act(async () => pending.get(6)([cover('current-shelf-book')]));
  await act(async () => pending.get(12)([cover('old-shelf-book')]));
  const covers = view.root.findAllByType('BookCoverImage');
  expect(covers.some(node => node.props.googleBookId === 'current-shelf-book')).toBe(true);
  expect(covers.some(node => node.props.googleBookId === 'old-shelf-book')).toBe(false);
});


test('the more menu keeps actions tucked away and can edit the selected goal', async () => {
  targets.set(key('annual','2026-01-01'),24);
  await render();
  expect(button('Edit Annual Goal')).toBeUndefined();
  expect(button('Remove Annual Goal')).toBeUndefined();
  const summary = view.root.findAllByType('Text').find(node => node.props.accessibilityLabel === '4/24 books read');
  expect(summary.props.numberOfLines).toBe(1);
  expect(summary.props.style.textAlign).toBe('center');
  await press('Options for Annual Goal'); await press('Edit Annual Goal');
  expect(field('Annual Goal book target').props.value).toBe('24');
  await fill('Annual Goal book target','26'); await press('Save Annual Goal');
  expect(saveReadingGoal).toHaveBeenCalledWith('annual','2026-01-01',26);
  expect(button('Remove Annual Goal')).toBeUndefined();
});
