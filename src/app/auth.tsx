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

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const USERNAME_PATTERN = /^[a-z0-9._]+$/;

export default function AuthScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === 'sign-up';

  async function handleSubmit() {
    const trimmedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      Alert.alert(
        'Missing information',
        'Enter your email and password.'
      );
      return;
    }

    if (isSignUp) {
      if (!normalizedUsername) {
        Alert.alert(
          'Choose a username',
          'Enter the username you want to use on Novori.'
        );
        return;
      }

      if (
        normalizedUsername.length < USERNAME_MIN_LENGTH ||
        normalizedUsername.length > USERNAME_MAX_LENGTH
      ) {
        Alert.alert(
          'Username length',
          `Your username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters.`
        );
        return;
      }

      if (!USERNAME_PATTERN.test(normalizedUsername)) {
        Alert.alert(
          'Invalid username',
          'Usernames can only contain lowercase letters, numbers, periods, and underscores.'
        );
        return;
      }

      if (
        normalizedUsername.startsWith('.') ||
        normalizedUsername.endsWith('.')
      ) {
        Alert.alert(
          'Invalid username',
          'Your username cannot start or end with a period.'
        );
        return;
      }

      if (normalizedUsername.includes('..')) {
        Alert.alert(
          'Invalid username',
          'Your username cannot contain two periods in a row.'
        );
        return;
      }

      if (password.length < 6) {
        Alert.alert(
          'Password too short',
          'Your password must be at least 6 characters.'
        );
        return;
      }
    }

    try {
      setLoading(true);

      if (isSignUp) {
        const { data: existingProfile, error: usernameCheckError } =
          await supabase
            .from('profiles')
            .select('id')
            .eq('username', normalizedUsername)
            .maybeSingle();

        if (usernameCheckError) {
          throw usernameCheckError;
        }

        if (existingProfile) {
          Alert.alert(
            'Username unavailable',
            `@${normalizedUsername} is already taken. Choose another username.`
          );
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: EMAIL_CONFIRM_REDIRECT,
            data: {
              username: normalizedUsername,
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

        router.push({
          pathname: '/confirm-email',
          params: {
            email: trimmedEmail,
          },
        });

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

  function switchMode() {
    setMode(isSignUp ? 'sign-in' : 'sign-up');
    setPassword('');
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
                ? 'Choose your permanent Novori username and join the community.'
                : 'Sign in to continue to your reading world.'}
            </Text>

            {isSignUp ? (
              <>
                <View style={styles.usernameInputRow}>
                  <Text style={styles.atSymbol}>
                    @
                  </Text>

                  <TextInput
                    style={styles.usernameInput}
                    placeholder="username"
                    placeholderTextColor={COLORS.mutedText}
                    value={username}
                    onChangeText={(value) =>
                      setUsername(
                        value
                          .toLowerCase()
                          .replace(/[^a-z0-9._]/g, '')
                          .slice(0, USERNAME_MAX_LENGTH)
                      )
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="username"
                    maxLength={USERNAME_MAX_LENGTH}
                  />
                </View>

                <Text style={styles.usernameHelp}>
                  3-20 characters. Letters, numbers, periods, and underscores only. Your username cannot be changed later.
                </Text>
              </>
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
              onPress={switchMode}
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

  usernameInputRow: {
    minHeight: 52,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  atSymbol: {
    color: COLORS.gold,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginRight: 2,
  },

  usernameInput: {
    flex: 1,
    minHeight: 50,
    color: COLORS.text,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 0,
  },

  usernameHelp: {
    color: COLORS.mutedText,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
    marginTop: 7,
    marginBottom: 12,
    paddingHorizontal: 2,
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
