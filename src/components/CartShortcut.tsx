import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
import { getBookCartCountSnapshot, refreshBookCartCount, subscribeBookCartCount, subscribeCartAdditions } from '../lib/book-cart-count';

export default function CartShortcut({ animateAdditions = false }: { animateAdditions?: boolean }) {
  const { colors } = useNovoriTheme(), router = useRouter();
  const count = useSyncExternalStore(subscribeBookCartCount, getBookCartCountSnapshot, getBookCartCountSnapshot);
  const { width, height } = useWindowDimensions();
  const anchor = useRef<View>(null), focused = useRef(false), reduceMotion = useRef(true);
  const flight = useRef(new Animated.Value(0)).current, bounce = useRef(new Animated.Value(1)).current;
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const [added, setAdded] = useState<{ title: string; coverUrl?: string | null; x: number; y: number } | null>(null);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) reduceMotion.current = value; }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reduceMotion.current = value; });
    return () => { active = false; subscription.remove(); animation.current?.stop(); };
  }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    void refreshBookCartCount().catch(() => {});
    return () => { focused.current = false; animation.current?.stop(); setAdded(null); };
  }, []));
  useEffect(() => subscribeCartAdditions(book => {
    if (!animateAdditions || !focused.current) return;
    anchor.current?.measureInWindow((x, y) => {
      if (!focused.current) return;
      animation.current?.stop(); flight.setValue(0); bounce.setValue(1);
      setAdded({ ...book, x: width / 2 - x - 20, y: height * 0.42 - y });
      void AccessibilityInfo.announceForAccessibility('Added to Book Cart');
      const reduced = reduceMotion.current;
      animation.current = Animated.sequence([
        Animated.timing(flight, { toValue: 1, duration: reduced ? 0 : 550, useNativeDriver: true }),
        ...(reduced ? [] : [Animated.sequence([
          Animated.timing(bounce, { toValue: 1.18, duration: 110, useNativeDriver: true }),
          Animated.spring(bounce, { toValue: 1, useNativeDriver: true }),
        ])]),
        Animated.delay(1300),
      ]);
      animation.current.start(({ finished }) => { if (finished) setAdded(null); });
    });
  }), [animateAdditions, width, height, flight, bounce]);
  return <View ref={anchor} collapsable={false} style={{ position: 'relative', zIndex: 20 }}>
    <Animated.View style={{ transform: [{ scale: bounce }] }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open Book Cart${count === null ? '' : `, ${count} ${count === 1 ? 'book' : 'books'}`}`}
        onPress={() => router.push('/book-cart')} hitSlop={6}
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
        <Ionicons name="cart-outline" size={22} color={colors.gold}/>
        {count !== null && count > 0 ? <View style={{ position: 'absolute', right: -3, top: -4, minWidth: 19, height: 19, paddingHorizontal: 4, borderRadius: 10, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.background, fontSize: 10, fontFamily: 'Inter_700Bold' }}>{count > 99 ? '99+' : count}</Text>
        </View> : null}
      </Pressable>
    </Animated.View>
    {added ? <>
      {!reduceMotion.current && added.coverUrl ? <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', width: 40, height: 60, top: 0, left: 0, opacity: flight.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }), transform: [
          { translateX: flight.interpolate({ inputRange: [0, 1], outputRange: [added.x, 2] }) },
          { translateY: flight.interpolate({ inputRange: [0, 1], outputRange: [added.y, 0] }) },
          { scale: flight.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] }) },
        ] }}>
        <Image source={added.coverUrl} cachePolicy="memory-disk" contentFit="cover" style={{ width: 40, height: 60, borderRadius: 4 }}/>
      </Animated.View> : null}
      <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 52, width: 180, borderRadius: 12, padding: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.gold }}>
        <Text style={{ color: colors.gold, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Added to Book Cart</Text>
      </View>
    </> : null}
  </View>;
}
