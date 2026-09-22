import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import {
    NovoriColors,
    NovoriThemeName,
} from '../constants/novori-theme';

import {
    useNovoriTheme,
} from '../context/theme-context';

type ThemeOptionProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: NovoriThemeName;
  selected: boolean;
  colors: NovoriColors;
  onPress: () => void;
};

function ThemeOption({
  title,
  subtitle,
  icon,
  selected,
  colors,
  onPress,
}: ThemeOptionProps) {
  const styles =
    createStyles(colors);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected &&
          styles.optionSelected,
        pressed &&
          styles.pressed,
      ]}
    >
      <View
        style={[
          styles.optionIcon,
          selected &&
            styles.optionIconSelected,
        ]}
      >
        <Ionicons
          name={icon}
          size={22}
          color={
            selected
              ? colors.gold
              : colors.secondaryText
          }
        />
      </View>

      <View style={styles.optionText}>
        <Text style={styles.optionTitle}>
          {title}
        </Text>

        <Text
          style={styles.optionSubtitle}
        >
          {subtitle}
        </Text>
      </View>

      <View
        style={[
          styles.radio,
          selected &&
            styles.radioSelected,
        ]}
      >
        {selected ? (
          <View
            style={styles.radioDot}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export default function AppearanceScreen() {
  const router = useRouter();

  const {
    theme,
    colors,
    setTheme,
  } = useNovoriTheme();

  const styles =
    createStyles(colors);

  async function chooseTheme(
    nextTheme: NovoriThemeName
  ) {
    if (nextTheme === theme) {
      return;
    }

    await setTheme(nextTheme);
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'bottom']}
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
          Appearance
        </Text>

        <View
          style={styles.headerSpacer}
        />
      </View>

      <View style={styles.content}>
        <Text
          style={styles.sectionLabel}
        >
          THEME
        </Text>

        <Text
          style={styles.description}
        >
          Choose how Novori looks.
          Dark is the default.
        </Text>

        <View style={styles.options}>
          <ThemeOption
            title="Dark"
            subtitle="Novori's default charcoal theme"
            icon="moon-outline"
            value="dark"
            selected={
              theme === 'dark'
            }
            colors={colors}
            onPress={() =>
              chooseTheme('dark')
            }
          />

          <ThemeOption
            title="Light"
            subtitle="Warm ivory with dark text"
            icon="sunny-outline"
            value="light"
            selected={
              theme === 'light'
            }
            colors={colors}
            onPress={() =>
              chooseTheme('light')
            }
          />
        </View>

        <View style={styles.preview}>
          <Text
            style={styles.previewLabel}
          >
            PREVIEW
          </Text>

          <View
            style={styles.previewCard}
          >
            <View
              style={styles.previewAccent}
            />

            <Text
              style={styles.previewTitle}
            >
              Novori
            </Text>

            <Text
              style={styles.previewText}
            >
              Read. Discuss. Belong.
            </Text>

            <View
              style={styles.previewButton}
            >
              <Text
                style={
                  styles.previewButtonText
                }
              >
                Gold accent
              </Text>
            </View>
          </View>
        </View>
      </View>
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
      paddingTop: 30,
    },

    sectionLabel: {
      color: colors.mutedText,
      fontSize: 11,
      letterSpacing: 0.9,
      fontFamily:
        'Inter_700Bold',
    },

    description: {
      color:
        colors.secondaryText,
      fontSize: 14,
      lineHeight: 21,
      fontFamily:
        'Inter_400Regular',
      marginTop: 7,
      marginBottom: 18,
    },

    options: {
      gap: 12,
    },

    option: {
      minHeight: 82,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },

    optionSelected: {
      borderColor:
        colors.gold,
      borderWidth: 1.5,
    },

    optionIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor:
        colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },

    optionIconSelected: {
      borderWidth: 1,
      borderColor:
        colors.gold,
    },

    optionText: {
      flex: 1,
    },

    optionTitle: {
      color: colors.text,
      fontSize: 16,
      fontFamily:
        'Inter_700Bold',
    },

    optionSubtitle: {
      color:
        colors.mutedText,
      fontSize: 12,
      lineHeight: 17,
      fontFamily:
        'Inter_400Regular',
      marginTop: 4,
    },

    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor:
        colors.mutedText,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 10,
    },

    radioSelected: {
      borderColor:
        colors.gold,
    },

    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor:
        colors.gold,
    },

    preview: {
      marginTop: 34,
    },

    previewLabel: {
      color: colors.mutedText,
      fontSize: 11,
      letterSpacing: 0.9,
      fontFamily:
        'Inter_700Bold',
      marginBottom: 10,
    },

    previewCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      padding: 20,
      overflow: 'hidden',
    },

    previewAccent: {
      width: 38,
      height: 3,
      borderRadius: 2,
      backgroundColor:
        colors.gold,
      marginBottom: 18,
    },

    previewTitle: {
      color: colors.text,
      fontSize: 28,
      fontFamily:
        'PlayfairDisplay_700Bold',
    },

    previewText: {
      color:
        colors.secondaryText,
      fontSize: 14,
      fontFamily:
        'Inter_400Regular',
      marginTop: 5,
    },

    previewButton: {
      alignSelf: 'flex-start',
      backgroundColor:
        colors.gold,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
      marginTop: 20,
    },

    previewButtonText: {
      color:
        colors.background,
      fontSize: 13,
      fontFamily:
        'Inter_700Bold',
    },

    pressed: {
      opacity: 0.7,
    },
  });
}