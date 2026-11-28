import NovoriBottomBar from '../../components/NovoriBottomBar';
import { useEffect } from 'react';
import { syncFeedComposerPreview } from '../../lib/club-composer-preview';
import { supabase } from '../../lib/supabase';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { useNovoriTheme } from '../../context/theme-context';
import {useTutorial} from '../../context/tutorial-context';

export default function TabLayout() {
  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Supabase calls this synchronously: schedule the profile read after it returns.
      setTimeout(() => {
        if (active) syncFeedComposerPreview(session?.user?.id ?? null);
      }, 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
      syncFeedComposerPreview(null);
    };
  }, []);

  const tutorial=useTutorial();
  const {
    colors,
  } =
    useNovoriTheme();

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
    <Tabs
      tabBar={({ state, navigation }) => <NovoriBottomBar active={state.routes[state.index]?.name}
        onTab={tab => {
          const route = state.routes.find(item => item.name === tab.segment);
          if (!route) return;
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!event.defaultPrevented && state.routes[state.index]?.key !== route.key) navigation.navigate(route.name, route.params);
        }}
        onLongPress={tab => {
          const route = state.routes.find(item => item.name === tab.segment);
          if (route) navigation.emit({ type: 'tabLongPress', target: route.key });
        }}/>}
      // Detach native views without unmounting tab state. Keep tutorial targets
      // attached while the walkthrough measures anchors across tabs.
      detachInactiveScreens={!tutorial?.active}
      screenOptions={{
        headerShown: false,
        animation: 'none',
        freezeOnBlur: !tutorial?.active,

        sceneStyle: {
          backgroundColor: colors.background,
          overflow: 'hidden',
        },

      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }}/>
      <Tabs.Screen name="discover" options={{ title: 'Discover', freezeOnBlur: false }}/>
      <Tabs.Screen name="post" options={{ title: 'Create' }}/>
      <Tabs.Screen name="library" options={{ title: 'Library' }}/>
      <Tabs.Screen name="profile" options={{ title: 'Profile' }}/>
      <Tabs.Screen name="notifications" options={{ href: null }}/>
    </Tabs>
    </View>
  );
}

