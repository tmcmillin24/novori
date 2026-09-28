import { Ionicons } from '@expo/vector-icons';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useEffect,
  useState,
} from 'react';

import {
  resolveHardcoverRating,
} from '../lib/book-search';
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
 };

export default function BookStackShowcase({
  name,
  items,
  variant = 'feed',
  interactive = false,
  selectedId = null,
  onSelectedIdChange,
  onOpenBook,
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

  const [
    hardcoverRating,
    setHardcoverRating,
  ] =
    useState<
      number | null
    >(null);

  const [
    hardcoverReaders,
    setHardcoverRatingsCount,
  ] =
    useState<
      number | null
    >(null);

  useEffect(() => {
    let active =
      true;

    async function loadHardcoverRating() {
      if (
        !selected
      ) {
        setHardcoverRating(
          null
        );
        setHardcoverRatingsCount(
          null
        );
        return;
      }

      setHardcoverRating(
        null
      );

      setHardcoverRatingsCount(
        null
      );

      try {
        const resolved =
          await resolveHardcoverRating({
            googleBookId:
              selected.google_book_id ??
              selected.id,
            title:
              selected.title,
            authors:
              selected.authors,
          });

        if (
          !active
        ) {
          return;
        }

        setHardcoverRating(
          resolved?.rating ??
          null
        );

        setHardcoverRatingsCount(
          resolved?.usersCount ??
          null
        );
      } catch {
        if (
          active
        ) {
          setHardcoverRating(
            null
          );
          setHardcoverRatingsCount(
            null
          );
        }
      }
    }

    void loadHardcoverRating();

    return () => {
      active =
        false;
    };
  }, [
    selected?.id,
    selected?.google_book_id,
  ]);

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
              styles.eyebrowLeft
            }
          >
            <Ionicons
              name="albums-outline"
              size={13}
              color={
                colors.gold
              }
            />

            <Text
              style={
                styles.eyebrow
              }
            >
              BOOK STACK
            </Text>
          </View>

          <View
            style={
              styles.countPill
            }
          >
            <Text
              style={
                styles.countText
              }
            >
              {items.length}
            </Text>
          </View>
        </View>

        <Text
          style={
            styles.title
          }
          numberOfLines={2}
        >
          {name}
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

            {hardcoverRating !==
            null ? (
              <View
                style={
                  styles.hardcoverRatingRow
                }
              >
                <View
                  style={
                    styles.hardcoverStars
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
                          hardcoverRating >=
                          star
                            ? 'star'
                            : hardcoverRating >=
                              star -
                                0.5
                              ? 'star-half'
                              : 'star-outline'
                        }
                        size={12}
                        color={
                          colors.gold
                        }
                      />
                    )
                  )}
                </View>

                <Text
                  style={
                    styles.hardcoverRatingText
                  }
                >
                  {hardcoverRating.toFixed(
                    1
                  )}
                  {hardcoverReaders !==
                  null
                    ? ` · ${hardcoverReaders.toLocaleString()} Hardcover readers`
                    : ' · Hardcover'}
                </Text>
              </View>
            ) : null}
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
                  colors.gold
                }
              />
            </Pressable>
          ) : null}
        </View>
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
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
      borderRadius: 18,
      overflow:
        'hidden',
    },

    goldLine: {
      height: 2,
      width: '100%',
      backgroundColor:
        colors.gold,
      opacity: 0.82,
    },

    header: {
      paddingHorizontal: 16,
      paddingTop: 14,
    },

    eyebrowRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    eyebrowLeft: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
    },

    countPill: {
      minWidth: 26,
      height: 22,
      paddingHorizontal: 8,
      borderRadius: 999,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
    },

    countText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 9.5,
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
      fontSize: 20,
      lineHeight: 25,
      marginTop: 8,
    },

    visual: {
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 2,
      paddingHorizontal: 2,
      paddingBottom: 3,
    },

    selectedPanel: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 12,
      marginHorizontal: 14,
      marginBottom: 14,
      paddingTop: 11,
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

    hardcoverRatingRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 7,
      marginTop: 7,
    },

    hardcoverStars: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 1,
    },

    hardcoverRatingText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 9.5,
    },

    viewBookButton: {
      minHeight: 36,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
      backgroundColor:
        colors.elevated,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.gold,
      borderRadius: 11,
      paddingHorizontal: 12,
    },

    viewBookText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10.5,
    },

    pressed: {
      opacity: 0.72,
    },
  });
}
