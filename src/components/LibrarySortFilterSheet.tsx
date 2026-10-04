import { useUiSheetMotion, UiSheetModal, UiSheetSurface, UiSheetBackdrop } from './UiSheet';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';
type SortMode = 'recent' | 'title' | 'author';
type OwnershipFilter = 'all' | 'owned' | 'not_owned';
type Props = {
    visible: boolean;
    sortMode: SortMode;
    ownershipFilter: OwnershipFilter;
    onChangeSort: (value: SortMode) => void;
    onChangeOwnership: (value: OwnershipFilter) => void;
    onDismiss: () => void;
};
const SORT_OPTIONS: Array<{
    value: SortMode;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
}> = [
    {
        value: 'recent',
        label: 'Recently Updated',
        icon: 'time-outline',
    },
    {
        value: 'title',
        label: 'Title',
        icon: 'text-outline',
    },
    {
        value: 'author',
        label: 'Author',
        icon: 'person-outline',
    },
];
const OWNERSHIP_OPTIONS: Array<{
    value: OwnershipFilter;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
}> = [
    {
        value: 'all',
        label: 'All Books',
        icon: 'library-outline',
    },
    {
        value: 'owned',
        label: 'Owned',
        icon: 'checkmark-circle-outline',
    },
    {
        value: 'not_owned',
        label: 'Not Owned',
        icon: 'ellipse-outline',
    },
];
export default function LibrarySortFilterSheet({ visible, sortMode, ownershipFilter, onChangeSort, onChangeOwnership, onDismiss, }: Props) {
    const { colors, } = useNovoriTheme();
    const styles = createStyles(colors);
    const insets = useSafeAreaInsets();
    const motion = useUiSheetMotion({ visible, busy: false, onDismiss: onDismiss });
    const closeSmoothly = motion.close;
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
                paddingBottom: Math.max(22, insets.bottom +
                    12)
            }
        ]} motion={motion}>
          <Pressable onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle}/>

            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Ionicons name="options-outline" size={21} color={colors.gold}/>
              </View>

              <View style={styles.headerCopy}>
                <Text style={styles.title}>
                  Sort & Filter
                </Text>

                <Text style={styles.subtitle}>
                  Fine-tune what appears in your Library.
                </Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>
              SORT BY
            </Text>

            <View style={styles.optionGroup}>
              {SORT_OPTIONS.map((option) => {
            const selected = sortMode ===
                option.value;
            return (<Pressable key={option.value} onPress={() => onChangeSort(option.value)} style={({ pressed, }) => [
                    styles.optionRow,
                    selected &&
                        styles.optionRowSelected,
                    pressed &&
                        styles.pressed,
                ]}>
                      <View style={styles.optionIcon}>
                        <Ionicons name={option.icon} size={18} color={selected
                    ? colors.gold
                    : colors.mutedText}/>
                      </View>

                      <Text style={[
                    styles.optionText,
                    selected &&
                        styles.optionTextSelected
                ]}>
                        {option.label}
                      </Text>

                      <View style={[
                    styles.radio,
                    selected &&
                        styles.radioSelected
                ]}>
                        {selected ? (<View style={styles.radioDot}/>) : null}
                      </View>
                    </Pressable>);
        })}
            </View>

            <Text style={[
            styles.sectionLabel,
            styles.secondSection
        ]}>
              OWNERSHIP
            </Text>

            <View style={styles.optionGroup}>
              {OWNERSHIP_OPTIONS.map((option) => {
            const selected = ownershipFilter ===
                option.value;
            return (<Pressable key={option.value} onPress={() => onChangeOwnership(option.value)} style={({ pressed, }) => [
                    styles.optionRow,
                    selected &&
                        styles.optionRowSelected,
                    pressed &&
                        styles.pressed,
                ]}>
                      <View style={styles.optionIcon}>
                        <Ionicons name={option.icon} size={18} color={selected
                    ? colors.gold
                    : colors.mutedText}/>
                      </View>

                      <Text style={[
                    styles.optionText,
                    selected &&
                        styles.optionTextSelected
                ]}>
                        {option.label}
                      </Text>

                      <View style={[
                    styles.radio,
                    selected &&
                        styles.radioSelected
                ]}>
                        {selected ? (<View style={styles.radioDot}/>) : null}
                      </View>
                    </Pressable>);
        })}
            </View>

            <Pressable onPress={closeSmoothly} style={({ pressed, }) => [
            styles.doneButton,
            pressed &&
                styles.pressed,
        ]}>
              <Text style={styles.doneText}>
                Done
              </Text>
            </Pressable>
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
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 18,
            paddingTop: 9,
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
            marginBottom: 18,
        },
        headerIcon: {
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: colors.elevated,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 11,
        },
        headerCopy: {
            flex: 1,
        },
        title: {
            color: colors.text,
            fontFamily: 'PlayfairDisplay_700Bold',
            fontSize: 20,
        },
        subtitle: {
            color: colors.mutedText,
            fontFamily: 'Inter_400Regular',
            fontSize: 11.5,
            lineHeight: 16,
            marginTop: 2,
        },
        sectionLabel: {
            color: colors.mutedText,
            fontFamily: 'Inter_700Bold',
            fontSize: 9,
            letterSpacing: 1,
            marginBottom: 7,
        },
        secondSection: {
            marginTop: 15,
        },
        optionGroup: {
            gap: 7,
        },
        optionRow: {
            minHeight: 48,
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 13,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            paddingHorizontal: 11,
        },
        optionRowSelected: {
            borderColor: colors.gold,
            backgroundColor: colors.elevated,
        },
        optionIcon: {
            width: 30,
            alignItems: 'flex-start',
        },
        optionText: {
            flex: 1,
            color: colors.text,
            fontFamily: 'Inter_500Medium',
            fontSize: 12.5,
        },
        optionTextSelected: {
            color: colors.gold,
            fontFamily: 'Inter_600SemiBold',
        },
        radio: {
            width: 18,
            height: 18,
            borderRadius: 9,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
        },
        radioSelected: {
            borderColor: colors.gold,
        },
        radioDot: {
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.gold,
        },
        doneButton: {
            minHeight: 46,
            borderRadius: 14,
            backgroundColor: colors.gold,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 18,
        },
        doneText: {
            color: colors.background,
            fontFamily: 'Inter_700Bold',
            fontSize: 12.5,
        },
        pressed: {
            opacity: 0.8,
        },
    });
}
