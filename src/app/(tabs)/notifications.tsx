import DeletePostConfirmSheet from '../../components/DeletePostConfirmSheet';
import {INBOX_FILTERS,filterInbox,notificationSectionLabel,notificationCategoryLabel,isClubNotification,type InboxFilter} from '../../lib/notification-inbox';
import { Ionicons } from '@expo/vector-icons';
import {getClubNotificationDestination} from '../../lib/club-notification-route';
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
  containsExplicitLanguage,
  getExplicitLanguagePreference,
  isExplicitContentRevealed,
} from '../../lib/content-filter';
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
import { getReadingReminderDestination, getReadingReminderKind } from '../../lib/reading-reminders';

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
  const reminder = getReadingReminderKind(item);
  if (reminder === 'daily_checkin') return 'checkmark-circle-outline';
  if (reminder === 'still_reading') return 'book-outline';
  if (reminder) return 'calendar-outline';
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
    allowExplicitLanguage,
    setAllowExplicitLanguage,
  ] =
    useState(false);
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

  const [filter, setFilter] = useState<InboxFilter>('all');
  const [clearConfirmVisible, setClearConfirmVisible] = useState(false);
  const [clearing, setClearing] = useState(false);
  const unreadCount = notifications.filter(item => !item.read_at || visitNewNotificationIds[item.id]).length;
  const rows = useMemo(() => {
    const result: Array<{key:string;kind:'header';title:string}|{key:string;kind:'notification';item:NovoriNotification}> = [];
    const groups = new Map<string, NovoriNotification[]>();
    for (const item of filterInbox(notifications, filter)) {
      const label = notificationSectionLabel(item.created_at);
      groups.set(label, [...(groups.get(label) ?? []), item]);
    }
    for (const label of ['Today','Yesterday','Earlier']) {
      const items = groups.get(label);
      if (!items?.length) continue;
      result.push({key:`header-${label}`,kind:'header',title:label});
      for(const item of items) result.push({key:item.id,kind:'notification',item});
    }
    return result;
  }, [notifications, filter]);

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
          explicitLanguagePreference,
        ] =
          await Promise.all([
            getNotifications(),
            getPendingFollowRequestCount(),
            getExplicitLanguagePreference(),
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

        setAllowExplicitLanguage(
          explicitLanguagePreference
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

      const removed = previous.find(item => item.id === notificationId);
      setNotifications(current => removed && !current.some(item => item.id === removed.id) ? [...current, removed].sort((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at)) : current);

      Alert.alert(
        'Could not clear notification',
        'Please try again.'
      );
    }
  }

  async function clearEverything() {
    setClearing(true);
    const previous =
      notifications;

    setNotifications(
      []
    );

    try {
      await clearAllNotifications();
      setVisitNewNotificationIds({});
      setClearConfirmVisible(false);
    } catch (
      clearError
    ) {
      console.error(
        'Could not clear notifications:',
        clearError
      );

      setNotifications(current => [...current, ...previous.filter(item => !current.some(next => next.id === item.id))].sort((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at)));

      Alert.alert(
        'Could not clear notifications',
        'Please try again.'
      );
    } finally { setClearing(false); }
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

    const reminderDestination = getReadingReminderDestination(item);
    if (reminderDestination) {
      router.push(reminderDestination);
      return;
    }

    const clubDestination=getClubNotificationDestination(item);
    if(clubDestination){router.push(clubDestination);return;}

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
    const explicitCommentId =
      typeof item.metadata?.comment_id ===
      'string'
        ? item.metadata.comment_id
        : null;

    const explicitPostId =
      typeof item.metadata?.post_id ===
      'string'
        ? item.metadata.post_id
        : item.entity_type ===
            'post' &&
          item.entity_id
        ? item.entity_id
        : null;

    const explicitBodyWasRevealed =
      explicitCommentId
        ? isExplicitContentRevealed(
            'comment',
            explicitCommentId
          )
        : explicitPostId
        ? isExplicitContentRevealed(
            'post',
            explicitPostId
          )
        : false;

    const hideExplicitBody =
      Boolean(
        item.body
      ) &&
      item.actor_id !==
        userId &&
      !allowExplicitLanguage &&
      !explicitBodyWasRevealed &&
      containsExplicitLanguage(
        item.body
      );

    const avatarInitial =
      (
        item.actor_display_name ??
        item.actor_username ??
        'N'
      )
        .charAt(0)
        .toUpperCase();

    const clubPhoto = isClubNotification(item) && item.entity_type === 'club' ? item.image_url : null;
    return (
      <SwipeNotificationRow key={item.id} onDelete={() => void clearOneNotification(item.id)} styles={styles}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open notification: ${item.id}`} onPress={() => void openNotification(item)} style={({pressed}) => [styles.notificationRow, unread && styles.notificationRowUnread, pressed && styles.pressed]}>
          <View style={styles.avatarWrap}>
            {clubPhoto || item.actor_avatar_url ? <Image source={{uri:(clubPhoto || item.actor_avatar_url)!}} style={[styles.avatarImage,clubPhoto && styles.clubAvatar]}/> :
              <View style={styles.avatarFallback}>{item.actor_id ? <Text style={styles.avatarInitial}>{avatarInitial}</Text> : <Ionicons name={getNotificationIcon(item)} size={20} color={colors.gold}/>}</View>}
            <View style={styles.typeBadge}><Ionicons name={getNotificationIcon(item)} size={10} color={colors.background}/></View>
          </View>
          <View style={styles.notificationCopy}>
            <View style={styles.notificationMeta}><Text style={styles.notificationCategory}>{notificationCategoryLabel(item)}</Text><Text style={styles.time}>· {formatRelativeTime(item.created_at)}</Text>{unread ? <View style={styles.unreadDot}/> : null}</View>
            <Text style={styles.notificationTitle} numberOfLines={2}>{item.title}</Text>
            {item.body ? <Text style={[styles.notificationBody, hideExplicitBody && styles.notificationBodyHidden]} numberOfLines={2}>{hideExplicitBody ? 'Explicit language hidden · Tap to view' : item.body}</Text> : null}
          </View>
          {item.image_url && !clubPhoto ? <Image source={{uri:item.image_url}} style={styles.entityImage}/> : null}
        </Pressable>
      </SwipeNotificationRow>
    );
  }

  const inboxHeader = <>
    <View style={styles.inboxSummary}>
      <View style={styles.summaryHeading}><View style={styles.summaryIcon}><Ionicons name="notifications-outline" size={21} color={colors.gold}/></View><View style={styles.summaryCopy}><Text style={styles.summaryEyebrow}>YOUR CIRCLE</Text><Text style={styles.summaryTitle}>{unreadCount ? `${unreadCount} new ${unreadCount === 1 ? 'update' : 'updates'}` : 'You’re all caught up'}</Text></View>
        {notifications.length ? <Pressable accessibilityRole="button" accessibilityLabel="Clear all notifications" onPress={()=>setClearConfirmVisible(true)} style={styles.clearHeaderButton}><Text style={styles.clearHeaderText}>Clear all</Text></Pressable> : null}
      </View>
      <Text style={styles.summaryHint}>Club chatter, reader replies, and your next chapter.</Text>
      <Text style={styles.swipeHint}>Swipe left on an update to clear it.</Text>
    </View>
    {followRequestCount > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="View follow requests" onPress={()=>router.push('/follow-requests')} style={styles.requestBanner}>
      <View style={styles.requestBannerIcon}><Ionicons name="person-add-outline" size={18} color={colors.gold}/></View><View style={styles.requestBannerCopy}><Text style={styles.requestBannerTitle}>Follow requests</Text><Text style={styles.requestBannerText}>{followRequestCount} {followRequestCount===1?'reader wants':'readers want'} to join your circle</Text></View><Ionicons name="chevron-forward" size={16} color={colors.gold}/>
    </Pressable> : null}
    <View style={styles.filters}>{INBOX_FILTERS.map(option=><Pressable key={option.key} accessibilityRole="button" accessibilityLabel={`Show ${option.label.toLowerCase()} notifications`} accessibilityState={{selected:filter===option.key}} onPress={()=>setFilter(option.key)} style={[styles.filter,filter===option.key&&styles.filterActive]}><Text style={[styles.filterText,filter===option.key&&styles.filterTextActive]}>{option.label}</Text></Pressable>)}</View>
    {error && notifications.length > 0 ? <Text style={styles.emptyText}>Couldn’t refresh. Pull down to try again.</Text> : null}
  </>;
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={()=>router.back()} hitSlop={10} style={styles.headerButton}><Ionicons name="chevron-back" size={24} color={colors.text}/></Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Notification settings" onPress={()=>router.push('/notification-settings')} hitSlop={10} style={styles.headerButton}><Ionicons name="options-outline" size={23} color={colors.gold}/></Pressable>
      </View>
      {loading ? <View style={styles.centered}><ActivityIndicator color={colors.gold}/></View> :
        <FlatList data={rows} keyExtractor={row=>row.key} contentContainerStyle={styles.listContent} ListHeaderComponent={inboxHeader} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold}/>}
          ListEmptyComponent={<View style={styles.emptyState}>
            <View style={styles.emptyIcon}><Ionicons name={error?'cloud-offline-outline':filter==='clubs'?'people-outline':filter==='replies'?'chatbubbles-outline':filter==='reading'?'book-outline':'checkmark-outline'} size={27} color={colors.gold}/></View>
            <Text style={styles.emptyTitle}>{error?'Couldn’t load notifications':filter==='all'?'A quiet moment':`No ${filter} updates yet`}</Text>
            <Text style={styles.emptyText}>{error || (filter==='all'?'Your next conversation will find you here.':filter==='clubs'?'Updates from your clubs will appear here. You can mute any club from its … menu.':filter==='replies'?'Replies to your posts and conversations will appear here.':'Reading reminders and reader milestones will appear here.')}</Text>
            {error ? <Pressable accessibilityRole="button" accessibilityLabel="Retry notifications" onPress={()=>void loadNotifications(true)} style={styles.retryButton}><Text style={styles.retryButtonText}>Try again</Text></Pressable> : null}
          </View>}
          renderItem={({item:row})=>row.kind==='header'?<Text style={styles.sectionLabel}>{row.title}</Text>:renderNotification(row.item)} showsVerticalScrollIndicator={false}/>
      }
      <DeletePostConfirmSheet visible={clearConfirmVisible} busy={clearing} title="Clear your notifications?" message="This clears every update in your inbox, including the other filters. Your posts and conversations stay where they are." confirmLabel="Clear all" onDismiss={()=>{if(!clearing)setClearConfirmVisible(false);}} onConfirm={clearEverything}/>
    </SafeAreaView>
  );
}

function createStyles(colors: NovoriColors) {
  return StyleSheet.create({
    clubAvatar: {borderRadius:12},
    notificationMeta: {flexDirection:'row',alignItems:'center',gap:6,marginBottom:4},
    notificationCategory: {color:colors.mutedText,fontSize:10,fontFamily:'Inter_600SemiBold'},
    inboxSummary: {paddingVertical:17,borderBottomWidth:1,borderBottomColor:colors.gold},
    summaryHeading: {flexDirection:'row',alignItems:'center',gap:11},
    summaryIcon: {width:43,height:43,borderRadius:14,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},
    summaryCopy: {flex:1},
    summaryEyebrow: {color:colors.gold,fontFamily:'Inter_700Bold',fontSize:9,letterSpacing:1.5,marginBottom:4},
    summaryTitle: {color:colors.text,fontFamily:'PlayfairDisplay_700Bold',fontSize:22},
    summaryHint: {color:colors.secondaryText,fontFamily:'Inter_400Regular',fontSize:11,lineHeight:17,marginTop:12},
    swipeHint: {color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:10,marginTop:4},
    filters: {flexDirection:'row',gap:5,paddingTop:15,paddingBottom:1},
    filter: {flex:1,minHeight:36,borderRadius:18,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border},
    filterActive: {backgroundColor:colors.gold,borderColor:colors.gold},
    filterText: {color:colors.secondaryText,fontFamily:'Inter_600SemiBold',fontSize:11},
    filterTextActive: {color:colors.background},
    emptyState: {alignItems:'center',justifyContent:'center',paddingHorizontal:18,paddingVertical:50},
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: { height:58, flexDirection:'row', alignItems:'center', paddingHorizontal:12,
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
    clearHeaderButton: { minHeight:40, paddingLeft:10, justifyContent:'center',
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
    requestBanner: { minHeight:58,flexDirection:'row',alignItems:'center',paddingVertical:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border,
    },
    requestBannerIcon: { width:32,height:32,borderRadius:16,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',marginRight:10,
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
    requestBannerText: { color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:11,marginTop:3,
    },
    listContent: { width:'100%',maxWidth:720,alignSelf:'center',paddingHorizontal:18,paddingBottom:120,flexGrow:1,
    },
    sectionLabel: { color:colors.mutedText,fontSize:10,fontFamily:'Inter_700Bold',letterSpacing:1.3,textTransform:'uppercase',marginTop:20,marginBottom:6,
    },
    swipeRow: { position:'relative',overflow:'hidden',borderRadius:0,backgroundColor:colors.danger,
    },
    swipeForeground: { backgroundColor:colors.background,
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
    notificationRow: { minHeight:82,flexDirection:'row',alignItems:'center',paddingVertical:13,paddingHorizontal:3,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border,backgroundColor:colors.background,
    },
    notificationRowUnread: { backgroundColor:colors.surface,borderLeftWidth:2,borderLeftColor:colors.gold,paddingLeft:9,
    },
    avatarWrap: { width:40,height:40,marginRight:11,position:'relative',
    },
    avatarImage: { width:40,height:40,borderRadius:20,backgroundColor:colors.elevated,
    },
    avatarFallback: { width:40,height:40,borderRadius:20,backgroundColor:colors.elevated,alignItems:'center',justifyContent:'center',
    },
    avatarInitial: {
      color: colors.text,
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 19,
    },
    typeBadge: { position:'absolute',right:-2,bottom:-1,width:18,height:18,borderRadius:9,backgroundColor:colors.gold,borderWidth:2,borderColor:colors.background,alignItems:'center',justifyContent:'center',
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
    notificationTitle: { color:colors.text,fontFamily:'Inter_600SemiBold',fontSize:13,lineHeight:18,
    },
    notificationBody: { color:colors.secondaryText,fontFamily:'Inter_400Regular',fontSize:12,lineHeight:17,marginTop:3,
    },
    notificationBodyHidden: {
      color: colors.mutedText,
      fontFamily: 'Inter_600SemiBold',
    },
    time: { color:colors.mutedText,fontFamily:'Inter_400Regular',fontSize:10,
    },
    entityImage: { width:32,height:45,borderRadius:4,backgroundColor:colors.elevated,marginLeft:10,
    },
    unreadDot: { width:5,height:5,borderRadius:3,backgroundColor:colors.gold,
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
    emptyIcon: { width:52,height:52,borderRadius:26,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center',marginBottom:14,
    },
    emptyTitle: {
      color: colors.text,
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 23,
      textAlign: 'center',
    },
    emptyText: { color:colors.secondaryText,fontFamily:'Inter_400Regular',fontSize:12,lineHeight:18,textAlign:'center',maxWidth:340,marginTop:8,
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
