import { Ionicons } from '@expo/vector-icons';
import {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  NovoriColors,
} from '../constants/novori-theme';
import {
  useNovoriTheme,
} from '../context/theme-context';
import {
  resolveHardcoverRating,
} from '../lib/book-search';

type Props = {
  googleBookId?: string | null;
  title: string;
  authors?: string[] | null;
  compact?: boolean;
};

type RatingValue = {
  rating: number;
  ratingsCount: number;
};

const ratingCache =
  new Map<
    string,
    RatingValue | null
  >();

const ratingInFlight =
  new Map<
    string,
    Promise<
      RatingValue | null
    >
  >();

function getCacheKey(
  googleBookId:
    string | null | undefined,
  title: string,
  authors:
    string[] | null | undefined
) {
  return [
    googleBookId ?? '',
    title
      .trim()
      .toLowerCase(),
    (
      authors ??
      []
    )
      .join('|')
      .toLowerCase(),
  ].join('::');
}

export default function CanonicalBookRating({
  googleBookId,
  title,
  authors,
  compact = false,
}: Props) {
  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const cacheKey =
    getCacheKey(
      googleBookId,
      title,
      authors
    );

  const cached =
    ratingCache.get(
      cacheKey
    );

  const [
    value,
    setValue,
  ] =
    useState<
      RatingValue | null
    >(
      cached ??
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      !ratingCache.has(
        cacheKey
      )
    );

  useEffect(() => {
    let active =
      true;

    const existing =
      ratingCache.get(
        cacheKey
      );

    if (
      ratingCache.has(
        cacheKey
      )
    ) {
      setValue(
        existing ??
        null
      );
      setLoading(
        false
      );
      return () => {
        active = false;
      };
    }

    setLoading(
      true
    );

    let pending =
      ratingInFlight.get(
        cacheKey
      );

    if (
      !pending
    ) {
      pending =
        resolveHardcoverRating({
          googleBookId:
            googleBookId ??
            undefined,
          title,
          authors:
            authors ??
            [],
        })
          .then(
            (
              resolved
            ) =>
              resolved
                ? {
                    rating:
                      resolved.rating,
                    ratingsCount:
                      resolved.ratingsCount ??
                      0,
                  }
                : null
          )
          .catch(
            () =>
              null
          )
          .then(
            (
              next
            ) => {
              ratingCache.set(
                cacheKey,
                next
              );

              return next;
            }
          )
          .finally(
            () => {
              ratingInFlight.delete(
                cacheKey
              );
            }
          );

      ratingInFlight.set(
        cacheKey,
        pending
      );
    }

    void pending
      .then(
        (
          next
        ) => {
          if (
            active
          ) {
            setValue(
              next
            );
          }
        }
      )
      .finally(
        () => {
          if (
            active
          ) {
            setLoading(
              false
            );
          }
        }
      );

    return () => {
      active =
        false;
    };
  }, [
    cacheKey,
    googleBookId,
    title,
    authors,
  ]);

  if (
    loading
  ) {
    return (
      <View
        style={[
          styles.row,
          compact &&
            styles.rowCompact,
        ]}
      >
        <ActivityIndicator
          size="small"
          color={
            colors.gold
          }
        />
      </View>
    );
  }

  if (
    !value
  ) {
    return null;
  }

  return (
    <View
      style={[
        styles.row,
        compact &&
          styles.rowCompact,
      ]}
    >
      <View
        style={
          styles.stars
        }
      >
        {[1,2,3,4,5].map(
          (
            star
          ) => (
            <Ionicons
              key={
                star
              }
              name={
                value.rating >=
                star
                  ? 'star'
                  : value.rating >=
                    star -
                      0.5
                    ? 'star-half'
                    : 'star-outline'
              }
              size={
                compact
                  ? 11
                  : 12
              }
              color={
                colors.gold
              }
            />
          )
        )}
      </View>

      <Text
        style={[
          styles.text,
          compact &&
            styles.textCompact,
        ]}
      >
        {value.rating.toFixed(
          2
        )}
        {value.ratingsCount >
        0
          ? ` · ${value.ratingsCount.toLocaleString()} ratings`
          : ''}
      </Text>
    </View>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    row: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 7,
      marginTop: 7,
      minHeight: 15,
    },

    rowCompact: {
      marginTop: 4,
      gap: 5,
    },

    stars: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 1,
    },

    text: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 9.5,
    },

    textCompact: {
      fontSize: 9,
    },
  });
}
