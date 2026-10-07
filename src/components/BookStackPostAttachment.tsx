import {
  useRouter,
} from 'expo-router';
import {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
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
import BookStackShowcase from './BookStackShowcase';

export default function BookStackPostAttachment({
  stackId,
  variant = 'feed',
  interactive = true,
  compactTopSpacing = false,
}: {
  stackId: string;
  variant?: 'feed' | 'profile' | 'detail' | 'builder';
  interactive?: boolean;
  compactTopSpacing?: boolean;
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

  const [
    selectedId,
    setSelectedId,
  ] =
    useState<
      string | null
    >(null);

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
    <View>
      <BookStackShowcase
        name={
          stack.name
        }
        items={
          stack.items
        }
        variant={
          variant
        }
        interactive={
          interactive
        }
        selectedId={
          selectedId
        }
        onSelectedIdChange={
          setSelectedId
        }
        compactTopSpacing={
          compactTopSpacing
        }
        onOpenBook={(
          item
        ) =>
          router.push({
            pathname:
              '/book/[id]',
            params: {
              id:
                item.google_book_id ??
                '',
              source:
                'stack',
            },
          })
        }
      />
    </View>
  );

}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    loading: {
      minHeight: 120,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 14,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 18,
      backgroundColor:
        colors.surface,
    },
  });
}
