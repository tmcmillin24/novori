import { DynamicColorIOS, Platform } from 'react-native';

export type NovoriThemeName = 'dark' | 'light';

export type NovoriColors = {
  background: string;
  surface: string;
  elevated: string;
  gold: string;
  softGold: string;
  goldPressed: string;
  text: string;
  secondaryText: string;
  mutedText: string;
  border: string;
  danger: string;
};

export const DARK_COLORS: NovoriColors = {
  background: '#1B1A18',
  surface: '#26231F',
  elevated: '#302B25',

  gold: '#D8C28A',
  softGold: '#E6D5A8',
  goldPressed: '#C8AE70',

  text: '#F5F1E8',
  secondaryText: '#C4BDB2',
  mutedText: '#918B82',
  border: '#403B34',

  danger: '#E88989',
};

export const LIGHT_COLORS: NovoriColors = {
  background: '#F7F3EA',
  surface: '#FFFDF8',
  elevated: '#EEE7DA',

  gold: '#A8843D',
  softGold: '#B79A5C',
  goldPressed: '#92712F',

  text: '#24211D',
  secondaryText: '#625C53',
  mutedText: '#8A8175',
  border: '#DDD3C3',

  danger: '#B94F4F',
};

// Shared component tokens use the same palettes as Novori's screens.
function componentColors(colors: NovoriColors) {
  return {
    ...colors,
    backgroundElement: colors.surface,
    backgroundSelected: colors.elevated,
    textSecondary: colors.secondaryText,
  };
}

export const Colors = {
  light: componentColors(LIGHT_COLORS),
  dark: componentColors(DARK_COLORS),
};

export type ThemeColor = keyof typeof Colors.light;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;

function adaptiveColor(
  light: string,
  dark: string
) {
  if (Platform.OS === 'ios') {
    return DynamicColorIOS({
      light,
      dark,
    });
  }

  return dark;
}

export const COLORS = {
  background: adaptiveColor(
    LIGHT_COLORS.background,
    DARK_COLORS.background
  ),

  surface: adaptiveColor(
    LIGHT_COLORS.surface,
    DARK_COLORS.surface
  ),

  elevated: adaptiveColor(
    LIGHT_COLORS.elevated,
    DARK_COLORS.elevated
  ),

  gold: adaptiveColor(
    LIGHT_COLORS.gold,
    DARK_COLORS.gold
  ),

  softGold: adaptiveColor(
    LIGHT_COLORS.softGold,
    DARK_COLORS.softGold
  ),

  goldPressed: adaptiveColor(
    LIGHT_COLORS.goldPressed,
    DARK_COLORS.goldPressed
  ),

  text: adaptiveColor(
    LIGHT_COLORS.text,
    DARK_COLORS.text
  ),

  secondaryText: adaptiveColor(
    LIGHT_COLORS.secondaryText,
    DARK_COLORS.secondaryText
  ),

  mutedText: adaptiveColor(
    LIGHT_COLORS.mutedText,
    DARK_COLORS.mutedText
  ),

  border: adaptiveColor(
    LIGHT_COLORS.border,
    DARK_COLORS.border
  ),

  danger: adaptiveColor(
    LIGHT_COLORS.danger,
    DARK_COLORS.danger
  ),
};
