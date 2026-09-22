import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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

export default function ConfirmEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const inputRef = useRef<TextInput>(null);

  const email =
    typeof params.email === 'string'
      ? params.email.trim().toLowerCase()
      : '';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const codeDigits = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => code[index] ?? '');
  }, [code]);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 250);

    return () => clearTimeout(timer);
  }, []);

  async function handleConfirm(codeToVerify = code) {
    const trimmedCode = codeToVerify.trim();

    if (loading) {
      return;
    }

    if (!email) {
      Alert.alert(
        'Missing email',
        'We could not determine which email address to verify. Return to sign in and try again.'
      );
      return;
    }

    if (!trimmedCode) {
      Alert.alert(
        'Enter your code',
        'Enter the 6-digit confirmation code from your email.'
      );
      return;
    }

    if (trimmedCode.length !== 6) {
      Alert.alert(
        'Invalid code',
        'Enter the full 6-digit confirmation code from your email.'
      );
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.verifyOtp({
        email,
        token: trimmedCode,
        type: 'email',
      });

      if (error) {
        throw error;
      }

      router.replace('/(tabs)');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'We could not confirm your email. Please try again.';

      Alert.alert('Could not confirm email', message);

      setCode('');

      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    } finally {
      setLoading(false);
    }
  }

  function handleCodeChange(value: string) {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);

    setCode(digitsOnly);

    if (digitsOnly.length === 6 && !loading) {
      setTimeout(() => {
        handleConfirm(digitsOnly);
      }, 100);
    }
  }

  function focusInput() {
    if (!loading) {
      inputRef.current?.focus();
    }
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.logo}>
            Novori
          </Text>

          <Text style={styles.title}>
            Check your email
          </Text>

          <Text style={styles.subtitle}>
            We sent a 6-digit confirmation code to
          </Text>

          <Text style={styles.email}>
            {email || 'your email address'}
          </Text>

          <Text style={styles.spamText}>
            If you do not see the email, check your Spam or Junk folder.
          </Text>

          <Pressable
            onPress={focusInput}
            style={styles.codeRow}
          >
            {codeDigits.map((digit, index) => {
              const isActive =
                !loading &&
                (code.length === index ||
                  (code.length === 6 && index === 5));

              return (
                <View
                  key={index}
                  style={[
                    styles.codeBox,
                    isActive && styles.codeBoxActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.codeBoxText,
                      !digit && styles.codePlaceholder,
                    ]}
                  >
                    {digit || '0'}
                  </Text>
                </View>
              );
            })}
          </Pressable>

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleCodeChange}
            editable={!loading}
            keyboardType="number-pad"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={6}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            style={styles.hiddenInput}
          />

          <Pressable
            disabled={loading}
            onPress={() => handleConfirm()}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && !loading && styles.pressed,
              loading && styles.disabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color={COLORS.background}
              />
            ) : (
              <Text style={styles.primaryButtonText}>
                Confirm Email
              </Text>
            )}
          </Pressable>

          <Pressable
            disabled={loading}
            onPress={() => router.replace('/auth')}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>
              Back to Sign In
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  keyboardView: {
    flex: 1,
  },

  content: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  logo: {
    color: COLORS.gold,
    fontSize: 44,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
    marginBottom: 36,
  },

  title: {
    color: COLORS.text,
    fontSize: 28,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
  },

  subtitle: {
    color: COLORS.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 10,
  },

  email: {
    color: COLORS.softGold,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    marginTop: 4,
  },

  spamText: {
    color: COLORS.mutedText,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
  },

  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },

  codeBox: {
    flex: 1,
    height: 62,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  codeBoxActive: {
    borderColor: COLORS.gold,
  },

  codeBoxText: {
    color: COLORS.text,
    fontSize: 24,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },

  codePlaceholder: {
    color: COLORS.mutedText,
  },

  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },

  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  primaryButtonText: {
    color: COLORS.background,
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },

  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  secondaryButtonText: {
    color: COLORS.softGold,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },

  pressed: {
    opacity: 0.72,
  },

  disabled: {
    opacity: 0.6,
  },
});
