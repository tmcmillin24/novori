import {
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  useFonts as usePlayfairFonts,
} from '@expo-google-fonts/playfair-display';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInterFonts,
} from '@expo-google-fonts/inter';

import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import {
  useEffect,
} from 'react';

import {
  Linking,
  View,
} from 'react-native';

import {
  NovoriThemeProvider,
  useNovoriTheme,
} from '../context/theme-context';

import { supabase } from '../lib/supabase';

SplashScreen.preventAutoHideAsync();

function getUrlParameters(
  url: string
) {
  const parameters: Record<
    string,
    string
  > = {};

  const questionMarkIndex =
    url.indexOf('?');

  const hashIndex =
    url.indexOf('#');

  const sections: string[] = [];

  if (questionMarkIndex !== -1) {
    const end =
      hashIndex !== -1
        ? hashIndex
        : url.length;

    sections.push(
      url.substring(
        questionMarkIndex + 1,
        end
      )
    );
  }

  if (hashIndex !== -1) {
    sections.push(
      url.substring(
        hashIndex + 1
      )
    );
  }

  sections.forEach((section) => {
    section
      .split('&')
      .forEach((part) => {
        if (!part) {
          return;
        }

        const [rawKey, ...valueParts] =
          part.split('=');

        const rawValue =
          valueParts.join('=');

        if (!rawKey) {
          return;
        }

        parameters[
          decodeURIComponent(rawKey)
        ] =
          decodeURIComponent(
            rawValue ?? ''
          );
      });
  });

  return parameters;
}

async function handleAuthDeepLink(
  url: string
) {
  if (
    !url.includes(
      'reset-password'
    )
  ) {
    return;
  }

  const params =
    getUrlParameters(url);

  const accessToken =
    params.access_token;

  const refreshToken =
    params.refresh_token;

  if (
    !accessToken ||
    !refreshToken
  ) {
    return;
  }

  const { error } =
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

  if (error) {
    console.error(
      'Could not create password recovery session:',
      error.message
    );
  }
}

function AppNavigator() {
  const {
    colors,
    ready,
  } = useNovoriTheme();

  useEffect(() => {
    let mounted = true;

    async function checkInitialUrl() {
      const initialUrl =
        await Linking.getInitialURL();

      if (
        mounted &&
        initialUrl
      ) {
        await handleAuthDeepLink(
          initialUrl
        );
      }
    }

    checkInitialUrl();

    const subscription =
      Linking.addEventListener(
        'url',
        ({ url }) => {
          handleAuthDeepLink(url);
        }
      );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor:
            colors.background,
        }}
      />
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor:
          colors.background,
      }}
    >
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor:
              colors.background,
          },
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  const [playfairLoaded] =
    usePlayfairFonts({
      PlayfairDisplay_600SemiBold,
      PlayfairDisplay_700Bold,
    });

  const [interLoaded] =
    useInterFonts({
      Inter_400Regular,
      Inter_500Medium,
      Inter_600SemiBold,
      Inter_700Bold,
    });

  const appReady =
    playfairLoaded &&
    interLoaded;

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) {
    return null;
  }

  return (
    <NovoriThemeProvider>
      <AppNavigator />
    </NovoriThemeProvider>
  );
}