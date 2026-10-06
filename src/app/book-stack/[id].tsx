import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BookStackShowcase from '../../components/BookStackShowcase';
import { useNovoriTheme } from '../../context/theme-context';
import { BookStack, getBookStack } from '../../lib/book-stacks';

export default function BookStackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useNovoriTheme();
  const [stack, setStack] = useState<BookStack | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    setStack(null);
    setSelectedId(null);
    getBookStack(id).then(value => { if (active) setStack(value); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, attempt]);
  return <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ height: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="chevron-back" size={24} color={colors.text}/>
      </Pressable>
      <Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', fontFamily: 'PlayfairDisplay_700Bold', fontSize: 21, color: colors.text }}>Book Stack</Text>
      <View style={{ width: 42 }}/>
    </View>
    {loading ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={colors.gold}/></View>
      : stack ? <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}>
        <BookStackShowcase name={stack.name} items={stack.items} variant="feed" interactive selectedId={selectedId} onSelectedIdChange={setSelectedId}
          onOpenBook={item => router.push({ pathname: '/book/[id]', params: { id: item.google_book_id, source: 'stack' } })}/>
      </ScrollView>
      : <View style={{ padding: 24, alignItems: 'center', gap: 16 }}>
        <Text style={{ color: colors.mutedText, fontFamily: 'Inter_400Regular', textAlign: 'center' }}>{failed ? 'Could not load this stack. Please try again.' : 'This stack is no longer available.'}</Text>
        {failed ? <Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)}><Text style={{ color: colors.gold, fontFamily: 'Inter_700Bold' }}>Try again</Text></Pressable> : null}
      </View>}
  </SafeAreaView>;
}
