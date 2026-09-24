import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  COLORS,
} from '../constants/novori-theme';
import {
  supabase,
} from '../lib/supabase';

type ConfirmState =
  | 'loading'
  | 'error';

type RouteParams = {
  access_token?:
    | string
    | string[];
  refresh_token?:
    | string
    | string[];
  code?:
    | string
    | string[];
  token_hash?:
    | string
    | string[];
  type?:
    | string
    | string[];
  flow?:
    | string
    | string[];
  error?:
    | string
    | string[];
  error_description?:
    | string
    | string[];
};

function firstParam(
  value:
    | string
    | string[]
    | undefined
) {
  if (
    Array.isArray(
      value
    )
  ) {
    return (
      value[0] ??
      null
    );
  }

  return (
    value ??
    null
  );
}

function getUrlParams(
  url: string
) {
  const params =
    new URLSearchParams();

  const questionMarkIndex =
    url.indexOf('?');

  const hashIndex =
    url.indexOf('#');

  if (
    questionMarkIndex >=
    0
  ) {
    const queryEnd =
      hashIndex >=
      0
        ? hashIndex
        : url.length;

    const queryString =
      url.slice(
        questionMarkIndex +
          1,
        queryEnd
      );

    const queryParams =
      new URLSearchParams(
        queryString
      );

    queryParams.forEach(
      (
        value,
        key
      ) => {
        params.set(
          key,
          value
        );
      }
    );
  }

  if (
    hashIndex >=
    0
  ) {
    const hashString =
      url.slice(
        hashIndex + 1
      );

    const hashParams =
      new URLSearchParams(
        hashString
      );

    hashParams.forEach(
      (
        value,
        key
      ) => {
        params.set(
          key,
          value
        );
      }
    );
  }

  return params;
}

export default function AuthConfirmScreen() {
  const router =
    useRouter();

  const routeParams =
    useLocalSearchParams<RouteParams>();

  const [
    state,
    setState,
  ] =
    useState<ConfirmState>(
      'loading'
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      'Confirming your email...'
    );

  const serializedRouteParams =
    useMemo(
      () =>
        JSON.stringify({
          access_token:
            firstParam(
              routeParams.access_token
            ),
          refresh_token:
            firstParam(
              routeParams.refresh_token
            ),
          code:
            firstParam(
              routeParams.code
            ),
          token_hash:
            firstParam(
              routeParams.token_hash
            ),
          type:
            firstParam(
              routeParams.type
            ),
          flow:
            firstParam(
              routeParams.flow
            ),
          error:
            firstParam(
              routeParams.error
            ),
          error_description:
            firstParam(
              routeParams.error_description
            ),
        }),
      [
        routeParams.access_token,
        routeParams.refresh_token,
        routeParams.code,
        routeParams.token_hash,
        routeParams.type,
        routeParams.flow,
        routeParams.error,
        routeParams.error_description,
      ]
    );

  useEffect(() => {
    let active =
      true;

    let completed =
      false;

    async function finishSuccess(
      isRecovery:
        boolean
    ) {
      if (
        !active ||
        completed
      ) {
        return;
      }

      completed =
        true;

      if (
        isRecovery
      ) {
        setMessage(
          'Secure link confirmed. Opening password reset...'
        );

        setTimeout(
          () => {
            if (
              active
            ) {
              router.replace(
                '/reset-password'
              );
            }
          },
          250
        );

        return;
      }

      setMessage(
        'Email confirmed. Opening Novori...'
      );

      setTimeout(
        () => {
          if (
            active
          ) {
            router.replace(
              '/(tabs)'
            );
          }
        },
        400
      );
    }

    async function processValues(
      values: {
        accessToken?:
          string | null;
        refreshToken?:
          string | null;
        code?:
          string | null;
        tokenHash?:
          string | null;
        type?:
          string | null;
        flow?:
          string | null;
        error?:
          string | null;
        errorDescription?:
          string | null;
      }
    ) {
      if (
        completed
      ) {
        return false;
      }

      if (
        values.errorDescription ||
        values.error
      ) {
        throw new Error(
          values.errorDescription ||
            values.error ||
            'Email link failed.'
        );
      }

      const isRecovery =
        values.type ===
          'recovery' ||
        values.flow ===
          'recovery';

      if (
        values.accessToken &&
        values.refreshToken
      ) {
        const {
          error,
        } =
          await supabase.auth
            .setSession({
              access_token:
                values.accessToken,
              refresh_token:
                values.refreshToken,
            });

        if (
          error
        ) {
          throw error;
        }

        await finishSuccess(
          isRecovery
        );

        return true;
      }

      if (
        values.code
      ) {
        const {
          error,
        } =
          await supabase.auth
            .exchangeCodeForSession(
              values.code
            );

        if (
          error
        ) {
          throw error;
        }

        await finishSuccess(
          isRecovery
        );

        return true;
      }

      if (
        values.tokenHash &&
        values.type
      ) {
        const allowedTypes = [
          'signup',
          'invite',
          'magiclink',
          'recovery',
          'email_change',
          'email',
        ] as const;

        const safeType =
          allowedTypes.find(
            (
              allowedType
            ) =>
              allowedType ===
              values.type
          );

        if (
          !safeType
        ) {
          throw new Error(
            'The email link type is not supported.'
          );
        }

        const {
          error,
        } =
          await supabase.auth
            .verifyOtp({
              token_hash:
                values.tokenHash,
              type:
                safeType,
            });

        if (
          error
        ) {
          throw error;
        }

        await finishSuccess(
          safeType ===
            'recovery'
        );

        return true;
      }

      return false;
    }

    async function processRouteParams() {
      const parsed =
        JSON.parse(
          serializedRouteParams
        ) as {
          access_token:
            string | null;
          refresh_token:
            string | null;
          code:
            string | null;
          token_hash:
            string | null;
          type:
            string | null;
          flow:
            string | null;
          error:
            string | null;
          error_description:
            string | null;
        };

      return processValues({
        accessToken:
          parsed.access_token,
        refreshToken:
          parsed.refresh_token,
        code:
          parsed.code,
        tokenHash:
          parsed.token_hash,
        type:
          parsed.type,
        flow:
          parsed.flow,
        error:
          parsed.error,
        errorDescription:
          parsed.error_description,
      });
    }

    async function processUrl(
      url: string
    ) {
      const params =
        getUrlParams(
          url
        );

      return processValues({
        accessToken:
          params.get(
            'access_token'
          ),
        refreshToken:
          params.get(
            'refresh_token'
          ),
        code:
          params.get(
            'code'
          ),
        tokenHash:
          params.get(
            'token_hash'
          ),
        type:
          params.get(
            'type'
          ),
        flow:
          params.get(
            'flow'
          ),
        error:
          params.get(
            'error'
          ),
        errorDescription:
          params.get(
            'error_description'
          ),
      });
    }

    async function start() {
      try {
        const handledRoute =
          await processRouteParams();

        if (
          handledRoute
        ) {
          return;
        }

        const initialUrl =
          await Linking
            .getInitialURL();

        if (
          initialUrl
        ) {
          const handledUrl =
            await processUrl(
              initialUrl
            );

          if (
            handledUrl
          ) {
            return;
          }
        }

        // Give auth storage/state a brief chance to settle.
        await new Promise(
          (
            resolve
          ) =>
            setTimeout(
              resolve,
              350
            )
        );

        if (
          !active ||
          completed
        ) {
          return;
        }

        const {
          data: {
            session,
          },
          error:
            sessionError,
        } =
          await supabase.auth
            .getSession();

        if (
          sessionError
        ) {
          throw sessionError;
        }

        const parsed =
          JSON.parse(
            serializedRouteParams
          ) as {
            flow:
              string | null;
            type:
              string | null;
          };

        const isRecovery =
          parsed.flow ===
            'recovery' ||
          parsed.type ===
            'recovery';

        if (
          session
        ) {
          await finishSuccess(
            isRecovery
          );
          return;
        }

        setMessage(
          isRecovery
            ? 'The reset link opened Novori, but the secure recovery code was missing. Request a new password reset link and try again.'
            : 'Open the link from your Novori email to continue.'
        );

        setState(
          'error'
        );
      } catch (error) {
        if (
          !active
        ) {
          return;
        }

        const text =
          error instanceof Error
            ? error.message
            : 'We could not confirm this email link.';

        setMessage(
          text
        );

        setState(
          'error'
        );
      }
    }

    const authSubscription =
      supabase.auth
        .onAuthStateChange(
          (
            event,
            session
          ) => {
            if (
              !active ||
              completed ||
              !session
            ) {
              return;
            }

            if (
              event ===
              'PASSWORD_RECOVERY'
            ) {
              finishSuccess(
                true
              );
            }
          }
        )
        .data
        .subscription;

    const linkSubscription =
      Linking.addEventListener(
        'url',
        ({
          url,
        }) => {
          processUrl(
            url
          ).catch(
            (
              error
            ) => {
              if (
                !active
              ) {
                return;
              }

              setMessage(
                error instanceof Error
                  ? error.message
                  : 'We could not confirm this email link.'
              );

              setState(
                'error'
              );
            }
          );
        }
      );

    start();

    return () => {
      active =
        false;

      authSubscription.unsubscribe();
      linkSubscription.remove();
    };
  }, [
    router,
    serializedRouteParams,
  ]);

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
      <View
        style={
          styles.content
        }
      >
        {state ===
        'loading' ? (
          <ActivityIndicator
            size="large"
            color={
              COLORS.gold
            }
          />
        ) : (
          <View
            style={
              styles.errorIcon
            }
          >
            <Text
              style={
                styles.errorIconText
              }
            >
              !
            </Text>
          </View>
        )}

        <Text
          style={
            styles.title
          }
        >
          {state ===
          'loading'
            ? 'Almost there'
            : 'Link issue'}
        </Text>

        <Text
          style={
            styles.message
          }
        >
          {message}
        </Text>

        {state ===
        'error' ? (
          <Pressable
            onPress={() =>
              router.replace(
                '/forgot-password'
              )
            }
            style={({ pressed }) => [
              styles.button,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.buttonText
              }
            >
              Request New Link
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex:
        1,
      backgroundColor:
        COLORS.background,
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
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        24,
      paddingBottom:
        40,
    },

    errorIcon: {
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
    },

    errorIconText: {
      color:
        COLORS.gold,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        28,
    },

    title: {
      color:
        COLORS.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        28,
      marginTop:
        22,
      textAlign:
        'center',
    },

    message: {
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
      marginTop:
        10,
      maxWidth:
        400,
    },

    button: {
      minHeight:
        48,
      paddingHorizontal:
        22,
      borderRadius:
        14,
      backgroundColor:
        COLORS.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop:
        26,
    },

    buttonText: {
      color:
        COLORS.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        14,
    },

    pressed: {
      opacity:
        0.72,
    },
  });
