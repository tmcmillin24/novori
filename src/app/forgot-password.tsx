import { Ionicons } from '@expo/vector-icons';
import {
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import { useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../constants/novori-theme';
import { supabase } from '../lib/supabase';

const PASSWORD_RECOVERY_REDIRECT =
  'novori://auth-confirm?flow=recovery';

export default function ForgotPasswordScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      email?: string;
    }>();

  const initialEmail =
    typeof params.email ===
    'string'
      ? params.email
      : '';

  const [
    email,
    setEmail,
  ] =
    useState(
      initialEmail
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    sent,
    setSent,
  ] =
    useState(false);

  async function sendResetEmail() {
    const trimmedEmail =
      email
        .trim()
        .toLowerCase();

    if (!trimmedEmail) {
      Alert.alert(
        'Enter your email',
        'Enter the email address you use for Novori.'
      );
      return;
    }

    try {
      setLoading(
        true
      );

      const {
        error,
      } =
        await supabase.auth
          .resetPasswordForEmail(
            trimmedEmail,
            {
              redirectTo:
                PASSWORD_RECOVERY_REDIRECT,
            }
          );

      if (error) {
        throw error;
      }

      setSent(
        true
      );
    } catch (error) {
      console.error(
        'Could not send password reset email:',
        error
      );

      Alert.alert(
        'Could not send reset email',
        'Please try again in a moment.'
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
      edges={[
        'top',
        'bottom',
      ]}
    >
      <KeyboardAvoidingView
        style={
          styles.keyboardView
        }
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
        }
      >
        <View
          style={
            styles.header
          }
        >
          <Pressable
            onPress={() =>
              router.back()
            }
            hitSlop={
              10
            }
            style={({ pressed }) => [
              styles.backButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={
                24
              }
              color={
                COLORS.text
              }
            />
          </Pressable>

          <View
            style={
              styles.headerSpacer
            }
          />
        </View>

        <View
          style={
            styles.content
          }
        >
          <View
            style={
              styles.iconWrap
            }
          >
            <Ionicons
              name={
                sent
                  ? 'mail-open-outline'
                  : 'key-outline'
              }
              size={
                30
              }
              color={
                COLORS.gold
              }
            />
          </View>

          <Text
            style={
              styles.title
            }
          >
            {sent
              ? 'Check your email'
              : 'Reset your password'}
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            {sent
              ? 'If an account exists for that email, Novori has sent a password reset link. Open it on this device to choose a new password.'
              : 'Enter the email connected to your Novori account and we’ll send you a secure reset link.'}
          </Text>

          {!sent ? (
            <>
              <TextInput
                style={
                  styles.input
                }
                placeholder="Email"
                placeholderTextColor={
                  COLORS.mutedText
                }
                value={
                  email
                }
                onChangeText={
                  setEmail
                }
                autoCapitalize="none"
                autoCorrect={
                  false
                }
                keyboardType="email-address"
                textContentType="emailAddress"
                autoFocus={
                  !initialEmail
                }
                returnKeyType="send"
                onSubmitEditing={
                  sendResetEmail
                }
              />

              <Pressable
                disabled={
                  loading
                }
                onPress={
                  sendResetEmail
                }
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed &&
                    !loading &&
                    styles.pressed,
                  loading &&
                    styles.disabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      COLORS.background
                    }
                  />
                ) : (
                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    Send Reset Link
                  </Text>
                )}
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={() =>
                  router.replace(
                    '/auth'
                  )
                }
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Back to Sign In
                </Text>
              </Pressable>

              <Pressable
                disabled={
                  loading
                }
                onPress={
                  sendResetEmail
                }
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed &&
                    !loading &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  Send Again
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },
    keyboardView: {
      flex: 1,
    },
    header: {
      height:
        56,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        14,
    },
    backButton: {
      width:
        42,
      height:
        42,
      borderRadius:
        21,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    headerSpacer: {
      flex:
        1,
    },
    content: {
      flex:
        1,
      width:
        '100%',
      maxWidth:
        520,
      alignSelf:
        'center',
      justifyContent:
        'center',
      alignItems:
        'center',
      paddingHorizontal:
        24,
      paddingBottom:
        90,
    },
    iconWrap: {
      width:
        64,
      height:
        64,
      borderRadius:
        32,
      backgroundColor:
        COLORS.elevated,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom:
        20,
    },
    title: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        28,
      textAlign:
        'center',
    },
    subtitle: {
      color:
        COLORS.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        14,
      lineHeight:
        21,
      textAlign:
        'center',
      maxWidth:
        420,
      marginTop:
        9,
      marginBottom:
        24,
    },
    input: {
      width:
        '100%',
      minHeight:
        52,
      backgroundColor:
        COLORS.surface,
      color:
        COLORS.text,
      borderWidth:
        1,
      borderColor:
        COLORS.border,
      borderRadius:
        14,
      paddingHorizontal:
        16,
      fontSize:
        15,
      fontFamily:
        'Inter_400Regular',
      marginBottom:
        12,
    },
    primaryButton: {
      width:
        '100%',
      minHeight:
        52,
      borderRadius:
        14,
      backgroundColor:
        COLORS.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    primaryButtonText: {
      color:
        COLORS.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        15,
    },
    secondaryButton: {
      minHeight:
        44,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        12,
      marginTop:
        10,
    },
    secondaryButtonText: {
      color:
        COLORS.softGold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        13,
    },
    pressed: {
      opacity:
        0.72,
    },
    disabled: {
      opacity:
        0.6,
    },
  });
