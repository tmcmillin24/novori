import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type ImageProps } from 'react-native';
import BookCoverImage from './BookCoverImage';
import { discoveryCoverInput, getDiscoveryBookVersion, subscribeDiscoveryBooks, type DiscoveryBook } from '../lib/discovery-books';
import { getCanonicalBookCover, subscribeCanonicalBookCovers } from '../lib/canonical-book-covers';
import { loadDiscoveryCover } from '../lib/resolve-discovery-book';
import { useNovoriTheme } from '../context/theme-context';

export default function DiscoveryCoverImage({ book, style }: { book: DiscoveryBook; style?: ImageProps['style'] }) {
 useSyncExternalStore(subscribeDiscoveryBooks, getDiscoveryBookVersion, getDiscoveryBookVersion);
 const input = discoveryCoverInput(book);
 const url = useSyncExternalStore(subscribeCanonicalBookCovers, () => getCanonicalBookCover(input), () => null);
 const { colors } = useNovoriTheme();
 const [loading, setLoading] = useState(true);
 useEffect(() => {
  let active = true;
  setLoading(true);
  void loadDiscoveryCover(book).catch(() => {}).finally(() => { if (active) setLoading(false); });
  return () => { active = false; };
 }, [book.id, book.title, book.coverBookId, book.coverUrl]);
 return <View style={[style, { overflow: 'hidden' }]}>
  <BookCoverImage {...input} style={StyleSheet.absoluteFill} />
  {!url ? <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }]}>
   {loading ? <ActivityIndicator color={colors.gold} /> : <Text style={{ color: colors.mutedText, fontSize: 11 }}>No Cover</Text>}
  </View> : null}
 </View>;
}
