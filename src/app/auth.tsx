import { useRouter } from 'expo-router';
import {
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
import { supabase } from '../lib/supabase';

type AuthMode = 'sign-in' | 'sign-up';

const EMAIL_CONFIRM_REDIRECT = 'novori://auth-confirm';

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const USERNAME_PATTERN = /^[a-z0-9._]+$/;

export default function AuthScreen() {
  const { colors } = useNovoriTheme();
  const styles = createStyles(colors);
  const router = useRouter();

  const [mode, setMode] =
    useState<AuthMode>('sign-in');
  const [
    displayName,
    setDisplayName,
  ] =
    useState('');
  const [username, setUsername] =
    useState('');
  const [email, setEmail] =
    useState('');
  const [password, setPassword] =
    useState('');
  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState('');
  const [loading, setLoading] =
    useState(false);

  const [
    keyboardVisible,
    setKeyboardVisible,
  ] =
    useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios'
        ? 'keyboardWillShow'
        : 'keyboardDidShow';

    const hideEvent =
      Platform.OS === 'ios'
        ? 'keyboardWillHide'
        : 'keyboardDidHide';

    const showSubscription =
      Keyboard.addListener(
        showEvent,
        () =>
          setKeyboardVisible(
            true
          )
      );

    const hideSubscription =
      Keyboard.addListener(
        hideEvent,
        () =>
          setKeyboardVisible(
            false
          )
      );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const isSignUp =
    mode === 'sign-up';

  async function handleSubmit() {
    const trimmedEmail =
      email.trim().toLowerCase();

    const normalizedUsername =
      username.trim().toLowerCase();

    const trimmedDisplayName =
      displayName.trim();

    if (!trimmedEmail || !password) {
      Alert.alert(
        'Missing information',
        'Enter your email and password.'
      );
      return;
    }

    if (isSignUp) {
      if (!trimmedDisplayName) {
        Alert.alert(
          'Enter a display name',
          'Enter the name you want other readers to see on Novori.'
        );
        return;
      }

      if (
        trimmedDisplayName.length >
        50
      ) {
        Alert.alert(
          'Display name too long',
          'Your display name must be 50 characters or fewer.'
        );
        return;
      }

      if (!normalizedUsername) {
        Alert.alert(
          'Choose a username',
          'Enter the username you want to use on Novori.'
        );
        return;
      }

      if (
        normalizedUsername.length <
          USERNAME_MIN_LENGTH ||
        normalizedUsername.length >
          USERNAME_MAX_LENGTH
      ) {
        Alert.alert(
          'Username length',
          `Your username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters.`
        );
        return;
      }

      if (
        !USERNAME_PATTERN.test(
          normalizedUsername
        )
      ) {
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

      if (
        normalizedUsername.includes('..')
      ) {
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

      if (
        password !==
        confirmPassword
      ) {
        Alert.alert(
          'Passwords do not match',
          'Enter the same password in both password fields.'
        );
        return;
      }
    }

    try {
      setLoading(true);

      if (isSignUp) {
        const {
          data: existingProfile,
          error: usernameCheckError,
        } =
          await supabase
            .from('profiles')
            .select('id')
            .eq(
              'username',
              normalizedUsername
            )
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

        const {
          data,
          error,
        } =
          await supabase.auth.signUp({
            email:
              trimmedEmail,
            password,
            options: {
              emailRedirectTo:
                EMAIL_CONFIRM_REDIRECT,
              data: {
                username:
                  normalizedUsername,
                display_name:
                  trimmedDisplayName,
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
          pathname:
            '/confirm-email',
          params: {
            email:
              trimmedEmail,
          },
        });

        setPassword('');
        setConfirmPassword('');
        return;
      }

      const {
        error,
      } =
        await supabase.auth
          .signInWithPassword({
            email:
              trimmedEmail,
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
        isSignUp
          ? 'Could not create account'
          : 'Could not sign in',
        message
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setMode(
      isSignUp
        ? 'sign-in'
        : 'sign-up'
    );
    setPassword('');
    setConfirmPassword('');

    if (isSignUp) {
      setDisplayName('');
      setUsername('');
    }
  }

  function openForgotPassword() {
    const trimmedEmail =
      email.trim().toLowerCase();

    router.push({
      pathname:
        '/forgot-password',
      params:
        trimmedEmail
          ? {
              email:
                trimmedEmail,
            }
          : {},
    });
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
      <ScrollView
        style={
          styles.keyboardView
        }
        contentContainerStyle={[
          styles.scrollContent,
          keyboardVisible &&
            styles.scrollContentKeyboard,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={
          Platform.OS ===
          'ios'
            ? 'interactive'
            : 'on-drag'
        }
        automaticallyAdjustKeyboardInsets={
          Platform.OS ===
          'ios'
        }
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.content
          }
        >
          <View
            style={
              styles.brandBlock
            }
          >
            <Text
              style={
                styles.logo
              }
            >
              Novori
            </Text>

            <Text
              style={
                styles.slogan
              }
            >
              Read. Discuss. Belong.
            </Text>
          </View>

          <View
            style={
              styles.authBlock
            }
          >
            <Text
              style={
                styles.title
              }
            >
              {isSignUp
                ? 'Create your account'
                : 'Welcome back'}
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              {isSignUp
                ? 'Choose how you’ll appear on Novori and create your account.'
                : 'Sign in to continue to your reading world.'}
            </Text>

            {isSignUp ? (
              <>
                <TextInput
                  style={
                    styles.input
                  }
                  placeholder="Display name"
                  placeholderTextColor={
                    colors.mutedText
                  }
                  value={
                    displayName
                  }
                  onChangeText={(
                    value
                  ) =>
                    setDisplayName(
                      value.slice(
                        0,
                        50
                      )
                    )
                  }
                  autoCapitalize="words"
                  autoCorrect
                  textContentType="name"
                  maxLength={
                    50
                  }
                />

                <View
                  style={
                    styles.usernameInputRow
                  }
                >
                  <Text
                    style={
                      styles.atSymbol
                    }
                  >
                    @
                  </Text>

                  <TextInput
                    style={
                      styles.usernameInput
                    }
                    placeholder="username"
                    placeholderTextColor={
                      colors.mutedText
                    }
                    value={
                      username
                    }
                    onChangeText={(
                      value
                    ) =>
                      setUsername(
                        value
                          .toLowerCase()
                          .replace(
                            /[^a-z0-9._]/g,
                            ''
                          )
                          .slice(
                            0,
                            USERNAME_MAX_LENGTH
                          )
                      )
                    }
                    autoCapitalize="none"
                    autoCorrect={
                      false
                    }
                    textContentType="username"
                    maxLength={
                      USERNAME_MAX_LENGTH
                    }
                  />
                </View>

                <Text
                  style={
                    styles.usernameHelp
                  }
                >
                  3-20 characters. Letters, numbers, periods, and underscores only. Your username cannot be changed later.
                </Text>
              </>
            ) : null}

            <TextInput
              style={
                styles.input
              }
              placeholder="Email"
              placeholderTextColor={
                colors.mutedText
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
            />

            <TextInput
              style={[
                styles.input,
                !isSignUp &&
                  styles.passwordInputSignIn,
              ]}
              placeholder="Password"
              placeholderTextColor={
                colors.mutedText
              }
              value={
                password
              }
              onChangeText={
                setPassword
              }
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={
                false
              }
              textContentType={
                isSignUp
                  ? 'newPassword'
                  : 'password'
              }
            />

            {isSignUp ? (
              <TextInput
                style={
                  styles.input
                }
                placeholder="Confirm password"
                placeholderTextColor={
                  colors.mutedText
                }
                value={
                  confirmPassword
                }
                onChangeText={
                  setConfirmPassword
                }
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={
                  false
                }
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={
                  handleSubmit
                }
              />
            ) : null}

            {!isSignUp ? (
              <Pressable
                disabled={
                  loading
                }
                onPress={
                  openForgotPassword
                }
                hitSlop={
                  8
                }
                style={({ pressed }) => [
                  styles.forgotButton,
                  pressed &&
                    !loading &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.forgotText
                  }
                >
                  Forgot password?
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              disabled={
                loading
              }
              onPress={
                handleSubmit
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
                    colors.background
                  }
                />
              ) : (
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  {isSignUp
                    ? 'Create Account'
                    : 'Sign In'}
                </Text>
              )}
            </Pressable>

            <Pressable
              disabled={
                loading
              }
              onPress={
                switchMode
              }
              style={({ pressed }) => [
                styles.switchButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.switchText
                }
              >
                {isSignUp
                  ? 'Already have an account? '
                  : 'New to Novori? '}
                <Text
                  style={
                    styles.switchTextGold
                  }
                >
                  {isSignUp
                    ? 'Sign in'
                    : 'Create one'}
                </Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: NovoriColors) => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    keyboardView: {
      flex: 1,
    },

    scrollContent: {
      flexGrow: 1,
      justifyContent:
        'center',
    },

    scrollContentKeyboard: {
      justifyContent:
        'flex-start',
    },

    content: {
      width: '100%',
      maxWidth: 520,
      alignSelf:
        'center',
      paddingHorizontal:
        24,
      paddingTop:
        24,
      paddingBottom:
        40,
    },

    brandBlock: {
      alignItems:
        'center',
      marginBottom:
        42,
    },

    logo: {
      color:
        colors.gold,
      fontSize:
        46,
      fontFamily:
        'PlayfairDisplay_700Bold',
      letterSpacing:
        0.2,
    },

    slogan: {
      color:
        colors.secondaryText,
      fontSize:
        15,
      fontFamily:
        'Inter_500Medium',
      marginTop:
        6,
    },

    authBlock: {
      width:
        '100%',
    },

    title: {
      color:
        colors.text,
      fontSize:
        28,
      fontFamily:
        'PlayfairDisplay_700Bold',
      textAlign:
        'center',
    },

    subtitle: {
      color:
        colors.secondaryText,
      fontSize:
        14,
      lineHeight:
        21,
      fontFamily:
        'Inter_400Regular',
      textAlign:
        'center',
      marginTop:
        8,
      marginBottom:
        24,
    },

    input: {
      minHeight:
        52,
      backgroundColor:
        colors.surface,
      color:
        colors.text,
      borderWidth:
        1,
      borderColor:
        colors.border,
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

    passwordInputSignIn: {
      marginBottom:
        4,
    },

    forgotButton: {
      alignSelf:
        'flex-end',
      minHeight:
        34,
      justifyContent:
        'center',
      paddingHorizontal:
        2,
      marginBottom:
        6,
    },

    forgotText: {
      color:
        colors.softGold,
      fontSize:
        12,
      fontFamily:
        'Inter_600SemiBold',
    },

    usernameInputRow: {
      minHeight:
        52,
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        14,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        16,
    },

    atSymbol: {
      color:
        colors.gold,
      fontSize:
        15,
      fontFamily:
        'Inter_600SemiBold',
      marginRight:
        2,
    },

    usernameInput: {
      flex: 1,
      minHeight:
        50,
      color:
        colors.text,
      fontSize:
        15,
      fontFamily:
        'Inter_400Regular',
      paddingVertical:
        0,
    },

    usernameHelp: {
      color:
        colors.mutedText,
      fontSize:
        12,
      lineHeight:
        18,
      fontFamily:
        'Inter_400Regular',
      marginTop:
        7,
      marginBottom:
        12,
      paddingHorizontal:
        2,
    },

    primaryButton: {
      minHeight:
        52,
      borderRadius:
        14,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop:
        4,
    },

    primaryButtonText: {
      color:
        colors.background,
      fontSize:
        15,
      fontFamily:
        'Inter_700Bold',
    },

    switchButton: {
      alignItems:
        'center',
      justifyContent:
        'center',
      minHeight:
        48,
      marginTop:
        12,
    },

    switchText: {
      color:
        colors.secondaryText,
      fontSize:
        14,
      fontFamily:
        'Inter_400Regular',
    },

    switchTextGold: {
      color:
        colors.softGold,
      fontFamily:
        'Inter_600SemiBold',
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
