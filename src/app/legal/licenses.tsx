import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsHeader } from "../../components/SettingsPrimitives";
import { useNovoriTheme } from "../../context/theme-context";
import notices from "../../generated/open-source-notices.json";
import { openNovoriWebsite } from "../../lib/support-links";

export default function OpenSourceLicensesScreen() {
  const { colors } = useNovoriTheme();
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const packages = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? notices.packages.filter((p) =>
          `${p.name} ${p.license}`.toLowerCase().includes(term),
        )
      : notices.packages;
  }, [query]);
  const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    content: {
      paddingHorizontal: 24,
      paddingBottom: 40,
      maxWidth: 800,
      width: "100%",
      alignSelf: "center",
    },
    title: {
      fontFamily: "PlayfairDisplay_700Bold",
      fontSize: 29,
      lineHeight: 37,
      color: colors.text,
      marginTop: 16,
      marginBottom: 14,
    },
    copy: {
      color: colors.secondaryText,
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      lineHeight: 22,
      marginBottom: 14,
    },
    link: { color: colors.gold, fontFamily: "Inter_600SemiBold", fontSize: 13 },
    linkButton: { minHeight: 44, justifyContent: "center", marginBottom: 8 },
    input: {
      color: colors.text,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      fontFamily: "Inter_400Regular",
      marginBottom: 24,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 68,
      paddingVertical: 14,
      borderTopColor: colors.border,
      borderTopWidth: 1,
    },
    name: {
      color: colors.text,
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
      lineHeight: 22,
    },
    meta: {
      color: colors.mutedText,
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      lineHeight: 19,
      marginTop: 4,
    },
    notice: {
      color: colors.secondaryText,
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      lineHeight: 20,
      paddingVertical: 12,
    },
  });
  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <SettingsHeader title="Novori legal" />
      <FlatList
        data={packages}
        initialNumToRender={12}
        keyExtractor={(p) => `${p.name}@${p.version}`}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              Open Source Licenses
            </Text>
            <Text style={styles.copy}>
              Built with care, and with the work of the open-source community.{" "}
              {notices.scope}
            </Text>
            <Text style={styles.copy}>
              Book data and covers may come from Google Books, Hardcover, and
              Open Library. Their content and APIs have separate terms and
              rights.
            </Text>
            <Pressable
              accessibilityRole="link"
              style={styles.linkButton}
              onPress={() =>
                void openNovoriWebsite("https://novori.link/licenses/")
              }
            >
              <Text style={styles.link}>
                View or download notices online ↗
              </Text>
            </Pressable>
            <TextInput
              accessibilityLabel="Search open-source licenses"
              placeholder="Search packages or licenses"
              placeholderTextColor={colors.mutedText}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.copy}>No matching packages.</Text>
        }
        renderItem={({ item }) => {
          const id = `${item.name}@${item.version}`,
            expanded = selected === id;
          return (
            <View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.license}`}
                accessibilityState={{ expanded }}
                onPress={() => setSelected(expanded ? null : id)}
                style={styles.row}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.version} · {item.license}
                  </Text>
                </View>
                <Ionicons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.gold}
                />
              </Pressable>
              {expanded
                ? item.notices.map((notice, i) => (
                    <View key={i}>
                      <Text style={styles.meta}>{notice.file}</Text>
                      <Text selectable style={styles.notice}>
                        {notice.text}
                      </Text>
                    </View>
                  ))
                : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
