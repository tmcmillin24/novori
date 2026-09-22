import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
    useEffect,
    useState,
} from 'react';

import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
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

import {
    supabase,
} from '../lib/supabase';

type SettingsRowProps = {
  icon:
    keyof typeof Ionicons.glyphMap;

  title: string;
  subtitle?: string;
  value?: string;
  danger?: boolean;
  onPress: () => void;
};

function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  danger = false,
  onPress,
}: SettingsRowProps) {
  const { colors } =
    useNovoriTheme();

  const styles =
    createStyles(colors);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed &&
          styles.pressed,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          danger &&
            styles.dangerIconWrap,
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={
            danger
              ? colors.danger
              : colors.gold
          }
        />
      </View>

      <View style={styles.rowText}>
        <Text
          style={[
            styles.rowTitle,
            danger &&
              styles.dangerText,
          ]}
        >
          {title}
        </Text>

        {subtitle ? (
          <Text
            style={
              styles.rowSubtitle
            }
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value ? (
        <Text
          style={styles.rowValue}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}

      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.mutedText}
      />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();

  const {
    colors,
    theme,
  } = useNovoriTheme();

  const styles =
    createStyles(colors);

  const [
    email,
    setEmail,
  ] = useState('');

  useEffect(() => {
    async function loadEmail() {
      const {
        data: { user },
      } =
        await supabase.auth
          .getUser();

      setEmail(
        user?.email ?? ''
      );
    }

    loadEmail();
  }, []);

  function placeholder(
    title: string,
    message: string
  ) {
    Alert.alert(
      title,
      message
    );
  }

  async function handleSignOut() {
    const { error } =
      await supabase.auth
        .signOut();

    if (error) {
      Alert.alert(
        'Could not sign out',
        error.message
      );

      return;
    }

    router.replace('/auth');
  }

  function confirmSignOut() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of Novori?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress:
            handleSignOut,
        },
      ]
    );
  }

  function handleDeactivate() {
    Alert.alert(
      'Deactivate Account',
      'Account deactivation is not connected yet. When we build it, this will use a 7-day recovery window before permanent deletion.'
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={[
        'top',
        'bottom',
      ]}
    >
      <View style={styles.header}>
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
            size={24}
            color={colors.text}
          />
        </Pressable>

        <Text
          style={styles.headerTitle}
        >
          Settings
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <Text
          style={styles.sectionLabel}
        >
          ACCOUNT & SECURITY
        </Text>

        <View style={styles.card}>
          <SettingsRow
            icon="mail-outline"
            title="Email"
            value={email}
            onPress={() =>
              placeholder(
                'Email',
                'Email changes will be connected here later.'
              )
            }
          />

          <View
            style={styles.rowDivider}
          />

          <SettingsRow
            icon="call-outline"
            title="Recovery Phone"
            subtitle="Optional recovery method"
            value="Not added"
            onPress={() =>
              placeholder(
                'Recovery Phone',
                'Phone recovery will be available later.'
              )
            }
          />

          <View
            style={styles.rowDivider}
          />

          <SettingsRow
            icon="lock-closed-outline"
            title="Password & Security"
            subtitle="Password recovery and account security"
            onPress={() =>
              router.push(
                '/password-security'
              )
            }
          />
        </View>

        <Text
          style={styles.sectionLabel}
        >
          PREFERENCES
        </Text>

        <View style={styles.card}>
          <SettingsRow
            icon="notifications-outline"
            title="Notifications"
            subtitle="Push and activity notifications"
            onPress={() =>
              router.push(
                '/notification-settings'
              )
            }
          />

          <View
            style={styles.rowDivider}
          />

          <SettingsRow
            icon="shield-checkmark-outline"
            title="Privacy"
            subtitle="Profile, activity, clubs, and Nearby controls"
            onPress={() =>
              router.push(
                '/privacy-settings'
              )
            }
          />

          <View
            style={styles.rowDivider}
          />

          <SettingsRow
            icon={
              theme === 'dark'
                ? 'moon-outline'
                : 'sunny-outline'
            }
            title="Appearance"
            subtitle="Theme and display preferences"
            value={
              theme === 'dark'
                ? 'Dark'
                : 'Light'
            }
            onPress={() =>
              router.push(
                '/appearance'
              )
            }
          />
        </View>

        <Text
          style={styles.sectionLabel}
        >
          SUPPORT
        </Text>

        <View style={styles.card}>
          <SettingsRow
            icon="help-circle-outline"
            title="Help & Support"
            onPress={() =>
              router.push(
                '/help-support'
              )
            }
          />

          <View
            style={styles.rowDivider}
          />

          <SettingsRow
            icon="information-circle-outline"
            title="About Novori"
            onPress={() =>
              router.push(
                '/about-novori'
              )
            }
          />
        </View>

        <Text
          style={styles.sectionLabel}
        >
          ACCOUNT ACTIONS
        </Text>

        <View style={styles.card}>
          <SettingsRow
            icon="log-out-outline"
            title="Sign Out"
            onPress={
              confirmSignOut
            }
          />

          <View
            style={styles.rowDivider}
          />

          <SettingsRow
            icon="person-remove-outline"
            title="Deactivate Account"
            danger
            onPress={
              handleDeactivate
            }
          />
        </View>

        <Text
          style={styles.footerText}
        >
          Your username is permanent
          and is managed separately
          from your editable profile
          information.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(
  colors: NovoriColors
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    header: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor:
        colors.border,
    },

    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },

    headerTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 20,
      fontFamily:
        'PlayfairDisplay_700Bold',
      textAlign: 'center',
    },

    headerSpacer: {
      width: 40,
    },

    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 22,
      paddingBottom: 44,
    },

    sectionLabel: {
      color: colors.mutedText,
      fontSize: 11,
      letterSpacing: 0.8,
      fontFamily:
        'Inter_600SemiBold',
      marginTop: 18,
      marginBottom: 9,
      paddingHorizontal: 4,
    },

    card: {
      backgroundColor:
        colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        colors.border,
      overflow: 'hidden',
    },

    row: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 11,
    },

    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor:
        colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    dangerIconWrap: {
      backgroundColor:
        colors.elevated,
    },

    rowText: {
      flex: 1,
    },

    rowTitle: {
      color: colors.text,
      fontSize: 15,
      fontFamily:
        'Inter_600SemiBold',
    },

    rowSubtitle: {
      color:
        colors.mutedText,
      fontSize: 12,
      lineHeight: 17,
      fontFamily:
        'Inter_400Regular',
      marginTop: 3,
    },

    rowValue: {
      color:
        colors.mutedText,
      fontSize: 12,
      fontFamily:
        'Inter_400Regular',
      maxWidth: 145,
      marginRight: 6,
    },

    rowDivider: {
      height: 1,
      backgroundColor:
        colors.border,
      marginLeft: 62,
    },

    dangerText: {
      color: colors.danger,
    },

    footerText: {
      color:
        colors.mutedText,
      fontSize: 12,
      lineHeight: 18,
      fontFamily:
        'Inter_400Regular',
      textAlign: 'center',
      marginTop: 22,
      paddingHorizontal: 18,
    },

    pressed: {
      opacity: 0.68,
    },
  });
}