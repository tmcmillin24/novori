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
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
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
    DEFAULT_PROFILE_PRIVACY,
    getProfilePrivacy,
    ProfilePrivacyPreferences,
    updateProfilePrivacy,
} from '../lib/profile-privacy';

export default function PrivacyScreen() {
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
    preferences,
    setPreferences,
  ] =
    useState<ProfilePrivacyPreferences>(
      DEFAULT_PROFILE_PRIVACY
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    savingKey,
    setSavingKey,
  ] =
    useState<
      keyof ProfilePrivacyPreferences |
      null
    >(null);

  const {
    is_private:
      isPrivate,
    show_reviews:
      showReviews,
    show_tbr_books:
      showTbrBooks,
    show_reading_books:
      showReadingBooks,
    show_read_books:
      showReadBooks,
    show_dnf_books:
      showDnfBooks,
    show_owned_books:
      showOwnedBooks,
  } =
    preferences;

  const load =
    useCallback(
      async () => {
        try {
          const nextPreferences =
            await getProfilePrivacy();

          setPreferences(
            nextPreferences
          );
        } catch (
          error
        ) {
          console.error(
            'Could not load profile privacy:',
            error
          );

          Alert.alert(
            'Could not load privacy settings',
            'Please try again.'
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
      load();
    }, [
      load,
    ])
  );

  async function update(
    key:
      keyof ProfilePrivacyPreferences,
    value: boolean
  ) {
    const previous =
      preferences;

    const nextPreferences = {
      ...preferences,
      [key]:
        value,
    };

    nextPreferences.show_books =
      nextPreferences.show_tbr_books ||
      nextPreferences.show_reading_books ||
      nextPreferences.show_read_books ||
      nextPreferences.show_dnf_books ||
      nextPreferences.show_owned_books;

    setPreferences(
      nextPreferences
    );

    try {
      setSavingKey(
        key
      );

      await updateProfilePrivacy(
        nextPreferences
      );
    } catch (
      error
    ) {
      console.error(
        'Could not update profile privacy:',
        error
      );

      setPreferences(
        previous
      );

      Alert.alert(
        'Could not save privacy setting',
        'Please try again.'
      );
    } finally {
      setSavingKey(
        null
      );
    }
  }

  function renderBookVisibilityRow({
    keyName,
    title,
    description,
    icon,
    value,
  }: {
    keyName:
      | 'show_tbr_books'
      | 'show_reading_books'
      | 'show_read_books'
      | 'show_dnf_books'
      | 'show_owned_books';
    title: string;
    description: string;
    icon:
      keyof typeof Ionicons.glyphMap;
    value: boolean;
  }) {
    return (
      <View
        style={
          styles.row
        }
      >
        <View
          style={
            styles.iconWrap
          }
        >
          <Ionicons
            name={
              icon
            }
            size={
              19
            }
            color={
              colors.gold
            }
          />
        </View>

        <View
          style={
            styles.rowCopy
          }
        >
          <Text
            style={
              styles.rowTitle
            }
          >
            {title}
          </Text>

          <Text
            style={
              styles.rowText
            }
          >
            {description}
          </Text>
        </View>

        <Switch
          value={
            value
          }
          disabled={
            savingKey !==
            null
          }
          onValueChange={(
            nextValue
          ) =>
            update(
              keyName,
              nextValue
            )
          }
          trackColor={{
            false:
              colors.elevated,
            true:
              colors.gold,
          }}
          thumbColor={
            colors.text
          }
        />
      </View>
    );
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
            styles.backButton,
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
          Privacy
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
              styles.sectionLabel
            }
          >
            PUBLIC PROFILE
          </Text>

          <View
            style={
              styles.card
            }
          >
            <View
              style={
                styles.row
              }
            >
              <View
                style={
                  styles.iconWrap
                }
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={
                    19
                  }
                  color={
                    colors.gold
                  }
                />
              </View>

              <View
                style={
                  styles.rowCopy
                }
              >
                <Text
                  style={
                    styles.rowTitle
                  }
                >
                  Private Profile
                </Text>

                <Text
                  style={
                    styles.rowText
                  }
                >
                  New readers must request to follow you. Approved followers can see your profile activity.
                </Text>
              </View>

              <Switch
                value={
                  isPrivate
                }
                disabled={
                  savingKey !==
                  null
                }
                onValueChange={(
                  value
                ) =>
                  update(
                    'is_private',
                    value
                  )
                }
                trackColor={{
                  false:
                    colors.elevated,
                  true:
                    colors.gold,
                }}
                thumbColor={
                  colors.text
                }
              />
            </View>

            <View
              style={
                styles.divider
              }
            />

            {renderBookVisibilityRow({
              keyName:
                'show_tbr_books',
              title:
                'Show TBR',
              description:
                'Show books on your TBR shelf on your profile.',
              icon:
                'bookmark-outline',
              value:
                showTbrBooks,
            })}

            <View
              style={
                styles.divider
              }
            />

            {renderBookVisibilityRow({
              keyName:
                'show_reading_books',
              title:
                'Show Reading',
              description:
                'Show books you are currently reading on your profile.',
              icon:
                'book-outline',
              value:
                showReadingBooks,
            })}

            <View
              style={
                styles.divider
              }
            />

            {renderBookVisibilityRow({
              keyName:
                'show_read_books',
              title:
                'Show Read',
              description:
                'Show books you have finished on your profile.',
              icon:
                'checkmark-circle-outline',
              value:
                showReadBooks,
            })}

            <View
              style={
                styles.divider
              }
            />

            {renderBookVisibilityRow({
              keyName:
                'show_dnf_books',
              title:
                'Show DNF',
              description:
                'Show books you marked Did Not Finish on your profile.',
              icon:
                'close-circle-outline',
              value:
                showDnfBooks,
            })}

            <View
              style={
                styles.divider
              }
            />

            {renderBookVisibilityRow({
              keyName:
                'show_owned_books',
              title:
                'Show Owned Only',
              description:
                'Show owned books that do not have a reading status.',
              icon:
                'albums-outline',
              value:
                showOwnedBooks,
            })}

            <View
              style={
                styles.divider
              }
            />

            <View
              style={
                styles.row
              }
            >
              <View
                style={
                  styles.iconWrap
                }
              >
                <Ionicons
                  name="star-outline"
                  size={
                    19
                  }
                  color={
                    colors.gold
                  }
                />
              </View>

              <View
                style={
                  styles.rowCopy
                }
              >
                <Text
                  style={
                    styles.rowTitle
                  }
                >
                  Show Reviews Publicly
                </Text>

                <Text
                  style={
                    styles.rowText
                  }
                >
                  On a public profile, let anyone see your ratings and reviews. Approved followers of a private profile can still see them.
                </Text>
              </View>

              <Switch
                value={
                  showReviews
                }
                disabled={
                  savingKey !==
                  null
                }
                onValueChange={(
                  value
                ) =>
                  update(
                    'show_reviews',
                    value
                  )
                }
                trackColor={{
                  false:
                    colors.elevated,
                  true:
                    colors.gold,
                }}
                thumbColor={
                  colors.text
                }
              />
            </View>
          </View>

          <View
            style={
              styles.infoCard
            }
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={
                19
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
              Your Profile tab mirrors these visibility choices, so it acts as a preview of what other readers can see. Private profiles still require an approved follow before profile content is visible.
            </Text>
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
      flex: 1,
      backgroundColor:
        colors.background,
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
    backButton: {
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
    headerSpacer: {
      width: 40,
    },
    content: {
      width: '100%',
      maxWidth: '100%',
      alignSelf:
        'center',
      paddingHorizontal:
        20,
      paddingTop: 24,
      paddingBottom:
        60,
    },
    sectionLabel: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_700Bold',
      fontSize: 10,
      letterSpacing:
        1.1,
      marginBottom: 9,
      paddingHorizontal:
        4,
    },
    card: {
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 17,
      overflow:
        'hidden',
    },
    row: {
      minHeight: 92,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        14,
      paddingVertical:
        13,
      gap: 11,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor:
        colors.elevated,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    rowCopy: {
      flex: 1,
      minWidth: 0,
    },
    rowTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_700Bold',
      fontSize: 13,
    },
    rowText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      lineHeight: 16,
      marginTop: 4,
      paddingRight: 4,
    },
    divider: {
      height: 1,
      backgroundColor:
        colors.border,
      marginLeft: 63,
    },
    infoCard: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      gap: 9,
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 15,
      padding: 14,
      marginTop: 16,
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
    centered: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    pressed: {
      opacity: 0.68,
    },
  });
}
