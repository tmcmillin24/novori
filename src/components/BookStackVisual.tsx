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

type Props = {
  items: StackBook[];
  compact?: boolean;
  selectedId?: string | null;
  onSelect?: (
    item: StackBook
  ) => void;
};

export default function BookStackVisual({
  items,
  compact = false,
  selectedId = null,
  onSelect,
}: Props) {
  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors,
      compact
    );

  const visible =
    items.slice(
      0,
      compact
        ? 5
        : 8
    );

  return (
    <View
      style={
        styles.stage
      }
    >
      {visible.map(
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
              onPress={() =>
                onSelect?.(
                  item
                )
              }
              style={[
                styles.book,
                {
                  top:
                    index *
                    (
                      compact
                        ? 23
                        : 38
                    ),
                  zIndex:
                    selected
                      ? 99
                      : index +
                        1,
                  transform: [
                    {
                      translateX:
                        selected
                          ? compact
                            ? 18
                            : 34
                          : index %
                              2 ===
                            0
                          ? -5
                          : 5,
                    },
                    {
                      scale:
                        selected
                          ? 1.06
                          : 1,
                    },
                  ],
                  opacity:
                    selectedId &&
                    !selected
                      ? 0.58
                      : 1,
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
                      compact
                        ? 22
                        : 32
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

              <View
                style={
                  styles.edge
                }
              />
            </Pressable>
          );
        }
      )}
    </View>
  );
}

function createStyles(
  colors: NovoriColors,
  compact: boolean
) {
  const width =
    compact
      ? 92
      : 148;

  const height =
    compact
      ? 136
      : 218;

  const count =
    compact
      ? 5
      : 8;

  const offset =
    compact
      ? 23
      : 38;

  return StyleSheet.create({
    stage: {
      width:
        width +
        (compact
          ? 30
          : 54),
      height:
        height +
        offset *
          (count - 1),
      alignSelf:
        'center',
      position:
        'relative',
      paddingTop: 2,
    },

    book: {
      position:
        'absolute',
      left:
        compact
          ? 15
          : 27,
      width,
      height,
      borderRadius:
        compact
          ? 9
          : 13,
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
        0.22,
      shadowRadius:
        compact
          ? 5
          : 10,
      shadowOffset: {
        width: 0,
        height:
          compact
            ? 3
            : 6,
      },
      elevation:
        compact
          ? 3
          : 6,
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
        compact
          ? 8
          : 11,
      lineHeight:
        compact
          ? 11
          : 15,
      textAlign:
        'center',
      marginTop: 8,
    },

    edge: {
      position:
        'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height:
        compact
          ? 4
          : 6,
      backgroundColor:
        colors.background,
      opacity: 0.32,
    },
  });
}
