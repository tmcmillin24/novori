import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';

const TRACE = require('../../assets/images/novori-launch-trace.png');
// Allow for native frame pacing, then hold the finished logo briefly.
const TRACE_AND_HOLD_MS = 2050;
const IMAGE_LOAD_TIMEOUT_MS = 2400;

if (Platform.OS !== 'web') SplashScreen.setOptions({ fade: false });

export default function LaunchTrace({ onFinished }: { onFinished: (finished: true) => void }) {
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
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setFinished(true);
      return;
    }
    const timer = setTimeout(
      () => setFinished(true),
      displayed ? TRACE_AND_HOLD_MS : IMAGE_LOAD_TIMEOUT_MS,
    );
    return () => clearTimeout(timer);
  }, [displayed, reduceMotion]);

  useEffect(() => {
    if (finished) onFinished(true);
  }, [finished, onFinished]);

  return (
    <View
      style={styles.screen}
      onLayout={() => {
        if (didHideNativeSplash.current || Platform.OS === 'web') return;
        didHideNativeSplash.current = true;
        SplashScreen.hide();
      }}
    >
      <StatusBar style="light" />
      {reduceMotion === false && (
        <Image
          source={TRACE}
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
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#242321',
  },
  mark: { width: 200, height: 200 },
});
