import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNovoriTheme } from '../context/theme-context';
import { submitBookArtworkReport, type BookArtworkReason } from '../lib/reports';
import { useReportConfirmation } from '../lib/use-report-confirmation';
import { UiSheetBackdrop, UiSheetModal, UiSheetSurface, useUiSheetMotion } from './UiSheet';
import ValidationWarningSheet from './ValidationWarningSheet';

const reasons: { value: BookArtworkReason; label: string }[] = [
  { value: 'wrong_cover', label: 'Wrong cover artwork' },
  { value: 'blurry_cover', label: 'Blurry or low-quality cover' },
  { value: 'missing_cover', label: 'Cover is missing' },
];

export default function BookArtworkReportButton({ bookId, coverUrl }: { bookId: string; coverUrl: string | null }) {
  const { colors } = useNovoriTheme(), insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submitting = useRef(false);
  const confirmation = useReportConfirmation(open);
  const motion = useUiSheetMotion({ visible: open, busy, onDismiss: () => setOpen(false) });
  async function report(reason: BookArtworkReason) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError('');
    try {
      await submitBookArtworkReport(bookId, reason, coverUrl);
      confirmation.queue();
      motion.closeAfterAction();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not submit your report. Please try again.');
    } finally { submitting.current = false; setBusy(false); }
  }
  const copy = { color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 14 };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Report book cover" onPress={() => { setError(''); setOpen(true); }} hitSlop={6} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name="flag-outline" size={20} color={colors.gold}/>
    </Pressable>
    <UiSheetModal visible={open} transparent motion={motion} onDismiss={confirmation.afterDismiss} onRequestClose={() => motion.close()}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Cancel cover report" onPress={() => motion.close()} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}/>
        <UiSheetBackdrop motion={motion} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.48)' }}/>
        <UiSheetSurface motion={motion} style={{ width: '100%', maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Math.max(20, insets.bottom + 12) }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={{ ...copy, fontFamily: 'PlayfairDisplay_700Bold', fontSize: 23 }}>Report book cover</Text>
            <Text style={{ ...copy, color: colors.mutedText, lineHeight: 21, marginVertical: 12 }}>What is wrong with this cover? We’ll review it. Reporting does not change the artwork automatically.</Text>
            {reasons.map(reason => <Pressable key={reason.value} accessibilityRole="button" accessibilityLabel={reason.label} disabled={busy} onPress={() => void report(reason.value)} style={{ minHeight: 52, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}><Text style={copy}>{reason.label}</Text></Pressable>)}
            {busy ? <ActivityIndicator color={colors.gold} style={{ marginTop: 14 }}/> : null}
            {error ? <Text accessibilityRole="alert" style={{ ...copy, color: colors.danger, marginTop: 14 }}>{error}</Text> : null}
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => motion.close()} style={{ paddingVertical: 17 }}><Text style={{ ...copy, color: colors.gold }}>Cancel</Text></Pressable>
          </ScrollView>
        </UiSheetSurface>
      </View>
    </UiSheetModal>
    <ValidationWarningSheet visible={confirmation.visible} title="Cover report submitted" message="Thanks for helping improve Novori. Your report has been sent for review." icon="checkmark-circle-outline" dismissLabel="Got it" onDismiss={confirmation.dismiss}/>
  </>;
}
