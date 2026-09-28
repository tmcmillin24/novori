import { Ionicons } from '@expo/vector-icons';
import {
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
import BookStackVisual, {
  BookStackVisualVariant,
} from './BookStackVisual';

export type BookStackShowcaseItem = {
  id: string;
  title: string;
  authors: string[];
  cover_url: string | null;
  google_book_id?: string;
};

type Props = {
  name: string;
  items: BookStackShowcaseItem[];
  variant?: BookStackVisualVariant;
  interactive?: boolean;
  selectedId?: string | null;
  onSelectedIdChange?: (
    id: string | null
  ) => void;
  onOpenBook?: (
    item: BookStackShowcaseItem
  ) => void;
  onOpenStack?: () => void;
  showOpenStack?: boolean;
};

export default function BookStackShowcase({
  name,
  items,
  variant = 'feed',
  interactive = false,
  selectedId = null,
  onSelectedIdChange,
  onOpenBook,
  onOpenStack,
  showOpenStack = false,
}: Props) {
  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const selected =
    selectedId
      ? items.find(
          (item) =>
            item.id ===
            selectedId
        ) ?? null
      : null;

  return (
    <View
      style={
        styles.card
      }
    >
      <View
        style={
          styles.goldLine
        }
      />

      <View
        style={
          styles.header
        }
      >
        <View
          style={
            styles.eyebrowRow
          }
        >
          <View
            style={
              styles.iconWrap
            }
          >
            <Ionicons
              name="albums-outline"
              size={14}
              color={
                colors.gold
              }
            />
          </View>

          <Text
            style={
              styles.eyebrow
            }
          >
            BOOK STACK
          </Text>
        </View>

        <Text
          style={
            styles.title
          }
          numberOfLines={2}
        >
          {name}
        </Text>

        <Text
          style={
            styles.meta
          }
        >
          {items.length}{' '}
          {items.length ===
          1
            ? 'book'
            : 'books'}
          {interactive
            ? ' · tap a cover to explore'
            : ''}
        </Text>
      </View>

      <View
        style={
          styles.visual
        }
      >
        <BookStackVisual
          variant={
            variant
          }
          items={
            items
          }
          selectedId={
            selectedId
          }
          onSelect={
            interactive
              ? (item) =>
                  onSelectedIdChange?.(
                    selectedId ===
                      item.id
                      ? null
                      : item.id
                  )
              : undefined
          }
        />
      </View>

      {selected ? (
        <View
          style={
            styles.selectedPanel
          }
        >
          <View
            style={
              styles.selectedCopy
            }
          >
            <Text
              style={
                styles.selectedTitle
              }
              numberOfLines={2}
            >
              {
                selected.title
              }
            </Text>

            <Text
              style={
                styles.selectedAuthor
              }
              numberOfLines={1}
            >
              {selected.authors.join(
                ', '
              ) ||
                'Unknown author'}
            </Text>
          </View>

          {onOpenBook ? (
            <Pressable
              onPress={(
                event
              ) => {
                event.stopPropagation();

                onOpenBook(
                  selected
                );
              }}
              style={({ pressed }) => [
                styles.viewBookButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.viewBookText
                }
              >
                View Book
              </Text>

              <Ionicons
                name="arrow-forward"
                size={15}
                color={
                  colors.background
                }
              />
            </Pressable>
          ) : null}
        </View>
      ) : interactive ? (
        <View
          style={
            styles.interactionHint
          }
        >
          <Ionicons
            name="hand-left-outline"
            size={14}
            color={
              colors.gold
            }
          />

          <Text
            style={
              styles.interactionHintText
            }
          >
            Tap a cover to pull it forward.
          </Text>
        </View>
      ) : null}

      {showOpenStack &&
      onOpenStack ? (
        <Pressable
          onPress={(
            event
          ) => {
            event.stopPropagation();
            onOpenStack();
          }}
          style={({ pressed }) => [
            styles.openStackButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <Text
            style={
              styles.openStackText
            }
          >
            Open full stack
          </Text>

          <Ionicons
            name="chevron-forward"
            size={14}
            color={
              colors.gold
            }
          />
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    card: {
      marginTop: 14,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 18,
      overflow:
        'hidden',
    },

    goldLine: {
      height: 3,
      width: '100%',
      backgroundColor:
        colors.gold,
      opacity: 0.82,
    },

    header: {
      paddingHorizontal: 15,
      paddingTop: 13,
    },

    eyebrowRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 7,
    },

    iconWrap: {
      width: 26,
      height: 26,
      borderRadius: 9,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
    },

    eyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 9,
      letterSpacing: 1.35,
    },

    title: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 21,
      lineHeight: 27,
      marginTop: 9,
    },

    meta: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 10.5,
      marginTop: 4,
    },

    visual: {
      minHeight: 210,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 2,
      paddingHorizontal: 4,
    },

    selectedPanel: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 12,
      marginHorizontal: 14,
      marginBottom: 13,
      paddingTop: 12,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.border,
    },

    selectedCopy: {
      flex: 1,
      minWidth: 0,
    },

    selectedTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12.5,
      lineHeight: 17,
    },

    selectedAuthor: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      marginTop: 3,
    },

    viewBookButton: {
      minHeight: 36,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
      backgroundColor:
        colors.gold,
      borderRadius: 11,
      paddingHorizontal: 12,
    },

    viewBookText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10.5,
    },

    interactionHint: {
      minHeight: 39,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 7,
      marginHorizontal: 14,
      marginBottom: 11,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.border,
    },

    interactionHintText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 9.5,
    },

    openStackButton: {
      minHeight: 41,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 4,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.border,
      backgroundColor:
        colors.background,
    },

    openStackText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 10.5,
    },

    pressed: {
      opacity: 0.72,
    },
  });
}
