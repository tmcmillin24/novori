import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useNovoriTheme } from '../../context/theme-context';
import {TutorialTarget,useTutorialTarget} from '../../context/tutorial-context';

export default function TabLayout() {
  const createTarget=useTutorialTarget('tab-create');
  const {
    colors,
  } =
    useNovoriTheme();

  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        headerShown: false,
        animation: 'none',
        freezeOnBlur: true,

        sceneStyle: {
          backgroundColor: colors.background,
          overflow: 'hidden',
        },

        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 82,
          paddingTop: 8,
          paddingBottom: 22,
        },

        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.mutedText,

        tabBarLabelStyle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <TutorialTarget id="tab-home"><Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size}
              color={color}
            /></TutorialTarget>
          ),
        }}
      />

      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          freezeOnBlur: false,
          tabBarIcon: ({ color, size, focused }) => (
            <TutorialTarget id="tab-discover"><Ionicons
              name={focused ? 'compass' : 'compass-outline'}
              size={size}
              color={color}
            /></TutorialTarget>
          ),
        }}
      />

      <Tabs.Screen
        name="post"
        options={{
          title: '',
          tabBarAccessibilityLabel: 'Create',
          tabBarButton: ({ onPress, onLongPress, accessibilityState, children: _children }) => (
            <Pressable
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityState={accessibilityState}
              accessibilityRole="button"
              accessibilityLabel="Create"
              accessibilityHint="Open the Novori creation hub."
              testID="create-tab-button"
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                ref={createTarget.ref} collapsable={false} onLayout={createTarget.onLayout}
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  backgroundColor: colors.gold,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: -18,
                }}
              >
                <Ionicons
                  name="add"
                  size={30}
                  color={colors.background}
                />
              </View>
            </Pressable>
          ),
        }}
      />

      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, size, focused }) => (
            <TutorialTarget id="tab-library"><Ionicons
              name={focused ? 'library' : 'library-outline'}
              size={size}
              color={color}
            /></TutorialTarget>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <TutorialTarget id="tab-profile"><Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color}
            /></TutorialTarget>
          ),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
