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
  getBookStackAttachment,
  peekBookStackAttachment,
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

  const [loaded, setLoaded] = useState<{ id: string; value: BookStack | null } | null>(null);
  const [selection, setSelection] = useState<{ id: string; item: string | null } | null>(null);
  const stack = loaded?.id === stackId ? loaded.value : peekBookStackAttachment(stackId);
  const loading = !stack && loaded?.id !== stackId;
  const selectedId = selection?.id === stackId ? selection.item : null;

  useEffect(() => {
    let active = true;
    void getBookStackAttachment(stackId).then(value => {
      if (active) setLoaded(current => current?.id === stackId && current.value === value ? current : { id: stackId, value });
    }).catch(error => {
      if (!active) return;
      console.warn('Could not load Book Stack attachment:', error);
      setLoaded({ id: stackId, value: null });
    });
    return () => { active = false; };
  }, [stackId]);

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
        variant={variant}
        animateLayout={variant !== 'feed'}
        interactive={
          interactive
        }
        selectedId={
          selectedId
        }
        onSelectedIdChange={item => setSelection({ id: stackId, item })}
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
