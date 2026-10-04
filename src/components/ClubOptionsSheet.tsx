import { useUiSheetMotion, UiSheetModal, UiSheetSurface, UiSheetBackdrop } from './UiSheet';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ClubRole } from '../lib/clubs';
import { getClubHomeActions, type ClubHomeAction } from '../lib/club-home';
import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
type Props = {
    visible: boolean;
    clubName: string;
    role: ClubRole | null;
    canViewMembers: boolean;
    hasRules: boolean;
    busy: boolean;
    onAction: (action: ClubHomeAction) => void;
    onDismiss: () => void;
    notificationsEnabled?: boolean;
    globalNotificationsEnabled?: boolean;
    notificationsBusy?: boolean;
};
const actionDetails: Record<ClubHomeAction, {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
}> = {
    edit: { label: 'Edit club', icon: 'create-outline' }, rules: { label: 'Club rules', icon: 'reader-outline' },
    members: { label: 'Members', icon: 'people-outline' }, manage: { label: 'Manage members & invitations', icon: 'shield-checkmark-outline' },
    leave: { label: 'Leave club', icon: 'exit-outline' },
    guide: { label: 'Club guide', icon: 'sparkles-outline' }, notifications: { label: 'Mute club notifications', icon: 'notifications-off-outline' },
    notification_settings: { label: 'Notification settings', icon: 'settings-outline' },
};
export default function ClubOptionsSheet({ visible, clubName, role, canViewMembers, hasRules, busy, notificationsEnabled = true, globalNotificationsEnabled = true, notificationsBusy = false, onAction, onDismiss }: Props) {
    const { colors } = useNovoriTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const motion = useUiSheetMotion({ visible, busy: busy, onDismiss: onDismiss });
    const closeSmoothly = motion.close;
    // Match Novori's existing fade, slide, and drag dismissal behavior.
    return (<UiSheetModal visible={visible} transparent animationType="none" onRequestClose={() => closeSmoothly()} motion={motion}>
      <Pressable style={styles.backdrop} onPress={() => closeSmoothly()}>
        <UiSheetBackdrop pointerEvents="none" style={[styles.backdropVisual, {}]} motion={motion}/>
        <UiSheetSurface accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(18, insets.bottom + 12) }]} motion={motion}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle}/>
            <Text style={styles.title} accessibilityRole="header">{clubName}</Text>
            <Text style={styles.period}>Club options</Text>
            {getClubHomeActions(role, canViewMembers, hasRules).map(action => <Pressable key={action} accessibilityRole="button" accessibilityLabel={action === 'notifications' ? (notificationsEnabled ? 'Mute club notifications' : 'Unmute club notifications') : actionDetails[action].label} disabled={(busy && action === 'leave') || (notificationsBusy && action === 'notifications')} onPress={() => closeSmoothly(() => onAction(action))} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <View style={styles.actionIcon}><Ionicons name={action === 'notifications' && !notificationsEnabled ? 'notifications-outline' : actionDetails[action].icon} size={20} color={action === 'leave' ? colors.danger : colors.gold}/></View>
              <Text style={[styles.actionText, action === 'leave' && { color: colors.danger }]}>{action === 'notifications' ? (notificationsEnabled ? 'Mute club notifications' : 'Unmute club notifications') : actionDetails[action].label}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedText}/>
            </Pressable>)}
            {role ? <Text style={styles.note}>{!globalNotificationsEnabled ? 'Club notifications are off in Settings.' : notificationsEnabled ? 'Notifications are on for this club.' : 'This club is muted. Other clubs can still notify you.'}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Close club options" onPress={() => closeSmoothly()} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={styles.cancelText}>Cancel</Text></Pressable>
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
