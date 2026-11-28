import BrowsingNavigation from '../components/BrowsingNavigation';
import PushNotificationDeviceSync from '../components/PushNotificationDeviceSync';
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
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import AccountDeletionGate from '../components/AccountDeletionGate';
import LegalAcceptanceGate from '../components/LegalAcceptanceGate';
import TutorialGate from '../components/TutorialGate';
import TutorialOverlay from '../components/TutorialOverlay';
import {TutorialProvider,TutorialBackground} from '../context/tutorial-context';
import LaunchTrace from '../components/LaunchTrace';
import ConversationHandoffOverlay from '../components/ConversationHandoffOverlay';
import ReadingReminderDeviceSync from '../components/ReadingReminderDeviceSync';

import {
  NovoriThemeProvider,
  useNovoriTheme,
} from '../context/theme-context';

SplashScreen.preventAutoHideAsync();

function AppNavigator() {
  const { colors, theme, ready } = useNovoriTheme();

  useEffect(() => {
    if (ready) {
      void SystemUI.setBackgroundColorAsync(colors.background);
    }
  }, [ready, colors.background]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
        }}
      />
    );
  }

  return (
    <TutorialProvider><View
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <AccountDeletionGate />
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <BrowsingNavigation><TutorialBackground><Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: {
            backgroundColor: colors.background,
          },
        }}
      >
        <Stack.Screen name="post/[id]" options={{animation:'default', keyboardHandlingEnabled:true}}/>
        <Stack.Screen name="post/[id]/conversation" options={{animation:'none',presentation:'card'}}/>
      </Stack></TutorialBackground></BrowsingNavigation>
      <PushNotificationDeviceSync />
      <ConversationHandoffOverlay />
      <LegalAcceptanceGate />
      <TutorialGate />
      <TutorialOverlay />
    </View></TutorialProvider>
  );
}

export default function RootLayout() {
  const [playfairLoaded, playfairError] = usePlayfairFonts({
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
  });

  const [interLoaded, interError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const appReady =
    (playfairLoaded || !!playfairError) &&
    (interLoaded || !!interError);


  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
      }}
    >
      <KeyboardProvider>
        <NovoriThemeProvider>
          <StartupContent fontsReady={appReady} />
        </NovoriThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function StartupContent({ fontsReady }: { fontsReady: boolean }) {
  const { ready } = useNovoriTheme();
  const [introFinished, setIntroFinished] = useState(false);

  if (!fontsReady || !ready || !introFinished) {
    return <LaunchTrace onFinished={setIntroFinished} />;
  }

  return (
    <>
      <ReadingReminderDeviceSync />
      <AppNavigator />
    </>
  );
}
