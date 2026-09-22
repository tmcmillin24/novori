import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../constants/novori-theme';
import { supabase } from '../lib/supabase';

type ConfirmState = 'loading' | 'error';

function getUrlParams(url: string) {
  const params = new URLSearchParams();

  const questionMarkIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');

  if (questionMarkIndex >= 0) {
    const queryEnd = hashIndex >= 0 ? hashIndex : url.length;
    const queryString = url.slice(questionMarkIndex + 1, queryEnd);
    const queryParams = new URLSearchParams(queryString);

    queryParams.forEach((value, key) => {
      params.set(key, value);
    });
  }

  if (hashIndex >= 0) {
    const hashString = url.slice(hashIndex + 1);
    const hashParams = new URLSearchParams(hashString);

    hashParams.forEach((value, key) => {
      params.set(key, value);
    });
  }

  return params;
}

export default function AuthConfirmScreen() {
  const router = useRouter();

  const [state, setState] = useState<ConfirmState>('loading');
  const [message, setMessage] = useState('Confirming your email...');

  useEffect(() => {
    let active = true;
    let handledUrl: string | null = null;

    async function finishSuccess() {
      if (!active) {
        return;
      }

      setMessage('Email confirmed. Opening Novori...');

      setTimeout(() => {
        router.replace('/(tabs)');
      }, 500);
    }

    async function handleConfirmationUrl(url: string) {
      if (handledUrl === url) {
        return;
      }

      handledUrl = url;

      try {
        const params = getUrlParams(url);

        const errorDescription = params.get('error_description');
        const errorMessage = params.get('error');

        if (errorDescription || errorMessage) {
          throw new Error(
            errorDescription || errorMessage || 'Email confirmation failed.'
          );
        }

        // Supabase implicit flow:
        // novori://auth-confirm#access_token=...&refresh_token=...
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            throw error;
          }

          await finishSuccess();
          return;
        }

        // Supabase PKCE flow:
        // novori://auth-confirm?code=...
        const code = params.get('code');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }

          await finishSuccess();
          return;
        }

        // Supabase token-hash email template flow:
        // novori://auth-confirm?token_hash=...&type=signup
        const tokenHash = params.get('token_hash');
        const type = params.get('type');

        if (tokenHash && type) {
          const allowedTypes = [
            'signup',
            'invite',
            'magiclink',
            'recovery',
            'email_change',
            'email',
          ] as const;

          const safeType = allowedTypes.find(
            (allowedType) => allowedType === type
          );

          if (!safeType) {
            throw new Error('The confirmation link type is not supported.');
          }

          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: safeType,
          });

          if (error) {
            throw error;
          }

          await finishSuccess();
          return;
        }

        // It is also possible that the auth library already received
        // and stored the session before this screen finished loading.
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (session) {
          await finishSuccess();
          return;
        }

        throw new Error(
          'The confirmation link opened Novori, but it did not contain authentication information.'
        );
      } catch (error) {
        if (!active) {
          return;
        }

        const text =
          error instanceof Error
            ? error.message
            : 'We could not confirm your email.';

        setMessage(text);
        setState('error');
      }
    }

    async function start() {
      try {
        const initialUrl = await Linking.getInitialURL();

        if (initialUrl) {
          await handleConfirmationUrl(initialUrl);
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          await finishSuccess();
          return;
        }

        setMessage(
          'Open the confirmation link from your email to finish creating your account.'
        );
        setState('error');
      } catch (error) {
        if (!active) {
          return;
        }

        const text =
          error instanceof Error
            ? error.message
            : 'We could not confirm your email.';

        setMessage(text);
        setState('error');
      }
    }

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleConfirmationUrl(url);
    });

    start();

    return () => {
      active = false;
      subscription.remove();
    };
  }, [router]);

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'bottom']}
    >
      <View style={styles.content}>
        {state === 'loading' ? (
          <ActivityIndicator
            size="large"
            color={COLORS.gold}
          />
        ) : (
          <View style={styles.errorIcon}>
            <Text style={styles.errorIconText}>!</Text>
          </View>
        )}

        <Text style={styles.title}>
          {state === 'loading'
            ? 'Almost there'
            : 'Confirmation issue'}
        </Text>

        <Text style={styles.message}>
          {message}
        </Text>

        {state === 'error' ? (
          <Pressable
            onPress={() => router.replace('/auth')}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.buttonText}>
              Back to Sign In
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.elevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorIconText: {
    color: COLORS.gold,
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
  },

  title: {
    color: COLORS.text,
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    marginTop: 22,
    textAlign: 'center',
  },

  message: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 400,
  },

  button: {
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
  },

  buttonText: {
    color: COLORS.background,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },

  pressed: {
    opacity: 0.72,
  },
});
