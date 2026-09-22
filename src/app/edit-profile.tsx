import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '../constants/novori-theme';
import { supabase } from '../lib/supabase';

const CROP_SIZE = 280;
const MAX_ZOOM = 4;

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type PendingPhoto = {
  uri: string;
  width: number;
  height: number;
};

type TouchPoint = {
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function distanceBetweenTouches(
  first: { pageX: number; pageY: number },
  second: { pageX: number; pageY: number }
) {
  return Math.hypot(
    second.pageX - first.pageX,
    second.pageY - first.pageY
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const [cropVisible, setCropVisible] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);

  const zoomRef = useRef(1);
  const translateXRef = useRef(0);
  const translateYRef = useRef(0);

  const lastTouchRef = useRef<TouchPoint | null>(null);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(1);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        await supabase.auth.signOut();
        router.replace('/auth');
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, bio, avatar_url')
        .eq('id', user.id)
        .single();

      if (error) {
        Alert.alert(
          'Could not load profile',
          error.message
        );
        return;
      }

      if (!mounted) {
        return;
      }

      setProfile(data);
      setDisplayName(data.display_name ?? '');
      setBio(data.bio ?? '');
      setAvatarUrl(data.avatar_url ?? null);
      setLoading(false);
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [router]);

  const username = profile?.username?.trim() || '';

  const avatarInitial = useMemo(() => {
    const source =
      displayName.trim() ||
      username ||
      'N';

    return source.charAt(0).toUpperCase();
  }, [displayName, username]);

  const cropGeometry = useMemo(() => {
    if (!pendingPhoto) {
      return null;
    }

    const baseScale = Math.max(
      CROP_SIZE / pendingPhoto.width,
      CROP_SIZE / pendingPhoto.height
    );

    return {
      baseScale,
      baseWidth: pendingPhoto.width * baseScale,
      baseHeight: pendingPhoto.height * baseScale,
    };
  }, [pendingPhoto]);

  function clampTranslation(
    x: number,
    y: number,
    nextZoom = zoomRef.current
  ) {
    if (!cropGeometry) {
      return { x: 0, y: 0 };
    }

    const renderedWidth = cropGeometry.baseWidth * nextZoom;
    const renderedHeight = cropGeometry.baseHeight * nextZoom;

    const maxX = Math.max(
      0,
      (renderedWidth - CROP_SIZE) / 2
    );

    const maxY = Math.max(
      0,
      (renderedHeight - CROP_SIZE) / 2
    );

    return {
      x: clamp(x, -maxX, maxX),
      y: clamp(y, -maxY, maxY),
    };
  }

  function applyTranslation(x: number, y: number) {
    const next = clampTranslation(x, y);

    translateXRef.current = next.x;
    translateYRef.current = next.y;

    setTranslateX(next.x);
    setTranslateY(next.y);
  }

  function applyZoom(nextZoom: number) {
    const safeZoom = clamp(nextZoom, 1, MAX_ZOOM);

    zoomRef.current = safeZoom;
    setZoom(safeZoom);

    const nextTranslation = clampTranslation(
      translateXRef.current,
      translateYRef.current,
      safeZoom
    );

    translateXRef.current = nextTranslation.x;
    translateYRef.current = nextTranslation.y;

    setTranslateX(nextTranslation.x);
    setTranslateY(nextTranslation.y);
  }

  const cropPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches;

          pinchStartDistanceRef.current = null;

          if (touches.length === 1) {
            lastTouchRef.current = {
              x: touches[0].pageX,
              y: touches[0].pageY,
            };
          } else {
            lastTouchRef.current = null;
          }
        },

        onPanResponderMove: (event) => {
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            lastTouchRef.current = null;

            const distance = distanceBetweenTouches(
              touches[0],
              touches[1]
            );

            if (pinchStartDistanceRef.current === null) {
              pinchStartDistanceRef.current = distance;
              pinchStartZoomRef.current = zoomRef.current;
              return;
            }

            const ratio =
              distance / pinchStartDistanceRef.current;

            applyZoom(
              pinchStartZoomRef.current * ratio
            );

            return;
          }

          pinchStartDistanceRef.current = null;

          if (touches.length === 1) {
            const currentTouch = {
              x: touches[0].pageX,
              y: touches[0].pageY,
            };

            if (!lastTouchRef.current) {
              lastTouchRef.current = currentTouch;
              return;
            }

            const deltaX =
              currentTouch.x - lastTouchRef.current.x;

            const deltaY =
              currentTouch.y - lastTouchRef.current.y;

            applyTranslation(
              translateXRef.current + deltaX,
              translateYRef.current + deltaY
            );

            lastTouchRef.current = currentTouch;
          }
        },

        onPanResponderRelease: () => {
          lastTouchRef.current = null;
          pinchStartDistanceRef.current = null;
        },

        onPanResponderTerminate: () => {
          lastTouchRef.current = null;
          pinchStartDistanceRef.current = null;
        },
      }),
    [cropGeometry]
  );

  function resetCropPosition() {
    zoomRef.current = 1;
    translateXRef.current = 0;
    translateYRef.current = 0;

    setZoom(1);
    setTranslateX(0);
    setTranslateY(0);

    lastTouchRef.current = null;
    pinchStartDistanceRef.current = null;
  }

  async function choosePhoto() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Photo access needed',
          'Allow Novori to access your photos so you can choose a profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];

      if (!asset.width || !asset.height) {
        throw new Error(
          'Novori could not read the dimensions of this photo.'
        );
      }

      setPendingPhoto({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });

      resetCropPosition();
      setCropVisible(true);
    } catch (error) {
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

  function cancelCrop() {
    if (uploadingPhoto) {
      return;
    }

    setCropVisible(false);
    setPendingPhoto(null);
    resetCropPosition();
  }

  async function useCroppedPhoto() {
    if (
      !pendingPhoto ||
      !cropGeometry
    ) {
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('You are no longer signed in.');
      }

      setUploadingPhoto(true);

      const totalScale =
        cropGeometry.baseScale * zoomRef.current;

      const cropSizeInSource =
        CROP_SIZE / totalScale;

      const originX = clamp(
        pendingPhoto.width / 2 -
          translateXRef.current / totalScale -
          cropSizeInSource / 2,
        0,
        pendingPhoto.width - cropSizeInSource
      );

      const originY = clamp(
        pendingPhoto.height / 2 -
          translateYRef.current / totalScale -
          cropSizeInSource / 2,
        0,
        pendingPhoto.height - cropSizeInSource
      );

      const croppedImage =
        await ImageManipulator.manipulateAsync(
          pendingPhoto.uri,
          [
            {
              crop: {
                originX,
                originY,
                width: cropSizeInSource,
                height: cropSizeInSource,
              },
            },
            {
              resize: {
                width: 1024,
                height: 1024,
              },
            },
          ],
          {
            compress: 0.9,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

      const response = await fetch(croppedImage.uri);
      const blob = await response.blob();

      const filePath = `${user.id}/avatar.jpg`;

      const { error: uploadError } =
        await supabase.storage
          .from('avatars')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } =
        supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

      const publicUrl =
        `${publicUrlData.publicUrl}?v=${Date.now()}`;

      const { error: profileError } =
        await supabase
          .from('profiles')
          .update({
            avatar_url: publicUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      setAvatarUrl(publicUrl);
      setCropVisible(false);
      setPendingPhoto(null);
      resetCropPosition();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while updating your photo.';

      Alert.alert(
        'Could not update photo',
        message
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    if (!profile) {
      return;
    }

    const trimmedName = displayName.trim();
    const trimmedBio = bio.trim();

    if (!trimmedName) {
      Alert.alert(
        'Display name required',
        'Enter a display name for your profile.'
      );
      return;
    }

    if (trimmedName.length > 50) {
      Alert.alert(
        'Display name too long',
        'Keep your display name at 50 characters or fewer.'
      );
      return;
    }

    if (trimmedBio.length > 160) {
      Alert.alert(
        'Bio too long',
        'Keep your bio at 160 characters or fewer.'
      );
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: trimmedName,
          bio: trimmedBio || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) {
        throw error;
      }

      router.back();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong while saving your profile.';

      Alert.alert(
        'Could not save profile',
        message
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={['top', 'bottom']}
      >
        <View style={styles.loadingWrap}>
          <ActivityIndicator
            size="large"
            color={COLORS.gold}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              name="chevron-back"
              size={24}
              color={COLORS.text}
            />
          </Pressable>

          <Text style={styles.headerTitle}>
            Edit Profile
          </Text>

          <Pressable
            disabled={saving}
            onPress={handleSave}
            hitSlop={10}
            style={({ pressed }) => [
              styles.saveHeaderButton,
              pressed && !saving && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator
                size="small"
                color={COLORS.gold}
              />
            ) : (
              <Text style={styles.saveHeaderText}>
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.photoSection}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {avatarInitial}
                </Text>
              </View>
            )}

            <Pressable
              disabled={uploadingPhoto}
              onPress={choosePhoto}
              style={({ pressed }) => [
                styles.changePhotoButton,
                pressed && !uploadingPhoto && styles.pressed,
              ]}
            >
              <Text style={styles.changePhotoText}>
                Change Profile Photo
              </Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>
              Display name
            </Text>

            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={COLORS.mutedText}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={50}
            />

            <Text style={styles.label}>
              Username
            </Text>

            <View style={styles.lockedField}>
              <Text style={styles.lockedValue}>
                @{username}
              </Text>

              <Ionicons
                name="lock-closed-outline"
                size={16}
                color={COLORS.mutedText}
              />
            </View>

            <Text style={styles.helperText}>
              Your Novori username is permanent.
            </Text>

            <View style={styles.labelRow}>
              <Text style={styles.label}>
                Bio
              </Text>

              <Text style={styles.counter}>
                {bio.length}/160
              </Text>
            </View>

            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell readers a little about yourself"
              placeholderTextColor={COLORS.mutedText}
              multiline
              textAlignVertical="top"
              maxLength={160}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={cropVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={cancelCrop}
      >
        <View style={styles.cropScreen}>
          <View
            style={[
              styles.cropHeader,
              {
                paddingTop: Math.max(insets.top, 12),
                height: 58 + Math.max(insets.top, 12),
              },
            ]}
          >
            <Pressable
              disabled={uploadingPhoto}
              onPress={cancelCrop}
              style={({ pressed }) => [
                styles.cropHeaderButton,
                pressed && !uploadingPhoto && styles.pressed,
              ]}
            >
              <Text style={styles.cropCancelText}>
                Cancel
              </Text>
            </Pressable>

            <Text style={styles.cropTitle}>
              Move & Scale
            </Text>

            <Pressable
              disabled={uploadingPhoto}
              onPress={useCroppedPhoto}
              style={({ pressed }) => [
                styles.cropHeaderButton,
                styles.cropUseButton,
                pressed && !uploadingPhoto && styles.pressed,
              ]}
            >
              {uploadingPhoto ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.gold}
                />
              ) : (
                <Text style={styles.cropUseText}>
                  Use
                </Text>
              )}
            </Pressable>
          </View>

          <View style={styles.cropBody}>
            <Text style={styles.cropHelp}>
              Drag to reposition • Pinch to zoom
            </Text>

            <View
              style={styles.cropCircle}
              {...cropPanResponder.panHandlers}
            >
              {pendingPhoto && cropGeometry ? (
                <Image
                  source={{ uri: pendingPhoto.uri }}
                  style={[
                    styles.cropImage,
                    {
                      width: cropGeometry.baseWidth,
                      height: cropGeometry.baseHeight,
                      transform: [
                        { translateX },
                        { translateY },
                        { scale: zoom },
                      ],
                    },
                  ]}
                />
              ) : null}
            </View>

            <Pressable
              disabled={uploadingPhoto}
              onPress={resetCropPosition}
              style={({ pressed }) => [
                styles.resetButton,
                pressed && !uploadingPhoto && styles.pressed,
              ]}
            >
              <Ionicons
                name="refresh-outline"
                size={17}
                color={COLORS.secondaryText}
              />

              <Text style={styles.resetText}>
                Reset
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  keyboardView: {
    flex: 1,
  },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 20,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
  },

  saveHeaderButton: {
    width: 58,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  saveHeaderText: {
    color: COLORS.gold,
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },

  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 44,
  },

  photoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },

  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: COLORS.elevated,
    borderWidth: 2,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 2,
    borderColor: COLORS.gold,
    backgroundColor: COLORS.elevated,
  },

  avatarText: {
    color: COLORS.gold,
    fontSize: 40,
    fontFamily: 'Inter_700Bold',
  },

  changePhotoButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },

  changePhotoText: {
    color: COLORS.gold,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },

  form: {
    width: '100%',
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  label: {
    color: COLORS.text,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
    marginTop: 16,
  },

  counter: {
    color: COLORS.mutedText,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 16,
    marginBottom: 8,
  },

  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    paddingHorizontal: 15,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },

  bioInput: {
    minHeight: 120,
    paddingTop: 14,
    paddingBottom: 14,
  },

  lockedField: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.elevated,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  lockedValue: {
    color: COLORS.secondaryText,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },

  helperText: {
    color: COLORS.mutedText,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
    marginTop: 7,
  },

  cropScreen: {
    flex: 1,
    backgroundColor: '#11110F',
  },

  cropHeader: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 10,
  },

  cropHeaderButton: {
    width: 70,
    height: 44,
    justifyContent: 'center',
  },

  cropUseButton: {
    alignItems: 'flex-end',
  },

  cropCancelText: {
    color: COLORS.secondaryText,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },

  cropUseText: {
    color: COLORS.gold,
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },

  cropTitle: {
    flex: 1,
    color: COLORS.text,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: 'PlayfairDisplay_700Bold',
  },

  cropBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 54,
  },

  cropHelp: {
    color: COLORS.secondaryText,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    marginBottom: 22,
  },

  cropCircle: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    borderRadius: CROP_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: COLORS.elevated,
    borderWidth: 3,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cropImage: {
    position: 'absolute',
  },

  resetButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginTop: 20,
  },

  resetText: {
    color: COLORS.secondaryText,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },

  pressed: {
    opacity: 0.68,
  },
});
