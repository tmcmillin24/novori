import { Ionicons } from '@expo/vector-icons';
import {
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import {
    useEffect,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
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
    ClubWithMembership,
    getMyClubs,
} from '../lib/clubs';
import {
    createPost,
} from '../lib/feed';

type Destination =
  | {
      type: 'profile';
      clubId: null;
    }
  | {
      type: 'club';
      clubId: string;
    };

export default function CreatePostScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      clubId?: string;
    }>();

  const requestedClubId =
    typeof params.clubId ===
    'string'
      ? params.clubId
      : '';

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const [
    body,
    setBody,
  ] =
    useState('');

  const [
    clubs,
    setClubs,
  ] =
    useState<
      ClubWithMembership[]
    >([]);

  const [
    loadingClubs,
    setLoadingClubs,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    destination,
    setDestination,
  ] =
    useState<Destination>({
      type:
        'profile',
      clubId:
        null,
    });

  useEffect(() => {
    let active =
      true;

    async function load() {
      try {
        const myClubs =
          await getMyClubs();

        if (
          active
        ) {
          setClubs(
            myClubs
          );

          if (
            requestedClubId &&
            myClubs.some(
              (club) =>
                club.id ===
                requestedClubId
            )
          ) {
            setDestination({
              type:
                'club',
              clubId:
                requestedClubId,
            });
          }
        }
      } catch (
        error
      ) {
        console.error(
          'Could not load post destinations:',
          error
        );
      } finally {
        if (
          active
        ) {
          setLoadingClubs(
            false
          );
        }
      }
    }

    load();

    return () => {
      active =
        false;
    };
  }, [
    requestedClubId,
  ]);

  const trimmedBody =
    body.trim();

  const canPost =
    trimmedBody.length >
      0 &&
    trimmedBody.length <=
      4000 &&
    !saving;

  async function handlePost() {
    if (
      !canPost
    ) {
      return;
    }

    try {
      setSaving(
        true
      );

      await createPost({
        body:
          trimmedBody,
        clubId:
          destination.type ===
          'club'
            ? destination.clubId
            : null,
      });

      if (
        destination.type ===
        'club' &&
        requestedClubId
      ) {
        router.replace({
          pathname:
            '/club/[id]',
          params: {
            id:
              destination.clubId,
          },
        });
      } else {
        router.replace(
          '/(tabs)'
        );
      }
    } catch (
      error
    ) {
      console.error(
        'Could not create post:',
        error
      );

      Alert.alert(
        'Could not post',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  function renderClub(
    club:
      ClubWithMembership
  ) {
    const selected =
      destination.type ===
        'club' &&
      destination.clubId ===
        club.id;

    const initial =
      club.name
        .charAt(0)
        .toUpperCase();

    return (
      <Pressable
        key={
          club.id
        }
        onPress={() =>
          setDestination({
            type:
              'club',
            clubId:
              club.id,
          })
        }
        style={({
          pressed,
        }) => [
          styles.destinationRow,
          selected &&
            styles.destinationRowSelected,
          pressed &&
            styles.pressed,
        ]}
      >
        {club.cover_url ? (
          <Image
            source={{
              uri:
                club.cover_url,
            }}
            style={
              styles.clubAvatar
            }
          />
        ) : (
          <View
            style={
              styles.clubAvatarFallback
            }
          >
            <Text
              style={
                styles.clubAvatarText
              }
            >
              {initial}
            </Text>
          </View>
        )}

        <View
          style={
            styles.destinationCopy
          }
        >
          <Text
            style={
              styles.destinationTitle
            }
            numberOfLines={
              1
            }
          >
            {club.name}
          </Text>

          <Text
            style={
              styles.destinationSubtitle
            }
          >
            Members of this club will see the post in their Feed.
          </Text>
        </View>

        <Ionicons
          name={
            selected
              ? 'radio-button-on'
              : 'radio-button-off'
          }
          size={
            21
          }
          color={
            selected
              ? colors.gold
              : colors.mutedText
          }
        />
      </Pressable>
    );
  }

  const profileSelected =
    destination.type ===
    'profile';

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
      <KeyboardAvoidingView
        style={
          styles.keyboardView
        }
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
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
            hitSlop={
              10
            }
            style={({
              pressed,
            }) => [
              styles.headerButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="close"
              size={
                25
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
            Create Post
          </Text>

          <Pressable
            disabled={
              !canPost
            }
            onPress={
              handlePost
            }
            style={({
              pressed,
            }) => [
              styles.headerPostButton,
              !canPost &&
                styles.headerPostButtonDisabled,
              pressed &&
                canPost &&
                styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.background
                }
              />
            ) : (
              <Text
                style={
                  styles.headerPostButtonText
                }
              >
                Post
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.content
          }
        >
          <Text
            style={
              styles.label
            }
          >
            POST TO
          </Text>

          <View
            style={
              styles.destinationCard
            }
          >
            <Pressable
              onPress={() =>
                setDestination({
                  type:
                    'profile',
                  clubId:
                    null,
                })
              }
              style={({
                pressed,
              }) => [
                styles.destinationRow,
                profileSelected &&
                  styles.destinationRowSelected,
                pressed &&
                  styles.pressed,
              ]}
            >
              <View
                style={
                  styles.profileDestinationIcon
                }
              >
                <Ionicons
                  name="person-outline"
                  size={
                    20
                  }
                  color={
                    profileSelected
                      ? colors.gold
                      : colors.mutedText
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
                  My Profile
                </Text>

                <Text
                  style={
                    styles.destinationSubtitle
                  }
                >
                  Readers who follow you will see this in their Feed.
                </Text>
              </View>

              <Ionicons
                name={
                  profileSelected
                    ? 'radio-button-on'
                    : 'radio-button-off'
                }
                size={
                  21
                }
                color={
                  profileSelected
                    ? colors.gold
                    : colors.mutedText
                }
              />
            </Pressable>

            {loadingClubs ? (
              <View
                style={
                  styles.loadingClubs
                }
              >
                <ActivityIndicator
                  size="small"
                  color={
                    colors.gold
                  }
                />
              </View>
            ) : clubs.length >
              0 ? (
              <>
                <View
                  style={
                    styles.divider
                  }
                />

                {clubs.map(
                  (
                    club,
                    index
                  ) => (
                    <View
                      key={
                        club.id
                      }
                    >
                      {renderClub(
                        club
                      )}

                      {index <
                      clubs.length -
                        1 ? (
                        <View
                          style={
                            styles.divider
                          }
                        />
                      ) : null}
                    </View>
                  )
                )}
              </>
            ) : null}
          </View>

          <Text
            style={
              styles.label
            }
          >
            YOUR POST
          </Text>

          <View
            style={
              styles.composerCard
            }
          >
            <TextInput
              value={
                body
              }
              onChangeText={
                setBody
              }
              placeholder="What are you reading, thinking, or wanting to discuss?"
              placeholderTextColor={
                colors.mutedText
              }
              multiline
              maxLength={
                4000
              }
              textAlignVertical="top"
              autoFocus
              style={
                styles.composer
              }
            />

            <Text
              style={
                styles.counter
              }
            >
              {body.length}/4000
            </Text>
          </View>

          <View
            style={
              styles.infoBox
            }
          >
            <Ionicons
              name="information-circle-outline"
              size={
                18
              }
              color={
                colors.gold
              }
            />

            <Text
              style={
                styles.infoText
              }
            >
              Club posts stay attached to that club. Profile posts appear in the Home feeds of readers who follow you.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    keyboardView: {
      flex: 1,
    },
    header: {
      height: 56,
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
    headerPostButton: {
      minWidth: 58,
      height: 36,
      borderRadius:
        12,
      backgroundColor:
        colors.gold,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        10,
    },
    headerPostButtonDisabled: {
      opacity: 0.42,
    },
    headerPostButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 12,
    },
    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf:
        'center',
      paddingHorizontal:
        20,
      paddingTop: 14,
      paddingBottom:
        70,
    },
    label: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_700Bold',
      fontSize: 11,
      letterSpacing:
        0.9,
      marginTop: 15,
      marginBottom: 8,
      paddingHorizontal:
        4,
    },
    destinationCard: {
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius:
        17,
      overflow:
        'hidden',
    },
    destinationRow: {
      minHeight: 78,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        13,
      paddingVertical:
        10,
    },
    destinationRowSelected: {
      backgroundColor:
        colors.elevated,
    },
    profileDestinationIcon: {
      width: 44,
      height: 44,
      borderRadius:
        14,
      backgroundColor:
        colors.background,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },
    clubAvatar: {
      width: 44,
      height: 44,
      borderRadius:
        14,
      backgroundColor:
        colors.background,
      marginRight: 11,
    },
    clubAvatarFallback: {
      width: 44,
      height: 44,
      borderRadius:
        14,
      backgroundColor:
        colors.background,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 11,
    },
    clubAvatarText: {
      color:
        colors.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 19,
    },
    destinationCopy: {
      flex: 1,
      paddingRight: 10,
    },
    destinationTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 14,
    },
    destinationSubtitle: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },
    divider: {
      height: 1,
      backgroundColor:
        colors.border,
      marginLeft: 68,
    },
    loadingClubs: {
      minHeight: 56,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    composerCard: {
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius:
        17,
      padding: 15,
    },
    composer: {
      minHeight: 180,
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize: 15,
      lineHeight: 22,
      padding: 0,
    },
    counter: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 10,
      textAlign:
        'right',
      marginTop: 8,
    },
    infoBox: {
      flexDirection:
        'row',
      gap: 9,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius:
        15,
      padding: 13,
      marginTop: 18,
    },
    infoText: {
      flex: 1,
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      lineHeight: 17,
    },
    pressed: {
      opacity: 0.68,
    },
  });
}
