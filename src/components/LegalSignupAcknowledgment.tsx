import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNovoriTheme } from "../context/theme-context";

export default function LegalSignupAcknowledgment({
  adult,
  accepted,
  onAdultChange,
  onAcceptedChange,
  disabled = false,
}: {
  adult: boolean;
  accepted: boolean;
  onAdultChange: (value: boolean) => void;
  onAcceptedChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const { colors } = useNovoriTheme();
  const styles = StyleSheet.create({
    block: { marginTop: 8 },
    row: { flexDirection: "row", alignItems: "center", minHeight: 48, gap: 12 },
    copy: {
      flex: 1,
      color: colors.secondaryText,
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      lineHeight: 20,
    },
    links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 20, marginVertical: 12 },
    link: { minHeight: 44, justifyContent: "center" },
    linkText: {
      color: colors.gold,
      fontFamily: "Inter_600SemiBold",
      fontSize: 12,
    },
  });
  return (
    <View style={styles.block}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="I confirm I am 18 or older"
        accessibilityState={{ checked: adult, disabled }}
        disabled={disabled}
        style={styles.row}
        onPress={() => onAdultChange(!adult)}
      >
        <Ionicons
          name={adult ? "checkbox" : "square-outline"}
          size={22}
          color={colors.gold}
        />
        <Text style={styles.copy}>I confirm that I am 18 or older.</Text>
      </Pressable>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="I agree to the Terms of Service and acknowledge the Privacy Policy"
        accessibilityState={{ checked: accepted, disabled }}
        disabled={disabled}
        style={styles.row}
        onPress={() => onAcceptedChange(!accepted)}
      >
        <Ionicons
          name={accepted ? "checkbox" : "square-outline"}
          size={22}
          color={colors.gold}
        />
        <Text style={styles.copy}>
          I agree to the Terms of Service and acknowledge the Privacy Policy.
        </Text>
      </Pressable>
      <View style={styles.links}>
        <Pressable
          accessibilityRole="link"
          style={styles.link}
          onPress={() => router.push("/legal/terms")}
        >
          <Text style={styles.linkText}>Terms of Service</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          style={styles.link}
          onPress={() => router.push("/legal/privacy")}
        >
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Pressable>
      </View>
    </View>
  );
}
