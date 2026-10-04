import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DeletePostConfirmSheet from '../components/DeletePostConfirmSheet';
import ValidationWarningSheet from '../components/ValidationWarningSheet';
import { SettingsHeader, SettingsIntro, SettingsSection, settingsStyles } from '../components/SettingsPrimitives';
import { useNovoriTheme } from '../context/theme-context';
import { getAccountDeletionStatus, requestAccountDeletion, cancelAccountDeletion, transferDeletionClub, type AccountDeletionStatus, type DeletionClub } from '../lib/account-deletion';
import { signOutCurrentDevice } from '../lib/sign-out';

type Confirmation = { kind: 'schedule' | 'now' } | { kind: 'transfer'; club: DeletionClub; member: DeletionClub['members'][number] };
export default function DeleteAccountScreen() {
  const router = useRouter(), { colors } = useNovoriTheme(), styles = settingsStyles(colors);
  const [status, setStatus] = useState<AccountDeletionStatus | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false), [confirmation, setConfirmation] = useState<Confirmation | null>(null), [notice, setNotice] = useState(''), [confirmationError, setConfirmationError] = useState('');
  const mutation = useRef(false), mounted = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const next = await getAccountDeletionStatus(); if (mounted.current) setStatus(next); }
    catch { if (mounted.current) setError('Could not load account deletion. Please try again.'); }
    finally { if (mounted.current) setLoading(false); }
  }, []);
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; }; }, [load]);
  // Refresh the deadline once it passes; keep cancellation disabled even before the next refresh.
  useEffect(() => {
    if (!status?.delete_after || status.state !== 'pending') return;
    const remaining = new Date(status.delete_after).getTime() - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => void load(), Math.min(remaining + 100, 2147483647));
    return () => clearTimeout(timer);
  }, [status, load]);
  async function perform(action: () => Promise<AccountDeletionStatus>, cancelled = false, signOutAfter = false) {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setNotice(''); setConfirmationError('');
    let actionCompleted = false;
    try {
      const next = await action();
      actionCompleted = true;
      if (mounted.current) { setStatus(next); setConfirmation(null); if (cancelled) router.replace('/(tabs)/profile'); }
      if (signOutAfter) { await signOutCurrentDevice(); if (mounted.current) router.replace('/auth'); }
    } catch (e) { if (mounted.current) { const message = (e as { message?: string }).message || 'Could not complete this action. Please try again.'; if (confirmation && !actionCompleted) setConfirmationError(message); else setNotice(message); } }
    finally { mutation.current = false; if (mounted.current) setBusy(false); }
  }
  function openConfirmation(next: Confirmation) { setConfirmationError(''); setConfirmation(next); }
  async function confirm() {
    if (!confirmation) return;
    await perform(confirmation.kind === 'transfer' ? () => transferDeletionClub(confirmation.club.id, confirmation.member.id) : () => requestAccountDeletion(confirmation.kind === 'now'), false, confirmation.kind === 'now');
  }
  async function signOut() {
    if (mutation.current) return;
    try { await signOutCurrentDevice(); router.replace('/auth'); }
    catch (error) { setNotice((error as Error).message || 'Please try again.'); }
  }
  function action(title: string, detail: string, onPress: () => void, danger = false, disabled = false) {
    return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={busy || disabled} onPress={onPress} style={({ pressed }) => [styles.row, (busy || disabled) && styles.disabled, pressed && styles.pressed]}>
      <View style={styles.rowIcon}><Ionicons name={danger ? 'trash-outline' : 'arrow-undo-outline'} size={18} color={danger ? colors.danger : colors.gold}/></View>
      <View style={styles.copy}><Text style={[styles.rowTitle, danger && { color: colors.danger }]}>{title}</Text><Text style={styles.rowDetail}>{detail}</Text></View><Ionicons name="chevron-forward" size={16} color={colors.mutedText}/>
    </Pressable>;
  }
  const pending = status && status.state !== 'active';
  const canCancel = status?.can_cancel && !!status.delete_after && new Date(status.delete_after).getTime() > Date.now();
  const deadline = status?.delete_after ? new Date(status.delete_after).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' }) : '';
  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <SettingsHeader title="Delete account"/>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SettingsIntro icon="person-remove-outline" title={pending ? 'Your account is paused.' : 'Leaving your reading space?'} detail={pending ? 'Your profile is hidden and account activity is paused while deletion is scheduled.' : 'You can take seven days to change your mind, or choose permanent deletion now.'}/>
      {loading ? <View style={styles.centered}><ActivityIndicator color={colors.gold}/></View> : error ? <View style={styles.centered}><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry deletion status" style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try again</Text></Pressable></View> : status ? pending ? <>
        <SettingsSection icon="time-outline" title="Deletion schedule"><View style={styles.row}><View style={styles.copy}><Text style={styles.rowTitle}>{canCancel ? 'Scheduled for' : 'Deletion is underway'}</Text><Text style={styles.rowDetail}>{deadline} · Your phone’s time zone</Text><Text style={styles.rowDetail}>The server completes deletion even if you uninstall Novori. We’ll email you when it is finished.</Text></View></View></SettingsSection>
        {canCancel ? <SettingsSection icon="arrow-undo-outline" title="Changed your mind?">{action('Keep my account', 'Cancel deletion and restore your profile.', () => void perform(cancelAccountDeletion, true))}{action('Delete now', 'Start permanent deletion. This cannot be cancelled.', () => openConfirmation({ kind: 'now' }), true)}</SettingsSection> : <SettingsSection icon="information-circle-outline" title="Next steps">{action('Refresh deletion status', 'Check the server’s progress.', () => void load())}</SettingsSection>}
        <SettingsSection icon="log-out-outline" title="Your session">{action('Sign out', canCancel ? 'You can return before the deadline to cancel.' : 'Deletion will continue on the server.', () => void signOut())}</SettingsSection>
      </> : <>
        <SettingsSection icon="shield-checkmark-outline" title="What is removed"><View style={styles.row}><Text style={styles.noteText}>Your account, profile, library, private notes, reading history, uploads, and preferences are permanently removed. Your posts and comments become anonymous deletion notices; other readers’ replies stay in place.</Text></View><View style={styles.note}><Ionicons name="information-circle-outline" size={17} color={colors.gold}/><Text style={styles.noteText}>Shared book catalog data stays available to everyone. Provider security logs and backup copies expire under our hosting providers’ retention schedules. A completion email address is retained for up to seven days if delivery needs a retry, then removed.</Text></View></SettingsSection>
        {status.owned_clubs.map(club => <SettingsSection key={club.id} icon="people-outline" title={club.name} detail="Choose an existing member to take ownership before deleting your account.">
          {club.members.length ? club.members.map(member => <Pressable key={member.id} accessibilityRole="button" accessibilityLabel={`Transfer ${club.name} to ${member.name}`} disabled={busy} onPress={() => openConfirmation({ kind: 'transfer', club, member })} style={styles.row}><View style={styles.copy}><Text style={styles.rowTitle}>{member.name}</Text><Text style={styles.rowDetail}>{member.role === 'admin' ? 'Club admin' : 'Club member'}</Text></View><Ionicons name="chevron-forward" size={16} color={colors.gold}/></Pressable>) : <View style={styles.row}><Text style={styles.noteText}>There are no active members available. Return to the club to resolve its membership before deleting your account.</Text></View>}
        </SettingsSection>)}
        <SettingsSection icon="trash-outline" title="Delete your account" detail={status.enabled ? 'Clubs with no other members will also be deleted.' : 'Account deletion is being set up. Contact support@novori.link for help.'}>
          {action('Schedule deletion', 'Hide your profile now. Permanently delete in seven days.', () => openConfirmation({ kind: 'schedule' }), true, !status.enabled || status.owned_clubs.length > 0)}
          {action('Delete now', 'Start permanent deletion without a grace period.', () => openConfirmation({ kind: 'now' }), true, !status.enabled || status.owned_clubs.length > 0)}
        </SettingsSection>
      </> : null}
      <SettingsSection icon="help-circle-outline" title="Account help">{action('Get account help', 'Questions about deletion or trouble restoring your account?', () => router.push('/help-support'))}</SettingsSection>
    </ScrollView>
    <DeletePostConfirmSheet visible={!!confirmation} busy={busy} title={confirmation?.kind === 'transfer' ? 'Transfer club ownership?' : confirmation?.kind === 'now' ? 'Permanently delete your account?' : 'Schedule account deletion?'}
      message={confirmationError || (confirmation?.kind === 'transfer' ? `${confirmation.member.name} will become the owner of ${confirmation.club.name}. This transfers control of the club to them.` : confirmation?.kind === 'now' ? 'Deletion starts now and cannot be cancelled. Your personal data and authored content will be removed. Other readers’ replies will remain around anonymous deletion notices.' : 'Your profile will be hidden now. You have seven days to explicitly cancel before permanent deletion starts. Signing in alone does not cancel it.')}
      confirmLabel={confirmation?.kind === 'transfer' ? 'Transfer ownership' : confirmation?.kind === 'now' ? 'Delete permanently' : 'Schedule deletion'} onConfirm={confirm} onDismiss={() => { if (!mutation.current) setConfirmation(null); }}/>
    <ValidationWarningSheet visible={!!notice} title="Could not complete action" message={notice} onDismiss={() => setNotice('')}/>
  </SafeAreaView>;
}
