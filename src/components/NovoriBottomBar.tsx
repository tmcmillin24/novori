import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
import { useTutorialTarget } from '../context/tutorial-context';

export const NOVORI_TAB_BAR_HEIGHT = 82;
export const novoriTabs = [
  { name: 'Home', path: '/(tabs)', segment: 'index', icon: 'home', target: 'tab-home' },
  { name: 'Discover', path: '/(tabs)/discover', segment: 'discover', icon: 'compass', target: 'tab-discover' },
  { name: 'Create', path: '/(tabs)/post', segment: 'post', icon: 'add', target: 'tab-create' },
  { name: 'Library', path: '/(tabs)/library', segment: 'library', icon: 'library', target: 'tab-library' },
  { name: 'Profile', path: '/(tabs)/profile', segment: 'profile', icon: 'person', target: 'tab-profile' },
] as const;
export type NovoriTab = (typeof novoriTabs)[number];

export default function NovoriBottomBar({ active, onTab, onLongPress }: {
  active?: string; onTab: (tab: NovoriTab) => void; onLongPress?: (tab: NovoriTab) => void;
}) {
  const { colors } = useNovoriTheme();
  return <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
    {novoriTabs.map(tab => <TabButton key={tab.segment} tab={tab} selected={tab.segment === active}
      onPress={() => onTab(tab)} onLongPress={onLongPress ? () => onLongPress(tab) : undefined}/>)}
  </View>;
}

function TabButton({ tab, selected, onPress, onLongPress }: {
  tab: NovoriTab; selected: boolean; onPress: () => void; onLongPress?: () => void;
}) {
  const { colors } = useNovoriTheme();
  const create = tab.segment === 'post';
  const target = useTutorialTarget(tab.target, create ? 27 : 10);
  const tint = selected ? colors.gold : colors.mutedText;
  const icon = (selected ? tab.icon : `${tab.icon}-outline`) as ComponentProps<typeof Ionicons>['name'];
  return <Pressable accessibilityRole={create ? 'button' : 'tab'} accessibilityLabel={tab.name}
    accessibilityState={{ selected }} accessibilityHint={create ? 'Open the Novori creation hub.' : undefined}
    testID={create ? 'create-tab-button' : undefined}
    ref={create ? undefined : target.ref} collapsable={false} onLayout={create ? undefined : target.onLayout}
    onPress={onPress} onLongPress={onLongPress} style={styles.item}>
    {create ? <View ref={target.ref} collapsable={false} onLayout={target.onLayout}
      style={[styles.create, { backgroundColor: colors.gold }]}>
        <Ionicons name="add" size={30} color={colors.background}/>
      </View> : <>
        <Ionicons name={icon} size={25} color={tint}/>
        <Text numberOfLines={1} style={[styles.label, { color: tint }]}>{tab.name}</Text>
      </>}
  </Pressable>;
}

const styles = StyleSheet.create({
  bar: { height: NOVORI_TAB_BAR_HEIGHT, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingBottom: 22 },
  item: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 1 },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  create: { width: 54, height: 54, borderRadius: 27, marginTop: -18, alignItems: 'center', justifyContent: 'center' },
});
