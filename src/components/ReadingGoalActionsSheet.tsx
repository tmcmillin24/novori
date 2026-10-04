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
    periodLabel: string;
    onEdit: () => void;
    onRemove: () => void;
    onDismiss: () => void;
};
export default function ReadingGoalActionsSheet({ visible, title, periodLabel, onEdit, onRemove, onDismiss }: Props) {
    const { colors } = useNovoriTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const motion = useUiSheetMotion({ visible, busy: false, onDismiss: onDismiss });
    const closeSmoothly = motion.close;
    // Match Novori's existing fade, slide, and drag dismissal behavior.
    return (<UiSheetModal visible={visible} transparent animationType="none" onRequestClose={() => closeSmoothly()} motion={motion}>
      <Pressable style={styles.backdrop} onPress={() => closeSmoothly()}>
        <UiSheetBackdrop pointerEvents="none" style={[styles.backdropVisual, {}]} motion={motion}/>
        <UiSheetSurface accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 12) }]} motion={motion}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle}/>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            <Text style={styles.period}>{periodLabel}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${title}`} onPress={() => closeSmoothly(onEdit)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <View style={styles.actionIcon}><Ionicons name="create-outline" size={20} color={colors.gold}/></View>
              <Text style={styles.actionText}>Edit goal</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedText}/>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${title}`} onPress={() => closeSmoothly(onRemove)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <View style={styles.actionIcon}><Ionicons name="trash-outline" size={19} color={colors.danger}/></View>
              <Text style={[styles.actionText, { color: colors.danger }]}>Remove goal</Text>
            </Pressable>
            <Text style={styles.note}>Removing a goal keeps your reading history.</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Cancel goal options" onPress={() => closeSmoothly()} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={styles.cancelText}>Cancel</Text></Pressable>
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
        title: { color: colors.text, fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 21, textAlign: 'center' },
        period: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: 14 },
        action: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 12,
            backgroundColor: colors.elevated, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
        actionIcon: { width: 28, alignItems: 'center' }, actionText: { flex: 1, color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
        note: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', marginTop: 4 },
        cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
        cancelText: { color: colors.secondaryText, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
        pressed: { opacity: 0.76 },
    });
}
