import BookCoverImage from './BookCoverImage';
import { Ionicons } from '@expo/vector-icons';
import {
  useEffect,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import {
  NovoriColors,
} from '../constants/novori-theme';
import {
  BookStackDraftItem,
} from '../lib/book-stacks';

export type StackDropEdge =
  | 'top'
  | 'bottom'
  | null;

type Props = {
  item: BookStackDraftItem;
  index: number;
  isDragging: boolean;
  dropEdge: StackDropEdge;
  onDragStart: (
    bookId: string,
    index: number
  ) => void;
  onDragMove: (
    bookId: string,
    translationY: number
  ) => void;
  onDragEnd: () => void;
  onRemove: () => void;
  colors: NovoriColors;
};

const ROW_HEIGHT =
  72;

export default function SortableBookStackRow({
  item,
  index,
  isDragging,
  dropEdge,
  onDragStart,
  onDragMove,
  onDragEnd,
  onRemove,
  colors,
}: Props) {
  const styles =
    createStyles(
      colors
    );

  const translateY =
    useSharedValue(
      0
    );

  const scale =
    useSharedValue(
      1
    );

  useEffect(() => {
    if (
      !isDragging
    ) {
      translateY.value =
        withSpring(
          0,
          {
            damping: 19,
            stiffness: 230,
          }
        );

      scale.value =
        withSpring(
          1,
          {
            damping: 19,
            stiffness: 230,
          }
        );
    }
  }, [
    isDragging,
    scale,
    translateY,
  ]);

  const gesture =
    Gesture.Pan()
      .activateAfterLongPress(
        160
      )
      .onStart(() => {
        scale.value =
          withSpring(
            1.025,
            {
              damping: 18,
              stiffness: 250,
            }
          );

        runOnJS(
          onDragStart
        )(
          item.googleBookId,
          index
        );
      })
      .onUpdate(
        (
          event
        ) => {
          translateY.value =
            event.translationY;

          runOnJS(
            onDragMove
          )(
            item.googleBookId,
            event.translationY
          );
        }
      )
      .onFinalize(() => {
        translateY.value =
          withSpring(
            0,
            {
              damping: 19,
              stiffness: 230,
            }
          );

        scale.value =
          withSpring(
            1,
            {
              damping: 19,
              stiffness: 230,
            }
          );

        runOnJS(
          onDragEnd
        )();
      });

  const animatedStyle =
    useAnimatedStyle(
      () => ({
        transform: [
          {
            translateY:
              translateY.value,
          },
          {
            scale:
              scale.value,
          },
        ],
      })
    );

  return (
    <Animated.View
      layout={
        LinearTransition
          .springify()
          .damping(20)
          .stiffness(220)
      }
      style={[
        styles.rowWrap,
        isDragging &&
          styles.rowDragging,
        animatedStyle,
      ]}
    >
      {dropEdge ===
      'top' ? (
        <View
          style={[
            styles.dropLine,
            styles.dropLineTop,
          ]}
        />
      ) : null}

      <View
        style={
          styles.row
        }
      >
        {(item.googleBookId || item.coverUrl) ? (
          <BookCoverImage
            googleBookId={item.googleBookId}
            existingCoverUrl={item.coverUrl}
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
              size={18}
              color={
                colors.gold
              }
            />
          </View>
        )}

        <View
          style={
            styles.copy
          }
        >
          <View
            style={
              styles.titleRow
            }
          >
            <Text
              style={
                styles.title
              }
              numberOfLines={1}
            >
              {
                item.title
              }
            </Text>

            {index ===
            0 ? (
              <View
                style={
                  styles.featuredBadge
                }
              >
                <Ionicons
                  name="star"
                  size={9}
                  color={
                    colors.gold
                  }
                />

                <Text
                  style={
                    styles.featuredText
                  }
                >
                  Featured
                </Text>
              </View>
            ) : null}
          </View>

          <Text
            style={
              styles.author
            }
            numberOfLines={1}
          >
            {item.authors.join(
              ', '
            ) ||
              'Unknown author'}
          </Text>
        </View>

        <View
          style={
            styles.controls
          }
        >
          <GestureDetector
            gesture={
              gesture
            }
          >
            <Animated.View
              style={[
                styles.dragHandle,
                isDragging &&
                  styles.dragHandleActive,
              ]}
            >
              <Ionicons
                name="reorder-three-outline"
                size={25}
                color={
                  isDragging
                    ? colors.gold
                    : colors.secondaryText
                }
              />
            </Animated.View>
          </GestureDetector>

          <Pressable
            hitSlop={6}
            onPress={
              onRemove
            }
            style={({ pressed }) => [
              styles.removeButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="close"
              size={18}
              color={
                colors.danger
              }
            />
          </Pressable>
        </View>
      </View>

      {dropEdge ===
      'bottom' ? (
        <View
          style={[
            styles.dropLine,
            styles.dropLineBottom,
          ]}
        />
      ) : null}
    </Animated.View>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    rowWrap: {
      position:
        'relative',
      minHeight:
        ROW_HEIGHT,
      backgroundColor:
        colors.background,
    },

    rowDragging: {
      zIndex: 50,
      backgroundColor:
        colors.surface,
      borderRadius: 14,
      shadowColor:
        '#000',
      shadowOpacity: 0.16,
      shadowRadius: 10,
      shadowOffset: {
        width: 0,
        height: 5,
      },
      elevation: 7,
    },

    row: {
      minHeight:
        ROW_HEIGHT,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
      paddingVertical: 9,
      paddingHorizontal: 2,
    },

    cover: {
      width: 36,
      height: 54,
      borderRadius: 5,
      backgroundColor:
        colors.elevated,
      marginRight: 10,
    },

    coverFallback: {
      width: 36,
      height: 54,
      borderRadius: 5,
      backgroundColor:
        colors.elevated,
      marginRight: 10,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    copy: {
      flex: 1,
      minWidth: 0,
    },

    titleRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 7,
      minWidth: 0,
    },

    title: {
      flexShrink: 1,
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 12,
    },

    author: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      marginTop: 4,
    },

    featuredBadge: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 3,
      borderRadius: 999,
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.gold,
      paddingHorizontal: 6,
      paddingVertical: 3,
    },

    featuredText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 7.5,
      letterSpacing: 0.25,
    },

    controls: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 2,
      marginLeft: 8,
    },

    dragHandle: {
      width: 40,
      height: 40,
      borderRadius: 11,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    dragHandleActive: {
      backgroundColor:
        colors.elevated,
    },

    removeButton: {
      width: 30,
      height: 30,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    dropLine: {
      position:
        'absolute',
      left: 2,
      right: 2,
      height: 2,
      borderRadius: 999,
      backgroundColor:
        colors.gold,
      zIndex: 100,
    },

    dropLineTop: {
      top: -1,
    },

    dropLineBottom: {
      bottom: -1,
    },

    pressed: {
      opacity: 0.7,
    },
  });
}
