import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
    Alert,
    Image,
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

type AboutRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  colors: NovoriColors;
};

function AboutRow({
  icon,
  title,
  subtitle,
  onPress,
  colors,
}: AboutRowProps) {
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

export default function AboutNovoriScreen() {
  const router =
    useRouter();

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(colors);

  function placeholder(
    title: string,
    message: string
  ) {
    Alert.alert(
      title,
      message
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
          style={
            styles.headerTitle
          }
        >
          About Novori
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
            styles.brandSection
          }
        >
          <View
            style={
              styles.logoCircle
            }
          >
            <Image
              source={require('../../assets/images/novori_appicon.png')}
              style={
                styles.logoImage
              }
              resizeMode="cover"
            />
          </View>

          <Text
            style={
              styles.brandName
            }
          >
            Novori
          </Text>

          <Text
            style={
              styles.tagline
            }
          >
            Read. Discuss. Belong.
          </Text>

          <Text
            style={
              styles.description
            }
          >
            Novori is a social reading
            community built around
            books, conversations, and
            the people who love them.
          </Text>
        </View>

        <View
          style={
            styles.missionCard
          }
        >
          <Text
            style={
              styles.missionLabel
            }
          >
            OUR IDEA
          </Text>

          <Text
            style={
              styles.missionTitle
            }
          >
            Reading is better when
            it becomes a conversation.
          </Text>

          <Text
            style={
              styles.missionText
            }
          >
            Discover books, share
            reactions, join discussions,
            connect with other readers,
            and build a reading life
            that feels social without
            losing the books at the
            center of it.
          </Text>
        </View>

        <Text
          style={
            styles.sectionLabel
          }
        >
          APP
        </Text>

        <View
          style={styles.card}
        >
          <View
            style={styles.infoRow}
          >
            <View
              style={
                styles.iconContainer
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={colors.gold}
              />
            </View>

            <View
              style={styles.rowText}
            >
              <Text
                style={
                  styles.rowTitle
                }
              >
                Version
              </Text>

              <Text
                style={
                  styles.rowSubtitle
                }
              >
                1.0.0
              </Text>
            </View>
          </View>
        </View>

        <Text
          style={
            styles.sectionLabel
          }
        >
          LEGAL
        </Text>

        <View
          style={styles.card}
        >
          <AboutRow
            icon="document-text-outline"
            title="Terms of Service"
            subtitle="Rules for using Novori"
            colors={colors}
            onPress={() =>
              placeholder(
                'Terms of Service',
                'Novori Terms of Service will be added before launch.'
              )
            }
          />

          <View
            style={styles.divider}
          />

          <AboutRow
            icon="shield-outline"
            title="Privacy Policy"
            subtitle="How Novori handles your information"
            colors={colors}
            onPress={() =>
              placeholder(
                'Privacy Policy',
                'Novori Privacy Policy will be added before launch.'
              )
            }
          />

          <View
            style={styles.divider}
          />

          <AboutRow
            icon="code-slash-outline"
            title="Open Source Licenses"
            subtitle="Software used to build Novori"
            colors={colors}
            onPress={() =>
              placeholder(
                'Open Source Licenses',
                'Third-party software licenses will be listed here.'
              )
            }
          />
        </View>

        <View
          style={
            styles.footerSection
          }
        >
          <Ionicons
            name="heart-outline"
            size={18}
            color={colors.gold}
          />

          <Text
            style={
              styles.footerText
            }
          >
            Built for readers who want
            more than a bookshelf.
          </Text>
        </View>
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
      paddingTop: 30,
      paddingBottom: 50,
    },

    brandSection: {
      alignItems: 'center',
      paddingHorizontal: 18,
    },

    logoCircle: {
      width: 72,
      height: 72,
      borderRadius: 24,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.elevated,
      marginBottom: 18,
    },

    logoImage: {
      width: '100%',
      height: '100%',
    },

    brandName: {
      color: colors.text,
      fontSize: 34,
      fontFamily:
        'PlayfairDisplay_700Bold',
      letterSpacing: 0.2,
    },

    tagline: {
      color: colors.gold,
      fontSize: 14,
      fontFamily:
        'Inter_600SemiBold',
      marginTop: 5,
    },

    description: {
      color:
        colors.secondaryText,
      fontSize: 14,
      lineHeight: 21,
      fontFamily:
        'Inter_400Regular',
      textAlign: 'center',
      maxWidth: 350,
      marginTop: 14,
    },

    missionCard: {
      backgroundColor:
        colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        colors.border,
      padding: 20,
      marginTop: 28,
    },

    missionLabel: {
      color: colors.gold,
      fontSize: 11,
      letterSpacing: 1.1,
      fontFamily:
        'Inter_700Bold',
    },

    missionTitle: {
      color: colors.text,
      fontSize: 22,
      lineHeight: 29,
      fontFamily:
        'PlayfairDisplay_700Bold',
      marginTop: 10,
    },

    missionText: {
      color:
        colors.secondaryText,
      fontSize: 14,
      lineHeight: 21,
      fontFamily:
        'Inter_400Regular',
      marginTop: 10,
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

    infoRow: {
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

    footerSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 28,
      paddingHorizontal: 18,
    },

    footerText: {
      color:
        colors.mutedText,
      fontSize: 12,
      fontFamily:
        'Inter_400Regular',
      textAlign: 'center',
    },

    pressed: {
      opacity: 0.65,
    },
  });
}