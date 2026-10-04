import { useUiSheetMotion, UiSheetModal, UiSheetSurface, UiSheetBackdrop } from './UiSheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
type Props = {
    visible: boolean;
    embedded?: boolean;
    readerName: string;
    mode?: 'block' | 'unblock';
    message?: string;
    busy?: boolean;
    onConfirm: () => Promise<void>;
    onDismiss: () => void;
    onDismissed?: () => void;
};
export default function BlockReaderConfirmSheet({ visible, embedded = false, readerName, mode = 'block', message, busy = false, onConfirm, onDismiss, onDismissed, }: Props) {
    const { colors, } = useNovoriTheme();
    const insets = useSafeAreaInsets();
    const styles = createStyles(colors);
    const motion = useUiSheetMotion({ visible, busy: busy, embedded, onDismiss: onDismiss });
    const closeSmoothly = motion.close;
    // iOS reports completion through Modal.onDismiss. Other platforms
    // finish when the non-animated native modal becomes hidden.
    const wasVisible = useRef(visible);
    useEffect(() => {
        const didHide = wasVisible.current && !visible;
        wasVisible.current = visible;
        if (didHide && (embedded || Platform.OS !== 'ios')) {
            onDismissed?.();
        }
    }, [visible, embedded, onDismissed]);
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
            // Parent owns its error presentation.
        }
    }
    const isUnblock = mode ===
        'unblock';
    const title = isUnblock
        ? `Unblock ${readerName}?`
        : `Block ${readerName}?`;
    const body = message ??
        (isUnblock
            ? 'They will be able to interact with you again. Previous follow relationships will not be restored automatically.'
            : 'Their posts and comments will be hidden from you, and any follow relationship between you will be removed. You can unblock them later in Settings.');
    const content = (<Pressable style={styles.backdrop} onPress={closeSmoothly}>
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
              <Ionicons name={isUnblock
            ? 'person-add-outline'
            : 'ban-outline'} size={24} color={colors.gold}/>
            </View>

            <Text style={styles.title}>
              {title}
            </Text>

            <Text style={styles.message}>
              {body}
            </Text>

            <View style={styles.actions}>
              <Pressable disabled={busy} onPress={closeSmoothly} style={({ pressed }) => [
            styles.cancelButton,
            pressed &&
                styles.pressed,
        ]}>
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable disabled={busy} onPress={() => void confirm()} style={({ pressed }) => [
            styles.primaryButton,
            pressed &&
                styles.pressed,
        ]}>
                {busy ? (<ActivityIndicator size="small" color={colors.text}/>) : (<Text style={styles.primaryText}>
                    {isUnblock
                ? 'Unblock'
                : 'Block'}
                  </Text>)}
              </Pressable>
            </View>
          </Pressable>
        </UiSheetSurface>
      </Pressable>);
    if (embedded) {
        return visible ? (<GestureHandlerRootView style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        {content}
      </GestureHandlerRootView>) : null;
    }
    return (<UiSheetModal visible={visible} transparent animationType="none" onDismiss={onDismissed} onRequestClose={closeSmoothly} motion={motion}>
      {content}
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
            backgroundColor: colors.background,
            alignItems: 'center',
            justifyContent: 'center',
        },
        primaryButton: {
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
            fontSize: 12.5,
        },
        primaryText: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 12.5,
        },
        pressed: {
            opacity: 0.78,
        },
    });
}
