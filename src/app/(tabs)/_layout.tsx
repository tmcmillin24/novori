import { Ionicons } from '@expo/vector-icons';
import type {ComponentProps} from 'react';
import { Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useNovoriTheme } from '../../context/theme-context';
import {useTutorialTarget} from '../../context/tutorial-context';

export default function TabLayout() {
  const createTarget=useTutorialTarget('tab-create',27);
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
          tabBarButton: props => <TutorialTabButton {...props} targetId="tab-home" />,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarButton: props => <TutorialTabButton {...props} targetId="tab-discover" />,
          freezeOnBlur: false,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'compass' : 'compass-outline'}
              size={size}
              color={color}
            />
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
          tabBarButton: props => <TutorialTabButton {...props} targetId="tab-library" />,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'library' : 'library-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarButton: props => <TutorialTabButton {...props} targetId="tab-profile" />,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color}
            />
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

/** Measure the complete native tab button, including its visible icon and label. */
function TutorialTabButton({targetId,...props}: ComponentProps<typeof Pressable>&{targetId:string}) {
 const target=useTutorialTarget(targetId,10);
 return <Pressable {...props} ref={target.ref} collapsable={false} onLayout={event=>{props.onLayout?.(event);target.onLayout();}}/>;
}
