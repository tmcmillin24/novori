import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNovoriTheme } from "../context/theme-context";
import BookCoverImage from "./BookCoverImage";
import type { CanonicalCoverInput } from "../lib/canonical-book-covers";
import { displayBookTitle } from "../lib/book-title";
type Props = {
  title?: string;
  authors?: string[];
  cover: CanonicalCoverInput;
  onBack: () => void;
  backLabel?: string;
  compact?: boolean;
};
/** Same hero geometry in both resolving routes; no separate splash-sized cover. */
export default function BookDetailLoading({
  title,
  authors = [],
  cover,
  onBack,
  backLabel = "Back",
  compact = false,
}: Props) {
  const { colors } = useNovoriTheme();
  const block = (width: number | string, height: number) => ({
    width: width as any,
    height,
    borderRadius: 8,
    backgroundColor: colors.elevated ?? colors.border,
  });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Back to ${backLabel}`}
          onPress={onBack}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={25} color={colors.text} />
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 15,
              color: colors.text,
            }}
          >
            {backLabel}
          </Text>
        </Pressable>
        <View
          style={styles.actions}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {[0, 1, 2].map((key) => (
            <View
              key={key}
              style={[
                styles.circle,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            />
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, compact && styles.compactHero]}>
          <BookCoverImage
            {...cover}
            resizeMode="cover"
            style={[
              styles.cover,
              compact && styles.compactCover,
              { backgroundColor: colors.elevated ?? colors.surface },
            ]}
          />
          <View style={compact ? styles.compactCopy : styles.copy}>
            {title ? (
              <Text
                style={[
                  styles.title,
                  compact && styles.compactTitle,
                  { color: colors.text },
                ]}
              >
                {displayBookTitle(title)}
              </Text>
            ) : (
              <View
                style={[
                  block("70%", 32),
                  { alignSelf: "center", marginTop: 24 },
                ]}
              />
            )}
            {authors.length ? (
              <Text
                style={[
                  styles.author,
                  compact && {
                    fontSize: 13,
                    lineHeight: 18,
                    marginTop: 8,
                    textAlign: "left",
                  },
                  { color: compact ? colors.secondaryText : colors.gold },
                ]}
              >
                {authors.join(", ")}
              </Text>
            ) : (
              <View
                style={[block(130, 16), { alignSelf: "center", marginTop: 10 }]}
              />
            )}
            <View
              style={styles.progress}
              accessibilityRole="progressbar"
              accessibilityLabel="Loading book details"
            >
              <ActivityIndicator size="small" color={colors.gold} />
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: colors.mutedText,
                }}
              >
                Loading book details…
              </Text>
            </View>
          </View>
        </View>
        <View
          style={styles.skeleton}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <View style={styles.row}>
            <View style={block("48%", 42)} />
            <View style={block("48%", 42)} />
          </View>
          <View style={block("60%", 24)} />
          <View style={styles.row}>
            {[0, 1, 2, 3].map((key) => (
              <View key={key} style={block("23%", 70)} />
            ))}
          </View>
          <View style={block("100%", 90)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  actions: { flexDirection: "row", gap: 6 },
  circle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 60 },
  hero: { alignItems: "center", paddingTop: 12 },
  cover: { width: 155, height: 232, borderRadius: 10 },
  copy: { alignSelf: "stretch", alignItems: "center" },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 30,
    lineHeight: 37,
    textAlign: "center",
    marginTop: 24,
  },
  author: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    textAlign: "center",
    marginTop: 10,
  },
  progress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    minHeight: 24,
  },
  skeleton: { marginTop: 18, gap: 20, opacity: 0.55 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  compactHero: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  compactCover: { width: 108, height: 162, borderRadius: 12 },
  compactCopy: { flex: 1, minWidth: 0, paddingTop: 5 },
  compactTitle: {
    fontSize: 27,
    lineHeight: 32,
    marginTop: 0,
    textAlign: "left",
  },
});
