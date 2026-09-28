import { Ionicons } from '@expo/vector-icons';
import {
  Image,
  Pressable,
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
  stageWidth: number;
  stageHeight: number;
  maxVisible: number;
  xOffsets: number[];
  yOffsets: number[];
  rotations: number[];
};

const VARIANTS:
  Record<
    BookStackVisualVariant,
    VariantConfig
  > = {
    builder: {
      width: 112,
      height: 168,
      stageWidth: 292,
      stageHeight: 218,
      maxVisible: 5,
      xOffsets: [
        0,
        -42,
        42,
        -76,
        76,
      ],
      yOffsets: [
        7,
        19,
        19,
        32,
        32,
      ],
      rotations: [
        0,
        -5,
        5,
        -8,
        8,
      ],
    },
    feed: {
      width: 104,
      height: 156,
      stageWidth: 276,
      stageHeight: 205,
      maxVisible: 5,
      xOffsets: [
        0,
        -39,
        39,
        -69,
        69,
      ],
      yOffsets: [
        6,
        18,
        18,
        30,
        30,
      ],
      rotations: [
        0,
        -5,
        5,
        -8,
        8,
      ],
    },
    profile: {
      width: 70,
      height: 105,
      stageWidth: 176,
      stageHeight: 138,
      maxVisible: 4,
      xOffsets: [
        0,
        -28,
        28,
        -50,
      ],
      yOffsets: [
        4,
        12,
        12,
        22,
      ],
      rotations: [
        0,
        -6,
        6,
        -9,
      ],
    },
    detail: {
      width: 138,
      height: 207,
      stageWidth: 340,
      stageHeight: 275,
      maxVisible: 6,
      xOffsets: [
        0,
        -50,
        50,
        -89,
        89,
        0,
      ],
      yOffsets: [
        8,
        24,
        24,
        42,
        42,
        55,
      ],
      rotations: [
        0,
        -5,
        5,
        -8,
        8,
        0,
      ],
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

  const visible =
    items.slice(
      0,
      config.maxVisible
    );

  const selectedIndex =
    selectedId
      ? visible.findIndex(
          (item) =>
            item.id ===
            selectedId
        )
      : -1;

  return (
    <View
      style={[
        styles.stage,
        {
          width:
            config.stageWidth,
          height:
            config.stageHeight,
        },
      ]}
    >
      {visible
        .map(
          (
            item,
            index
          ) => ({
            item,
            index,
          })
        )
        .reverse()
        .map(
          ({
            item,
            index,
          }) => {
            const selected =
              selectedId ===
              item.id;

            const hasSelection =
              selectedIndex >=
              0;

            const baseX =
              config.xOffsets[
                index
              ] ?? 0;

            const baseY =
              config.yOffsets[
                index
              ] ?? 0;

            const rotation =
              config.rotations[
                index
              ] ?? 0;

            const spreadFactor =
              hasSelection &&
              !selected
                ? 1.13
                : 1;

            const selectedLift =
              selected
                ? resolvedVariant ===
                  'detail'
                  ? -18
                  : -10
                : 0;

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
                style={[
                  styles.book,
                  {
                    left:
                      config.stageWidth /
                        2 -
                      config.width /
                        2,
                    top:
                      baseY +
                      selectedLift,
                    zIndex:
                      selected
                        ? 99
                        : config.maxVisible -
                          index,
                    opacity:
                      hasSelection &&
                      !selected
                        ? 0.62
                        : 1,
                    transform: [
                      {
                        translateX:
                          baseX *
                          spreadFactor,
                      },
                      {
                        rotate:
                          `${rotation}deg`,
                      },
                      {
                        scale:
                          selected
                            ? 1.075
                            : 1,
                      },
                    ],
                  },
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
                          ? 18
                          : 29
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
            );
          }
        )}

      {items.length >
      config.maxVisible ? (
        <View
          style={
            styles.moreBadge
          }
        >
          <Text
            style={
              styles.moreText
            }
          >
            +
            {items.length -
              config.maxVisible}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(
  colors: NovoriColors,
  config: VariantConfig
) {
  const radius =
    Math.max(
      7,
      Math.round(
        config.width *
          0.08
      )
    );

  return StyleSheet.create({
    stage: {
      alignSelf:
        'center',
      position:
        'relative',
    },

    book: {
      position:
        'absolute',
      width:
        config.width,
      height:
        config.height,
      borderRadius:
        radius,
      overflow:
        'hidden',
      backgroundColor:
        colors.elevated,
      borderWidth: 1,
      borderColor:
        colors.border,
      shadowColor:
        '#000',
      shadowOpacity:
        0.17,
      shadowRadius: 7,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      elevation: 4,
    },

    cover: {
      width:
        '100%',
      height:
        '100%',
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
          : 10.5,
      lineHeight:
        config.width <
        80
          ? 10
          : 14,
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
      opacity: 0.9,
    },

    moreBadge: {
      position:
        'absolute',
      right: 6,
      bottom: 8,
      minWidth: 30,
      height: 24,
      borderRadius: 999,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      borderWidth: 1,
      borderColor:
        colors.border,
      paddingHorizontal: 8,
    },

    moreText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10,
    },
  });
}
