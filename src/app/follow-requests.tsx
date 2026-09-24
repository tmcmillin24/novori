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
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    NovoriColors,
} from '../constants/novori-theme';
import {
    useNovoriTheme,
} from '../context/theme-context';
import {
    acceptFollowRequest,
    declineFollowRequest,
    getIncomingFollowRequests,
    IncomingFollowRequest,
} from '../lib/social';

function formatRelativeTime(
  value: string
) {
  const difference =
    Date.now() -
    new Date(value).getTime();

  const minute =
    60 * 1000;
  const hour =
    60 * minute;
  const day =
    24 * hour;

  if (
    difference <
    minute
  ) {
    return 'now';
  }

  if (
    difference <
    hour
  ) {
    return `${Math.max(
      1,
      Math.floor(
        difference /
        minute
      )
    )}m`;
  }

  if (
    difference <
    day
  ) {
    return `${Math.floor(
      difference /
      hour
    )}h`;
  }

  return `${Math.floor(
    difference /
    day
  )}d`;
}

export default function FollowRequestsScreen() {
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

  const [
    requests,
    setRequests,
  ] =
    useState<
      IncomingFollowRequest[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busyId,
    setBusyId,
  ] =
    useState<
      string | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState('');

  const loadRequests =
    useCallback(
      async () => {
        try {
          setError(
            ''
          );

          const data =
            await getIncomingFollowRequests();

          setRequests(
            data
          );
        } catch (
          loadError
        ) {
          console.error(
            'Could not load follow requests:',
            loadError
          );

          setError(
            'Could not load follow requests.'
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useFocusEffect(
    useCallback(() => {
      setLoading(
        true
      );
      loadRequests();
    }, [
      loadRequests,
    ])
  );

  function openReader(
    readerId: string
  ) {
    router.push({
      pathname:
        '/reader/[id]',
      params: {
        id:
          readerId,
      },
    });
  }

  async function accept(
    requesterId: string
  ) {
    try {
      setBusyId(
        requesterId
      );

      await acceptFollowRequest(
        requesterId
      );

      setRequests(
        (current) =>
          current.filter(
            (item) =>
              item.requester_id !==
              requesterId
          )
      );
    } catch (
      actionError
    ) {
      console.error(
        'Could not accept follow request:',
        actionError
      );

      Alert.alert(
        'Could not accept request',
        'Please try again.'
      );
    } finally {
      setBusyId(
        null
      );
    }
  }

  async function decline(
    requesterId: string
  ) {
    try {
      setBusyId(
        requesterId
      );

      await declineFollowRequest(
        requesterId
      );

      setRequests(
        (current) =>
          current.filter(
            (item) =>
              item.requester_id !==
              requesterId
          )
      );
    } catch (
      actionError
    ) {
      console.error(
        'Could not decline follow request:',
        actionError
      );

      Alert.alert(
        'Could not decline request',
        'Please try again.'
      );
    } finally {
      setBusyId(
        null
      );
    }
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
          hitSlop={
            10
          }
          style={({ pressed }) => [
            styles.headerButton,
            pressed &&
              styles.pressed,
          ]}
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
          Follow Requests
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      {loading ? (
        <View
          style={
            styles.centered
          }
        >
          <ActivityIndicator
            size="small"
            color={
              colors.gold
            }
          />
        </View>
      ) : error ? (
        <View
          style={
            styles.centered
          }
        >
          <Ionicons
            name="cloud-offline-outline"
            size={
              32
            }
            color={
              colors.mutedText
            }
          />

          <Text
            style={
              styles.emptyTitle
            }
          >
            Couldn’t load requests
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            {error}
          </Text>

          <Pressable
            onPress={() => {
              setLoading(
                true
              );
              loadRequests();
            }}
            style={
              styles.retryButton
            }
          >
            <Text
              style={
                styles.retryButtonText
              }
            >
              Try Again
            </Text>
          </Pressable>
        </View>
      ) : requests.length ===
        0 ? (
        <View
          style={
            styles.centered
          }
        >
          <View
            style={
              styles.emptyIcon
            }
          >
            <Ionicons
              name="person-add-outline"
              size={
                28
              }
              color={
                colors.gold
              }
            />
          </View>

          <Text
            style={
              styles.emptyTitle
            }
          >
            No pending requests.
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            When your profile is private, follow requests will appear here for approval.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={
            styles.content
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <Text
            style={
              styles.intro
            }
          >
            Approve the readers you want to let into your private profile.
          </Text>

          {requests.map(
            (request) => {
              const displayName =
                request.display_name
                  ?.trim() ||
                request.username
                  ?.trim() ||
                'Novori Reader';

              const username =
                request.username
                  ?.trim()
                  ? `@${request.username.trim()}`
                  : '';

              const initial =
                displayName
                  .charAt(0)
                  .toUpperCase();

              const busy =
                busyId ===
                request.requester_id;

              return (
                <View
                  key={
                    request.requester_id
                  }
                  style={
                    styles.requestCard
                  }
                >
                  <Pressable
                    onPress={() =>
                      openReader(
                        request.requester_id
                      )
                    }
                    style={({ pressed }) => [
                      styles.readerMain,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    {request.avatar_url ? (
                      <Image
                        source={{
                          uri:
                            request.avatar_url,
                        }}
                        style={
                          styles.avatar
                        }
                      />
                    ) : (
                      <View
                        style={
                          styles.avatarFallback
                        }
                      >
                        <Text
                          style={
                            styles.avatarText
                          }
                        >
                          {initial}
                        </Text>
                      </View>
                    )}

                    <View
                      style={
                        styles.readerCopy
                      }
                    >
                      <Text
                        style={
                          styles.readerName
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {displayName}
                      </Text>

                      {username ? (
                        <Text
                          style={
                            styles.readerUsername
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {username}
                        </Text>
                      ) : null}

                      <Text
                        style={
                          styles.requestTime
                        }
                      >
                        Requested {
                          formatRelativeTime(
                            request.created_at
                          )
                        } ago
                      </Text>
                    </View>
                  </Pressable>

                  <View
                    style={
                      styles.actions
                    }
                  >
                    <Pressable
                      disabled={
                        busy
                      }
                      onPress={() =>
                        decline(
                          request.requester_id
                        )
                      }
                      style={({ pressed }) => [
                        styles.declineButton,
                        pressed &&
                          !busy &&
                          styles.pressed,
                      ]}
                    >
                      <Text
                        style={
                          styles.declineButtonText
                        }
                      >
                        Decline
                      </Text>
                    </Pressable>

                    <Pressable
                      disabled={
                        busy
                      }
                      onPress={() =>
                        accept(
                          request.requester_id
                        )
                      }
                      style={({ pressed }) => [
                        styles.acceptButton,
                        pressed &&
                          !busy &&
                          styles.pressed,
                      ]}
                    >
                      {busy ? (
                        <ActivityIndicator
                          size="small"
                          color={
                            colors.background
                          }
                        />
                      ) : (
                        <Text
                          style={
                            styles.acceptButtonText
                          }
                        >
                          Accept
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            }
          )}
        </ScrollView>
      )}
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
    header: {
      height: 58,
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
      width: 42,
      height: 42,
      borderRadius:
        21,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    headerTitle: {
      flex: 1,
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 20,
      textAlign:
        'center',
    },
    headerSpacer: {
      width: 42,
    },
    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf:
        'center',
      paddingHorizontal:
        16,
      paddingTop: 16,
      paddingBottom:
        60,
      gap: 10,
    },
    intro: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 3,
      paddingHorizontal: 4,
    },
    requestCard: {
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 17,
      padding: 11,
    },
    readerMain: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        colors.elevated,
      marginRight: 11,
    },
    avatarFallback: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },
    avatarText: {
      color:
        colors.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 18,
    },
    readerCopy: {
      flex: 1,
      minWidth: 0,
    },
    readerName: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 13,
    },
    readerUsername: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      marginTop: 2,
    },
    requestTime: {
      color:
        colors.softGold,
      fontFamily:
        'Inter_500Medium',
      fontSize: 9,
      marginTop: 5,
    },
    actions: {
      flexDirection:
        'row',
      justifyContent:
        'flex-end',
      gap: 8,
      marginTop: 11,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor:
        colors.border,
    },
    declineButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 11,
      backgroundColor:
        colors.elevated,
      borderWidth: 1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 12,
    },
    declineButtonText: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10,
    },
    acceptButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 11,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 12,
    },
    acceptButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10,
    },
    centered: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        34,
      paddingBottom:
        80,
    },
    emptyIcon: {
      width: 60,
      height: 60,
      borderRadius:
        30,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom: 16,
    },
    emptyTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 22,
      textAlign:
        'center',
    },
    emptyText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      lineHeight: 20,
      textAlign:
        'center',
      maxWidth: 390,
      marginTop: 7,
    },
    retryButton: {
      minHeight: 40,
      borderRadius: 11,
      backgroundColor:
        colors.gold,
      paddingHorizontal: 16,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 16,
    },
    retryButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 11,
    },
    pressed: {
      opacity: 0.68,
    },
  });
}
