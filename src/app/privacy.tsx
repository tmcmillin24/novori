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
    getProfilePrivacy,
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
    isPrivate,
    setIsPrivate,
  ] =
    useState(false);

  const [
    showBooks,
    setShowBooks,
  ] =
    useState(true);

  const [
    showReviews,
    setShowReviews,
  ] =
    useState(true);

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
      'private' |
      'books' |
      'reviews' |
      null
    >(null);

  const load =
    useCallback(
      async () => {
        try {
          const preferences =
            await getProfilePrivacy();

          setIsPrivate(
            preferences.is_private
          );

          setShowBooks(
            preferences.show_books
          );

          setShowReviews(
            preferences.show_reviews
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
      | 'private'
      | 'books'
      | 'reviews',
    value: boolean
  ) {
    const nextPrivate =
      key ===
      'private'
        ? value
        : isPrivate;

    const nextBooks =
      key ===
      'books'
        ? value
        : showBooks;

    const nextReviews =
      key ===
      'reviews'
        ? value
        : showReviews;

    if (
      key ===
      'private'
    ) {
      setIsPrivate(
        value
      );
    } else if (
      key ===
      'books'
    ) {
      setShowBooks(
        value
      );
    } else {
      setShowReviews(
        value
      );
    }

    try {
      setSavingKey(
        key
      );

      await updateProfilePrivacy({
        is_private:
          nextPrivate,
        show_books:
          nextBooks,
        show_reviews:
          nextReviews,
      });
    } catch (
      error
    ) {
      console.error(
        'Could not update profile privacy:',
        error
      );

      if (
        key ===
        'private'
      ) {
        setIsPrivate(
          !value
        );
      } else if (
        key ===
        'books'
      ) {
        setShowBooks(
          !value
        );
      } else {
        setShowReviews(
          !value
        );
      }

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
                    'private',
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
                  name="library-outline"
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
                  Show Books Publicly
                </Text>

                <Text
                  style={
                    styles.rowText
                  }
                >
                  On a public profile, let anyone see Reading, Read, and DNF. On a private profile, approved followers can still see them. TBR stays private.
                </Text>
              </View>

              <Switch
                value={
                  showBooks
                }
                disabled={
                  savingKey !==
                  null
                }
                onValueChange={(
                  value
                ) =>
                  update(
                    'books',
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
                    'reviews',
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
              Private Profile is off by default. Books and Reviews are public by default. Your underlying library table stays protected; private-profile access is enforced server-side.
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
      maxWidth: 720,
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
