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
import ReadingStreakCelebration from '../components/ReadingStreakCelebration';
import { reachedReadingStreakTier, STREAK_TIERS } from '../lib/reading-streak-tier';
import { supabase } from '../lib/supabase';
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

const STREAK_TEST_ACCOUNT = 'novori.acc@gmail.com';

function StreakTestingSection() {
  const { colors } = useNovoriTheme();
  const styles = settingsStyles(colors);
  const [value, setValue] = useState(String(STREAK_TIERS[0].days));
  const [days, setDays] = useState<number | null>(null);
  const [replay, setReplay] = useState(0);
  const [region, setRegion] = useState({ width: 0, height: 0 });
  const count = value.trim() === '' ? NaN : Number(value);
  const valid = Number.isSafeInteger(count) && count >= 0;
  const tier = days === null ? undefined : reachedReadingStreakTier(days - 1, days);

  return <SettingsSection icon="flame-outline" title="Streak testing">
    <View style={{padding: 16, gap: 10}}>
      <Text style={styles.rowTitle}>Test streak days</Text>
      <Text style={{ color: colors.secondaryText }}>
        Preview a check-in milestone on this device. Milestones are {STREAK_TIERS.map(item => item.days).join(', ')} days.
      </Text>
      <TextInput
        accessibilityLabel="Test streak days"
        keyboardType="number-pad"
        value={value}
        onChangeText={setValue}
        maxLength={6}
        style={{ minHeight: 44, borderWidth: 1, borderColor: colors.mutedText, borderRadius: 10, paddingHorizontal: 12, color: colors.text }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !valid }}
        disabled={!valid}
        style={{ minHeight: 44, justifyContent: 'center', opacity: valid ? 1 : 0.5 }}
        onPress={() => {
          setDays(count);
          setReplay(previous => previous + 1);
        }}
      >
        <Text style={styles.retryText}>Test streak</Text>
      </Pressable>
      {days !== null && !tier && <Text accessibilityLiveRegion="polite" style={{ color: colors.secondaryText }}>
        Day {days} has no milestone celebration.
      </Text>}
      {tier && <View style={{ minHeight: 96 }} onLayout={({ nativeEvent }) => {
        const { width, height } = nativeEvent.layout;
        setRegion({ width, height });
      }}>
        {region.width > 0 && region.height > 0 && days !== null && <ReadingStreakCelebration
          key={replay} tier={tier} days={days} region={region} onDismiss={() => setDays(null)}
        />}
      </View>}
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

  const [streakTesterId, setStreakTesterId] = useState<string | null>(null);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setStreakTesterId(user?.email?.toLowerCase() === STREAK_TEST_ACCOUNT ? user.id : null);
    });
    return () => subscription.unsubscribe();
  }, []);

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
      {streakTesterId && <StreakTestingSection key={streakTesterId}/>}
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
