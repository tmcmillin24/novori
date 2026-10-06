import { usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNovoriTheme } from "../context/theme-context";
import {
  acceptedCurrentTerms,
  legalAcceptanceMetadata,
} from "../lib/legal-documents";
import { supabase } from "../lib/supabase";
import { signOutCurrentDevice } from "../lib/sign-out";
import LegalSignupAcknowledgment from "./LegalSignupAcknowledgment";

// Existing readers must accept these published terms before interacting with the community.
// This is an age attestation, not a verified age or an authorization credential.
export default function LegalAcceptanceGate() {
  const pathname = usePathname(),
    router = useRouter(),
    { colors } = useNovoriTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [adult, setAdult] = useState(false),
    [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      sequence = 0;
    function receive(
      user: { id: string; user_metadata?: Record<string, unknown> } | undefined,
    ) {
      if (!active) return;
      setUserId(
        user && !acceptedCurrentTerms(user.user_metadata) ? user.id : null,
      );
      setAdult(false);
      setAccepted(false);
      setError("");
    }
    const initial = ++sequence;
    void supabase.auth.getSession().then(({ data }) => {
      if (initial === sequence) receive(data.session?.user);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      sequence++;
      receive(session?.user);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  async function accept() {
    if (busy || !adult || !accepted) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: legalAcceptanceMetadata(),
      });
      if (updateError) throw updateError;
      if (
        !data.user ||
        data.user.id !== userId ||
        !acceptedCurrentTerms(data.user.user_metadata)
      )
        throw new Error("Please sign in again and retry.");
      setUserId(null);
    } catch {
      setError(
        "Could not save your agreement. Please check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signOutCurrentDevice();
      router.replace("/auth");
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const excluded =
    pathname.startsWith("/legal/") ||
    [
      "/auth",
      "/auth-confirm",
      "/confirm-email",
      "/forgot-password",
      "/reset-password",
      "/delete-account",
      "/help-support",
    ].includes(pathname);
  const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    content: { flexGrow: 1, justifyContent: "center", padding: 24 },
    card: { width: "100%", maxWidth: 520, alignSelf: "center" },
    eyebrow: {
      color: colors.gold,
      fontFamily: "Inter_600SemiBold",
      fontSize: 11,
      letterSpacing: 1.5,
      marginBottom: 16,
    },
    title: {
      color: colors.text,
      fontFamily: "PlayfairDisplay_700Bold",
      fontSize: 30,
      lineHeight: 38,
      marginBottom: 18,
    },
    copy: {
      color: colors.secondaryText,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      lineHeight: 23,
      marginBottom: 16,
    },
    button: {
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: colors.gold,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 12,
    },
    buttonText: {
      color: colors.background,
      fontFamily: "Inter_600SemiBold",
      fontSize: 15,
    },
    link: {
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 8,
    },
    linkText: {
      color: colors.gold,
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
    },
    muted: { opacity: 0.45 },
    error: {
      color: colors.danger,
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      lineHeight: 21,
    },
  });
  return (
    <Modal supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']}
      visible={!!userId && !excluded}
      animationType="none"
      presentationStyle="fullScreen"
      onRequestClose={() => {}}
    >
      <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>WELCOME TO YOUR NEXT CHAPTER</Text>
            <Text accessibilityRole="header" style={styles.title}>
              A thoughtful community starts here.
            </Text>
            <Text style={styles.copy}>
              We’ve published Novori’s service terms and privacy policy. Please
              read them and confirm that you are 18 or older before continuing.
            </Text>
            <LegalSignupAcknowledgment
              adult={adult}
              accepted={accepted}
              onAdultChange={setAdult}
              onAcceptedChange={setAccepted}
              disabled={busy}
            />
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Agree and continue"
              disabled={busy || !adult || !accepted}
              style={[
                styles.button,
                (busy || !adult || !accepted) && styles.muted,
              ]}
              onPress={() => void accept()}
            >
              {busy ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.buttonText}>Agree and continue</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              style={styles.link}
              onPress={() => void leave()}
            >
              <Text style={styles.linkText}>Sign out</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              style={styles.link}
              onPress={() => router.push("/delete-account")}
            >
              <Text style={styles.linkText}>Manage or delete my account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
