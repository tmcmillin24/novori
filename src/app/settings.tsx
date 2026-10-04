import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsDivider, SettingsHeader, SettingsIntro, SettingsSection, SettingsToggleRow, settingsStyles } from '../components/SettingsPrimitives';
import { useNovoriTheme } from '../context/theme-context';
import { getExplicitLanguagePreference, setExplicitLanguagePreference } from '../lib/content-filter';
import { supabase } from '../lib/supabase';

type SettingsRowProps = {
  icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; value?: string;
  danger?: boolean; comingSoon?: boolean; onPress?: () => void;
};
function SettingsRow({ icon, title, subtitle, value, danger, comingSoon, onPress }: SettingsRowProps) {
  const { colors } = useNovoriTheme();
  const styles = settingsStyles(colors);
  return <Pressable accessibilityRole={onPress && !comingSoon ? 'button' : undefined} accessibilityLabel={title}
    disabled={!onPress || comingSoon} onPress={onPress} style={({ pressed }) => [styles.row, comingSoon && styles.disabled, pressed && styles.pressed]}>
    <View style={styles.rowIcon}><Ionicons name={icon} size={18} color={danger ? colors.danger : colors.gold}/></View>
    <View style={styles.copy}><Text style={[styles.rowTitle, danger && { color: colors.danger }]}>{title}</Text>
      {subtitle ? <Text style={styles.rowDetail}>{subtitle}</Text> : null}
      {value ? <Text style={styles.rowDetail} selectable>{value}</Text> : null}
    </View>
    {comingSoon ? <Text style={[localStyles.soon, { color: colors.mutedText, borderColor: colors.border }]}>Soon</Text> : onPress ? <Ionicons name="chevron-forward" size={16} color={colors.mutedText}/> : null}
  </Pressable>;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, theme } = useNovoriTheme();
  const styles = settingsStyles(colors);
  const [email, setEmail] = useState('');
  const [allowExplicitLanguage, setAllowExplicitLanguage] = useState(false);
  const [explicitLoading, setExplicitLoading] = useState(true);
  const [explicitSaving, setExplicitSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (mounted) setEmail(user?.email ?? '');
        const preference = user ? await getExplicitLanguagePreference() : false;
        if (mounted) setAllowExplicitLanguage(preference);
      } catch (error) {
        console.error('Could not load settings:', error);
        if (mounted) setFailed(true);
      } finally { if (mounted) setExplicitLoading(false); }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  async function toggleExplicitLanguage(enabled: boolean) {
    if (explicitSaving || explicitLoading || failed) return;
    const previous = allowExplicitLanguage;
    setAllowExplicitLanguage(enabled);
    setExplicitSaving(true);
    try { setAllowExplicitLanguage(await setExplicitLanguagePreference(enabled)); }
    catch (error) {
      console.error('Could not update explicit-language preference:', error);
      setAllowExplicitLanguage(previous);
      Alert.alert('Could not save', 'Your explicit-language preference was not changed. Please try again.');
    } finally { setExplicitSaving(false); }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) { Alert.alert('Could not sign out', error.message); return; }
    router.replace('/auth');
  }
  function confirmSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of Novori?', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <SettingsHeader title="Settings"/>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SettingsIntro icon="options-outline" title="Make Novori yours." detail="Your reading space, your pace. Fine-tune how you connect, what you see, and how it feels."/>
      <SettingsSection icon="sparkles-outline" title="Your experience">
        <SettingsRow icon="notifications-outline" title="Notifications" subtitle="Reader activity, club alerts, and reading reminders" onPress={() => router.push('/notification-settings')}/>
        <SettingsDivider/>
        <SettingsRow icon={theme === 'dark' ? 'moon-outline' : 'sunny-outline'} title="Appearance" subtitle={`${theme === 'dark' ? 'Dark' : 'Light'} mode · Themes and display`} onPress={() => router.push('/appearance')}/>
      </SettingsSection>
      <SettingsSection icon="shield-checkmark-outline" title="Privacy & comfort">
        <SettingsRow icon="shield-checkmark-outline" title="Privacy" subtitle="Who can see your profile and reading activity" onPress={() => router.push('/privacy')}/>
        <SettingsDivider/>
        <SettingsToggleRow icon="eye-outline" title="Allow explicit language" subtitle={failed ? 'Preference unavailable. Reopen Settings to try again.' : 'Show explicit language in posts and comments.'}
          value={allowExplicitLanguage} disabled={explicitLoading || explicitSaving || failed} onValueChange={value => void toggleExplicitLanguage(value)}/>
        <SettingsDivider/>
        <SettingsRow icon="ban-outline" title="Blocked Readers" subtitle="Manage the readers you’ve blocked" onPress={() => router.push('/blocked-readers')}/>
      </SettingsSection>
      <SettingsSection icon="key-outline" title="Your account">
        <SettingsRow icon="mail-outline" title="Email" value={email || '—'}/>
        <SettingsDivider/>
        <SettingsRow icon="lock-closed-outline" title="Password & Security" comingSoon/>
        <SettingsDivider/>
        <SettingsRow icon="call-outline" title="Recovery Phone" subtitle="Optional account recovery" comingSoon/>
      </SettingsSection>
      <SettingsSection icon="help-circle-outline" title="About & support">
        <SettingsRow icon="information-circle-outline" title="About Novori" subtitle="Read. Discuss. Belong." onPress={() => router.push('/about-novori')}/>
        <SettingsDivider/>
        <SettingsRow icon="help-circle-outline" title="Help & Support" subtitle="Get help, report a problem, or share an idea" onPress={() => router.push('/help-support')}/>
      </SettingsSection>
      <SettingsSection icon="log-out-outline" title="Account actions">
        <SettingsRow icon="log-out-outline" title="Sign Out" onPress={confirmSignOut}/>
        <SettingsDivider/>
        <SettingsRow icon="person-remove-outline" title="Deactivate Account" danger comingSoon/>
      </SettingsSection>
      <Text style={[localStyles.footer, { color: colors.mutedText }]}>NOVORI · READ. DISCUSS. BELONG.</Text>
    </ScrollView>
  </SafeAreaView>;
}
const localStyles = StyleSheet.create({
  soon: { fontFamily: 'Inter_600SemiBold', fontSize: 9, borderWidth: 1, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 7 },
  footer: { textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: 8, letterSpacing: 1.4, marginTop: 26 },
});
