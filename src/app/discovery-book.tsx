import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import BookCoverImage from '../components/BookCoverImage';
import { useNovoriTheme } from '../context/theme-context';
import { discoveryCoverInput, parseDiscoveryBook } from '../lib/discovery-books';
import { resolveDiscoveryBook } from '../lib/resolve-discovery-book';
import { formatBookDescription } from '../lib/book-description';

// A discovery listing remains viewable even before a matching catalog edition
// exists. Never fabricate an edition ID or expose library mutations for it.
export default function DiscoveryBookScreen() {
  const params = useLocalSearchParams<{ book?: string }>();
  const book = useMemo(() => parseDiscoveryBook(params.book), [params.book]);
  const router = useRouter();
  const { colors } = useNovoriTheme();
  const { width } = useWindowDimensions();
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!book) return;
    let active = true;
    setLoading(true);
    setFailed(false);
    void resolveDiscoveryBook(book).then(id => {
      if (!active) return;
      if (id) router.replace({ pathname: '/book/[id]', params: {
        id, source: 'discover', clickedTitle: book.title, clickedAuthors: JSON.stringify(book.authors),
        discoveryId: String(book.id), canonicalizeWork: '1',
        ...(book.coverUrl ? { coverUrl: book.coverUrl } : {}),
      } });
    }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [book, attempt, router]);
  const coverWidth = Math.min(240, Math.max(120, width * 0.46));
  const description = formatBookDescription(book?.description ?? '');
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <Text style={{ color: colors.gold }}>‹ Back</Text>
      </Pressable>
      {book ? <>
        <BookCoverImage {...discoveryCoverInput(book)} style={{ width: coverWidth, height: coverWidth * 1.5, alignSelf: 'center', borderRadius: 8 }} />
        <Text style={[styles.title, { color: colors.text }]}>{book.title}</Text>
        <Text style={[styles.author, { color: colors.mutedText }]}>{book.authors.join(', ') || 'Unknown author'}</Text>
        {book.releaseDate || book.releaseYear ? <Text style={[styles.author, { color: colors.mutedText }]}>Released {book.releaseDate ?? book.releaseYear}</Text> : null}
        {book.rating != null ? <Text style={[styles.author, { color: colors.gold }]}>★ {book.rating.toFixed(1)}</Text> : null}
        {description ? <Text style={[styles.description, { color: colors.text }]}>{description}</Text> : null}
        {loading ? <View style={styles.status}><ActivityIndicator color={colors.gold} /><Text style={{ color: colors.mutedText }}>Loading book details…</Text></View> :
          <View style={styles.status}>
            <Text style={[styles.message, { color: colors.mutedText }]}>{failed ? 'More details are temporarily unavailable. You can still view this book here.' : 'More details for this book aren’t available yet. You can still view its cover and release information here.'}</Text>
            <Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.retry}><Text style={{ color: colors.gold }}>Try again</Text></Pressable>
          </View>}
      </> : <Text style={[styles.message, { color: colors.text }]}>This book listing is unavailable. Please return to Discover.</Text>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  content: { padding: 24, gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  author: { fontSize: 16, textAlign: 'center' },
  description: { fontSize: 16, lineHeight: 25, marginTop: 16 },
  status: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  message: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20 },
});
