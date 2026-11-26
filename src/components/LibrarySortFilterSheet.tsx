import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUiSheetMotion, UiSheetModal, UiSheetSurface, UiSheetBackdrop } from './UiSheet';
import { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' }, { value: 'reading', label: 'Reading' },
  { value: 'want_to_read', label: 'TBR' }, { value: 'read', label: 'Read' },
  { value: 'dnf', label: 'DNF' },
] as const;
const OWNERSHIP_OPTIONS = [
  { value: 'all', label: 'All' }, { value: 'owned', label: 'Owned' },
  { value: 'not_owned', label: 'Not owned' },
] as const;
const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently updated' }, { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
] as const;

export type LibraryFilters = {
  status: typeof STATUS_OPTIONS[number]['value'];
  ownership: typeof OWNERSHIP_OPTIONS[number]['value'];
  sort: typeof SORT_OPTIONS[number]['value'];
};

export const DEFAULT_LIBRARY_FILTERS: LibraryFilters = { status: 'all', ownership: 'all', sort: 'recent' };

export function parseLibraryFilters(raw: string | null): LibraryFilters {
  try {
    const saved = raw ? JSON.parse(raw) : null;
    return {
      status: STATUS_OPTIONS.find(option => option.value === saved?.status)?.value ?? DEFAULT_LIBRARY_FILTERS.status,
      ownership: OWNERSHIP_OPTIONS.find(option => option.value === saved?.ownership)?.value ?? DEFAULT_LIBRARY_FILTERS.ownership,
      sort: SORT_OPTIONS.find(option => option.value === saved?.sort)?.value ?? DEFAULT_LIBRARY_FILTERS.sort,
    };
  } catch {
    return DEFAULT_LIBRARY_FILTERS;
  }
}

type Props = {
  visible: boolean;
  filters: LibraryFilters;
  onApply: (filters: LibraryFilters) => void;
  onDismiss: () => void;
};

export default function LibrarySortFilterSheet({ visible, filters, onApply, onDismiss }: Props) {
  const { colors } = useNovoriTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(filters);
  const motion = useUiSheetMotion({ visible, busy: false, onDismiss });

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  function group<Key extends keyof LibraryFilters>(key: Key, title: string,
    options: readonly { value: LibraryFilters[Key]; label: string }[]) {
    return <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.groupTitle}>{title}</Text>
      <View style={styles.choices}>
        {options.map(option => {
          const selected = draft[key] === option.value;
          return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: selected }}
            onPress={() => setDraft(current => ({ ...current, [key]: option.value }))}
            style={({ pressed }) => [styles.choice, selected && styles.selected, pressed && styles.pressed]}>
            <Text style={[styles.choiceText, selected && styles.selectedText]}>{option.label}</Text>
          </Pressable>;
        })}
      </View>
    </View>;
  }

  return <UiSheetModal visible={visible} transparent onRequestClose={motion.close} motion={motion}>
    <View style={styles.container}>
      <UiSheetBackdrop pointerEvents="none" style={styles.backdrop} motion={motion}/>
      <Pressable accessibilityLabel="Close Sort & Filter" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={motion.close}/>
      <UiSheetSurface accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom + 8) }]} motion={motion}>
        <View style={styles.handle}/>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Sort & Filter</Text>
          <Pressable accessibilityRole="button" onPress={() => setDraft(DEFAULT_LIBRARY_FILTERS)}
            style={({ pressed }) => [styles.reset, pressed && styles.pressed]}>
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        </View>
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {group('status', 'Reading status', STATUS_OPTIONS)}
          {group('ownership', 'Ownership', OWNERSHIP_OPTIONS)}
          {group('sort', 'Sort by', SORT_OPTIONS)}
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={() => { onApply(draft); motion.close(); }}
          style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}>
          <Text style={styles.applyText}>Apply</Text>
        </Pressable>
      </UiSheetSurface>
    </View>
  </UiSheetModal>;
}

function createStyles(colors: NovoriColors) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.52)' },
    sheet: {
      width: '100%', maxHeight: '89%', backgroundColor: colors.surface,
      borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 9, paddingHorizontal: 20,
    },
    handle: { alignSelf: 'center', width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
    title: { color: colors.text, fontFamily: 'PlayfairDisplay_700Bold', fontSize: 22, flexShrink: 1 },
    reset: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
    resetText: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
    body: { flexGrow: 0, flexShrink: 1 },
    bodyContent: { gap: 16, paddingVertical: 6 },
    group: { gap: 7 },
    groupTitle: { color: colors.secondaryText, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    choice: {
      minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10,
      backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    },
    selected: { backgroundColor: colors.elevated, borderColor: colors.gold },
    choiceText: { color: colors.text, fontFamily: 'Inter_500Medium', fontSize: 12 },
    selectedText: { color: colors.gold, fontFamily: 'Inter_700Bold' },
    applyButton: { minHeight: 46, marginTop: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gold },
    applyText: { color: colors.background, fontFamily: 'Inter_700Bold', fontSize: 13 },
    pressed: { opacity: 0.78 },
  });
}
