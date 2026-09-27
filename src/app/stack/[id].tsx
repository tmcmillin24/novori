import { Ionicons } from '@expo/vector-icons';
import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import BookStackVisual from '../../components/BookStackVisual';
import {
  NovoriColors,
} from '../../constants/novori-theme';
import {
  useNovoriTheme,
} from '../../context/theme-context';
import {
  BookStack,
  BookStackItem,
  getBookStack,
} from '../../lib/book-stacks';

export default function BookStackDetailScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      id: string;
    }>();

  const stackId =
    typeof params.id ===
    'string'
      ? params.id
      : '';

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
    selectedId,
    setSelectedId,
  ] =
    useState<
      string | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    let mounted =
      true;

    async function load() {
      if (
        !stackId
      ) {
        setError(
          'Book Stack not found.'
        );
        setLoading(
          false
        );
        return;
      }

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
        loadError
      ) {
        console.error(
          'Could not load Book Stack:',
          loadError
        );

        if (
          mounted
        ) {
          setError(
            'This Book Stack could not be loaded.'
          );
        }
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

  const selected =
    stack?.items.find(
      (item) =>
        item.id ===
        selectedId
    ) ?? null;

  function openBook(
    item:
      BookStackItem
  ) {
    router.push({
      pathname:
        '/book/[id]',
      params: {
        id:
          item.google_book_id,
        source:
          'stack',
      },
    });
  }

  if (
    loading
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.center
          }
        >
          <ActivityIndicator
            size="large"
            color={
              colors.gold
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  if (
    error ||
    !stack
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.header
          }
        >
          <Pressable
            onPress={() =>
              router.back()
            }
            style={
              styles.headerButton
            }
          >
            <Ionicons
              name="chevron-back"
              size={25}
              color={
                colors.text
              }
            />
          </Pressable>

          <Text
            style={
              styles.headerTitle
            }
          >
            Book Stack
          </Text>

          <View
            style={
              styles.headerButton
            }
          />
        </View>

        <View
          style={
            styles.center
          }
        >
          <Text
            style={
              styles.errorText
            }
          >
            {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          style={
            styles.headerButton
          }
        >
          <Ionicons
            name="chevron-back"
            size={25}
            color={
              colors.text
            }
          />
        </Pressable>

        <Text
          style={
            styles.headerTitle
          }
        >
          Book Stack
        </Text>

        <View
          style={
            styles.headerButton
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.eyebrowRow
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

        <Text
          style={
            styles.title
          }
        >
          {
            stack.name
          }
        </Text>

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

        <View
          style={
            styles.visual
          }
        >
          <BookStackVisual
            items={
              stack.items
            }
            selectedId={
              selectedId
            }
            onSelect={(
              item
            ) =>
              setSelectedId(
                (
                  current
                ) =>
                  current ===
                    item.id
                    ? null
                    : item.id
              )
            }
          />
        </View>

        {selected ? (
          <View
            style={
              styles.selectedPanel
            }
          >
            <Text
              style={
                styles.selectedTitle
              }
            >
              {
                selected.title
              }
            </Text>

            <Text
              style={
                styles.selectedAuthor
              }
            >
              {selected.authors.join(
                ', '
              ) ||
                'Unknown author'}
            </Text>

            <Pressable
              onPress={() =>
                openBook(
                  selected
                )
              }
              style={({ pressed }) => [
                styles.viewBookButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.viewBookButtonText
                }
              >
                View Book
              </Text>

              <Ionicons
                name="arrow-forward"
                size={17}
                color={
                  colors.background
                }
              />
            </Pressable>
          </View>
        ) : (
          <Text
            style={
              styles.tapHint
            }
          >
            Tap a cover to pull it forward.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    header: {
      height: 54,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 12,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.border,
    },

    headerButton: {
      width: 42,
      height: 42,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    headerTitle: {
      flex: 1,
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 18,
      textAlign:
        'center',
    },

    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf:
        'center',
      paddingHorizontal: 20,
      paddingTop: 26,
      paddingBottom: 46,
    },

    eyebrowRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
    },

    eyebrow: {
      color:
        colors.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10,
      letterSpacing: 1.1,
    },

    title: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 30,
      lineHeight: 36,
      marginTop: 10,
    },

    meta: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 11,
      marginTop: 6,
    },

    visual: {
      minHeight: 520,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 8,
      paddingVertical: 12,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        colors.border,
    },

    selectedPanel: {
      marginTop: 18,
      paddingTop: 18,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        colors.border,
    },

    selectedTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_600SemiBold',
      fontSize: 21,
      lineHeight: 27,
    },

    selectedAuthor: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12.5,
      marginTop: 5,
    },

    viewBookButton: {
      alignSelf:
        'flex-start',
      minHeight: 42,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 7,
      backgroundColor:
        colors.gold,
      borderRadius: 12,
      paddingHorizontal: 15,
      marginTop: 15,
    },

    viewBookButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 12,
    },

    tapHint: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      textAlign:
        'center',
      marginTop: 16,
    },

    center: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      padding: 24,
    },

    errorText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 13,
      textAlign:
        'center',
    },

    pressed: {
      opacity: 0.76,
    },
  });
}
