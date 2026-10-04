import { useUiSheetMotion, UiSheetModal, UiSheetSurface, UiSheetBackdrop } from './UiSheet';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ColorValue, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NovoriColors } from '../constants/novori-theme';
type PhotoSourceColors = {
    [Key in keyof NovoriColors]: ColorValue;
};
type PhotoSourceSheetProps = {
    visible: boolean;
    title: string;
    subtitle?: string;
    colors: PhotoSourceColors;
    onClose: () => void;
    onTakePhoto: () => void | Promise<void>;
    onChooseLibrary: () => void | Promise<void>;
};
export default function PhotoSourceSheet({ visible, title, subtitle = 'Choose where your photo comes from.', colors, onClose, onTakePhoto, onChooseLibrary, }: PhotoSourceSheetProps) {
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(colors), [
        colors,
    ]);
    const [mounted, setMounted,] = useState(visible);
    const motion = useUiSheetMotion({ visible, busy: false, onDismiss: () => { setMounted(false); onClose(); } });
    const closeSmoothly = motion.close;
    useEffect(() => {
        if (visible) {
            setMounted(true);
            return;
        }
        if (mounted &&
            !motion.closing.current) {
            setMounted(false);
        }
    }, [
        mounted,
        visible,
    ]);
    function runAction(action: () => void | Promise<void>) {
        closeSmoothly(() => {
            void action();
        });
    }
    if (!mounted) {
        return null;
    }
    return (<UiSheetModal visible transparent animationType="none" onRequestClose={() => closeSmoothly()} motion={motion}>
      <SafeAreaView style={styles.modalRoot} edges={[
            'top',
            'left',
            'right',
        ]}>
        <Pressable style={styles.backdrop} onPress={() => closeSmoothly()}>
          <UiSheetBackdrop pointerEvents="none" style={[
            styles.backdropVisual,
            {}
        ]} motion={motion}/>

          <UiSheetSurface style={[
            styles.sheet,
            {
                paddingBottom: Math.max(18, insets.bottom +
                    12)
            }
        ]} motion={motion}>
            <Pressable onPress={(event) => event.stopPropagation()}>
              <View style={styles.handle}/>

              <Text style={styles.title}>
                {title}
              </Text>

              <Text style={styles.subtitle}>
                {subtitle}
              </Text>

              <View style={styles.actions}>
                <Pressable onPress={() => runAction(onTakePhoto)} style={({ pressed, }) => [
            styles.actionRow,
            pressed &&
                styles.actionPressed,
        ]}>
                  <View style={styles.iconWrap}>
                    <Ionicons name="camera-outline" size={21} color={colors.gold}/>
                  </View>

                  <View style={styles.actionCopy}>
                    <Text style={styles.actionTitle}>
                      Take Photo
                    </Text>

                    <Text style={styles.actionText}>
                      Use your camera to take a new photo.
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
                </Pressable>

                <View style={styles.divider}/>

                <Pressable onPress={() => runAction(onChooseLibrary)} style={({ pressed, }) => [
            styles.actionRow,
            pressed &&
                styles.actionPressed,
        ]}>
                  <View style={styles.iconWrap}>
                    <Ionicons name="images-outline" size={21} color={colors.gold}/>
                  </View>

                  <View style={styles.actionCopy}>
                    <Text style={styles.actionTitle}>
                      Choose from Library
                    </Text>

                    <Text style={styles.actionText}>
                      Pick a photo with the system photo picker.
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
                </Pressable>
              </View>

              <Pressable onPress={() => closeSmoothly()} style={({ pressed, }) => [
            styles.cancelButton,
            pressed &&
                styles.actionPressed,
        ]}>
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>
            </Pressable>
          </UiSheetSurface>
        </Pressable>
      </SafeAreaView>
    </UiSheetModal>);
}
function createStyles(colors: PhotoSourceColors) {
    return StyleSheet.create({
        modalRoot: {
            flex: 1,
        },
        backdrop: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        backdropVisual: {
            ...StyleSheet.absoluteFill,
            backgroundColor: 'rgba(0,0,0,0.58)',
        },
        sheet: {
            width: '100%',
            maxWidth: 720,
            alignSelf: 'center',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.border,
            paddingHorizontal: 18,
            paddingTop: 10,
        },
        handle: {
            width: 38,
            height: 4,
            borderRadius: 2,
            alignSelf: 'center',
            backgroundColor: colors.border,
            marginBottom: 16,
        },
        title: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 21,
            textAlign: 'center',
        },
        subtitle: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            lineHeight: 18,
            textAlign: 'center',
            marginTop: 5,
            marginBottom: 17,
        },
        actions: {
            overflow: 'hidden',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.elevated,
        },
        actionRow: {
            minHeight: 72,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 12,
        },
        actionPressed: {
            opacity: 0.68,
        },
        iconWrap: {
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.background,
            marginRight: 12,
        },
        actionCopy: {
            flex: 1,
            paddingRight: 10,
        },
        actionTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
        },
        actionText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            lineHeight: 16,
            marginTop: 3,
        },
        divider: {
            height: 1,
            backgroundColor: colors.border,
            marginLeft: 66,
        },
        cancelButton: {
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 10,
        },
        cancelText: {
            color: colors.secondaryText,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
        },
    });
}
