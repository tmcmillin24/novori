import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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
    CLUB_GENRES,
    ClubGenreKey,
} from '../constants/club-genres';
import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
import {
    ClubCoverUpload,
    ClubPrivacy,
    createClub,
    uploadClubCover,
} from '../lib/clubs';

export default function CreateClubScreen() {
  const router = useRouter();
  const { colors } = useNovoriTheme();
  const styles = createStyles(colors);

  const [name, setName] = useState('');
  const [description, setDescription] =
    useState('');
  const [privacy, setPrivacy] =
    useState<ClubPrivacy>('public');
  const [
    selectedGenres,
    setSelectedGenres,
  ] =
    useState<ClubGenreKey[]>(
      []
    );
  const [saving, setSaving] =
    useState(false);
  const [
    pendingPhoto,
    setPendingPhoto,
  ] =
    useState<ClubCoverUpload | null>(
      null
    );

  const trimmedName = name.trim();
  const trimmedDescription =
    description.trim();

  const canCreate =
    trimmedName.length >= 3 &&
    trimmedName.length <= 60 &&
    trimmedDescription.length <= 1000 &&
    !saving;

  const clubInitial =
    useMemo(
      () =>
        (
          trimmedName ||
          'N'
        )
          .charAt(0)
          .toUpperCase(),
      [
        trimmedName,
      ]
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

  async function choosePhoto() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          'Photo access needed',
          'Allow Novori to access your photos so you can choose a club picture.'
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: [
            'images',
          ],
          allowsEditing:
            true,
          aspect: [
            1,
            1,
          ],
          quality:
            0.9,
        });

      if (
        result.canceled ||
        !result.assets[0]
      ) {
        return;
      }

      const asset =
        result.assets[0];

      setPendingPhoto({
        uri:
          asset.uri,
        fileName:
          asset.fileName,
        mimeType:
          asset.mimeType,
      });
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while opening your photos.';

      Alert.alert(
        'Could not choose photo',
        message
      );
    }
  }

  async function handleCreate() {
    if (!canCreate) {
      return;
    }

    try {
      setSaving(true);

      const club = await createClub({
        name: trimmedName,
        description:
          trimmedDescription,
        privacy,
        genres:
          selectedGenres,
      });

      if (
        pendingPhoto
      ) {
        try {
          await uploadClubCover(
            club.id,
            pendingPhoto
          );
        } catch (
          photoError
        ) {
          console.error(
            'Could not upload club photo:',
            photoError
          );

          Alert.alert(
            'Club created',
            'Your club was created, but the photo could not be uploaded. The club will use its letter icon for now.'
          );
        }
      }

      router.replace({
        pathname: '/club/[id]',
        params: {
          id: club.id,
        },
      });
    } catch (error) {
      console.error(
        'Could not create club:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Please try again.';

      Alert.alert(
        'Could not create club',
        message
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
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
              name="close"
              size={25}
              color={colors.text}
            />
          </Pressable>

          <Text style={styles.headerTitle}>
            Create Club
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <Text style={styles.title}>
              Start a reading community.
            </Text>

            <Text style={styles.subtitle}>
              Give your club a clear identity now. Books, posts, events, and reading circles can be added inside it next.
            </Text>
          </View>

          <Text style={styles.label}>
            CLUB PHOTO
          </Text>

          <View style={styles.photoSection}>
            <Pressable
              onPress={choosePhoto}
              style={({ pressed }) => [
                styles.photoPreviewButton,
                pressed && styles.pressed,
              ]}
            >
              {pendingPhoto ? (
                <Image
                  source={{
                    uri:
                      pendingPhoto.uri,
                  }}
                  style={styles.photoPreview}
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
                  styles.photoEditBadge
                }
              >
                <Ionicons
                  name="camera"
                  size={16}
                  color={colors.background}
                />
              </View>
            </Pressable>

            <View
              style={
                styles.photoCopy
              }
            >
              <Text
                style={
                  styles.photoTitle
                }
              >
                {pendingPhoto
                  ? 'Club photo selected'
                  : 'Add a club photo'}
              </Text>

              <Text
                style={
                  styles.photoText
                }
              >
                Optional. If you skip it, Novori will use the first letter of the club name.
              </Text>

              <View
                style={
                  styles.photoActions
                }
              >
                <Pressable
                  onPress={
                    choosePhoto
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.photoActionButton,
                    pressed &&
                      styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="images-outline"
                    size={15}
                    color={colors.gold}
                  />

                  <Text
                    style={
                      styles.photoActionText
                    }
                  >
                    {pendingPhoto
                      ? 'Change'
                      : 'Choose Photo'}
                  </Text>
                </Pressable>

                {pendingPhoto ? (
                  <Pressable
                    onPress={() =>
                      setPendingPhoto(
                        null
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.removePhotoButton,
                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <Text
                      style={
                        styles.removePhotoText
                      }
                    >
                      Remove
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>

          <Text style={styles.label}>
            CLUB NAME
          </Text>

          <View style={styles.inputCard}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Fantasy After Dark"
              placeholderTextColor={
                colors.mutedText
              }
              maxLength={60}
              autoCapitalize="words"
              style={styles.nameInput}
            />

            <Text style={styles.counter}>
              {name.length}/60
            </Text>
          </View>

          <Text style={styles.label}>
            DESCRIPTION
          </Text>

          <View style={styles.inputCard}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What is this club about? What kinds of books or discussions belong here?"
              placeholderTextColor={
                colors.mutedText
              }
              maxLength={1000}
              multiline
              textAlignVertical="top"
              style={styles.descriptionInput}
            />

            <Text style={styles.counter}>
              {description.length}/1000
            </Text>
          </View>

          <Text style={styles.label}>
            GENRES
          </Text>

          <View style={styles.genreCard}>
            <Text style={styles.genreHelp}>
              Optional. Choose up to 3 genres so readers can find this club more easily.
            </Text>

            <View style={styles.genreGrid}>
              {CLUB_GENRES.map(
                (genre) => {
                  const selected =
                    selectedGenres.includes(
                      genre.key
                    );

                  return (
                    <Pressable
                      key={genre.key}
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

            <Text style={styles.genreCount}>
              {selectedGenres.length}/3 selected
            </Text>
          </View>

          <Text style={styles.label}>
            PRIVACY
          </Text>

          <View style={styles.privacyCard}>
            <Pressable
              onPress={() =>
                setPrivacy('public')
              }
              style={({ pressed }) => [
                styles.privacyOption,
                privacy === 'public' &&
                  styles.privacyOptionActive,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={styles.privacyIcon}
              >
                <Ionicons
                  name="earth-outline"
                  size={20}
                  color={
                    privacy === 'public'
                      ? colors.gold
                      : colors.mutedText
                  }
                />
              </View>

              <View style={styles.privacyCopy}>
                <Text
                  style={[
                    styles.privacyTitle,
                    privacy === 'public' &&
                      styles.privacyTitleActive,
                  ]}
                >
                  Public
                </Text>

                <Text
                  style={styles.privacyText}
                >
                  Anyone can discover and join this club.
                </Text>
              </View>

              <Ionicons
                name={
                  privacy === 'public'
                    ? 'radio-button-on'
                    : 'radio-button-off'
                }
                size={21}
                color={
                  privacy === 'public'
                    ? colors.gold
                    : colors.mutedText
                }
              />
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              onPress={() =>
                setPrivacy('private')
              }
              style={({ pressed }) => [
                styles.privacyOption,
                privacy === 'private' &&
                  styles.privacyOptionActive,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={styles.privacyIcon}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={19}
                  color={
                    privacy === 'private'
                      ? colors.gold
                      : colors.mutedText
                  }
                />
              </View>

              <View style={styles.privacyCopy}>
                <Text
                  style={[
                    styles.privacyTitle,
                    privacy === 'private' &&
                      styles.privacyTitleActive,
                  ]}
                >
                  Private
                </Text>

                <Text
                  style={styles.privacyText}
                >
                  Hidden from Discover. Members will join through invitations once invites are added.
                </Text>
              </View>

              <Ionicons
                name={
                  privacy === 'private'
                    ? 'radio-button-on'
                    : 'radio-button-off'
                }
                size={21}
                color={
                  privacy === 'private'
                    ? colors.gold
                    : colors.mutedText
                }
              />
            </Pressable>
          </View>

          <View style={styles.infoBox}>
            <Ionicons
              name="information-circle-outline"
              size={19}
              color={colors.gold}
            />

            <Text style={styles.infoText}>
              Club cover images, invitations, posts, events, and Reading Circles will build on this foundation.
            </Text>
          </View>

          <Pressable
            disabled={!canCreate}
            onPress={handleCreate}
            style={({ pressed }) => [
              styles.createButton,
              !canCreate &&
                styles.createButtonDisabled,
              pressed &&
                canCreate &&
                styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator
                size="small"
                color={colors.background}
              />
            ) : (
              <>
                <Ionicons
                  name="people"
                  size={18}
                  color={colors.background}
                />

                <Text
                  style={styles.createButtonText}
                >
                  Create Club
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: NovoriColors) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    header: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 20,
      fontFamily: 'PlayfairDisplay_700Bold',
      textAlign: 'center',
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      width: '100%',
      maxWidth: 720,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 48,
    },
    intro: {
      marginBottom: 26,
    },
    title: {
      color: colors.text,
      fontFamily: 'PlayfairDisplay_700Bold',
      fontSize: 28,
      lineHeight: 35,
    },
    subtitle: {
      color: colors.secondaryText,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      lineHeight: 21,
      marginTop: 8,
    },
    label: {
      color: colors.mutedText,
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      letterSpacing: 0.9,
      marginTop: 18,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    photoSection: {
      flexDirection:
        'row',
      alignItems:
        'center',
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 18,
      padding: 14,
      gap: 15,
    },
    photoPreviewButton: {
      width: 88,
      height: 88,
      position:
        'relative',
    },
    photoPreview: {
      width: 88,
      height: 88,
      borderRadius: 24,
      backgroundColor:
        colors.elevated,
    },
    photoFallback: {
      width: 88,
      height: 88,
      borderRadius: 24,
      backgroundColor:
        colors.elevated,
      borderWidth: 1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    photoFallbackText: {
      color:
        colors.gold,
      fontFamily:
        'PlayfairDisplay_700Bold',
      fontSize: 36,
    },
    photoEditBadge: {
      position:
        'absolute',
      right: -4,
      bottom: -4,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor:
        colors.gold,
      borderWidth: 3,
      borderColor:
        colors.surface,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    photoCopy: {
      flex: 1,
      minWidth: 0,
    },
    photoTitle: {
      color:
        colors.text,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 15,
    },
    photoText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 11,
      lineHeight: 16,
      marginTop: 4,
    },
    photoActions: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 10,
      marginTop: 11,
    },
    photoActionButton: {
      minHeight: 34,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor:
        colors.elevated,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 5,
    },
    photoActionText: {
      color:
        colors.gold,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
    },
    removePhotoButton: {
      minHeight: 34,
      paddingHorizontal: 9,
      justifyContent:
        'center',
    },
    removePhotoText: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_600SemiBold',
      fontSize: 11,
    },
    inputCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 15,
      paddingVertical: 13,
    },
    nameInput: {
      color: colors.text,
      fontFamily: 'Inter_500Medium',
      fontSize: 16,
      padding: 0,
    },
    descriptionInput: {
      color: colors.text,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      lineHeight: 21,
      minHeight: 120,
      padding: 0,
    },
    counter: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 10,
      textAlign: 'right',
      marginTop: 8,
    },
    genreCard: {
      backgroundColor:
        colors.surface,
      borderWidth: 1,
      borderColor:
        colors.border,
      borderRadius: 16,
      padding: 14,
    },
    genreHelp: {
      color:
        colors.secondaryText,
      fontFamily:
        'Inter_400Regular',
      fontSize: 12,
      lineHeight: 18,
    },
    genreGrid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap: 8,
      marginTop: 12,
    },
    genreChip: {
      minHeight: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.elevated,
      paddingHorizontal: 12,
      alignItems:
        'center',
      justifyContent:
        'center',
    },
    genreChipSelected: {
      borderColor:
        colors.gold,
      backgroundColor:
        colors.surface,
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
    genreCount: {
      color:
        colors.mutedText,
      fontFamily:
        'Inter_500Medium',
      fontSize: 10,
      marginTop: 10,
      textAlign: 'right',
    },
    privacyCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      overflow: 'hidden',
    },
    privacyOption: {
      minHeight: 84,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    privacyOptionActive: {
      backgroundColor: colors.elevated,
    },
    privacyIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    privacyCopy: {
      flex: 1,
      paddingRight: 12,
    },
    privacyTitle: {
      color: colors.text,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
    },
    privacyTitleActive: {
      color: colors.gold,
    },
    privacyText: {
      color: colors.mutedText,
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 17,
      marginTop: 3,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 64,
    },
    infoBox: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 15,
      padding: 14,
      marginTop: 22,
    },
    infoText: {
      flex: 1,
      color: colors.secondaryText,
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      lineHeight: 18,
    },
    createButton: {
      minHeight: 52,
      borderRadius: 15,
      backgroundColor: colors.gold,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 22,
    },
    createButtonDisabled: {
      opacity: 0.42,
    },
    createButtonText: {
      color: colors.background,
      fontFamily: 'Inter_700Bold',
      fontSize: 15,
    },
    pressed: {
      opacity: 0.68,
    },
  });
}
