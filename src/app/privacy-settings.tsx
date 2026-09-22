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
  'novori-privacy-preferences';

type PrivacyPreferences = {
  privateProfile: boolean;

  showReadingActivity: boolean;
  showReviews: boolean;
  showClubs: boolean;

  discoverableByReaders: boolean;

  nearbyEnabled: boolean;
  showApproximateDistance: boolean;
};

const DEFAULT_PREFERENCES: PrivacyPreferences = {
  privateProfile: false,

  showReadingActivity: true,
  showReviews: true,
  showClubs: true,

  discoverableByReaders: true,

  nearbyEnabled: false,
  showApproximateDistance: false,
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

export default function PrivacySettingsScreen() {
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
    useState<PrivacyPreferences>(
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
      keyof PrivacyPreferences,

    value:
      boolean
  ) {
    const next = {
      ...preferences,

      [key]:
        value,
    };

    if (
      key ===
        'nearbyEnabled' &&
      value === false
    ) {
      next.showApproximateDistance =
        false;
    }

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
          Privacy
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
            Your Privacy
          </Text>

          <Text
            style={
              styles.introText
            }
          >
            Choose what other readers
            can see and how people can
            discover you on Novori.
          </Text>
        </View>

        <Text
          style={
            styles.sectionLabel
          }
        >
          PROFILE
        </Text>

        <View
          style={
            styles.card
          }
        >
          <PreferenceRow
            icon="lock-closed-outline"
            title="Private Profile"
            subtitle="Limit your full profile and activity to approved followers"
            value={
              preferences.privateProfile
            }
            colors={
              colors
            }
            onValueChange={(
              value
            ) =>
              updatePreference(
                'privateProfile',
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
          ACTIVITY VISIBILITY
        </Text>

        <View
          style={
            styles.card
          }
        >
          <PreferenceRow
            icon="book-outline"
            title="Reading Activity"
            subtitle="Show books you start, finish, or add to your library"
            value={
              preferences.showReadingActivity
            }
            colors={
              colors
            }
            onValueChange={(
              value
            ) =>
              updatePreference(
                'showReadingActivity',
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
            icon="star-outline"
            title="Reviews & Ratings"
            subtitle="Show reviews and ratings you publish"
            value={
              preferences.showReviews
            }
            colors={
              colors
            }
            onValueChange={(
              value
            ) =>
              updatePreference(
                'showReviews',
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
            icon="people-outline"
            title="Clubs"
            subtitle="Show clubs you join or create on your profile"
            value={
              preferences.showClubs
            }
            colors={
              colors
            }
            onValueChange={(
              value
            ) =>
              updatePreference(
                'showClubs',
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
          DISCOVERY
        </Text>

        <View
          style={
            styles.card
          }
        >
          <PreferenceRow
            icon="search-outline"
            title="Reader Discovery"
            subtitle="Allow your profile to appear in reader recommendations and search"
            value={
              preferences.discoverableByReaders
            }
            colors={
              colors
            }
            onValueChange={(
              value
            ) =>
              updatePreference(
                'discoverableByReaders',
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
          NEARBY
        </Text>

        <View
          style={
            styles.card
          }
        >
          <PreferenceRow
            icon="location-outline"
            title="Appear in Nearby"
            subtitle="Allow Novori to include you in nearby reader discovery"
            value={
              preferences.nearbyEnabled
            }
            colors={
              colors
            }
            onValueChange={(
              value
            ) =>
              updatePreference(
                'nearbyEnabled',
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
            icon="navigate-outline"
            title="Approximate Distance"
            subtitle="Allow nearby readers to see an approximate distance from you"
            value={
              preferences.showApproximateDistance
            }
            disabled={
              !preferences.nearbyEnabled
            }
            colors={
              colors
            }
            onValueChange={(
              value
            ) =>
              updatePreference(
                'showApproximateDistance',
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
            name="shield-checkmark-outline"
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
            Novori should never display
            your exact location to
            another user. Nearby
            features will use general
            proximity rather than a
            precise address.
          </Text>
        </View>

        <Text
          style={
            styles.footerText
          }
        >
          Privacy preferences are
          saved automatically.
        </Text>
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

      paddingTop: 24,

      paddingBottom: 50,
    },

    intro: {
      marginBottom: 8,
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

      letterSpacing: 0.9,

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

      paddingHorizontal: 14,

      paddingVertical: 12,
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

    footerText: {
      color:
        colors.mutedText,

      fontSize: 12,

      lineHeight: 18,

      fontFamily:
        'Inter_400Regular',

      textAlign:
        'center',

      marginTop: 22,
    },

    pressed: {
      opacity: 0.65,
    },
  });
}