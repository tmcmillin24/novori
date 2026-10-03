import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ReadingGoalsScreen from '../src/app/reading-goals';
import { getReadingGoalsProgress, saveReadingGoal, removeReadingGoal } from '../src/lib/reading-goals';

const mockRouter = { back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter,
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));
jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Text: 'Text', TextInput: 'TextInput', View: 'View', RefreshControl: 'RefreshControl',
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
  getReadingGoalsProgress.mockImplementation(async (annual, monthly) => response(annual, monthly));
  saveReadingGoal.mockImplementation(async (kind, period, target) => { targets.set(key(kind, period), target); });
  removeReadingGoal.mockImplementation(async (kind, period) => { targets.delete(key(kind, period)); });
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
  if (view) await act(async () => view.unmount());
  view = null; jest.useRealTimers(); consoleError.mockRestore();
});
async function render() { await act(async () => { view = renderer.create(<ReadingGoalsScreen />); }); }
function button(label) { return view.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === label); }
function field(label) { return view.root.findAllByType('TextInput').find(node => node.props.accessibilityLabel === label); }
async function fill(label, value) { await act(async () => field(label).props.onChangeText(value)); }
async function press(label) { await act(async () => button(label).props.onPress()); }

test('annual and monthly forms save their own period and refresh actual goal progress', async () => {
  await render();
  await press('Annual Goal: 24 books');
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
  await render(); await press('Remove Monthly Goal');
  expect(removeReadingGoal).toHaveBeenCalledWith('monthly','2026-10-01');
  expect(field('Monthly Goal book target')).toBeDefined();
  expect(button('Edit Annual Goal')).toBeDefined();
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
