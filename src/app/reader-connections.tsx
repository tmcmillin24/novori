import { Ionicons } from '@expo/vector-icons';
import {
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import {
    useCallback,
    useState,
} from 'react';
import {
    ActivityIndicator,
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
    followReader,
    unfollowReader,
} from '../lib/feed';
import {
    getReaderConnections,
    ReaderConnection,
    ReaderConnectionType,
} from '../lib/social';

export default function ReaderConnectionsScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      readerId?: string;
      mode?: string;
      name?: string;
    }>();

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const readerId =
    typeof params.readerId ===
    'string'
      ? params.readerId
      : '';

  const mode:
    ReaderConnectionType =
      params.mode ===
      'following'
        ? 'following'
        : 'followers';

  const readerName =
    typeof params.name ===
    'string'
      ? params.name
      : 'Reader';

  const [
    readers,
    setReaders,
  ] =
    useState<
      ReaderConnection[]
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

  const loadConnections =
    useCallback(
      async () => {
        if (!readerId) {
          setError(
            'Reader not found.'
          );
          setLoading(
            false
          );
          return;
        }

        try {
          setError(
            ''
          );

          const data =
            await getReaderConnections(
              readerId,
              mode
            );

          setReaders(
            data
          );
        } catch (
          loadError
        ) {
          console.error(
            'Could not load reader connections:',
            loadError
          );

          setError(
            `Could not load ${mode}.`
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        mode,
        readerId,
      ]
    );

  useFocusEffect(
    useCallback(() => {
      setLoading(
        true
      );

      loadConnections();
    }, [
      loadConnections,
    ])
  );

  function openReader(
    id: string
  ) {
    router.push({
      pathname:
        '/reader/[id]',
      params: {
        id,
      },
    });
  }

  async function toggleReaderFollow(
    reader:
      ReaderConnection
  ) {
    if (
      reader.is_self
    ) {
      return;
    }

    try {
      setBusyId(
        reader.id
      );

      if (
        reader.is_following
      ) {
        await unfollowReader(
          reader.id
        );
      } else {
        await followReader(
          reader.id
        );
      }

      await loadConnections();
    } catch (
      followError
    ) {
      console.error(
        'Could not update follow:',
        followError
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

        <View
          style={
            styles.headerCopy
          }
        >
          <Text
            style={
              styles.headerTitle
            }
          >
            {mode ===
            'followers'
              ? 'Followers'
              : 'Following'}
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
            numberOfLines={
              1
            }
          >
            {readerName}
          </Text>
        </View>

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
          <Text
            style={
              styles.emptyTitle
            }
          >
            Could not load list
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            {error}
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
          {readers.length >
          0 ? (
            readers.map(
              (
                reader
              ) => {
                const displayName =
                  reader.display_name
                    ?.trim() ||
                  reader.username
                    ?.trim() ||
                  'Novori Reader';

                const username =
                  reader.username
                    ?.trim()
                    ? `@${reader.username.trim()}`
                    : '';

                const initial =
                  displayName
                    .charAt(0)
                    .toUpperCase();

                return (
                  <View
                    key={
                      reader.id
                    }
                    style={
                      styles.readerRow
                    }
                  >
                    <Pressable
                      onPress={() =>
                        openReader(
                          reader.id
                        )
                      }
                      style={({ pressed }) => [
                        styles.readerMain,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      {reader.avatar_url ? (
                        <Image
                          source={{
                            uri:
                              reader.avatar_url,
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
                      </View>
                    </Pressable>

                    {reader.is_self ? (
                      <View
                        style={
                          styles.youBadge
                        }
                      >
                        <Text
                          style={
                            styles.youBadgeText
                          }
                        >
                          You
                        </Text>
                      </View>
                    ) : (
                      <Pressable
                        disabled={
                          busyId ===
                          reader.id
                        }
                        onPress={() =>
                          toggleReaderFollow(
                            reader
                          )
                        }
                        style={({ pressed }) => [
                          reader.is_following
                            ? styles.followingButton
                            : styles.followButton,
                          pressed &&
                            styles.pressed,
                        ]}
                      >
                        {busyId ===
                        reader.id ? (
                          <ActivityIndicator
                            size="small"
                            color={
                              reader.is_following
                                ? colors.text
                                : colors.background
                            }
                          />
                        ) : (
                          <Text
                            style={
                              reader.is_following
                                ? styles.followingButtonText
                                : styles.followButtonText
                            }
                          >
                            {reader.is_following
                              ? 'Following'
                              : 'Follow'}
                          </Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              }
            )
          ) : (
            <View
              style={
                styles.emptyCard
              }
            >
              <Ionicons
                name="people-outline"
                size={
                  28
                }
                color={
                  colors.gold
                }
              />

              <Text
                style={
                  styles.emptyTitle
                }
              >
                {mode ===
                'followers'
                  ? 'No followers yet.'
                  : 'Not following anyone yet.'}
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                This list will fill in as the reader connects with people on Novori.
              </Text>
            </View>
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
      height: 60,
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
      width: 40,
      height: 40,
      borderRadius:
        20,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    headerCopy: {
      flex: 1,
      alignItems:
        'center',
    },
    headerTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 19,
    },
    headerSubtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      marginTop: 1,
      maxWidth: 220,
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf:
        'center',
      paddingHorizontal:
        20,
      paddingTop: 16,
      paddingBottom:
        60,
      gap: 9,
    },
    readerRow: {
      minHeight: 70,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 16,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        11,
      paddingVertical:
        9,
      gap: 10,
    },
    readerMain: {
      flex: 1,
      minWidth: 0,
      flexDirection:
        'row',
      alignItems:
        'center',
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor:
        colors.elevated,
      marginRight: 10,
    },
    avatarFallback: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
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
      marginTop: 3,
    },
    followButton: {
      minWidth: 76,
      minHeight: 34,
      borderRadius: 11,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        10,
    },
    followButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10,
    },
    followingButton: {
      minWidth: 76,
      minHeight: 34,
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
      paddingHorizontal:
        10,
    },
    followingButtonText: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10,
    },
    youBadge: {
      minWidth: 54,
      minHeight: 30,
      borderRadius: 10,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        9,
    },
    youBadgeText: {
      color:
        colors.mutedText,
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
        30,
    },
    emptyCard: {
      minHeight: 200,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 17,
      alignItems:
        'center',
      justifyContent:
        'center',
      padding: 24,
    },
    emptyTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 18,
      textAlign:
        'center',
      marginTop: 10,
    },
    emptyText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      lineHeight: 17,
      textAlign:
        'center',
      marginTop: 6,
      maxWidth: 400,
    },
    pressed: {
      opacity: 0.68,
    },
  });
}
