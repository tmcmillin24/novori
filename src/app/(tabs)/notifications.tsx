import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NovoriColors } from '../../constants/novori-theme';
import { useNovoriTheme } from '../../context/theme-context';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NovoriNotification,
} from '../../lib/notifications';
import { supabase } from '../../lib/supabase';

function formatRelativeTime(value: string) {
  const difference =
    Date.now() - new Date(value).getTime();

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (difference < minute) return 'now';
  if (difference < hour) {
    return `${Math.max(1, Math.floor(difference / minute))}m`;
  }
  if (difference < day) {
    return `${Math.floor(difference / hour)}h`;
  }
  if (difference < 7 * day) {
    return `${Math.floor(difference / day)}d`;
  }

  return new Date(value).toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
    }
  );
}

function getNotificationIcon(
  type: NovoriNotification['type']
): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'follow':
      return 'person-add-outline';
    case 'post_like':
    case 'review_like':
      return 'heart-outline';
    case 'comment':
    case 'reply':
      return 'chatbubble-outline';
    case 'club_invite':
    case 'club_member':
      return 'people-outline';
    case 'club_post':
      return 'megaphone-outline';
    case 'club_event':
      return 'calendar-outline';
    case 'reading_started':
      return 'book-outline';
    case 'reading_finished':
      return 'checkmark-circle-outline';
    default:
      return 'notifications-outline';
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useNovoriTheme();
  const styles = createStyles(colors);

  const [notifications, setNotifications] =
    useState<NovoriNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] =
    useState<string | null>(null);

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (item) => !item.read_at
      ).length,
    [notifications]
  );

  const rows = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const today =
      notifications.filter(
        (item) =>
          new Date(item.created_at).getTime() >=
          startOfToday.getTime()
      );

    const earlier =
      notifications.filter(
        (item) =>
          new Date(item.created_at).getTime() <
          startOfToday.getTime()
      );

    const result:
      Array<
        | {
            key: string;
            kind: 'header';
            title: string;
          }
        | {
            key: string;
            kind: 'notification';
            item: NovoriNotification;
          }
      > = [];

    function append(
      title: string,
      items: NovoriNotification[]
    ) {
      if (!items.length) return;

      result.push({
        key: `header-${title}`,
        kind: 'header',
        title,
      });

      for (const item of items) {
        result.push({
          key: item.id,
          kind: 'notification',
          item,
        });
      }
    }

    append('Today', today);
    append('Earlier', earlier);

    return result;
  }, [notifications]);

  const loadNotifications = useCallback(
    async (showLoader = false) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setError('');
        setNotifications(
          await getNotifications()
        );
      } catch (loadError) {
        console.error(
          'Could not load notifications:',
          loadError
        );

        setError(
          'Could not load your notifications.'
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      loadNotifications(true);
    }, [loadNotifications])
  );

  useEffect(() => {
    let active = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (active) {
        setUserId(user?.id ?? null);
      }
    }

    loadUser();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const incoming =
            payload.new as NovoriNotification;

          setNotifications(
            (current) =>
              current.some(
                (item) =>
                  item.id === incoming.id
              )
                ? current
                : [incoming, ...current]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  async function refresh() {
    try {
      setRefreshing(true);
      await loadNotifications(false);
    } finally {
      setRefreshing(false);
    }
  }

  async function markAllRead() {
    if (!unreadCount) return;

    const readAt =
      new Date().toISOString();

    setNotifications(
      (current) =>
        current.map((item) => ({
          ...item,
          read_at:
            item.read_at ?? readAt,
        }))
    );

    try {
      await markAllNotificationsRead();
    } catch (updateError) {
      console.error(
        'Could not mark notifications read:',
        updateError
      );
      await loadNotifications(false);
    }
  }

  async function openNotification(
    item: NovoriNotification
  ) {
    if (!item.read_at) {
      const readAt =
        new Date().toISOString();

      setNotifications(
        (current) =>
          current.map(
            (notification) =>
              notification.id === item.id
                ? {
                    ...notification,
                    read_at: readAt,
                  }
                : notification
          )
      );

      try {
        await markNotificationRead(item.id);
      } catch (updateError) {
        console.error(
          'Could not mark notification read:',
          updateError
        );
      }
    }

    const googleBookId =
      typeof item.metadata?.google_book_id ===
      'string'
        ? item.metadata.google_book_id
        : null;

    if (googleBookId) {
      router.push({
        pathname: '/book/[id]',
        params: {
          id: googleBookId,
          source: 'notifications',
        },
      });
      return;
    }

    if (item.entity_type === 'club') {
      Alert.alert(
        'Clubs are next',
        'This notification is ready to open the related Club once Clubs are implemented.'
      );
    }
  }

  function renderNotification(
    item: NovoriNotification
  ) {
    const unread = !item.read_at;
    const avatarInitial =
      (
        item.actor_display_name ??
        item.actor_username ??
        'N'
      )
        .charAt(0)
        .toUpperCase();

    return (
      <Pressable
        onPress={() =>
          openNotification(item)
        }
        style={({ pressed }) => [
          styles.notificationRow,
          unread &&
            styles.notificationRowUnread,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.avatarWrap}>
          {item.actor_avatar_url ? (
            <Image
              source={{
                uri: item.actor_avatar_url,
              }}
              style={styles.avatarImage}
            />
          ) : (
            <View
              style={styles.avatarFallback}
            >
              {item.actor_id ? (
                <Text
                  style={styles.avatarInitial}
                >
                  {avatarInitial}
                </Text>
              ) : (
                <Ionicons
                  name={getNotificationIcon(
                    item.type
                  )}
                  size={20}
                  color={colors.gold}
                />
              )}
            </View>
          )}

          <View style={styles.typeBadge}>
            <Ionicons
              name={getNotificationIcon(
                item.type
              )}
              size={11}
              color={colors.background}
            />
          </View>
        </View>

        <View style={styles.notificationCopy}>
          <View
            style={styles.notificationTitleRow}
          >
            <Text
              style={styles.notificationTitle}
              numberOfLines={2}
            >
              {item.title}
            </Text>

            <Text style={styles.time}>
              {formatRelativeTime(
                item.created_at
              )}
            </Text>
          </View>

          {item.body ? (
            <Text
              style={styles.notificationBody}
              numberOfLines={3}
            >
              {item.body}
            </Text>
          ) : null}
        </View>

        {item.image_url ? (
          <Image
            source={{
              uri: item.image_url,
            }}
            style={styles.entityImage}
          />
        ) : unread ? (
          <View style={styles.unreadDot} />
        ) : null}
      </Pressable>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top']}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={colors.text}
          />
        </Pressable>

        <Text style={styles.headerTitle}>
          Notifications
        </Text>

        <Pressable
          disabled={unreadCount === 0}
          onPress={markAllRead}
          hitSlop={10}
          style={({ pressed }) => [
            styles.markAllButton,
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.markAllText,
              unreadCount === 0 &&
                styles.markAllTextDisabled,
            ]}
          >
            Read all
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator
            size="small"
            color={colors.gold}
          />
        </View>
      ) : error &&
        notifications.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons
            name="cloud-offline-outline"
            size={34}
            color={colors.mutedText}
          />

          <Text style={styles.emptyTitle}>
            Couldn’t load notifications
          </Text>

          <Text style={styles.emptyText}>
            {error}
          </Text>

          <Pressable
            onPress={() =>
              loadNotifications(true)
            }
            style={styles.retryButton}
          >
            <Text
              style={styles.retryButtonText}
            >
              Try Again
            </Text>
          </Pressable>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="notifications-outline"
              size={30}
              color={colors.gold}
            />
          </View>

          <Text style={styles.emptyTitle}>
            You’re all caught up.
          </Text>

          <Text style={styles.emptyText}>
            New followers, replies, club activity, and the reading updates you choose to follow will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={
            styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.gold}
            />
          }
          renderItem={({ item: row }) =>
            row.kind === 'header' ? (
              <Text
                style={styles.sectionLabel}
              >
                {row.title}
              </Text>
            ) : (
              renderNotification(row.item)
            )
          }
          ItemSeparatorComponent={() => (
            <View style={styles.separator} />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: NovoriColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      height: 58,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      color: colors.text,
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 21,
      textAlign: 'center',
    },
    markAllButton: {
      minWidth: 62,
      height: 42,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    markAllText: {
      color: colors.gold,
      fontSize: 12,
      fontFamily: 'Inter_600SemiBold',
    },
    markAllTextDisabled: {
      color: colors.mutedText,
    },
    listContent: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 120,
    },
    sectionLabel: {
      color: colors.mutedText,
      fontSize: 11,
      fontFamily: 'Inter_700Bold',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 18,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    notificationRow: {
      minHeight: 82,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 15,
    },
    notificationRowUnread: {
      backgroundColor: colors.surface,
    },
    avatarWrap: {
      width: 48,
      height: 48,
      marginRight: 12,
      position: 'relative',
    },
    avatarImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.elevated,
    },
    avatarFallback: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.elevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: {
      color: colors.text,
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 19,
    },
    typeBadge: {
      position: 'absolute',
      right: -2,
      bottom: -1,
      width: 21,
      height: 21,
      borderRadius: 11,
      backgroundColor: colors.gold,
      borderWidth: 2,
      borderColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationCopy: {
      flex: 1,
      minWidth: 0,
    },
    notificationTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    notificationTitle: {
      flex: 1,
      color: colors.text,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      lineHeight: 19,
    },
    notificationBody: {
      color: colors.secondaryText,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
      marginTop: 3,
    },
    time: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      marginTop: 1,
    },
    entityImage: {
      width: 42,
      height: 58,
      borderRadius: 6,
      backgroundColor: colors.elevated,
      marginLeft: 10,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.gold,
      marginLeft: 10,
      marginRight: 2,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 70,
      opacity: 0.7,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 34,
      paddingBottom: 80,
    },
    emptyIcon: {
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },
    emptyTitle: {
      color: colors.text,
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 23,
      textAlign: 'center',
    },
    emptyText: {
      color: colors.secondaryText,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      lineHeight: 21,
      textAlign: 'center',
      maxWidth: 390,
      marginTop: 8,
    },
    retryButton: {
      marginTop: 18,
      minHeight: 42,
      paddingHorizontal: 18,
      borderRadius: 12,
      backgroundColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryButtonText: {
      color: colors.background,
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
    },
    pressed: {
      opacity: 0.68,
    },
  });
}
