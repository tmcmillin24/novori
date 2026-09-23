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
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    CLUB_GENRES,
    ClubGenreKey,
} from '../constants/club-genres';
import {
    NovoriColors,
} from '../constants/novori-theme';
import {
    useNovoriTheme,
} from '../context/theme-context';
import {
    ClubWithMembership,
    getClub,
    updateClubGenres,
} from '../lib/clubs';

export default function EditClubGenresScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      clubId?: string;
    }>();

  const {
    colors,
  } =
    useNovoriTheme();

  const styles =
    createStyles(
      colors
    );

  const clubId =
    typeof params.clubId ===
    'string'
      ? params.clubId
      : '';

  const [
    club,
    setClub,
  ] =
    useState<ClubWithMembership | null>(
      null
    );

  const [
    selectedGenres,
    setSelectedGenres,
  ] =
    useState<ClubGenreKey[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const loadClub =
    useCallback(
      async () => {
        if (!clubId) {
          setLoading(
            false
          );
          return;
        }

        try {
          const data =
            await getClub(
              clubId
            );

          setClub(
            data
          );
          setSelectedGenres(
            data.genres ??
            []
          );
        } catch (
          error
        ) {
          console.error(
            'Could not load club genres:',
            error
          );

          Alert.alert(
            'Could not load club',
            'Please try again.'
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        clubId,
      ]
    );

  useFocusEffect(
    useCallback(() => {
      setLoading(
        true
      );
      loadClub();
    }, [
      loadClub,
    ])
  );

  function toggleGenre(
    genre:
      ClubGenreKey
  ) {
    setSelectedGenres(
      (current) => {
        if (
          current.includes(
            genre
          )
        ) {
          return current.filter(
            (item) =>
              item !==
              genre
          );
        }

        if (
          current.length >= 3
        ) {
          Alert.alert(
            'Up to 3 genres',
            'Choose up to three genres that best fit this club.'
          );

          return current;
        }

        return [
          ...current,
          genre,
        ];
      }
    );
  }

  async function save() {
    if (
      !club ||
      club.membership_role !==
        'owner'
    ) {
      return;
    }

    try {
      setSaving(
        true
      );

      await updateClubGenres(
        club.id,
        selectedGenres
      );

      router.back();
    } catch (
      error
    ) {
      console.error(
        'Could not update club genres:',
        error
      );

      Alert.alert(
        'Could not save genres',
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

  if (
    loading
  ) {
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
      </SafeAreaView>
    );
  }

  const isOwner =
    club?.membership_role ===
    'owner';

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
          Club Genres
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {!club ? (
          <View
            style={
              styles.emptyCard
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              Club unavailable
            </Text>
          </View>
        ) : !isOwner ? (
          <View
            style={
              styles.emptyCard
            }
          >
            <Ionicons
              name="lock-closed-outline"
              size={
                26
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
              Owner only
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Only the club owner can change its genres.
            </Text>
          </View>
        ) : (
          <>
            <Text
              style={
                styles.title
              }
            >
              Help readers discover {club.name}.
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Choose up to three broad genres. Public clubs will appear when readers filter Discover Clubs by any selected genre.
            </Text>

            <View
              style={
                styles.genreGrid
              }
            >
              {CLUB_GENRES.map(
                (genre) => {
                  const selected =
                    selectedGenres.includes(
                      genre.key
                    );

                  return (
                    <Pressable
                      key={
                        genre.key
                      }
                      onPress={() =>
                        toggleGenre(
                          genre.key
                        )
                      }
                      style={({ pressed }) => [
                        styles.genreChip,
                        selected &&
                          styles.genreChipSelected,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      {selected ? (
                        <Ionicons
                          name="checkmark"
                          size={
                            15
                          }
                          color={
                            colors.gold
                          }
                        />
                      ) : null}

                      <Text
                        style={[
                          styles.genreChipText,
                          selected &&
                            styles.genreChipTextSelected,
                        ]}
                      >
                        {genre.label}
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>

            <Text
              style={
                styles.count
              }
            >
              {selectedGenres.length}/3 selected
            </Text>

            <Pressable
              disabled={
                saving
              }
              onPress={
                save
              }
              style={({ pressed }) => [
                styles.saveButton,
                pressed &&
                  !saving &&
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
                <>
                  <Ionicons
                    name="checkmark"
                    size={
                      18
                    }
                    color={
                      colors.background
                    }
                  />

                  <Text
                    style={
                      styles.saveButtonText
                    }
                  >
                    Save Genres
                  </Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
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
      paddingTop: 26,
      paddingBottom:
        50,
    },
    title: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 26,
      lineHeight: 33,
    },
    subtitle: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 13,
      lineHeight: 20,
      marginTop: 8,
    },
    genreGrid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap: 9,
      marginTop: 24,
    },
    genreChip: {
      minHeight: 38,
      borderRadius: 19,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      paddingHorizontal:
        13,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 5,
    },
    genreChipSelected: {
      borderColor:
        colors.gold,
      backgroundColor:
        colors.elevated,
    },
    genreChipText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
    },
    genreChipTextSelected: {
      color:
        colors.gold,
    },
    count: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 10,
      marginTop: 12,
      textAlign: 'right',
    },
    saveButton: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor:
        colors.gold,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap: 7,
      marginTop: 28,
    },
    saveButtonText: {
      color:
        colors.background,
      fontFamily:
        'Inter_700Bold',
      fontSize: 13,
    },
    emptyCard: {
      minHeight: 190,
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
      fontSize: 20,
      marginTop: 10,
      textAlign:
        'center',
    },
    emptyText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      lineHeight: 18,
      textAlign:
        'center',
      marginTop: 6,
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
