import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  supabase,
} from './supabase';

export type ReadingMonthIcon =
  | 'coffee-outline'
  | 'moon-outline'
  | 'headset-outline'
  | 'rainy-outline'
  | 'airplane-outline'
  | 'paw-outline'
  | 'heart-outline'
  | 'sparkles-outline'
  | 'flame-outline'
  | 'planet-outline'
  | 'leaf-outline'
  | 'book-outline';

export type ReadingMonthPersonalization = {
  icons:
    ReadingMonthIcon[];
  note:
    string;
};

const DEFAULT_PERSONALIZATION:
  ReadingMonthPersonalization = {
    icons:
      [],
    note:
      '',
  };

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

    const icons =
      Array.isArray(
        parsed?.icons
      )
        ? parsed.icons
            .filter(
              (
                value:
                  unknown
              ): value is ReadingMonthIcon =>
                typeof value ===
                'string'
            )
            .slice(
              0,
              4
            )
        : [];

    const note =
      typeof parsed?.note ===
        'string'
        ? parsed.note
            .trim()
            .slice(
              0,
              80
            )
        : '';

    return {
      icons,
      note,
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
      icons:
        Array.from(
          new Set(
            value.icons
          )
        ).slice(
          0,
          4
        ),
      note:
        value.note
          .trim()
          .slice(
            0,
            80
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
