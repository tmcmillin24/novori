import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import NovoriBottomBar, { NOVORI_TAB_BAR_HEIGHT, novoriTabs as tabs } from './NovoriBottomBar';
import { type Href, type NativeStackNavigationProp, useGlobalSearchParams, useNavigation, usePathname, useRouter, useSegments } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, Platform, View } from 'react-native';
import { useTutorial } from '../context/tutorial-context';

type Tab = (typeof tabs)[number]['segment'];
const detailRoutes = new Set(['book/[id]', 'book/[id]/index', 'author/[name]', 'reader/[id]', 'club/[id]',
  'post/[id]', 'club-event/[id]', 'book-stack/[id]']);
const BottomInsetCovered = createContext(false);
export const useBrowsingBottomInsetCovered = () => useContext(BottomInsetCovered);

const ScreenBottomBar = createContext<ReactNode>(null);

// A footer owned by the screen stays visible underneath a native swipe-back.
export const useScreenBrowsingBottomBar = () => useContext(ScreenBottomBar);

const PostFooterSpace = createContext<ReactNode>(null);

export function PostBrowsingFooterSpace() {
  return useContext(PostFooterSpace);
}

const PostFooterTransition = createContext<(path: string, closing: boolean) => void>(() => {});

export function usePostFooterTransition() {
  const path = usePathname();
  const report = useContext(PostFooterTransition);
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  useEffect(() => {
    const start = navigation.addListener('transitionStart', ({ data }) => report(path, data.closing));
    const cancel = navigation.addListener('gestureCancel', () => report(path, false));
    return () => { start(); cancel(); };
  }, [navigation, path, report]);
}

const ScrollVisibility = createContext<(path: string, hidden: boolean) => void>(() => {});

export function useBrowsingNavigationScroll() {
  const path = usePathname();
  const setHidden = useContext(ScrollVisibility);
  type ScrollEvent = { nativeEvent: {
    contentOffset: { y: number };
    contentSize: { height: number };
    layoutMeasurement: { height: number };
    contentInset?: { bottom: number };
  } };
  function measure({ nativeEvent: e }: ScrollEvent) {
    const viewport = e.layoutMeasurement.height;
    const end = Math.max(0, e.contentSize.height + (e.contentInset?.bottom ?? 0) - viewport);
    return { y: Math.max(0, Math.min(end, e.contentOffset.y)), viewport, end };
  }
  const position = useRef({ y: 0, viewport: 0, end: 0, distance: 0 });
  const onScrollBeginDrag = useCallback((event: ScrollEvent) => {
    position.current = { ...measure(event), distance: 0 };
  }, []);
  const onScroll = useCallback((event: ScrollEvent) => {
    const next = measure(event);
    const last = position.current;
    // The bar changes the viewport height as it slides. That layout change
    // and scroll offsets beyond the real content are not user scrolls.
    if (Math.abs(next.viewport - last.viewport) > 0.5 || Math.abs(next.end - last.end) > 0.5) {
      position.current = { ...next, distance: 0 };
      return;
    }
    const delta = next.y - last.y;
    if (delta === 0) return;
    let distance = Math.sign(delta) === Math.sign(last.distance) ? last.distance + delta : delta;
    if (next.y <= 2 || distance <= -12) { setHidden(path, false); distance = 0; }
    else if (next.y > 72 && distance >= 32) { setHidden(path, true); distance = 0; }
    position.current = { ...next, distance };
  }, [path, setHidden]);
  return { onScroll, onScrollBeginDrag, scrollEventThrottle: 16 };
}

export default function BrowsingNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments() as readonly string[];
  const params = useGlobalSearchParams();
  const tutorial = useTutorial();
  const route = segments.join('/');
  const detail = detailRoutes.has(route);
  // Keep the book viewport the same size before and after the bar mounts.
  const overlayBookBar = route === 'book/[id]' || route === 'book/[id]/index';
  const owner = useRef<Tab>('discover');
  const saved = useRef<Partial<Record<Tab, Href>>>({});
  const [active, setActive] = useState<Tab>('discover');
  const [visibility, setVisibility] = useState<{ path: string; hidden: boolean } | null>(null);
  const [closingPostPath, setClosingPostPath] = useState<string | null>(null);
  const reportPostTransition = useCallback((path: string, closing: boolean) => {
    setClosingPostPath(current => closing ? path : current === path ? null : current);
  }, []);
  const [keyboard, setKeyboard] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    if (segments[0] === '(tabs)') {
      const tab = tabs.find(item => item.segment === (segments[1] ?? 'index'));
      if (tab) { owner.current = tab.segment; setActive(tab.segment); }
    }
    setVisibility(null);
    setClosingPostPath(current => current === pathname ? current : null);
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
  // On iOS the native keyboard covers the footer. Keep its layout in place
  // so the post's keyboard avoidance measures the same viewport throughout.
  const postRoute = route === 'post/[id]';
  const keepPostFooter = Platform.OS === 'ios' && postRoute;
  const showBar = detail && !tutorial?.active && (!keyboard || keepPostFooter);
  const hidden = !reduceMotion && visibility?.path === pathname && visibility.hidden;
  const postLeaving = postRoute && closingPostPath === pathname;
  const barUnavailable = hidden || keyboard || postLeaving;
  const progress = useSharedValue(1);
  useEffect(() => {
    if (!showBar || reduceMotion) { progress.value = 1; return; }
    progress.value = withTiming(hidden ? 0 : 1, { duration: hidden ? 210 : 240, easing: Easing.out(Easing.cubic) });
  }, [hidden, progress, reduceMotion, showBar]);
  const raisedButtonSpace = 18;
  const slide = useAnimatedStyle(() => ({ height: raisedButtonSpace + NOVORI_TAB_BAR_HEIGHT * progress.value }));

  const postFooterSpace = useAnimatedStyle(() => ({ height: NOVORI_TAB_BAR_HEIGHT * progress.value }));

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
    <BottomInsetCovered.Provider value={(!keepPostFooter && keyboard) || (showBar && !hidden && !overlayBookBar)}>
      <PostFooterTransition.Provider value={reportPostTransition}>
        <PostFooterSpace.Provider value={postRoute && showBar
          ? <Animated.View pointerEvents="none" accessible={false} style={postFooterSpace}/>
          : null}>
          <ScreenBottomBar.Provider value={tutorial?.active ? null :
            <NovoriBottomBar active={active} onTab={switchTab}/>}>
            <View style={{ flex: 1 }}>{children}</View>
          </ScreenBottomBar.Provider>
        </PostFooterSpace.Provider>
      </PostFooterTransition.Provider>
    </BottomInsetCovered.Provider>
    {showBar ? <Animated.View style={[{ overflow: 'hidden', marginTop: -raisedButtonSpace, opacity: postLeaving ? 0 : 1 },
      (overlayBookBar || postRoute) && { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40 }, slide]} pointerEvents={barUnavailable ? 'none' : 'auto'}
      accessibilityElementsHidden={barUnavailable} importantForAccessibility={barUnavailable ? 'no-hide-descendants' : 'auto'}>
      <View style={{ position: 'absolute', top: raisedButtonSpace, left: 0, right: 0 }}>
        <NovoriBottomBar active={active} onTab={switchTab}/>
      </View>
    </Animated.View> : null}
  </ScrollVisibility.Provider>;
}
