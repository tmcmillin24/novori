import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Linking, Pressable, Text } from 'react-native';
import { useNovoriTheme } from '../context/theme-context';
import { amazonBookSearchUrl } from '../lib/amazon-book-link';

export default function AmazonBookLink({ isbn, title, authors }: { isbn?: string | null; title: string; authors?: string[] | null }) {
  const { colors } = useNovoriTheme();
  const [busy, setBusy] = useState(false);
  return <Pressable accessibilityRole="link" accessibilityLabel={`Find ${title} on Amazon`} disabled={busy}
    onPress={async event => {
      event.stopPropagation(); setBusy(true);
      try { await Linking.openURL(amazonBookSearchUrl({ isbn, title, authors })); }
      catch { Alert.alert('Could not open Amazon', 'Please try again.'); }
      finally { setBusy(false); }
    }} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 12, alignSelf: 'flex-start', opacity: busy || pressed ? 0.6 : 1 })}>
    <Text style={{ color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>Find on Amazon</Text>
    <Ionicons name="open-outline" size={14} color={colors.gold}/>
  </Pressable>;
}
