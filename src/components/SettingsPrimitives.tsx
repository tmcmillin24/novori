import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { NovoriColors } from '../constants/novori-theme';
import { useNovoriTheme } from '../context/theme-context';

type IconName = keyof typeof Ionicons.glyphMap;

export function SettingsHeader({ title, backDisabled=false }: { title: string; backDisabled?:boolean }) {
  const router = useRouter();
  const { colors } = useNovoriTheme();
  const styles = settingsStyles(colors);
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" accessibilityState={{disabled:backDisabled}} disabled={backDisabled} hitSlop={8} onPress={() => {if(!backDisabled)router.back();}} style={styles.backButton}>
      {!backDisabled?<Ionicons name="chevron-back" size={24} color={colors.text}/>:null}
    </Pressable>
    <Text style={styles.headerTitle}>{title}</Text>
    <View style={styles.backButton}/>
  </View>;
}

export function SettingsIntro({ icon, title, detail, children }: { icon: IconName; title: string; detail: string; children?: ReactNode }) {
  const { colors } = useNovoriTheme();
  const styles = settingsStyles(colors);
  return <View style={styles.intro}>
    <View style={styles.introHeading}>
      <View style={styles.introIcon}><Ionicons name={icon} size={23} color={colors.gold}/></View>
      <View style={styles.copy}><Text style={styles.eyebrow}>READ. DISCUSS. BELONG.</Text><Text style={styles.introTitle}>{title}</Text></View>
    </View>
    <Text style={styles.introDetail}>{detail}</Text>
    {children}
  </View>;
}

export function SettingsSection({ icon, title, detail, children }: { icon: IconName; title: string; detail?: string; children: ReactNode }) {
  const { colors } = useNovoriTheme();
  const styles = settingsStyles(colors);
  return <View style={styles.section}>
    <View style={styles.sectionHeading}><Ionicons name={icon} size={14} color={colors.gold}/><Text style={styles.sectionTitle}>{title}</Text><View style={styles.sectionRule}/></View>
    {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    <View style={styles.group}>{children}</View>
  </View>;
}

export function SettingsToggleRow({ icon, title, subtitle, value, disabled = false, onValueChange }: {
  icon: IconName; title: string; subtitle: string; value: boolean; disabled?: boolean; onValueChange: (value: boolean) => void;
}) {
  const { colors } = useNovoriTheme();
  const styles = settingsStyles(colors);
  return <View style={[styles.row, disabled && styles.disabled]}>
    <View style={styles.rowIcon}><Ionicons name={icon} size={18} color={colors.gold}/></View>
    <View style={styles.copy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDetail}>{subtitle}</Text></View>
    <Switch accessibilityLabel={title} value={value} disabled={disabled} onValueChange={onValueChange}
      trackColor={{ false: colors.border, true: colors.gold }} thumbColor={value ? colors.background : colors.secondaryText} ios_backgroundColor={colors.border}/>
  </View>;
}

export function SettingsDivider() {
  const { colors } = useNovoriTheme();
  return <View style={settingsStyles(colors).divider}/>;
}

export function settingsStyles(colors: NovoriColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', color: colors.text, fontFamily: 'PlayfairDisplay_700Bold', fontSize: 21 },
    content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40 },
    intro: { backgroundColor: colors.surface, borderRadius: 22, borderWidth: 1, borderColor: colors.border, borderTopColor: colors.gold,
      padding: 18, shadowColor: '#000000', shadowOpacity: .07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    introHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    introIcon: { width: 46, height: 46, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
    eyebrow: { color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 1.1, marginBottom: 5 },
    introTitle: { color: colors.text, fontFamily: 'PlayfairDisplay_700Bold', fontSize: 23, lineHeight: 29 },
    introDetail: { color: colors.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 12 },
    section: { marginTop: 22 },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingHorizontal: 3 },
    sectionTitle: { color: colors.gold, fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
    sectionRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 4 },
    sectionDetail: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginBottom: 10, paddingHorizontal: 3 },
    group: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, overflow: 'hidden' },
    row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 12 },
    rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
    copy: { flex: 1, minWidth: 0 },
    rowTitle: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 },
    rowDetail: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 3 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 56, marginRight: 13 },
    note: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.elevated },
    noteText: { flex: 1, color: colors.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 },
    statusPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10, marginTop: 12 },
    statusText: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 10 },
    centered: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
    errorText: { color: colors.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18 },
    retry: { minHeight: 40, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
    retryText: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
    disabled: { opacity: .5 },
    pressed: { opacity: .7 },
  });
}
