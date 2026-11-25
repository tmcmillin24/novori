import { Ionicons } from '@expo/vector-icons';
import { type Href, useGlobalSearchParams, usePathname, useRouter, useSegments } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNovoriTheme } from '../context/theme-context';
import { useTutorial } from '../context/tutorial-context';

const tabs = [
  { name: 'Home', path: '/(tabs)', segment: 'index', icon: 'home' },
  { name: 'Discover', path: '/(tabs)/discover', segment: 'discover', icon: 'compass' },
  { name: 'Create', path: '/(tabs)/post', segment: 'post', icon: 'add' },
  { name: 'Library', path: '/(tabs)/library', segment: 'library', icon: 'library' },
  { name: 'Profile', path: '/(tabs)/profile', segment: 'profile', icon: 'person' },
] as const;
type Tab = (typeof tabs)[number]['segment'];
const detailRoutes = new Set(['book/[id]', 'book/[id]/index', 'author/[name]', 'reader/[id]', 'club/[id]',
  'post/[id]', 'club-event/[id]', 'club-discussions', 'book-stack/[id]']);
const ScrollVisibility = createContext<(path: string, hidden: boolean) => void>(() => {});

export function useBrowsingNavigationScroll() {
  const path = usePathname();
  const setHidden = useContext(ScrollVisibility);
  const position = useRef({ y: 0, distance: 0 });
  const onScrollBeginDrag = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    position.current = { y: Math.max(0, event.nativeEvent.contentOffset.y), distance: 0 };
  }, []);
  const onScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = Math.max(0, event.nativeEvent.contentOffset.y);
    const last = position.current;
    const delta = y - last.y;
    if (delta === 0 && y > 0) return;
    let distance = Math.sign(delta) === Math.sign(last.distance) ? last.distance + delta : delta;
    if (y < 12 || distance <= -10) { setHidden(path, false); distance = 0; }
    else if (y > 72 && distance >= 32) { setHidden(path, true); distance = 0; }
    position.current = { y, distance };
  }, [path, setHidden]);
  return { onScroll, onScrollBeginDrag, scrollEventThrottle: 16 };
}

export default function BrowsingNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments() as readonly string[];
  const params = useGlobalSearchParams();
  const { colors } = useNovoriTheme();
  const tutorial = useTutorial();
  const insets = useSafeAreaInsets();
  const route = segments.join('/');
  const detail = detailRoutes.has(route);
  const owner = useRef<Tab>('discover');
  const saved = useRef<Partial<Record<Tab, Href>>>({});
  const [active, setActive] = useState<Tab>('discover');
  const [visibility, setVisibility] = useState<{ path: string; hidden: boolean } | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    if (segments[0] === '(tabs)') {
      const tab = tabs.find(item => item.segment === (segments[1] ?? 'index'));
      if (tab) { owner.current = tab.segment; setActive(tab.segment); }
    }
    setVisibility(null);
  }, [route, pathname]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { mounted = false; motion.remove(); show.remove(); hide.remove(); };
  }, []);

  const report = useCallback((path: string, hidden: boolean) => {
    if (path !== pathname) return;
    setVisibility(current => current?.path === path && current.hidden === hidden ? current : { path, hidden });
  }, [pathname]);
  const visible = detail && !tutorial?.active && !keyboard && (reduceMotion || visibility?.path !== pathname || !visibility.hidden);

  function switchTab(tab: (typeof tabs)[number]) {
    if (tab.segment !== 'post') {
      saved.current[owner.current] = { pathname, params: Object.fromEntries(
        Object.entries(params).filter(([name]) => !segments.includes(`[${name}]`))
      ) } as Href;
    }
    const destination = tab.segment === owner.current || tab.segment === 'post' ? tab.path : saved.current[tab.segment] ?? tab.path;
    if (tab.segment === owner.current) delete saved.current[tab.segment];
    owner.current = tab.segment;
    setActive(tab.segment);
    setVisibility(null);
    router.navigate(destination);
  }

  return <ScrollVisibility.Provider value={report}>
    <View style={styles.content}>{children}</View>
    {visible ? <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: colors.surface,
      borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map(tab => {
        const selected = tab.segment === active;
        const create = tab.segment === 'post';
        const tint = selected ? colors.gold : colors.mutedText;
        return <Pressable key={tab.segment} accessibilityRole="tab" accessibilityLabel={tab.name}
          accessibilityState={{ selected }} onPress={() => switchTab(tab)} style={styles.item}>
          {create ? <View style={[styles.create, { backgroundColor: colors.gold }]}>
            <Ionicons name="add" size={27} color={colors.background}/>
          </View> : <>
            <Ionicons name={tab.icon} size={22} color={tint}/>
            <Text numberOfLines={1} style={[styles.label, { color: tint }]}>{tab.name}</Text>
          </>}
        </Pressable>;
      })}
    </View> : null}
  </ScrollVisibility.Provider>;
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 3 },
  item: { flex: 1, minHeight: 46, justifyContent: 'center', alignItems: 'center', gap: 3 },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  create: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
