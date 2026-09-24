import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useRouter,
} from 'expo-router';
import type {
  ReactNode,
} from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  PanResponder,
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
  clearAllNotifications,
  clearNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NovoriNotification,
} from '../../lib/notifications';
import {
  getPendingFollowRequestCount,
} from '../../lib/social';
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
  item:
    NovoriNotification
): keyof typeof Ionicons.glyphMap {
  if (
    item.type ===
      'post_vote' ||
    item.type ===
      'comment_vote'
  ) {
    const voteValue =
      Number(
        item.metadata
          ?.vote_value ??
          0
      );

    return voteValue ===
      -1
      ? 'arrow-down-outline'
      : 'arrow-up-outline';
  }

  switch (
    item.type
  ) {
    case 'follow':
    case 'follow_request':
      return 'person-add-outline';
    case 'follow_request_accepted':
      return 'person-circle-outline';
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

const SWIPE_DELETE_MIN_DISTANCE =
  92;

const SWIPE_DELETE_MAX_DISTANCE =
  118;

const SWIPE_DELETE_WIDTH_RATIO =
  0.29;

type SwipeNotificationRowProps = {
  onDelete: () => void;
  styles: ReturnType<
    typeof createStyles
  >;
  children: ReactNode;
};

function SwipeNotificationRow({
  onDelete,
  styles,
  children,
}: SwipeNotificationRowProps) {
  const translateX =
    useRef(
      new Animated.Value(
        0
      )
    ).current;

  const [
    rowWidth,
    setRowWidth,
  ] =
    useState(1);

  const deletingRef =
    useRef(false);

  const resetRow =
    useCallback(
      () => {
        Animated.timing(
          translateX,
          {
            toValue:
              0,
            duration:
              190,
            easing:
              Easing.bezier(
                0.22,
                1,
                0.36,
                1
              ),
            useNativeDriver:
              true,
          }
        ).start();
      },
      [
        translateX,
      ]
    );

  const completeDelete =
    useCallback(
      () => {
        if (
          deletingRef.current
        ) {
          return;
        }

        deletingRef.current =
          true;

        Animated.timing(
          translateX,
          {
            toValue:
              -Math.max(
                rowWidth,
                360
              ),
            duration:
              205,
            easing:
              Easing.bezier(
                0.22,
                1,
                0.36,
                1
              ),
            useNativeDriver:
              true,
          }
        ).start(() => {
          onDelete();
        });
      },
      [
        onDelete,
        rowWidth,
        translateX,
      ]
    );

  const panResponder =
    useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (
            _event,
            gesture
          ) => {
            const horizontal =
              Math.abs(
                gesture.dx
              );

            const vertical =
              Math.abs(
                gesture.dy
              );

            const leftIntent =
              gesture.dx <
                -4 &&
              horizontal >=
                5 &&
              (
                horizontal >
                  vertical *
                    0.62 ||
                (
                  gesture.vx <
                    -0.2 &&
                  horizontal >
                    vertical *
                      0.5
                )
              );

            return leftIntent;
          },

          onMoveShouldSetPanResponderCapture: (
            _event,
            gesture
          ) => {
            const horizontal =
              Math.abs(
                gesture.dx
              );

            const vertical =
              Math.abs(
                gesture.dy
              );

            const strongLeftIntent =
              gesture.dx <
                -6 &&
              horizontal >=
                7 &&
              (
                horizontal >
                  vertical *
                    0.74 ||
                (
                  gesture.vx <
                    -0.27 &&
                  horizontal >
                    vertical *
                      0.62
                )
              );

            return strongLeftIntent;
          },

          onPanResponderMove: (
            _event,
            gesture
          ) => {
            if (
              deletingRef.current
            ) {
              return;
            }

            translateX.setValue(
              Math.min(
                0,
                gesture.dx
              )
            );
          },

          onPanResponderRelease: (
            _event,
            gesture
          ) => {
            if (
              deletingRef.current
            ) {
              return;
            }

            const distance =
              Math.abs(
                Math.min(
                  0,
                  gesture.dx
                )
              );

            const commitDistance =
              Math.min(
                SWIPE_DELETE_MAX_DISTANCE,
                Math.max(
                  SWIPE_DELETE_MIN_DISTANCE,
                  rowWidth *
                    SWIPE_DELETE_WIDTH_RATIO
                )
              );

            const shouldDelete =
              distance >=
                commitDistance ||
              (
                distance >=
                  48 &&
                gesture.vx <=
                  -0.62
              );

            if (
              shouldDelete
            ) {
              completeDelete();
              return;
            }

            resetRow();
          },

          onPanResponderTerminationRequest:
            () => false,

          onPanResponderTerminate:
            resetRow,
        }),
      [
        completeDelete,
        resetRow,
        rowWidth,
        translateX,
      ]
    );

  return (
    <View
      onLayout={(
        event
      ) =>
        setRowWidth(
          event.nativeEvent.layout.width
        )
      }
      style={
        styles.swipeRow
      }
    >
      <View
        pointerEvents="none"
        style={
          styles.deleteReveal
        }
      >
        <Ionicons
          name="close"
          size={
            25
          }
          color="#FFFFFF"
        />

        <Text
          style={
            styles.deleteRevealText
          }
        >
          Delete
        </Text>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.swipeForeground,
          {
            transform: [
              {
                translateX,
              },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}


export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useNovoriTheme();
  const styles = createStyles(colors);

  const isFocusedRef =
    useRef(false);

  const [notifications, setNotifications] =
    useState<NovoriNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] =
    useState<string | null>(null);
  const [
    followRequestCount,
    setFollowRequestCount,
  ] =
    useState(0);

  const [
    visitNewNotificationIds,
    setVisitNewNotificationIds,
  ] =
    useState<
      Record<
        string,
        boolean
      >
    >({});

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
    async (
      showLoader = false,
      markViewed = false
    ) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setError('');

        const [
          notificationData,
          requestCount,
        ] =
          await Promise.all([
            getNotifications(),
            getPendingFollowRequestCount(),
          ]);

        if (
          showLoader
        ) {
          setVisitNewNotificationIds(
            Object.fromEntries(
              notificationData
                .filter(
                  (item) =>
                    !item.read_at
                )
                .map(
                  (item) => [
                    item.id,
                    true,
                  ]
                )
            )
          );
        } else {
          setVisitNewNotificationIds(
            (current) => {
              const next = {
                ...current,
              };

              for (
                const item
                of notificationData
              ) {
                if (
                  !item.read_at
                ) {
                  next[
                    item.id
                  ] = true;
                }
              }

              return next;
            }
          );
        }

        setNotifications(
          notificationData
        );

        setFollowRequestCount(
          requestCount
        );

        if (
          markViewed &&
          notificationData.some(
            (item) =>
              !item.read_at
          )
        ) {
          void markAllNotificationsRead().catch(
            (
              markSeenError
            ) => {
              console.error(
                'Could not mark viewed notifications seen:',
                markSeenError
              );
            }
          );
        }
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
      isFocusedRef.current =
        true;

      loadNotifications(
        true,
        true
      );

      return () => {
        isFocusedRef.current =
          false;

        void markAllNotificationsRead().catch(
          (
            markSeenError
          ) => {
            console.error(
              'Could not finish marking viewed notifications seen:',
              markSeenError
            );
          }
        );
      };
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
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          if (
            payload.eventType ===
            'DELETE'
          ) {
            const deletedId =
              (
                payload.old as {
                  id?: string;
                }
              ).id;

            if (
              deletedId
            ) {
              setNotifications(
                (current) =>
                  current.filter(
                    (item) =>
                      item.id !==
                      deletedId
                  )
              );

            }

            return;
          }

          if (
            isFocusedRef.current
          ) {
            void loadNotifications(
              false,
              true
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    loadNotifications,
    userId,
  ]);

  async function refresh() {
    try {
      setRefreshing(true);
      await loadNotifications(
        false,
        true
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function clearOneNotification(
    notificationId: string
  ) {
    const previous =
      notifications;

    setNotifications(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            notificationId
        )
    );

    try {
      await clearNotification(
        notificationId
      );
    } catch (
      clearError
    ) {
      console.error(
        'Could not clear notification:',
        clearError
      );

      setNotifications(
        previous
      );

      Alert.alert(
        'Could not clear notification',
        'Please try again.'
      );
    }
  }

  async function clearEverything() {
    const previous =
      notifications;

    setNotifications(
      []
    );

    try {
      await clearAllNotifications();
    } catch (
      clearError
    ) {
      console.error(
        'Could not clear notifications:',
        clearError
      );

      setNotifications(
        previous
      );

      Alert.alert(
        'Could not clear notifications',
        'Please try again.'
      );
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

      setVisitNewNotificationIds(
        (current) => {
          if (
            !current[
              item.id
            ]
          ) {
            return current;
          }

          const next = {
            ...current,
          };

          delete next[
            item.id
          ];

          return next;
        }
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

    if (
      item.type ===
      'follow_request'
    ) {
      router.push(
        '/follow-requests'
      );
      return;
    }

    if (
      (
        item.type ===
          'follow' ||
        item.type ===
          'follow_request_accepted'
      ) &&
      (
        item.entity_id ||
        item.actor_id
      )
    ) {
      router.push({
        pathname:
          '/reader/[id]',
        params: {
          id:
            item.entity_id ??
            item.actor_id ??
            '',
        },
      });
      return;
    }

    const postId =
      typeof item.metadata?.post_id ===
      'string'
        ? item.metadata.post_id
        : item.entity_type ===
            'post' &&
          item.entity_id
        ? item.entity_id
        : null;

    if (postId) {
      const commentId =
        typeof item.metadata?.comment_id ===
        'string'
          ? item.metadata.comment_id
          : null;

      router.push({
        pathname:
          '/post/[id]',
        params: {
          id:
            postId,
          ...(commentId
            ? {
                commentId,
              }
            : {}),
        },
      });
      return;
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

    if (
      item.entity_type ===
        'club' &&
      item.entity_id
    ) {
      router.push({
        pathname:
          '/club/[id]',
        params: {
          id:
            item.entity_id,
        },
      });
    }
  }

  function renderNotification(
    item: NovoriNotification
  ) {
    const unread =
      !item.read_at ||
      Boolean(
        visitNewNotificationIds[
          item.id
        ]
      );
    const avatarInitial =
      (
        item.actor_display_name ??
        item.actor_username ??
        'N'
      )
        .charAt(0)
        .toUpperCase();

    return (
      <SwipeNotificationRow
        onDelete={() =>
          void clearOneNotification(
            item.id
          )
        }
        styles={
          styles
        }
      >
        <Pressable
          onPress={() =>
            openNotification(
              item
            )
          }
          style={({ pressed }) => [
            styles.notificationRow,
            unread &&
              styles.notificationRowUnread,
            pressed &&
              styles.pressed,
          ]}
        >
          <View
            style={
              styles.avatarWrap
            }
          >
            {item.actor_avatar_url ? (
              <Image
                source={{
                  uri:
                    item.actor_avatar_url,
                }}
                style={
                  styles.avatarImage
                }
              />
            ) : (
              <View
                style={
                  styles.avatarFallback
                }
              >
                {item.actor_id ? (
                  <Text
                    style={
                      styles.avatarInitial
                    }
                  >
                    {avatarInitial}
                  </Text>
                ) : (
                  <Ionicons
                    name={
                      getNotificationIcon(
                        item
                      )
                    }
                    size={
                      20
                    }
                    color={
                      colors.gold
                    }
                  />
                )}
              </View>
            )}

            <View
              style={
                styles.typeBadge
              }
            >
              <Ionicons
                name={
                  getNotificationIcon(
                    item
                  )
                }
                size={
                  11
                }
                color={
                  colors.background
                }
              />
            </View>
          </View>

          <View
            style={
              styles.notificationCopy
            }
          >
            <View
              style={
                styles.notificationTitleRow
              }
            >
              <Text
                style={
                  styles.notificationTitle
                }
                numberOfLines={
                  2
                }
              >
                {item.title}
              </Text>

              <Text
                style={
                  styles.time
                }
              >
                {formatRelativeTime(
                  item.created_at
                )}
              </Text>
            </View>

            {item.body ? (
              <Text
                style={
                  styles.notificationBody
                }
                numberOfLines={
                  3
                }
              >
                {item.body}
              </Text>
            ) : null}
          </View>

          <View
            style={
              styles.notificationRight
            }
          >
            {item.image_url ? (
              <Image
                source={{
                  uri:
                    item.image_url,
                }}
                style={
                  styles.entityImage
                }
              />
            ) : unread ? (
              <View
                style={
                  styles.unreadDot
                }
              />
            ) : null}
          </View>
        </Pressable>
      </SwipeNotificationRow>
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
          disabled={
            notifications.length ===
            0
          }
          onPress={
            clearEverything
          }
          hitSlop={
            10
          }
          style={({ pressed }) => [
            styles.clearHeaderButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.clearHeaderText,
              notifications.length ===
                0 &&
                styles.clearHeaderTextDisabled,
            ]}
          >
            Clear
          </Text>
        </Pressable>
      </View>

      {followRequestCount >
      0 ? (
        <Pressable
          onPress={() =>
            router.push(
              '/follow-requests'
            )
          }
          style={({ pressed }) => [
            styles.requestBanner,
            pressed &&
              styles.pressed,
          ]}
        >
          <View
            style={
              styles.requestBannerIcon
            }
          >
            <Ionicons
              name="person-add-outline"
              size={
                18
              }
              color={
                colors.gold
              }
            />
          </View>

          <View
            style={
              styles.requestBannerCopy
            }
          >
            <Text
              style={
                styles.requestBannerTitle
              }
            >
              Follow Requests
            </Text>

            <Text
              style={
                styles.requestBannerText
              }
            >
              {followRequestCount}{' '}
              pending {
                followRequestCount ===
                1
                  ? 'request'
                  : 'requests'
              }
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={
              18
            }
            color={
              colors.mutedText
            }
          />
        </Pressable>
      ) : null}

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
          <Text style={styles.emptyTitle}>
            You’re all caught up
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
    clearHeaderButton: {
      minWidth: 62,
      height: 42,
      alignItems:
        'flex-end',
      justifyContent:
        'center',
    },
    clearHeaderText: {
      color:
        colors.gold,
      fontSize: 12,
      fontFamily:
        'Inter_600SemiBold',
    },
    clearHeaderTextDisabled: {
      color:
        colors.mutedText,
    },
    requestBanner: {
      width: '100%',
      maxWidth: 720,
      alignSelf:
        'center',
      minHeight: 64,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        16,
      borderBottomWidth:
        1,
      borderBottomColor:
        colors.border,
      backgroundColor:
        colors.surface,
    },
    requestBannerIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },
    requestBannerCopy: {
      flex: 1,
    },
    requestBannerTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 12,
    },
    requestBannerText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      marginTop: 2,
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
    swipeRow: {
      position:
        'relative',
      overflow:
        'hidden',
      borderRadius:
        20,
      backgroundColor:
        colors.danger,
    },
    swipeForeground: {
      backgroundColor:
        colors.background,
      borderRadius:
        20,
    },
    deleteReveal: {
      ...StyleSheet.absoluteFill,
      backgroundColor:
        colors.danger,
      alignItems:
        'flex-end',
      justifyContent:
        'center',
      paddingRight:
        23,
      gap:
        1,
    },
    deleteRevealText: {
      width:
        44,
      color:
        '#FFFFFF',
      fontFamily:
        'Inter_700Bold',
      fontSize:
        10,
      textAlign:
        'center',
    },
    notificationRow: {
      minHeight: 82,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
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
    notificationRight: {
      minWidth: 18,
      minHeight: 48,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginLeft: 8,
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
      height: 9,
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
