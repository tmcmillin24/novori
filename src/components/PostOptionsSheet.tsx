import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNovoriTheme } from '../context/theme-context';
import type { NovoriColors } from '../constants/novori-theme';
import { UiSheetBackdrop, UiSheetModal, UiSheetSurface, useUiSheetMotion } from './UiSheet';

type Props = { visible: boolean; onDismiss: () => void; onEdit?: () => void; onDelete?: () => void };

export default function PostOptionsSheet({visible, onDismiss, onEdit, onDelete}: Props) {
    const {colors} = useNovoriTheme();
    const insets = useSafeAreaInsets();
    const styles = createStyles(colors);
    const motion = useUiSheetMotion({visible, busy: false, embedded: false, onDismiss});
    return (
      <UiSheetModal visible={visible} transparent animationType="none" onRequestClose={() => motion.close()} motion={motion}>
        <Pressable style={styles.ownPostOptionsBackdrop} onPress={() => motion.close()}>
          <UiSheetBackdrop pointerEvents="none" style={[
            styles.ownPostOptionsBackdropVisual,
            {}
        ]} motion={motion}/>

          <UiSheetSurface style={[
            styles.ownPostOptionsSheet,
            {
                paddingBottom: Math.max(18, insets.bottom +
                    12)
            }
        ]} motion={motion}>
            <Pressable onPress={(event) => event.stopPropagation()}>
              <View style={styles.ownPostOptionsHandle}/>

              <View style={styles.ownPostOptionsHeader}>
                <View style={styles.ownPostOptionsHeaderIcon}>
                  <Ionicons name="ellipsis-horizontal" size={19} color={colors.gold}/>
                </View>

                <View style={styles.ownPostOptionsHeaderCopy}>
                  <Text style={styles.ownPostOptionsTitle}>
                    Post options
                  </Text>

                  <Text style={styles.ownPostOptionsSubtitle}>
                    Manage your post.
                  </Text>
                </View>
              </View>

              <View style={styles.ownPostOptionsList}>
                {onEdit ? <Pressable accessibilityRole="button" accessibilityLabel="Edit Post" onPress={() => motion.closeAfterActionWithCallback(onEdit)} style={({ pressed }) => [
            styles.ownPostOptionsRow,
            pressed &&
                styles.ownPostOptionsRowPressed
        ]}>
                  <View style={styles.ownPostOptionsRowIcon}>
                    <Ionicons name="create-outline" size={20} color={colors.gold}/>
                  </View>

                  <View style={styles.ownPostOptionsRowCopy}>
                    <Text style={styles.ownPostOptionsRowTitle}>
                      Edit Post
                    </Text>

                    <Text style={styles.ownPostOptionsRowSubtitle}>
                      Update what you shared.
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color={colors.mutedText}/>
                </Pressable> : null}

                {onEdit && onDelete ? <View style={styles.ownPostOptionsDivider}/> : null}

                {onDelete ? <Pressable accessibilityRole="button" accessibilityLabel="Delete Post" onPress={() => motion.closeAfterActionWithCallback(onDelete)} style={({ pressed }) => [
            styles.ownPostOptionsRow,
            pressed &&
                styles.ownPostOptionsRowPressed
        ]}>
                  <View style={[
            styles.ownPostOptionsRowIcon,
            styles.ownPostOptionsDangerIcon
        ]}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger}/>
                  </View>

                  <View style={styles.ownPostOptionsRowCopy}>
                    <Text style={styles.ownPostOptionsDangerTitle}>
                      Delete Post
                    </Text>

                    <Text style={styles.ownPostOptionsRowSubtitle}>
                      Permanently remove this post.
                    </Text>
                  </View>
                </Pressable> : null}
              </View>

              <Text style={styles.ownPostOptionsHint}>
                Tap outside to cancel
              </Text>
            </Pressable>
          </UiSheetSurface>
        </Pressable>
      </UiSheetModal>
    );
}

function createStyles(colors: NovoriColors) {
    return StyleSheet.create({
        ownPostOptionsBackdrop: {
            flex: 1,
            backgroundColor: 'transparent',
            justifyContent: 'flex-end',
        },
        ownPostOptionsBackdropVisual: {
            ...StyleSheet.absoluteFill,
            backgroundColor: 'rgba(0,0,0,0.48)',
        },
        ownPostOptionsSheet: {
            width: '100%',
            alignSelf: 'center',
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 18,
            overflow: 'hidden',
        },
        ownPostOptionsHandle: {
            width: 42,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            alignSelf: 'center',
            marginBottom: 16,
        },
        ownPostOptionsHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 14,
            paddingHorizontal: 2,
        },
        ownPostOptionsHeaderIcon: {
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 11,
        },
        ownPostOptionsHeaderCopy: {
            flex: 1,
        },
        ownPostOptionsTitle: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 20,
        },
        ownPostOptionsSubtitle: {
            color: colors.secondaryText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            marginTop: 2,
        },
        ownPostOptionsList: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: colors.background,
        },
        ownPostOptionsRow: {
            minHeight: 66,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 13,
            paddingVertical: 10,
            backgroundColor: colors.background,
        },
        ownPostOptionsRowPressed: {
            backgroundColor: colors.elevated,
        },
        ownPostOptionsRowIcon: {
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
        },
        ownPostOptionsDangerIcon: {
            backgroundColor: 'rgba(220, 80, 80, 0.10)',
        },
        ownPostOptionsRowCopy: {
            flex: 1,
            paddingRight: 10,
        },
        ownPostOptionsRowTitle: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
        },
        ownPostOptionsDangerTitle: {
            color: colors.danger,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 14,
        },
        ownPostOptionsRowSubtitle: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11,
            lineHeight: 16,
            marginTop: 2,
        },
        ownPostOptionsDivider: {
            height: StyleSheet.hairlineWidth,
            backgroundColor: colors.border,
            marginLeft: 61,
        },
        ownPostOptionsHint: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 10,
            textAlign: 'center',
            marginTop: 11,
        },
    });
}
