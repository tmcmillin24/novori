import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  supabase,
} from './supabase';

export type ReadingShelfDecor =
  | 'plant'
  | 'mug'
  | 'candle'
  | 'moon'
  | 'headphones'
  | 'flowers'
  | 'cat'
  | 'globe';

export type ReadingMonthPersonalization = {
  decor:
    ReadingShelfDecor[];
};

const DEFAULT_PERSONALIZATION:
  ReadingMonthPersonalization = {
    decor:
      [],
  };

const LEGACY_ICON_MAP: Record<
  string,
  ReadingShelfDecor
> = {
  'coffee-outline':
    'mug',
  'moon-outline':
    'moon',
  'headset-outline':
    'headphones',
  'paw-outline':
    'cat',
  'leaf-outline':
    'plant',
  'sparkles-outline':
    'flowers',
  'planet-outline':
    'globe',
  'flame-outline':
    'candle',
};

const VALID_DECOR =
  new Set<ReadingShelfDecor>([
    'plant',
    'mug',
    'candle',
    'moon',
    'headphones',
    'flowers',
    'cat',
    'globe',
  ]);

async function getStorageKey(
  year:
    number,
  monthIndex:
    number
) {
  const {
    data: {
      user,
    },
  } =
    await supabase.auth
      .getUser();

  const userKey =
    user?.id ??
    'anonymous';

  return `novori:reading-month:${userKey}:${year}-${String(
    monthIndex +
      1
  ).padStart(
    2,
    '0'
  )}`;
}

export async function getReadingMonthPersonalization(
  year:
    number,
  monthIndex:
    number
): Promise<ReadingMonthPersonalization> {
  try {
    const key =
      await getStorageKey(
        year,
        monthIndex
      );

    const raw =
      await AsyncStorage.getItem(
        key
      );

    if (
      !raw
    ) {
      return {
        ...DEFAULT_PERSONALIZATION,
      };
    }

    const parsed =
      JSON.parse(
        raw
      );

    const savedDecor =
      Array.isArray(
        parsed?.decor
      )
        ? parsed.decor
        : Array.isArray(
            parsed?.icons
          )
        ? parsed.icons.map(
            (
              value:
                unknown
            ) =>
              typeof value ===
                'string'
                ? LEGACY_ICON_MAP[
                    value
                  ]
                : null
          )
        : [];

    const decor =
      Array.from(
        new Set(
          savedDecor.filter(
            (
              value:
                unknown
            ): value is ReadingShelfDecor =>
              typeof value ===
                'string' &&
              VALID_DECOR.has(
                value as ReadingShelfDecor
              )
          )
        )
      ).slice(
        0,
        3
      );

    return {
      decor,
    };
  } catch (
    error
  ) {
    console.warn(
      'Could not load reading month personalization:',
      error
    );

    return {
      ...DEFAULT_PERSONALIZATION,
    };
  }
}

export async function saveReadingMonthPersonalization(
  year:
    number,
  monthIndex:
    number,
  value:
    ReadingMonthPersonalization
) {
  const key =
    await getStorageKey(
      year,
      monthIndex
    );

  const payload:
    ReadingMonthPersonalization = {
      decor:
        Array.from(
          new Set(
            value.decor
          )
        )
          .filter(
            (
              item
            ) =>
              VALID_DECOR.has(
                item
              )
          )
          .slice(
            0,
            3
          ),
    };

  await AsyncStorage.setItem(
    key,
    JSON.stringify(
      payload
    )
  );

  return payload;
}
