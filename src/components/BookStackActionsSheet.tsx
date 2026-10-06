import { useUiSheetMotion, UiSheetModal, UiSheetSurface, UiSheetBackdrop } from './UiSheet';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
type Props = {
    visible: boolean;
    stackName?: string | null;
    onView?: () => void;
    onEdit: () => void;
    onShare: () => void;
    onDelete: () => void;
    onDismiss: () => void;
};
export default function BookStackActionsSheet({ visible, stackName, onView, onEdit, onShare, onDelete, onDismiss, }: Props) {
    const { colors, } = useNovoriTheme();
    const insets = useSafeAreaInsets();
    const styles = createStyles(colors);
    const motion = useUiSheetMotion({ visible, busy: false, onDismiss: onDismiss });
    const closeSmoothly = motion.close;
    function runAction(action: () => void) {
        closeSmoothly(action);
    }
    return (<UiSheetModal visible={visible} transparent animationType="none" onRequestClose={() => closeSmoothly()} motion={motion}>
      <Pressable style={styles.backdrop} onPress={() => closeSmoothly()}>
        <UiSheetBackdrop pointerEvents="none" style={[
            styles.backdropVisual,
            {}
        ]} motion={motion}/>

        <UiSheetSurface style={[
            styles.sheet,
            {
                paddingBottom: Math.max(20, insets.bottom +
                    12)
            }
        ]} motion={motion}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle}/>

            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title} numberOfLines={2}>
                  {stackName?.trim() ||
            'Book Stack'}
                </Text>
              </View>

              <Pressable onPress={() => closeSmoothly()} hitSlop={8} style={({ pressed }) => [
            styles.closeButton,
            pressed &&
                styles.rowPressed,
        ]}>
                <Ionicons name="close" size={20} color={colors.mutedText}/>
              </Pressable>
            </View>

            <View style={styles.actions}>
              {onView ? <Pressable accessibilityRole="button" accessibilityLabel="View Stack" onPress={() => runAction(onView)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <View style={styles.rowIcon}><Ionicons name="albums-outline" size={20} color={colors.gold}/></View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>View Stack</Text>
                  <Text style={styles.rowSubtitle}>Browse the stack and open its books</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
              </Pressable> : null}

              <Pressable onPress={() => runAction(onEdit)} style={({ pressed }) => [
            styles.row,
            pressed &&
                styles.rowPressed,
        ]}>
                <View style={styles.rowIcon}>
                  <Ionicons name="create-outline" size={20} color={colors.gold}/>
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>
                    Edit Stack
                  </Text>

                  <Text style={styles.rowSubtitle}>
                    Change the name, books, or order
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
              </Pressable>

              <Pressable onPress={() => runAction(onShare)} style={({ pressed }) => [
            styles.row,
            pressed &&
                styles.rowPressed,
        ]}>
                <View style={styles.rowIcon}>
                  <Ionicons name="share-social-outline" size={20} color={colors.gold}/>
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>
                    Share Stack
                  </Text>

                  <Text style={styles.rowSubtitle}>
                    Share this Book Stack with others
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
              </Pressable>

              <View style={styles.divider}/>

              <Pressable onPress={() => runAction(onDelete)} style={({ pressed }) => [
            styles.row,
            pressed &&
                styles.rowPressed,
        ]}>
                <View style={[
            styles.rowIcon,
            styles.dangerIcon
        ]}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger}/>
                </View>

                <View style={styles.rowText}>
                  <Text style={styles.dangerText}>
                    Delete Stack
                  </Text>

                  <Text style={styles.rowSubtitle}>
                    Permanently remove this Book Stack
                  </Text>
                </View>
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
            backgroundColor: 'rgba(0, 0, 0, 0.52)',
        },
        sheet: {
            width: '100%',
            alignSelf: 'center',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
            paddingHorizontal: 18,
            paddingTop: 9,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
        },
        handle: {
            width: 38,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: 'center',
            marginBottom: 15,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingBottom: 15,
        },
        headerText: {
            flex: 1,
            marginRight: 10,
            paddingVertical: 6,
        },
        title: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 15,
            lineHeight: 20,
        },
        closeButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        actions: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 7,
        },
        row: {
            minHeight: 64,
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 14,
            paddingHorizontal: 10,
            paddingVertical: 8,
        },
        rowPressed: {
            backgroundColor: colors.elevated,
        },
        rowIcon: {
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.elevated,
            marginRight: 11,
        },
        dangerIcon: {
            backgroundColor: colors.background,
        },
        rowText: {
            flex: 1,
            marginRight: 8,
        },
        rowTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
        },
        rowSubtitle: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            lineHeight: 16,
            marginTop: 3,
        },
        divider: {
            height: 1,
            backgroundColor: colors.border,
            marginVertical: 5,
        },
        dangerText: {
            color: colors.danger,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
        },
    });
}
