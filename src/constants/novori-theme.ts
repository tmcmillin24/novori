import { Platform } from 'react-native';

export type NovoriThemeName =
  | 'dark'
  | 'light';

export type NovoriReadingThemeName =
  | 'classic'
  | 'fantasy'
  | 'romance'
  | 'scifi'
  | 'history'
  | 'mystery'
  | 'horror';

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
  background: '#F4EFE5',
  surface: '#FAF6EE',
  elevated: '#EEE5D6',

  gold: '#A8843D',
  softGold: '#B79A5C',
  goldPressed: '#92712F',

  text: '#24211D',
  secondaryText: '#625C53',
  mutedText: '#81786D',
  border: '#D8CCBB',

  danger: '#B94F4F',
};

const READING_THEME_PALETTES: Record<
  Exclude<NovoriReadingThemeName, 'classic'>,
  {
    dark: NovoriColors;
    light: NovoriColors;
  }
> = {
  fantasy: {
    dark: {
      background: '#172019',
      surface: '#202A22',
      elevated: '#2A362D',
      gold: '#C8AD72',
      softGold: '#D9C58F',
      goldPressed: '#B3975E',
      text: '#F1EBDD',
      secondaryText: '#C2BAA8',
      mutedText: '#8F9687',
      border: '#3A473D',
      danger: '#D77D7D',
    },
    light: {
      background: '#F0EEE3',
      surface: '#F7F4E9',
      elevated: '#E2E2D2',
      gold: '#8B733D',
      softGold: '#A28A50',
      goldPressed: '#765F30',
      text: '#253027',
      secondaryText: '#596258',
      mutedText: '#7A8276',
      border: '#CCD0C2',
      danger: '#B65353',
    },
  },

  romance: {
    dark: {
      background: '#21181B',
      surface: '#2C2024',
      elevated: '#392A30',
      gold: '#D7A6AE',
      softGold: '#E3BDC3',
      goldPressed: '#C38E98',
      text: '#F7ECEB',
      secondaryText: '#D1B9BC',
      mutedText: '#A2858B',
      border: '#4B383E',
      danger: '#E48787',
    },
    light: {
      background: '#F6ECEB',
      surface: '#FBF4F2',
      elevated: '#EEDDDD',
      gold: '#A76470',
      softGold: '#BC7D88',
      goldPressed: '#8E5360',
      text: '#352427',
      secondaryText: '#6F5559',
      mutedText: '#91777C',
      border: '#DEC8CB',
      danger: '#B94F4F',
    },
  },

  scifi: {
    dark: {
      background: '#111A22',
      surface: '#19242E',
      elevated: '#23323E',
      gold: '#79BDD0',
      softGold: '#9CD0DD',
      goldPressed: '#5EA6BA',
      text: '#ECF4F6',
      secondaryText: '#B5C6CC',
      mutedText: '#81949C',
      border: '#334854',
      danger: '#DD7E83',
    },
    light: {
      background: '#EDF2F3',
      surface: '#F5F8F8',
      elevated: '#DDE7E9',
      gold: '#397B8E',
      softGold: '#5A95A5',
      goldPressed: '#2E6879',
      text: '#1D2C32',
      secondaryText: '#526970',
      mutedText: '#73868C',
      border: '#CAD8DB',
      danger: '#B94F4F',
    },
  },

  history: {
    dark: {
      background: '#201A14',
      surface: '#2B231B',
      elevated: '#382D22',
      gold: '#C29A63',
      softGold: '#D4B27E',
      goldPressed: '#A9814D',
      text: '#F2E8D8',
      secondaryText: '#C7B8A4',
      mutedText: '#958675',
      border: '#493B2E',
      danger: '#D77C70',
    },
    light: {
      background: '#EEE3D0',
      surface: '#F5ECDD',
      elevated: '#E1D0B5',
      gold: '#8A6135',
      softGold: '#A37A48',
      goldPressed: '#744F2B',
      text: '#30261D',
      secondaryText: '#685847',
      mutedText: '#897662',
      border: '#D2BFA3',
      danger: '#A94D43',
    },
  },

  mystery: {
    dark: {
      background: '#15191F',
      surface: '#1E242C',
      elevated: '#29313B',
      gold: '#A58AAE',
      softGold: '#BEA8C5',
      goldPressed: '#8C7295',
      text: '#F0EEF2',
      secondaryText: '#BCB7C0',
      mutedText: '#89838E',
      border: '#3A424E',
      danger: '#DA777D',
    },
    light: {
      background: '#EEF0F2',
      surface: '#F6F6F7',
      elevated: '#DFE2E6',
      gold: '#6E5878',
      softGold: '#897095',
      goldPressed: '#5B4764',
      text: '#28262B',
      secondaryText: '#5F5B65',
      mutedText: '#817A87',
      border: '#D0D1D6',
      danger: '#B84E55',
    },
  },

  horror: {
    dark: {
      background: '#171515',
      surface: '#211D1D',
      elevated: '#2D2626',
      gold: '#B56A68',
      softGold: '#CC8784',
      goldPressed: '#9D5755',
      text: '#F0EAE7',
      secondaryText: '#C0B5B1',
      mutedText: '#8F8380',
      border: '#403737',
      danger: '#E07874',
    },
    light: {
      background: '#F0ECE8',
      surface: '#F7F2EE',
      elevated: '#E5DCD6',
      gold: '#884745',
      softGold: '#A4605D',
      goldPressed: '#723A38',
      text: '#302625',
      secondaryText: '#685B58',
      mutedText: '#897B77',
      border: '#D4C8C2',
      danger: '#A94242',
    },
  },
};

export const READING_THEME_LABELS: Record<
  NovoriReadingThemeName,
  string
> = {
  classic: 'Classic Novori',
  fantasy: 'Fantasy',
  romance: 'Romance',
  scifi: 'Sci-Fi',
  history: 'History',
  mystery: 'Mystery',
  horror: 'Horror',
};

export function getNovoriColors(
  theme: NovoriThemeName,
  readingTheme: NovoriReadingThemeName
): NovoriColors {
  if (readingTheme === 'classic') {
    return theme === 'light'
      ? LIGHT_COLORS
      : DARK_COLORS;
  }

  return READING_THEME_PALETTES[
    readingTheme
  ][theme];
}

export function getReadingThemeSwatches(
  readingTheme: NovoriReadingThemeName,
  theme: NovoriThemeName
) {
  const colors =
    getNovoriColors(
      theme,
      readingTheme
    );

  return [
    colors.background,
    colors.surface,
    colors.gold,
  ];
}


export type ThemeColor = keyof NovoriColors
  | 'textSecondary'
  | 'backgroundElement'
  | 'backgroundSelected';

export const Spacing = {
  half: 2, one: 4, two: 8, three: 16, four: 24, five: 32,
};
export const MaxContentWidth = 1200;
export const Fonts = {
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
};
