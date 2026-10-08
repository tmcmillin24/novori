import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
import type { GoogleBookSearchItem } from '../lib/book-search';

/** Display existing search metadata without issuing another provider request. */
export default function BookSearchRatings({ book }: { book: GoogleBookSearchItem }) {
  const { colors } = useNovoriTheme();
  const work = book.novoriWork;
  const rating = work?.hardcoverRating;
  const hasRating = typeof rating === 'number' && Number.isFinite(rating);
  const counts = [
    [work?.hardcoverRatingsCount, 'rating'],
    [work?.hardcoverReviewsCount, 'review'],
  ] as const;
  const labels = counts.flatMap(([count, label]) =>
    typeof count === 'number' && Number.isFinite(count) && count >= 0
      ? [`${count.toLocaleString()} ${label}${count === 1 ? '' : 's'}`]
      : []
  );
  if (!hasRating && !labels.length) return null;
  return (
    <View style={styles.container}>
      {hasRating ? (
        <View style={styles.stars} accessible accessibilityLabel={`${rating} out of 5 stars`}>
          {[1, 2, 3, 4, 5].map(star => (
            <Ionicons key={star} name={rating >= star ? 'star' : rating >= star - 0.5 ? 'star-half' : 'star-outline'} size={13} color={colors.gold} accessible={false} />
          ))}
        </View>
      ) : null}
      {labels.length ? <Text style={[styles.counts, { color: colors.mutedText }]}>{labels.join(' · ')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 4, marginBottom: 2, gap: 3 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  counts: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
