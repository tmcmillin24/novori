import ValidationWarningSheet from '../components/ValidationWarningSheet';
import { dismissKeyboardBeforeWarning } from '../lib/dismiss-keyboard-before-warning';
import { moderationMediaUrl } from '../lib/moderation-media-url';
import UiAnimated from 'react-native-reanimated';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useUiCropGesture } from '../lib/use-ui-crop-gesture';
import { Ionicons } from '@expo/vector-icons';
import { cropSquareImage } from '../lib/crop-square-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import PhotoSourceSheet from '../components/PhotoSourceSheet';
import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
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
function distanceBetweenTouches(first: {
    pageX: number;
    pageY: number;
}, second: {
    pageX: number;
    pageY: number;
}) {
    return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}
export default function EditProfileScreen() {
    const { colors } = useNovoriTheme();
    const styles = createStyles(colors);
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveWarning, setSaveWarning] = useState<{ title: string; message: string } | null>(null);
    async function showSaveWarning(title: string, message: string) {
        await dismissKeyboardBeforeWarning();
        setSaveWarning({ title, message });
    }
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
    const [cropVisible, setCropVisible] = useState(false);
    const [photoSourceVisible, setPhotoSourceVisible] = useState(false);
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
            const { data: { user }, error: userError, } = await supabase.auth.getUser();
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
                Alert.alert('Could not load profile', error.message);
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
        const source = displayName.trim() ||
            username ||
            'N';
        return source.charAt(0).toUpperCase();
    }, [displayName, username]);
    const cropGeometry = useMemo(() => {
        if (!pendingPhoto) {
            return null;
        }
        const baseScale = Math.max(CROP_SIZE / pendingPhoto.width, CROP_SIZE / pendingPhoto.height);
        return {
            baseScale,
            baseWidth: pendingPhoto.width * baseScale,
            baseHeight: pendingPhoto.height * baseScale,
        };
    }, [pendingPhoto]);
    function clampTranslation(x: number, y: number, nextZoom = zoomRef.current) {
        if (!cropGeometry) {
            return { x: 0, y: 0 };
        }
        const renderedWidth = cropGeometry.baseWidth * nextZoom;
        const renderedHeight = cropGeometry.baseHeight * nextZoom;
        const maxX = Math.max(0, (renderedWidth - CROP_SIZE) / 2);
        const maxY = Math.max(0, (renderedHeight - CROP_SIZE) / 2);
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
        const nextTranslation = clampTranslation(translateXRef.current, translateYRef.current, safeZoom);
        translateXRef.current = nextTranslation.x;
        translateYRef.current = nextTranslation.y;
        setTranslateX(nextTranslation.x);
        setTranslateY(nextTranslation.y);
    }
    const cropMotion = useUiCropGesture({ geometry: cropGeometry, size: CROP_SIZE, maxZoom: MAX_ZOOM, x: translateX, y: translateY, zoom, busy: uploadingPhoto, onCommit: (x, y, z) => { translateXRef.current = x; translateYRef.current = y; zoomRef.current = z; setTranslateX(x); setTranslateY(y); setZoom(z); } });
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
    function useSelectedPhoto(asset: ImagePicker.ImagePickerAsset) {
        if (!asset.width || !asset.height) {
            throw new Error('Novori could not read the dimensions of this photo.');
        }
        setPendingPhoto({
            uri: asset.uri,
            width: asset.width,
            height: asset.height,
        });
        resetCropPosition();
        setCropVisible(true);
    }
    async function choosePhotoFromLibrary() {
        try {
            // iOS/Android system picker grants access only to the selected image.
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 1,
            });
            if (result.canceled || !result.assets[0]) {
                return;
            }
            useSelectedPhoto(result.assets[0]);
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Something went wrong while opening your photos.';
            Alert.alert('Could not choose photo', message);
        }
    }
    async function takePhoto() {
        try {
            const permission = await ImagePicker.requestCameraPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Camera access needed', 'Allow Novori to use your camera so you can take a profile picture.');
                return;
            }
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 1,
            });
            if (result.canceled || !result.assets[0]) {
                return;
            }
            useSelectedPhoto(result.assets[0]);
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Something went wrong while opening the camera.';
            Alert.alert('Could not take photo', message);
        }
    }
    function openPhotoOptions() {
        setPhotoSourceVisible(true);
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
        const pose = cropMotion.read();
        translateXRef.current = pose.x;
        translateYRef.current = pose.y;
        zoomRef.current = pose.zoom;
        if (!pendingPhoto ||
            !cropGeometry) {
            return;
        }
        try {
            const { data: { user }, } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('You are no longer signed in.');
            }
            setUploadingPhoto(true);
            const totalScale = cropGeometry.baseScale * zoomRef.current;
            const cropSizeInSource = CROP_SIZE / totalScale;
            const originX = clamp(pendingPhoto.width / 2 -
                translateXRef.current / totalScale -
                cropSizeInSource / 2, 0, pendingPhoto.width - cropSizeInSource);
            const originY = clamp(pendingPhoto.height / 2 -
                translateYRef.current / totalScale -
                cropSizeInSource / 2, 0, pendingPhoto.height - cropSizeInSource);
            const croppedImage = await cropSquareImage(pendingPhoto.uri, {
                originX,
                originY,
                width: cropSizeInSource,
                height: cropSizeInSource,
            });
            const response = await fetch(croppedImage.uri);
            const imageBytes = await response.arrayBuffer();
            const filePath = `${user.id}/avatar-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, imageBytes, {
                contentType: 'image/jpeg',
                upsert: true,
            });
            if (uploadError) {
                throw uploadError;
            }
            const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);
            const publicUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
            const { error: profileError } = await supabase
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
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Something went wrong while updating your photo.';
            Alert.alert('Could not update photo', message);
        }
        finally {
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
            await showSaveWarning('Display name required', 'Enter a display name for your profile.');
            return;
        }
        if (trimmedName.length > 50) {
            await showSaveWarning('Display name too long', 'Keep your display name at 50 characters or fewer.');
            return;
        }
        if (trimmedBio.length > 160) {
            await showSaveWarning('Bio too long', 'Keep your bio at 160 characters or fewer.');
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
        }
        catch (error) {
            const details = error && typeof error === 'object'
                ? error as { message?: string; code?: string; review_id?: string }
                : null;
            const underReview = details?.code === 'NOVORI_MODERATION' && !!details.review_id;
            await showSaveWarning(
                underReview ? 'Submission under review' : 'Could not save profile',
                underReview
                    ? 'Your profile changes need a safety review and have not been saved. After approval, you can submit them again. For help, contact support@novori.link.'
                    : details?.message || 'Something went wrong while saving your profile.'
            );
        }
        finally {
            setSaving(false);
        }
    }
    if (loading) {
        return (<SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.gold}/>
        </View>
      </SafeAreaView>);
    }
    return (<SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ValidationWarningSheet visible={saveWarning !== null} title={saveWarning?.title ?? 'Could not save profile'} message={saveWarning?.message ?? ''} dismissLabel="Got it" onDismiss={() => setSaveWarning(null)}/>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.pressed,
        ]}>
            <Ionicons name="chevron-back" size={24} color={colors.text}/>
          </Pressable>

          <Text style={styles.headerTitle}>
            Edit Profile
          </Text>

          <Pressable disabled={saving} onPress={handleSave} hitSlop={10} style={({ pressed }) => [
            styles.saveHeaderButton,
            pressed && !saving && styles.pressed,
        ]}>
            {saving ? (<ActivityIndicator size="small" color={colors.gold}/>) : (<Text style={styles.saveHeaderText}>
                Save
              </Text>)}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.photoSection}>
            {avatarUrl ? (<Image source={{ uri: moderationMediaUrl(avatarUrl) }} style={styles.avatarImage}/>) : (<View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {avatarInitial}
                </Text>
              </View>)}

            <Pressable disabled={uploadingPhoto} onPress={openPhotoOptions} style={({ pressed }) => [
            styles.changePhotoButton,
            pressed && !uploadingPhoto && styles.pressed,
        ]}>
              <Text style={styles.changePhotoText}>
                Change Profile Photo
              </Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>
              Display name
            </Text>

            <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor={colors.mutedText} autoCapitalize="words" autoCorrect={false} maxLength={50}/>

            <Text style={styles.label}>
              Username
            </Text>

            <View style={styles.lockedField}>
              <Text style={styles.lockedValue}>
                @{username}
              </Text>

              <Ionicons name="lock-closed-outline" size={16} color={colors.mutedText}/>
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

            <TextInput style={[styles.input, styles.bioInput]} value={bio} onChangeText={setBio} placeholder="Tell readers a little about yourself" placeholderTextColor={colors.mutedText} multiline textAlignVertical="top" maxLength={160}/>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PhotoSourceSheet visible={photoSourceVisible} title="Change Profile Photo" colors={colors} onClose={() => setPhotoSourceVisible(false)} onTakePhoto={takePhoto} onChooseLibrary={choosePhotoFromLibrary}/>

      <Modal visible={cropVisible} animationType="slide" presentationStyle="fullScreen" onRequestClose={cancelCrop}><GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.cropScreen}>
          <View style={[
            styles.cropHeader,
            {
                paddingTop: Math.max(insets.top, 12),
                height: 58 + Math.max(insets.top, 12),
            },
        ]}>
            <Pressable disabled={uploadingPhoto} onPress={cancelCrop} style={({ pressed }) => [
            styles.cropHeaderButton,
            pressed && !uploadingPhoto && styles.pressed,
        ]}>
              <Text style={styles.cropCancelText}>
                Cancel
              </Text>
            </Pressable>

            <Text style={styles.cropTitle}>
              Move & Scale
            </Text>

            <Pressable disabled={uploadingPhoto} onPress={useCroppedPhoto} style={({ pressed }) => [
            styles.cropHeaderButton,
            styles.cropUseButton,
            pressed && !uploadingPhoto && styles.pressed,
        ]}>
              {uploadingPhoto ? (<ActivityIndicator size="small" color={colors.gold}/>) : (<Text style={styles.cropUseText}>
                  Use
                </Text>)}
            </Pressable>
          </View>

          <View style={styles.cropBody}>
            <Text style={styles.cropHelp}>
              Drag to reposition • Pinch to zoom
            </Text>

            <GestureDetector gesture={cropMotion.gesture}><View style={styles.cropCircle} collapsable={false}>
              {pendingPhoto && cropGeometry ? (<UiAnimated.Image source={{ uri: moderationMediaUrl(pendingPhoto.uri) }} style={[
                styles.cropImage,
                {
                    width: cropGeometry.baseWidth,
                    height: cropGeometry.baseHeight
                },
                cropMotion.style
            ]}/>) : null}
            </View></GestureDetector>

            <Pressable disabled={uploadingPhoto} onPress={resetCropPosition} style={({ pressed }) => [
            styles.resetButton,
            pressed && !uploadingPhoto && styles.pressed,
        ]}>
              <Ionicons name="refresh-outline" size={17} color={colors.secondaryText}/>

              <Text style={styles.resetText}>
                Reset
              </Text>
            </Pressable>
          </View>
        </View>
      </GestureHandlerRootView></Modal>
    </SafeAreaView>);
}
const createStyles = (colors: NovoriColors) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
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
        borderBottomColor: colors.border,
    },
    headerButton: {
        width: 44,
        height: 44,
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
    saveHeaderButton: {
        width: 58,
        height: 44,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    saveHeaderText: {
        color: colors.gold,
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
        backgroundColor: colors.elevated,
        borderWidth: 2,
        borderColor: colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: 104,
        height: 104,
        borderRadius: 52,
        borderWidth: 2,
        borderColor: colors.gold,
        backgroundColor: colors.elevated,
    },
    avatarText: {
        color: colors.gold,
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
        color: colors.gold,
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
        color: colors.text,
        fontSize: 13,
        fontFamily: 'Inter_600SemiBold',
        marginBottom: 8,
        marginTop: 16,
    },
    counter: {
        color: colors.mutedText,
        fontSize: 12,
        fontFamily: 'Inter_400Regular',
        marginTop: 16,
        marginBottom: 8,
    },
    input: {
        minHeight: 52,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        color: colors.text,
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
        borderColor: colors.border,
        backgroundColor: colors.elevated,
        paddingHorizontal: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    lockedValue: {
        color: colors.secondaryText,
        fontSize: 15,
        fontFamily: 'Inter_400Regular',
    },
    helperText: {
        color: colors.mutedText,
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
        borderBottomColor: colors.border,
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
        color: colors.secondaryText,
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
    },
    cropUseText: {
        color: colors.gold,
        fontSize: 14,
        fontFamily: 'Inter_700Bold',
    },
    cropTitle: {
        flex: 1,
        color: colors.text,
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
        color: colors.secondaryText,
        fontSize: 13,
        fontFamily: 'Inter_400Regular',
        marginBottom: 22,
    },
    cropCircle: {
        width: CROP_SIZE,
        height: CROP_SIZE,
        borderRadius: CROP_SIZE / 2,
        overflow: 'hidden',
        backgroundColor: colors.elevated,
        borderWidth: 3,
        borderColor: colors.gold,
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
        color: colors.secondaryText,
        fontSize: 13,
        fontFamily: 'Inter_600SemiBold',
    },
    pressed: {
        opacity: 0.68,
    },
});
