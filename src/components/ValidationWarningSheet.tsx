import { useUiSheetMotion, UiSheetModal, UiSheetSurface, UiSheetBackdrop } from './UiSheet';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
type Props = {
    visible: boolean;
    title: string;
    message: string;
    onDismiss: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
    dismissLabel?: string;
};
export default function ValidationWarningSheet({ visible, title, message, onDismiss, icon = 'alert-circle-outline', dismissLabel = 'Dismiss warning' }: Props) {
    const { colors } = useNovoriTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const motion = useUiSheetMotion({ visible, busy: false, onDismiss: onDismiss });
    const closeSmoothly = motion.close;
    // Use the same fade/slide timings and gesture thresholds as Novori's existing
    // confirmation sheets, with one acknowledgement button for validation.
    return (<UiSheetModal visible={visible} transparent animationType="none" onRequestClose={closeSmoothly} motion={motion}>
      <Pressable style={styles.backdrop} onPress={closeSmoothly}>
        <UiSheetBackdrop pointerEvents="none" style={[styles.backdropVisual, {}]} motion={motion}/>
        <UiSheetSurface accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 12) }]} motion={motion}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle}/>
            <View style={styles.icon}><Ionicons name={icon} size={23} color={colors.gold}/></View>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            <Text style={styles.message}>{message}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={dismissLabel} onPress={closeSmoothly} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
              <Text style={styles.buttonText}>Got it</Text>
            </Pressable>
          </Pressable>
        </UiSheetSurface>
      </Pressable>
    </UiSheetModal>);
}
function createStyles(colors: NovoriColors) {
    return StyleSheet.create({
        backdrop: { flex: 1, justifyContent: 'flex-end' },
        backdropVisual: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.48)' },
        sheet: { width: '100%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, overflow: 'hidden' },
        handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 13 },
        icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 6, marginBottom: 14 },
        title: { color: colors.text, fontFamily: 'PlayfairDisplay_700Bold', fontSize: 21, textAlign: 'center' },
        message: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 19, textAlign: 'center', marginTop: 7 },
        button: { minHeight: 46, borderRadius: 14, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
        buttonText: { color: colors.background, fontFamily: 'Inter_700Bold', fontSize: 13 },
        pressed: { opacity: 0.76 },
    });
}
