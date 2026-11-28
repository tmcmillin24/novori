import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import NovoriBottomBar, { NOVORI_TAB_BAR_HEIGHT, novoriTabs as tabs } from './NovoriBottomBar';
import { type Href, type NativeStackNavigationProp, useGlobalSearchParams, useNavigation, usePathname, useRouter, useSegments } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, Platform, type ScrollViewProps, View } from 'react-native';
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

type BrowsingScreen = { children: ReactNode; route: { name: string }; navigation: { isFocused: () => boolean } };
const BrowsingScreenFrame = createContext<(screen: BrowsingScreen) => ReactNode>(screen => screen.children);

function BrowsingScreenContent(screen: BrowsingScreen) {
  const renderFrame = useContext(BrowsingScreenFrame);
  return <>{renderFrame(screen)}</>;
}

export function renderBrowsingScreenLayout(screen: BrowsingScreen) {
  return <BrowsingScreenContent {...screen}/>;
}

const ScrollVisibility = createContext<(path: string, hidden: boolean) => void>(() => {});

export function useBrowsingNavigationScroll() {
  const path = usePathname();
  const report = useContext(ScrollVisibility);
  const setHidden = useCallback((hidden: boolean) => report(path, hidden), [path, report]);
  return useNavigationScroll(setHidden);
}

function useNavigationScroll(
  setHidden: (hidden: boolean) => void,
  minimumScrollRange = 0,
) {
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
    if (next.y <= 2 || distance <= -12) { setHidden(false); distance = 0; }
    else if (next.end > minimumScrollRange && next.y > 72 && distance >= 32) {
      setHidden(true);
      distance = 0;
    }
    position.current = { ...next, distance };
  }, [minimumScrollRange, setHidden]);
  return { onScroll, onScrollBeginDrag, scrollEventThrottle: 16 };
}

const ReduceMotion = createContext(true);
const TabScrollVisibility = createContext<(tab: Tab, hidden: boolean) => void>(() => {});
const TabFooterState = createContext<{
  enabled: boolean;
  hiddenTab: Tab | null;
  setHiddenTab: (update: (current: Tab | null) => Tab | null) => void;
}>({ enabled: false, hiddenTab: null, setHiddenTab: () => {} });

export function TabBrowsingNavigation({ children }: { children: ReactNode }) {
  const tutorial = useTutorial();
  const reduceMotion = useContext(ReduceMotion);
  const enabled = !reduceMotion && !tutorial?.active;
  const [hiddenTab, setHiddenTab] = useState<Tab | null>(null);
  const report = useCallback((tab: Tab, hidden: boolean) => {
    if (!enabled) return;
    setHiddenTab(current => hidden ? tab : current === tab ? null : current);
  }, [enabled]);

  return <TabScrollVisibility.Provider value={report}>
    <TabFooterState.Provider value={{ enabled, hiddenTab, setHiddenTab }}>
      {children}
    </TabFooterState.Provider>
  </TabScrollVisibility.Provider>;
}

export function useTabBrowsingNavigationScroll(tab: Tab, onScroll?: ScrollViewProps['onScroll']) {
  const navigation = useNavigation();
  const report = useContext(TabScrollVisibility);
  const setHidden = useCallback((hidden: boolean) => {
    if (navigation.isFocused()) report(tab, hidden);
  }, [navigation, report, tab]);

  // Leave room to scroll back up after the footer collapses into the viewport.
  const scroll = useNavigationScroll(setHidden, NOVORI_TAB_BAR_HEIGHT + 2);
  const dimensions = useRef({ height: 0, viewport: 0 });
  function revealIfContentFits() {
    const { height, viewport } = dimensions.current;
    if (viewport > 0 && height <= viewport + 2) setHidden(false);
  }

  return {
    ...scroll,
    onScroll(event: Parameters<NonNullable<ScrollViewProps['onScroll']>>[0]) {
      onScroll?.(event);
      scroll.onScroll(event);
    },
    onLayout: ((event) => {
      dimensions.current.viewport = event.nativeEvent.layout.height;
      if (dimensions.current.height > 0) revealIfContentFits();
    }) satisfies NonNullable<ScrollViewProps['onLayout']>,
    onContentSizeChange(_width: number, height: number) {
      dimensions.current.height = height;
      revealIfContentFits();
    },
  };
}

const raisedButtonSpace = 18;

function useNavigationFooterMotion(hidden: boolean, enabled: boolean) {
  const progress = useSharedValue(1);
  useEffect(() => {
    if (!enabled) { progress.value = 1; return; }
    progress.value = withTiming(hidden ? 0 : 1, {
      duration: hidden ? 210 : 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [enabled, hidden, progress]);
  const slide = useAnimatedStyle(() => ({ height: raisedButtonSpace + NOVORI_TAB_BAR_HEIGHT * progress.value }));
  return { progress, slide };
}

export function TabBrowsingFooter({ active, children }: { active?: string; children: ReactNode }) {
  const { enabled, hiddenTab, setHiddenTab } = useContext(TabFooterState);
  const hidden = enabled && hiddenTab !== null && hiddenTab === active;
  const { slide } = useNavigationFooterMotion(hidden, enabled);

  useEffect(() => {
    setHiddenTab(current => current === active && enabled ? current : null);
  }, [active, enabled, setHiddenTab]);

  return <Animated.View style={[{ overflow: 'hidden', marginTop: -raisedButtonSpace }, slide]}
    pointerEvents={hidden ? 'none' : 'auto'} accessibilityElementsHidden={hidden}
    importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
    <View style={{ position: 'absolute', top: raisedButtonSpace, left: 0, right: 0 }}>
      {children}
    </View>
  </Animated.View>;
}

export default function BrowsingNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments() as readonly string[];
  const params = useGlobalSearchParams();
  const tutorial = useTutorial();
  const route = segments.join('/');
  const detail = detailRoutes.has(route);
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
  const { progress, slide } = useNavigationFooterMotion(hidden, showBar && !reduceMotion);

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

  function renderScreen({ children: screen, route: screenRoute, navigation }: BrowsingScreen) {
    const name = screenRoute.name;
    const isPost = name === 'post/[id]';
    const isOverlay = isPost || name === 'book/[id]' || name === 'book/[id]/index';
    const focused = navigation.isFocused();
    const screenKeyboard = focused && keyboard;
    const keepFooter = Platform.OS === 'ios' && isPost;
    const showFooter = detailRoutes.has(name) && !tutorial?.active && (!screenKeyboard || keepFooter);
    const screenHidden = focused && hidden;
    const leaving = focused && isPost && closingPostPath === pathname;
    const unavailable = screenHidden || screenKeyboard || leaving;

    return <BottomInsetCovered.Provider value={(!keepFooter && screenKeyboard) || (showFooter && !screenHidden && !isOverlay)}>
      <PostFooterSpace.Provider value={isPost && showFooter
        ? <Animated.View pointerEvents="none" accessible={false}
            style={focused ? postFooterSpace : {height: NOVORI_TAB_BAR_HEIGHT}}/>
        : null}>
        <View style={{ flex: 1 }}>{screen}</View>
        {showFooter && <Animated.View style={[
          { overflow: 'hidden', marginTop: -raisedButtonSpace, opacity: leaving ? 0 : 1 },
          isOverlay && { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40 },
          focused ? slide : { height: raisedButtonSpace + NOVORI_TAB_BAR_HEIGHT },
        ]} pointerEvents={unavailable ? 'none' : 'auto'}
          accessibilityElementsHidden={unavailable} importantForAccessibility={unavailable ? 'no-hide-descendants' : 'auto'}>
          <View style={{ position: 'absolute', top: raisedButtonSpace, left: 0, right: 0 }}>
            <NovoriBottomBar active={active} onTab={switchTab}/>
          </View>
        </Animated.View>}
      </PostFooterSpace.Provider>
    </BottomInsetCovered.Provider>;
  }

  return <ReduceMotion.Provider value={reduceMotion}>
    <ScrollVisibility.Provider value={report}>
      <PostFooterTransition.Provider value={reportPostTransition}>
      <ScreenBottomBar.Provider value={tutorial?.active ? null :
        <NovoriBottomBar active={active} onTab={switchTab}/>}>
        <BrowsingScreenFrame.Provider value={renderScreen}>
          <View style={{ flex: 1 }}>{children}</View>
        </BrowsingScreenFrame.Provider>
      </ScreenBottomBar.Provider>
      </PostFooterTransition.Provider>
    </ScrollVisibility.Provider>
  </ReduceMotion.Provider>;
}
