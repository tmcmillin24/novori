import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsDivider, SettingsHeader, SettingsSection, SettingsToggleRow, settingsStyles } from '../components/SettingsPrimitives';
import { useNovoriTheme } from '../context/theme-context';
import { getExplicitLanguagePreference, setExplicitLanguagePreference } from '../lib/content-filter';
import { signOutCurrentDevice } from '../lib/sign-out';
import DeletePostConfirmSheet from '../components/DeletePostConfirmSheet';
import { getLocalDateKey } from '../lib/reading-checkins';
import { setTestStreak, useStreakTest } from '../lib/streak-testing';
import ValidationWarningSheet from '../components/ValidationWarningSheet';

function SettingsRow({ icon, title, danger, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; title: string;
  danger?: boolean; onPress: () => void;
}) {
  const { colors } = useNovoriTheme();
  const styles = settingsStyles(colors);
  const content = <>
    <View style={styles.rowIcon}><Ionicons name={icon} size={18} color={danger ? colors.danger : colors.gold}/></View>
    <View style={styles.copy}>
      <Text style={[styles.rowTitle, danger && {color:colors.danger}]}>{title}</Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={colors.mutedText}/>
  </>;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
    style={({pressed}) => [styles.row, pressed && styles.pressed]}>{content}</Pressable>;
}

function StreakTestingSection({ userId, days }: { userId: string; days?: number }) {
  const { colors } = useNovoriTheme();
  const styles = settingsStyles(colors);
  const [value, setValue] = useState(String(days ?? 2));
  const count = Number(value);
  const valid = /^\d{1,6}$/.test(value);

  return <SettingsSection icon="flame-outline" title="Streak testing">
    <View style={{padding: 16, gap: 10}}>
      <Text style={styles.rowTitle}>Current test streak</Text>
      <Text style={{ color: colors.secondaryText }}>
        Set your starting streak, then check in on your Profile to advance it by one day. For example, set 2 to test the 3-day milestone.
      </Text>
      <TextInput accessibilityLabel="Current test streak" keyboardType="number-pad" value={value}
        onChangeText={setValue} maxLength={6}
        style={{ minHeight: 44, borderWidth: 1, borderColor: colors.mutedText, borderRadius: 10, paddingHorizontal: 12, color: colors.text }}
      />
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid }} disabled={!valid}
        style={{ minHeight: 44, justifyContent: 'center', opacity: valid ? 1 : 0.5 }}
        onPress={() => setTestStreak(userId, getLocalDateKey(), count)}>
        <Text style={styles.retryText}>Set test streak</Text>
      </Pressable>
      {days !== undefined && <>
        <Text accessibilityLiveRegion="polite" style={{ color: colors.secondaryText }}>Active test streak: {days} days</Text>
        <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}
          onPress={() => setTestStreak(userId, getLocalDateKey(), null)}>
          <Text style={styles.retryText}>Clear test streak</Text>
        </Pressable>
      </>}
    </View>
  </SettingsSection>;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, theme } = useNovoriTheme();
  const styles = settingsStyles(colors);
  const [signOutConfirmation,setSignOutConfirmation]=useState(false);
  const [signingOut,setSigningOut]=useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [allowExplicitLanguage, setAllowExplicitLanguage] = useState(false);
  const [explicitLoading, setExplicitLoading] = useState(true);
  const [explicitSaving, setExplicitSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const { userId: streakTesterId, test: streakTest } = useStreakTest(getLocalDateKey());

  const [explicitAttempt, setExplicitAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    setFailed(false);
    setExplicitLoading(true);
    getExplicitLanguagePreference()
      .then(preference => { if (mounted) setAllowExplicitLanguage(preference); })
      .catch(() => { if (mounted) setFailed(true); })
      .finally(() => { if (mounted) setExplicitLoading(false); });
    return () => { mounted = false; };
  }, [explicitAttempt]);

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
    if(signingOut)return;
    setSigningOut(true);
    try { await signOutCurrentDevice(); setSignOutConfirmation(false); router.replace('/auth'); }
    catch (error) { setSignOutConfirmation(false); setSignOutError((error as Error).message || 'Please try again.'); }
    finally {setSigningOut(false);}
  }
  function confirmSignOut() {setSignOutConfirmation(true);}

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <SettingsHeader title="Settings"/>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <SettingsSection icon="person-circle-outline" title="Account">
        <SettingsRow icon="lock-closed-outline" title="Password & Security" onPress={() => router.push('/password-security')}/>
      </SettingsSection>
      <SettingsSection icon="options-outline" title="Preferences">
        <SettingsRow icon="notifications-outline" title="Notifications" onPress={() => router.push('/notification-settings')}/>
        <SettingsDivider/>
        <SettingsRow icon={theme === 'dark' ? 'moon-outline' : 'sunny-outline'} title="Appearance" onPress={() => router.push('/appearance')}/>
      </SettingsSection>
      <SettingsSection icon="shield-checkmark-outline" title="Privacy & Comfort">
        <SettingsRow icon="shield-checkmark-outline" title="Privacy" onPress={() => router.push('/privacy')}/>
        <SettingsDivider/>
        <SettingsRow icon="ban-outline" title="Blocked Readers" onPress={() => router.push('/blocked-readers')}/>
        <SettingsDivider/>
        {failed || explicitLoading ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{failed ? 'Could not load explicit-language preference.' : 'Loading explicit-language preference…'}</Text>
            {failed && <Pressable accessibilityRole="button" accessibilityLabel="Retry explicit-language preference"
              style={styles.retry} onPress={() => setExplicitAttempt(attempt => attempt + 1)}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>}
          </View>
        ) : <SettingsToggleRow icon="eye-outline" title="Allow explicit language"
          value={allowExplicitLanguage} disabled={explicitSaving} onValueChange={value => void toggleExplicitLanguage(value)}/>}
      </SettingsSection>
      <SettingsSection icon="help-circle-outline" title="Help & About">
        <SettingsRow icon="help-circle-outline" title="Help & Support" onPress={() => router.push('/help-support')}/>
        <SettingsDivider/>
        <SettingsRow icon="information-circle-outline" title="About Novori" onPress={() => router.push('/about-novori')}/>
      </SettingsSection>
      {streakTesterId && <StreakTestingSection key={streakTesterId} userId={streakTesterId} days={streakTest?.days}/>}
      <SettingsSection icon="log-out-outline" title="Account actions">
        <SettingsRow icon="log-out-outline" title="Sign Out" onPress={confirmSignOut}/>
        <SettingsDivider/>
        <SettingsRow icon="person-remove-outline" title="Delete account" danger onPress={() => router.push('/delete-account')}/>
      </SettingsSection>
    </ScrollView>
    <DeletePostConfirmSheet visible={signOutConfirmation} icon="log-out-outline" title="Sign out of Novori?" message="You can sign back in whenever you’re ready." confirmLabel="Sign out" busy={signingOut} onConfirm={signOut} onDismiss={()=>{if(!signingOut)setSignOutConfirmation(false);}}/>
    <ValidationWarningSheet visible={!!signOutError} title="Could not sign out" message={signOutError} onDismiss={() => setSignOutError('')}/>
  </SafeAreaView>;
}
