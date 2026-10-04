import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DeletePostConfirmSheet from '../components/DeletePostConfirmSheet';
import ValidationWarningSheet from '../components/ValidationWarningSheet';
import { SettingsDivider, SettingsHeader, SettingsIntro, SettingsSection, settingsStyles } from '../components/SettingsPrimitives';
import { useNovoriTheme } from '../context/theme-context';
import { supabase } from '../lib/supabase';

const PASSWORD_RECOVERY_REDIRECT = 'novori://auth-confirm?flow=recovery';

export default function PasswordSecurityScreen() {
  const router = useRouter();
  const { colors } = useNovoriTheme();
  const styles = settingsStyles(colors);
  const [account, setAccount] = useState<{ email: string; verified: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState<'reset' | 'sessions' | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [confirmSessions, setConfirmSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [sessionsRevoked, setSessionsRevoked] = useState(false);
  const mounted = useRef(false);
  const mutation = useRef(false);

  const loadAccount = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!mounted.current) return;
      if (!user) { router.replace('/auth'); return; }
      setAccount({ email: user.email ?? '', verified: Boolean(user.email_confirmed_at) });
    } catch {
      if (mounted.current) setLoadError('Your account details couldn’t be loaded. Please try again.');
    } finally { if (mounted.current) setLoading(false); }
  }, [router]);

  useEffect(() => {
    mounted.current = true; void loadAccount();
    return () => { mounted.current = false; };
  }, [loadAccount]);

  async function sendResetEmail() {
    if (mutation.current || !account?.email) return;
    mutation.current = true; setBusy('reset');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(account.email, { redirectTo: PASSWORD_RECOVERY_REDIRECT });
      if (error) throw error;
      if (mounted.current) setNotice({ title: 'Check your email', message: `We sent a password reset link to ${account.email}. Open the newest email on your phone to choose a new password.` });
    } catch (error) {
      if (mounted.current) setNotice({ title: 'Could not send email', message: (error as { message?: string })?.message || 'Please try again in a moment.' });
    } finally { mutation.current = false; if (mounted.current) setBusy(null); }
  }

  async function signOutOtherDevices() {
    if (mutation.current || !account) return;
    mutation.current = true; setBusy('sessions'); setSessionsError('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      if (mounted.current) { setConfirmSessions(false); setSessionsRevoked(true); }
    } catch (error) {
      if (mounted.current) setSessionsError((error as { message?: string })?.message || 'Could not sign out other devices. Please try again.');
    } finally { mutation.current = false; if (mounted.current) setBusy(null); }
  }

  function action(icon: keyof typeof Ionicons.glyphMap, title: string, detail: string, onPress: () => void, disabled = false, working = false) {
    return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.row, disabled && styles.disabled, pressed && styles.pressed]}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={19} color={colors.gold} /></View>
      <View style={styles.copy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDetail}>{detail}</Text></View>
      {working ? <ActivityIndicator color={colors.gold} /> : <Ionicons name="chevron-forward" size={17} color={colors.mutedText} />}
    </Pressable>;
  }

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <SettingsHeader title="Password & Security" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SettingsIntro icon="shield-checkmark-outline" title="Keep your reading space yours." detail="Manage your password and access to your Novori account." />
      {loading ? <View style={styles.centered}><ActivityIndicator color={colors.gold} /></View> : loadError ?
        <View style={styles.centered}><Text style={styles.errorText}>{loadError}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry account details" style={styles.retry} onPress={() => void loadAccount()}><Text style={styles.retryText}>Try again</Text></Pressable></View> : account ? <>
        <SettingsSection icon="person-circle-outline" title="Your account">
          <View style={styles.row}><View style={styles.rowIcon}><Ionicons name="mail-outline" size={19} color={colors.gold} /></View><View style={styles.copy}><Text style={styles.rowTitle}>Account email</Text><Text selectable style={styles.rowDetail}>{account.email || 'Email unavailable'}</Text></View></View>
          <SettingsDivider />
          <View style={styles.row}><View style={styles.rowIcon}><Ionicons name={account.verified ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={19} color={colors.gold} /></View><View style={styles.copy}><Text style={styles.rowTitle}>Email verification</Text><Text style={styles.rowDetail}>{account.verified ? 'Verified' : 'Not verified'}</Text></View></View>
        </SettingsSection>
        <SettingsSection icon="key-outline" title="Password">
          {action('key-outline', 'Change password', 'Send a secure reset link to your account email.', () => void sendResetEmail(), Boolean(busy) || !account.email, busy === 'reset')}
          <View style={styles.note}><Ionicons name="lock-closed-outline" size={17} color={colors.gold} /><Text style={styles.noteText}>Open the newest reset email to choose your new password. Novori never displays your password.</Text></View>
        </SettingsSection>
        <SettingsSection icon="phone-portrait-outline" title="Signed-in devices">
          {action('log-out-outline', 'Sign out other devices', 'Keep this phone signed in and end other sessions.', () => { setSessionsError(''); setConfirmSessions(true); }, Boolean(busy), busy === 'sessions')}
          <View style={styles.note}><Ionicons name={sessionsRevoked ? 'checkmark-circle-outline' : 'information-circle-outline'} size={17} color={colors.gold} /><Text style={styles.noteText}>{sessionsRevoked ? 'Other sessions have been revoked. This phone stays signed in. Other devices lose access when their current session token expires.' : 'Other devices may remain signed in until their current session token expires.'}</Text></View>
        </SettingsSection>
      </> : null}
      <SettingsSection icon="help-circle-outline" title="Account help">
        {action('help-circle-outline', 'Get account help', 'Trouble with your email or worried about account access?', () => router.push('/help-support'))}
      </SettingsSection>
    </ScrollView>
    <ValidationWarningSheet visible={Boolean(notice)} title={notice?.title ?? ''} message={notice?.message ?? ''} icon="mail-outline" dismissLabel="Close password message" onDismiss={() => setNotice(null)} />
    <DeletePostConfirmSheet visible={confirmSessions} busy={busy === 'sessions'} icon="log-out-outline" title="Sign out other devices?"
      message={sessionsError || 'This phone will stay signed in. Other devices will lose access when their current session token expires.'}
      confirmLabel={sessionsError ? 'Try again' : 'Sign out other devices'} cancelLabel="Keep devices signed in" onConfirm={signOutOtherDevices} onDismiss={() => { if (!mutation.current) setConfirmSessions(false); }} />
  </SafeAreaView>;
}
