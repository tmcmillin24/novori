import { Ionicons } from '@expo/vector-icons';
import {
  useRouter,
} from 'expo-router';
import {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
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
  BookStack,
  getBookStack,
} from '../lib/book-stacks';
import BookStackVisual from './BookStackVisual';

export default function BookStackPostAttachment({
  stackId,
}: {
  stackId: string;
}) {
  const router =
    useRouter();

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const [
    stack,
    setStack,
  ] =
    useState<
      BookStack | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useEffect(() => {
    let mounted =
      true;

    async function load() {
      try {
        const next =
          await getBookStack(
            stackId
          );

        if (
          mounted
        ) {
          setStack(
            next
          );
        }
      } catch (
        error
      ) {
        console.error(
          'Could not load Book Stack attachment:',
          error
        );
      } finally {
        if (
          mounted
        ) {
          setLoading(
            false
          );
        }
      }
    }

    void load();

    return () => {
      mounted =
        false;
    };
  }, [
    stackId,
  ]);

  if (
    loading
  ) {
    return (
      <View
        style={
          styles.loading
        }
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
    !stack
  ) {
    return null;
  }

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname:
            '/stack/[id]',
          params: {
            id:
              stack.id,
          },
        })
      }
      style={({ pressed }) => [
        styles.wrap,
        pressed &&
          styles.pressed,
      ]}
    >
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
            numberOfLines={2}
          >
            {
              stack.name
            }
          </Text>

          <Ionicons
            name="chevron-forward"
            size={17}
            color={
              colors.mutedText
            }
          />
        </View>

        <Text
          style={
            styles.meta
          }
        >
          {stack.items.length}{' '}
          {stack.items.length ===
          1
            ? 'book'
            : 'books'}
        </Text>
      </View>

      <View
        style={
          styles.visual
        }
      >
        <BookStackVisual
          compact
          items={
            stack.items
          }
        />
      </View>
    </Pressable>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    wrap: {
      marginTop: 14,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
      paddingTop: 14,
      paddingBottom: 16,
      overflow:
        'hidden',
    },

    copy: {
      paddingHorizontal: 2,
    },

    titleRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
    },

    title: {
      flex: 1,
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      lineHeight: 24,
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
      minHeight: 250,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 6,
    },

    loading: {
      minHeight: 120,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 14,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
    },

    pressed: {
      opacity: 0.78,
    },
  });
}
