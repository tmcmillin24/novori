import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from 'react-native';

import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import {
    NovoriColors,
} from '../constants/novori-theme';

import {
    useNovoriTheme,
} from '../context/theme-context';

const STORAGE_KEY =
  'novori-notification-display-preferences';

type NotificationPreferences = {
  pushEnabled: boolean;
  soundsEnabled: boolean;
  badgesEnabled: boolean;
  previewsEnabled: boolean;

  groupActivity: boolean;
  keepReadActivity: boolean;
  markReadOnOpen: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  soundsEnabled: true,
  badgesEnabled: true,
  previewsEnabled: true,

  groupActivity: true,
  keepReadActivity: true,
  markReadOnOpen: true,
};

type PreferenceRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;

  value: boolean;

  disabled?: boolean;

  colors: NovoriColors;

  onValueChange: (
    value: boolean
  ) => void;
};

function PreferenceRow({
  icon,
  title,
  subtitle,
  value,
  disabled = false,
  colors,
  onValueChange,
}: PreferenceRowProps) {
  const styles =
    createStyles(colors);

  return (
    <View
      style={[
        styles.preferenceRow,

        disabled &&
          styles.disabledRow,
      ]}
    >
      <View
        style={
          styles.iconContainer
        }
      >
        <Ionicons
          name={icon}
          size={19}
          color={
            disabled
              ? colors.mutedText
              : colors.gold
          }
        />
      </View>

      <View
        style={
          styles.preferenceText
        }
      >
        <Text
          style={[
            styles.preferenceTitle,

            disabled &&
              styles.disabledTitle,
          ]}
        >
          {title}
        </Text>

        <Text
          style={
            styles.preferenceSubtitle
          }
        >
          {subtitle}
        </Text>
      </View>

      <Switch
        value={value}
        disabled={disabled}
        onValueChange={
          onValueChange
        }
        trackColor={{
          false:
            colors.elevated,

          true:
            colors.gold,
        }}
        thumbColor={
          value
            ? colors.background
            : colors.secondaryText
        }
        ios_backgroundColor={
          colors.elevated
        }
      />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const router =
    useRouter();

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(colors);

  const [
    preferences,
    setPreferences,
  ] =
    useState<NotificationPreferences>(
      DEFAULT_PREFERENCES
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadPreferences() {
      try {
        const saved =
          await AsyncStorage
            .getItem(
              STORAGE_KEY
            );

        if (
          saved &&
          mounted
        ) {
          const parsed =
            JSON.parse(
              saved
            );

          setPreferences({
            ...DEFAULT_PREFERENCES,
            ...parsed,
          });
        }
      } catch {
        if (mounted) {
          setPreferences(
            DEFAULT_PREFERENCES
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPreferences();

    return () => {
      mounted = false;
    };
  }, []);

  async function updatePreference(
    key:
      keyof NotificationPreferences,

    value:
      boolean
  ) {
    const next = {
      ...preferences,

      [key]:
        value,
    };

    setPreferences(
      next
    );

    await AsyncStorage
      .setItem(
        STORAGE_KEY,

        JSON.stringify(
          next
        )
      );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
        edges={[
          'top',
          'bottom',
        ]}
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            size="large"
            color={
              colors.gold
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  const pushDisabled =
    !preferences.pushEnabled;

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
      edges={[
        'top',
        'bottom',
      ]}
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          hitSlop={10}
          style={({ pressed }) => [
            styles.backButton,

            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={25}
            color={
              colors.text
            }
          />
        </Pressable>

        <Text
          style={
            styles.headerTitle
          }
        >
          Notifications
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <ScrollView
        style={
          styles.scrollView
        }
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.intro
          }
        >
          <Text
            style={
              styles.introTitle
            }
          >
            Push & Activity
          </Text>

          <Text
            style={
              styles.introText
            }
          >
            Choose how Novori
            displays notifications
            and activity.
          </Text>
        </View>

        <Text
          style={
            styles.sectionLabel
          }
        >
          PUSH NOTIFICATIONS
        </Text>

        <View
          style={
            styles.card
          }
        >
          <PreferenceRow
            icon="notifications-outline"
            title="Push Notifications"
            subtitle="Allow Novori to display push notifications"
            value={
              preferences.pushEnabled
            }
            colors={
              colors
            }
            onValueChange={(
              value
            ) =>
              updatePreference(
                'pushEnabled',
                value
              )
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <PreferenceRow
            icon="volume-medium-outline"
            title="Sounds"
            subtitle="Play a sound when a notification appears"
            value={
              preferences.soundsEnabled
            }
            disabled={
              pushDisabled
            }
            colors={
              colors
            }
            onValueChange={(
              value
            ) =>
              updatePreference(
                'soundsEnabled',
                value
              )
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <PreferenceRow
            icon="apps-outline"
            title="App Badge"
            subtitle="Show unread activity on the Novori app icon"
            value={
              preferences.badgesEnabled
            }
            disabled={
              pushDisabled
            }
            colors={
              colors
            }
            onValueChange={(
              value
            ) =>
              updatePreference(
                'badgesEnabled',
                value
              )
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <PreferenceRow
            icon="eye-outline"
            title="Show Previews"
            subtitle="Show notification details in banners and on the lock screen"
            value={
              preferences.previewsEnabled
            }
            disabled={
              pushDisabled
            }
            colors={
              colors
            }
            onValueChange={(
              value
            ) =>
              updatePreference(
                'previewsEnabled',
                value
              )
            }
          />
        </View>

        <Text
          style={
            styles.sectionLabel
          }
        >
          ACTIVITY
        </Text>

        <View
          style={
            styles.card
          }
        >
          <PreferenceRow
            icon="layers-outline"
            title="Group Similar Activity"
            subtitle="Combine similar activity into cleaner groups"
            value={
              preferences.groupActivity
            }
            colors={
              colors
            }
            onValueChange={(
              value
            ) =>
              updatePreference(
                'groupActivity',
                value
              )
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <PreferenceRow
            icon="checkmark-circle-outline"
            title="Keep Read Activity"
            subtitle="Keep activity visible after you have viewed it"
            value={
              preferences.keepReadActivity
            }
            colors={
              colors
            }
            onValueChange={(
              value
            ) =>
              updatePreference(
                'keepReadActivity',
                value
              )
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <PreferenceRow
            icon="mail-open-outline"
            title="Mark Read When Opened"
            subtitle="Automatically mark activity as read when you open it"
            value={
              preferences.markReadOnOpen
            }
            colors={
              colors
            }
            onValueChange={(
              value
            ) =>
              updatePreference(
                'markReadOnOpen',
                value
              )
            }
          />
        </View>

        <View
          style={
            styles.infoBox
          }
        >
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={
              colors.gold
            }
          />

          <Text
            style={
              styles.infoText
            }
          >
            These settings only
            control how notifications
            and activity are displayed.
            They do not create
            notifications themselves.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(
  colors:
    NovoriColors
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,

      backgroundColor:
        colors.background,
    },

    loadingContainer: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    header: {
      height: 56,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        14,

      borderBottomWidth:
        1,

      borderBottomColor:
        colors.border,

      backgroundColor:
        colors.background,
    },

    backButton: {
      width: 42,

      height: 42,

      borderRadius: 21,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    headerTitle: {
      flex: 1,

      color:
        colors.text,

      fontSize: 20,

      fontFamily:
        'PlayfairDisplay_700Bold',

      textAlign:
        'center',
    },

    headerSpacer: {
      width: 42,
    },

    scrollView: {
      flex: 1,

      backgroundColor:
        colors.background,
    },

    content: {
      width: '100%',

      maxWidth: 720,

      alignSelf:
        'center',

      paddingHorizontal:
        20,

      paddingTop:
        24,

      paddingBottom:
        50,
    },

    intro: {
      marginBottom:
        8,
    },

    introTitle: {
      color:
        colors.text,

      fontSize: 26,

      fontFamily:
        'PlayfairDisplay_700Bold',
    },

    introText: {
      color:
        colors.secondaryText,

      fontSize: 14,

      lineHeight: 21,

      fontFamily:
        'Inter_400Regular',

      marginTop: 5,
    },

    sectionLabel: {
      color:
        colors.mutedText,

      fontSize: 11,

      letterSpacing:
        0.9,

      fontFamily:
        'Inter_700Bold',

      marginTop: 24,

      marginBottom: 9,

      paddingHorizontal: 4,
    },

    card: {
      backgroundColor:
        colors.surface,

      borderRadius: 18,

      borderWidth: 1,

      borderColor:
        colors.border,

      overflow:
        'hidden',
    },

    preferenceRow: {
      minHeight: 78,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        14,

      paddingVertical:
        12,
    },

    disabledRow: {
      opacity: 0.45,
    },

    iconContainer: {
      width: 40,

      height: 40,

      borderRadius: 12,

      backgroundColor:
        colors.elevated,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight: 13,
    },

    preferenceText: {
      flex: 1,

      paddingRight: 12,
    },

    preferenceTitle: {
      color:
        colors.text,

      fontSize: 15,

      fontFamily:
        'Inter_600SemiBold',
    },

    disabledTitle: {
      color:
        colors.secondaryText,
    },

    preferenceSubtitle: {
      color:
        colors.mutedText,

      fontSize: 12,

      lineHeight: 17,

      fontFamily:
        'Inter_400Regular',

      marginTop: 3,
    },

    divider: {
      height: 1,

      backgroundColor:
        colors.border,

      marginLeft: 67,
    },

    infoBox: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      gap: 11,

      backgroundColor:
        colors.surface,

      borderWidth: 1,

      borderColor:
        colors.border,

      borderRadius: 16,

      padding: 15,

      marginTop: 24,
    },

    infoText: {
      flex: 1,

      color:
        colors.secondaryText,

      fontSize: 12,

      lineHeight: 18,

      fontFamily:
        'Inter_400Regular',
    },

    pressed: {
      opacity: 0.65,
    },
  });
}