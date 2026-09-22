import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COLORS } from '../../constants/novori-theme';

type GoogleBookItem = {
  id: string;

  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;

    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
    };

    industryIdentifiers?: {
      type: string;
      identifier: string;
    }[];

    pageCount?: number;
    categories?: string[];
  };
};

export default function DiscoverScreen() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<GoogleBookItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function searchBooks() {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return;
    }

    Keyboard.dismiss();

    try {
      setLoading(true);
      setError('');

      const encodedQuery = encodeURIComponent(trimmedQuery);

      const apiKey =
        process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY;

      if (!apiKey) {
        throw new Error(
          'Google Books API key is missing from the .env file.'
        );
      }

      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodedQuery}&maxResults=20&key=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(
          `Google Books request failed: ${response.status}`
        );
      }

      const data = await response.json();

      setBooks(data.items ?? []);
    } catch (err) {
      console.error(err);

      setError(
        'Could not search books. Please try again.'
      );

      setBooks([]);
    } finally {
      setLoading(false);
    }
  }

  function openBook(bookId: string) {
    router.push({
      pathname: '/book/[id]',
      params: {
        id: bookId,
      },
    });
  }

  function renderBook({
    item,
  }: {
    item: GoogleBookItem;
  }) {
    const info = item.volumeInfo;

    const cover =
      info.imageLinks?.thumbnail?.replace(
        'http://',
        'https://'
      ) ||
      info.imageLinks?.smallThumbnail?.replace(
        'http://',
        'https://'
      );

    return (
      <Pressable
        style={({ pressed }) => [
          styles.bookCard,
          pressed && styles.bookCardPressed,
        ]}
        onPress={() => openBook(item.id)}
      >
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={styles.cover}
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={styles.coverPlaceholderText}>
              No Cover
            </Text>
          </View>
        )}

        <View style={styles.bookInfo}>
          <Text
            style={styles.bookTitle}
            numberOfLines={2}
          >
            {info.title ?? 'Untitled'}
          </Text>

          <Text
            style={styles.author}
            numberOfLines={1}
          >
            {info.authors?.join(', ') ??
              'Unknown author'}
          </Text>

          {info.publishedDate ? (
            <Text style={styles.meta}>
              {info.publishedDate}
            </Text>
          ) : null}

          {info.pageCount ? (
            <Text style={styles.meta}>
              {info.pageCount} pages
            </Text>
          ) : null}

          <Text style={styles.viewDetails}>
            View details →
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>
          Discover
        </Text>

        <Text style={styles.subheading}>
          Find your next read.
        </Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Title, author, or ISBN"
          placeholderTextColor={COLORS.mutedText}
          value={query}
          onChangeText={(text) => setQuery(text)}
          returnKeyType="search"
          onSubmitEditing={searchBooks}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          clearButtonMode="while-editing"
          blurOnSubmit={false}
        />

        <Pressable
          style={({ pressed }) => [
            styles.searchButton,
            pressed && styles.searchButtonPressed,
          ]}
          onPress={searchBooks}
        >
          <Text style={styles.searchButtonText}>
            Search
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.gold}
          style={styles.loader}
        />
      ) : null}

      {error ? (
        <Text style={styles.error}>
          {error}
        </Text>
      ) : null}

      <FlatList
        data={books}
        keyExtractor={(item) => item.id}
        renderItem={renderBook}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading && !error ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                Find your next read
              </Text>

              <Text style={styles.emptyText}>
                Search by title, author, or ISBN.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },

  heading: {
    color: COLORS.gold,
    fontSize: 34,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  subheading: {
    color: COLORS.secondaryText,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    marginTop: 3,
  },

  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
  },

  input: {
    flex: 1,
    minHeight: 48,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },

  searchButton: {
    minHeight: 48,
    backgroundColor: COLORS.gold,
    justifyContent: 'center',
    paddingHorizontal: 17,
    borderRadius: 14,
  },

  searchButtonPressed: {
    opacity: 0.8,
  },

  searchButtonText: {
    color: COLORS.background,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },

  loader: {
    marginTop: 30,
  },

  error: {
    color: COLORS.danger,
    paddingHorizontal: 20,
    marginTop: 20,
    fontFamily: 'Inter_400Regular',
  },

  list: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },

  bookCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  bookCardPressed: {
    opacity: 0.72,
  },

  cover: {
    width: 75,
    height: 112,
    borderRadius: 8,
    backgroundColor: COLORS.elevated,
  },

  coverPlaceholder: {
    width: 75,
    height: 112,
    borderRadius: 8,
    backgroundColor: COLORS.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  coverPlaceholderText: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },

  bookInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },

  bookTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    marginBottom: 5,
  },

  author: {
    color: COLORS.secondaryText,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    marginBottom: 7,
  },

  meta: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 2,
  },

  viewDetails: {
    color: COLORS.softGold,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 7,
  },

  emptyState: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 30,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontFamily: 'PlayfairDisplay_600SemiBold',
  },

  emptyText: {
    color: COLORS.mutedText,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 8,
  },
});