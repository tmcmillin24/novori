import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import EditablePostCard from '../components/EditablePostCard';
import PostDestinationPicker from '../components/PostDestinationPicker';
import ReadingRecapPostAttachment from '../components/ReadingRecapPostAttachment';
import ValidationWarningSheet from '../components/ValidationWarningSheet';
import { useNovoriTheme } from '../context/theme-context';
import usePostComposerProfile from '../hooks/use-post-composer-profile';
import { getMyClubs, type ClubWithMembership } from '../lib/clubs';
import { isRecapSharePeriod, type ReadingRecapKind, type ReadingRecapSnapshot } from '../lib/reading-recap-card';
import { createRecapShareKey, getEditableReadingRecap, getReadingRecapSnapshot, publishReadingRecap, updateReadingRecap } from '../lib/reading-recap-sharing';

export default function ShareReadingRecapScreen() {
  const params = useLocalSearchParams<{ kind?: string; periodStart?: string; editPostId?: string }>();
  const router = useRouter();
  const { colors } = useNovoriTheme();
  const profile = usePostComposerProfile();
  const [snapshot, setSnapshot] = useState<ReadingRecapSnapshot | null>(null);
  const [clubs, setClubs] = useState<ClubWithMembership[]>([]);
  const [clubId, setClubId] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const publishing = useRef(false);
  const requestKey = useRef(createRecapShareKey());
  const selectedClub = clubs.find(club => club.id === clubId);
  const editing = Boolean(params.editPostId);
  const styles = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, title: { flex: 1, textAlign: 'center', color: colors.text, fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 20 },
    content: { padding: 20, paddingBottom: 32, width: '100%', maxWidth: 720, alignSelf: 'center' }, loading: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
    caption: { color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, minHeight: 28, paddingTop: 0, paddingBottom: 8, textAlignVertical: 'top' },
    privacy: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 10.5, lineHeight: 17, marginTop: 13, textAlign: 'center' },
    publish: { minHeight: 48, borderRadius: 14, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
    publishText: { color: colors.background, fontFamily: 'Inter_700Bold', fontSize: 13 }, disabled: { opacity: 0.5 }, error: { color: colors.mutedText, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center' },
    retry: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, link: { color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 12 }, pressed: { opacity: 0.7 },
  }), [colors]);

  useEffect(() => {
    let active = true;
    setLoading(true); setLoadError(null);
    async function load() {
      try {
        if (!editing && !isRecapSharePeriod(params.kind,params.periodStart)) throw new Error('Choose a recap from My Reading first.');
        const [joined, source] = await Promise.all([getMyClubs(), editing ? getEditableReadingRecap(params.editPostId!) : getReadingRecapSnapshot(params.kind as ReadingRecapKind,params.periodStart!)]);
        if (!active) return;
        setClubs(joined);
        if ('reading_recap' in source) {
          setSnapshot(source.reading_recap!); setCaption(source.body); setClubId(source.club_id);
        } else setSnapshot(source as ReadingRecapSnapshot);
      } catch (error) { if (active) setLoadError(error instanceof Error ? error.message : 'Could not load this recap. Please try again.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [params.kind,params.periodStart,params.editPostId,editing,retry]);

  const publish = useCallback(async () => {
    if (!snapshot || loading || publishing.current) return;
    publishing.current = true; setBusy(true);
    try {
      if (editing) await updateReadingRecap(params.editPostId!,caption,clubId);
      else await publishReadingRecap(snapshot,caption,clubId,requestKey.current);
      router.replace('/(tabs)');
    } catch (error) { setWarning(error instanceof Error ? error.message : 'Could not publish your recap. Please try again.'); }
    finally { publishing.current = false; setBusy(false); }
  }, [snapshot,loading,editing,params.editPostId,caption,clubId,router]);

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={busy} onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={24} color={colors.text} /></Pressable>
      <Text style={styles.title}>{editing ? 'Edit Reading Recap' : 'Share Reading Recap'}</Text><View style={styles.back} /></View>
    <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={24} showsVerticalScrollIndicator={false}>
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.gold} /></View> : loadError ? <View style={styles.loading}>
        <Text style={styles.error}>{loadError}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry recap draft" onPress={() => setRetry(value => value + 1)} style={styles.retry}><Text style={styles.link}>Try again</Text></Pressable>
      </View> : snapshot ? <>
        <PostDestinationPicker clubs={clubs} clubId={clubId} profile={profile} clubName={selectedClub?.name} disabled={busy} onClubIdChange={setClubId} />
        <EditablePostCard postType="post" readingRecap author={profile} clubId={clubId} clubName={selectedClub?.name} clubCoverUrl={selectedClub?.cover_url}>
          <TextInput accessibilityLabel="Reading recap caption" value={caption} onChangeText={setCaption} multiline maxLength={1200} editable={!busy}
            placeholder="Say something about your reading… (optional)" placeholderTextColor={colors.mutedText} style={styles.caption} />
          <ReadingRecapPostAttachment snapshot={snapshot} />
        </EditablePostCard>
        <Text style={styles.privacy}>Shares only the stats and covers shown here. Your notes and progress history stay private.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Save reading recap changes' : 'Publish reading recap'} disabled={busy} onPress={() => void publish()}
          style={({ pressed }) => [styles.publish,busy && styles.disabled,pressed && styles.pressed]}>
          {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.publishText}>{editing ? 'Save Changes' : 'Post Recap'}</Text>}
        </Pressable>
        {!editing ? <Pressable accessibilityRole="button" accessibilityLabel="Reload reading recap stats" disabled={busy} onPress={() => setRetry(value => value + 1)} style={styles.retry}><Text style={styles.link}>Refresh recap</Text></Pressable> : null}
      </> : null}
    </KeyboardAwareScrollView>
    <ValidationWarningSheet visible={Boolean(warning)} title="Could not share recap" message={warning ?? ''} onDismiss={() => setWarning(null)} />
  </SafeAreaView>;
}
