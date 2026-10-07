import { useUiSheetMotion, UiSheetModal, UiSheetSurface, UiSheetBackdrop } from './UiSheet';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
type Props = {
    visible: boolean;
    isBlocked: boolean;
    canInviteToClub: boolean;
    onInviteToClub: () => void;
    onBlock: () => void;
    onUnblock: () => void;
    onReport: () => void;
    onShare: () => void;
    onDismiss: () => void;
};
export default function ReaderProfileActionsSheet({ visible, isBlocked, canInviteToClub, onInviteToClub, onBlock, onUnblock, onReport, onShare, onDismiss, }: Props) {
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
                paddingBottom: Math.max(18, insets.bottom +
                    12)
            }
        ]} motion={motion}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle}/>

            <Text style={styles.title}>
              Profile options
            </Text>

            <Text style={styles.subtitle}>
              Choose an action for this reader.
            </Text>

            <View style={styles.list}>
              {canInviteToClub &&
            !isBlocked ? (<Pressable onPress={() => runAction(onInviteToClub)} style={({ pressed }) => [
                styles.row,
                pressed &&
                    styles.rowPressed,
            ]}>
                  <View style={styles.rowIcon}>
                    <Ionicons name="mail-outline" size={18} color={colors.gold}/>
                  </View>

                  <Text style={styles.rowText}>
                    Invite to a club
                  </Text>
                </Pressable>) : null}

              <Pressable onPress={() => runAction(isBlocked
            ? onUnblock
            : onBlock)} style={({ pressed }) => [
            styles.row,
            pressed &&
                styles.rowPressed,
        ]}>
                <View style={styles.rowIcon}>
                  <Ionicons name={isBlocked
            ? 'person-add-outline'
            : 'ban-outline'} size={18} color={colors.gold}/>
                </View>

                <Text style={styles.rowText}>
                  {isBlocked
            ? 'Unblock reader'
            : 'Block reader'}
                </Text>
              </Pressable>

              <Pressable onPress={() => runAction(onReport)} style={({ pressed }) => [
            styles.row,
            pressed &&
                styles.rowPressed,
        ]}>
                <View style={styles.rowIcon}>
                  <Ionicons name="flag-outline" size={18} color={colors.gold}/>
                </View>

                <Text style={styles.rowText}>
                  Report reader
                </Text>
              </Pressable>

              <Pressable onPress={() => runAction(onShare)} style={({ pressed }) => [
            styles.row,
            pressed &&
                styles.rowPressed,
        ]}>
                <View style={styles.rowIcon}>
                  <Ionicons name="share-outline" size={18} color={colors.gold}/>
                </View>

                <Text style={styles.rowText}>
                  Share profile
                </Text>
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
            paddingHorizontal: 16,
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
        title: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 19,
        },
        subtitle: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 12,
            lineHeight: 18,
            marginTop: 4,
            marginBottom: 12,
        },
        list: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: colors.background,
        },
        row: {
            minHeight: 58,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
        },
        rowPressed: {
            backgroundColor: colors.elevated,
        },
        rowIcon: {
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 11,
        },
        rowText: {
            color: colors.text,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
        },
    });
}
