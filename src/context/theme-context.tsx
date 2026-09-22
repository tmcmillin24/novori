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
    DARK_COLORS,
    LIGHT_COLORS,
    NovoriColors,
    NovoriThemeName,
} from '../constants/novori-theme';

const STORAGE_KEY = 'novori-theme';

type ThemeContextValue = {
  theme: NovoriThemeName;
  colors: NovoriColors;
  setTheme: (theme: NovoriThemeName) => Promise<void>;
  ready: boolean;
};

const ThemeContext =
  createContext<ThemeContextValue | null>(null);

export function NovoriThemeProvider({
  children,
}: PropsWithChildren) {
  const [theme, setThemeState] =
    useState<NovoriThemeName>('dark');

  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadTheme() {
      try {
        const savedTheme =
          await AsyncStorage.getItem(STORAGE_KEY);

        const nextTheme: NovoriThemeName =
          savedTheme === 'light'
            ? 'light'
            : 'dark';

        Appearance.setColorScheme(nextTheme);

        if (mounted) {
          setThemeState(nextTheme);
        }
      } catch {
        Appearance.setColorScheme('dark');

        if (mounted) {
          setThemeState('dark');
        }
      } finally {
        if (mounted) {
          setReady(true);
        }
      }
    }

    loadTheme();

    return () => {
      mounted = false;
    };
  }, []);

  async function setTheme(
    nextTheme: NovoriThemeName
  ) {
    setThemeState(nextTheme);

    Appearance.setColorScheme(nextTheme);

    await AsyncStorage.setItem(
      STORAGE_KEY,
      nextTheme
    );
  }

  const colors =
    theme === 'light'
      ? LIGHT_COLORS
      : DARK_COLORS;

  const value = useMemo(
    () => ({
      theme,
      colors,
      setTheme,
      ready,
    }),
    [theme, colors, ready]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useNovoriTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      'useNovoriTheme must be used inside NovoriThemeProvider.'
    );
  }

  return context;
}