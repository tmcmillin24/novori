import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Pressable,
  ScrollView,
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
  BookStackItem,
} from '../lib/book-stacks';

type StackBook = Pick<
  BookStackItem,
  | 'id'
  | 'title'
  | 'authors'
  | 'cover_url'
>;

export type BookStackVisualVariant =
  | 'builder'
  | 'feed'
  | 'profile'
  | 'detail';

type Props = {
  items: StackBook[];
  compact?: boolean;
  variant?: BookStackVisualVariant;
  selectedId?: string | null;
  onSelect?: (
    item: StackBook
  ) => void;
};

type VariantConfig = {
  width: number;
  height: number;
  gap: number;
  stageHeight: number;
  horizontalPadding: number;
};

const VARIANTS:
  Record<
    BookStackVisualVariant,
    VariantConfig
  > = {
    builder: {
      width: 104,
      height: 156,
      gap: 11,
      stageHeight: 184,
      horizontalPadding: 18,
    },
    feed: {
      width: 96,
      height: 144,
      gap: 10,
      stageHeight: 172,
      horizontalPadding: 16,
    },
    profile: {
      width: 66,
      height: 99,
      gap: 8,
      stageHeight: 119,
      horizontalPadding: 10,
    },
    detail: {
      width: 126,
      height: 189,
      gap: 13,
      stageHeight: 219,
      horizontalPadding: 22,
    },
  };

export default function BookStackVisual({
  items,
  compact = false,
  variant,
  selectedId = null,
  onSelect,
}: Props) {
  const {
    colors,
  } =
    useNovoriTheme();

  const resolvedVariant:
    BookStackVisualVariant =
      variant ??
      (
        compact
          ? 'profile'
          : 'builder'
      );

  const config =
    VARIANTS[
      resolvedVariant
    ];

  const styles =
    createStyles(
      colors,
      config
    );

  if (
    items.length ===
    0
  ) {
    return (
      <View
        style={
          styles.empty
        }
      >
        <Ionicons
          name="albums-outline"
          size={
            resolvedVariant ===
              'profile'
              ? 18
              : 25
          }
          color={
            colors.gold
          }
        />

        <Text
          style={
            styles.emptyText
          }
        >
          Add books to build your stack.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={
        false
      }
      snapToInterval={
        config.width +
        config.gap
      }
      decelerationRate="fast"
      disableIntervalMomentum
      contentContainerStyle={{
        paddingHorizontal:
          config.horizontalPadding,
        gap:
          config.gap,
        alignItems:
          'center',
      }}
      style={{
        width: '100%',
        height:
          config.stageHeight,
      }}
    >
      {items.map(
        (
          item,
          index
        ) => {
          const selected =
            selectedId ===
            item.id;

          return (
            <Pressable
              key={
                item.id
              }
              disabled={
                !onSelect
              }
              onPress={(
                event
              ) => {
                event.stopPropagation();

                onSelect?.(
                  item
                );
              }}
              style={({ pressed }) => [
                styles.book,
                selected &&
                  styles.bookSelected,
                pressed &&
                  onSelect &&
                  styles.bookPressed,
              ]}
            >
              {item.cover_url ? (
                <Image
                  source={{
                    uri:
                      item.cover_url,
                  }}
                  style={
                    styles.cover
                  }
                />
              ) : (
                <View
                  style={
                    styles.coverFallback
                  }
                >
                  <Ionicons
                    name="book-outline"
                    size={
                      resolvedVariant ===
                        'profile'
                        ? 17
                        : 25
                    }
                    color={
                      colors.gold
                    }
                  />

                  <Text
                    style={
                      styles.fallbackTitle
                    }
                    numberOfLines={2}
                  >
                    {
                      item.title
                    }
                  </Text>
                </View>
              )}

              {index ===
              0 ? (
                <View
                  style={
                    styles.featuredBadge
                  }
                >
                  <Ionicons
                    name="star"
                    size={
                      resolvedVariant ===
                        'profile'
                        ? 7
                        : 9
                    }
                    color={
                      colors.background
                    }
                  />
                </View>
              ) : null}
            </Pressable>
          );
        }
      )}
    </ScrollView>
  );
}

function createStyles(
  colors: NovoriColors,
  config: VariantConfig
) {
  return StyleSheet.create({
    book: {
      width:
        config.width,
      height:
        config.height,
      borderRadius: 10,
      overflow:
        'hidden',
      backgroundColor:
        colors.elevated,
      borderWidth: 1,
      borderColor:
        colors.border,
      shadowColor:
        '#000',
      shadowOpacity: 0.10,
      shadowRadius: 5,
      shadowOffset: {
        width: 0,
        height: 3,
      },
      elevation: 2,
      transform: [
        {
          scale: 1,
        },
      ],
    },

    bookSelected: {
      borderColor:
        colors.gold,
      borderWidth: 2,
      transform: [
        {
          scale: 1.035,
        },
      ],
      shadowOpacity: 0.16,
      shadowRadius: 8,
      elevation: 5,
    },

    bookPressed: {
      opacity: 0.86,
    },

    cover: {
      width: '100%',
      height: '100%',
      resizeMode:
        'cover',
    },

    coverFallback: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      padding: 8,
      backgroundColor:
        colors.surface,
    },

    fallbackTitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        config.width <
        80
          ? 7.5
          : 10,
      lineHeight:
        config.width <
        80
          ? 10
          : 13,
      textAlign:
        'center',
      marginTop: 7,
    },

    featuredBadge: {
      position:
        'absolute',
      left: 6,
      bottom: 6,
      width:
        config.width <
        80
          ? 18
          : 22,
      height:
        config.width <
        80
          ? 18
          : 22,
      borderRadius: 999,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.gold,
    },

    empty: {
      minHeight:
        config.stageHeight,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 20,
    },

    emptyText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 10,
      marginTop: 8,
      textAlign:
        'center',
    },
  });
}
