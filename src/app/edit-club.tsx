import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
    useFocusEffect,
    useLocalSearchParams,
    useRouter,
} from 'expo-router';
import {
    useCallback,
    useMemo,
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
import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import ClubPhotoCropper, { ClubCropAsset } from '../components/ClubPhotoCropper';
import PhotoSourceSheet from '../components/PhotoSourceSheet';
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
    ClubCoverUpload,
    ClubPrivacy,
    ClubWithMembership,
    getClub,
    updateClub,
    uploadClubCover,
} from '../lib/clubs';

export default function EditClubScreen() {
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
    name,
    setName,
  ] =
    useState('');

  const [
    description,
    setDescription,
  ] =
    useState('');

  const [rules, setRules] = useState('');

  const [
    privacy,
    setPrivacy,
  ] =
    useState<ClubPrivacy>(
      'public'
    );

  const [
    selectedGenres,
    setSelectedGenres,
  ] =
    useState<ClubGenreKey[]>(
      []
    );

  const [
    pendingPhoto,
    setPendingPhoto,
  ] =
    useState<ClubCoverUpload | null>(
      null
    );
  const [
    cropAsset,
    setCropAsset,
  ] =
    useState<ClubCropAsset | null>(
      null
    );

  const [
    cropVisible,
    setCropVisible,
  ] =
    useState(false);

  const [
    photoSourceVisible,
    setPhotoSourceVisible,
  ] =
    useState(false);

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
        if (
          !clubId
        ) {
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

          if (
            data.membership_role !==
            'owner'
          ) {
            Alert.alert(
              'Owner only',
              'Only the club owner can edit this club.',
              [
                {
                  text:
                    'OK',
                  onPress: () =>
                    router.back(),
                },
              ]
            );
            return;
          }

          setClub(
            data
          );
          setName(
            data.name
          );
          setDescription(
            data.description ??
            ''
          );
          setRules(data.rules ?? '');
          setPrivacy(
            data.privacy
          );
          setSelectedGenres(
            data.genres ??
            []
          );
        } catch (
          error
        ) {
          console.error(
            'Could not load club for editing:',
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
        router,
      ]
    );

  useFocusEffect(
    useCallback(
      () => {
        setLoading(
          true
        );
        void loadClub();
      },
      [
        loadClub,
      ]
    )
  );

  const trimmedName =
    name.trim();

  const trimmedDescription =
    description.trim();

  const trimmedRules = rules.trim();

  const canSave =
    Boolean(
      club
    ) &&
    club?.membership_role ===
      'owner' &&
    trimmedName.length >=
      3 &&
    trimmedName.length <=
      60 &&
    trimmedDescription.length <=
      1000 &&
    trimmedRules.length <= 2000 &&
    !saving;

  const clubInitial =
    useMemo(
      () =>
        (
          trimmedName ||
          club?.name ||
          'N'
        )
          .charAt(
            0
          )
          .toUpperCase(),
      [
        club?.name,
        trimmedName,
      ]
    );

  function toggleGenre(
    genre:
      ClubGenreKey
  ) {
    setSelectedGenres(
      (
        current
      ) => {
        if (
          current.includes(
            genre
          )
        ) {
          return current.filter(
            (
              item
            ) =>
              item !==
              genre
          );
        }

        if (
          current.length >=
          3
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

  function useSelectedPhoto(
    asset: ImagePicker.ImagePickerAsset
  ) {
    if (
      !asset.width ||
      !asset.height
    ) {
      Alert.alert(
        'Could not use photo',
        'Novori could not read the dimensions of this photo.'
      );
      return;
    }

    setCropAsset({
      uri:
        asset.uri,
      width:
        asset.width,
      height:
        asset.height,
    });

    setCropVisible(
      true
    );
  }

  function useCroppedClubPhoto(
    uri: string
  ) {
    setPendingPhoto({
      uri,
      fileName:
        'club-photo.jpg',
      mimeType:
        'image/jpeg',
    });

    setCropVisible(
      false
    );

    setCropAsset(
      null
    );
  }

  async function choosePhotoFromLibrary() {
    try {
      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: [
            'images',
          ],
          allowsEditing:
            false,
          quality:
            1,
        });

      if (
        result.canceled ||
        !result.assets[0]
      ) {
        return;
      }

      useSelectedPhoto(
        result.assets[0]
      );
    } catch (
      error
    ) {
      Alert.alert(
        'Could not choose photo',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    }
  }

  async function takePhoto() {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          'Camera access needed',
          'Allow Novori to use your camera to take a club photo.'
        );
        return;
      }

      const result =
        await ImagePicker.launchCameraAsync({
          mediaTypes: [
            'images',
          ],
          allowsEditing:
            false,
          quality:
            1,
        });

      if (
        result.canceled ||
        !result.assets[0]
      ) {
        return;
      }

      useSelectedPhoto(
        result.assets[0]
      );
    } catch (
      error
    ) {
      Alert.alert(
        'Could not take photo',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    }
  }

  async function saveClub() {
    if (
      !club ||
      club.membership_role !==
        'owner' ||
      !canSave
    ) {
      return;
    }

    try {
      setSaving(
        true
      );

      await updateClub(
        club.id,
        {
          name:
            trimmedName,
          description:
            trimmedDescription,
          privacy,
          rules: trimmedRules,
          genres:
            selectedGenres,
        }
      );

      if (
        pendingPhoto
      ) {
        await uploadClubCover(
          club.id,
          pendingPhoto
        );
      }

      router.back();
    } catch (
      error
    ) {
      console.error(
        'Could not update club:',
        error
      );

      Alert.alert(
        'Could not save club',
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
            styles.loadingWrap
          }
        >
          <ActivityIndicator
            size="large"
            color={
              colors.gold
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  if (
    !club ||
    club.membership_role !==
      'owner'
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
            styles.loadingWrap
          }
        >
          <Text
            style={
              styles.errorText
            }
          >
            Only the club owner can edit this club.
          </Text>
        </View>
      </SafeAreaView>
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
            Edit Club
          </Text>

          <Pressable
            disabled={
              !canSave
            }
            onPress={
              saveClub
            }
            accessibilityRole="button" accessibilityLabel="Save club changes"
            style={({
              pressed,
            }) => [
              styles.saveButton,
              !canSave &&
                styles.saveButtonDisabled,
              pressed &&
                canSave &&
                styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.gold
                }
              />
            ) : (
              <Text
                style={
                  styles.saveText
                }
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={
            styles.content
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
        >
          <Text
            style={
              styles.label
            }
          >
            CLUB PHOTO
          </Text>

          <View
            style={
              styles.photoSection
            }
          >
            <Pressable
              onPress={() =>
                setPhotoSourceVisible(
                  true
                )
              }
              style={({
                pressed,
              }) => [
                styles.photoButton,
                pressed &&
                  styles.pressed,
              ]}
            >
              {pendingPhoto ? (
                <Image
                  source={{
                    uri:
                      pendingPhoto.uri,
                  }}
                  style={
                    styles.photo
                  }
                />
              ) : club.cover_url ? (
                <Image
                  source={{
                    uri:
                      club.cover_url,
                  }}
                  style={
                    styles.photo
                  }
                />
              ) : (
                <View
                  style={
                    styles.photoFallback
                  }
                >
                  <Text
                    style={
                      styles.photoFallbackText
                    }
                  >
                    {clubInitial}
                  </Text>
                </View>
              )}

              <View
                style={
                  styles.photoBadge
                }
              >
                <Ionicons
                  name="camera"
                  size={
                    16
                  }
                  color={
                    colors.background
                  }
                />
              </View>
            </Pressable>

            <Text
              style={
                styles.photoHelp
              }
            >
              Tap to take a new photo or choose one from your library.
            </Text>
          </View>

          <Text
            style={
              styles.label
            }
          >
            CLUB NAME
          </Text>

          <View
            style={
              styles.inputCard
            }
          >
            <TextInput
              value={
                name
              }
              onChangeText={
                setName
              }
              maxLength={
                60
              }
              autoCapitalize="words"
              placeholder="Club name"
              placeholderTextColor={
                colors.mutedText
              }
              style={
                styles.nameInput
              }
            />

            <Text
              style={
                styles.counter
              }
            >
              {name.length}/60
            </Text>
          </View>

          <Text
            style={
              styles.label
            }
          >
            DESCRIPTION
          </Text>

          <View
            style={
              styles.inputCard
            }
          >
            <TextInput
              value={
                description
              }
              onChangeText={
                setDescription
              }
              maxLength={
                1000
              }
              multiline
              textAlignVertical="top"
              placeholder="What is this club about?"
              placeholderTextColor={
                colors.mutedText
              }
              style={
                styles.descriptionInput
              }
            />

            <Text
              style={
                styles.counter
              }
            >
              {description.length}/1000
            </Text>
          </View>

          <Text style={styles.label}>CLUB RULES · OPTIONAL</Text>
          <View style={styles.inputCard}>
            <TextInput value={rules} onChangeText={setRules} maxLength={2000} multiline textAlignVertical="top"
              accessibilityLabel="Club rules" placeholder="Set the tone: be kind, label spoilers, stay on topic…"
              placeholderTextColor={colors.mutedText} style={styles.descriptionInput} />
            <Text style={styles.counter}>{rules.length}/2000</Text>
          </View>
          <Text style={styles.helpText}>Visible on your club page, including before someone joins.</Text>

          <Text
            style={
              styles.label
            }
          >
            GENRES
          </Text>

          <View
            style={
              styles.genreCard
            }
          >
            <Text
              style={
                styles.helpText
              }
            >
              Choose up to 3 genres.
            </Text>

            <View
              style={
                styles.genreGrid
              }
            >
              {CLUB_GENRES.map(
                (
                  genre
                ) => {
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
                      style={({
                        pressed,
                      }) => [
                        styles.genreChip,
                        selected &&
                          styles.genreChipSelected,
                        pressed &&
                          styles.pressed,
                      ]}
                    >
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
                styles.genreCount
              }
            >
              {selectedGenres.length}/3 selected
            </Text>
          </View>

          <Text
            style={
              styles.label
            }
          >
            PRIVACY
          </Text>

          <View
            style={
              styles.privacyCard
            }
          >
            <Pressable
              onPress={() =>
                setPrivacy(
                  'public'
                )
              }
              style={({
                pressed,
              }) => [
                styles.privacyOption,
                privacy ===
                  'public' &&
                  styles.privacyOptionSelected,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="earth-outline"
                size={
                  21
                }
                color={
                  privacy ===
                  'public'
                    ? colors.gold
                    : colors.mutedText
                }
              />
              <View
                style={
                  styles.privacyCopy
                }
              >
                <Text
                  style={
                    styles.privacyTitle
                  }
                >
                  Public
                </Text>
                <Text
                  style={
                    styles.privacyText
                  }
                >
                  Readers can join immediately.
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() =>
                setPrivacy(
                  'private'
                )
              }
              style={({
                pressed,
              }) => [
                styles.privacyOption,
                privacy ===
                  'private' &&
                  styles.privacyOptionSelected,
                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={
                  21
                }
                color={
                  privacy ===
                  'private'
                    ? colors.gold
                    : colors.mutedText
                }
              />
              <View
                style={
                  styles.privacyCopy
                }
              >
                <Text
                  style={
                    styles.privacyTitle
                  }
                >
                  Private
                </Text>
                <Text
                  style={
                    styles.privacyText
                  }
                >
                  Readers request access or join by invitation.
                </Text>
              </View>
            </Pressable>
          </View>

          <Text
            style={
              styles.ownerNote
            }
          >
            Only the club owner can change these settings.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <ClubPhotoCropper
        visible={
          cropVisible
        }
        asset={
          cropAsset
        }
        colors={
          colors
        }
        title="Position Club Photo"
        onCancel={() => {
          setCropVisible(
            false
          );
          setCropAsset(
            null
          );
        }}
        onUse={
          useCroppedClubPhoto
        }
      />

      <PhotoSourceSheet
        visible={
          photoSourceVisible
        }
        title="Change Club Photo"
        colors={
          colors
        }
        onClose={() =>
          setPhotoSourceVisible(
            false
          )
        }
        onTakePhoto={
          takePhoto
        }
        onChooseLibrary={
          choosePhotoFromLibrary
        }
      />
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
    keyboardView: {
      flex:
        1,
    },
    loadingWrap: {
      flex:
        1,
      alignItems:
        'center',
      justifyContent:
        'center',
      padding:
        24,
    },
    errorText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        14,
      textAlign:
        'center',
    },
    header: {
      height:
        56,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      paddingHorizontal:
        10,
      borderBottomWidth:
        1,
      borderBottomColor:
        colors.border,
    },
    headerButton: {
      width:
        44,
      height:
        44,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    headerTitle: {
      color:
        colors.text,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        20,
    },
    saveButton: {
      minWidth:
        58,
      minHeight:
        40,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        8,
    },
    saveButtonDisabled: {
      opacity:
        0.4,
    },
    saveText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        14,
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
        50,
    },
    label: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        11,
      letterSpacing:
        1.2,
      marginTop:
        20,
      marginBottom:
        8,
    },
    photoSection: {
      alignItems:
        'center',
      paddingVertical:
        8,
    },
    photoButton: {
      width:
        112,
      height:
        112,
      borderRadius:
        56,
      position:
        'relative',
    },
    photo: {
      width:
        112,
      height:
        112,
      borderRadius:
        56,
      backgroundColor:
        colors.elevated,
    },
    photoFallback: {
      width:
        112,
      height:
        112,
      borderRadius:
        56,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.elevated,
      borderWidth:
        1,
      borderColor:
        colors.border,
    },
    photoFallbackText: {
      color:
        colors.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize:
        40,
    },
    photoBadge: {
      position:
        'absolute',
      right:
        0,
      bottom:
        2,
      width:
        34,
      height:
        34,
      borderRadius:
        17,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.gold,
      borderWidth:
        2,
      borderColor:
        colors.background,
    },
    photoHelp: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      lineHeight:
        18,
      textAlign:
        'center',
      marginTop:
        12,
    },
    inputCard: {
      borderRadius:
        14,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      paddingHorizontal:
        14,
      paddingTop:
        4,
      paddingBottom:
        8,
    },
    nameInput: {
      minHeight:
        48,
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        15,
    },
    descriptionInput: {
      minHeight:
        130,
      color:
        colors.text,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        15,
      lineHeight:
        21,
      paddingTop:
        12,
    },
    counter: {
      alignSelf:
        'flex-end',
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
    },
    genreCard: {
      borderRadius:
        14,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
      padding:
        14,
    },
    helpText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        12,
      lineHeight:
        18,
      marginBottom:
        12,
    },
    genreGrid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        8,
    },
    genreChip: {
      minHeight:
        36,
      justifyContent:
        'center',
      borderRadius:
        18,
      borderWidth:
        1,
      borderColor:
        colors.border,
      paddingHorizontal:
        13,
      backgroundColor:
        colors.background,
    },
    genreChipSelected: {
      borderColor:
        colors.gold,
      backgroundColor:
        colors.elevated,
    },
    genreChipText: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_500Medium',
      fontSize:
        12,
    },
    genreChipTextSelected: {
      color:
        colors.gold,
    },
    genreCount: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
      marginTop:
        12,
    },
    privacyCard: {
      overflow:
        'hidden',
      borderRadius:
        14,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.surface,
    },
    privacyOption: {
      minHeight:
        74,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal:
        14,
      gap:
        12,
    },
    privacyOptionSelected: {
      backgroundColor:
        colors.elevated,
    },
    privacyCopy: {
      flex:
        1,
    },
    privacyTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize:
        14,
    },
    privacyText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
      lineHeight:
        16,
      marginTop:
        3,
    },
    ownerNote: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize:
        11,
      textAlign:
        'center',
      marginTop:
        20,
    },
    pressed: {
      opacity:
        0.68,
    },
  });
}
