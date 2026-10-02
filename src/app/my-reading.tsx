import {
  Ionicons,
} from '@expo/vector-icons';
import {
  useRouter,
} from 'expo-router';
import {
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

type ReadingDestinationProps = {
  icon:
    keyof typeof Ionicons.glyphMap;
  title:
    string;
  subtitle:
    string;
  onPress:
    () => void;
};

function ReadingDestination({
  icon,
  title,
  subtitle,
  onPress,
}: ReadingDestinationProps) {
  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  return (
    <Pressable
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.destination,
        pressed &&
          styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        title
      }
    >
      <View
        style={
          styles.destinationIcon
        }
      >
        <Ionicons
          name={
            icon
          }
          size={
            22
          }
          color={
            colors.gold
          }
        />
      </View>

      <View
        style={
          styles.destinationCopy
        }
      >
        <Text
          style={
            styles.destinationTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.destinationSubtitle
          }
        >
          {subtitle}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={
          20
        }
        color={
          colors.mutedText
        }
      />
    </Pressable>
  );
}

export default function MyReadingScreen() {
  const router =
    useRouter();

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
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
          style={({
            pressed,
          }) => [
            styles.headerButton,
            pressed &&
              styles.pressed,
          ]}
          hitSlop={
            8
          }
        >
          <Ionicons
            name="chevron-back"
            size={
              24
            }
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
          My Reading
        </Text>

        <Pressable
          onPress={() =>
            router.push(
              '/notification-settings'
            )
          }
          style={({
            pressed,
          }) => [
            styles.headerButton,
            pressed &&
              styles.pressed,
          ]}
          hitSlop={
            8
          }
          accessibilityRole="button"
          accessibilityLabel="Reading notification settings"
        >
          <Ionicons
            name="notifications-outline"
            size={
              22
            }
            color={
              colors.text
            }
          />
        </Pressable>
      </View>

      <ScrollView
        style={
          styles.scroll
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
            styles.hero
          }
        >
          <Text
            style={
              styles.eyebrow
            }
          >
            YOUR READING LIFE
          </Text>

          <Text
            style={
              styles.heroTitle
            }
          >
            In motion.
          </Text>

          <Text
            style={
              styles.heroSubtitle
            }
          >
            Follow your reading days,
            revisit the books that
            shaped them, and see the
            story they create over
            time.
          </Text>
        </View>

        <Text
          style={
            styles.sectionLabel
          }
        >
          NOW
        </Text>

        <View
          style={
            styles.destinationGroup
          }
        >
          <ReadingDestination
            icon="pulse-outline"
            title="Reading Activity"
            subtitle="Your reading days, books, and month in motion"
            onPress={() =>
              router.push(
                '/reading-activity'
              )
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <ReadingDestination
            icon="sparkles-outline"
            title="Recaps"
            subtitle="Your week and month, told through the books you read"
            onPress={() =>
              router.push(
                '/reading-recaps'
              )
            }
          />
        </View>

        <View
          style={
            styles.notificationCard
          }
        >
          <View
            style={
              styles.notificationIcon
            }
          >
            <Ionicons
              name="notifications-outline"
              size={
                20
              }
              color={
                colors.gold
              }
            />
          </View>

          <View
            style={
              styles.notificationCopy
            }
          >
            <Text
              style={
                styles.notificationTitle
              }
            >
              Reading reminders
            </Text>

            <Text
              style={
                styles.notificationSubtitle
              }
            >
              Check-ins, reading
              nudges, recap alerts,
              and year-end moments
              will be managed from
              Notifications as these
              phases roll out.
            </Text>
          </View>

          <Pressable
            onPress={() =>
              router.push(
                '/notification-settings'
              )
            }
            style={({
              pressed,
            }) => [
              styles.manageButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.manageButtonText
              }
            >
              Manage
            </Text>
          </Pressable>
        </View>

        <Text
          style={
            styles.sectionLabel
          }
        >
          COMING TO MY READING
        </Text>

        <View
          style={
            styles.futureRow
          }
        >
          <View
            style={
              styles.futureItem
            }
          >
            <Ionicons
              name="flag-outline"
              size={
                19
              }
              color={
                colors.mutedText
              }
            />

            <Text
              style={
                styles.futureText
              }
            >
              Goals
            </Text>
          </View>

          <View
            style={
              styles.futureItem
            }
          >
            <Ionicons
              name="calendar-clear-outline"
              size={
                19
              }
              color={
                colors.mutedText
              }
            />

            <Text
              style={
                styles.futureText
              }
            >
              Year in Reading
            </Text>
          </View>

          <View
            style={
              styles.futureItem
            }
          >
            <Ionicons
              name="analytics-outline"
              size={
                19
              }
              color={
                colors.mutedText
              }
            />

            <Text
              style={
                styles.futureText
              }
            >
              Insights
            </Text>
          </View>
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
      flex:
        1,
      backgroundColor:
        colors.background,
    },

    header: {
      height:
        56,
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
    },

    headerButton: {
      width:
        42,
      height:
        42,
      borderRadius:
        21,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    headerTitle: {
      flex:
        1,
      textAlign:
        'center',
      color:
        colors.text,
      fontSize:
        20,
      fontFamily:
        'PlayfairDisplay_700Bold',
    },

    scroll: {
      flex:
        1,
    },

    content: {
      width:
        '100%',
      maxWidth:
        720,
      alignSelf:
        'center',
      paddingHorizontal:
        20,
      paddingTop:
        24,
      paddingBottom:
        48,
    },

    hero: {
      paddingHorizontal:
        4,
      paddingBottom:
        26,
    },

    eyebrow: {
      color:
        colors.gold,
      fontSize:
        11,
      letterSpacing:
        1.7,
      fontFamily:
        'Inter_700Bold',
      marginBottom:
        7,
    },

    heroTitle: {
      color:
        colors.text,
      fontSize:
        34,
      lineHeight:
        39,
      fontFamily:
        'PlayfairDisplay_700Bold',
    },

    heroSubtitle: {
      color:
        colors.secondaryText,
      fontSize:
        14,
      lineHeight:
        21,
      fontFamily:
        'Inter_400Regular',
      marginTop:
        8,
      maxWidth:
        500,
    },

    sectionLabel: {
      color:
        colors.mutedText,
      fontSize:
        10,
      letterSpacing:
        1.6,
      fontFamily:
        'Inter_700Bold',
      marginBottom:
        9,
      marginLeft:
        4,
    },

    destinationGroup: {
      borderRadius:
        18,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      overflow:
        'hidden',
    },

    destination: {
      minHeight:
        78,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        16,
      paddingVertical:
        14,
    },

    destinationIcon: {
      width:
        42,
      height:
        42,
      borderRadius:
        14,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      marginRight:
        13,
    },

    destinationCopy: {
      flex:
        1,
      paddingRight:
        10,
    },

    destinationTitle: {
      color:
        colors.text,
      fontSize:
        15,
      fontFamily:
        'Inter_700Bold',
    },

    destinationSubtitle: {
      color:
        colors.mutedText,
      fontSize:
        12,
      lineHeight:
        17,
      fontFamily:
        'Inter_400Regular',
      marginTop:
        3,
    },

    divider: {
      height:
        1,
      backgroundColor:
        colors.border,
      marginLeft:
        71,
    },

    notificationCard: {
      marginTop:
        18,
      marginBottom:
        28,
      borderRadius:
        16,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      flexDirection:
        'row',
      alignItems:
        'center',
      padding:
        14,
    },

    notificationIcon: {
      width:
        38,
      height:
        38,
      borderRadius:
        19,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      marginRight:
        11,
    },

    notificationCopy: {
      flex:
        1,
      paddingRight:
        10,
    },

    notificationTitle: {
      color:
        colors.text,
      fontSize:
        13,
      fontFamily:
        'Inter_700Bold',
    },

    notificationSubtitle: {
      color:
        colors.mutedText,
      fontSize:
        11,
      lineHeight:
        16,
      fontFamily:
        'Inter_400Regular',
      marginTop:
        3,
    },

    manageButton: {
      minHeight:
        34,
      paddingHorizontal:
        11,
      borderRadius:
        10,
      borderWidth:
        1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
    },

    manageButtonText: {
      color:
        colors.gold,
      fontSize:
        11,
      fontFamily:
        'Inter_700Bold',
    },

    futureRow: {
      flexDirection:
        'row',
      gap:
        8,
    },

    futureItem: {
      flex:
        1,
      minHeight:
        72,
      borderRadius:
        14,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        7,
      paddingHorizontal:
        6,
    },

    futureText: {
      color:
        colors.mutedText,
      fontSize:
        11,
      textAlign:
        'center',
      fontFamily:
        'Inter_600SemiBold',
    },

    pressed: {
      opacity:
        0.68,
    },
  });
}
