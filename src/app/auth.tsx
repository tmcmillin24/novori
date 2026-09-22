import { useRouter } from 'expo-router';
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

type AuthMode = 'sign-in' | 'sign-up';

const EMAIL_CONFIRM_REDIRECT = 'novori://auth-confirm';

export default function AuthScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === 'sign-up';

  async function handleSubmit() {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = displayName.trim();

    if (!trimmedEmail || !password) {
      Alert.alert(
        'Missing information',
        'Enter your email and password.'
      );
      return;
    }

    if (isSignUp && !trimmedName) {
      Alert.alert(
        'Missing name',
        'Enter the name you want displayed on Novori.'
      );
      return;
    }

    try {
      setLoading(true);

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: EMAIL_CONFIRM_REDIRECT,
            data: {
              display_name: trimmedName,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          router.replace('/(tabs)');
          return;
        }

        Alert.alert(
          'Check your email',
          'We sent you a confirmation link. Tap it to verify your email and return to Novori.'
        );

        setMode('sign-in');
        setPassword('');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        throw error;
      }

      router.replace('/(tabs)');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.';

      Alert.alert(
        isSignUp ? 'Could not create account' : 'Could not sign in',
        message
      );
    } finally {
      setLoading(false);
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
          <View style={styles.brandBlock}>
            <Text style={styles.logo}>
              Novori
            </Text>

            <Text style={styles.slogan}>
              Read. Discuss. Belong.
            </Text>
          </View>

          <View style={styles.authBlock}>
            <Text style={styles.title}>
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </Text>

            <Text style={styles.subtitle}>
              {isSignUp
                ? 'Build your reading profile and join the community.'
                : 'Sign in to continue to your reading world.'}
            </Text>

            {isSignUp ? (
              <TextInput
                style={styles.input}
                placeholder="Display name"
                placeholderTextColor={COLORS.mutedText}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="name"
              />
            ) : null}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={COLORS.mutedText}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={COLORS.mutedText}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={isSignUp ? 'newPassword' : 'password'}
            />

            <Pressable
              disabled={loading}
              onPress={handleSubmit}
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
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </Pressable>

            <Pressable
              disabled={loading}
              onPress={() => {
                setMode(isSignUp ? 'sign-in' : 'sign-up');
                setPassword('');
              }}
              style={({ pressed }) => [
                styles.switchButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.switchText}>
                {isSignUp
                  ? 'Already have an account? '
                  : 'New to Novori? '}
                <Text style={styles.switchTextGold}>
                  {isSignUp ? 'Sign in' : 'Create one'}
                </Text>
              </Text>
            </Pressable>
          </View>
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

  brandBlock: {
    alignItems: 'center',
    marginBottom: 42,
  },

  logo: {
    color: COLORS.gold,
    fontSize: 46,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.2,
  },

  slogan: {
    color: COLORS.secondaryText,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    marginTop: 6,
  },

  authBlock: {
    width: '100%',
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
    marginTop: 8,
    marginBottom: 24,
  },

  input: {
    minHeight: 52,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
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

  switchButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 12,
  },

  switchText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },

  switchTextGold: {
    color: COLORS.softGold,
    fontFamily: 'Inter_600SemiBold',
  },

  pressed: {
    opacity: 0.72,
  },

  disabled: {
    opacity: 0.6,
  },
});
