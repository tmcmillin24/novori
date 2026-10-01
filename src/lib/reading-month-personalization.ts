import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  supabase,
} from './supabase';

export type ReadingMonthCharm =
  | 'plant'
  | 'sun'
  | 'mug'
  | 'moon'
  | 'headphones'
  | 'flower'
  | 'cat'
  | 'globe';

export type ReadingMonthPersonalization = {
  charms:
    ReadingMonthCharm[];
};

const DEFAULT_PERSONALIZATION:
  ReadingMonthPersonalization = {
    charms:
      [],
  };

const LEGACY_VALUE_MAP: Record<
  string,
  ReadingMonthCharm
> = {
  plant:
    'plant',
  mug:
    'mug',
  candle:
    'sun',
  moon:
    'moon',
  headphones:
    'headphones',
  flowers:
    'flower',
  cat:
    'cat',
  globe:
    'globe',
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
    'flower',
  'planet-outline':
    'globe',
  'flame-outline':
    'sun',
};

const VALID_CHARMS =
  new Set<ReadingMonthCharm>([
    'plant',
    'sun',
    'mug',
    'moon',
    'headphones',
    'flower',
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

    const savedValues =
      Array.isArray(
        parsed?.charms
      )
        ? parsed.charms
        : Array.isArray(
            parsed?.decor
          )
        ? parsed.decor
        : Array.isArray(
            parsed?.icons
          )
        ? parsed.icons
        : [];

    const charms =
      Array.from(
        new Set(
          savedValues
            .map(
              (
                value:
                  unknown
              ) =>
                typeof value ===
                  'string'
                  ? LEGACY_VALUE_MAP[
                      value
                    ] ??
                    value
                  : null
            )
            .filter(
              (
                value
              ): value is ReadingMonthCharm =>
                typeof value ===
                  'string' &&
                VALID_CHARMS.has(
                  value as ReadingMonthCharm
                )
            )
        )
      ).slice(
        0,
        8
      );

    return {
      charms,
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
      charms:
        Array.from(
          new Set(
            value.charms
          )
        )
          .filter(
            (
              item
            ) =>
              VALID_CHARMS.has(
                item
              )
          )
          .slice(
            0,
            8
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
