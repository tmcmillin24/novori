import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

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

type SupportRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  colors: NovoriColors;
};

function SupportRow({
  icon,
  title,
  subtitle,
  onPress,
  colors,
}: SupportRowProps) {
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
        style={
          styles.iconContainer
        }
      >
        <Ionicons
          name={icon}
          size={20}
          color={colors.gold}
        />
      </View>

      <View
        style={styles.rowText}
      >
        <Text
          style={styles.rowTitle}
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

      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.mutedText}
      />
    </Pressable>
  );
}

export default function HelpSupportScreen() {
  const router =
    useRouter();

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(colors);

  function showHelpTopic(
    title: string,
    message: string
  ) {
    Alert.alert(
      title,
      message
    );
  }

  function contactSupport() {
    Alert.alert(
      'Contact Support',
      'Direct Novori support email will be connected here before launch.'
    );
  }

  function reportProblem() {
    Alert.alert(
      'Report a Problem',
      'Bug reporting will be connected here. Later, Novori can automatically include useful app and device information with the report.'
    );
  }

  function featureRequest() {
    Alert.alert(
      'Feature Request',
      'Feature requests will be connected here so readers can suggest improvements to Novori.'
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
      <View
        style={styles.header}
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
            color={colors.text}
          />
        </Pressable>

        <Text
          style={styles.headerTitle}
        >
          Help & Support
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={styles.intro}
        >
          <View
            style={
              styles.supportIcon
            }
          >
            <Ionicons
              name="help-circle-outline"
              size={30}
              color={colors.gold}
            />
          </View>

          <Text
            style={
              styles.introTitle
            }
          >
            How can we help?
          </Text>

          <Text
            style={
              styles.introText
            }
          >
            Find help with your
            Novori account, reading
            activity, community
            features, and privacy.
          </Text>
        </View>

        <Text
          style={
            styles.sectionLabel
          }
        >
          HELP TOPICS
        </Text>

        <View
          style={styles.card}
        >
          <SupportRow
            icon="person-circle-outline"
            title="Account & Login"
            subtitle="Sign in, email, password, and account access"
            colors={colors}
            onPress={() =>
              showHelpTopic(
                'Account & Login',
                'Help articles for account access, email verification, password recovery, and account settings will live here.'
              )
            }
          />

          <View
            style={styles.divider}
          />

          <SupportRow
            icon="library-outline"
            title="Books & Library"
            subtitle="Reading status, shelves, ratings, and reviews"
            colors={colors}
            onPress={() =>
              showHelpTopic(
                'Books & Library',
                'Help for adding books, reading statuses, reviews, ratings, shelves, and library management will live here.'
              )
            }
          />

          <View
            style={styles.divider}
          />

          <SupportRow
            icon="people-outline"
            title="Clubs & Community"
            subtitle="Readers, clubs, discussions, and events"
            colors={colors}
            onPress={() =>
              showHelpTopic(
                'Clubs & Community',
                'Help for following readers, joining clubs, discussions, groups, and community events will live here.'
              )
            }
          />

          <View
            style={styles.divider}
          />

          <SupportRow
            icon="shield-checkmark-outline"
            title="Privacy & Safety"
            subtitle="Privacy settings, blocking, reporting, and Nearby"
            colors={colors}
            onPress={() =>
              showHelpTopic(
                'Privacy & Safety',
                'Help for privacy controls, blocking users, reporting content, account safety, and Nearby privacy will live here.'
              )
            }
          />
        </View>

        <Text
          style={
            styles.sectionLabel
          }
        >
          CONTACT US
        </Text>

        <View
          style={styles.card}
        >
          <SupportRow
            icon="bug-outline"
            title="Report a Problem"
            subtitle="Tell us when something in Novori isn't working"
            colors={colors}
            onPress={
              reportProblem
            }
          />

          <View
            style={styles.divider}
          />

          <SupportRow
            icon="bulb-outline"
            title="Feature Request"
            subtitle="Suggest something you'd like to see in Novori"
            colors={colors}
            onPress={
              featureRequest
            }
          />

          <View
            style={styles.divider}
          />

          <SupportRow
            icon="mail-outline"
            title="Contact Support"
            subtitle="Get help directly from the Novori team"
            colors={colors}
            onPress={
              contactSupport
            }
          />
        </View>

        <View
          style={styles.infoBox}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={20}
            color={colors.gold}
          />

          <View
            style={
              styles.infoBoxText
            }
          >
            <Text
              style={
                styles.infoTitle
              }
            >
              Need more help?
            </Text>

            <Text
              style={
                styles.infoText
              }
            >
              Direct support and
              searchable help articles
              will be added as Novori
              moves closer to release.
            </Text>
          </View>
        </View>

        <Text
          style={
            styles.versionText
          }
        >
          Novori 1.0.0
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
      backgroundColor:
        colors.background,
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
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
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 28,
      paddingBottom: 50,
    },

    intro: {
      alignItems: 'center',
      paddingHorizontal: 18,
      marginBottom: 8,
    },

    supportIcon: {
      width: 58,
      height: 58,
      borderRadius: 18,
      backgroundColor:
        colors.elevated,
      borderWidth: 1,
      borderColor:
        colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },

    introTitle: {
      color: colors.text,
      fontSize: 27,
      fontFamily:
        'PlayfairDisplay_700Bold',
      textAlign: 'center',
    },

    introText: {
      color:
        colors.secondaryText,
      fontSize: 14,
      lineHeight: 21,
      fontFamily:
        'Inter_400Regular',
      textAlign: 'center',
      maxWidth: 340,
      marginTop: 7,
    },

    sectionLabel: {
      color:
        colors.mutedText,
      fontSize: 11,
      letterSpacing: 0.9,
      fontFamily:
        'Inter_700Bold',
      marginTop: 26,
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
      overflow: 'hidden',
    },

    row: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },

    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor:
        colors.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 13,
    },

    rowText: {
      flex: 1,
      paddingRight: 10,
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

    divider: {
      height: 1,
      backgroundColor:
        colors.border,
      marginLeft: 67,
    },

    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 16,
      padding: 16,
      marginTop: 24,
    },

    infoBoxText: {
      flex: 1,
    },

    infoTitle: {
      color: colors.text,
      fontSize: 14,
      fontFamily:
        'Inter_600SemiBold',
    },

    infoText: {
      color:
        colors.secondaryText,
      fontSize: 12,
      lineHeight: 18,
      fontFamily:
        'Inter_400Regular',
      marginTop: 3,
    },

    versionText: {
      color:
        colors.mutedText,
      fontSize: 11,
      fontFamily:
        'Inter_400Regular',
      textAlign: 'center',
      marginTop: 26,
    },

    pressed: {
      opacity: 0.65,
    },
  });
}