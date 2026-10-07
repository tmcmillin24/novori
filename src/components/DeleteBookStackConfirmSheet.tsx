import { useUiSheetMotion, UiSheetModal, UiSheetSurface, UiSheetBackdrop } from './UiSheet';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
type Props = {
    visible: boolean;
    busy?: boolean;
    onConfirm: () => Promise<void>;
    onDismiss: () => void;
};
export default function DeleteBookStackConfirmSheet({ visible, busy = false, onConfirm, onDismiss, }: Props) {
    const { colors, } = useNovoriTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(colors), [
        colors,
    ]);
    const motion = useUiSheetMotion({ visible, busy: busy, onDismiss: onDismiss });
    const closeSmoothly = motion.close;
    async function confirm() {
        if (busy ||
            motion.closing.current) {
            return;
        }
        try {
            await onConfirm();
            motion.closeAfterAction();
        }
        catch {
            // Parent owns the error alert and keeps this sheet open.
        }
    }
    return (<UiSheetModal visible={visible} transparent animationType="none" onRequestClose={closeSmoothly} motion={motion}>
      <Pressable style={styles.backdrop} onPress={closeSmoothly}>
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

            <View style={styles.icon}>
              <Ionicons name="trash-outline" size={23} color={colors.danger}/>
            </View>

            <Text style={styles.title}>
              Delete Book Stack?
            </Text>

            <Text style={styles.message}>
              This Book Stack will be permanently deleted from your profile. This can’t be undone.
            </Text>

            <View style={styles.actions}>
              <Pressable disabled={busy} onPress={closeSmoothly} style={({ pressed, }) => [
            styles.cancelButton,
            pressed &&
                styles.pressed,
        ]}>
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable disabled={busy} onPress={() => void confirm()} style={({ pressed, }) => [
            styles.deleteButton,
            pressed &&
                styles.pressed,
        ]}>
                {busy ? (<ActivityIndicator size="small" color={colors.text}/>) : (<Text style={styles.deleteText}>
                    Delete
                  </Text>)}
              </Pressable>
            </View>
          </Pressable>
        </UiSheetSurface>
      </Pressable>
    </UiSheetModal>);
}
function createStyles(colors: NovoriColors) {
    return StyleSheet.create({
        backdrop: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        backdropVisual: {
            ...StyleSheet.absoluteFill,
            backgroundColor: 'rgba(0,0,0,0.48)',
        },
        sheet: {
            width: '100%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 18,
            paddingTop: 10,
            overflow: 'hidden',
        },
        handle: {
            width: 42,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: 'center',
            marginBottom: 13,
        },
        icon: {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            marginTop: 6,
            marginBottom: 14,
        },
        title: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 21,
            textAlign: 'center',
        },
        message: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12.5,
            lineHeight: 19,
            textAlign: 'center',
            marginTop: 7,
        },
        actions: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 20,
        },
        cancelButton: {
            flex: 1,
            minHeight: 46,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
        },
        cancelText: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
        },
        deleteButton: {
            flex: 1,
            minHeight: 46,
            borderRadius: 14,
            backgroundColor: colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
        },
        deleteText: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 13,
        },
        pressed: {
            opacity: 0.76,
        },
    });
}
