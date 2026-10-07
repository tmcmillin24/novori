import { useUiSheetMotion, UiSheetModal, UiSheetSurface, UiSheetBackdrop } from './UiSheet';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
type RemoveBookConfirmSheetProps = {
    visible: boolean;
    bookTitle: string;
    hasReadingDetails: boolean;
    busy?: boolean;
    onConfirm: () => Promise<void>;
    onDismiss: () => void;
};
export default function RemoveBookConfirmSheet({ visible, bookTitle, hasReadingDetails, busy = false, onConfirm, onDismiss, }: RemoveBookConfirmSheetProps) {
    const { colors, } = useNovoriTheme();
    const styles = createStyles(colors);
    const insets = useSafeAreaInsets();
    const motion = useUiSheetMotion({ visible, busy: busy, onDismiss: onDismiss });
    const closeSmoothly = motion.close;
    async function confirmRemove() {
        if (busy || motion.closing.current)
            return;
        try {
            await onConfirm();
            motion.closeAfterAction();
        }
        catch { /* Parent owns error presentation. */ }
    }
    const message = hasReadingDetails
        ? `Removing ${bookTitle} permanently deletes its private Reading Details, including your summary, notes, and checkpoints. Its saved rating and review will also be removed.`
        : `Removing ${bookTitle} removes it from your Library along with its saved rating and review.`;
    return (<UiSheetModal visible={visible} transparent animationType="none" onRequestClose={closeSmoothly} motion={motion}>
      <Pressable style={styles.backdrop} onPress={closeSmoothly}>
        <UiSheetBackdrop pointerEvents="none" style={[
            StyleSheet.absoluteFill,
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

            <View style={styles.iconWrap}>
              <Ionicons name="trash-outline" size={24} color={colors.danger}/>
            </View>

            <Text style={styles.title}>
              Remove from Library?
            </Text>

            <Text style={styles.bookTitle} numberOfLines={2}>
              {bookTitle}
            </Text>

            <Text style={styles.message}>
              {message}
            </Text>

            {hasReadingDetails ? (<View style={styles.warningCard}>
                <Text style={styles.warningTitle}>
                  This cannot be undone
                </Text>

                <Text style={styles.warningText}>
                  Your private reading record will not return if you add the book again later.
                </Text>
              </View>) : null}

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

              <Pressable disabled={busy} onPress={() => void confirmRemove()} style={({ pressed, }) => [
            styles.removeButton,
            (pressed ||
                busy) &&
                styles.pressed,
        ]}>
                {busy ? (<ActivityIndicator size="small" color={colors.text}/>) : (<Text style={styles.removeText}>
                    Remove
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
            backgroundColor: 'transparent',
        },
        backdropVisual: {
            backgroundColor: 'rgba(0, 0, 0, 0.52)',
        },
        sheet: {
            width: '100%',
            maxWidth: 720,
            alignSelf: 'center',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
            paddingHorizontal: 18,
            paddingTop: 9,
        },
        handle: {
            width: 38,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: 'center',
            marginBottom: 18,
        },
        iconWrap: {
            width: 46,
            height: 46,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            backgroundColor: colors.elevated,
            marginBottom: 13,
        },
        title: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 18,
            textAlign: 'center',
        },
        bookTitle: {
            color: colors.gold,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
            lineHeight: 18,
            textAlign: 'center',
            marginTop: 6,
        },
        message: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 13,
            lineHeight: 20,
            textAlign: 'center',
            marginTop: 12,
        },
        warningCard: {
            backgroundColor: colors.elevated,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 13,
            paddingHorizontal: 13,
            paddingVertical: 11,
            marginTop: 14,
        },
        warningTitle: {
            color: colors.danger,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 11.5,
        },
        warningText: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            lineHeight: 16,
            marginTop: 3,
        },
        actions: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 18,
        },
        cancelButton: {
            flex: 1,
            minHeight: 46,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 13,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.elevated,
        },
        cancelText: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
        },
        removeButton: {
            flex: 1,
            minHeight: 46,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 13,
            backgroundColor: colors.danger,
        },
        removeText: {
            color: colors.text,
            fontFamily: 'Inter_700Bold',
            fontSize: 13,
        },
        pressed: {
            opacity: 0.68,
        },
    });
}
