import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
    useEffect,
    useState,
} from 'react';

import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import {
    NovoriColors,
} from '../constants/novori-theme';

import {
    useNovoriTheme,
} from '../context/theme-context';

import {
    supabase,
} from '../lib/supabase';

export default function PasswordSecurityScreen() {
  const router = useRouter();

  const { colors } =
    useNovoriTheme();

  const styles =
    createStyles(colors);

  const [email, setEmail] =
    useState('');

  const [
    emailVerified,
    setEmailVerified,
  ] = useState(false);

  const [
    sending,
    setSending,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(() => {
    async function loadAccount() {
      const {
        data: { user },
        error,
      } =
        await supabase.auth.getUser();

      if (
        error ||
        !user
      ) {
        await supabase.auth.signOut();

        router.replace('/auth');

        return;
      }

      setEmail(
        user.email ?? ''
      );

      setEmailVerified(
        Boolean(
          user.email_confirmed_at
        )
      );

      setLoading(false);
    }

    loadAccount();
  }, [router]);

  async function sendResetEmail() {
    if (!email) {
      Alert.alert(
        'Email unavailable',
        'Novori could not find the email address associated with this account.'
      );

      return;
    }

    try {
      setSending(true);

      const redirectTo =
        'novori://reset-password';

      const { error } =
        await supabase.auth
          .resetPasswordForEmail(
            email,
            {
              redirectTo,
            }
          );

      if (error) {
        throw error;
      }

      Alert.alert(
        'Check your email',
        `We sent a password reset link to ${email}. Open the link to return to Novori and choose a new password.`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while sending the password reset email.';

      Alert.alert(
        'Could not send email',
        message
      );
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={[
          'top',
          'bottom',
        ]}
      >
        <View
          style={
            styles.loadingWrap
          }
        >
          <ActivityIndicator
            size="large"
            color={colors.gold}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={[
        'top',
        'bottom',
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() =>
            router.back()
          }
          hitSlop={10}
          style={({ pressed }) => [
            styles.backButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={colors.text}
          />
        </Pressable>

        <Text
          style={styles.headerTitle}
        >
          Password & Security
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <View style={styles.content}>
        <Text
          style={styles.sectionLabel}
        >
          ACCOUNT
        </Text>

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View
              style={styles.iconWrap}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={colors.gold}
              />
            </View>

            <View
              style={styles.infoText}
            >
              <Text
                style={
                  styles.infoTitle
                }
              >
                Email
              </Text>

              <Text
                style={
                  styles.infoValue
                }
              >
                {email}
              </Text>
            </View>
          </View>

          <View
            style={styles.divider}
          />

          <View style={styles.infoRow}>
            <View
              style={styles.iconWrap}
            >
              <Ionicons
                name={
                  emailVerified
                    ? 'checkmark-circle-outline'
                    : 'alert-circle-outline'
                }
                size={20}
                color={
                  emailVerified
                    ? colors.gold
                    : colors.danger
                }
              />
            </View>

            <View
              style={styles.infoText}
            >
              <Text
                style={
                  styles.infoTitle
                }
              >
                Email Verification
              </Text>

              <Text
                style={
                  styles.infoValue
                }
              >
                {emailVerified
                  ? 'Verified'
                  : 'Not verified'}
              </Text>
            </View>
          </View>
        </View>

        <Text
          style={styles.sectionLabel}
        >
          PASSWORD
        </Text>

        <View
          style={styles.resetCard}
        >
          <View
            style={
              styles.resetIcon
            }
          >
            <Ionicons
              name="key-outline"
              size={25}
              color={colors.gold}
            />
          </View>

          <Text
            style={styles.resetTitle}
          >
            Reset your password
          </Text>

          <Text
            style={styles.resetText}
          >
            Novori will send a secure
            password reset link to your
            verified email address.
          </Text>

          <Pressable
            disabled={sending}
            onPress={
              sendResetEmail
            }
            style={({ pressed }) => [
              styles.resetButton,
              pressed &&
                !sending &&
                styles.pressed,
              sending &&
                styles.disabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.background
                }
              />
            ) : (
              <>
                <Ionicons
                  name="paper-plane-outline"
                  size={18}
                  color={
                    colors.background
                  }
                />

                <Text
                  style={
                    styles.resetButtonText
                  }
                >
                  Send Reset Email
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <View
          style={styles.securityNote}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={18}
            color={
              colors.secondaryText
            }
          />

          <Text
            style={
              styles.securityNoteText
            }
          >
            Your password cannot be
            viewed from Novori. Password
            changes require access to
            your account email.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    header: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        colors.border,
    },

    backButton: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },

    headerTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 20,
      fontFamily:
        'PlayfairDisplay_700Bold',
      textAlign: 'center',
    },

    headerSpacer: {
      width: 42,
    },

    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 26,
    },

    sectionLabel: {
      color: colors.mutedText,
      fontSize: 11,
      letterSpacing: 0.9,
      fontFamily:
        'Inter_700Bold',
      marginTop: 10,
      marginBottom: 9,
      paddingHorizontal: 4,
    },

    card: {
      backgroundColor:
        colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        colors.border,
      overflow: 'hidden',
    },

    infoRow: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 15,
      paddingVertical: 12,
    },

    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 11,
      backgroundColor:
        colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 13,
    },

    infoText: {
      flex: 1,
    },

    infoTitle: {
      color: colors.text,
      fontSize: 14,
      fontFamily:
        'Inter_600SemiBold',
    },

    infoValue: {
      color:
        colors.secondaryText,
      fontSize: 13,
      fontFamily:
        'Inter_400Regular',
      marginTop: 4,
    },

    divider: {
      height: 1,
      backgroundColor:
        colors.border,
      marginLeft: 66,
    },

    resetCard: {
      backgroundColor:
        colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        colors.border,
      padding: 20,
      alignItems: 'center',
    },

    resetIcon: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor:
        colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 15,
    },

    resetTitle: {
      color: colors.text,
      fontSize: 21,
      fontFamily:
        'PlayfairDisplay_700Bold',
      textAlign: 'center',
    },

    resetText: {
      color:
        colors.secondaryText,
      fontSize: 13,
      lineHeight: 20,
      fontFamily:
        'Inter_400Regular',
      textAlign: 'center',
      marginTop: 8,
      maxWidth: 310,
    },

    resetButton: {
      width: '100%',
      minHeight: 50,
      borderRadius: 14,
      backgroundColor:
        colors.gold,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 20,
    },

    resetButtonText: {
      color:
        colors.background,
      fontSize: 14,
      fontFamily:
        'Inter_700Bold',
    },

    securityNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginTop: 20,
      paddingHorizontal: 8,
    },

    securityNoteText: {
      flex: 1,
      color: colors.mutedText,
      fontSize: 12,
      lineHeight: 18,
      fontFamily:
        'Inter_400Regular',
    },

    pressed: {
      opacity: 0.68,
    },

    disabled: {
      opacity: 0.6,
    },
  });
}