import { useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsHeader } from "../../components/SettingsPrimitives";
import { useNovoriTheme } from "../../context/theme-context";
import { getLegalDocument, LEGAL_UPDATED } from "../../lib/legal-documents";
import { openNovoriWebsite } from "../../lib/support-links";

export default function LegalDocumentScreen() {
  const { document } = useLocalSearchParams<{ document: string }>();
  const policy = getLegalDocument(document);
  const { colors } = useNovoriTheme();
  const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 40,
      maxWidth: '100%',
      width: "100%",
      alignSelf: "center",
    },
    intro: {
      paddingTop: 18,
      paddingBottom: 26,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 28,
    },
    title: {
      color: colors.text,
      fontFamily: "PlayfairDisplay_700Bold",
      fontSize: 30,
      lineHeight: 38,
      marginBottom: 12,
    },
    summary: {
      color: colors.secondaryText,
      fontFamily: "Inter_400Regular",
      fontSize: 15,
      lineHeight: 24,
    },
    date: {
      color: colors.mutedText,
      fontFamily: "Inter_500Medium",
      fontSize: 12,
      marginTop: 16,
    },
    section: { marginBottom: 26 },
    heading: {
      color: colors.text,
      fontFamily: "Inter_600SemiBold",
      fontSize: 17,
      lineHeight: 25,
      marginBottom: 12,
    },
    paragraph: {
      color: colors.secondaryText,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      lineHeight: 23,
      marginBottom: 12,
    },
    link: {
      color: colors.gold,
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
      lineHeight: 22,
    },
    linkButton: {
      minHeight: 44,
      justifyContent: "center",
      alignSelf: "flex-start",
    },
  });
  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <SettingsHeader title="Novori legal" />
      <FlatList
        data={policy?.sections ?? []}
        keyExtractor={(item) => item.title}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text accessibilityRole="header" style={styles.title}>
              {policy?.title ?? "Document unavailable"}
            </Text>
            <Text style={styles.summary}>
              {policy?.summary ?? "Go back to choose a Novori legal document."}
            </Text>
            {policy ? (
              <Text style={styles.date}>
                Effective {LEGAL_UPDATED} · Tristan McMillin
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.heading}>
              {item.title}
            </Text>
            {item.paragraphs.map((paragraph, index) => (
              <Text selectable key={index} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
            {item.links?.map((link) => (
              <Pressable
                key={link.url}
                accessibilityRole="link"
                accessibilityLabel={link.label}
                style={styles.linkButton}
                onPress={() => void openNovoriWebsite(link.url)}
              >
                <Text style={styles.link}>{link.label} ↗</Text>
              </Pressable>
            ))}
          </View>
        )}
      />
    </SafeAreaView>
  );
}
