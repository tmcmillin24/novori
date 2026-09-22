import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
    useEffect,
    useState,
} from 'react';

import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
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

export default function ResetPasswordScreen() {
  const router = useRouter();

  const { colors } =
    useNovoriTheme();

  const styles =
    createStyles(colors);

  const [
    checkingSession,
    setCheckingSession,
  ] = useState(true);

  const [
    recoveryReady,
    setRecoveryReady,
  ] = useState(false);

  const [
    newPassword,
    setNewPassword,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (
        mounted &&
        session
      ) {
        setRecoveryReady(true);
      }

      if (mounted) {
        setCheckingSession(false);
      }
    }

    checkSession();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth
        .onAuthStateChange(
          (
            event,
            session
          ) => {
            if (
              !mounted
            ) {
              return;
            }

            if (
              event ===
                'PASSWORD_RECOVERY' ||
              event ===
                'SIGNED_IN'
            ) {
              if (session) {
                setRecoveryReady(true);
                setCheckingSession(false);
              }
            }
          }
        );

    const timeout =
      setTimeout(
        async () => {
          if (!mounted) {
            return;
          }

          const {
            data: {
              session,
            },
          } =
            await supabase.auth
              .getSession();

          if (session) {
            setRecoveryReady(true);
          }

          setCheckingSession(false);
        },
        1200
      );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  async function savePassword() {
    if (
      newPassword.length < 8
    ) {
      Alert.alert(
        'Password too short',
        'Use at least 8 characters for your new password.'
      );

      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      Alert.alert(
        'Passwords do not match',
        'Enter the same password in both fields.'
      );

      return;
    }

    try {
      setSaving(true);

      const { error } =
        await supabase.auth
          .updateUser({
            password:
              newPassword,
          });

      if (error) {
        throw error;
      }

      Alert.alert(
        'Password updated',
        'Your Novori password has been changed successfully.',
        [
          {
            text: 'Continue',
            onPress: () =>
              router.replace(
                '/(tabs)'
              ),
          },
        ]
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while changing your password.';

      Alert.alert(
        'Could not update password',
        message
      );
    } finally {
      setSaving(false);
    }
  }

  if (checkingSession) {
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

          <Text
            style={
              styles.loadingText
            }
          >
            Verifying reset link…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!recoveryReady) {
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
            styles.invalidWrap
          }
        >
          <View
            style={
              styles.invalidIcon
            }
          >
            <Ionicons
              name="link-outline"
              size={30}
              color={colors.gold}
            />
          </View>

          <Text
            style={
              styles.invalidTitle
            }
          >
            Reset link unavailable
          </Text>

          <Text
            style={
              styles.invalidText
            }
          >
            This password reset link
            may have expired or could
            not be verified. Request a
            new link from Password &
            Security.
          </Text>

          <Pressable
            onPress={() =>
              router.replace(
                '/password-security'
              )
            }
            style={({ pressed }) => [
              styles.returnButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.returnButtonText
              }
            >
              Password & Security
            </Text>
          </Pressable>
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
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View style={styles.header}>
          <View
            style={
              styles.headerSpacer
            }
          />

          <Text
            style={
              styles.headerTitle
            }
          >
            New Password
          </Text>

          <View
            style={
              styles.headerSpacer
            }
          />
        </View>

        <View style={styles.content}>
          <View
            style={styles.keyIcon}
          >
            <Ionicons
              name="key-outline"
              size={29}
              color={colors.gold}
            />
          </View>

          <Text style={styles.title}>
            Choose a new password
          </Text>

          <Text
            style={styles.subtitle}
          >
            Enter the new password
            you want to use for your
            Novori account.
          </Text>

          <Text style={styles.label}>
            New password
          </Text>

          <View
            style={
              styles.passwordField
            }
          >
            <TextInput
              style={
                styles.passwordInput
              }
              value={newPassword}
              onChangeText={
                setNewPassword
              }
              placeholder="At least 8 characters"
              placeholderTextColor={
                colors.mutedText
              }
              secureTextEntry={
                !showPassword
              }
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
            />

            <Pressable
              onPress={() =>
                setShowPassword(
                  !showPassword
                )
              }
              hitSlop={10}
              style={
                styles.eyeButton
              }
            >
              <Ionicons
                name={
                  showPassword
                    ? 'eye-off-outline'
                    : 'eye-outline'
                }
                size={21}
                color={
                  colors.mutedText
                }
              />
            </Pressable>
          </View>

          <Text style={styles.label}>
            Confirm new password
          </Text>

          <View
            style={
              styles.passwordField
            }
          >
            <TextInput
              style={
                styles.passwordInput
              }
              value={
                confirmPassword
              }
              onChangeText={
                setConfirmPassword
              }
              placeholder="Enter it again"
              placeholderTextColor={
                colors.mutedText
              }
              secureTextEntry={
                !showPassword
              }
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
            />
          </View>

          <Pressable
            disabled={saving}
            onPress={savePassword}
            style={({ pressed }) => [
              styles.saveButton,
              pressed &&
                !saving &&
                styles.pressed,
              saving &&
                styles.disabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.background
                }
              />
            ) : (
              <Text
                style={
                  styles.saveButtonText
                }
              >
                Update Password
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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

    keyboardView: {
      flex: 1,
    },

    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
    },

    loadingText: {
      color:
        colors.secondaryText,
      fontSize: 14,
      fontFamily:
        'Inter_400Regular',
      marginTop: 14,
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
      maxWidth: 520,
      alignSelf: 'center',
      paddingHorizontal: 24,
      paddingTop: 42,
    },

    keyIcon: {
      width: 58,
      height: 58,
      borderRadius: 18,
      backgroundColor:
        colors.elevated,
      borderWidth: 1,
      borderColor:
        colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },

    title: {
      color: colors.text,
      fontSize: 27,
      lineHeight: 34,
      fontFamily:
        'PlayfairDisplay_700Bold',
      textAlign: 'center',
      marginTop: 20,
    },

    subtitle: {
      color:
        colors.secondaryText,
      fontSize: 14,
      lineHeight: 21,
      fontFamily:
        'Inter_400Regular',
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 22,
    },

    label: {
      color: colors.text,
      fontSize: 13,
      fontFamily:
        'Inter_600SemiBold',
      marginTop: 15,
      marginBottom: 8,
    },

    passwordField: {
      minHeight: 54,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
    },

    passwordInput: {
      flex: 1,
      minHeight: 52,
      color: colors.text,
      fontSize: 15,
      fontFamily:
        'Inter_400Regular',
      paddingHorizontal: 15,
    },

    eyeButton: {
      width: 50,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },

    saveButton: {
      minHeight: 52,
      borderRadius: 14,
      backgroundColor:
        colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 28,
    },

    saveButtonText: {
      color:
        colors.background,
      fontSize: 14,
      fontFamily:
        'Inter_700Bold',
    },

    invalidWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 30,
    },

    invalidIcon: {
      width: 62,
      height: 62,
      borderRadius: 20,
      backgroundColor:
        colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },

    invalidTitle: {
      color: colors.text,
      fontSize: 25,
      fontFamily:
        'PlayfairDisplay_700Bold',
      textAlign: 'center',
    },

    invalidText: {
      color:
        colors.secondaryText,
      fontSize: 14,
      lineHeight: 21,
      fontFamily:
        'Inter_400Regular',
      textAlign: 'center',
      maxWidth: 330,
      marginTop: 9,
    },

    returnButton: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor:
        colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 22,
      marginTop: 24,
    },

    returnButtonText: {
      color:
        colors.background,
      fontSize: 14,
      fontFamily:
        'Inter_700Bold',
    },

    pressed: {
      opacity: 0.68,
    },

    disabled: {
      opacity: 0.6,
    },
  });
}