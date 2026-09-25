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
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
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
import {
    BlockedReader,
    getBlockedReaders,
} from '../lib/social';

export default function BlockedReadersScreen() {
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
    readers,
    setReaders,
  ] =
    useState<BlockedReader[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState('');


  const loadReaders =
    useCallback(
      async () => {
        try {
          setError(
            ''
          );

          const data =
            await getBlockedReaders();

          setReaders(
            data
          );
        } catch (
          loadError
        ) {
          console.error(
            'Could not load blocked readers:',
            loadError
          );

          setError(
            'Could not load your blocked readers.'
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
    useCallback(
      () => {
        setLoading(
          true
        );

        void loadReaders();
      },
      [
        loadReaders,
      ]
    )
  );

  function openReader(
    reader:
      BlockedReader
  ) {
    router.push({
      pathname:
        '/reader/[id]',
      params: {
        id:
          reader.id,
      },
    });
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
          Blocked Readers
        </Text>

        <View
          style={
            styles.headerButton
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
            size="large"
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
            name="alert-circle-outline"
            size={
              30
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
            Couldn’t load blocked readers
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            {error}
          </Text>

          <Pressable
            onPress={() =>
              void loadReaders()
            }
            style={({ pressed }) => [
              styles.retryButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.retryText
              }
            >
              Try Again
            </Text>
          </Pressable>
        </View>
      ) : readers.length ===
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
              name="ban-outline"
              size={
                26
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
            No blocked readers
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            Readers you block will appear here. Tap a reader to view their profile and manage the block.
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
              styles.description
            }
          >
            Blocked readers can’t follow or interact with you. Tap a reader to open their profile; the normal follow button will show Blocked and lets you unblock them.
          </Text>

          <View
            style={
              styles.card
            }
          >
            {readers.map(
              (
                reader,
                index
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
                    .charAt(
                      0
                    )
                    .toUpperCase();

                return (
                  <View
                    key={
                      reader.id
                    }
                  >
                    <Pressable
                      onPress={() =>
                        openReader(
                          reader
                        )
                      }
                      style={({ pressed }) => [
                        styles.readerRow,
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

                      <View
                        style={
                          styles.blockedBadge
                        }
                      >
                        <Ionicons
                          name="ban-outline"
                          size={
                            14
                          }
                          color={
                            colors.gold
                          }
                        />

                        <Text
                          style={
                            styles.blockedBadgeText
                          }
                        >
                          Blocked
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

                    {index <
                    readers.length -
                      1 ? (
                      <View
                        style={
                          styles.divider
                        }
                      />
                    ) : null}
                  </View>
                );
              }
            )}
          </View>
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
      borderBottomWidth:
        1,
      borderBottomColor:
        colors.border,
      paddingHorizontal:
        14,
    },
    headerButton: {
      width:
        40,
      height:
        40,
      borderRadius:
        20,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    headerTitle: {
      flex:
        1,
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        20,
      textAlign:
        'center',
    },
    centered: {
      flex:
        1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        28,
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
        22,
      paddingBottom:
        44,
    },
    description: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12.5,
      lineHeight:
        19,
      marginBottom:
        13,
      paddingHorizontal:
        3,
    },
    card: {
      backgroundColor:
        colors.surface,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        17,
      overflow:
        'hidden',
    },
    readerRow: {
      minHeight:
        72,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        13,
      paddingVertical:
        10,
    },
    avatar: {
      width:
        44,
      height:
        44,
      borderRadius:
        22,
      marginRight:
        11,
      backgroundColor:
        colors.elevated,
    },
    avatarFallback: {
      width:
        44,
      height:
        44,
      borderRadius:
        22,
      marginRight:
        11,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    avatarText: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        17,
    },
    readerCopy: {
      flex:
        1,
      minWidth:
        0,
    },
    readerName: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        14,
    },
    readerUsername: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11.5,
      marginTop:
        2,
    },
    unblockButton: {
      minWidth:
        78,
      minHeight:
        36,
      borderRadius:
        12,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        12,
      marginLeft:
        10,
    },
    unblockText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        12,
    },
    blockedBadge: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        5,
      paddingHorizontal:
        9,
      minHeight:
        30,
      borderRadius:
        10,
      backgroundColor:
        colors.elevated,
      marginLeft:
        10,
      marginRight:
        7,
    },
    blockedBadgeText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
    },
    divider: {
      height:
        StyleSheet.hairlineWidth,
      backgroundColor:
        colors.border,
      marginLeft:
        68,
    },
    emptyIcon: {
      width:
        52,
      height:
        52,
      borderRadius:
        26,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginBottom:
        14,
    },
    emptyTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        20,
      textAlign:
        'center',
    },
    emptyText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12.5,
      lineHeight:
        19,
      textAlign:
        'center',
      maxWidth:
        360,
      marginTop:
        7,
    },
    retryButton: {
      minHeight:
        40,
      borderRadius:
        12,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        16,
      marginTop:
        16,
    },
    retryText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize:
        12,
    },
    pressed: {
      opacity:
        0.78,
    },
  });
}
