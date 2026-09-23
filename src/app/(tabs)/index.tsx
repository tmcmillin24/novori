import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useState,
} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../../constants/novori-theme';
import {
  getUnreadNotificationCount,
} from '../../lib/notifications';

export default function HomeScreen() {
  const router = useRouter();

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadUnreadCount() {
        try {
          const count =
            await getUnreadNotificationCount();

          if (active) {
            setUnreadCount(count);
          }
        } catch (error) {
          console.error(
            'Could not load unread notification count:',
            error
          );
        }
      }

      loadUnreadCount();

      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={styles.brandBlock}>
              <Text style={styles.logo}>
                Novori
              </Text>

              <Text style={styles.slogan}>
                Read. Discuss. Belong.
              </Text>
            </View>

            <Pressable
              onPress={() =>
                router.push(
                  '/(tabs)/notifications'
                )
              }
              hitSlop={10}
              style={({ pressed }) => [
                styles.notificationButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={
                  unreadCount > 0
                    ? 'notifications'
                    : 'notifications-outline'
                }
                size={24}
                color={
                  unreadCount > 0
                    ? COLORS.gold
                    : COLORS.text
                }
              />

              {unreadCount > 0 ? (
                <View
                  style={styles.notificationBadge}
                >
                  <Text
                    style={
                      styles.notificationBadgeText
                    }
                  >
                    {unreadCount > 99
                      ? '99+'
                      : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <View style={styles.divider} />

          <View style={styles.card}>
            <Text style={styles.eyebrow}>
              YOUR FEED
            </Text>

            <Text style={styles.cardTitle}>
              Your reading world, all in one place.
            </Text>

            <Text style={styles.cardText}>
              Reviews, reactions, discussions, and reading activity from the people and books you care about will appear here.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 22,
    paddingBottom: 120,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brandBlock: {
    flex: 1,
    marginTop: 2,
  },
  logo: {
    color: COLORS.gold,
    fontSize: 43,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: 0.2,
  },
  slogan: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    marginTop: 5,
    letterSpacing: 0.15,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginTop: 4,
    marginLeft: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: COLORS.background,
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    lineHeight: 12,
  },
  divider: {
    width: 42,
    height: 2,
    backgroundColor: COLORS.gold,
    marginTop: 24,
    marginBottom: 28,
    borderRadius: 1,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 21,
  },
  eyebrow: {
    color: COLORS.softGold,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.4,
    marginBottom: 11,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_600SemiBold',
    lineHeight: 31,
  },
  cardText: {
    color: COLORS.secondaryText,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 23,
    marginTop: 12,
  },
  pressed: {
    opacity: 0.68,
  },
});
