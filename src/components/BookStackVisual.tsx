import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  LinearTransition,
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
  stageHeight: number;
  overlap: number;
  selectedGap: number;
  horizontalPadding: number;
};

const VARIANTS:
  Record<
    BookStackVisualVariant,
    VariantConfig
  > = {
    builder: {
      width: 108,
      height: 162,
      stageHeight: 194,
      overlap: 32,
      selectedGap: 22,
      horizontalPadding: 20,
    },
    feed: {
      width: 100,
      height: 150,
      stageHeight: 184,
      overlap: 30,
      selectedGap: 20,
      horizontalPadding: 18,
    },
    profile: {
      width: 70,
      height: 105,
      stageHeight: 129,
      overlap: 21,
      selectedGap: 14,
      horizontalPadding: 12,
    },
    detail: {
      width: 128,
      height: 192,
      stageHeight: 228,
      overlap: 38,
      selectedGap: 24,
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

  const selectedIndex =
    selectedId
      ? items.findIndex(
          (
            item
          ) =>
            item.id ===
            selectedId
        )
      : -1;

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
      contentContainerStyle={{
        paddingHorizontal:
          config.horizontalPadding,
        alignItems:
          'center',
      }}
      style={{
        width: '100%',
        height:
          config.stageHeight,
      }}
    >
      <View
        style={[
          styles.strip,
          {
            minWidth:
              config.width +
              Math.max(
                0,
                items.length -
                  1
              ) *
                (
                  config.width -
                  config.overlap
                ) +
              (
                selectedIndex >=
                0
                  ? config.selectedGap *
                    2
                  : 0
              ),
          },
        ]}
      >
        {items.map(
          (
            item,
            index
          ) => {
            const selected =
              selectedId ===
              item.id;

            const baseLeft =
              index *
              (
                config.width -
                config.overlap
              );

            const separation =
              selectedIndex <
              0
                ? 0
                : index <
                    selectedIndex
                  ? -config.selectedGap
                  : index >
                      selectedIndex
                    ? config.selectedGap
                    : 0;

            const selectedCentering =
              selectedIndex >=
              0
                ? config.selectedGap
                : 0;

            return (
              <Animated.View
                key={
                  item.id
                }
                layout={
                  LinearTransition
                    .springify()
                    .damping(22)
                    .stiffness(190)
                }
                style={[
                  styles.bookPosition,
                  {
                    left:
                      baseLeft +
                      separation +
                      selectedCentering,
                    zIndex:
                      selected
                        ? 100
                        : index +
                          1,
                    transform: [
                      {
                        translateY:
                          selected
                            ? -9
                            : 0,
                      },
                      {
                        scale:
                          selected
                            ? 1.07
                            : 1,
                      },
                    ],
                  },
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
                        styles.featuredEdge
                      }
                    />
                  ) : null}
                </Pressable>
              </Animated.View>
            );
          }
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(
  colors: NovoriColors,
  config: VariantConfig
) {
  return StyleSheet.create({
    strip: {
      position:
        'relative',
      height:
        config.stageHeight,
    },

    bookPosition: {
      position:
        'absolute',
      top:
        (
          config.stageHeight -
          config.height
        ) /
        2,
      width:
        config.width,
      height:
        config.height,
    },

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
      shadowOpacity: 0.13,
      shadowRadius: 7,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      elevation: 3,
    },

    bookSelected: {
      borderColor:
        colors.gold,
      borderWidth: 2,
      shadowOpacity: 0.22,
      shadowRadius: 11,
      elevation: 8,
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

    featuredEdge: {
      position:
        'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 3,
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
