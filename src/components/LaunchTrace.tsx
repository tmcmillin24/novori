import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';

const TRACE = require('../../assets/images/novori-launch-trace.png');
const STILL = require('../../assets/images/novori_loadingscreen.png');
const TRACE_MS = 1500;
const MAX_INTRO_MS = 2400;

export default function LaunchTrace({ appReady }: { appReady: boolean }) {
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [displayed, setDisplayed] = useState(false);
  const [finished, setFinished] = useState(false);
  const didHideNativeSplash = useRef(false);

  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', enabled => {
      changed = true;
      setReduceMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(
      enabled => { if (active && !changed) setReduceMotion(enabled); },
      () => { if (active && !changed) setReduceMotion(true); },
    );
    const fallback = setTimeout(() => setFinished(true), MAX_INTRO_MS);
    return () => {
      active = false;
      subscription.remove();
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setFinished(true);
      return;
    }
    if (!displayed) return;
    const timer = setTimeout(() => setFinished(true), TRACE_MS);
    return () => clearTimeout(timer);
  }, [displayed, reduceMotion]);

  if (appReady && finished) return null;

  return (
    <View
      style={styles.overlay}
      onLayout={() => {
        if (didHideNativeSplash.current || Platform.OS === 'web') return;
        didHideNativeSplash.current = true;
        SplashScreen.hide();
      }}
    >
      <StatusBar style="light" />
      {(finished || reduceMotion !== null) && (
        <Image
          source={finished || reduceMotion ? STILL : TRACE}
          style={styles.mark}
          contentFit="contain"
          transition={0}
          onDisplay={() => setDisplayed(true)}
          onError={() => setFinished(true)}
          accessibilityLabel="Novori"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#242321',
    zIndex: 1000,
  },
  mark: { width: 200, height: 200 },
});
