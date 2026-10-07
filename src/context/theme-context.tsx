import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance } from 'react-native';

import {
  getNovoriColors,
  NovoriColors,
  NovoriReadingThemeName,
  NovoriThemeName,
} from '../constants/novori-theme';

const THEME_STORAGE_KEY =
  'novori-theme';

const READING_THEME_STORAGE_KEY =
  'novori-reading-theme';

type ThemeContextValue = {
  theme: NovoriThemeName;
  readingTheme: NovoriReadingThemeName;
  colors: NovoriColors;
  setTheme: (
    theme: NovoriThemeName
  ) => Promise<void>;
  setReadingTheme: (
    readingTheme:
      NovoriReadingThemeName
  ) => Promise<void>;
  ready: boolean;
};

const ThemeContext =
  createContext<ThemeContextValue | null>(
    null
  );

function isReadingTheme(
  value: string | null
): value is NovoriReadingThemeName {
  return [
    'classic',
    'fantasy',
    'romance',
    'scifi',
    'history',
    'mystery',
    'horror',
  ].includes(
    value ?? ''
  );
}

export function NovoriThemeProvider({
  children,
}: PropsWithChildren) {
  const [
    theme,
    setThemeState,
  ] =
    useState<NovoriThemeName>(
      'dark'
    );

  const [
    readingTheme,
    setReadingThemeState,
  ] =
    useState<NovoriReadingThemeName>(
      'classic'
    );

  const [
    ready,
    setReady,
  ] =
    useState(false);

  useEffect(
    () => {
      let mounted =
        true;

      async function loadTheme() {
        try {
          const [
            savedTheme,
            savedReadingTheme,
          ] =
            await Promise.all([
              AsyncStorage.getItem(
                THEME_STORAGE_KEY
              ),
              AsyncStorage.getItem(
                READING_THEME_STORAGE_KEY
              ),
            ]);

          const nextTheme:
            NovoriThemeName =
              savedTheme ===
              'light'
                ? 'light'
                : 'dark';

          const nextReadingTheme:
            NovoriReadingThemeName =
              isReadingTheme(
                savedReadingTheme
              )
                ? savedReadingTheme
                : 'classic';

          Appearance.setColorScheme(
            nextTheme
          );

          if (mounted) {
            setThemeState(
              nextTheme
            );
            setReadingThemeState(
              nextReadingTheme
            );
          }
        } catch {
          Appearance.setColorScheme(
            'dark'
          );

          if (mounted) {
            setThemeState(
              'dark'
            );
            setReadingThemeState(
              'classic'
            );
          }
        } finally {
          if (mounted) {
            setReady(
              true
            );
          }
        }
      }

      void loadTheme();

      return () => {
        mounted =
          false;
      };
    },
    []
  );

  async function setTheme(
    nextTheme:
      NovoriThemeName
  ) {
    setThemeState(
      nextTheme
    );

    Appearance.setColorScheme(
      nextTheme
    );

    await AsyncStorage.setItem(
      THEME_STORAGE_KEY,
      nextTheme
    );
  }

  async function setReadingTheme(
    nextReadingTheme:
      NovoriReadingThemeName
  ) {
    setReadingThemeState(
      nextReadingTheme
    );

    await AsyncStorage.setItem(
      READING_THEME_STORAGE_KEY,
      nextReadingTheme
    );
  }

  const colors =
    useMemo(
      () =>
        getNovoriColors(
          theme,
          readingTheme
        ),
      [
        theme,
        readingTheme,
      ]
    );

  const value =
    useMemo(
      () => ({
        theme,
        readingTheme,
        colors,
        setTheme,
        setReadingTheme,
        ready,
      }),
      [
        theme,
        readingTheme,
        colors,
        ready,
      ]
    );

  return (
    <ThemeContext.Provider
      value={
        value
      }
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useNovoriTheme() {
  const context =
    useContext(
      ThemeContext
    );

  if (!context) {
    throw new Error(
      'useNovoriTheme must be used inside NovoriThemeProvider.'
    );
  }

  return context;
}
