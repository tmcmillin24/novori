import React from 'react';
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, StyleSheet, View } from 'react-native';
import { NovoriThemeProvider, useNovoriTheme } from '../src/context/theme-context';
import { TabScreen } from '../src/components/tab-screen';
import { ThemedText } from '../src/components/themed-text';
import { getNovoriColors, READING_THEME_LABELS } from '../src/constants/novori-theme';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
}));

global.IS_REACT_ACT_ENVIRONMENT = true;
let current;
let root;

function Probe() {
  current = useNovoriTheme();
  return <TabScreen><ThemedText testID="theme-text">Reader</ThemedText></TabScreen>;
}

async function mount() {
  await act(async () => {
    root = create(<NovoriThemeProvider><Probe /></NovoriThemeProvider>);
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
});

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  jest.restoreAllMocks();
});

test('all 14 palettes update mounted screens and shared text, and persist both choices', async () => {
  await mount();
  expect(current.ready).toBe(true);
  for (const theme of ['dark', 'light']) {
    await act(async () => current.setTheme(theme));
    for (const readingTheme of Object.keys(READING_THEME_LABELS)) {
      await act(async () => current.setReadingTheme(readingTheme));
      const expected = getNovoriColors(theme, readingTheme);
      expect(current.colors).toEqual(expected);
      const backgrounds = root.root.findAllByType(View)
        .map(node => StyleSheet.flatten(node.props.style)?.backgroundColor)
        .filter(Boolean);
      expect(backgrounds.length).toBeGreaterThan(0);
      expect(backgrounds.every(color => color === expected.background)).toBe(true);
      const text = root.root.findByType(ThemedText).findByType(require('react-native').Text);
      expect(StyleSheet.flatten(text.props.style).color).toBe(expected.text);
      expect(await AsyncStorage.getItem('novori-theme')).toBe(theme);
      expect(await AsyncStorage.getItem('novori-reading-theme')).toBe(readingTheme);
    }
  }
});

test('restores saved appearance before reporting ready', async () => {
  await AsyncStorage.setItem('novori-theme', 'light');
  await AsyncStorage.setItem('novori-reading-theme', 'scifi');
  await mount();
  expect(current.ready).toBe(true);
  expect(current.colors).toEqual(getNovoriColors('light', 'scifi'));
  expect(Appearance.setColorScheme).toHaveBeenCalledWith('light');
});

test('invalid saved preferences fall back to Classic dark', async () => {
  await AsyncStorage.setItem('novori-theme', 'invalid');
  await AsyncStorage.setItem('novori-reading-theme', 'invalid');
  await mount();
  expect(current.ready).toBe(true);
  expect(current.colors).toEqual(getNovoriColors('dark', 'classic'));
});
