import BookCoverImage from './BookCoverImage';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  useEffect,
} from 'react';
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

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
> & { google_book_id?: string };

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
  overlap: number;
  selectedGap: number;
  verticalPadding: number;
  horizontalPadding: number;
};

const VARIANTS:
  Record<
    BookStackVisualVariant,
    VariantConfig
  > = {
    builder: {
      width: 112,
      height: 168,
      overlap: 48,
      selectedGap: 18,
      verticalPadding: 18,
      horizontalPadding: 20,
    },
    feed: {
      width: 104,
      height: 156,
      overlap: 44,
      selectedGap: 17,
      verticalPadding: 18,
      horizontalPadding: 18,
    },
    profile: {
      width: 72,
      height: 108,
      overlap: 30,
      selectedGap: 11,
      verticalPadding: 12,
      horizontalPadding: 12,
    },
    detail: {
      width: 132,
      height: 198,
      overlap: 56,
      selectedGap: 22,
      verticalPadding: 22,
      horizontalPadding: 22,
    },
  };

type StackCoverProps = {
  item: StackBook;
  index: number;
  selected: boolean;
  hasSelection: boolean;
  config: VariantConfig;
  colors: NovoriColors;
  compactVisual: boolean;
  onSelect?: (
    item: StackBook
  ) => void;
};

function StackCover({
  item,
  index,
  selected,
  hasSelection,
  config,
  colors,
  compactVisual,
  onSelect,
}: StackCoverProps) {
  const selection =
    useSharedValue(
      selected
        ? 1
        : 0
    );

  const dim =
    useSharedValue(
      hasSelection &&
      !selected
        ? 1
        : 0
    );

  useEffect(() => {
    selection.value =
      withSpring(
        selected
          ? 1
          : 0,
        {
          damping: 20,
          stiffness: 220,
          mass: 0.72,
        }
      );

    dim.value =
      withSpring(
        hasSelection &&
        !selected
          ? 1
          : 0,
        {
          damping: 22,
          stiffness: 210,
          mass: 0.72,
        }
      );
  }, [
    dim,
    hasSelection,
    selected,
    selection,
  ]);

  const animatedStyle =
    useAnimatedStyle(
      () => ({
        transform: [
          {
            translateY:
              -10 *
              selection.value,
          },
          {
            scale:
              1 +
              0.065 *
                selection.value,
          },
        ],
        opacity:
          1 -
          0.16 *
            dim.value,
      })
    );

  return (
    <Animated.View
      layout={
        LinearTransition
          .springify()
          .damping(22)
          .stiffness(185)
      }
      style={[
        {
          width:
            config.width,
          height:
            config.height,
          marginLeft:
            index ===
            0
              ? 0
              : -config.overlap,
          marginRight:
            selected
              ? config.selectedGap
              : 0,
          zIndex:
            selected
              ? 100
              : index +
                1,
        },
        animatedStyle,
      ]}
    >
      <Pressable
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
          stylesForCover(
            colors,
            config
          ).book,
          selected &&
            stylesForCover(
              colors,
              config
            )
              .bookSelected,
          pressed &&
            onSelect &&
            stylesForCover(
              colors,
              config
            )
              .bookPressed,
        ]}
      >
        {(item.google_book_id || item.cover_url) ? (
          <BookCoverImage
            googleBookId={item.google_book_id}
            existingCoverUrl={item.cover_url}
            style={
              stylesForCover(
                colors,
                config
              ).cover
            }
          />
        ) : (
          <View
            style={
              stylesForCover(
                colors,
                config
              )
                .coverFallback
            }
          >
            <Ionicons
              name="book-outline"
              size={
                compactVisual
                  ? 17
                  : 25
              }
              color={
                colors.gold
              }
            />

            <Text
              style={
                stylesForCover(
                  colors,
                  config
                )
                  .fallbackTitle
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
              stylesForCover(
                colors,
                config
              )
                .featuredMarker
            }
          />
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

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

  const baseConfig =
    VARIANTS[
      resolvedVariant
    ];

  const config:
    VariantConfig =
      resolvedVariant ===
        'profile'
        ? {
            ...baseConfig,
            selectedGap: 0,
            overlap:
              items.length > 1
                ? Math.max(
                    0,
                    baseConfig.width -
                      (
                        138 -
                        baseConfig.width
                      ) /
                        (
                          items.length -
                          1
                        )
                  )
                : 0,
          }
        : baseConfig;

  const styles =
    createStyles(
      colors,
      config
    );

  const hasSelection =
    Boolean(
      selectedId
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

  const deck = (
    <View
      style={
        styles.deck
      }
    >
      {items.map(
        (
          item,
          index
        ) => (
          <StackCover
            key={
              item.id
            }
            item={
              item
            }
            index={
              index
            }
            selected={
              selectedId ===
              item.id
            }
            hasSelection={
              hasSelection
            }
            config={
              config
            }
            colors={
              colors
            }
            compactVisual={
              resolvedVariant ===
              'profile'
            }
            onSelect={
              onSelect
            }
          />
        )
      )}
    </View>
  );

  if (
    resolvedVariant ===
    'profile'
  ) {
    return (
      <View
        style={
          styles.profileFrame
        }
      >
        {deck}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={
        false
      }
      contentContainerStyle={
        styles.scrollContent
      }
      style={
        styles.scroll
      }
    >
      {deck}
    </ScrollView>
  );
}

function stylesForCover(
  colors: NovoriColors,
  config: VariantConfig
) {
  return StyleSheet.create({
    book: {
      width:
        config.width,
      height:
        config.height,
      borderRadius: 9,
      overflow:
        'hidden',
      backgroundColor:
        colors.elevated,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
      shadowColor:
        '#000',
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      elevation: 3,
    },

    bookSelected: {
      borderWidth: 1.5,
      borderColor:
        colors.gold,
      shadowOpacity: 0.24,
      shadowRadius: 12,
      shadowOffset: {
        width: 0,
        height: 7,
      },
      elevation: 9,
    },

    bookPressed: {
      opacity: 0.88,
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

    featuredMarker: {
      position:
        'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 3,
      backgroundColor:
        colors.gold,
      opacity: 0.9,
    },
  });
}

function createStyles(
  colors: NovoriColors,
  config: VariantConfig
) {
  return StyleSheet.create({
    scroll: {
      width: '100%',
    },

    scrollContent: {
      flexGrow: 1,
      justifyContent:
        'center',
      paddingHorizontal:
        config.horizontalPadding,
      paddingVertical:
        config.verticalPadding,
    },

    profileFrame: {
      width: '100%',
      minHeight:
        config.height +
        config.verticalPadding *
          2,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        config.horizontalPadding,
      paddingVertical:
        config.verticalPadding,
    },

    deck: {
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingRight:
        config.selectedGap,
    },

    empty: {
      minHeight:
        config.height +
        config.verticalPadding *
          2,
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
